"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Clock, Shield, Briefcase, ChevronLeft, 
  MessageSquare, Search, X, Edit, Check, CheckCheck 
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";
import { usePresence } from '@/components/GlobalPresence';

const CHAT_ROLES = [
  { id: 'admin', label: 'Admin', desc: 'System & Account Support', icon: Shield },
  { id: 'manager', label: 'Property Manager', desc: 'Maintenance & Daily Operations', icon: Briefcase },
  { id: 'tenant', label: 'Tenant', desc: 'Your current lessee', icon: User },
];

export default function ConversationTab({ userData, units }: { userData: any, units: any[] }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string>(''); 
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({
    admin: 'Admin',
    manager: 'Property Manager',
    tenant: 'Tenant'
  });

  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [roleEmails, setRoleEmails] = useState<Record<string, string>>({ admin: '', manager: '', tenant: '' });
  const [isContactsLoading, setIsContactsLoading] = useState(true);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const onlineUsers = usePresence();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchActualNames = async () => {
      setIsContactsLoading(true);
      if (!userData?.admin_email) {
        setIsContactsLoading(false);
        return;
      }

      const fetchedNames = { admin: 'Admin', manager: 'Property Manager', tenant: 'Tenant' };
      const fetchedEmails = { admin: userData.admin_email, manager: '', tenant: '' };
      
      let foundTenantEmail = null;

      try {
        const { data: adminData } = await supabase.from('team_members').select('name').eq('email', userData.admin_email).single();
        if (adminData?.name) fetchedNames.admin = adminData.name;

        const { data: managerData } = await supabase.from('team_members').select('name, email').eq('admin_email', userData.admin_email).ilike('role', '%manager%').limit(1).maybeSingle();
        if (managerData) {
          if (managerData.name) fetchedNames.manager = managerData.name;
          if (managerData.email) fetchedEmails.manager = managerData.email;
        }

        if (units && units.length > 0) {
          const unitNames = units.map(u => `${u.property_name} - ${u.unit_number}`);
          const { data: tenantsData } = await supabase.from('team_members').select('name, email, access_level').eq('role', 'Tenant').eq('admin_email', userData.admin_email);

          if (tenantsData) {
            const matchedTenant = tenantsData.find(t => unitNames.some((un: string) => t.access_level?.includes(un)));
            if (matchedTenant) {
              foundTenantEmail = matchedTenant.email;
              fetchedEmails.tenant = matchedTenant.email;
              fetchedNames.tenant = matchedTenant.name || 'Tenant';
            }
          }
        }

        setTenantEmail(foundTenantEmail);
        setRoleEmails(fetchedEmails);
        setCustomNames(fetchedNames);
      } catch (error) {
        console.error("Error fetching actual names:", error);
      } finally {
        setIsContactsLoading(false);
      }
    };

    fetchActualNames();
  }, [userData, units]);

  useEffect(() => {
    setIsSearchActive(false);
    setSearchQuery("");
  }, [activeChat]);

  useEffect(() => {
    if (userData?.email) fetchMessages();
  }, [userData]);

  useEffect(() => {
    if (!searchQuery) scrollToBottom();
  }, [messages, activeChat, searchQuery]);

  const isMessageForRole = (msg: any, roleId: string) => {
    if (msg.sender_email === userData.email) {
      if (roleId === 'tenant') return msg.recipient_role === 'owner' && msg.tenant_email === tenantEmail;
      return msg.recipient_role === roleId;
    } else {
      if (roleId === 'admin') return msg.sender_email === userData.admin_email;
      if (roleId === 'tenant') return msg.sender_email === tenantEmail;
      if (roleId === 'manager') return msg.sender_email !== userData.admin_email && msg.sender_email !== tenantEmail;
      return false;
    }
  };

  useEffect(() => {
    const markAsRead = async () => {
      if (!activeChat || !userData?.email || messages.length === 0) return;
      
      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_email !== userData.email && isMessageForRole(m, activeChat))
        .map(m => m.id);

      if (unreadIds.length === 0) return;

      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));

      try {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      } catch (err) {
        console.error("Could not update read status:", err);
      }
    };
    markAsRead();
  }, [activeChat, messages, userData?.email, userData?.admin_email, tenantEmail]);

  useEffect(() => {
    if (!userData?.email || !userData?.admin_email) return;

    const channel = supabase
      .channel('owner-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          if (msg.sender_email === userData.email || msg.recipient_role === 'owner' || msg.tenant_email === userData.email) {
            setMessages((current) => {
              if (current.some(m => m.id === msg.id)) return current;
              return [...current, msg];
            });
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((current) => current.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userData]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('admin_email', userData.admin_email).or(`sender_email.eq.${userData.email},recipient_role.eq.owner,tenant_email.eq.${userData.email}`).order('created_at', { ascending: true });
      if (!error && data) setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userData || !activeChat) return;
    
    if (activeChat === 'tenant' && !tenantEmail) {
      alert("No tenant is currently assigned to your properties.");
      return;
    }

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); 

    const payload = {
      tenant_email: activeChat === 'tenant' ? tenantEmail : userData.email,
      admin_email: userData.admin_email || "",
      sender_email: userData.email,
      content: textToSend,
      is_from_tenant: activeChat !== 'tenant',
      recipient_role: activeChat === 'tenant' ? 'owner' : activeChat, 
      is_read: false 
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (!error && data) {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(textToSend); 
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const getLastMessage = (roleId: string) => {
    const roleMsgs = messages.filter(m => isMessageForRole(m, roleId));
    return roleMsgs.length > 0 ? roleMsgs[roleMsgs.length - 1] : null;
  };

  const sortedRoles = [...CHAT_ROLES].sort((a, b) => {
    const lastA = getLastMessage(a.id)?.created_at || '0';
    const lastB = getLastMessage(b.id)?.created_at || '0';
    return new Date(lastB).getTime() - new Date(lastA).getTime();
  });

  const roleMessages = messages.filter((msg) => isMessageForRole(msg, activeChat));
  const displayedMessages = searchQuery.trim() === "" ? roleMessages : roleMessages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeRoleDetails = CHAT_ROLES.find(r => r.id === activeChat);
  const ActiveIcon = activeRoleDetails?.icon || User;
  const currentChatName = activeChat ? customNames[activeChat] : "";
  const isActiveRoleOnline = activeChat && roleEmails[activeChat] ? onlineUsers.includes(roleEmails[activeChat]) : false;

  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'tenant') return <span className="shrink-0 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tenant</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>;
    return null;
  };

  return (
    <div className="absolute inset-0 flex bg-white font-sans z-20 overflow-hidden pb-[80px] md:pb-0">
      
      {/* SIDEBAR */}
      <div className={`w-full md:w-[360px] flex flex-col border-r border-slate-200 bg-white ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* SIDEBAR HEADER */}
        <div className="shrink-0 pt-6 pb-4 px-5 border-b border-slate-100">
          <div className="flex justify-between items-center mb-5">
            <h1 className="text-2xl font-black text-[#0a1e3f] tracking-tight">Chats</h1>
            <button 
              onClick={() => setIsEditingNames(!isEditingNames)}
              className={`p-2 rounded-full transition-all border ${isEditingNames ? 'bg-emerald-50 border-emerald-200 text-[#359b46]' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            >
              {isEditingNames ? <Check size={18} /> : <Edit size={16} />}
            </button>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              className="w-full bg-slate-100/70 border border-slate-200/50 text-[16px] md:text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#359b46]/20 focus:border-[#359b46] cursor-not-allowed"
              disabled
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {isContactsLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400"><Clock className="animate-spin mb-2" /> Loading...</div>
          ) : (
            sortedRoles.map((role) => {
              const Icon = role.icon;
              const isActive = activeChat === role.id;
              const lastMsg = getLastMessage(role.id);
              const displayTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const unreadCount = messages.filter(m => !m.is_read && m.sender_email !== userData.email && isMessageForRole(m, role.id)).length;
              const isOnline = roleEmails[role.id] && onlineUsers.includes(roleEmails[role.id]);

              return (
                <div key={role.id} onClick={() => { if (!isEditingNames) setActiveChat(role.id); }} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer ${isActive && !isEditingNames ? 'bg-[#359b46]/5' : 'hover:bg-slate-50'}`}>
                  <div className="relative shrink-0">
                    <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-sm border border-slate-200 ${isActive && !isEditingNames ? 'bg-gradient-to-br from-[#359b46] to-[#277534] text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isEditingNames ? (
                        <input type="text" value={customNames[role.id] || role.label} onChange={(e) => setCustomNames(prev => ({ ...prev, [role.id]: e.target.value }))} className="text-[16px] font-bold text-[#359b46] border-b border-[#359b46]/30 bg-transparent outline-none w-full" onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <>
                          <h3 className={`text-[15px] truncate ${unreadCount > 0 ? 'font-bold text-[#0a1e3f]' : isActive ? 'font-semibold text-[#0a1e3f]' : 'font-medium text-slate-800'}`}>{customNames[role.id] || role.label}</h3>
                          {renderRoleBadge(role.id)}
                        </>
                      )}
                    </div>
                    <p className={`text-[13px] truncate ${unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                      {lastMsg ? (
                        <span>
                          <span className={unreadCount > 0 ? "text-[#0a1e3f]" : "text-slate-600 font-medium"}>
                            {lastMsg.sender_email === userData.email ? "You: " : ""}
                          </span>
                          {lastMsg.content}
                        </span>
                      ) : (
                        role.id === 'tenant' && !tenantEmail ? "No tenant assigned" : role.desc
                      )}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0 gap-1.5">
                    <span className={`text-[11px] ${unreadCount > 0 ? 'font-bold text-[#359b46]' : 'text-slate-400'}`}>{displayTime}</span>
                    {unreadCount > 0 && !isEditingNames && <span className="bg-red-500 text-white text-[10px] font-black h-5 px-1.5 rounded-full flex items-center shadow-sm">{unreadCount}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-white relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100"><MessageSquare size={40} className="text-slate-300" /></div>
            <h2 className="text-xl font-bold text-slate-700">No Chat Selected</h2>
            <p className="text-sm text-slate-500">Choose a contact to view your conversation.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="shrink-0 h-[70px] md:h-[80px] bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-3 md:px-6 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={() => setActiveChat('')} className="md:hidden p-2 text-[#359b46] hover:bg-slate-50 rounded-full"><ChevronLeft size={24} /></button>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500"><ActiveIcon size={20} /></div>
                  {isActiveRoleOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-[#0a1e3f] text-[15px] md:text-[17px] truncate">{currentChatName}</h2>
                    {renderRoleBadge(activeRoleDetails?.id)}
                  </div>
                  <p className="text-[12px] truncate">
                    {isActiveRoleOnline ? <span className="text-green-600 font-medium">Active now</span> : <span className="text-slate-400">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 mx-1">•</span>
                    <span className="hidden sm:inline text-slate-500">{activeRoleDetails?.desc}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2.5 rounded-full ${isSearchActive ? 'bg-[#359b46] text-white' : 'text-[#359b46] hover:bg-emerald-50'}`}><Search size={20} /></button>
            </div>

            {isSearchActive && (
              <div className="shrink-0 bg-white border-b border-slate-100 p-2.5 px-4 flex items-center gap-2 z-10 shadow-sm">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search chat..." className="w-full bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-[16px] md:text-sm focus:outline-none" autoFocus />
                </div>
                <button onClick={() => { setIsSearchActive(false); setSearchQuery(""); }} className="text-slate-500 text-sm font-bold p-2">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white space-y-3 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-400 gap-2"><Clock size={16} className="animate-spin" /> Loading...</div>
              ) : activeChat === 'tenant' && !tenantEmail ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto opacity-70">
                  <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4"><User size={36} className="text-slate-300" /></div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">No Assigned Tenant</h3>
                  <p className="text-sm text-slate-500">You currently do not have a registered tenant actively linked to your properties.</p>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto opacity-70">
                  <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4"><ActiveIcon size={36} className="text-slate-300" /></div>
                  <h3 className="text-lg font-bold text-slate-700 mb-1">{searchQuery ? "No messages found" : `Say hello to ${currentChatName}`}</h3>
                  <p className="text-sm text-slate-500">{searchQuery ? `We couldn't find "${searchQuery}" in this conversation.` : "Start a conversation to request information or coordinate operations."}</p>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isMe = msg.sender_email === userData.email;
                  const isPending = msg.id.toString().startsWith('temp_');
                  return (
                    <div key={msg.id || idx} className={`w-full flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div 
                        className={`max-w-[85%] md:max-w-[70%] px-4 py-2 md:py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                          isMe ? 'bg-[#359b46] text-white rounded-[22px] rounded-br-[4px]' : 'bg-[#f0f2f5] text-slate-900 rounded-[22px] rounded-bl-[4px]'
                        } ${isPending ? 'opacity-70' : 'opacity-100'}`}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {msg.content}
                      </div>
                      
                      <div className="text-[10px] font-medium text-slate-400 mt-1 flex items-center gap-1.5">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          isPending ? <Clock size={12} className="text-slate-300" /> : 
                          msg.is_read ? <CheckCheck size={14} className="text-blue-500" /> : 
                          <CheckCheck size={14} className="text-slate-300" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* INPUT AREA */}
            <div className="shrink-0 p-2 md:p-4 bg-white border-t border-slate-100 pb-safe z-10">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2 md:gap-3 items-end">
                <div className="flex-1 bg-[#f0f2f5] rounded-[24px] px-4 md:px-5 py-1.5 md:py-2 flex items-center min-h-[44px] md:min-h-[48px]">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={activeChat === 'tenant' && !tenantEmail ? "No tenant assigned..." : "Aa"}
                    className="w-full bg-transparent border-none outline-none text-[16px] md:text-[15px] text-slate-900"
                    disabled={isSending || isLoading || (activeChat === 'tenant' && !tenantEmail)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending || (activeChat === 'tenant' && !tenantEmail)}
                  className={`h-[44px] w-[44px] md:h-[48px] md:w-[48px] rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    newMessage.trim() ? 'text-[#359b46] hover:bg-emerald-50' : 'text-slate-300'
                  }`}
                >
                  {isSending ? <Clock size={20} className="animate-spin" /> : <Send size={20} className={newMessage.trim() ? 'translate-x-0.5' : ''} />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { width: 5px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .pb-safe { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}