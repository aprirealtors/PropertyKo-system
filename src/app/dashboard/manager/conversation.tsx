"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  User, 
  Clock, 
  Info,
  ChevronLeft,
  MessageSquare,
  Search,
  X,
  Shield,
  Wrench,
  Key,
  Edit,
  Check
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

export default function ConversationTab({ orgData, managerProfile }: { orgData: any, managerProfile: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string>(''); 
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  
  // Custom Naming State
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  // Search States
  const [contactSearch, setContactSearch] = useState(""); 
  const [isSearchActive, setIsSearchActive] = useState(false); 
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  
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
    if (!chatSearchQuery) {
      scrollToBottom();
    }
  }, [messages, activeChat, chatSearchQuery]);

  // PERFECTED MANAGER ROUTING LOGIC
  const isMessageForContact = (msg: any, contactId: string, contactType: string) => {
    const isSystem = contactType === 'admin' || contactType === 'maintenance';
    
    if (isSystem) {
      if (msg.tenant_email !== managerProfile.email) return false;
      
      if (contactType === 'admin') {
        // Includes messages sent TO admin, and messages sent FROM admin
        return msg.recipient_role === 'admin' || msg.sender_email === orgData.admin_email;
      } else if (contactType === 'maintenance') {
        // Includes messages sent TO maintenance, and messages sent FROM maintenance
        return msg.recipient_role === 'maintenance' || 
               (msg.sender_email !== orgData.admin_email && msg.sender_email !== managerProfile.email);
      }
      return false;
    } else {
      return msg.tenant_email === contactId && msg.recipient_role === 'manager';
    }
  };

  // Mark Messages as Read
  useEffect(() => {
    const markAsRead = async () => {
      const activeContact = contacts.find(c => c.id === activeChat);
      if (!activeContact || !orgData?.admin_email || messages.length === 0) return;
      
      const isSystem = activeContact.type === 'admin' || activeContact.type === 'maintenance';

      const hasUnread = messages.some(m => {
        if (m.is_read || m.sender_email === managerProfile.email) return false;
        return isMessageForContact(m, activeContact.id, activeContact.type);
      });

      if (!hasUnread) return;

      setMessages(prev => prev.map(m => {
        if (m.is_read || m.sender_email === managerProfile.email) return m;
        if (isMessageForContact(m, activeContact.id, activeContact.type)) {
          return { ...m, is_read: true };
        }
        return m;
      }));

      try {
        let query = supabase.from('messages').update({ is_read: true }).eq('admin_email', orgData.admin_email).eq('is_read', false);
        
        if (isSystem) {
          query = query.eq('tenant_email', managerProfile.email);
          if (activeContact.type === 'admin') {
            query = query.eq('sender_email', orgData.admin_email);
          } else {
             query = query.neq('sender_email', orgData.admin_email).neq('sender_email', managerProfile.email);
          }
        } else {
          query = query.eq('tenant_email', activeChat).eq('recipient_role', 'manager');
        }
        await query;
      } catch (err) {
        console.error("Could not update read status.");
      }
    };
    markAsRead();
  }, [activeChat, messages, orgData?.admin_email, managerProfile?.email, contacts]);

  // Real-time subscription
  useEffect(() => {
    if (!orgData?.admin_email || !managerProfile?.email) return;

    const channel = supabase
      .channel('manager-live-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `admin_email=eq.${orgData.admin_email}`
        },
        (payload) => {
          const msg = payload.new;
          if (msg.recipient_role === 'manager' || 
             (msg.tenant_email === managerProfile.email && ['admin', 'maintenance'].includes(msg.recipient_role))) {
            
            setMessages((current) => {
              const exists = current.some(m => m.id === msg.id);
              if (exists) return current;
              return [...current, msg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgData, managerProfile]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch messages intended for the manager
      const { data: tenantMsgs, error: tError } = await supabase
        .from('messages')
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .eq('recipient_role', 'manager');

      if (tError) console.error("Messages Fetch Error:", tError.message);

      // Fetch messages between Manager and Admin/Maintenance
      const { data: sysMsgs, error: sError } = await supabase
        .from('messages')
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .eq('tenant_email', managerProfile.email)
        .in('recipient_role', ['admin', 'maintenance']);

      if (sError) console.error("System Messages Error:", sError.message);

      const allMsgs = [...(tenantMsgs || []), ...(sysMsgs || [])]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      setMessages(allMsgs);

      // Fetch dynamically from team_members (Tenants, Owners, AND Maintenance staff)
      const { data: usersData, error: usersError } = await supabase
        .from('team_members')
        .select('name, email, role, access_level')
        .eq('admin_email', orgData.admin_email)
        .in('role', ['Tenant', 'Owner', 'Maintenance staff']); 
      
      if (usersError) console.error("Users Fetch Error:", usersError.message);

      const contactsMap = new Map();

      // Add Admin manually (System Support)
      contactsMap.set('admin', { id: 'admin', name: 'Admin', unit: 'System & Account Support', type: 'admin', icon: Shield });

      // Map dynamic users safely
      if (usersData) {
        usersData.forEach(user => {
          if (user.email && user.email.trim() !== '') { 
            let unitLabel = user.access_level ? user.access_level : 'No unit assigned';
            let icon = User;
            let type = user.role.toLowerCase();

            if (user.role === 'Owner') icon = Key;
            if (user.role === 'Maintenance staff') {
              icon = Wrench;
              unitLabel = 'Repairs & Operations';
              type = 'maintenance'; 
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
      contactsMap.forEach((val, key) => {
        initialNames[key] = val.name;
      });
      setCustomNames(prev => ({ ...initialNames, ...prev }));

    } catch (error: any) {
      console.error("Error in fetchData execution:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !orgData || !activeChat) return;

    const activeContact = contacts.find(c => c.id === activeChat);
    if (!activeContact) return;

    const isSystem = activeContact.type === 'admin' || activeContact.type === 'maintenance';

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); 

    // ✨ RLS FIX: explicitly extract the EXACT verified authenticated user email
    const { data: authData } = await supabase.auth.getUser();
    const authEmail = authData?.user?.email || managerProfile.email;

    const payload = {
      tenant_email: isSystem ? authEmail : activeChat,
      admin_email: orgData.admin_email,
      sender_email: authEmail, // Prevents Case-Sensitivity RLS Errors
      content: textToSend,
      is_from_tenant: isSystem, 
      recipient_role: isSystem ? activeContact.type : 'manager',
      is_read: false
    };

    const optimisticMessage = { ...payload, id: `temp_${Date.now()}`, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();

      if (error) {
        console.error("Insert error:", error.message);
        alert(`Failed to send message: ${error.message}`);
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        setNewMessage(textToSend); 
        return;
      }
      
      if (data) {
        setMessages(prev => prev.map(m => m.id === optimisticMessage.id ? data : m));
      }

    } catch (error) {
      console.error("Error sending message:", error);
      alert("An unexpected error occurred. Please try again.");
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
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

  const filteredContacts = contactSearch.trim() === "" 
    ? sortedContacts 
    : sortedContacts.filter(c => 
        (customNames[c.id] || c.name).toLowerCase().includes(contactSearch.toLowerCase()) || 
        c.unit.toLowerCase().includes(contactSearch.toLowerCase()) ||
        c.type.toLowerCase().includes(contactSearch.toLowerCase())
      );

  const activeContactDetails = contacts.find(c => c.id === activeChat);
  const ActiveIcon = activeContactDetails?.icon || User;
  const currentChatName = activeContactDetails ? (customNames[activeContactDetails.id] || activeContactDetails.name) : "User";

  const roleMessages = messages.filter(msg => {
    if (!activeContactDetails) return false;
    return isMessageForContact(msg, activeContactDetails.id, activeContactDetails.type);
  });

  const displayedMessages = chatSearchQuery.trim() === "" 
    ? roleMessages 
    : roleMessages.filter(msg => msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()));

  const renderRoleBadge = (type: string | undefined) => {
    if (type === 'owner') return <span className="shrink-0 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Owner</span>;
    if (type === 'maintenance') return <span className="shrink-0 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Maintenance</span>;
    if (type === 'admin') return <span className="shrink-0 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Admin</span>;
    if (type === 'tenant') return <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Tenant</span>;
    return null;
  };

  return (
    <div className="absolute inset-0 flex bg-white text-slate-800 font-sans z-20 overflow-hidden">
      
      <div className={`w-full md:w-[340px] flex flex-col border-r border-slate-100 bg-white ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        <div className="pt-5 pb-3 border-b border-slate-50 flex flex-col shrink-0">
          <div className="flex justify-between items-center px-5 mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Message Center</h1>
            <button 
              onClick={() => setIsEditingNames(!isEditingNames)}
              className={`p-2 rounded-full transition-colors ${isEditingNames ? 'bg-blue-100 text-[#0084ff]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
              title={isEditingNames ? "Save Names" : "Edit Nicknames"}
            >
              {isEditingNames ? <Check size={18} /> : <Edit size={18} />}
            </button>
          </div>
          <div className="px-4">
            <div className="bg-slate-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search clients or roles..." 
                className="bg-transparent border-none outline-none text-sm w-full text-slate-800 placeholder-slate-400"
              />
              {contactSearch && (
                <button onClick={() => setContactSearch("")} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2">
          {filteredContacts.length === 0 && !isLoading ? (
            <div className="text-center p-6 text-sm text-slate-400">
              No contacts found matching your search.
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isActive = activeChat === contact.id;
              const lastMsg = getLastMessage(contact.id, contact.type);
              const displayTime = lastMsg 
                ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : '';

              const unreadCount = messages.filter(m => {
                if (m.is_read || m.sender_email === managerProfile.email) return false;
                return isMessageForContact(m, contact.id, contact.type);
              }).length;

              const ContactIcon = contact.icon;

              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    if (!isEditingNames) setActiveChat(contact.id);
                  }}
                  className={`flex items-center gap-3 px-3 py-3 mx-2 rounded-xl transition-colors ${
                    isEditingNames ? 'cursor-text' : 'cursor-pointer'
                  } ${isActive && !isEditingNames ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-13 h-13 rounded-full flex items-center justify-center p-3 border ${isActive && !isEditingNames ? 'bg-emerald-50 border-emerald-100 text-[#359b46]' : 'bg-[#f1f0f0] border-slate-200 text-slate-500'}`}>
                      <ContactIcon size={24} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      
                      <div className="flex items-center gap-2 truncate pr-2">
                        {isEditingNames ? (
                          <input 
                            type="text"
                            value={customNames[contact.id] || contact.name}
                            onChange={(e) => setCustomNames(prev => ({ ...prev, [contact.id]: e.target.value }))}
                            className="text-[15px] font-semibold text-[#0084ff] border-b border-blue-200 bg-transparent outline-none w-[80%] pr-2 pb-0.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h3 className={`text-[15px] truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-900'}`}>
                            {customNames[contact.id] || contact.name}
                          </h3>
                        )}
                        {!isEditingNames && renderRoleBadge(contact.type)}
                      </div>

                      <span className={`text-xs whitespace-nowrap ${unreadCount > 0 ? 'text-[#359b46] font-bold' : 'text-slate-400'}`}>
                        {displayTime}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-[13px] truncate ${unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                        {lastMsg ? (
                          <span>
                            {lastMsg.sender_email === managerProfile.email ? "You: " : ""}{lastMsg.content}
                          </span>
                        ) : (
                          contact.unit
                        )}
                      </p>
                      {unreadCount > 0 && !isEditingNames && (
                        <span className="shrink-0 ml-2 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-white relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 opacity-60 bg-white">
            <MessageSquare size={48} className="mb-4 text-slate-300" />
            <p className="text-lg font-semibold text-slate-500">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="h-[72px] border-b border-slate-50 flex items-center justify-between px-4 shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveChat('')}
                  className="md:hidden p-1.5 -ml-2 text-[#359b46] hover:bg-emerald-50 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#359b46]">
                  <ActiveIcon size={20} />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 text-base md:text-lg leading-tight flex items-center gap-2">
                    {currentChatName}
                    {renderRoleBadge(activeContactDetails?.type)}
                  </h2>
                  <p className="text-[11px] text-slate-400 max-w-[200px] sm:max-w-[400px] truncate">
                    {activeContactDetails?.unit}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[#359b46]">
                <button 
                  onClick={() => setIsSearchActive(!isSearchActive)}
                  className={`p-2.5 rounded-full transition-colors ${isSearchActive ? 'bg-emerald-100' : 'hover:bg-emerald-50'}`}
                  title="Search Conversation"
                >
                  <Info size={22} />
                </button>
              </div>
            </div>

            {isSearchActive && (
              <div className="bg-slate-50 border-b border-slate-200 p-3 px-5 flex items-center gap-3 shrink-0 animate-in slide-in-from-top-2 duration-200 z-10">
                <Search size={18} className="text-slate-400" />
                <input 
                  type="text" 
                  autoFocus
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Search in conversation..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                />
                <button 
                  onClick={() => {
                    setIsSearchActive(false);
                    setChatSearchQuery("");
                  }} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white space-y-3">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-400 gap-2">
                  <Clock size={16} className="animate-spin" />
                  <span className="text-sm font-medium">Loading conversation...</span>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto opacity-70">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                    {chatSearchQuery ? <Search size={36} /> : <ActiveIcon size={36} />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {chatSearchQuery ? "No messages found" : `Say hello to ${currentChatName}`}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {chatSearchQuery 
                      ? `We couldn't find "${chatSearchQuery}" in this conversation.` 
                      : "Start the conversation below."}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isMe = msg.sender_email === managerProfile.email;
                  const showAvatar = !isMe && (idx === 0 || displayedMessages[idx - 1].sender_email === managerProfile.email);
                  
                  return (
                    <div key={msg.id || idx} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 shrink-0 ${!showAvatar && 'opacity-0'}`}>
                          <ActiveIcon size={16} className="text-slate-500" />
                        </div>
                      )}
                      
                      <div 
                        className={`group relative max-w-[75%] md:max-w-[65%] px-4 py-2.5 text-[15px] leading-relaxed ${
                          isMe 
                            ? 'bg-[#359b46] text-white rounded-2xl rounded-br-sm' 
                            : 'bg-[#f1f0f0] text-slate-900 rounded-2xl rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        
                        <div className={`absolute top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ${
                          isMe ? 'right-full mr-2' : 'left-full ml-2'
                        }`}>
                          {new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 md:p-4 bg-white border-t border-slate-100 shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2 items-end relative">
                <div className="flex-1 bg-[#f1f0f0] rounded-[20px] px-4 py-2.5 flex items-end min-h-[40px]">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Aa"
                    className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-900 placeholder-slate-500"
                    disabled={isSending || isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className="p-2.5 text-[#359b46] hover:bg-emerald-50 rounded-full transition-colors disabled:text-slate-300 disabled:bg-transparent"
                >
                  {isSending ? (
                    <Clock size={24} className="animate-spin" />
                  ) : (
                    <Send size={24} />
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

    </div>
  );
}