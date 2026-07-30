"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Clock, ChevronLeft, MessageSquare, Search, 
  X, Briefcase, Wrench, Key, Edit, Check, Shield, CheckCheck 
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";
import { usePresence } from '@/components/GlobalPresence';

export default function ConversationTab({ orgData, adminProfile }: { orgData: any, adminProfile: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string>(''); 
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [contactSearch, setContactSearch] = useState(""); 
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false); 
  
  const onlineUsers = usePresence();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // const inputRef = useRef<HTMLInputElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (orgData?.admin_email) {
      const storedNames = localStorage.getItem(`custom_chat_names_${orgData.admin_email}`);
      if (storedNames) {
        try {
          setCustomNames(JSON.parse(storedNames));
        } catch (e) {
          console.error("Error parsing stored aliases", e);
        }
      }
    }
  }, [orgData?.admin_email]);

  useEffect(() => {
    if (orgData?.admin_email && Object.keys(customNames).length > 0) {
      localStorage.setItem(`custom_chat_names_${orgData.admin_email}`, JSON.stringify(customNames));
    }
  }, [customNames, orgData?.admin_email]);

  // // ✨ Auto-focus input pagkabukas ng chat o pagkasend ng message
  // useEffect(() => {
  //   if (activeChat && !isLoading && !isSearchActive && !isSending) {
  //     setTimeout(() => {
  //       inputRef.current?.focus();
  //     }, 50); 
  //   }
  // }, [activeChat, isLoading, isSearchActive, isSending]);

  useEffect(() => {
    setIsSearchActive(false);
    setChatSearchQuery("");
  }, [activeChat]);

  useEffect(() => {
    if (orgData?.admin_email && adminProfile?.email) {
      fetchData();
    }
  }, [orgData, adminProfile]);

  useEffect(() => {
    if (!chatSearchQuery) scrollToBottom();
  }, [messages, activeChat, chatSearchQuery]);

  const isMessageForContact = (msg: any, contactId: string) => {
    return msg.tenant_email === contactId;
  };

  // Messages Read Status (Nagma-mark as read kapag binuksan ni Admin)
  useEffect(() => {
    const markAsRead = async () => {
      const activeContact = contacts.find(c => c.id === activeChat);
      if (!activeContact || !orgData?.admin_email || messages.length === 0) return;

      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_email !== adminProfile.email && isMessageForContact(m, activeContact.id) && m.recipient_role === 'admin')
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
  }, [activeChat, messages, orgData?.admin_email, adminProfile?.email, contacts]);

  // 🌟 REALTIME MESSAGES & UPDATES (Para sa Delivered & Read)
  useEffect(() => {
    if (!orgData?.admin_email || !adminProfile?.email) return;

    const channel = supabase
      .channel('admin-live-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${orgData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          if (msg.recipient_role === 'admin' || msg.sender_email === adminProfile.email) {
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
  }, [orgData, adminProfile]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: adminMsgs } = await supabase.from('messages').select('*').eq('admin_email', orgData.admin_email).eq('recipient_role', 'admin');
      const { data: sentMsgs } = await supabase.from('messages').select('*').eq('admin_email', orgData.admin_email).eq('sender_email', adminProfile.email);

      const allMsgsMap = new Map();
      [...(adminMsgs || []), ...(sentMsgs || [])].forEach(m => allMsgsMap.set(m.id, m));
      setMessages(Array.from(allMsgsMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

      const { data: usersData } = await supabase.from('team_members').select('name, email, role, access_level').eq('admin_email', orgData.admin_email).in('role', ['Tenant', 'Owner', 'Maintenance staff', 'Property manager']); 

      const contactsMap = new Map();

      if (usersData) {
        usersData.forEach(user => {
          if (user.email && user.email.trim() !== '') { 
            let icon = User;
            let type = user.role ? user.role.toLowerCase() : 'tenant';
            let unitLabel = user.access_level || 'No assignments';

            // 🎯 ADAPTED ADAPTATION FROM MANAGER SIDE: Premium custom tags and operational descriptions
            if (user.role === 'Owner') { 
              icon = Key; 
              type = 'owner'; 
            }
            if (user.role === 'Property manager') { 
              icon = Briefcase; 
              type = 'manager'; 
              unitLabel = 'Maintenance & Daily Operations';
            }
            if (user.role === 'Maintenance staff') { 
              icon = Wrench; 
              type = 'maintenance'; 
              unitLabel = 'Repairs & Operations'; // Matched with manager layout spec
            }
            if (user.role === 'Tenant') { 
              type = 'tenant'; 
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

    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !orgData || !activeChat || isSending) return;

    const activeContact = contacts.find(c => c.id === activeChat);
    if (!activeContact) return;

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage("");

    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

    const payload = {
      tenant_email: activeChat, 
      admin_email: orgData.admin_email,
      sender_email: adminProfile.email,
      content: textToSend,
      is_from_tenant: false, 
      recipient_role: activeContact.type === 'tenant' ? 'admin' : activeContact.type, 
      is_read: false
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (!error && data) {
        setMessages(prev => {
          // 💡 KONTRA-DUPLICATION FILTER:
          // Suriin kung ang realtime event subscriber ay naunang naglagay ng totoong message id
          const isAlreadyAddedByRealtime = prev.some(m => m.id === data.id);
          
          if (isAlreadyAddedByRealtime) {
            // Kung nauna ang realtime listener, i-filter / burahin na lang ang natitirang temp optimistic slot
            return prev.filter(m => m.id !== tempId);
          }
          
          // Kung hindi pa naisasak ng realtime, palitan ang tempId ng totoong data base single item response natin
          return prev.map(m => m.id === tempId ? data : m);
        });
      } else {
        // Fallback catch mechanism: ibalik ang textToSend sa user container input kapag sumablay
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

  const getLastMessage = (contactId: string) => {
    const roleMsgs = messages.filter(m => isMessageForContact(m, contactId));
    return roleMsgs.length > 0 ? roleMsgs[roleMsgs.length - 1] : null;
  };

  const sortedContacts = [...contacts].sort((a, b) => {
    const lastA = getLastMessage(a.id)?.created_at || '0';
    const lastB = getLastMessage(b.id)?.created_at || '0';
    return new Date(lastB).getTime() - new Date(lastA).getTime();
  });

  const filteredContacts = contactSearch.trim() === "" ? sortedContacts : sortedContacts.filter(c => 
    (customNames[c.id] || c.name).toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.type.toLowerCase().includes(contactSearch.toLowerCase()) 
  );

  const activeContactDetails = contacts.find(c => c.id === activeChat);
  const ActiveIcon = activeContactDetails?.icon || User;
  const currentChatName = activeContactDetails ? (customNames[activeContactDetails.id] || activeContactDetails.name) : "User";
  const isActiveContactOnline = activeContactDetails && onlineUsers.includes(activeContactDetails.id);

  const roleMessages = messages.filter(msg => {
    if (!activeContactDetails) return false;
    return isMessageForContact(msg, activeContactDetails.id);
  });

  const displayedMessages = chatSearchQuery.trim() === "" 
    ? roleMessages 
    : roleMessages.filter(msg => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));

  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'owner') return <span className="shrink-0 text-[9px] text-purple-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Owner</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] text-blue-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px]  text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>;
    if (roleId === 'maintenance') return <span className="shrink-0 text-[9px]  text-amber-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Maintenance</span>;
    if (roleId === 'tenant') return <span className="shrink-0 text-[9px]  text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Tenant</span>;
    return null;
  };

  return (
    // ✨ FIX: Walang pb-[80px] o pb-safe para sumagad ang sidebar at chat container sa pinakababa ng screen
    <div className="absolute inset-0 flex bg-[#f8fafc] font-sans z-20 overflow-hidden">
      
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
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search by name or role..." 
              className="w-full bg-slate-50 border border-slate-200/80 text-[15px] md:text-sm rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] transition-all font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 bg-white custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider"><Clock className="animate-spin mb-2 text-[#359b46]" size={18} /> Loading...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-[10px] sm:text-xs font-semibold">
              No conversations found.
            </div>
          ) : (
            filteredContacts.map((contact: any) => {
              const isActive = activeChat === contact.id;
              const lastMsg = getLastMessage(contact.id);
              const displayTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const unreadCount = messages.filter(m => !m.is_read && m.sender_email !== adminProfile.email && isMessageForContact(m, contact.id)).length;
              const isOnline = onlineUsers.includes(contact.id);
              const ContactIcon = contact.icon;
              
              const getSidebarMessagePrefix = () => {
                if (!lastMsg) return "No messages";
                if (lastMsg.sender_email === adminProfile.email) return "You:";
                const senderName = customNames[contact.id] || contact.name;
                const firstName = senderName.split(' ')[0];
                return `${firstName}:`;
              };

              return (
                <div 
                  key={contact.id} 
                  onClick={() => { if (!isEditingNames) setActiveChat(contact.id); }} 
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
                      <ContactIcon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
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
                            value={customNames[contact.id] !== undefined ? customNames[contact.id] : contact.name}
                            onChange={(e) => setCustomNames(prev => ({ ...prev, [contact.id]: e.target.value }))} 
                            className="text-[14px] sm:text-[16px] md:text-sm font-bold text-[#359b46] border-b-2 border-[#359b46] bg-transparent outline-none w-full py-0.5" 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        ) : (
                          <h3 
                            className={`text-[13px] sm:text-[14px] tracking-tight truncate ${
                              unreadCount > 0 ? 'font-black text-[#0a1e3f]' : isActive ? 'font-bold text-[#0a1e3f]' : 'font-semibold text-slate-700'
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
                        ) : contact.unit}
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
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium max-w-[200px] sm:max-w-[220px] mx-auto mt-1 leading-relaxed">Choose an active contact from the sidebar list to initialize platform correspondence.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="shrink-0 h-[60px] sm:h-[70px] md:h-[75px] bg-white/90 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-3 sm:px-4 md:px-6 z-10 shadow-sm shadow-slate-100/40">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button onClick={() => setActiveChat('')} className="md:hidden p-1.5 sm:p-2 text-[#359b46] hover:bg-slate-50 rounded-xl transition-colors active:scale-95 shrink-0"><ChevronLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} /></button>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shadow-inner"><ActiveIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                  {isActiveContactOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="font-black text-[#0a1e3f] text-[14px] sm:text-[15px] md:text-[16px] truncate tracking-tight">{currentChatName}</h2>
                    {renderRoleBadge(activeContactDetails?.type)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] truncate flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    {isActiveContactOnline ? <span className="text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>Active now</span> : <span className="text-slate-400 font-semibold">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 font-black">•</span>
                    <span className="hidden sm:inline text-slate-400 font-medium">{activeContactDetails?.unit}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-95 border ${isSearchActive ? 'bg-[#359b46] border-transparent text-white shadow-md shadow-emerald-500/10' : 'text-[#359b46] border-slate-100 hover:bg-emerald-50 bg-white shadow-sm'}`}><Search size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /></button>
            </div>

            {isSearchActive && (
              <div className="shrink-0 bg-white border-b border-slate-200/60 p-2 sm:p-3 px-3 sm:px-5 flex items-center gap-2 sm:gap-3 z-10 shadow-sm animate-in slide-in-from-top duration-200">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 sm:left-3.5 top-2.5 sm:top-3 text-slate-400 sm:w-4 sm:h-4" />
                  <input type="text" value={chatSearchQuery} onChange={(e) => setChatSearchQuery(e.target.value)} placeholder="Search in conversation..." className="w-full bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[14px] sm:text-[16px] md:text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-slate-500/5 transition-all text-slate-700 font-medium" autoFocus />
                </div>
                <button onClick={() => { setIsSearchActive(false); setChatSearchQuery(""); }} className="text-slate-400 hover:text-slate-600 text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1.5 sm:py-2 transition-colors">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-50/50 space-y-3 sm:space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider gap-2">
                  <Clock size={14} className="animate-spin text-[#359b46] sm:w-4 sm:h-4" /> Loading...
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-slate-200/60 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center mb-2 sm:mb-3 shadow-sm text-slate-300">
                    <ActiveIcon size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-700 tracking-tight">
                    {chatSearchQuery ? "No messages found" : `Say hello to ${currentChatName}`}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">
                    {chatSearchQuery ? `We couldn't find "${chatSearchQuery}" in this conversation.` : "Start a conversation to request information or coordinate operations."}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg: any, idx: number) => {
                  const isMe = msg.sender_email === adminProfile.email;
                  const isPending = msg.id.toString().startsWith('temp_');
                  return (
                    // ✨ FIX: Inayos ang unique rendering identification key para sa loops upang maiwasan ang visual duplication at sync bugs
                    <div 
                      // key={msg.id || `msg-${idx}-${msg.created_at}`} 
                      // key={`${msg.id}-${idx}-${isPending ? 'pending' : 'saved'}`}
                      key={msg.id.toString().startsWith('temp_') ? msg.id : `${msg.id}-${idx}`}
                      className={`w-full flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                    >
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

            {/* INPUT AREA */}
            {/* ✨ FIX: Tinanggal ang pb-safe at pb padding buffers para sumagad ang input box sa bottom ng layout frame */}
            <div className="shrink-0 p-3 bg-white border-t border-slate-200 z-10">
              <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-2 sm:gap-3 items-center">
                <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2.5 flex items-center min-h-[40px] sm:min-h-[44px] md:min-h-[46px] focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-500/5 focus-within:border-slate-300 transition-all shadow-inner">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-transparent border-none outline-none text-[14px] sm:text-[15px] text-slate-800 font-medium placeholder:text-slate-400"
                    disabled={isSending || isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className={`h-[38px] w-[38px] sm:h-[42px] sm:w-[42px] rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border transition-all active:scale-95 shadow-sm duration-200 ${
                    newMessage.trim() 
                      ? 'bg-[#359b46] text-white border-transparent shadow-emerald-500/10 hover:bg-[#2e853c]' 
                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSending ? <Clock size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" /> : <Send size={14} strokeWidth={2.5} className={`sm:w-4 sm:h-4 ${newMessage.trim() ? 'translate-x-0.5' : ''}`} />}
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
      `}} />
    </div>
  );
}