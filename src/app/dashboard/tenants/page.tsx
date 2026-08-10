"use client";

import React, { useState, useEffect } from 'react';
import { 
  Zap, PenTool, FileText, Receipt, Mail, Home, Wrench, LogOut, 
  ChevronRight, Bell, CheckCheck, Trash2, User, X, MessageSquare, FileCheck,
  Lock, Key, Eye, EyeOff, AlertTriangle, CheckCircle2
} from 'lucide-react';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client"; 

// Import your tab components
import PayTab from './pay';
import RepairTab from './repair';
import LeaseTab from './lease';
import ConversationTab from './conversation'; 

export default function TenantDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Database States
  const [userData, setUserData] = useState<any>(null); 
  const [userEmail, setUserEmail] = useState<string>(""); 
  const [tenantName, setTenantName] = useState("");
  const [userRole, setUserRole] = useState<'owner' | 'tenant'>('tenant');
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // SOA / Billing States
  const [totalDue, setTotalDue] = useState<number>(0);
  const [soaStatus, setSoaStatus] = useState<string>('Unassigned');

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  // UNREAD MESSAGES STATE
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  // State to hold Highlight ID for Repairs
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);
  
  // ✨ NEW: Rejected Ticket Modal State
  const [rejectedTicketModalData, setRejectedTicketModalData] = useState<any | null>(null);

  // White Label & User Modal States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);

  // --- NEW: Global Toast State ---
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // --- NEW: Change Password States ---
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // --- NEW: Eye Toggle States ---
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetchTenantData();
  }, [router]);

  const fetchTenantData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      router.push('/');
      return;
    }
    
    try {
      setUserEmail(authData.user.email || "");

      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (profile) {
        setUserData(profile);
        setTenantName(profile.name);
        
        const cleanProfileName = profile.name.trim().toLowerCase();

        if (profile.admin_email) {
          // Fetch Organization Data & Rates to Match PayTab Logic
          const { data: orgData } = await supabase
            .from('organizations')
            .select('logo_url, dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value')
            .eq('admin_email', profile.admin_email)
            .single();

          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }

          // Fetch all units for this admin, then filter JS-side to handle special chars safely
          const { data: unitsArray } = await supabase
            .from('units')
            .select('*')
            .eq('admin_email', profile.admin_email);

          const unitData = unitsArray?.find(u => 
            (u.tenant_name || '').trim().toLowerCase() === cleanProfileName ||
            (u.owner_name || '').trim().toLowerCase() === cleanProfileName
          );
            
          if (unitData) {
            setUnit(unitData);

            // Determine if the logged-in user is the Owner or Tenant
            const isOwner = (unitData.owner_name || '').trim().toLowerCase() === cleanProfileName;
            const role = isOwner ? 'owner' : 'tenant';
            setUserRole(role);

            // Fetch SOA Configuration to calculate exact totals
            const { data: soaData } = await supabase
              .from('soa')
              .select('*')
              .eq('unit_id', unitData.id)
              .single();

            if (soaData && orgData) {
              const currentStatus = (role === 'owner' ? soaData.owner_status : soaData.tenant_status) || 'Pending';
              setSoaStatus(currentStatus);

              // Calculate matched totals
              const getUnitAreaValue = (areaStr: string) => {
                const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
              };
              
              const unitArea = getUnitAreaValue(unitData.unit_area);

              const rawDues = (orgData.dues_rate || 0) * unitArea;
              const rawParking = (orgData.default_parking || 0);
              const rawWater = (orgData.default_water || 0);
              const rawElectricity = (orgData.default_electricity || 0);

              // Map assignments based on dynamic role
              const dues = soaData[`${role}_dues`] ? rawDues : 0;
              const parking = soaData[`${role}_parking`] ? rawParking : 0;
              const water = soaData[`${role}_water`] ? rawWater : 0;
              const electricity = soaData[`${role}_electricity`] ? rawElectricity : 0;

              const baseTotal = dues + parking + water + electricity;

              const isOwnerVacant = !unitData.owner_name || unitData.owner_name === '—';
              const isTenantVacant = unitData.status === 'Vacant' || !unitData.tenant_name || unitData.tenant_name === '—';
              const isRoleVacant = role === 'owner' ? isOwnerVacant : isTenantVacant;

              let lateFee = 0;
              if (currentStatus === 'Overdue' && !isRoleVacant) {
                if (orgData.penalty_type === 'percent') {
                  lateFee = baseTotal * ((orgData.penalty_value || 0) / 100);
                } else {
                  lateFee = orgData.penalty_value || 0;
                }
              }

              // Update Total Based on Status
              const calculatedTotalDue = currentStatus === 'Paid' ? 0 : (baseTotal + lateFee);
              setTotalDue(calculatedTotalDue);
            } else {
              setTotalDue(0);
              setSoaStatus('Unassigned');
            }
          }
        }

        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_email', authData.user.email)
          .neq('sender_email', authData.user.email)
          .eq('is_read', false);
          
        if (msgCount !== null) {
          setUnreadMessages(msgCount);
        }

        // Fetch transactions matching either owner or tenant names
        const { data: txData } = await supabase
          .from('transactions') 
          .select('*')
          .eq('admin_email', profile.admin_email)
          .or(`tenant_name.ilike.%${cleanProfileName}%,owner_name.ilike.%${cleanProfileName}%`)
          .order('created_at', { ascending: false })
          .limit(5);

        if (txData) setTransactions(txData);

        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient', authData.user.email) 
          .eq('is_hidden', false) 
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (notifData) {
          setNotifications(notifData);
          setUnreadCount(notifData.filter(n => !n.is_read).length);
        }
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime SOA Updates (Detects Admin changes instantly)
  useEffect(() => {
    if (!unit?.id) return;

    const soaChannel = supabase
      .channel('tenant-soa-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'soa',
          filter: `unit_id=eq.${unit.id}`
        },
        () => {
          // Instantly re-fetch if admin marks SOA as 'Paid'
          fetchTenantData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(soaChannel);
    };
  }, [unit?.id]);

  useEffect(() => {
    if (!userEmail) return;

    const notifChannel = supabase
      .channel('tenant-live-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient=eq.${userEmail}` 
        },
        (payload) => {
          setNotifications((current) => [payload.new, ...current]);
          setUnreadCount((count) => count + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) return;

    const chatChannel = supabase
      .channel('tenant-live-chat-badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `tenant_email=eq.${userEmail}`
        },
        (payload) => {
          if (payload.new && payload.new.sender_email !== userEmail && !payload.new.is_read) {
            setUnreadMessages((count) => count + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `tenant_email=eq.${userEmail}`
        },
        (payload) => {
          if (payload.new && payload.new.sender_email !== userEmail && payload.new.is_read && !payload.old.is_read) {
             setUnreadMessages((count) => Math.max(0, count - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [userEmail]);

  const handleConversationClick = () => {
    setActiveTab('conversation');
    setHighlightTicketId(null);
    setIsWorkspaceModalOpen(false);
  };

  const confirmLogout = async () => {
    try {
      await supabase.auth.signOut(); 
      setShowLogoutModal(false);
      router.push("/"); 
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const markAllAsRead = async () => {
    if (!userEmail) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('recipient', userEmail).eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!userEmail) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase.from('notifications').update({ is_hidden: true }).eq('recipient', userEmail);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    setIsNotifOpen(false);

    const type = notif.type?.toUpperCase() || '';
    
    // ✨ NEW: Kapag Rejected ang ticket, i-open yung Rejected Modal imbes na ang maintenance tab
    if ((type === 'TICKET' || type === 'MAINTENANCE') && String(notif.title).toLowerCase().includes('rejected')) {
      if (notif.reference_id) {
        const { data: ticketData } = await supabase.from('tickets').select('*').eq('id', notif.reference_id).single();
        if (ticketData) {
          setRejectedTicketModalData({ ...ticketData, reason: notif.message });
          return; // Stop logic here para hindi na lumipat ng tab
        }
      }
    }

    if (type === 'BILLING' || type === 'SOA') {
      setActiveTab("pay");
    } else if (type === 'MAINTENANCE' || type === 'TICKET') {
      if (notif.reference_id) {
        setHighlightTicketId(`${notif.reference_id}_${Date.now()}`); 
      }
      setActiveTab("repair");
    } else if (type === 'MESSAGE' || type === 'CHAT') {
      handleConversationClick();
    } else {
      setActiveTab("home");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "TE";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  
  const initials = getInitials(tenantName);

  // --- NEW: Show Toast Function ---
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- NEW: Handle Password Change ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    setIsSubmittingPassword(true);

    try {
      // 1. Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password.");
      }

      // 2. Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      // Success
      showToast("Password updated successfully!", "success");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Reset toggles
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              <Image src={orgLogo || "/fpps-logo.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <div
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0b1727] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* UPGRADED PREMIUM NOTIFICATION MODAL */}
          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 flex justify-between items-center bg-white border-b border-slate-100">
                  <h3 className="font-extrabold text-[#0a1e3f] text-base flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-[#1e88e5] text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>
                    )}
                  </h3>
                  <div className="flex gap-3 relative z-10">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[11px] font-bold text-[#1e88e5] hover:text-blue-700 transition-colors" title="Mark all as read">
                        Read All
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAllNotifications} className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors" title="Clear all">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto relative z-10 custom-scrollbar bg-slate-50/30">
                  {notifications.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                        <Bell size={28} />
                      </div>
                      <h4 className="font-bold text-slate-700 mb-1">All caught up!</h4>
                      <p className="text-xs text-slate-500">You have no new notifications right now.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const type = notif.type?.toUpperCase() || '';
                      let Icon = Bell;
                      let iconColor = "text-blue-500";
                      let iconBg = "bg-blue-100";

                      if (type === 'BILLING' || type === 'SOA') {
                        Icon = Receipt; iconColor = "text-emerald-500"; iconBg = "bg-emerald-100";
                      } else if (type === 'MAINTENANCE' || type === 'TICKET') {
                        Icon = Wrench; iconColor = "text-orange-500"; iconBg = "bg-orange-100";
                      } else if (type === 'MESSAGE' || type === 'CHAT') {
                        Icon = MessageSquare; iconColor = "text-[#1e88e5]"; iconBg = "bg-blue-100";
                      }

                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-all flex gap-3 ${!notif.is_read ? 'bg-blue-50/40' : 'opacity-80'}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor} border border-white shadow-sm`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 gap-2">
                              <span className={`text-sm truncate pr-2 ${!notif.is_read ? 'font-bold text-[#0a1e3f]' : 'font-semibold text-slate-700'}`}>
                                {notif.title}
                              </span>
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[#1e88e5] shrink-0 mt-1.5 shadow-[0_0_8px_rgba(30,136,229,0.5)]"></span>}
                            </div>
                            <p className={`text-xs line-clamp-2 mb-1.5 ${!notif.is_read ? 'text-slate-600' : 'text-slate-500'}`}>{notif.message}</p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End of notifications</span>
                  </div>
                )}
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold border border-blue-500/30 bg-gradient-to-br from-[#1a3d6c] via-[#1565c0] to-[#0d47a1]">
            {userRole === 'owner' ? 'Owner Portal' : 'Tenant Portal'}
          </span>
          
          <button 
            onClick={() => setShowLogoutModal(true)} 
            className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PREMIUM DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0b1727] px-4 py-6 hidden md:flex flex-col border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <NavButton active={activeTab === 'home'} onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} icon={<Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} label="Home" />
            <NavButton 
              active={activeTab === 'conversation'} 
              onClick={handleConversationClick} 
              icon={<MessageSquare size={18} strokeWidth={activeTab === 'conversation' ? 2.5 : 2} />} 
              label="Messages" 
              badge={unreadMessages}
            />
            <NavButton active={activeTab === 'repair'} onClick={() => setActiveTab('repair')} icon={<Wrench size={18} strokeWidth={activeTab === 'repair' ? 2.5 : 2} />} label="Repairs" />

            <div className="mt-8 mb-4 pt-4 border-t border-white/5">
              <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Finance & Lease</h3>
            </div>
            
            <NavButton active={activeTab === 'lease'} onClick={() => {setActiveTab('lease'); setHighlightTicketId(null);}} icon={<FileText size={18} strokeWidth={activeTab === 'lease' ? 2.5 : 2} />} label="My Lease" />
            <NavButton active={activeTab === 'pay'} onClick={() => {setActiveTab('pay'); setHighlightTicketId(null);}} icon={<Receipt size={18} strokeWidth={activeTab === 'pay' ? 2.5 : 2} />} label="Financials" />
          </nav>

          {/* Premium Bottom User Tag */}
          <div className="mt-auto pt-4 border-t border-white/5">
             <div 
               onClick={() => {
                 setIsWorkspaceModalOpen(true);
                 setIsChangingPassword(false);
                 setPasswordError(null);
                 setShowCurrentPassword(false);
                 setShowNewPassword(false);
                 setShowConfirmPassword(false);
               }}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-[#1e88e5] flex items-center justify-center font-bold text-xs border border-blue-500/30 shrink-0">
                  {isLoading ? '...' : initials}
                </div>
                <div className="flex-1 min-w-0">
                  {isLoading ? (
                    <div className="h-4 w-20 bg-white/10 rounded animate-pulse"></div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-200 truncate">{tenantName || 'Resident'}</p>
                      <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">{userRole === 'owner' ? 'Owner Account' : 'Tenant Account'}</p>
                    </>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 relative transition-all ${activeTab === 'repair' || activeTab === 'conversation' ? 'flex flex-col overflow-hidden pb-16 md:pb-0' : 'overflow-y-auto p-4 md:p-8 pb-[100px] md:pb-8'}`}>
           <div className={`mx-auto w-full transition-all duration-300 ${activeTab === 'repair' ? 'max-w-[1400px] h-full flex flex-col' : 'max-w-5xl'}`}>
             {activeTab === 'home' && (
               <HomeView 
                 setActiveTab={setActiveTab} 
                 handleConversationClick={handleConversationClick}
                 tenantName={tenantName} 
                 initials={initials}
                 openProfileModal={() => {
                   setIsWorkspaceModalOpen(true);
                   setIsChangingPassword(false);
                   setPasswordError(null);
                   setShowCurrentPassword(false);
                   setShowNewPassword(false);
                   setShowConfirmPassword(false);
                 }}
                 unit={unit} 
                 transactions={transactions} 
                 isLoading={isLoading} 
                 totalDue={totalDue}
                 soaStatus={soaStatus}
               />
             )}
             {activeTab === 'pay' && <PayTab />}
             {activeTab === 'repair' && <RepairTab highlightTicketId={highlightTicketId} />}
             {activeTab === 'conversation' && <ConversationTab userData={userData} unit={unit} />}
             {activeTab === 'lease' && <LeaseTab setActiveTab={setActiveTab} />} 
           </div>
        </main>
      </div>

      {/* UPGRADED PREMIUM MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/50 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1 py-2">
          <MobileNavItem active={activeTab === 'home' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('home'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<Home size={22} />} label="Home" />
          <MobileNavItem active={activeTab === 'repair' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('repair'); setIsWorkspaceModalOpen(false);}} icon={<Wrench size={22} />} label="Repairs" />
          <MobileNavItem 
            active={activeTab === 'conversation' && !isWorkspaceModalOpen} 
            onClick={handleConversationClick} 
            icon={<MessageSquare size={22} />} 
            label="Chat" 
            badge={unreadMessages}
          />
          <MobileNavItem active={activeTab === 'pay' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('pay'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<Receipt size={22} />} label="Finance" />
          <MobileNavItem active={activeTab === 'lease' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('lease'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<FileCheck size={22} />} label="Lease" />
          <MobileNavItem 
            active={isWorkspaceModalOpen} 
            onClick={() => {
              setIsWorkspaceModalOpen(true);
              setIsChangingPassword(false);
              setPasswordError(null);
              setShowCurrentPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
            }} 
            icon={<User size={22} />} 
            label="Profile" 
          />
        </div>
      </nav>

      {/* WORKSPACE PROFILE MODAL (WITH CHANGE PASSWORD) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
            
            {/* Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">{userRole === 'owner' ? 'Owner Profile' : 'Tenant Profile'}</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Content Area with custom-scrollbar */}
            <div className="overflow-y-auto bg-slate-50/50 p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              
              {/* Profile Banner */}
              <div className="bg-gradient-to-r from-[#0b1727] to-[#1e293b] rounded-[1.5rem] sm:rounded-2xl p-5 sm:p-6 text-white flex flex-row items-center gap-4 sm:gap-5 shadow-lg relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl"></div>
                
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-full bg-white/10 flex items-center justify-center font-black text-xl sm:text-2xl border border-white/20 shadow-inner shrink-0 z-10">
                  {isLoading ? '...' : initials}
                </div>
                
                <div className="flex-1 min-w-0 z-10">
                  {isLoading ? (
                    <div className="space-y-2.5">
                       <div className="h-4 sm:h-5 bg-white/10 rounded-md w-2/3 animate-pulse"></div>
                       <div className="h-2.5 sm:h-3 bg-white/10 rounded-md w-1/3 animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-extrabold text-base sm:text-lg tracking-tight break-words leading-tight">{tenantName}</h3>
                      <p className="text-[10px] sm:text-xs font-bold text-blue-200 mt-0.5 sm:mt-1 tracking-widest uppercase">Active Resident</p>
                    </>
                  )}
                </div>
              </div>

              {/* Account Details Box */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-xl shadow-sm border border-slate-100 p-5 space-y-4 sm:space-y-5">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-3 sm:pb-2 border-b border-slate-50">
                  Account Details
                </h4>
                
                <div className="space-y-4 sm:space-y-3">
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 sm:mb-1">Full Name</label>
                    {isLoading ? <div className="h-3.5 sm:h-4 bg-slate-100 rounded w-1/2 animate-pulse mt-1"></div> : <p className="text-sm font-extrabold text-slate-800 tracking-tight break-words">{tenantName}</p>}
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 sm:mb-1">Email Address</label>
                    {isLoading ? <div className="h-3.5 sm:h-4 bg-slate-100 rounded w-2/3 animate-pulse mt-1"></div> : (
                      <div className="w-full">
                        <p className="text-xs sm:text-sm font-semibold text-slate-600 break-all bg-slate-50 py-2 rounded-xl inline-block border border-slate-100 leading-normal">
                          {userEmail || "Not available"}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-1">Assigned Property</label>
                    {isLoading ? <div className="h-3.5 sm:h-4 bg-slate-100 rounded w-3/4 animate-pulse mt-1"></div> : (
                      <div className="text-xs sm:text-sm font-bold text-slate-700 break-words leading-relaxed bg-blue-50/50 py-2 rounded-xl border border-blue-100/50">
                        {unit?.property_name ? `${unit.property_name} - Unit ${unit.unit_number}` : "Not Assigned"}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-1">Access Role</label>
                    <span className="inline-flex text-[9px] sm:text-[10px] font-black text-[#1e88e5] bg-blue-50 border border-blue-100 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-lg sm:rounded tracking-widest uppercase shadow-sm sm:mt-1">
                      {userRole === 'owner' ? 'Owner' : 'Tenant'}
                    </span>
                  </div>
                </div>
              </div>

              {/* --- Change Password Box --- */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Security
                  </h4>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-[#1e88e5] text-xs font-bold hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Key size={14} /> Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-100 flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        {passwordError}
                      </div>
                    )}
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Current Password</label>
                      <div className="relative">
                        <input 
                          type={showCurrentPassword ? "text" : "password"}
                          required 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1e88e5]/50 focus:border-[#1e88e5] text-sm bg-slate-50 focus:bg-white transition-all" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        >
                          {showCurrentPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1e88e5]/50 focus:border-[#1e88e5] text-sm bg-slate-50 focus:bg-white transition-all" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        >
                          {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1e88e5]/50 focus:border-[#1e88e5] text-sm bg-slate-50 focus:bg-white transition-all" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        >
                          {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordError(null);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setShowCurrentPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                        }}
                        disabled={isSubmittingPassword}
                        className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingPassword}
                        className="flex-1 py-2.5 rounded-xl font-bold text-white bg-[#1e88e5] hover:bg-blue-600 transition-colors shadow-sm text-xs flex items-center justify-center gap-2"
                      >
                        {isSubmittingPassword ? (
                          <span className="animate-pulse">Updating...</span>
                        ) : (
                          <><Lock size={14} /> Update Password</>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* SIGN OUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0b1727]/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center transform transition-all animate-in zoom-in-95 duration-300 border border-white/20">
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto mb-5 sm:mb-6 border border-red-100/60 shadow-inner">
              <LogOut size={28} className="text-red-500 sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-1.5 sm:mb-2 tracking-tight">Sign Out</h3>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              Are you sure you want to log out of your account?
            </p>
            
            <div className="flex gap-3 sm:gap-4">
              <button 
                onClick={() => setShowLogoutModal(false)} 
                className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all active:scale-95 text-xs sm:text-sm duration-200"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout} 
                className="flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all shadow-md shadow-red-500/20 active:scale-95 text-xs sm:text-sm duration-200"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ REJECTED TICKET MODAL (Triggered by Notification) */}
      {rejectedTicketModalData && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[95vh] border border-white/20 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            
            {/* Red Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 bg-red-50 border-b border-red-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-red-600 tracking-tight">Request Rejected</h2>
                  <p className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-widest mt-0.5">Admin Action</p>
                </div>
              </div>
              <button onClick={() => setRejectedTicketModalData(null)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors shadow-sm active:scale-95 shrink-0">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50/50 custom-scrollbar pb-10 sm:pb-8">
              
              {/* Reason Box */}
              <div className="bg-red-500 rounded-[1.5rem] p-5 sm:p-6 text-white mb-6 shadow-md shadow-red-500/20">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-200 mb-2">Reason for rejection:</h4>
                <p className="text-sm font-semibold leading-relaxed">
                  {rejectedTicketModalData.reason?.replace(/Your request ".*?" was not approved\. Reason: /, '') || "This request was not approved by the administration."}
                </p>
              </div>

              {/* Original Report Details */}
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Original Report</h4>
              <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm space-y-4">
                
                {rejectedTicketModalData.photo_url && (
                  <div className="w-full h-40 bg-slate-100 rounded-xl overflow-hidden mb-4 border border-slate-200">
                    <img src={rejectedTicketModalData.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                  </div>
                )}

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Issue Title</span>
                  <p className="font-extrabold text-slate-800">{rejectedTicketModalData.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Location</span>
                    <p className="font-bold text-slate-600 text-xs">{rejectedTicketModalData.location}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reported On</span>
                    <p className="font-bold text-slate-600 text-xs">{new Date(rejectedTicketModalData.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</span>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {rejectedTicketModalData.description}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
      
      {/* TOAST UI */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${toast.type === "success" ? "border-l-4 border-l-[#1e88e5] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[#1e88e5]" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
          {toast.message}
        </div>
      )}

      {/* ✨ GLOBAL CSS: INVISIBLE SCROLLBARS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        .custom-scrollbar::-webkit-scrollbar { 
          display: none; /* Chrome, Safari, Opera */
        }
        
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }

        .pb-safe { padding-bottom: max(4px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// COMPONENTS
// -------------------------------------------------------------------------------------------------

function HomeView({ setActiveTab, handleConversationClick, tenantName, unit, transactions, isLoading, totalDue, soaStatus, openProfileModal }: any) {
  // Use dynamically calculated total to mirror PayTab logic exactly
  const rentAmount = totalDue || 0; 
  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  
  const getStatusColor = (status: string) => {
    if (status === 'Paid') return 'text-emerald-400';
    if (status === 'Overdue') return 'text-red-400';
    if (status === 'Sent') return 'text-blue-400';
    return 'text-amber-400';
  };

  const getIndicatorColor = (status: string) => {
    if (status === 'Paid' || status === 'Unassigned') return 'bg-emerald-400';
    if (status === 'Overdue') return 'bg-red-400 animate-pulse';
    return 'bg-amber-400 animate-pulse';
  };

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-1 gap-2">
        <div className="w-full min-w-0">
          <p className="text-slate-400 text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest">Dashboard Overview</p>
          {isLoading ? (
            <div className="h-7 sm:h-8 md:h-10 w-48 bg-slate-200 rounded-xl sm:rounded-2xl animate-pulse mt-1"></div>
          ) : (
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0a1e3f] mt-1 tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
              Welcome back, <span className="text-slate-900 break-words">{tenantName}</span>
            </h1>
          )}
        </div>
      </header>
      
      {/* Hero Card: Amount Due Selector Display (Premium Indigo/Blue Tech Theme) */}
      <section className="bg-gradient-to-br from-[#0a1e3f] via-[#112d56] to-[#1a3d6c] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden group border border-white/5">
        {/* Decorative background shapes */}
        <div className="absolute -top-10 -right-10 w-48 sm:w-72 h-48 sm:h-72 bg-emerald-500/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-colors duration-500"></div>
        <div className="absolute -bottom-10 -left-10 w-40 sm:w-52 h-40 sm:h-52 bg-blue-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col justify-between h-full space-y-5 sm:space-y-6">
          <div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full w-fit backdrop-blur-sm">
              <div className={`w-1.5 h-1.5 sm:w-2 h-2 rounded-full shrink-0 ${getIndicatorColor(soaStatus)}`}></div>
              <p className="text-slate-200 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Current Statement Balance</p>
            </div>
            
            {isLoading ? (
              <div className="space-y-3 mt-3 sm:mt-4">
                 <div className="h-8 sm:h-10 md:h-12 bg-white/10 rounded-xl sm:rounded-2xl w-32 sm:w-40 animate-pulse"></div>
                 <div className="h-3 sm:h-4 bg-white/5 rounded w-48 sm:w-64 animate-pulse mt-2"></div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-3 sm:mt-4 tracking-tight bg-gradient-to-r from-white via-white to-slate-200 bg-clip-text text-transparent break-all sm:break-normal">
                  ₱{rentAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h2>
                <div className="text-[11px] sm:text-xs md:text-sm text-slate-200 font-medium mt-3 flex items-center gap-2 bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm w-fit max-w-full">
                  <Home size={14} className="text-blue-300 shrink-0" />
                  <div className="truncate min-w-0">
                    <p className="font-semibold truncate">
                      {propertyName} · {unitNumber} {soaStatus !== 'Unassigned' && <span className={`font-bold ml-1 ${getStatusColor(soaStatus)}`}>· Status: {soaStatus}</span>}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={() => setActiveTab('pay')} 
            disabled={isLoading || soaStatus === 'Unassigned'}
            className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-[#1565c0] transition-all rounded-xl sm:rounded-2xl py-3.5 sm:py-4 font-black text-sm md:text-base flex items-center justify-center gap-2 active:scale-[0.99] border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none duration-300"
          >
            {isLoading ? "Checking balance..." : (soaStatus === 'Paid' || soaStatus === 'Unassigned' || rentAmount === 0) ? "All caught up" : "See Statements"} 
            {!isLoading && rentAmount > 0 && <ChevronRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </section>

      {/* 🚀 UPGRADED PREMIUM METRIC GRID: 4 Interactive Columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
         <ActionCard 
           onClick={() => setActiveTab('repair')} 
           icon={<PenTool size={20} className="w-4 h-4 sm:w-5 sm:h-5" />} 
           title="Report Issue" 
           subtitle="Snap a photo request" 
           variant="amber"
         />
         <ActionCard 
           onClick={() => setActiveTab('lease')} 
           icon={<FileText size={20} className="w-4 h-4 sm:w-5 sm:h-5" />} 
           title="My Lease" 
           subtitle="View active contracts" 
           variant="blue"
         />
         <ActionCard 
           onClick={() => setActiveTab('pay')} 
           icon={<Receipt size={20} className="w-4 h-4 sm:w-5 sm:h-5" />} 
           title="Financials" 
           subtitle="Track your billings" 
           variant="emerald"
         />
         <ActionCard 
           onClick={handleConversationClick} 
           icon={<Mail size={20} className="w-4 h-4 sm:w-5 sm:h-5" />} 
           title="Support" 
           subtitle="Message manager" 
           variant="purple"
         />
      </div>

      {/* Recent Transactions List Section */}
      <section className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200/60 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="flex flex-row items-center justify-between mb-4 sm:mb-5 border-b border-slate-100 pb-3 sm:pb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-base sm:text-lg text-[#0a1e3f] tracking-tight truncate">Recent Transactions</h3>
            <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 font-medium hidden sm:block truncate">History of logs and ledger remissions</p>
          </div>
          <button 
            onClick={() => setActiveTab('pay')} 
            className="text-[10px] sm:text-xs font-black text-[#1e88e5] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm shrink-0 whitespace-nowrap"
          >
            View All
          </button>
        </div>
        
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <TransactionSkeleton />
              <TransactionSkeleton />
              <TransactionSkeleton />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 sm:py-10 text-center border-2 border-dashed border-slate-100 rounded-xl sm:rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6">
              <div className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 mb-2 sm:mb-3 shadow-sm">
                <Receipt size={20} className="sm:w-6 sm:h-6" />
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-extrabold">No recent transactions</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-[240px]">Payments submitted and approved will be cataloged here.</p>
            </div>
          ) : (
            transactions.map((tx: any, idx: number) => (
              <TransactionItem 
                key={idx} 
                title={tx.description || "Rent Payment"} 
                date={new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                amount={`₱${(tx.amount || 0).toLocaleString()}`} 
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 animate-pulse">
      <div className="flex items-center gap-4 w-full">
        <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0"></div>
        <div className="space-y-2 w-1/2">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
        </div>
      </div>
      <div className="h-4 bg-slate-200 rounded w-16 shrink-0"></div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
        active 
          ? 'bg-white/10 text-white shadow-sm border border-white/5' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`transition-transform duration-300 ${active ? 'text-[#1e88e5] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
          {icon}
        </div>
        <span className="tracking-wide">{label}</span>
      </div>
      
      {badge > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-in zoom-in">
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#1e88e5] rounded-r-full shadow-[0_0_10px_#1e88e5]" />}
    </button>
  );
}

// -------------------------------------------------------------------------------------------------
// UPGRADED ACTION CARD COMPONENT WITH DYNAMIC VARIANT THEMES
// -------------------------------------------------------------------------------------------------
function ActionCard({ onClick, icon, title, subtitle, variant }: { onClick: () => void, icon: React.ReactNode, title: string, subtitle: string, variant: 'amber' | 'blue' | 'emerald' | 'purple' }) {
  // Dynamic color mapping matching premium layout aesthetics
  const themes = {
    amber: {
      bg: 'bg-amber-50 group-hover:bg-amber-100/80 text-amber-600 border-amber-100/50 shadow-amber-500/5',
      glow: 'group-hover:shadow-amber-500/10',
      text: 'group-hover:text-amber-700'
    },
    blue: {
      bg: 'bg-blue-50 group-hover:bg-blue-100/80 text-blue-600 border-blue-100/50 shadow-blue-500/5',
      glow: 'group-hover:shadow-blue-500/10',
      text: 'group-hover:text-blue-700'
    },
    emerald: {
      bg: 'bg-emerald-50 group-hover:bg-emerald-100/80 text-emerald-600 border-emerald-100/50 shadow-emerald-500/5',
      glow: 'group-hover:shadow-emerald-500/10',
      text: 'group-hover:text-emerald-700'
    },
    purple: {
      bg: 'bg-purple-50 group-hover:bg-purple-100/80 text-purple-600 border-purple-100/50 shadow-purple-500/5',
      glow: 'group-hover:shadow-purple-500/10',
      text: 'group-hover:text-purple-700'
    }
  };

  const currentTheme = themes[variant] || themes.blue;

  return (
    <button 
      onClick={onClick} 
      className={`group bg-white flex flex-col p-5 rounded-[2rem] border border-slate-200/60 shadow-[0_4px_25px_rgba(0,0,0,0.015)] hover:shadow-[0_16px_35px_rgba(0,0,0,0.06)] hover:-translate-y-1.5 transition-all duration-300 ease-out active:scale-[0.96] text-left relative overflow-hidden h-full ${currentTheme.glow}`}
    >
      {/* Background Gradient Hover Light Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-slate-50/20 to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Modern Boxy Rounded Icon with Inner Shadows */}
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border transition-all duration-300 relative z-10 shrink-0 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] ${currentTheme.bg}`}>
        {icon}
      </div>
      
      {/* Text Context Stack */}
      <div className="relative z-10 flex flex-col flex-1">
        <h3 className={`font-black text-base text-slate-800 tracking-tight transition-colors duration-200 ${currentTheme.text}`}>
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium leading-normal">
          {subtitle}
        </p>
      </div>

      {/* Slick Arrow Floating Accent Indicator */}
      <div className="absolute bottom-4 right-5 text-slate-300 group-hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
        <ChevronRight size={14} strokeWidth={3} />
      </div>
    </button>
  );
}

function TransactionItem({ title, date, amount }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all duration-200 group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-blue-200 transition-colors shadow-inner">
          <Receipt size={18} className="group-hover:text-blue-500 transition-colors" />
        </div>
        <div>
          <p className="font-extrabold text-slate-800 text-sm group-hover:text-[#0a1e3f] transition-colors">{title}</p>
          <p className="text-[11px] md:text-xs text-slate-400 font-semibold mt-0.5">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-black text-slate-900 md:text-lg">{amount}</span>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}

function MobileNavItem({ active, onClick, icon, label, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors"
    >
      {active && (
        <span className="absolute inset-1.5 bg-blue-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />
      )}
      
      <div 
        className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${
          active 
            ? 'text-[#1e88e5] -translate-y-1 scale-[1.05]' 
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span className="relative leading-none flex items-center justify-center w-5 h-5 shrink-0 block">
          {icon}
          {badge > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white animate-pulse shadow-sm z-20">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>
        
        <span className="text-[9px] font-black mt-1 uppercase tracking-tight">{label}</span>
      </div>
    </button>
  );
}