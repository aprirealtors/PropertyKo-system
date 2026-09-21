"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, User, Clock, Shield, Briefcase, ChevronLeft, 
  MessageSquare, Search, X, Edit, Check, CheckCheck,
  Pin, PinOff, CornerUpLeft, Copy, ChevronDown
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
  // Save drafts per chat
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});

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
  
  // Pinned Message Accordion & Highlighting States
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Reply & Mobile Long-Press States
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [longPressedMsgId, setLongPressedMsgId] = useState<string | null>(null);

  // Real-time & Scroll states
  const [remoteTyping, setRemoteTyping] = useState<{ [key: string]: boolean }>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const onlineUsers = usePresence();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBottom(false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Show button if scrolled up more than 100px from the bottom
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToMessage = (msgId: string) => {
    // Automatically hide the pinned messages list when a pin is clicked
    setIsPinnedExpanded(false); 
    
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 3000); // Remove highlight after 3 seconds
    }
  };

  // Helper for dynamic message date/time display
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
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

  // FIX: Clear the text box and load drafts when switching chats
  useEffect(() => {
    setIsSearchActive(false);
    setSearchQuery("");
    setIsPinnedExpanded(false);
    setHighlightedMsgId(null);
    setReplyingTo(null);
    setShowScrollBottom(false);
    setNewMessage(messageDrafts[activeChat] || "");
    if (inputRef.current) {
      inputRef.current.style.height = '24px';
    }
  }, [activeChat]);

  useEffect(() => {
    if (userData?.email) fetchMessages();
  }, [userData]);

  // FIX: Decoupled scroll so highlighted pins stay in view without jumping to bottom
  useEffect(() => {
    if (!searchQuery && !highlightedMsgId) scrollToBottom();
  }, [messages.length, activeChat, searchQuery]);

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

    // Use shared room pattern for typing broadcasts
    const channel = supabase.channel(`chat-room-${userData.admin_email}`, {
      config: { broadcast: { ack: false, self: false } }
    });

    channelRef.current = channel;

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          if (msg.sender_email === userData.email || msg.recipient_role === 'owner' || msg.tenant_email === userData.email) {
            setMessages((current) => {
              if (current.some(m => m.id === msg.id)) return current;
              return [...current, msg];
            });
            // Auto-clear typing indicator when a message is received
            setRemoteTyping(prev => ({ ...prev, [msg.sender_email]: false }));
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const updatedMsg = payload.new;
          setMessages((current) => current.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { sender, recipient, isTyping } = payload.payload;
        if (recipient === userData.email || recipient === 'owner') {
          setRemoteTyping(prev => ({ ...prev, [sender]: isTyping }));
        }
      })
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

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    setMessageDrafts(prev => ({ ...prev, [activeChat]: val }));

    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

    // Handle typing indicator broadcast
    const activeRoleEmail = roleEmails[activeChat];
    if (!isTypingRef.current && channelRef.current && activeChat && activeRoleEmail) {
      isTypingRef.current = true;
      channelRef.current.send({
        type: 'broadcast', event: 'typing',
        payload: { sender: userData.email, recipient: activeRoleEmail, isTyping: true }
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (channelRef.current && activeChat && activeRoleEmail) {
        channelRef.current.send({
          type: 'broadcast', event: 'typing',
          payload: { sender: userData.email, recipient: activeRoleEmail, isTyping: false }
        });
      }
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userData || !activeChat || isSending) return;
    
    if (activeChat === 'tenant' && !tenantEmail) {
      alert("No tenant is currently assigned to your properties.");
      return;
    }

    let textToSend = newMessage.trim();

    // Append reply quote if replying to a message
    if (replyingTo) {
      const snippet = replyingTo.content.length > 60 ? replyingTo.content.substring(0, 60) + "..." : replyingTo.content;
      const roleLabel = CHAT_ROLES.find(r => r.id === activeChat)?.label || 'User';
      const senderName = replyingTo.sender_email === userData.email ? 'You' : (customNames[activeChat] || roleLabel);
      textToSend = `> Replying to ${senderName}:\n> "${snippet}"\n\n${textToSend}`;
    }

    setIsSending(true);
    setNewMessage(""); 
    setReplyingTo(null);
    setMessageDrafts(prev => ({ ...prev, [activeChat]: "" })); // Clear the draft when sent

    // Clear typing status immediately upon sending
    isTypingRef.current = false;
    const activeRoleEmail = roleEmails[activeChat];
    if (channelRef.current && activeRoleEmail) {
      channelRef.current.send({
        type: 'broadcast', event: 'typing',
        payload: { sender: userData.email, recipient: activeRoleEmail, isTyping: false }
      });
    }

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.style.height = '24px';
        inputRef.current.focus();
      }
      scrollToBottom();
    }, 10);

    const payload = {
      tenant_email: activeChat === 'tenant' ? tenantEmail : userData.email,
      admin_email: userData.admin_email || "",
      sender_email: userData.email,
      content: textToSend,
      is_from_tenant: activeChat !== 'tenant',
      recipient_role: activeChat === 'tenant' ? 'owner' : activeChat, 
      is_read: false,
      is_pinned: false
    };

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase.from('messages').insert([payload]).select().single();
      if (!error && data) {
        setMessages(prev => {
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
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const handleTogglePin = async (msgId: string, currentPinStatus: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: !currentPinStatus } : m));
    try {
      const { error } = await supabase
        .from('messages')
        .update({ is_pinned: !currentPinStatus })
        .eq('id', msgId);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to toggle pin status:", err);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: currentPinStatus } : m));
    }
  };

  const handleTouchStart = (msgId: string) => {
    longPressTimeoutRef.current = setTimeout(() => {
      setLongPressedMsgId(msgId);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
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
  const pinnedMessages = roleMessages.filter(msg => msg.is_pinned);
  
  const displayedMessages = searchQuery.trim() === "" ? roleMessages : roleMessages.filter(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const activeRoleDetails = CHAT_ROLES.find(r => r.id === activeChat);
  const ActiveIcon = activeRoleDetails?.icon || User;
  const currentChatName = activeChat ? customNames[activeChat] : "";
  
  const activeRoleEmail = activeChat ? roleEmails[activeChat] : null;
  const isActiveRoleOnline = activeRoleEmail ? onlineUsers.includes(activeRoleEmail) : false;
  const isRemoteUserTyping = activeRoleEmail ? remoteTyping[activeRoleEmail] : false;

  const renderRoleBadge = (roleId: string | undefined) => {
    if (roleId === 'tenant') return <span className="shrink-0 text-[9px] text-[var(--color-text)] px-1.5 py-0.5 rounded border border-[var(--color-text)]/20 uppercase font-bold tracking-wider bg-[var(--color-text)]/10">Tenant</span>;
    if (roleId === 'manager') return <span className="shrink-0 text-[9px] text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-bold tracking-wider bg-blue-100">Manager</span>;
    if (roleId === 'admin') return <span className="shrink-0 text-[9px] text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 uppercase font-bold tracking-wider bg-blue-100">Admin</span>;
    return null;
  };

  const renderMessageContent = (content: string) => {
    const replyMatch = content.match(/^> Replying to (.*?):\n> "(.*?)"\n\n([\s\S]*)$/);
    if (replyMatch) {
      const [_, sender, snippet, actualMessage] = replyMatch;
      return (
        <div className="flex flex-col gap-1.5 text-left w-full">
          <div className="bg-black/10 rounded border-l-[3px] border-current px-2.5 py-1.5 text-[11px] sm:text-[12px] opacity-80 shadow-sm leading-tight">
            <span className="font-extrabold">{sender}</span><br/>
            <span className="truncate block mt-0.5 line-clamp-1 italic text-[10px] sm:text-[11px]">{snippet}</span>
          </div>
          <span>{actualMessage}</span>
        </div>
      );
    }
    return <span>{content}</span>;
  };

  const filteredRoles = sortedRoles.filter(role => {
    const displayName = customNames[role.id] || role.label;
    const searchLower = sidebarSearchQuery.toLowerCase();
    
    return (
      displayName.toLowerCase().includes(searchLower) || 
      role.label.toLowerCase().includes(searchLower) ||
      role.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="absolute inset-0 flex bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden pb-[70px] md:pb-0">
      
      {/* Global Overlay for Mobile Long Press Dismissal */}
      {longPressedMsgId && (
        <div className="absolute inset-0 z-40 bg-transparent" onClick={() => setLongPressedMsgId(null)} />
      )}

      {/* SIDEBAR */}
      <div className={`w-full md:w-[360px] shrink-0 flex flex-col border-r border-[var(--color-border)] bg-white ${activeChat ? 'hidden md:flex' : 'flex'} transition-all`}>
        
        {/* SIDEBAR HEADER */}
        <div className="shrink-0 pt-5 sm:pt-6 pb-3 sm:pb-4 px-4 sm:px-5 border-b border-[var(--color-border)] bg-white">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">Chats</h1>
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
              value={sidebarSearchQuery}
              onChange={(e) => setSidebarSearchQuery(e.target.value)}
              placeholder="Search by name or role..." 
              className="w-full bg-slate-50 border border-[var(--color-border)] text-[15px] md:text-sm rounded-[var(--radius-md)] pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all font-medium text-[var(--color-text)] placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* SIDEBAR LIST */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1 bg-white custom-scrollbar">
          {isContactsLoading ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider"><Clock className="animate-spin mb-2 text-[var(--color-primary)]" size={18} /> Loading...</div>
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
              const isTyping = roleEmails[role.id] && remoteTyping[roleEmails[role.id]];

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
                  className={`flex items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 relative group ${
                    isActive && !isEditingNames 
                      ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 shadow-sm' 
                      : 'border border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-md)] flex items-center justify-center shadow-sm border transition-all duration-300 ${
                      isActive && !isEditingNames 
                        ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-transparent shadow-[var(--shadow-md)] scale-105' 
                        : 'bg-slate-50 text-slate-500 border-[var(--color-border)] group-hover:scale-105'
                    }`}>
                      <Icon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm z-10"></div>}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    
                    <div className="flex justify-between items-center w-full mb-1 gap-2">
                      <div className="flex-1 min-w-0">
                        {isEditingNames ? (
                          <input 
                            type="text" 
                            value={customNames[role.id] !== undefined ? customNames[role.id] : role.label} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomNames(prev => ({ ...prev, [role.id]: val }));
                              
                              if (userData?.email) {
                                const storedStr = localStorage.getItem(`custom_chat_names_${userData.email}`);
                                const overrides = storedStr ? JSON.parse(storedStr) : {};
                                overrides[role.id] = val;
                                localStorage.setItem(`custom_chat_names_${userData.email}`, JSON.stringify(overrides));
                              }
                            }} 
                            className="text-[14px] sm:text-[16px] md:text-sm font-bold text-[var(--color-primary)] border-b-2 border-[var(--color-primary)] bg-transparent outline-none w-full py-0.5" 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        ) : (
                          <h3 
                            className={`text-[13px] sm:text-[14px] tracking-tight truncate ${
                              unreadCount > 0 ? 'font-black text-[var(--color-secondary)]' : isActive ? 'font-bold text-[var(--color-secondary)]' : 'font-normal text-[var(--color-text)]'
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
                      <span className={`text-[9px] sm:text-[10px] tracking-wide shrink-0 ${unreadCount > 0 ? 'font-bold text-[var(--color-primary)]' : 'font-medium text-slate-400'}`}>
                        {displayTime}
                      </span>
                    </div>

                    <div className="flex justify-between items-center w-full gap-2">
                      <p className={`text-[11px] sm:text-[12.5px] truncate ${unreadCount > 0 ? 'font-bold text-slate-900' : 'font-small text-slate-400'}`}>
                        {isTyping ? (
                          <span className="text-[var(--color-primary)] font-bold animate-pulse">Typing...</span>
                        ) : lastMsg ? (
                          <span>
                            <span className={unreadCount > 0 ? "text-[var(--color-text)] mr-1" : "text-slate-500 mr-1"}>
                              {getSidebarMessagePrefix()}
                            </span>
                            {lastMsg.content}
                          </span>
                        ) : (
                          role.id === 'tenant' && !tenantEmail ? "No tenant assigned" : role.desc
                        )}
                      </p>
                      
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
      <div className={`flex-1 min-w-0 flex flex-col bg-slate-50 relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[var(--color-bg)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-[var(--radius-lg)] flex items-center justify-center mb-3 sm:mb-4 shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
              <MessageSquare size={28} className="text-slate-300 sm:w-8 sm:h-8" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">No Conversation Selected</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 font-medium max-w-[200px] sm:max-w-[220px] mx-auto mt-1 leading-relaxed">Choose an active contact from the sidebar list to initialize platform correspondence.</p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="shrink-0 h-[60px] sm:h-[70px] md:h-[75px] bg-[var(--color-bg)]/90 backdrop-blur-md border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-4 md:px-6 z-10 shadow-[var(--shadow-sm)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <button onClick={() => setActiveChat('')} className="md:hidden p-1.5 sm:p-2 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-[var(--radius-sm)] transition-colors active:scale-95 shrink-0"><ChevronLeft size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} /></button>
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-md)] bg-slate-50 border border-[var(--color-border)] flex items-center justify-center text-slate-500 shadow-inner"><ActiveIcon size={16} className="sm:w-[18px] sm:h-[18px]" /></div>
                  {isActiveRoleOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm"></div>}
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h2 className="font-black text-[var(--color-secondary)] text-[14px] sm:text-[15px] md:text-[16px] truncate tracking-tight">{currentChatName}</h2>
                    {renderRoleBadge(activeRoleDetails?.id)}
                  </div>
                  <p className="text-[10px] sm:text-[11px] truncate flex items-center gap-1 sm:gap-1.5 mt-0.5">
                    {isActiveRoleOnline ? <span className="text-green-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>Active now</span> : <span className="text-slate-400 font-semibold">Offline</span>}
                    <span className="hidden sm:inline text-slate-300 font-black">•</span>
                    <span className="hidden sm:inline text-slate-400 font-medium">{activeRoleDetails?.desc}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSearchActive(!isSearchActive)} className={`p-2 sm:p-2.5 rounded-[var(--radius-md)] transition-all active:scale-95 border ${isSearchActive ? 'bg-[var(--color-primary)] border-transparent text-[var(--color-primary-text)] shadow-[var(--shadow-md)]' : 'text-[var(--color-primary)] border-[var(--color-border)] hover:bg-[var(--color-primary)]/5 bg-white shadow-[var(--shadow-sm)]'}`}><Search size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /></button>
            </div>

            {/* PINNED MESSAGES ACCORDION */}
            {pinnedMessages.length > 0 && !searchQuery && (
              <div className="shrink-0 bg-amber-50 border-b border-amber-200/50 flex flex-col shadow-sm z-10 transition-all w-full overflow-hidden">
                {/* Collapsed View / Header */}
                <div 
                  className="px-3 sm:px-4 md:px-6 py-2 flex items-center gap-2 cursor-pointer hover:bg-amber-100/50 transition-colors w-full min-w-0"
                  onClick={() => {
                    if (pinnedMessages.length === 1) {
                      scrollToMessage(pinnedMessages[0].id);
                    } else {
                      setIsPinnedExpanded(!isPinnedExpanded);
                    }
                  }}
                >
                  <Pin size={14} className="text-amber-600 shrink-0 mt-0.5" fill="currentColor" />
                  
                  <div className="flex-1 min-w-0 flex justify-between items-center gap-3">
                    {pinnedMessages.length === 1 ? (
                      <p className="text-[11px] sm:text-xs text-amber-900 font-medium truncate flex-1 min-w-0">
                        <span className="font-bold mr-1">
                          {pinnedMessages[0].sender_email === userData.email ? 'You:' : currentChatName + ':'}
                        </span>
                        {pinnedMessages[0].content}
                      </p>
                    ) : (
                      <p className="text-[11px] sm:text-xs text-amber-900 font-medium truncate flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-bold shrink-0">{pinnedMessages.length} Pinned Messages</span>
                        <span className="hidden sm:inline text-amber-700/70 truncate min-w-0">- Latest: {pinnedMessages[pinnedMessages.length - 1].content}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                      {pinnedMessages.length === 1 ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(pinnedMessages[0].id, true); }}
                          className="text-amber-700/60 hover:text-amber-900 hover:bg-amber-200/50 p-1 rounded transition-colors"
                          title="Unpin message"
                        >
                          <X size={12} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-[var(--radius-sm)] shadow-sm shrink-0">
                          {isPinnedExpanded ? 'Hide All' : 'Show All'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded View for Multiple Pins */}
                {isPinnedExpanded && pinnedMessages.length > 1 && (
                  <div className="flex flex-col border-t border-amber-200/50 bg-amber-50/50 w-full min-w-0">
                    {pinnedMessages.map((pMsg) => (
                      <div 
                        key={pMsg.id} 
                        className="flex justify-between items-center gap-3 px-3 sm:px-4 md:px-6 py-2.5 hover:bg-amber-100/50 cursor-pointer transition-colors border-b border-amber-100 last:border-0 w-full min-w-0"
                        onClick={() => scrollToMessage(pMsg.id)}
                      >
                        <p className="text-[11px] sm:text-xs text-amber-900 font-medium truncate flex-1 ml-6 min-w-0">
                          <span className="font-bold mr-1">{pMsg.sender_email === userData.email ? 'You:' : currentChatName + ':'}</span>
                          {pMsg.content}
                        </p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleTogglePin(pMsg.id, true); }}
                          className="text-amber-700/60 hover:text-amber-900 hover:bg-amber-200/50 p-1 rounded transition-colors shrink-0"
                          title="Unpin message"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSearchActive && (
              <div className="shrink-0 bg-[var(--color-bg)] border-b border-[var(--color-border)] p-2 sm:p-3 px-3 sm:px-5 flex items-center gap-2 sm:gap-3 z-10 shadow-[var(--shadow-sm)] animate-in slide-in-from-top duration-200">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 sm:left-3.5 top-2.5 sm:top-3 text-slate-400 sm:w-4 sm:h-4" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in conversation..." className="w-full bg-slate-50 border border-[var(--color-border)] rounded-[var(--radius-md)] pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-[14px] sm:text-[16px] md:text-sm focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 transition-all text-[var(--color-text)] font-medium" autoFocus />
                </div>
                <button onClick={() => { setIsSearchActive(false); setSearchQuery(""); }} className="text-slate-400 hover:text-[var(--color-text)] text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 py-1.5 sm:py-2 transition-colors">Cancel</button>
              </div>
            )}

            {/* MESSAGES SCROLL AREA WITH FLOATING BUTTON*/}
            <div className="flex-1 min-h-0 relative flex flex-col">
              <div 
                className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 bg-[var(--color-bg)]/50 space-y-3 sm:space-y-4 custom-scrollbar"
                onScroll={handleScroll}
                ref={scrollContainerRef}
              >
                {isLoading ? (
                  <div className="flex justify-center items-center h-full text-slate-400 font-bold text-[10px] sm:text-xs uppercase tracking-wider gap-2"><Clock size={14} className="animate-spin text-[var(--color-primary)] sm:w-4 sm:h-4" /> Loading...</div>
                ) : activeChat === 'tenant' && !tenantEmail ? (
                  <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] flex items-center justify-center mb-2 sm:mb-3 shadow-[var(--shadow-sm)] text-slate-300"><User size={24} className="sm:w-7 sm:h-7" /></div>
                    <h3 className="text-sm sm:text-base font-black text-[var(--color-text)] tracking-tight">No Assigned Tenant</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">You currently do not have a registered tenant actively linked to your properties.</p>
                  </div>
                ) : displayedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto p-4 sm:p-6">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] flex items-center justify-center mb-2 sm:mb-3 shadow-[var(--shadow-sm)] text-slate-300"><ActiveIcon size={24} className="sm:w-7 sm:h-7" /></div>
                    <h3 className="text-sm sm:text-base font-black text-[var(--color-text)] tracking-tight">{searchQuery ? "No messages found" : `Say hello to ${currentChatName}`}</h3>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-medium leading-relaxed mt-1">{searchQuery ? `We couldn't find "${searchQuery}" in this conversation.` : "Start a conversation to request information or coordinate operations."}</p>
                  </div>
                ) : (
                  displayedMessages.map((msg, idx) => {
                    const isMe = msg.sender_email === userData.email;
                    const isPending = msg.id.toString().startsWith('temp_');
                    return (
                      <div key={msg.id.toString().startsWith('temp_') ? msg.id : `${msg.id}-${idx}`} id={`msg-${msg.id}`} className={`w-full flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200 group transition-transform py-1 ${highlightedMsgId === msg.id ? 'scale-[1.02]' : ''}`}>
                        <div className={`flex items-center gap-2 max-w-[85%] sm:max-w-[80%] md:max-w-[65%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          
                          {/* Bubble wrapper for touch events */}
                          <div 
                            className="relative"
                            onTouchStart={() => !isPending && handleTouchStart(msg.id)}
                            onTouchEnd={handleTouchEndOrMove}
                            onTouchMove={handleTouchEndOrMove}
                          >
                            <div 
                              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-[14.5px] leading-relaxed whitespace-pre-wrap break-words font-medium shadow-[var(--shadow-sm)] border relative transition-all duration-500 flex flex-col ${
                                highlightedMsgId === msg.id ? 'ring-4 ring-[var(--color-primary)]/40 shadow-lg z-10' : ''
                              } ${
                                isMe 
                                  ? 'bg-[#066cf1] text-white border-[var(--color-primary)]/20 rounded-[16px] sm:rounded-[20px] rounded-br-[4px]' 
                                  : 'bg-white text-[var(--color-text)] border-[var(--color-border)] rounded-[16px] sm:rounded-[20px] rounded-bl-[4px]'
                              } ${isPending ? 'opacity-60' : 'opacity-100'}`}
                              style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
                            >
                              {msg.is_pinned && (
                                <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 p-0.5 rounded-full shadow-sm z-10 border border-amber-200">
                                  <Pin size={10} fill="currentColor" />
                                </div>
                              )}
                              {renderMessageContent(msg.content)}
                            </div>
                          </div>
                          
                          {/* Message Actions (Hover Visible on Desktop) */}
                          {!isPending && (
                            <div className={`hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              <button 
                                onClick={() => { setReplyingTo(msg); inputRef.current?.focus(); }}
                                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-[var(--color-primary)] transition-colors"
                                title="Reply"
                              >
                                <CornerUpLeft size={14} />
                              </button>
                              <button 
                                onClick={() => handleTogglePin(msg.id, msg.is_pinned)}
                                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-amber-600 transition-colors"
                                title={msg.is_pinned ? "Unpin message" : "Pin message"}
                              >
                                {msg.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                              </button>
                            </div>
                          )}
                        </div>
                        
                        <div className={`text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1 sm:mt-1.5 px-1 flex items-center gap-1 sm:gap-1.5 uppercase tracking-wide ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {formatMessageTime(msg.created_at)}
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

              {/* FLOATING SCROLL TO BOTTOM BUTTON */}
              {showScrollBottom && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 sm:right-6 z-20 bg-white text-[var(--color-primary)] p-2 sm:p-2.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-[var(--color-border)] hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center animate-in zoom-in-75 duration-200"
                  aria-label="Scroll to bottom"
                >
                  <ChevronDown size={20} strokeWidth={2.5} className="sm:w-[22px] sm:h-[22px]" />
                </button>
              )}
            </div>

            {/* UPGRADED MESSENGER-TYPE INPUT AREA */}
            <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[var(--color-border)] z-10 relative">
              
              {/* TYPING INDICATOR (ABOVE INPUT) */}
              {isRemoteUserTyping && (
                <div className="absolute -top-6 left-4 text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <span className="flex gap-0.5 mt-0.5">
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                  {currentChatName} is typing...
                </div>
              )}

              {/* REPLYING TO BANNER */}
              {replyingTo && (
                <div className="w-full max-w-4xl bg-slate-100 border-x border-t border-[var(--color-border)] rounded-t-[var(--radius-md)] px-3 py-2 flex justify-between items-center pb-2 mb-4 z-0 animate-in slide-in-from-bottom-2">
                  <div className="flex flex-col min-w-0 pr-2 border-l-[3px] border-[var(--color-primary)] pl-2">
                    <span className="text-[10px] font-black text-[var(--color-text)] uppercase tracking-wider">
                      Replying to {replyingTo.sender_email === userData.email ? 'yourself' : (customNames[activeChat] || activeRoleDetails?.label || 'User')}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-600 truncate line-clamp-1">{replyingTo.content}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className={`w-full max-w-4xl flex gap-2 sm:gap-3 items-end z-10 ${replyingTo ? 'mt-0' : ''}`}>
                <div className={`flex-1 bg-white border border-[var(--color-border)] px-3 sm:px-4 py-2 sm:py-3 flex items-center min-h-[44px] sm:min-h-[48px] focus-within:ring-4 focus-within:ring-[var(--color-primary)]/10 focus-within:border-[var(--color-primary)]/40 transition-all shadow-[var(--shadow-inner)] ${replyingTo ? 'rounded-b-[var(--radius-md)]' : 'rounded-[var(--radius-md)]'}`}>
                  <textarea
                    ref={inputRef as any}
                    value={newMessage}
                    onChange={handleMessageChange} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (newMessage.trim() && !isSending && !(activeChat === 'tenant' && !tenantEmail)) {
                          handleSendMessage(e as any);
                          e.currentTarget.style.height = 'auto'; 
                        }
                      }
                    }}
                    placeholder={activeChat === 'tenant' && !tenantEmail ? "No tenant assigned..." : "Type a message..."}
                    className="w-full bg-transparent border-none outline-none text-[14px] sm:text-[15px] text-[var(--color-text)] font-medium placeholder:text-slate-400 resize-none overflow-y-auto custom-scrollbar"
                    style={{ minHeight: '24px', height: '24px', maxHeight: '120px' }} 
                    disabled={isSending || isLoading || (activeChat === 'tenant' && !tenantEmail)}
                    rows={1}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isSending || (activeChat === 'tenant' && !tenantEmail)}
                  className={`h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 border transition-all active:scale-95 shadow-[var(--shadow-sm)] duration-200 mb-0.5 ${
                    newMessage.trim() 
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-transparent hover:opacity-90' 
                      : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSending ? <Clock size={16} className="animate-spin sm:w-[20px] sm:h-[20px]" /> : <Send size={16} strokeWidth={2.5} className={`sm:w-5 sm:h-5 ${newMessage.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Global Mobile Bottom Sheet for Long Press Actions */}
      {longPressedMsgId && (
        <>
          <div 
            className="fixed md:hidden inset-0 z-[100] bg-transparent" 
            onClick={() => setLongPressedMsgId(null)} 
          />
          <div className="fixed md:hidden bottom-0 left-0 right-0 z-[101] bg-white rounded-t-3xl pt-3 pb-8 px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-full duration-300 ease-out">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
            
            {(() => {
              const msg = messages.find(m => m.id === longPressedMsgId);
              if (!msg) return null;
              
              return (
                <div className="flex justify-around items-center max-w-sm mx-auto">
                  <button 
                    onClick={() => { setReplyingTo(msg); setLongPressedMsgId(null); setTimeout(() => inputRef.current?.focus(), 50); }} 
                    className="flex flex-col items-center gap-3 text-slate-600 active:scale-95 transition-transform"
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shadow-sm">
                      <CornerUpLeft size={22} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reply</span>
                  </button>

                  <button 
                    onClick={() => { navigator.clipboard.writeText(msg.content); setLongPressedMsgId(null); }} 
                    className="flex flex-col items-center gap-3 text-slate-600 active:scale-95 transition-transform"
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shadow-sm">
                      <Copy size={22} strokeWidth={2.5} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Copy</span>
                  </button>

                  <button 
                    onClick={() => { handleTogglePin(msg.id, msg.is_pinned); setLongPressedMsgId(null); }} 
                    className={`flex flex-col items-center gap-3 active:scale-95 transition-transform ${msg.is_pinned ? 'text-amber-600' : 'text-slate-600'}`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm ${msg.is_pinned ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                      {msg.is_pinned ? <PinOff size={22} strokeWidth={2.5} /> : <Pin size={22} strokeWidth={2.5} />}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${msg.is_pinned ? 'text-amber-600' : 'text-slate-500'}`}>
                      {msg.is_pinned ? 'Unpin' : 'Pin'}
                    </span>
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

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