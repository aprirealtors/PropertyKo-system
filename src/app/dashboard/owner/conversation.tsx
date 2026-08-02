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
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const onlineUsers = usePresence();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
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
        
        // ✨ FIX: Basahin muna ang LocalStorage at i-merge sa fetchedNames para priority siya
        const storedNamesStr = localStorage.getItem(`custom_chat_names_${userData.email}`);
        let localOverrides = {};
        if (storedNamesStr) {
          try {
            localOverrides = JSON.parse(storedNamesStr);
          } catch (e) {}
        }
        setCustomNames({ ...fetchedNames, ...localOverrides });

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

      // Optimistic local update to ensure immediate UI feedback
      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));

      try {
        // Update DB so that the parent component's real-time listener catches it and updates the global unread badge
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
    if (!newMessage.trim() || !userData || !activeChat || isSending) return;
    
    if (activeChat === 'tenant' && !tenantEmail) {
      alert("No tenant is currently assigned to your properties.");
      return;
    }

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); 

    // ✨ FIX: Agad ibalik ang focus sa input box habang pinoproseso ang request
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

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
        setMessages(prev => {
          // Fix for the race condition where Realtime INSERT fires before this resolves
          const alreadyHasDbMsg = prev.some(m => m.id === data.id);
          if (alreadyHasDbMsg) {
            return prev.filter(m => m.id !== tempId);
          }
          return prev.map(m => m.id === tempId ? data : m);
        });
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(textToSend); 
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(textToSend);
    } finally {
      setIsSending(false);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
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
    if (roleId === 'tenant') return <span className="shrink-0 text-[9px] text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tenant</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px] text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>;
    return null;
  };

  // SIDEBAR FILTER LOGIC
  const filteredRoles = sortedRoles.filter(role => {
    const displayName = customNames[role.id] || role.label;
    const searchLower = sidebarSearchQuery.toLowerCase();
    
    // ✨ FIX: Hahanapin niya ngayon sa Custom Name, sa Default Label, at sa Role ID
    return (
      displayName.toLowerCase().includes(searchLower) || 
      role.label.toLowerCase().includes(searchLower) ||
      role.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="absolute inset-0 flex bg-[#f8fafc] font-sans z-20 overflow-hidden pb-[70px] md:pb-0">
      
      {/* SIDEBAR */}
      <div className={`w-full md:w-[360px] flex flex-col border-r border-slate-200 bg-white ${activeChat ? 'hidden md:flex' : 'flex'} transition-all`}>
        
        {/* SIDEBAR HEADER */}
        <div className="shrink-0 pt-5 sm:pt-6 pb-3 sm:pb-4 px-4 sm:px-5 border-b border-slate-100 bg-white">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight">Chats</h1>
            <button 
              onClick={() => setIsEditingNames(!isEditingNames)}
              className={`p-2 sm:p-2.5 rounded-xl transition-all border shadow-sm active:scale-95 duration-200 ${isEditingNames ? 'bg-emerald-50 border-emerald-200 text-[#359b46]' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            >
              {isEditingNames ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /> : <Edit size={14} className="sm:w-4 sm:h-4" />}
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 sm:top-3.5 text-slate-400 sm:w-[18px] sm:h-[18px]" />
            <input 
              type="text" 
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              placeholder="Search by name or role..." 
              className="w-full bg-slate-50 border border-slate-200/80 text-[15px] md:text-sm rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] transition-all font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 bg-white custom-scrollbar">
          {isContactsLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider"><Clock className="animate-spin mb-2 text-[#359b46]" size={18} /> Loading...</div>
          ) : filteredRoles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-[10px] sm:text-xs font-semibold">
              No conversations found.
            </div>
          ) : (
            filteredRoles.map((role) => {
              const Icon = role.icon;
              const isActive = activeChat === role.id;
              const lastMsg = getLastMessage(role.id);
              const displayTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const unreadCount = messages.filter(m => !m.is_read && m.sender_email !== userData.email && isMessageForRole(m, role.id)).length;
              const isOnline = roleEmails[role.id] && onlineUsers.includes(roleEmails[role.id]);

              const getSidebarMessagePrefix = () => {
                if (!lastMsg) return "";
                if (lastMsg.sender_email === userData.email) return "You: ";
                const senderName = customNames[role.id] || role.label;
                const firstName = senderName.split(' ')[0];
                return `${firstName}: `;
              };

              return (
                <div 
                  key={role.id} 
                  onClick={() => { if (!isEditingNames) setActiveChat(role.id); }} 
                  className={`flex items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 relative group ${
                    isActive && !isEditingNames 
                      ? 'bg-emerald-50/70 border border-emerald-100/30 shadow-sm' 
                      : 'border border-transparent hover:bg-slate-50'
                  }`}
                >
                  {/* 1. AVATAR QUADRANT (Left) */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm border transition-all duration-300 ${
                      isActive && !isEditingNames 
                        ? 'bg-gradient-to-br from-[#359b46] to-[#277534] text-white border-transparent shadow-emerald-500/20 scale-105' 
                        : 'bg-slate-50 text-slate-500 border-slate-200/60 group-hover:scale-105'
                    }`}>
                      <Icon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm z-10"></div>}
                  </div>

                  {/* RIGHT SECTION: 2-Row Messenger Style */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    
                    {/* 2. TOP ROW (Name & Time) */}
                    <div className="flex justify-between items-center w-full mb-1 gap-2">
                      {/* Name - Naka flex-1 at min-w-0 para piliting mag-truncate kapag umabot sa dulo */}
                      <div className="flex-1 min-w-0">
                        {isEditingNames ? (
                          <input 
                            type="text" 
                            value={customNames[role.id] !== undefined ? customNames[role.id] : role.label} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomNames(prev => ({ ...prev, [role.id]: val }));
                              
                              // Save directly to LocalStorage
                              if (userData?.email) {
                                const storedStr = localStorage.getItem(`custom_chat_names_${userData.email}`);
                                const overrides = storedStr ? JSON.parse(storedStr) : {};
                                overrides[role.id] = val;
                                localStorage.setItem(`custom_chat_names_${userData.email}`, JSON.stringify(overrides));
                              }
                            }} 
                            className="text-[14px] sm:text-[16px] md:text-sm font-bold text-[#359b46] border-b-2 border-[#359b46] bg-transparent outline-none w-full py-0.5" 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        ) : (
                          <h3 
                            className={`text-[13px] sm:text-[14px] tracking-tight truncate ${
                              unreadCount > 0 ? 'font-black text-[#0a1e3f]' : isActive ? 'font-bold text-[#0a1e3f]' : 'font-semibold text-slate-700'
                            }`}
                            title={`${customNames[role.id] || role.label} - ${role.id.charAt(0).toUpperCase() + role.id.slice(1)}`}
                          >
                            {customNames[role.id] || role.label}
                            <span className="font-semibold text-[10px] text-slate-400 ml-1.5 uppercase tracking-wider">
                              {renderRoleBadge(role.id)}
                            </span>
                          </h3>
                        )}
                      </div>
                      {/* Time - Naka shrink-0 para kahit gaano kahaba ang pangalan, hindi siya masisiksik o mawawala */}
                      <span className={`text-[9px] sm:text-[10px] tracking-wide shrink-0 ${unreadCount > 0 ? 'font-bold text-[#359b46]' : 'font-medium text-slate-400'}`}>
                        {displayTime}
                      </span>
                    </div>

                    {/* 3. BOTTOM ROW (Message & Badge) */}
                    <div className="flex justify-between items-center w-full gap-2">
                      {/* Last Message - Naka truncate din */}
                      <p className={`text-[11px] sm:text-[12.5px] truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-400'}`}>
                        {lastMsg ? (
                          <span>
                            <span className={unreadCount > 0 ? "text-[#0a1e3f] mr-1" : "text-slate-500 mr-1"}>
                              {getSidebarMessagePrefix()}
                            </span>
                            {lastMsg.content}
                          </span>
                        ) : (
                          role.id === 'tenant' && !tenantEmail ? "No tenant assigned" : role.desc
                        )}
                      </p>
                      
                      {/* Unread Badge - Naka-lock din ang pwesto sa kanan */}
                      <div className="shrink-0 flex items-center justify-end min-w-[16px]">
                        {unreadCount > 0 && !isEditingNames && (
                          <span className="bg-red-500 text-white text-[9px] sm:text-[10px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-sm shadow-red-500/20 animate-in zoom-in-50">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-slate-50 relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-[2rem] flex items-center justify-center mb-3 sm:mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100">
              <MessageSquare size={28} className="text-slate-300 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-700 tracking-tight">No Conversation Selected</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium max-w-[200px] sm:max-w-[220px] mx-auto mt-1 leading-relaxed">Choose a caretaker or tenant contact from the sidebar list to view messages.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="shrink-0 h-[60px] sm:h-[70px] md:h-[75px] bg-white/90 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-3 sm:px-4 md:px-6 z-10 shadow-sm shadow-slate-100/40">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button onClick={() => setActiveChat('')} className="md:hidden p-1.5 sm:p-2 text-[#359b46] hover:bg-slate-50 rounded-xl transition-colors active:scale-95 shrink-0"><ChevronLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} /></button>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shadow-inner"><ActiveIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                  {isActiveRoleOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="font-black text-[#0a1e3f] text-[14px] sm:text-[15px] md:text-[16px] truncate tracking-tight">{currentChatName}</h2>
                    {renderRoleBadge(activeRoleDetails?.id)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] truncate flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    {isActiveRoleOnline ? <span className="text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>Active now</span> : <span className="text-slate-400 font-semibold">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 font-black">•</span>
                    <span className="hidden sm:inline text-slate-400 font-medium">{activeRoleDetails?.desc}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 border ${isSearchActive ? 'bg-[#359b46] border-transparent text-white shadow-md shadow-emerald-500/10' : 'text-[#359b46] border-slate-100 hover:bg-emerald-50 bg-white shadow-sm'}`}><Search size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /></button>
            </div>

            {isSearchActive && (
              <div className="shrink-0 bg-white border-b border-slate-200/60 p-2 sm:p-3 px-3 sm:px-5 flex items-center gap-2 sm:gap-3 z-10 shadow-sm animate-in slide-in-from-top duration-200">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 sm:left-3.5 top-2.5 sm:top-3 text-slate-400 sm:w-4 sm:h-4" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in conversation..." className="w-full bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[14px] sm:text-[16px] md:text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-slate-500/5 transition-all text-slate-700 font-medium" autoFocus />
                </div>
                <button onClick={() => { setIsSearchActive(false); setSearchQuery(""); }} className="text-slate-400 hover:text-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1.5 sm:py-2 transition-colors">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-50/50 space-y-3 sm:space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider gap-2"><Clock size={14} className="animate-spin text-[#359b46] sm:w-4 sm:h-4" /> Loading...</div>
              ) : activeChat === 'tenant' && !tenantEmail ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-slate-200/60 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center mb-2 sm:mb-3 shadow-sm text-slate-300"><User size={24} className="sm:w-7 sm:h-7" /></div>
                  <h3 className="text-sm sm:text-base font-black text-slate-700 tracking-tight">No Assigned Tenant</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">You currently do not have a registered tenant actively linked to your properties.</p>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-slate-200/60 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center mb-2 sm:mb-3 shadow-sm text-slate-300"><ActiveIcon size={24} className="sm:w-7 sm:h-7" /></div>
                  <h3 className="text-sm sm:text-base font-black text-slate-700 tracking-tight">{searchQuery ? "No messages found" : `Say hello to ${currentChatName}`}</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">{searchQuery ? `We couldn't find "${searchQuery}" in this conversation.` : "Start a conversation to request information or coordinate operations."}</p>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isMe = msg.sender_email === userData.email;
                  const isPending = msg.id.toString().startsWith('temp_');
                  return (
                    <div key={msg.id.toString().startsWith('temp_') ? msg.id : `${msg.id}-${idx}`} className={`w-full flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}>
                      <div 
                        className={`max-w-[85%] sm:max-w-[80%] md:max-w-[65%] px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14.5px] leading-relaxed break-words font-medium shadow-sm border ${
                          isMe 
                            ? 'bg-[#359b46] text-white border-emerald-600/10 rounded-[16px] sm:rounded-[20px] rounded-br-[4px]' 
                            : 'bg-white text-slate-800 border-slate-200/60 rounded-[16px] sm:rounded-[20px] rounded-bl-[4px]'
                        } ${isPending ? 'opacity-60' : 'opacity-100'}`}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {msg.content}
                      </div>
                      
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-1.5 px-1 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wide">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          isPending ? <Clock size={10} className="text-slate-300 sm:w-[11px] sm:h-[11px]" /> : 
                          msg.is_read ? <CheckCheck size={12} className="text-blue-500 sm:w-[13px] sm:h-[13px]" strokeWidth={2.5} /> : 
                          <CheckCheck size={12} className="text-slate-300 sm:w-[13px] sm:h-[13px]" strokeWidth={2.5} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* INPUT AREA */}
            <div className="shrink-0 p-3 bg-white border-t border-slate-200 z-10">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2 sm:gap-3 items-center">
                <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2.5 flex items-center min-h-[40px] sm:min-h-[44px] md:min-h-[46px] focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-500/5 focus-within:border-slate-300 transition-all shadow-inner">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={activeChat === 'tenant' && !tenantEmail ? "No tenant assigned..." : "Type a message..."}
                    className="w-full bg-transparent border-none outline-none text-[14px] sm:text-[15px] text-slate-800 font-medium placeholder:text-slate-400"
                    disabled={isSending || isLoading || (activeChat === 'tenant' && !tenantEmail)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending || (activeChat === 'tenant' && !tenantEmail)}
                  className={`h-[38px] w-[38px] sm:h-[42px] sm:w-[42px] rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border transition-all active:scale-95 shadow-sm duration-200 ${
                    newMessage.trim() 
                      ? 'bg-[#359b46] text-white border-transparent shadow-emerald-500/10 hover:bg-[#2e853c]' 
                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSending ? <Clock size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Send size={14} strokeWidth={2.5} className={`sm:w-4 sm:h-4 ${newMessage.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />}
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