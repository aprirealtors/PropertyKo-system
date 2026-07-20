"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Clock, ChevronLeft, MessageSquare, Search, 
  X, Briefcase, Wrench, Key, Edit, Check, Shield, CheckCheck 
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";
import { usePresence } from '@/components/GlobalPresence';

export default function ConversationTab({ orgData, managerProfile }: { orgData: any, managerProfile: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string>(''); 
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  const [contactSearch, setContactSearch] = useState(""); 
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false); 
  
  const onlineUsers = usePresence();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setIsSearchActive(false);
    setChatSearchQuery("");
  }, [activeChat]);

  useEffect(() => {
    if (orgData?.admin_email && managerProfile?.email) {
      fetchData();
    }
  }, [orgData, managerProfile]);

  useEffect(() => {
    if (!chatSearchQuery) scrollToBottom();
  }, [messages, activeChat, chatSearchQuery]);

  // ✨ PERFECTED MANAGER ROUTING LOGIC
  const isMessageForContact = (msg: any, contactId: string, contactType: string) => {
    if (contactType === 'admin') {
      return msg.tenant_email === managerProfile.email && (msg.recipient_role === 'admin' || msg.sender_email === orgData.admin_email);
    } else if (contactType === 'maintenance') {
      return msg.tenant_email === contactId && (msg.recipient_role === 'manager' || msg.recipient_role === 'maintenance');
    } else {
      return msg.tenant_email === contactId && msg.recipient_role === 'manager';
    }
  };

  // Messages Read Status
  useEffect(() => {
    const markAsRead = async () => {
      const activeContact = contacts.find(c => c.id === activeChat);
      if (!activeContact || !orgData?.admin_email || messages.length === 0) return;

      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_email !== managerProfile.email && isMessageForContact(m, activeContact.id, activeContact.type))
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
  }, [activeChat, messages, orgData?.admin_email, managerProfile?.email, contacts]);

  // 🌟 REALTIME MESSAGES & UPDATES
  useEffect(() => {
    if (!orgData?.admin_email || !managerProfile?.email) return;

    const channel = supabase
      .channel('manager-live-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${orgData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          if (msg.recipient_role === 'manager' || 
             (msg.tenant_email === managerProfile.email && ['admin'].includes(msg.recipient_role)) || 
             ['maintenance'].includes(msg.recipient_role) || 
             msg.sender_email === managerProfile.email) {
            
            setMessages((current) => {
              if (current.some(m => m.id === msg.id)) return current;
              return [...current, msg];
            });
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `admin_email=eq.${orgData.admin_email}` },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((current) => current.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgData, managerProfile]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: tenantMsgs } = await supabase.from('messages').select('*').eq('admin_email', orgData.admin_email).eq('recipient_role', 'manager');
      const { data: sysMsgs } = await supabase.from('messages').select('*').eq('admin_email', orgData.admin_email).or(`tenant_email.eq.${managerProfile.email},sender_email.eq.${managerProfile.email}`).in('recipient_role', ['admin', 'maintenance']);

      const allMsgsMap = new Map();
      [...(tenantMsgs || []), ...(sysMsgs || [])].forEach(m => allMsgsMap.set(m.id, m));
      setMessages(Array.from(allMsgsMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

      const { data: usersData } = await supabase.from('team_members').select('name, email, role, access_level').eq('admin_email', orgData.admin_email).in('role', ['Tenant', 'Owner', 'Maintenance staff']); 

      const contactsMap = new Map();
      
      // 🌟 FIX APPLIED HERE: Ginawang orgData.admin_email ang ID imbis na 'admin'
      contactsMap.set(orgData.admin_email, { 
        id: orgData.admin_email, 
        name: 'Admin', 
        unit: 'System & Account Support', 
        type: 'admin', 
        icon: Shield 
      });

      if (usersData) {
        usersData.forEach(user => {
          if (user.email && user.email.trim() !== '') { 
            let unitLabel = user.access_level ? user.access_level : 'No unit assigned';
            let icon = User;
            let type = user.role.toLowerCase();

            if (user.role === 'Owner') { icon = Key; type = 'owner'; }
            if (user.role === 'Maintenance staff') {
              icon = Wrench;
              unitLabel = 'Repairs & Operations';
              type = 'maintenance'; 
            }
            if (user.role === 'Tenant') { type = 'tenant'; }
            
            contactsMap.set(user.email, { 
              id: user.email, 
              name: user.name || user.email, 
              unit: unitLabel,
              type: type, 
              icon: icon
            });
          }
        });
      }

      setContacts(Array.from(contactsMap.values()));

      const initialNames: Record<string, string> = {};
      contactsMap.forEach((val, key) => { initialNames[key] = val.name; });
      setCustomNames(prev => ({ ...initialNames, ...prev }));

    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !orgData || !activeChat) return;

    const activeContact = contacts.find(c => c.id === activeChat);
    if (!activeContact) return;

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); 

    const authEmail = managerProfile.email;

    const payload = {
      tenant_email: activeContact.type === 'admin' ? authEmail : activeChat,
      admin_email: orgData.admin_email,
      sender_email: authEmail, 
      content: textToSend,
      is_from_tenant: activeContact.type === 'admin' || activeContact.type === 'maintenance', 
      recipient_role: activeContact.type === 'admin' || activeContact.type === 'maintenance' ? activeContact.type : 'manager',
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

  const getLastMessage = (contactId: string, type: string) => {
    const roleMsgs = messages.filter(m => isMessageForContact(m, contactId, type));
    return roleMsgs.length > 0 ? roleMsgs[roleMsgs.length - 1] : null;
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    const lastA = getLastMessage(a.id, a.type)?.created_at || '0';
    const lastB = getLastMessage(b.id, b.type)?.created_at || '0';
    
    if (lastA === '0' && lastB === '0') {
      const isASystem = a.type === 'admin' || a.type === 'maintenance';
      const isBSystem = b.type === 'admin' || b.type === 'maintenance';
      if (isASystem && !isBSystem) return -1;
      if (!isASystem && isBSystem) return 1;
    }
    return new Date(lastB).getTime() - new Date(lastA).getTime();
  });

  const filteredContacts = contactSearch.trim() === "" ? sortedContacts : sortedContacts.filter(c => 
    (customNames[c.id] || c.name).toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.unit.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.type.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const activeContactDetails = contacts.find(c => c.id === activeChat);
  const ActiveIcon = activeContactDetails?.icon || User;
  const currentChatName = activeContactDetails ? (customNames[activeContactDetails.id] || activeContactDetails.name) : "User";
  
  // 🌟 FIX: Ngayon mag-mamatch na ang admin email sa online users array!
  const isActiveContactOnline = activeContactDetails && onlineUsers.includes(activeContactDetails.id);

  const roleMessages = messages.filter(msg => {
    if (!activeContactDetails) return false;
    return isMessageForContact(msg, activeContactDetails.id, activeContactDetails.type);
  });

  const displayedMessages = chatSearchQuery.trim() === "" 
    ? roleMessages 
    : roleMessages.filter(msg => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));

  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'owner') return <span className="shrink-0 text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Owner</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>;
    if (roleId === 'maintenance') return <span className="shrink-0 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Maintenance</span>;
    if (roleId === 'tenant') return <span className="shrink-0 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tenant</span>;
    return null;
  };

  return (
    <div className="absolute inset-0 flex bg-white font-sans z-20 overflow-hidden">
      
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
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search by name or role..." 
              className="w-full bg-slate-100/70 border border-slate-200/50 text-[16px] md:text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#359b46]/20 focus:border-[#359b46]"
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400"><Clock className="animate-spin mb-2" /> Loading...</div>
          ) : filteredContacts.map((contact: any) => {
            const isActive = activeChat === contact.id;
            const lastMsg = getLastMessage(contact.id, contact.type);
            const displayTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const unreadCount = messages.filter(m => !m.is_read && m.sender_email !== managerProfile.email && isMessageForContact(m, contact.id, contact.type)).length;
            
            // 🌟 Online indicator will now work correctly!
            const isOnline = onlineUsers.includes(contact.id);
            const ContactIcon = contact.icon;
            
            const getSidebarMessagePrefix = () => {
              if (!lastMsg) return "No messages";
              if (lastMsg.sender_email === managerProfile.email) return "You: ";
              const senderName = customNames[contact.id] || contact.name;
              const firstName = senderName.split(' ')[0];
              return `${firstName}: `;
            };

            return (
              <div key={contact.id} onClick={() => { if (!isEditingNames) setActiveChat(contact.id); }} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer ${isActive && !isEditingNames ? 'bg-[#359b46]/5' : 'hover:bg-slate-50'}`}>
                <div className="relative shrink-0">
                  <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-sm border border-slate-200 ${isActive && !isEditingNames ? 'bg-gradient-to-br from-[#359b46] to-[#277534] text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <ContactIcon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {isEditingNames ? (
                      <input type="text" value={customNames[contact.id] || contact.name} onChange={(e) => setCustomNames(prev => ({ ...prev, [contact.id]: e.target.value }))} className="text-[16px] font-bold text-[#359b46] border-b border-[#359b46]/30 bg-transparent outline-none w-full" onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <>
                        <h3 className={`text-[15px] truncate ${unreadCount > 0 ? 'font-bold text-[#0a1e3f]' : isActive ? 'font-semibold text-[#0a1e3f]' : 'font-medium text-slate-800'}`}>{customNames[contact.id] || contact.name}</h3>
                        {renderRoleBadge(contact.type)}
                      </>
                    )}
                  </div>
                  <p className={`text-[13px] truncate ${unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                    {lastMsg ? (
                      <span>
                        <span className={unreadCount > 0 ? "text-[#0a1e3f]" : "text-slate-600 font-medium"}>
                          {getSidebarMessagePrefix()}
                        </span>
                        {lastMsg.content}
                      </span>
                    ) : contact.unit}
                  </p>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1.5">
                  <span className={`text-[11px] ${unreadCount > 0 ? 'font-bold text-[#359b46]' : 'text-slate-400'}`}>{displayTime}</span>
                  {unreadCount > 0 && !isEditingNames && <span className="bg-red-500 text-white text-[10px] font-black h-5 px-1.5 rounded-full flex items-center shadow-sm">{unreadCount}</span>}
                </div>
              </div>
            );
          })}
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
                  {isActiveContactOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-[#0a1e3f] text-[15px] md:text-[17px] truncate">{currentChatName}</h2>
                    {renderRoleBadge(activeContactDetails?.type)}
                  </div>
                  <p className="text-[12px] truncate">
                    {isActiveContactOnline ? <span className="text-green-600 font-medium">Active now</span> : <span className="text-slate-400">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 mx-1">•</span>
                    <span className="hidden sm:inline text-slate-500">{activeContactDetails?.unit}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2.5 rounded-full ${isSearchActive ? 'bg-[#359b46] text-white' : 'text-[#359b46] hover:bg-emerald-50'}`}><Search size={20} /></button>
            </div>

            {isSearchActive && (
              <div className="shrink-0 bg-white border-b border-slate-100 p-2.5 px-4 flex items-center gap-2 z-10 shadow-sm">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder="Search chat..." className="w-full bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-[16px] md:text-sm focus:outline-none" />
                </div>
                <button onClick={() => { setIsSearchActive(false); setChatSearchQuery(""); }} className="text-slate-500 text-sm font-bold p-2">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white space-y-3 custom-scrollbar">
              {displayedMessages.map((msg: any, idx: number) => {
                const isMe = msg.sender_email === managerProfile.email;
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
                        isPending ? (
                          <Clock size={12} className="text-slate-300" />
                        ) : msg.is_read ? (
                          <CheckCheck size={14} className="text-blue-500" />
                        ) : (
                          <CheckCheck size={14} className="text-slate-300" />
                        )
                      )}
                    </div>
                  </div>
                );
              })}
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
                    placeholder="Aa"
                    className="w-full bg-transparent border-none outline-none text-[16px] md:text-[15px] text-slate-900"
                    disabled={isSending || isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
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