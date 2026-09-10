"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  LayoutDashboard, Box, Home, Wrench, CreditCard, BarChart3, Settings, 
  AlertTriangle, Menu, X, Bell, CheckCheck, Trash2, Ticket,
  Upload, Building, CheckCircle2, User, MessageSquare, ChevronRight, LogOut, Users,
  Lock, Key, Eye, EyeOff, Edit2, PanelLeft
} from "lucide-react";

import DashboardTab from "./dashboard";
import PropertiesAndUnitsTab from "./propertiesandunits";
import LeasingAndTenantsTab from "./leasingandtenants";
import ConversationTab from "./conversation"; 
import MaintenanceTab from "./maintenance";
import BillingTab from "./billing";
import KPIReportsTab from "./kpireports";
import ViewTicketTab from "./viewticket";
import UsersTab from "./user"; 

export default function ManagerDashboard() {
  const router = useRouter();
  
  // Navigation & Modal States
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // User Profile Modal State
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [managerProfile, setManagerProfile] = useState({ name: "Manager", email: "" });

  // --- Edit Name States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isConfirmNameModalOpen, setIsConfirmNameModalOpen] = useState(false);

  // Workspace Info Modal & White Label States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Database States for the logged-in Organization
  const [orgData, setOrgData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // MESSAGES STATE
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  // TICKETS & MAINTENANCE HIGHLIGHT STATE
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

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

  // Fetch the logged-in user and their parent organization data
  useEffect(() => {
    const fetchOrgData = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        
        if (authData?.user) {
          const userEmail = authData.user.email || "";
          
          // Fetch Manager's name from team_members
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('name')
            .eq('email', userEmail)
            .single();

          setManagerProfile({
            name: teamMember?.name || "Property Manager",
            email: userEmail
          });

          const adminParentEmail = authData.user.user_metadata?.admin_parent || authData.user.email;

          const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('admin_email', adminParentEmail)
            .single();
            
          if (data) {
            setOrgData(data);
          }
        }
      } catch (err) {
        console.error("Error fetching org data:", err);
      }
      setIsLoading(false);
    };

    fetchOrgData();
  }, []);

  // FETCH NOTIFICATIONS & SETUP REAL-TIME LISTENER
  useEffect(() => {
    const fetchNotifications = async () => {
      if (orgData?.admin_email) {
        const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .eq('recipient', 'MANAGER') 
        .eq('is_hidden', false) 
        .order('created_at', { ascending: false })
        .limit(15);

        if (!error && data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.is_read).length);
        }
      }
    };

    fetchNotifications();

    if (orgData?.admin_email) {
      const realtimeChannel = supabase
        .channel('manager-live-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient=eq.MANAGER` 
          },
          (payload) => {
            if (payload.new.admin_email === orgData.admin_email) {
              setNotifications((currentNotifs) => [payload.new, ...currentNotifs]);
              setUnreadCount((currentCount) => currentCount + 1);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(realtimeChannel);
      };
    }
  }, [orgData]);

  // ✨ LIVE ASSIGNED TICKETS (OPEN & IN PROGRESS) SIDEBAR COUNTER STATE FOR MANAGER
  const [activeTicketsCount, setActiveTicketsCount] = useState<number>(0);

  useEffect(() => {
    if (!orgData?.admin_email) return;

    const fetchActiveTicketsCount = async () => {
      try {
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('title, location, status')
          .eq('admin_email', orgData.admin_email);

        const { data: tasksData } = await supabase
          .from('maintenance_tasks')
          .select('title, location, status')
          .eq('admin_email', orgData.admin_email);

        if (ticketsData) {
          const activeCount = ticketsData.filter(ticket => {
            const liveMatch = tasksData?.find(task => task.title === ticket.title && task.location === ticket.location);
            const currentLiveStatus = String(liveMatch ? liveMatch.status : ticket.status).toLowerCase().trim();
            
            return currentLiveStatus === 'pending' || 
                   currentLiveStatus === 'open' || 
                   currentLiveStatus === 'in_progress' || 
                   currentLiveStatus === 'in progress' || 
                   currentLiveStatus === 'assigned to maintenance' || 
                   currentLiveStatus === 'working';
          }).length;

          setActiveTicketsCount(activeCount);
        }
      } catch (err) {
        console.error("Manager sidebar tickets count fetch breakdown:", err);
      }
    };

    fetchActiveTicketsCount();

    const viewTicketChannel = supabase
      .channel('manager-sidebar-live-viewticket-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${orgData.admin_email}` }, () => {
        fetchActiveTicketsCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${orgData.admin_email}` }, () => {
        fetchActiveTicketsCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(viewTicketChannel);
    };
  }, [orgData]);

  // ✨ LIVE MAINTENANCE TICKETS INBOX COUNTER STATE FOR MANAGER SIDEBAR
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState<number>(0);

  useEffect(() => {
    if (!orgData?.admin_email) return;

    const fetchPendingTickets = async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('admin_email', orgData.admin_email)
        .eq('status', 'Open');

      if (!error && data) {
        setPendingMaintenanceCount(data.length);
      }
    };
    fetchPendingTickets();

    const maintenanceChannel = supabase
      .channel('manager-sidebar-live-maintenance-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${orgData.admin_email}` },
        () => {
          fetchPendingTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(maintenanceChannel);
    };
  }, [orgData]);

  // ✨ LIVE CHAT MESSAGES UNREAD COUNT COUNTER FOR SIDEBAR
  useEffect(() => {
    if (!managerProfile.email || !orgData?.admin_email) return;

    const fetchUnreadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .eq('is_read', false)
        .neq('sender_email', managerProfile.email);

      if (!error && data) {
        const managerUnreadItems = data.filter(m => {
          return m.recipient_role === 'manager' || 
                 (m.tenant_email === managerProfile.email && ['admin', 'maintenance'].includes(m.recipient_role));
        });

        setUnreadMessageCount(managerUnreadItems.length);
      }
    };

    fetchUnreadMessages();

    const messagesChannel = supabase
      .channel('manager-sidebar-permanent-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `admin_email=eq.${orgData.admin_email}`
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [managerProfile.email, orgData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleTabChange = (tabName: string, highlightId: string | null = null) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false); 
    if (highlightId) {
      setHighlightTicketId(highlightId);
    } else if (tabName !== "Tickets" && tabName !== "Maintenance") {
      setHighlightTicketId(null);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); 
  };

  // --- Trigger Modal Instead of Saving Immediately ---
  const handleInitiateNameSave = () => {
    if (!editedName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    
    // Only open the modal if the name actually changed
    if (editedName.trim() === managerProfile.name) {
      setIsEditingName(false);
      return;
    }

    setIsConfirmNameModalOpen(true);
  };

  // --- Actual Save Function called from Modal ---
  const confirmNameSave = async () => {
    setIsConfirmNameModalOpen(false);
    setIsSavingName(true);
    
    try {
      // 1. Update name directly in Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: editedName.trim() }
      });
      if (authError) throw authError;
        
      // 2. Update name in the team_members table
      const { data, error: dbError } = await supabase
        .from('team_members')
        .update({ name: editedName.trim() })
        .eq('email', managerProfile.email)
        .select(); 
        
      if (dbError) throw dbError;

      // 3. Catch Silent RLS Failures
      if (!data || data.length === 0) {
        throw new Error("Update blocked by database permissions (RLS) or email not found.");
      }
      
      setManagerProfile(prev => ({ ...prev, name: editedName.trim() }));
      showToast("Manager name updated successfully!", "success");
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Error updating manager name:", err);
      showToast(err.message || "Failed to update manager name.", "error");
    } finally {
      setIsSavingName(false);
    }
  };

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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: managerProfile.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      showToast("Password updated successfully!", "success");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orgData?.id) return;

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${orgData.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);
      const newLogoUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: newLogoUrl })
        .eq('id', orgData.id);

      if (updateError) throw updateError;

      setOrgData((prev: any) => ({ ...prev, logo_url: newLogoUrl }));
      showToast("Logo updated successfully!", "success");
    } catch (error) {
      console.error("Error uploading logo:", error);
      showToast("Failed to upload logo. Please try again.", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const openUserProfileFromSidebar = () => {
    setIsUserProfileModalOpen(true);
    setIsMobileMenuOpen(false); 
    setIsChangingPassword(false);
    setPasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsEditingName(false);
  };

  const openWorkspaceFromSidebar = () => {
    setIsWorkspaceModalOpen(true);
    setIsMobileMenuOpen(false); 
  };

  const markAllAsRead = async () => {
    if (!orgData?.admin_email) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('admin_email', orgData.admin_email)
    .eq('recipient', 'MANAGER') 
    .eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!orgData?.admin_email) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase
    .from('notifications')
    .update({ is_hidden: true }) 
    .eq('admin_email', orgData.admin_email)
    .eq('recipient', 'MANAGER');
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    setIsNotifOpen(false);

    const type = notif.type?.toUpperCase() || '';
    if (type === 'BILLING' || type === 'SOA') handleTabChange("Billing");
    else if (type === 'TICKET' || type === 'MAINTENANCE') {
      if (notif.reference_id) setHighlightTicketId(`${notif.reference_id}_${Date.now()}`);
      handleTabChange("Maintenance"); 
    } else handleTabChange("Dashboard");
  };

  const formatColumnName = (key: string) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatNotificationMessage = (text: string) => {
    if (!text) return { __html: "" };
    
    let safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    safeText = safeText.replace(/\b(COMPLETED|ON HOLD|RESOLVED|PENDING|IN PROGRESS|SUCCESS|FAILED)\b/g, '<span class="font-black text-[var(--color-secondary)] bg-slate-200/70 border border-slate-300 px-1.5 py-0.5 rounded text-[9px] tracking-wider ml-0.5 mr-0.5">$1</span>');
    
    safeText = safeText.replace(/^([a-zA-Z0-9\s]+?)\s(marked|put|requested|created|updated|resolved|submitted|assigned)\b/i, '<strong class="font-extrabold text-[var(--color-secondary)]">$1</strong> $2');
    
    safeText = safeText.replace(/(Remarks|Reason|Note|Notes):\s*(.*)/gi, function(match, label, content) {
      return `<div class="mt-2.5 bg-white border border-[var(--color-border)] rounded-xl p-2.5 shadow-[var(--shadow-sm)]">
                <span class="block text-[9px] font-black uppercase tracking-widest text-[var(--color-primary)] mb-0.5">${label}</span>
                <span class="block text-xs font-bold text-slate-700 leading-snug break-words">${content}</span>
              </div>`;
    });

    return { __html: safeText };
  };

  return (
    <div className="h-[100dvh] w-full bg-[var(--color-bg)] flex flex-col font-[family-name:var(--font-corporate)] overflow-hidden relative">
      
      {/* 🌟 PREMIUM HEADER */}
      <header className="w-full bg-[var(--color-secondary)] text-white h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 relative shadow-md">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="sm:hidden p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <Menu size={22} />
          </button>

          {orgData?.logo_url ? (
            <div className="hidden sm:inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-sm pointer-events-none">
              <div className="relative w-28 h-8 flex items-center justify-center">
                <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 font-black tracking-tight text-white/90">
              <Building size={20} className="text-[var(--color-primary)]" /> Organization Logo
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 relative">
          
          <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="relative flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all group"
            >
              <Bell className={`w-[22px] h-[22px] text-slate-300 group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-bounce-slow' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[var(--color-secondary)] shadow-[var(--shadow-sm)]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            
            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setIsNotifOpen(false)} />
                
                <div className="fixed top-[70px] left-4 right-4 sm:absolute sm:top-14 sm:left-auto sm:-right-2 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-200 z-[100] overflow-hidden flex flex-col text-[var(--color-text)] animate-in slide-in-from-top-2 duration-200">
                  <div className="p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100">
                    <h3 className="font-extrabold text-[var(--color-secondary)] text-sm">Notifications</h3>
                    <div className="flex gap-3 relative z-10">
                      <button onClick={markAllAsRead} className="text-xs font-bold text-slate-500 hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors"><CheckCheck size={14} /> Read All</button>
                      <button onClick={clearAllNotifications} className="text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"><Trash2 size={14} /> Clear</button>
                    </div>
                  </div>
                  
                  <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto relative z-10 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Bell size={32} className="opacity-20" />
                        <span className="text-sm font-semibold">No new notifications</span>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${!notif.is_read ? 'bg-[var(--color-primary)]/5' : 'opacity-80'}`}>
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className={`font-bold text-sm truncate flex-1 ${!notif.is_read ? 'text-[var(--color-secondary)]' : 'text-slate-600'}`}>{notif.title}</span>
                            {!notif.is_read && <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)] shrink-0 mt-1 shadow-sm"></span>}
                          </div>
                          
                          <div 
                            className="text-xs text-slate-500 leading-relaxed mt-1"
                            dangerouslySetInnerHTML={formatNotificationMessage(notif.message)}
                          />

                          <div className="flex justify-between items-center mt-3.5 pt-3 border-t border-slate-100/60">
                            <span className={`text-[9px] font-extrabold px-2 py-1 rounded-[var(--radius-sm)] uppercase tracking-wider ${notif.type === 'TICKET' || notif.type === 'MAINTENANCE' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{notif.type}</span>
                            <span className="text-[10px] font-semibold text-slate-400">{new Date(notif.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <span className="hidden sm:block px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] sm:text-xs font-semibold border border-[var(--color-primary)]/30 text-[var(--color-primary-text)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/80">Manager Portal</span>

          {/* Logout Icon Button */}
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 font-bold transition-all text-xs px-3 py-2 sm:px-4 rounded-[var(--radius-sm)]"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-sm z-[50] sm:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        
        {/* 🌟 MODERN COLLAPSIBLE SIDEBAR */}
        <aside 
          className={`fixed sm:relative inset-y-0 left-0 z-[60] sm:z-10 ${isSidebarCollapsed ? "sm:w-[84px]" : "sm:w-[260px]"} w-[260px] h-full bg-[var(--color-secondary)] text-slate-300 flex flex-col shrink-0 transition-all duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full sm:translate-x-0"}`}
        >
          {/* Collapse / expand toggle — desktop only, floats on the sidebar's edge */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden sm:flex absolute top-[72px] -right-3 w-6 h-6 rounded-full bg-white border border-[var(--color-border)] shadow-md items-center justify-center z-20 text-slate-500 hover:text-[var(--color-primary)] hover:scale-110 hover:shadow-lg transition-all duration-200 group"
          >
            <PanelLeft size={13} strokeWidth={2.5} className={`transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
              {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>

          <div className="sm:hidden flex items-center justify-between p-4 border-b border-white/10 shrink-0 min-h-[64px]">
            {orgData?.logo_url ? (
              <div className="relative w-28 h-8 flex items-center bg-white p-1 rounded-lg">
                <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            ) : (
              <span className="font-extrabold text-white text-sm tracking-wide flex items-center gap-2">
                <Building size={18} className="text-[var(--color-primary)]" /> Organizational Logo
              </span>
            )}
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          
          {/* Workspace card */}
          <div className="p-2 sm:pt-4 pb-2 shrink-0">
            <div 
              onClick={openWorkspaceFromSidebar}
              className={`bg-white/5 rounded-2xl border border-white/10 shadow-[var(--shadow-sm)] cursor-pointer hover:bg-white/10 transition-all duration-300 group relative ${isSidebarCollapsed ? "p-0 flex justify-center py-2.5" : "p-4"}`}
            >
              {isSidebarCollapsed ? (
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <Building size={16} className="text-[var(--color-primary)]" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--color-secondary)]"></span>
                  <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-5 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
                    {isLoading ? "Loading..." : orgData?.org_name || "Workspace"}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-bold text-slate-400 tracking-wide">Workspace</div>
                    <Building size={14} className="text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  <div className="font-black text-white text-[15px] flex items-center gap-2 truncate tracking-tight mb-2" title={orgData?.org_name}>
                    {isLoading ? "Loading..." : orgData?.org_name || "Setup required"} 
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--color-primary-text)] bg-[var(--color-primary)] px-2 py-0.5 rounded-md shadow-sm">
                      Manager access
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <nav className={`flex-1 py-2 space-y-1 px-2 ${isSidebarCollapsed ? "overflow-visible" : "overflow-y-auto custom-scrollbar"}`}>
            <NavSectionLabel collapsed={isSidebarCollapsed}>Overview</NavSectionLabel>
            <NavItem icon={<LayoutDashboard size={18} strokeWidth={2.5} />} label="Dashboard" isActive={activeTab === "Dashboard"} onClick={() => handleTabChange("Dashboard")} collapsed={isSidebarCollapsed} />

            <NavSectionLabel collapsed={isSidebarCollapsed}>Properties</NavSectionLabel>
            <NavItem icon={<Box size={18} strokeWidth={2.5} />} label="Properties & Units" isActive={activeTab === "Properties"} onClick={() => handleTabChange("Properties")} collapsed={isSidebarCollapsed} />
            <NavItem icon={<Home size={18} strokeWidth={2.5} />} label="Leasing & Tenants" isActive={activeTab === "Leasing"} onClick={() => handleTabChange("Leasing")} collapsed={isSidebarCollapsed} />

            <NavSectionLabel collapsed={isSidebarCollapsed}>Operations</NavSectionLabel>
            <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "Messages"} onClick={() => handleTabChange("Messages")} badgeCount={unreadMessageCount} collapsed={isSidebarCollapsed} />
            <NavItem icon={<Wrench size={18} strokeWidth={2.5} />} label="Maintenance" isActive={activeTab === "Maintenance"} onClick={() => handleTabChange("Maintenance")} badgeCount={pendingMaintenanceCount} collapsed={isSidebarCollapsed} />

            <NavSectionLabel collapsed={isSidebarCollapsed}>Finance</NavSectionLabel>
            <NavItem icon={<CreditCard size={18} strokeWidth={2.5} />} label="Billing & Payments" isActive={activeTab === "Billing"} onClick={() => handleTabChange("Billing")} collapsed={isSidebarCollapsed} />
            <NavItem icon={<BarChart3 size={18} strokeWidth={2.5} />} label="KPI Reports" isActive={activeTab === "KPI"} onClick={() => handleTabChange("KPI")} collapsed={isSidebarCollapsed} />

            <div className="pt-3 pb-2">
              <div className="h-px bg-white/10 mx-2"></div>
            </div>
            <NavItem icon={<Users size={18} strokeWidth={2.5} />} label="Accounts" isActive={activeTab === "Users"} onClick={() => handleTabChange("Users")} collapsed={isSidebarCollapsed} />
          </nav>

          <div className="shrink-0 p-3 border-t border-white/5 bg-[var(--color-secondary)]">
            <button 
              onClick={openUserProfileFromSidebar}
              className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 text-left group relative ${isSidebarCollapsed ? "justify-center" : ""}`}
            >
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-extrabold text-[13px] text-[var(--color-primary-text)] shadow-inner group-hover:scale-105 transition-transform uppercase border border-white/5 shrink-0" style={{backgroundColor: "var(--color-primary)"}}>
                {managerProfile.name
                .split(' ')
                .map((word: string) => word.charAt(0))
                .join('')
                .substring(0, 2)
                .toUpperCase()}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{managerProfile.name}</p>
                  <p className="text-[10px] text-slate-400 truncate font-semibold">Manager profile</p>
                </div>
              )}
              {isSidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
                  {managerProfile.name}
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* 🌟 MAIN CONTENT AREA */}
        <main className="flex-1 h-full bg-[var(--color-bg)] overflow-y-auto p-4 sm:p-6 lg:p-8 relative custom-scrollbar">
          <div className="mx-auto max-w-7xl flex flex-col min-h-full pb-10">
            {activeTab === "Dashboard" && <DashboardTab orgData={orgData} isLoading={isLoading} onNavigate={handleTabChange} />}
            {activeTab === "Properties" && <PropertiesAndUnitsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Leasing" && <LeasingAndTenantsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Messages" && <ConversationTab orgData={orgData} managerProfile={managerProfile} />}
            {activeTab === "Maintenance" && <MaintenanceTab orgData={orgData} isLoading={isLoading} highlightTicketId={highlightTicketId} />}
            {activeTab === "Billing" && <BillingTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "KPI" && <KPIReportsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Users" && <UsersTab orgData={orgData} isLoading={isLoading} />}
          </div>
        </main>
      </div>

      {/* 🌟 PREMIUM USER PROFILE MODAL */}
      {isUserProfileModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[1.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-[var(--color-border)]">
            
            <div className="px-5 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight">Manager Profile</h2>
              <button 
                onClick={() => setIsUserProfileModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-slate-100 rounded-[var(--radius-xl)] text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-[var(--color-bg)]/50 p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              <div className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[var(--radius-xl)] p-5 sm:p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-2xl"></div>
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-[var(--color-primary)] uppercase shadow-inner z-10" style={{backgroundColor: "var(--color-primary)", color: "var(--color-primary-text)"}}>
                  {managerProfile.name
                    .split(' ')
                    .map((word: string) => word.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="z-10 mt-1 min-w-0 w-full px-2">
                  <h3 className="font-extrabold text-lg sm:text-xl tracking-tight truncate">{managerProfile.name}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-white/70 mt-1 tracking-widest uppercase">Property Manager</p>
                </div>
              </div>

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
                            setEditedName(managerProfile.name);
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
                        {managerProfile.name}
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
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 break-all bg-slate-50 py-2 px-3 rounded-xl inline-block border border-[var(--color-border)] leading-normal">
                      {managerProfile.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Access Role</label>
                    <span className="inline-flex text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-3 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
                      Manager Access
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
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
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-100 flex items-center gap-2">
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
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                        className="flex-1 py-3 rounded-[var(--radius-md)] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs shadow-[var(--shadow-sm)] active:scale-95 border border-transparent"
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

      {/* 🌟 PREMIUM WORKSPACE MODAL (ORGANIZATION PROFILE) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-[var(--color-border)]">
            
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight">Organization Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-[var(--color-primary)]/10 rounded-[var(--radius-sm)] text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-[var(--color-bg)] custom-scrollbar flex-1 pb-8 sm:pb-0">
              
              <div className="bg-[var(--color-secondary)] px-5 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 relative shrink-0 text-center sm:text-left">
                <div className="absolute top-0 left-0 right-0 h-full overflow-hidden opacity-10 pointer-events-none">
                  <div className="absolute -top-24 -right-10 w-64 sm:w-96 h-64 sm:h-96 bg-[var(--color-primary)] rounded-full blur-3xl"></div>
                </div>

                <div className="relative group w-20 h-20 sm:w-24 sm:h-24 shrink-0 z-10">
                  <div className="w-full h-full rounded-[var(--radius-lg)] border-[3px] border-[var(--color-primary)]/30 bg-white flex items-center justify-center overflow-hidden relative shadow-[var(--shadow-md)]">
                    {orgData?.logo_url ? (
                      <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain p-1.5 sm:p-2" />
                    ) : (
                      <Building className="text-[var(--color-primary)] w-8 h-8 sm:w-10 sm:h-10" />
                    )}
                    
                    <div className="absolute inset-0 bg-[var(--color-secondary)]/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm">
                      <label className="cursor-pointer text-[var(--color-primary-text)] flex flex-col items-center gap-1 w-full h-full justify-center">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-center leading-tight">Change<br/>Logo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleLogoUpload} 
                          disabled={isUploadingLogo} 
                        />
                      </label>
                    </div>
                  </div>
                  {isUploadingLogo && (
                    <div className="absolute -bottom-5 left-0 right-0 text-center">
                      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-[var(--color-primary)] animate-pulse">Uploading...</p>
                    </div>
                  )}
                </div>
                
                <div className="text-center sm:text-left text-white flex-1 min-w-0 z-10 w-full">
                  <h3 className="text-xl sm:text-2xl font-black mb-1 truncate tracking-tight" title={orgData?.org_name}>
                    {orgData?.org_name || "Organization Name"}
                  </h3>
                  <p className="text-[var(--color-primary)]/80 text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shadow-[0_0_10px_var(--color-primary)] animate-pulse"></span>
                    Active Workspace
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-6">
                <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-[var(--shadow-sm)] border border-[var(--color-border)] overflow-hidden">
                  
                  <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-slate-50/50">
                    <h4 className="text-xs sm:text-sm font-black text-[var(--color-text)] tracking-tight flex items-center gap-2">
                      <Box size={14} className="text-[var(--color-primary)] sm:w-4 sm:h-4" />
                      Business Details
                    </h4>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2.5 py-1 rounded-md">
                      View Only
                    </span>
                  </div>
                  
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {orgData ? (
                        Object.entries(orgData).map(([key, value]) => {
                          const excludedFields = ['id', 'logo_url', 'password', 'created_at', 'updated_at', 'org_name', 'theme_colors', 'theme_preset', 'theme_config', 'master_theme'];
                          if (excludedFields.includes(key)) return null;

                          const isFullWidth = key.toLowerCase().includes('address') || key.toLowerCase().includes('description');
                          const displayValue = value !== null && value !== '' ? String(value) : "Not provided";

                          return (
                            <div 
                              key={key} 
                              className={`group flex flex-col p-3.5 rounded-[var(--radius-md)] transition-all duration-300 border border-transparent hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5 hover:shadow-sm overflow-hidden ${isFullWidth ? 'sm:col-span-2 bg-slate-50/40 border-[var(--color-border)]/50' : 'bg-transparent'}`}
                            >
                              <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]/30 group-hover:bg-[var(--color-primary)] transition-colors duration-300 shrink-0"></span>
                                {formatColumnName(key)}
                              </label>
                              
                              <div className="pl-2.5 border-l-2 border-slate-200 group-hover:border-[var(--color-primary)] transition-colors duration-300 overflow-x-auto custom-scrollbar pb-0.5">
                                <p className={`text-xs sm:text-sm font-extrabold ${value ? 'text-[var(--color-text)]' : 'text-slate-400 italic'} whitespace-nowrap w-max pr-4 tracking-tight`}>
                                  {displayValue}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-1 sm:col-span-2 text-center text-slate-400 text-xs py-8">
                          <div className="animate-pulse flex flex-col items-center gap-2.5">
                            <div className="w-6 h-6 border-3 border-slate-200 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                            <span className="font-bold uppercase tracking-wider">Loading details...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM CONFIRM NAME CHANGE MODAL */}
      {isConfirmNameModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
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
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <AlertTriangle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Logout</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">Are you sure you want to log out of your manager workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-all border border-transparent active:scale-[0.96]"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-black transition-all shadow-lg shadow-red-500/25 active:scale-[0.96]"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM TOAST */}
      {toast && (
        <div 
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-8 sm:right-8 z-[120] flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-[var(--radius-xl)] shadow-2xl font-black text-xs sm:text-sm transition-all transform animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${
            toast.type === "success" ? "border-l-4 border-l-[var(--color-primary)] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"
          }`}
        >
          {toast.type === "success" ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-[var(--color-primary)] w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-red-500 w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
            </div>
          )}
          <span className="truncate flex-1">{toast.message}</span>
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
      `}} />
    </div>
  );
}

// ✨ NAV SECTION LABEL: A quiet grouping label above each nav cluster; collapses to a hairline divider
function NavSectionLabel({ children, collapsed }: { children: React.ReactNode, collapsed?: boolean }) {
  if (collapsed) {
    return <div className="h-px bg-white/10 mx-3 my-2.5 first:mt-0" />;
  }
  return (
    <div className="px-4 pt-4 pb-1.5 text-[10px] font-bold text-slate-500 tracking-wide first:pt-1">
      {children}
    </div>
  );
}

// ✨ REFACTORED NAV ITEM: Uses CSS Variables for dynamic active states; supports a collapsed, icon-only mode with a hover tooltip
function NavItem({ icon, label, isActive, onClick, badgeCount, collapsed }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, badgeCount?: number, collapsed?: boolean }) {
  return (
    <div className="relative group/navitem">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-3 rounded-[var(--radius-md)] text-[13.5px] font-extrabold transition-all duration-300 group overflow-hidden ${
          collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5"
        } ${
          isActive 
            ? "text-[var(--nav-active-text)] shadow-[var(--shadow-sm)]" 
            : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`}
        style={{
          backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
          borderLeftWidth: isActive && !collapsed ? 'var(--nav-border-left-width)' : '0px',
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