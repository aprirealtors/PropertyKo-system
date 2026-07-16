"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  User, 
  Clock, 
  Shield, 
  Briefcase, 
  Info,
  ChevronLeft,
  MessageSquare,
  Search,
  X,
  Edit,
  Check
} from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

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
  
  // Custom Naming State
  const [isEditingNames, setIsEditingNames] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({
    admin: 'Admin',
    manager: 'Property Manager',
    tenant: 'Tenant'
  });

  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [isContactsLoading, setIsContactsLoading] = useState(true);

  // Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch Actual Names from Database & Identify Tenant Email
  useEffect(() => {
    const fetchActualNames = async () => {
      setIsContactsLoading(true);
      if (!userData?.admin_email) {
        setIsContactsLoading(false);
        return;
      }

      const fetchedNames = {
        admin: 'Admin',
        manager: 'Property Manager',
        tenant: 'Tenant'
      };
      
      let foundTenantEmail = null;

      try {
        // 1. Fetch Admin Name
        const { data: adminData } = await supabase
          .from('team_members')
          .select('name')
          .eq('email', userData.admin_email)
          .single();

        if (adminData?.name) fetchedNames.admin = adminData.name;

        // 2. Fetch Property Manager Name
        const { data: managerData } = await supabase
          .from('team_members')
          .select('name')
          .eq('admin_email', userData.admin_email)
          .ilike('role', '%manager%')
          .limit(1)
          .maybeSingle();

        if (managerData?.name) fetchedNames.manager = managerData.name;

        // 3. Find Tenant Name based on owner's units
        if (units && units.length > 0) {
          const unitNames = units.map(u => `${u.property_name} - ${u.unit_number}`);
          const { data: tenantsData } = await supabase
            .from('team_members')
            .select('name, email, access_level')
            .eq('role', 'Tenant')
            .eq('admin_email', userData.admin_email);

          if (tenantsData) {
            const matchedTenant = tenantsData.find(t => 
              unitNames.some((un: string) => t.access_level?.includes(un))
            );
            if (matchedTenant) {
              foundTenantEmail = matchedTenant.email;
              fetchedNames.tenant = matchedTenant.name || 'Tenant';
            }
          }
        }

        setTenantEmail(foundTenantEmail);
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
    if (!searchQuery) {
      scrollToBottom();
    }
  }, [messages, activeChat, searchQuery]);

  // MESSAGE ROUTING LOGIC (UPDATED: Properly routes messages sent from Owner -> Tenant)
  const isMessageForRole = (msg: any, roleId: string) => {
    // If the owner sent the message
    if (msg.sender_email === userData.email) {
      if (roleId === 'tenant') {
        return msg.recipient_role === 'owner' && msg.tenant_email === tenantEmail;
      }
      return msg.recipient_role === roleId;
    } 
    // If someone else sent it TO the owner
    else {
      if (roleId === 'admin') return msg.sender_email === userData.admin_email;
      if (roleId === 'tenant') return msg.sender_email === tenantEmail;
      if (roleId === 'manager') {
        return msg.sender_email !== userData.admin_email && msg.sender_email !== tenantEmail;
      }
      return false;
    }
  };

  // Mark Messages as Read when chat is active (UPDATED: Uses DB IDs to ensure reliability)
  useEffect(() => {
    const markAsRead = async () => {
      if (!activeChat || !userData?.email || messages.length === 0) return;
      
      // Get the exact IDs of the unread messages in this specific chat
      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_email !== userData.email && isMessageForRole(m, activeChat))
        .map(m => m.id);

      if (unreadIds.length === 0) return;

      // Optimistic local update
      setMessages(prev => prev.map(m => 
        unreadIds.includes(m.id) ? { ...m, is_read: true } : m
      ));

      try {
        // Direct, bulletproof DB update by ID
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
          
        if (error) console.error("Supabase update error:", error);
      } catch (err) {
        console.error("Could not update read status:", err);
      }
    };
    markAsRead();
  }, [activeChat, messages, userData?.email, userData?.admin_email, tenantEmail]);

  // Real-time subscription (UPDATED: Corrected filtering logic)
  useEffect(() => {
    if (!userData?.email || !userData?.admin_email) return;

    const channel = supabase
      .channel('owner-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `admin_email=eq.${userData.admin_email}`
        },
        (payload) => {
          const msg = payload.new;
          if (
            msg.sender_email === userData.email || 
            msg.recipient_role === 'owner' || 
            msg.tenant_email === userData.email 
          ) {
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
  }, [userData]);

  // (UPDATED: Checks for owner as tenant_email in the .or block)
  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('admin_email', userData.admin_email)
        .or(`sender_email.eq.${userData.email},recipient_role.eq.owner,tenant_email.eq.${userData.email}`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Supabase error:", error.message || error);
        setMessages([]); 
        return;
      }
      
      if (data) setMessages(data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userData || !activeChat) return;
    
    // Safety check - if messaging tenant, ensure tenant email exists
    if (activeChat === 'tenant' && !tenantEmail) {
      alert("No tenant is currently assigned to your properties.");
      return;
    }

    const textToSend = newMessage.trim();
    setIsSending(true);
    setNewMessage(""); // Optimistically clear input

    const payload = {
      // If owner messages tenant, thread attaches to tenant_email. If messaging admin/manager, it attaches to owner's email.
      tenant_email: activeChat === 'tenant' ? tenantEmail : userData.email,
      admin_email: userData.admin_email || "",
      sender_email: userData.email,
      content: textToSend,
      is_from_tenant: activeChat !== 'tenant',
      
      // CRITICAL FIX: Ensure Tenant app routes this to the "Owner" tab
      recipient_role: activeChat === 'tenant' ? 'owner' : activeChat, 
      is_read: false 
    };

    // Optimistically add to state instantly
    const optimisticMessage = { ...payload, id: `temp_${Date.now()}`, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();

      if (error) {
        console.error("Insert error:", error.message || error);
        alert(`Failed to send message: ${error.message}`);
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
        setNewMessage(textToSend); // Restore text
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

  const displayedMessages = searchQuery.trim() === "" 
    ? roleMessages 
    : roleMessages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeRoleDetails = CHAT_ROLES.find(r => r.id === activeChat);
  const ActiveIcon = activeRoleDetails?.icon || User;
  const currentChatName = activeChat ? customNames[activeChat] : "";

  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'tenant') return <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Tenant</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Admin</span>;
    return null;
  };

  return (
    <div className="absolute top-0 left-0 right-0 bottom-[70px] md:bottom-0 flex bg-white text-slate-800 font-sans overflow-hidden z-20 w-full rounded-3xl md:rounded-none">
      
      {/* ================= LEFT SIDEBAR (INBOX) ================= */}
      <div className={`w-full md:w-[340px] flex flex-col border-r border-slate-100 bg-white ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="px-5 py-5 border-b border-slate-50 flex items-center justify-between shrink-0">
          <h1 className="text-2xl font-bold text-slate-900">Message Center</h1>
          <button 
            onClick={() => setIsEditingNames(!isEditingNames)}
            className={`p-2 rounded-full transition-colors ${isEditingNames ? 'bg-emerald-100 text-[#359b46]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            title={isEditingNames ? "Save Names" : "Edit Names"}
          >
            {isEditingNames ? <Check size={18} /> : <Edit size={18} />}
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2">
          {isContactsLoading ? (
            <div className="flex justify-center items-center h-24 text-slate-400 gap-2">
              <Clock size={16} className="animate-spin" />
              <span className="text-sm font-medium">Loading contacts...</span>
            </div>
          ) : (
            sortedRoles.map((role) => {
              const Icon = role.icon;
              const isActive = activeChat === role.id;
              const lastMsg = getLastMessage(role.id);
              const displayTime = lastMsg 
                ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : '';

              const unreadCount = messages.filter(
                m => !m.is_read && m.sender_email !== userData.email && isMessageForRole(m, role.id)
              ).length;

              return (
                <div
                  key={role.id}
                  onClick={() => {
                    if (!isEditingNames) setActiveChat(role.id);
                  }}
                  className={`flex items-center gap-3 px-3 py-3 mx-2 rounded-xl transition-colors ${
                    isEditingNames ? 'cursor-text' : 'cursor-pointer'
                  } ${isActive && !isEditingNames ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-13 h-13 rounded-full flex items-center justify-center p-3 border ${isActive && !isEditingNames ? 'bg-emerald-50 border-emerald-100' : 'bg-[#f1f0f0] border-slate-200'}`}>
                      <Icon size={24} className={isActive && !isEditingNames ? "text-[#359b46]" : "text-slate-500"} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-2 truncate pr-2">
                        {isEditingNames ? (
                          <input 
                            type="text"
                            value={customNames[role.id] || role.label}
                            onChange={(e) => setCustomNames(prev => ({ ...prev, [role.id]: e.target.value }))}
                            className="text-[15px] font-semibold text-[#359b46] border-b border-emerald-200 bg-transparent outline-none w-full pb-0.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h3 className={`text-[15px] truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-900'}`}>
                            {customNames[role.id] || role.label}
                          </h3>
                        )}
                        
                        {!isEditingNames && renderRoleBadge(role.id)}
                      </div>

                      <span className={`text-xs whitespace-nowrap ${unreadCount > 0 ? 'text-[#359b46] font-bold' : 'text-slate-400'}`}>
                        {displayTime}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <p className={`text-[13px] truncate ${unreadCount > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                        {lastMsg ? (
                          <span>
                            {lastMsg.sender_email === userData.email ? "You: " : ""}{lastMsg.content}
                          </span>
                        ) : (
                          role.id === 'tenant' && !tenantEmail ? "No tenant assigned" : role.desc
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

      {/* ================= RIGHT PANE (ACTIVE CHAT) ================= */}
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
                
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <ActiveIcon size={20} className="text-[#359b46]" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 text-base md:text-lg leading-tight flex items-center gap-2">
                    {currentChatName}
                    {renderRoleBadge(activeRoleDetails?.id)}
                  </h2>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in conversation..." 
                  className="flex-1 bg-transparent border-none outline-none text-sm text-slate-800 placeholder-slate-400"
                />
                <button 
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchQuery("");
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
              ) : activeChat === 'tenant' && !tenantEmail ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto opacity-70">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                    <User size={36} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No Assigned Tenant</h3>
                  <p className="text-sm text-slate-500">
                    You currently do not have a registered tenant actively linked to your properties.
                  </p>
                </div>
              ) : displayedMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto opacity-70">
                  <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
                    {searchQuery ? <Search size={36} /> : <ActiveIcon size={36} />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {searchQuery ? "No messages found" : `Say hello to ${currentChatName}`}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery 
                      ? `We couldn't find "${searchQuery}" in this conversation.` 
                      : "Start a conversation to request information or coordinate operations."}
                  </p>
                </div>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isMe = msg.sender_email === userData.email;
                  const showAvatar = !isMe && (idx === 0 || displayedMessages[idx - 1].sender_email === userData.email);
                  
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
                    disabled={isSending || isLoading || (activeChat === 'tenant' && !tenantEmail)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending || (activeChat === 'tenant' && !tenantEmail)}
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