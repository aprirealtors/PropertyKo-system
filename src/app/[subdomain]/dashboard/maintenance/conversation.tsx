"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Clock, ChevronLeft, MessageSquare, Search, 
  X, Briefcase, Wrench, Edit, Check, Shield, CheckCheck 
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";
import { usePresence } from '@/components/GlobalPresence';

export default function ConversationTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string>(''); 
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearch, setContactSearch] = useState(""); 
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false); 

  const onlineUsers = usePresence();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profileEmail) {
      const storedNames = localStorage.getItem(`custom_chat_names_${profileEmail}`);
      if (storedNames) {
        try {
          setCustomNames(JSON.parse(storedNames));
        } catch (e) {
          console.error("Error parsing stored aliases", e);
        }
      }
    }
  }, [profileEmail]);

  useEffect(() => {
    if (profileEmail && Object.keys(customNames).length > 0) {
      localStorage.setItem(`custom_chat_names_${profileEmail}`, JSON.stringify(customNames));
    }
  }, [customNames, profileEmail]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    setIsSearchActive(false);
    setChatSearchQuery("");
  }, [activeChat]);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setProfileEmail(user.email);
        const adminParentEmail = user.user_metadata?.admin_parent || user.email;
        setAdminEmail(adminParentEmail);
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (adminEmail && profileEmail) {
      fetchData();
    }
  }, [adminEmail, profileEmail]);

  useEffect(() => {
    if (!chatSearchQuery) scrollToBottom();
  }, [messages, activeChat, chatSearchQuery]);

  const isMessageForContact = (msg: any, contactId: string, contactType: string) => {
    if (contactType === 'admin') {
      return (msg.sender_email === profileEmail && msg.recipient_role === 'admin') ||
             (msg.sender_email === adminEmail && msg.tenant_email === profileEmail && msg.recipient_role === 'maintenance');
    } else if (contactType === 'manager') {
      return (msg.sender_email === profileEmail && msg.recipient_role === 'manager' && msg.tenant_email === profileEmail) ||
             (msg.sender_email === contactId && msg.recipient_role === 'maintenance' && msg.tenant_email === profileEmail);
    } else if (contactType === 'maintenance') {
      return (msg.sender_email === profileEmail && msg.recipient_role === 'maintenance' && msg.tenant_email === contactId) ||
             (msg.sender_email === contactId && msg.recipient_role === 'maintenance' && msg.tenant_email === profileEmail);
    }
    return false;
  };

  // Messages Read Status
  useEffect(() => {
    const markAsRead = async () => {
      const activeContact = contacts.find((c: any) => c.id === activeChat);
      if (!activeContact || !adminEmail || !profileEmail || messages.length === 0) return;

      const unreadIds = messages
        .filter((m: any) => !m.is_read && m.sender_email !== profileEmail && isMessageForContact(m, activeContact.id, activeContact.type))
        .map((m: any) => m.id);

      if (unreadIds.length === 0) return;

      setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));

      try {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
      } catch (err) {
        console.error("Could not update read status:", err);
      }
    };
    markAsRead();
  }, [activeChat, messages, adminEmail, profileEmail, contacts]);

  // 🌟 REALTIME MESSAGES & UPDATES
  useEffect(() => {
    if (!adminEmail || !profileEmail) return;

    const channel = supabase
      .channel('maintenance-live-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${adminEmail}` },
        (payload) => {
          const msg = payload.new;
          if (msg.recipient_role === 'maintenance' || msg.sender_email === profileEmail) {
            setMessages((current) => {
              if (current.some((m: any) => m.id === msg.id)) return current;
              return [...current, msg];
            });
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `admin_email=eq.${adminEmail}` },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((current) => current.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [adminEmail, profileEmail]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('admin_email', adminEmail).or(`sender_email.eq.${profileEmail},recipient_role.eq.maintenance`).order('created_at', { ascending: true });
      if (data) setMessages(data);

      const { data: usersData } = await supabase.from('team_members').select('name, email, role, access_level').eq('admin_email', adminEmail).in('role', ['Property manager', 'Maintenance staff']); 

      const contactsMap = new Map();

      contactsMap.set('admin', { 
        id: adminEmail, 
        name: 'Admin', 
        unit: 'System & Account Support', 
        type: 'admin', 
        icon: Shield 
      });

      if (usersData) {
        usersData.forEach((user: any) => {
          if (user.email && user.email.trim() !== '' && user.email !== profileEmail) { 
            let unitLabel = user.access_level ? user.access_level : 'Management';
            let icon = Briefcase;
            let type = 'manager';

            if (user.role === 'Property manager') { 
              icon = Briefcase; 
              type = 'manager'; 
              unitLabel = 'Maintenance & Daily Operations';
            }

            if (user.role === 'Maintenance staff') {
              icon = Wrench;
              type = 'maintenance';
              unitLabel = 'Repairs & Operations';
            }

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

    } catch (error: any) {
      console.error("Error in fetchData:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !adminEmail || !profileEmail || !activeChat || isSending) return;

    const activeContact = contacts.find((c: any) => c.id === activeChat);
    if (!activeContact) return;

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); 

    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    const authEmail = profileEmail;

    const payload = {
      tenant_email: (activeContact.type === 'admin' || activeContact.type === 'manager') ? profileEmail : activeChat, 
      admin_email: adminEmail,
      sender_email: authEmail, 
      content: textToSend,
      is_from_tenant: false, 
      recipient_role: activeContact.type, 
      is_read: false
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (!error && data) {
        setMessages(prev => {
          const realtimeAlreadyAdded = prev.some(m => m.id === data.id);
          if (realtimeAlreadyAdded) {
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

  const getLastMessage = (contactId: string, type: string) => {
    const roleMsgs = messages.filter((m: any) => isMessageForContact(m, contactId, type));
    return roleMsgs.length > 0 ? roleMsgs[roleMsgs.length - 1] : null;
  };

  const sortedContacts = [...contacts].sort((a: any, b: any) => {
    const lastA = getLastMessage(a.id, a.type)?.created_at || '0';
    const lastB = getLastMessage(b.id, b.type)?.created_at || '0';
    return new Date(lastB).getTime() - new Date(lastA).getTime();
  });

  const filteredContacts = contactSearch.trim() === "" ? sortedContacts : sortedContacts.filter((c: any) => 
    (customNames[c.id] || c.name).toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.type.toLowerCase().includes(contactSearch.toLowerCase()) 
  );

  const activeContactDetails = contacts.find((c: any) => c.id === activeChat);
  const ActiveIcon = activeContactDetails?.icon || User;
  const currentChatName = activeContactDetails ? (customNames[activeContactDetails.id] || activeContactDetails.name) : "User";
  const isActiveContactOnline = activeContactDetails && onlineUsers.includes(activeContactDetails.id);

  const roleMessages = messages.filter((msg: any) => {
    if (!activeContactDetails) return false;
    return isMessageForContact(msg, activeContactDetails.id, activeContactDetails.type);
  });

  const displayedMessages = chatSearchQuery.trim() === "" 
    ? roleMessages 
    : roleMessages.filter((msg: any) => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));

  // 🌟 Unified Role Badges (Themified)
  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] text-[var(--color-secondary)] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/20">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px] text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-slate-100 border border-slate-200">Admin</span>;
    if (roleId === 'maintenance') return <span className="shrink-0 text-[9px] text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-amber-50 border border-amber-200/50">Maintenance</span>;
    return null;
  };

  return (
    <div className="absolute inset-0 flex bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] z-20 overflow-hidden pb-[80px] md:pb-0">

      {/* SIDEBAR */}
      <div className={`w-full md:w-[360px] flex flex-col border-r border-[var(--color-border)] bg-white ${activeChat ? 'hidden md:flex' : 'flex'} transition-all`}>

        {/* SIDEBAR HEADER */}
        <div className="shrink-0 pt-5 sm:pt-6 pb-3 sm:pb-4 px-4 sm:px-5 border-b border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight">Chats</h1>
            <button 
              onClick={() => setIsEditingNames(!isEditingNames)}
              className={`p-2 sm:p-2.5 rounded-[var(--radius-md)] transition-all border shadow-[var(--shadow-sm)] active:scale-95 duration-200 ${isEditingNames ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]' : 'bg-slate-50 border-[var(--color-border)] text-slate-500 hover:bg-slate-100'}`}
            >
              {isEditingNames ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /> : <Edit size={14} className="sm:w-4 sm:h-4" />}
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 sm:top-3.5 text-slate-400 sm:w-[18px] sm:h-[18px]" />
            <input 
              type="text" 
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search by name or role..." 
              className="w-full bg-slate-50 border border-[var(--color-border)] text-[15px] md:text-sm rounded-[var(--radius-md)] pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 bg-white custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider"><Clock className="animate-spin mb-2 text-[var(--color-primary)]" size={18} /> Loading...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-[10px] sm:text-xs font-semibold">
              No conversations found.
            </div>
          ) : (
            filteredContacts.map((contact: any) => {
              const isActive = activeChat === contact.id;
              const lastMsg = getLastMessage(contact.id, contact.type);
              const displayTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const unreadCount = messages.filter((m: any) => !m.is_read && m.sender_email !== profileEmail && isMessageForContact(m, contact.id, contact.type)).length;
              const isOnline = onlineUsers.includes(contact.id);
              const ContactIcon = contact.icon;

              const getSidebarMessagePrefix = () => {
                if (!lastMsg) return "No messages";
                if (lastMsg.sender_email === profileEmail) return "You: ";
                const senderName = customNames[contact.id] || contact.name;
                const firstName = senderName.split(' ')[0];
                return `${firstName}: `;
              };

              return (
                <div 
                  key={contact.id} 
                  onClick={() => { if (!isEditingNames) setActiveChat(contact.id); }} 
                  className={`flex items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 relative group ${
                    isActive && !isEditingNames 
                      ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 shadow-sm' 
                      : 'border border-transparent hover:bg-slate-50'
                  }`}
                >
                  {/* 1. AVATAR QUADRANT (Left) */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-md)] flex items-center justify-center shadow-sm border transition-all duration-300 ${
                      isActive && !isEditingNames 
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-transparent shadow-[var(--shadow-md)] scale-105' 
                        : 'bg-slate-50 text-slate-500 border-[var(--color-border)] group-hover:scale-105'
                    }`}>
                      <ContactIcon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm z-10"></div>}
                  </div>

                  {/* RIGHT SECTION: 2-Row Messenger Style */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">

                    {/* 2. TOP ROW (Name & Time) */}
                    <div className="flex justify-between items-center w-full mb-1 gap-2">
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        {isEditingNames ? (
                          <input 
                            type="text" 
                            value={customNames[contact.id] !== undefined ? customNames[contact.id] : contact.name}
                            onChange={(e) => setCustomNames(prev => ({ ...prev, [contact.id]: e.target.value }))} 
                            className="text-[14px] sm:text-[16px] md:text-sm font-bold text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-transparent outline-none w-full py-0.5" 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        ) : (
                          <h3 
                            className={`text-[13px] sm:text-[14px] tracking-tight truncate ${
                              unreadCount > 0 ? 'font-black text-[var(--color-secondary)]' : isActive ? 'font-bold text-[var(--color-secondary)]' : 'font-normal text-[var(--color-text)]'
                            }`}
                            title={`${customNames[contact.id] || contact.name} - ${contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}`}
                          >
                            {customNames[contact.id] || contact.name}
                            <span className="font-semibold text-[10px] text-slate-400 ml-1.5 uppercase tracking-wider">
                              {renderRoleBadge(contact.type)}
                            </span>
                          </h3>
                        )}
                      </div>
                      {/* Time */}
                      <span className={`text-[9px] sm:text-[10px] tracking-wide shrink-0 ${unreadCount > 0 ? 'font-bold text-[var(--color-primary)]' : 'font-medium text-slate-400'}`}>
                        {displayTime}
                      </span>
                    </div>

                    {/* 3. BOTTOM ROW (Message & Badge) */}
                    <div className="flex justify-between items-center w-full gap-2">
                      {/* Last Message */}
                      <p className={`text-[11px] sm:text-[12.5px] truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-400'}`}>
                        {lastMsg ? (
                          <span>
                            <span className={unreadCount > 0 ? "text-[var(--color-text)] mr-1" : "text-slate-500 mr-1"}>
                              {getSidebarMessagePrefix()}
                            </span>
                            {lastMsg.content}
                          </span>
                        ) : contact.unit}
                      </p>
                      
                      {/* Unread Badge */}
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[var(--color-bg)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-[var(--radius-lg)] flex items-center justify-center mb-3 sm:mb-4 shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
              <MessageSquare size={28} className="text-slate-300 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">No Conversation Selected</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium max-w-[200px] sm:max-w-[220px] mx-auto mt-1 leading-relaxed">Choose a client, tenant, or admin manager from the list to view active operational logs.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="shrink-0 h-[60px] sm:h-[70px] md:h-[75px] bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-4 md:px-6 z-10 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button onClick={() => setActiveChat('')} className="md:hidden p-1.5 sm:p-2 text-[var(--color-primary)] hover:bg-slate-50 rounded-[var(--radius-sm)] transition-colors active:scale-95 shrink-0"><ChevronLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} /></button>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-md)] bg-slate-50 border border-[var(--color-border)] flex items-center justify-center text-slate-500 shadow-inner"><ActiveIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                  {isActiveContactOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="font-black text-[var(--color-secondary)] text-[14px] sm:text-[15px] md:text-[16px] truncate tracking-tight">{currentChatName}</h2>
                    {renderRoleBadge(activeContactDetails?.type)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] truncate flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    {isActiveContactOnline ? <span className="text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>Active now</span> : <span className="text-slate-400 font-semibold">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 font-black">•</span>
                    <span className="hidden sm:inline text-slate-400 font-medium">{activeContactDetails?.unit}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2 sm:p-2.5 rounded-[var(--radius-md)] transition-all active:scale-95 border ${isSearchActive ? 'bg-[var(--color-primary)] border-transparent text-[var(--color-primary-text)] shadow-[var(--shadow-md)]' : 'text-[var(--color-primary)] border-[var(--color-border)] hover:bg-[var(--color-primary)]/5 bg-white shadow-[var(--shadow-sm)]'}`}><Search size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /></button>
            </div>

            {isSearchActive && (
              <div className="shrink-0 bg-white border-b border-[var(--color-border)] p-2 sm:p-3 px-3 sm:px-5 flex items-center gap-2 sm:gap-3 z-10 shadow-[var(--shadow-sm)] animate-in slide-in-from-top duration-200">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 sm:left-3.5 top-2.5 sm:top-3 text-slate-400 sm:w-4 sm:h-4" />
                  <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder="Search chat..." className="w-full bg-slate-50 border border-[var(--color-border)] rounded-[var(--radius-md)] pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[14px] sm:text-[16px] md:text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all text-slate-700 font-medium" autoFocus />
                </div>
                <button onClick={() => { setIsSearchActive(false); setChatSearchQuery(""); }} className="text-slate-400 hover:text-[var(--color-text)] text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1.5 sm:py-2 transition-colors">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-[var(--color-bg)]/50 space-y-3 sm:space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider gap-2">
                  <Clock size={14} className="animate-spin text-[var(--color-primary)] sm:w-4 sm:h-4" /> Loading...
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] flex items-center justify-center mb-2 sm:mb-3 shadow-[var(--shadow-sm)] text-slate-300">
                    <ActiveIcon size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-[var(--color-text)] tracking-tight">
                    {searchQuery ? "No messages found" : `Say hello to ${currentChatName}`}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">
                    {searchQuery ? `We couldn't find "${searchQuery}" in this conversation.` : "Start a conversation to request information or coordinate operations."}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg: any, idx: number) => {
                  const isMe = msg.sender_email === profileEmail;
                  const isPending = msg.id.toString().startsWith('temp_');
                  return (
                    <div key={msg.id.toString().startsWith('temp_') ? msg.id : `${msg.id}-${idx}`} className={`w-full flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}>
                      <div 
                        className={`max-w-[85%] sm:max-w-[80%] md:max-w-[65%] px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14.5px] leading-relaxed break-words font-medium shadow-sm border ${
                          isMe 
                            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)]/20 rounded-[16px] sm:rounded-[20px] rounded-br-[4px]' 
                            : 'bg-white text-[var(--color-text)] border-[var(--color-border)] rounded-[16px] sm:rounded-[20px] rounded-bl-[4px]'
                        } ${isPending ? 'opacity-60' : 'opacity-100'}`}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {msg.content}
                      </div>

                      {/* Time Stamp & Status Updates */}
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-1.5 px-1 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wide">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && (
                          isPending ? (
                            <Clock size={10} className="text-slate-300 sm:w-[11px] sm:h-[11px]" />
                          ) : msg.is_read ? (
                            <CheckCheck size={12} className="text-blue-500 sm:w-[13px] sm:h-[13px]" strokeWidth={2.5} />
                          ) : (
                            <CheckCheck size={12} className="text-slate-300 sm:w-[13px] sm:h-[13px]" strokeWidth={2.5} />
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* UPGRADED MESSENGER-TYPE INPUT AREA */}
            <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[var(--color-border)] z-10">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2 sm:gap-3 items-end">
                <div className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] px-3 sm:px-4 py-2 sm:py-3 flex items-center min-h-[44px] sm:min-h-[48px] focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--color-primary)]/10 focus-within:border-[var(--color-primary)]/40 transition-all shadow-[var(--shadow-inner)]">
                  <textarea
                    ref={inputRef as any}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim() && !isSending) {
                          handleSendMessage(e as any);
                          e.currentTarget.style.height = 'auto';
                        }
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full bg-transparent border-none outline-none text-[14px] sm:text-[15px] text-[var(--color-text)] font-medium placeholder:text-slate-400 resize-none overflow-y-auto custom-scrollbar"
                    style={{ minHeight: '24px', height: '24px', maxHeight: '120px' }} 
                    disabled={isSending || isLoading}
                    rows={1}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className={`h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 border transition-all active:scale-95 shadow-[var(--shadow-sm)] duration-200 mb-0.5 ${
                    newMessage.trim() 
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-transparent hover:opacity-90' 
                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSending ? (
                    <Clock size={16} className="animate-spin sm:w-[20px] sm:h-[20px]" />
                  ) : (
                    <Send size={16} strokeWidth={2.5} className={`sm:w-5 sm:h-5 ${newMessage.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
                  )}
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: var(--color-border); border-radius: 20px; }
        .pb-safe { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}