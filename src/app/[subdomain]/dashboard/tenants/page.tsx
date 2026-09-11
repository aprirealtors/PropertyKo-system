"use client";

import React, { useState, useEffect } from 'react';
import { 
  Zap, PenTool, FileText, Receipt, Mail, Home, Wrench, LogOut, 
  ChevronRight, Bell, CheckCheck, Trash2, User, X, MessageSquare, FileCheck,
  Lock, Key, Eye, EyeOff, AlertTriangle, CheckCircle2, Edit2, PanelLeft
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

  // ✨ NEW: Collapsible Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
  // NEW: Logo Lightbox Modal State
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);

  // --- NEW: Global Toast State ---
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // --- Edit Name States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isConfirmNameModalOpen, setIsConfirmNameModalOpen] = useState(false);

  // --- Change Password States ---
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // --- Eye Toggle States ---
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

  // ✨ NEW: Realtime SOA Updates (Auto-updates the Hero Card / Total Due instantly for Tenant)
  useEffect(() => {
    if (!unit?.id) return; 

    const soaChannel = supabase
      .channel('tenant-soa-live-updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'soa',
          filter: `unit_id=eq.${unit.id}` 
        },
        (payload) => {
          console.log("SOA Updated! Recalculating Hero Card for Tenant...");
          fetchTenantData(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(soaChannel);
    };
  }, [unit?.id]);

  const handleConversationClick = () => {
    setActiveTab('conversation');
    setHighlightTicketId(null);
    setIsWorkspaceModalOpen(false);
  };

  const confirmLogout = async () => {
    try {
      await supabase.auth.signOut(); 
      setShowLogoutModal(false);
      router.push("/login"); 
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
    // Return "T" for missing tenant names to keep it a single letter
    if (!name) return "T"; 
    
    // Get the first character, remove leading spaces, and capitalize it
    return name.trim().charAt(0).toUpperCase();
  };
  
  const initials = getInitials(tenantName);

  // --- Show Toast Function ---
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Handle Name Update Function (using Auth user_metadata) ---
  const handleInitiateNameSave = () => {
    if (!editedName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    
    // Only open the modal if the name actually changed
    if (editedName.trim() === tenantName) {
      setIsEditingName(false);
      return;
    }

    setIsConfirmNameModalOpen(true);
  };

  const confirmNameSave = async () => {
    setIsConfirmNameModalOpen(false);
    setIsSavingName(true);
    
    try {
      const newName = editedName.trim();

      // 1. Update name directly in Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: newName }
      });
      if (authError) throw authError;
        
      // 2. Update name in the team_members table
      const { data, error: dbError } = await supabase
        .from('team_members')
        .update({ name: newName })
        .eq('email', userEmail)
        .select();
        
      if (dbError) throw dbError;

      // 3. Catch Silent RLS Failures
      if (!data || data.length === 0) {
        throw new Error("Update blocked by database permissions (RLS) or email not found.");
      }

      // 4. ✨ NEW: Update the name in the units table to maintain the link
      if (userRole === 'owner') {
        const { error: unitError } = await supabase
          .from('units')
          .update({ owner_name: newName })
          .eq('owner_name', tenantName); // Update where it matches the old name
          
        if (unitError) console.error("Failed to update owner name in units", unitError);
      } else {
        const { error: unitError } = await supabase
          .from('units')
          .update({ tenant_name: newName })
          .eq('tenant_name', tenantName); // Update where it matches the old name
          
        if (unitError) console.error("Failed to update tenant name in units", unitError);
      }

      setTenantName(newName);
      setUserData((prev: any) => ({ ...prev, name: newName }));
      
      // ✨ NEW: Update the local unit state so the UI reflects the new name immediately
      if (unit) {
         setUnit((prev: any) => ({
             ...prev,
             [userRole === 'owner' ? 'owner_name' : 'tenant_name']: newName
         }));
      }
      
      showToast("Profile name updated successfully!", "success");
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Error updating profile name:", err);
      showToast(err.message || "Failed to update profile name.", "error");
    } finally {
      setIsSavingName(false);
    }
  };

  // --- Handle Password Change ---
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
    <div className="flex flex-col h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)] font-[family-name:var(--font-corporate)] overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[var(--color-secondary)] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <div 
              onClick={() => setIsLogoModalOpen(true)}
              className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-300"
            >
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src={orgLogo} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          ) : (
            <div className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src="/logos.png" alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <div
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[var(--color-secondary)] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* UPGRADED PREMIUM NOTIFICATION MODAL */}
          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-[340px] sm:w-[380px] bg-white rounded-[var(--radius-lg)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[var(--color-border)] z-50 overflow-hidden flex flex-col text-[var(--color-text)] animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 flex justify-between items-center bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <h3 className="font-extrabold text-[var(--color-secondary)] text-base flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-[var(--color-primary)] text-[var(--color-primary-text)] text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>
                    )}
                  </h3>
                  <div className="flex gap-3 relative z-10">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 transition-colors" title="Mark all as read">
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
                      <h4 className="font-bold text-[var(--color-secondary)] mb-1">All caught up!</h4>
                      <p className="text-xs text-slate-500">You have no new notifications right now.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const type = notif.type?.toUpperCase() || '';
                      let Icon = Bell;
                      let iconColor = "text-[var(--color-primary)]";
                      let iconBg = "bg-[var(--color-primary)]/10";

                      if (type === 'BILLING' || type === 'SOA') {
                        Icon = Receipt; iconColor = "text-emerald-500"; iconBg = "bg-emerald-100";
                      } else if (type === 'MAINTENANCE' || type === 'TICKET') {
                        Icon = Wrench; iconColor = "text-orange-500"; iconBg = "bg-orange-100";
                      } else if (type === 'MESSAGE' || type === 'CHAT') {
                        Icon = MessageSquare; iconColor = "text-[var(--color-primary)]"; iconBg = "bg-[var(--color-primary)]/10";
                      }

                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-primary)]/5 transition-all flex gap-3 ${!notif.is_read ? 'bg-[var(--color-primary)]/10' : 'opacity-80'}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor} border border-white shadow-[var(--shadow-sm)]`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 gap-2">
                              <span className={`text-sm truncate pr-2 ${!notif.is_read ? 'font-bold text-[var(--color-secondary)]' : 'font-semibold text-slate-700'}`}>
                                {notif.title}
                              </span>
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0 mt-1.5 shadow-[var(--shadow-sm)]"></span>}
                            </div>
                            <p className={`text-xs line-clamp-2 mb-1.5 ${!notif.is_read ? 'text-[var(--color-text)]' : 'text-slate-500'}`}>{notif.message}</p>
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
                  <div className="p-2 bg-[var(--color-bg)] border-t border-[var(--color-border)] text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End of notifications</span>
                  </div>
                )}
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px] sm:text-xs font-extrabold border border-[var(--color-primary)]/30 text-[var(--color-primary-text)] bg-[var(--color-primary)]">
            {userRole === 'owner' ? 'Owner Portal' : 'Tenant Portal'}
          </span>
          
          {/* Logout Icon Button */}
          <button 
            onClick={() => setShowLogoutModal(true)} 
            className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 font-bold transition-all text-xs px-3 py-2 sm:px-4 rounded-[var(--radius-sm)]"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ✨ MODERN COLLAPSIBLE DESKTOP SIDEBAR (Manager Style) */}
        <aside className={`${isSidebarCollapsed ? 'md:w-[84px] px-2' : 'md:w-[260px] px-4'} bg-[var(--color-secondary)] py-6 hidden md:flex flex-col z-40 transition-all duration-300 relative shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.15)]`}>
          
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute top-[72px] -right-3 w-6 h-6 rounded-full bg-white border border-[var(--color-border)] shadow-md items-center justify-center z-20 text-slate-500 hover:text-[var(--color-primary)] hover:scale-110 hover:shadow-lg transition-all duration-200 group"
          >
            <PanelLeft size={13} strokeWidth={2.5} className={`transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
              {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>
          
          <nav className={`flex-1 space-y-1 ${isSidebarCollapsed ? "overflow-visible" : "overflow-y-auto custom-scrollbar"}`}>
            <NavSectionLabel collapsed={isSidebarCollapsed}>Overview</NavSectionLabel>
            <NavItem icon={<Home size={18} strokeWidth={2.5} />} label="Home" isActive={activeTab === "home"} onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
            <NavItem icon={<Wrench size={18} strokeWidth={2.5} />} label="Repairs" isActive={activeTab === "repair"} onClick={() => setActiveTab('repair')} collapsed={isSidebarCollapsed} />
            <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "conversation"} onClick={handleConversationClick} badgeCount={unreadMessages} collapsed={isSidebarCollapsed} />

            <div className="pt-4">
              <NavSectionLabel collapsed={isSidebarCollapsed}>Finance & Lease</NavSectionLabel>
            </div>
            <NavItem icon={<Receipt size={18} strokeWidth={2.5} />} label="Financials" isActive={activeTab === "pay"} onClick={() => {setActiveTab('pay'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
            <NavItem icon={<FileText size={18} strokeWidth={2.5} />} label="My Lease" isActive={activeTab === "lease"} onClick={() => {setActiveTab('lease'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
          </nav>

          <div className="shrink-0 pt-4 mt-auto border-t border-white/5">
            <button 
              onClick={() => {
                setIsWorkspaceModalOpen(true);
                setIsChangingPassword(false);
                setPasswordError(null);
                setShowCurrentPassword(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
                setIsEditingName(false);
              }}
              className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 text-left group relative ${isSidebarCollapsed ? "justify-center" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-extrabold text-[13px] text-[var(--color-primary-text)] shadow-inner group-hover:scale-105 transition-transform uppercase border border-white/5 shrink-0" style={{backgroundColor: "var(--color-primary)"}}>
                {isLoading ? '...' : initials}
              </div>
              
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  {isLoading ? (
                    <div className="h-4 w-20 bg-white/10 rounded animate-pulse"></div>
                  ) : (
                    <>
                      <p className="text-sm font-extrabold text-white truncate">{tenantName || 'Resident'}</p>
                      <p className="text-[10px] text-white/50 font-extrabold truncate uppercase tracking-widest mt-0.5">{userRole === 'owner' ? 'Owner Profile' : 'Tenant Profile'}</p>
                    </>
                  )}
                </div>
              )}

              {/* Collapsed Tooltip for Profile */}
              {isSidebarCollapsed && !isLoading && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
                  {tenantName || 'Resident'}
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 relative transition-all ${activeTab === 'repair' || activeTab === 'conversation' ? 'flex flex-col overflow-hidden pb-16 md:pb-0' : 'overflow-y-auto p-4 md:p-8 pb-28'}`}>
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
                   setIsEditingName(false);
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[var(--color-bg)]/95 backdrop-blur-xl pb-safe z-50 shadow-[var(--shadow-md)]">
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
              setIsEditingName(false);
            }} 
            icon={<User size={22} />} 
            label="Profile" 
          />
        </div>
      </nav>

      {/* WORKSPACE PROFILE MODAL (WITH CHANGE PASSWORD) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-[var(--color-border)]">
            
            <div className="px-5 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight">{userRole === 'owner' ? 'Owner Profile' : 'Tenant Profile'}</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-slate-100 rounded-[var(--radius-xl)] text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Content Area with custom-scrollbar */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              
              <div className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[var(--radius-xl)] p-5 sm:p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-[var(--color-primary)] uppercase shadow-inner z-10" style={{backgroundColor: "var(--color-primary)", color: "var(--color-primary-text)"}}>
                  {isLoading ? '...' : initials}
                </div>
                
                <div className="z-10 min-w-0 flex-1 text-white">
                  {isLoading ? (
                    <div className="space-y-2.5">
                       <div className="h-4 sm:h-5 bg-white/10 rounded-md w-2/3 animate-pulse"></div>
                       <div className="h-2.5 sm:h-3 bg-white/10 rounded-md w-1/3 animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-black text-lg sm:text-2xl tracking-tight break-words leading-tight">{tenantName}</h3>
                      <p className="text-[10px] sm:text-xs font-bold text-white/70 mt-1 tracking-widest uppercase">Active Resident</p>
                    </>
                  )}
                </div>
              </div>

              {/* Account Details Box */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6 space-y-4 sm:space-y-5">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-3 border-b border-slate-100">
                  Account Details
                </h4>
                
                <div className="space-y-4 sm:space-y-5">
                  {/* --- MODIFIED FULL NAME SECTION --- */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Full Name</label>
                      {!isEditingName ? (
                        <button 
                          onClick={() => {
                            setEditedName(tenantName);
                            setIsEditingName(true);
                          }}
                          className="text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Edit2 size={12} strokeWidth={2.5} /> Edit
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <button 
                            onClick={() => setIsEditingName(false)}
                            className="text-slate-500 bg-slate-50 border border-[var(--color-border)] hover:bg-slate-100 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                            disabled={isSavingName}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleInitiateNameSave}
                            className="text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 border border-transparent px-3 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all shadow-[var(--shadow-sm)] active:scale-95"
                            disabled={isSavingName}
                          >
                            {isSavingName ? (
                              <span className="animate-pulse">Saving...</span>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditingName ? (
                      <p className="text-sm sm:text-[15px] font-extrabold text-[var(--color-text)] tracking-tight break-words px-3 py-2.5 bg-slate-50 rounded-[var(--radius-md)] border border-[var(--color-border)] transition-all">
                        {tenantName}
                      </p>
                    ) : (
                      <div className="relative animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 text-sm sm:text-[15px] font-extrabold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]"
                          disabled={isSavingName}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInitiateNameSave();
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {/* --- END MODIFIED FULL NAME SECTION --- */}
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                    {isLoading ? <div className="h-3.5 sm:h-4 bg-slate-100 rounded w-2/3 animate-pulse mt-1"></div> : (
                      <div className="w-full">
                        <p className="text-xs sm:text-sm font-bold text-[var(--color-text)]/80 break-all bg-slate-50 py-2 px-3 rounded-[var(--radius-md)] inline-block border border-[var(--color-border)] leading-normal">
                          {userEmail || "Not available"}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Assigned Property</label>
                    {isLoading ? <div className="h-3.5 sm:h-4 bg-slate-100 rounded w-3/4 animate-pulse mt-1"></div> : (
                      <div className="text-xs sm:text-sm font-bold text-[var(--color-primary)] break-words leading-relaxed bg-[var(--color-primary)]/10 py-2 px-3 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20">
                        {unit?.property_name ? `${unit.property_name} - Unit ${unit.unit_number}` : "Not Assigned"}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Access Role</label>
                    <span className="inline-flex text-[10px] sm:text-[11px] font-black text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-2.5 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] tracking-widest uppercase shadow-sm">
                      {userRole === 'owner' ? 'Owner' : 'Tenant'}
                    </span>
                  </div>
                </div>
              </div>

              {/* --- Change Password Box --- */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400/80 uppercase tracking-[0.2em]">
                    Security
                  </h4>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-[var(--color-primary)] text-xs font-bold hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Key size={14} /> Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-[var(--radius-md)] border border-red-100 flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        {passwordError}
                      </div>
                    )}
                    
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Current Password</label>
                      <div className="relative">
                        <input 
                          type={showCurrentPassword ? "text" : "password"}
                          required 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showCurrentPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
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
                        className="flex-1 py-3 rounded-[var(--radius-md)] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs shadow-sm active:scale-95 border border-transparent"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingPassword}
                        className="flex-1 py-3 rounded-[var(--radius-md)] font-black text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 transition-all shadow-[var(--shadow-md)] text-xs flex items-center justify-center gap-2 active:scale-95 border border-transparent"
                      >
                        {isSubmittingPassword ? (
                          <span className="animate-pulse">Updating...</span>
                        ) : (
                          <><Lock size={14} strokeWidth={2.5} /> Update Password</>
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

      {/* 🌟 PREMIUM CONFIRM NAME CHANGE MODAL */}
      {isConfirmNameModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/5 text-[var(--color-primary)] rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-[var(--color-primary)]/20 shadow-inner">
              <User size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Name Change</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              Are you sure you want to change your profile name to <strong className="text-[var(--color-primary)] font-black">"{editedName.trim()}"</strong>?
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfirmNameModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-[var(--radius-md)] transition-all border border-[var(--color-border)] active:scale-[0.96] shadow-sm"
                disabled={isSavingName}
              >
                Cancel
              </button>
              <button 
                onClick={confirmNameSave} 
                className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-black transition-all shadow-[var(--shadow-md)] active:scale-[0.96] flex justify-center items-center border border-transparent"
                disabled={isSavingName}
              >
                {isSavingName ? <span className="animate-pulse">Updating...</span> : "Yes, Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM LOGOUT MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <AlertTriangle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Logout</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">Are you sure you want to log out of your tenant workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutModal(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-all border border-transparent active:scale-[0.96]"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout} 
                className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-sm sm:text-sm font-black transition-all shadow-lg shadow-[var(--color-primary)]/25 active:scale-[0.96]"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ REJECTED TICKET MODAL (Triggered by Notification) */}
      {rejectedTicketModalData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[95vh] border border-[var(--color-border)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            
            {/* Red Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 bg-red-50 border-b border-red-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-[var(--shadow-sm)]">
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
            
            <div className="p-6 sm:p-8 overflow-y-auto bg-[var(--color-bg)]/50 custom-scrollbar pb-10 sm:pb-8">
              
              {/* Reason Box */}
              <div className="bg-red-500 rounded-[1.5rem] p-5 sm:p-6 text-white mb-6 shadow-[var(--shadow-md)] shadow-red-500/20">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-200 mb-2">Reason for rejection:</h4>
                <p className="text-sm font-semibold leading-relaxed">
                  {rejectedTicketModalData.reason?.replace(/Your request ".*?" was not approved\. Reason: /, '') || "This request was not approved by the administration."}
                </p>
              </div>

              {/* Original Report Details */}
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Original Report</h4>
              <div className="bg-white rounded-[1.5rem] p-5 border border-[var(--color-border)] shadow-[var(--shadow-sm)] space-y-4">
                
                {rejectedTicketModalData.photo_url && (
                  <div className="w-full h-40 bg-[var(--color-bg)] rounded-[var(--radius-md)] overflow-hidden mb-4 border border-[var(--color-border)]">
                    <img src={rejectedTicketModalData.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                  </div>
                )}

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Issue Title</span>
                  <p className="font-extrabold text-[var(--color-text)]">{rejectedTicketModalData.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Location</span>
                    <p className="font-bold text-[var(--color-text)]/80 text-xs">{rejectedTicketModalData.location}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reported On</span>
                    <p className="font-bold text-[var(--color-text)]/80 text-xs">{new Date(rejectedTicketModalData.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</span>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed bg-[var(--color-bg)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                    {rejectedTicketModalData.description}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM LOGO LIGHTBOX MODAL */}
      {isLogoModalOpen && orgLogo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300" onClick={() => setIsLogoModalOpen(false)}>
          <div
            className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[50vh] sm:h-[70vh] flex items-center justify-center p-8 sm:p-12 transform transition-all animate-in zoom-in-95 duration-500 border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsLogoModalOpen(false)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-all active:scale-95 shadow-sm z-10"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
            <div className="relative w-full h-full">
              <Image
                src={orgLogo}
                alt="Organization Logo Expanded"
                fill
                className="object-contain drop-shadow-lg"
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
              />
            </div>
          </div>
        </div>
      )}
      
      {/* TOAST UI */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex items-center gap-3 px-5 py-4 rounded-[var(--radius-xl)] shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-[var(--color-bg)] ${toast.type === "success" ? "border-l-4 border-l-[var(--color-primary)] text-[var(--color-text)]" : "border-l-4 border-l-red-500 text-[var(--color-text)]"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[var(--color-primary)]" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
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
    if (status === 'Sent') return 'text-[var(--color-primary)]';
    return 'text-amber-400';
  };

  const getIndicatorColor = (status: string) => {
    if (status === 'Paid' || status === 'Unassigned') return 'bg-emerald-400';
    if (status === 'Overdue') return 'bg-red-400 animate-pulse';
    return 'bg-amber-400 animate-pulse';
  };

  // ✨ NEW: Generate Recent Statements Locally to avoid undefined array errors
  const recentStatementsArray = React.useMemo(() => {
    if (!unit || soaStatus === 'Unassigned') return [];
    
    // Reverse engineer the base total by removing penalty if overdue
    // This is purely for UI display purposes in the Dashboard
    let baseTotal = rentAmount;
    if (soaStatus === 'Overdue') {
       // Estimate base if there's a penalty.
       // Without exact organization data here, we just use totalDue for current
       baseTotal = rentAmount > 0 ? rentAmount : 0; 
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const d = new Date();
    const curMonth = d.getMonth();
    const curYear = d.getFullYear();

    const arr = [];

    // 1. Current Month Statement
    arr.push({
      period: `${monthNames[curMonth]} ${curYear}`,
      status: soaStatus,
      net: rentAmount
    });

    // 2. Previous 2 Months (Mocked as Paid for MVP historical view)
    for (let i = 1; i <= 2; i++) {
      let pMonth = curMonth - i;
      let pYear = curYear;
      if (pMonth < 0) {
        pMonth += 12;
        pYear -= 1;
      }
      arr.push({
        period: `${monthNames[pMonth]} ${pYear}`,
        status: 'Paid',
        net: baseTotal > 0 ? baseTotal : (rentAmount || 0) // Fallback UI
      });
    }

    return arr;
  }, [unit, soaStatus, rentAmount]);

  return (
    <div className="space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-1 gap-2">
        <div className="w-full min-w-0">
          <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Dashboard Overview</p>
          {isLoading ? (
            <div className="h-7 sm:h-8 md:h-10 w-48 bg-slate-200 rounded-[var(--radius-md)] animate-pulse mt-1"></div>
          ) : (
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-1 tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
              Welcome back, <span className="text-[var(--color-secondary)] break-words">{tenantName}</span>
            </h1>
          )}
        </div>
      </header>
      
      {/* Hero Card: Amount Due Selector Display (Premium Tech Theme) */}
      <section className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 text-white shadow-xl relative overflow-hidden group border border-[var(--color-border)]">
        <div className="absolute -top-10 -right-10 w-48 sm:w-72 h-48 sm:h-72 bg-[var(--color-primary)]/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none group-hover:bg-[var(--color-primary)]/20 transition-colors duration-500"></div>
        <div className="absolute -bottom-10 -left-10 w-40 sm:w-52 h-40 sm:h-52 bg-[var(--color-primary)]/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col justify-between h-full space-y-5 sm:space-y-6">
          <div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full w-fit backdrop-blur-sm">
              <div className={`w-1.5 h-1.5 sm:w-2 h-2 rounded-full shrink-0 ${getIndicatorColor(soaStatus)}`}></div>
              <p className="text-white/80 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Current Statement Balance</p>
            </div>
            
            {isLoading ? (
              <div className="space-y-3 mt-3 sm:mt-4">
                 <div className="h-8 sm:h-10 md:h-12 bg-white/10 rounded-[var(--radius-md)] w-32 sm:w-40 animate-pulse"></div>
                 <div className="h-3 sm:h-4 bg-white/5 rounded w-48 sm:w-64 animate-pulse mt-2"></div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-3 sm:mt-4 tracking-tight text-white break-all sm:break-normal">
                  ₱{rentAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h2>
                <div className="text-[11px] sm:text-xs md:text-sm text-[white/80] font-medium mt-3 flex items-center gap-2 bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-[var(--radius-md)] backdrop-blur-sm w-fit max-w-full">
                  <Home size={14} className="text-[var(--color-primary)] shrink-0" />
                  <div className="truncate min-w-0">
                    <p className="font-semibold truncate text-[10px] sm:text-[11px] uppercase tracking-widest">
                      {propertyName} · {unitNumber} {soaStatus !== 'Unassigned' && <span className={`font-bold ml-1 text-[var(--color-primary)]`}>· Status: {soaStatus}</span>}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={() => setActiveTab('pay')} 
            disabled={isLoading || soaStatus === 'Unassigned'}
            className="w-full bg-[var(--color-bg)] hover:bg-[var(--color-bg)]/80 disabled:bg-white/10 disabled:text-white/50 disabled:border-transparent text-[var(--color-secondary)] transition-all rounded-[var(--radius-md)] py-3.5 sm:py-4 font-black text-sm md:text-base flex items-center justify-center gap-2 active:scale-[0.99] border border-transparent shadow-[var(--shadow-md)] hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none duration-300"
          >
            {isLoading ? "Checking balance..." : (soaStatus === 'Paid' || soaStatus === 'Unassigned' || rentAmount === 0) ? "All caught up" : "See Statements"} 
            {!isLoading && rentAmount > 0 && <ChevronRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </section>

      {/* Metric Grid: 4 Interactive Columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        
        {/* Card 1: Report Issue */}
        <button onClick={() => setActiveTab('repair')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
            <PenTool size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
          </div>
          <div className="relative z-10 flex flex-col flex-1">
            <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Maintenance</h3>
            <p className="text-sm sm:text-base font-black text-[var(--color-text)] mt-0.5 sm:mt-1 leading-tight">Report Issue</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">Snap a photo request</p>
          </div>
        </button>
        
        {/* Card 2: My Lease */}
        <button onClick={() => setActiveTab('lease')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
            <FileText size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
          </div>
          <div className="relative z-10 flex flex-col flex-1 w-full min-w-0">
            <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Contract</h3>
            <p className="text-sm sm:text-base font-black text-[var(--color-text)] mt-0.5 sm:mt-1 leading-tight">My Lease</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">View active contracts</p>
          </div>
        </button>
        
        {/* Card 3: Financials */}
        <button onClick={() => setActiveTab('pay')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
            <Receipt size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
          </div>
          <div className="relative z-10 flex flex-col flex-1 min-w-0">
            <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Billing</h3>
            <p className="text-sm sm:text-base font-black text-[var(--color-text)] mt-0.5 sm:mt-1 leading-tight">Financials</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">Track your billings</p>
          </div>
        </button>
        
        {/* Card 4: Support */}
        <button onClick={handleConversationClick} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
            <Mail size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
          </div>
          <div className="relative z-10 flex flex-col flex-1">
            <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Messages</h3>
            <p className="text-sm sm:text-base font-black text-[var(--color-text)] mt-0.5 sm:mt-1 leading-tight">Support</p>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">Message manager</p>
          </div>
        </button>
      </div>

      {/* ✨ UPDATED: Recent Statements Section */}
      <section className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]">
        <div className="flex flex-row items-center justify-between mb-4 sm:mb-5 border-b border-[var(--color-border)] pb-3 sm:pb-4 gap-2">
          <div className="min-w-0">
            <h3 className="font-black text-base sm:text-lg text-[var(--color-secondary)] tracking-tight truncate">Recent Statements</h3>
            <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 font-medium hidden sm:block truncate">Overview of recent monthly financial statements</p>
          </div>
          <button 
            onClick={() => setActiveTab('pay')} 
            className="text-[10px] sm:text-xs font-black text-[var(--color-primary)] hover:opacity-80 bg-[var(--color-primary)]/10 px-3 py-2 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-[var(--shadow-sm)] shrink-0 whitespace-nowrap border border-[var(--color-primary)]/20"
          >
            View All
          </button>
        </div>
        
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((skeleton) => (
                <div key={skeleton} className="flex items-center justify-between p-3 sm:p-4 bg-[var(--color-bg)]/50 rounded-[var(--radius-md)] border border-[var(--color-border)] animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 sm:h-4 w-20 sm:w-28 bg-slate-200 rounded"></div>
                    <div className="h-2.5 sm:h-3 w-12 sm:w-16 bg-slate-100 rounded"></div>
                  </div>
                  <div className="h-3 sm:h-4 w-16 sm:w-20 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : recentStatementsArray.length === 0 ? (
            <div className="py-8 sm:py-10 text-center border-2 border-dashed border-[var(--color-border)] rounded-[1.5rem] bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6">
              <div className="p-3 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] text-slate-300 mb-2 sm:mb-3 shadow-[var(--shadow-sm)]">
                <FileText size={20} className="sm:w-6 sm:h-6" />
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text)] font-extrabold">No recent statements</p>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-[240px]">Monthly generated financial statements will appear here.</p>
            </div>
          ) : (
            recentStatementsArray.map((stmt: any, idx: number) => {
              const isSuccess = String(stmt.status).toLowerCase() === 'success' || String(stmt.status).toLowerCase() === 'paid' || String(stmt.status).toLowerCase() === 'remitted';
              return (
                <div 
                  key={idx} 
                  onClick={() => setActiveTab('pay')}
                  className="flex items-center justify-between p-3 sm:p-4 bg-white hover:bg-[var(--color-primary)]/5 border border-[var(--color-border)] rounded-[var(--radius-lg)] transition-all duration-200 cursor-pointer shadow-[var(--shadow-sm)] group gap-2"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] transition-colors shadow-inner shrink-0">
                      <FileText size={16} className="sm:w-[18px] sm:h-[18px] transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-[var(--color-text)] text-xs sm:text-sm group-hover:text-[var(--color-primary)] transition-colors truncate">Statement {stmt.period}</p>
                      <span className={`inline-flex items-center text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 rounded-[var(--radius-sm)] border ${
                        isSuccess 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : stmt.status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {stmt.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                    <span className="font-black text-[var(--color-secondary)] text-sm sm:text-base md:text-lg">₱{stmt.net.toLocaleString()}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5 hidden sm:block" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function TransactionSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--color-bg)]/50 rounded-[var(--radius-lg)] border border-[var(--color-border)] animate-pulse">
      <div className="flex items-center gap-4 w-full">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-slate-200 shrink-0"></div>
        <div className="space-y-2 w-1/2">
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-3 bg-slate-100 rounded w-1/2"></div>
        </div>
      </div>
      <div className="h-4 bg-slate-200 rounded w-16 shrink-0"></div>
    </div>
  );
}

// ✨ NAV SECTION LABEL: Typography with trailing divider
function NavSectionLabel({ children, collapsed }: { children: React.ReactNode, collapsed?: boolean }) {
  if (collapsed) {
    return <div className="h-px bg-white/10 mx-4 my-3 first:mt-1" />;
  }
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-2 first:pt-2 select-none">
      <span className="text-[11px] font-semibold text-slate-400/80 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="h-px bg-white/5 flex-1 mt-0.5"></div>
    </div>
  );
}

// ✨ REFACTORED NAV ITEM: Uses CSS Variables for dynamic active states; supports collapsed tooltip mode
function NavItem({ icon, label, isActive, onClick, badgeCount, collapsed }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, badgeCount?: number, collapsed?: boolean }) {
  return (
    <div className="relative group/navitem">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-3 rounded-[var(--radius-xl)] text-[15px] font-extrabold transition-all duration-300 group overflow-hidden ${
          collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5"
        } ${
          isActive 
            ? "text-[var(--nav-active-text)] shadow-[var(--shadow-sm)]" 
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
        style={{
          backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
          borderLeftWidth: isActive && !collapsed ? 'var(--nav-border-left-width, 0px)' : '0px',
          borderLeftColor: isActive ? 'var(--color-primary)' : 'transparent',
        }}
      >
        <span className={`shrink-0 relative transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
              style={{ color: isActive ? 'var(--nav-active-text)' : 'inherit' }}>
          {icon}
          {collapsed && badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[var(--color-secondary)]"></span>
          )}
        </span>

        {!collapsed && (
          <>
            <span className="truncate whitespace-nowrap flex-1 text-left pr-4">{label}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className={`shrink-0 ml-auto flex items-center justify-center font-black text-[10px] h-5 min-w-[20px] px-1.5 rounded-full shadow-sm animate-in zoom-in-50 duration-200 ${
                isActive ? 'bg-white text-[var(--color-primary)]' : 'bg-red-500 text-white shadow-red-500/10'
              }`}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </>
        )}

        {!collapsed && !isActive && (!badgeCount || badgeCount <= 0) && (
          <ChevronRight size={16} className="shrink-0 absolute right-3 opacity-0 group-hover:opacity-100 transition-all text-slate-500" />
        )}
      </button>

      {/* Tooltip shown only in collapsed (icon-only) mode */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
          {label}
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="ml-1.5 text-red-400">({badgeCount > 99 ? '99+' : badgeCount})</span>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// UPGRADED ACTION CARD COMPONENT WITH DYNAMIC VARIANT THEMES
// -------------------------------------------------------------------------------------------------
function ActionCard({ onClick, icon, title, subtitle, variant }: { onClick: () => void, icon: React.ReactNode, title: string, subtitle: string, variant: 'amber' | 'blue' | 'emerald' | 'purple' }) {
  // Dynamically uses primary colors if desired, but we kept semantic colors per the original logic for variety.
  const themes = {
    amber: {
      bg: 'bg-[var(--color-primary)]/5 group-hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]',
      glow: 'group-hover:shadow-[var(--shadow-md)]',
      text: 'group-hover:text-[var(--color-primary)]'
    },
    blue: {
      bg: 'bg-[var(--color-primary)]/5 group-hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]',
      glow: 'group-hover:shadow-[var(--shadow-md)]',
      text: 'group-hover:text-[var(--color-primary)]'
    },
    emerald: {
      bg: 'bg-[var(--color-primary)]/5 group-hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]',
      glow: 'group-hover:shadow-[var(--shadow-md)]',
      text: 'group-hover:text-[var(--color-primary)]'
    },
    purple: {
      bg: 'bg-[var(--color-primary)]/5 group-hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]',
      glow: 'group-hover:shadow-[var(--shadow-md)]',
      text: 'group-hover:text-[var(--color-primary)]'
    }
  };

  const currentTheme = themes[variant] || themes.blue;

  return (
    <button 
      onClick={onClick} 
      className={`group bg-white flex flex-col p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1.5 transition-all duration-300 ease-out active:scale-[0.96] text-left relative overflow-hidden h-full ${currentTheme.glow}`}
    >
      {/* Background Gradient Hover Light Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[var(--color-primary)]/5 to-[var(--color-primary)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Modern Boxy Rounded Icon with Inner Shadows */}
      <div className={`w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center mb-5 border transition-all duration-300 relative z-10 shrink-0 shadow-inner ${currentTheme.bg}`}>
        {icon}
      </div>
      
      {/* Text Context Stack */}
      <div className="relative z-10 flex flex-col flex-1">
        <h3 className={`font-black text-base text-[var(--color-text)] tracking-tight transition-colors duration-200 ${currentTheme.text}`}>
          {title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-medium leading-normal">
          {subtitle}
        </p>
      </div>

      {/* Slick Arrow Floating Accent Indicator */}
      <div className="absolute bottom-4 right-5 text-slate-300 group-hover:text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
        <ChevronRight size={14} strokeWidth={3} />
      </div>
    </button>
  );
}

function TransactionItem({ title, date, amount }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-white hover:bg-[var(--color-bg)]/50 border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 rounded-[var(--radius-lg)] transition-all duration-200 group shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-[var(--color-primary)]/30 transition-colors shadow-inner">
          <Receipt size={18} className="group-hover:text-[var(--color-primary)] transition-colors" />
        </div>
        <div>
          <p className="font-extrabold text-[var(--color-text)] text-sm group-hover:text-[var(--color-secondary)] transition-colors">{title}</p>
          <p className="text-[11px] md:text-xs text-slate-400 font-semibold mt-0.5">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-black text-[var(--color-text)] md:text-lg">{amount}</span>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );
}

function MobileNavItem({ active, onClick, icon, label, badgeCount }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group ${active ? '' : 'text-slate-500 hover:text-[var(--color-primary)]'}`}
      style={{ color: active ? 'var(--color-primary)' : '' }}
    >
      {/* Active Background Highlight */}
      {active && (
        <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />
      )}
      
      {/* Icon & Label Wrapper with Floating Animation */}
      <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${active ? '-translate-y-1 scale-[1.05]' : ''}`}>
        
        {/* Icon & Badge */}
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          {icon}
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-[var(--color-bg)] shadow-[var(--shadow-sm)] animate-pulse z-20">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </div>

        {/* Text Label */}
        <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">
          {label}
        </span>
      </div>
    </button>
  );
}