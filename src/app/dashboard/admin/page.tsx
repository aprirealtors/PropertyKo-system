"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  LayoutDashboard, Box, Home, Wrench, CreditCard, BarChart3, Settings, 
  AlertTriangle, Menu, X, Bell, CheckCheck, Trash2, Ticket,
  Upload, Building, CheckCircle2, User, MessageSquare, ChevronRight, LogOut
} from "lucide-react";

import DashboardTab from "./dashboard";
import PropertiesAndUnitsTab from "./propertiesandunits";
import LeasingAndTenantsTab from "./leasingandtenants";
import ConversationTab from "./conversation";
import MaintenanceTab from "./maintenance";
import BillingTab from "./billing";
import KPIReportsTab from "./kpireports";
import ViewTicketTab from "./viewticket"; 
import TeamTab from "./teamandsubscription";

export default function AdminDashboard() {
  const router = useRouter();
  
  // Navigation & Modal States
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // User Profile Modal State
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [adminProfile, setAdminProfile] = useState({ name: "Admin", email: "" });

  // Workspace Info Modal & White Label States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [orgData, setOrgData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrgData = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email) {
          const userEmail = authData.user.email;

          // Fetch Admin's name from team_members (or fallback to System Admin)
          const { data: teamMember } = await supabase
            .from('team_members')
            .select('name')
            .eq('email', userEmail)
            .single();

          setAdminProfile({
            name: teamMember?.name || "System Admin",
            email: userEmail
          });

          // Fetch Organization Data
          const { data, error } = await supabase.from('organizations').select('*').eq('admin_email', userEmail).single();
          if (data) setOrgData(data);
        }
      } catch (err) {
        console.error("Error fetching org data:", err);
      }
      setIsLoading(false);
    };
    fetchOrgData();
  }, []);

  // ✨ LIVE ASSIGNED TICKETS (OPEN & IN PROGRESS) SIDEBAR COUNTER STATE
  const [activeTicketsCount, setActiveTicketsCount] = useState<number>(0);

  useEffect(() => {
    if (!orgData?.admin_email) return;

    const fetchActiveTicketsCount = async () => {
      try {
        // A. Kunin ang raw tickets data table reference
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('title, location, status')
          .eq('admin_email', orgData.admin_email);

        // B. Kunin ang active maintenance tasks dictionary block para sa status precedence matching
        const { data: tasksData } = await supabase
          .from('maintenance_tasks')
          .select('title, location, status')
          .eq('admin_email', orgData.admin_email);

        if (ticketsData) {
          // ✨ EXACT ADAPTATION FROM VIEWTICKET.TSX FILTERING LOGIC
          const activeCount = ticketsData.filter(ticket => {
            const liveMatch = tasksData?.find(task => task.title === ticket.title && task.location === ticket.location);
            const currentLiveStatus = String(liveMatch ? liveMatch.status : ticket.status).toLowerCase().trim();
            
            // Sinasala lamang ang mga tasks na 'Open & In Progress' base sa exact state paradigm mo
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
        console.error("Sidebar tickets count fetch breakdown:", err);
      }
    };

    fetchActiveTicketsCount();

    // Realtime channel stream trap para mag-sync ang sidebar badge sa bawat database matrix table updates
    const viewTicketChannel = supabase
      .channel('sidebar-live-viewticket-counts')
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

  // ✨ LIVE MAINTENANCE TICKETS INBOX COUNTER STATE
  const [pendingMaintenanceCount, setPendingMaintenanceCount] = useState<number>(0);

  useEffect(() => {
    if (!orgData?.admin_email) return;

    // 1. Kunin ang paunang bilang ng mga 'Open' na tickets sa inbox
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

    // 2. Makinig sa realtime events (INSERT, UPDATE, DELETE) para awtomatikong mag-sync ang badge count
    const maintenanceChannel = supabase
      .channel('sidebar-live-maintenance-counts')
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

  // ✨ LIVE CHAT MESSAGES UNREAD COUNT COUNTER STATE
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  useEffect(() => {
    if (!orgData?.admin_email) return;

    // 1. Kunin ang initial unread messages count para kay admin
    const fetchUnreadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('admin_email', orgData.admin_email)
        .eq('recipient_role', 'admin')
        .eq('is_read', false);

      if (!error && data) {
        setUnreadMessageCount(data.length);
      }
    };
    fetchUnreadMessages();

    // 2. Realtime channel listener para mag-update ang count kapag may pumasok o nabasang chat
    const chatChannel = supabase
      .channel('sidebar-live-chat-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `admin_email=eq.${orgData.admin_email}` },
        () => {
          // Awtomatikong ire-refresh ang count tuwing may pagbabago (bago, update sa read) sa table
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [orgData]);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (orgData?.admin_email) {
        const { data, error } = await supabase.from('notifications').select('*').eq('admin_email', orgData.admin_email)
        .in('recipient', ['ADMIN', 'MANAGER', orgData.admin_email]).eq('is_hidden', false).order('created_at', { ascending: false }).limit(15);
        if (!error && data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.is_read).length);
        }
      }
    };
    fetchNotifications();

    if (orgData?.admin_email) {
      const realtimeChannel = supabase.channel('admin-live-notifications').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            const validRecipients = ['ADMIN', 'MANAGER', orgData.admin_email];
            if (validRecipients.includes(payload.new.recipient)) {
              setNotifications((currentNotifs) => [payload.new, ...currentNotifs]);
              setUnreadCount((currentCount) => currentCount + 1);
            }
          }
        ).subscribe();
      return () => { supabase.removeChannel(realtimeChannel); };
    }
  }, [orgData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
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

  // ✨ FIX: Bagong helper triggers para awtomatikong isara ang mobile menu kapag binuksan ang modals
  const openUserProfileFromSidebar = () => {
    setIsUserProfileModalOpen(true);
    setIsMobileMenuOpen(false); 
  };

  const openWorkspaceFromSidebar = () => {
    setIsWorkspaceModalOpen(true);
    setIsMobileMenuOpen(false); 
  };

  const markAllAsRead = async () => {
    if (!orgData?.admin_email) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('admin_email', orgData.admin_email).in('recipient', ['ADMIN', 'MANAGER', orgData.admin_email]).eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!orgData?.admin_email) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase.from('notifications').update({ is_hidden: true }).eq('admin_email', orgData.admin_email).in('recipient', ['ADMIN', 'MANAGER', orgData.admin_email]); 
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
      handleTabChange("Tickets"); 
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
    
    // Safety first: escape HTML para iwas XSS bago natin lagyan ng design
    let safeText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 1. Highlight Statuses (Gagawing Badge)
    safeText = safeText.replace(/\b(COMPLETED|ON HOLD|RESOLVED|PENDING|IN PROGRESS|SUCCESS|FAILED)\b/g, '<span class="font-black text-[#0a1e3f] bg-slate-200/70 border border-slate-300 px-1.5 py-0.5 rounded text-[9px] tracking-wider ml-0.5 mr-0.5">$1</span>');
    
    // 2. Bold the Name (Pangalan bago ang action words)
    safeText = safeText.replace(/^([a-zA-Z0-9\s]+?)\s(marked|put|requested|created|updated|resolved|submitted|assigned)\b/i, '<strong class="font-extrabold text-[#0a1e3f]">$1</strong> $2');
    
    // 3. Format Remarks / Reason (Gagawing Inner Card)
    safeText = safeText.replace(/(Remarks|Reason|Note|Notes):\s*(.*)/gi, function(match, label, content) {
      return `<div class="mt-2.5 bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-sm">
                <span class="block text-[9px] font-black uppercase tracking-widest text-[#359b46] mb-0.5">${label}</span>
                <span class="block text-xs font-bold text-slate-700 leading-snug break-words">${content}</span>
              </div>`;
    });

    return { __html: safeText };
  };

  return (
    // ✨ LOCKED HEIGHT: 100dvh prevents body scrolling. Overflow hidden keeps it strict.
    <div className="h-[100dvh] w-full bg-[#f8fafc] flex flex-col font-sans overflow-hidden relative">
      
      {/* 🌟 PREMIUM HEADER */}
      <header className="w-full bg-[#0a1e3f] text-white h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 shadow-md">
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="sm:hidden p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <Menu size={22} />
          </button>

          {orgData?.logo_url ? (
            <div className="hidden sm:inline-block bg-white p-1.5 rounded-xl shadow-sm pointer-events-none">
              <div className="relative w-28 h-8 flex items-center justify-center">
                <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 font-black tracking-tight text-white/90">
              <Building size={20} className="text-[#359b46]" /> Organization Logo
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 relative">
          
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)} 
              className="relative flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all group"
            >
              <Bell className={`w-[22px] h-[22px] text-slate-300 group-hover:text-white transition-colors ${unreadCount > 0 ? 'animate-bounce-slow' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0a1e3f] shadow-sm">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            
            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-[90]" onClick={() => setIsNotifOpen(false)} />
                
                <div className="fixed top-[70px] left-4 right-4 sm:absolute sm:top-14 sm:left-auto sm:-right-2 sm:w-96 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] border border-slate-200 z-[100] overflow-hidden flex flex-col text-slate-800 animate-in slide-in-from-top-2 duration-200">
                  <div className="p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100">
                    <h3 className="font-extrabold text-[#0a1e3f] text-sm">Notifications</h3>
                    <div className="flex gap-3 relative z-10">
                      <button onClick={markAllAsRead} className="text-xs font-bold text-slate-500 hover:text-[#359b46] flex items-center gap-1 transition-colors"><CheckCheck size={14} /> Read All</button>
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
                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50/40' : 'opacity-80'}`}>
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className={`font-bold text-sm truncate flex-1 ${!notif.is_read ? 'text-[#0a1e3f]' : 'text-slate-600'}`}>{notif.title}</span>
                            {!notif.is_read && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 mt-1 shadow-sm"></span>}
                          </div>
                          
                          {/* ✨ DITO INAPPLY YUNG FORMATTING NATIN ✨ */}
                          <div 
                            className="text-xs text-slate-500 leading-relaxed mt-1"
                            dangerouslySetInnerHTML={formatNotificationMessage(notif.message)}
                          />

                          <div className="flex justify-between items-center mt-3.5 pt-3 border-t border-slate-100/60">
                            <span className={`text-[9px] font-extrabold px-2 py-1 rounded-md uppercase tracking-wider ${notif.type === 'TICKET' || notif.type === 'MAINTENANCE' ? 'bg-blue-100/80 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>{notif.type}</span>
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
          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold border border-emerald-500/30 text-emerald-50 bg-gradient-to-r from-emerald-600 to-green-700">Admin Portal</span>
          {/* Logout Icon Button */}
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 font-bold transition-all text-xs px-3 py-2 sm:px-4 rounded-xl"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* ✨ ISOLATED OVERFLOW CONTAINER */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Mobile Overlay (Higher z-index to cover header) */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[50] sm:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        
        {/* 🌟 PREMIUM SIDEBAR (Independent Scroll, Fixed on Mobile to reach top) */}
        <aside className={`fixed sm:static inset-y-0 left-0 z-[60] sm:z-10 w-[260px] h-full bg-[#0a1e3f] text-slate-300 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full sm:translate-x-0"}`}>
          
          {/* ✨ ADDED LOGO FOR MOBILE SIDEBAR HEADER */}
          <div className="sm:hidden flex items-center justify-between p-4 border-b border-white/10 shrink-0 min-h-[64px]">
            {orgData?.logo_url ? (
              <div className="relative w-28 h-8 flex items-center bg-white p-1 rounded-lg">
                <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            ) : (
              <span className="font-extrabold text-white text-sm tracking-wide flex items-center gap-2">
                <Building size={18} className="text-[#359b46]" /> Organizational Logo
              </span>
            )}
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
          </div>
          
          {/* Workspace Info Card */}
          <div className="p-4 sm:pt-6 pb-2 shrink-0">
            <div 
              onClick={openWorkspaceFromSidebar}
              className="bg-white/5 rounded-2xl p-4 border border-white/10 shadow-sm cursor-pointer hover:bg-white/10 transition-all duration-300 group"
            >
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">Workspace</div>
                <Building size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <div className="font-black text-white text-[15px] flex items-center gap-2 truncate tracking-tight mb-2" title={orgData?.org_name}>
                {isLoading ? "Loading..." : orgData?.org_name || "Setup Required"} 
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-50 bg-[#359b46] px-2 py-0.5 rounded-md shadow-sm">
                  {isLoading ? "..." : orgData?.plan || "Trial"}
                </span>
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  • {isLoading ? "-" : orgData?.users_count || 1} {orgData?.users_count === 1 ? 'manager' : 'managers'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Navigation Links - Scrollable Container (Invisible Scrollbar) */}
          <nav className="flex-1 overflow-y-auto py-2 space-y-1.5 custom-scrollbar">
            <NavItem icon={<LayoutDashboard size={18} strokeWidth={2.5} />} label="Dashboard" isActive={activeTab === "Dashboard"} onClick={() => handleTabChange("Dashboard")} />
            <NavItem icon={<Box size={18} strokeWidth={2.5} />} label="Properties & units" isActive={activeTab === "Properties"} onClick={() => handleTabChange("Properties")} />
            <NavItem icon={<Home size={18} strokeWidth={2.5} />} label="Leasing & tenants" isActive={activeTab === "Leasing"} onClick={() => handleTabChange("Leasing")} />
            {/* <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "Messages"} onClick={() => handleTabChange("Messages")} /> */}
            <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "Messages"} onClick={() => handleTabChange("Messages")} badgeCount={unreadMessageCount} />

            <NavItem icon={<Wrench size={18} strokeWidth={2.5} />} label="Maintenance & repairs" isActive={activeTab === "Maintenance"} onClick={() => handleTabChange("Maintenance")} badgeCount={pendingMaintenanceCount} />
            <NavItem icon={<CreditCard size={18} strokeWidth={2.5} />} label="Billing & payments" isActive={activeTab === "Billing"} onClick={() => handleTabChange("Billing")} />
            <NavItem icon={<BarChart3 size={18} strokeWidth={2.5} />} label="KPI reports" isActive={activeTab === "KPI"} onClick={() => handleTabChange("KPI")} />
            <NavItem icon={<Ticket size={18} strokeWidth={2.5} />} label="View tickets" isActive={activeTab === "Tickets"} onClick={() => handleTabChange("Tickets")} badgeCount={activeTicketsCount} />
            <div className="pt-4 pb-2">
              <div className="h-px bg-white/10 mx-2"></div>
            </div>
            <NavItem icon={<Settings size={18} strokeWidth={2.5} />} label="Team & settings" isActive={activeTab === "Team"} onClick={() => handleTabChange("Team")} />
          </nav>

          {/* ✨ PROFILE AT FOOTER OF SIDEBAR */}
          <div className="shrink-0 p-4 border-t border-white/5 bg-[#0a1e3f]">
            <button 
              onClick={openUserProfileFromSidebar}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-extrabold text-[13px] text-white shadow-inner group-hover:scale-105 transition-transform uppercase border border-white/5">
                {adminProfile.name.substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{adminProfile.name}</p>
                <p className="text-[10px] text-slate-400 truncate uppercase tracking-wider font-semibold">Admin Profile</p>
              </div>
            </button>
          </div>
        </aside>

        {/* 🌟 MAIN CONTENT AREA (Independent Scroll, Invisible Scrollbar) */}
        <main className="flex-1 h-full bg-[#f8fafc] overflow-y-auto p-4 sm:p-6 lg:p-8 relative custom-scrollbar">
          <div className="mx-auto max-w-7xl flex flex-col min-h-full pb-10">
            {activeTab === "Dashboard" && <DashboardTab orgData={orgData} isLoading={isLoading} onNavigate={handleTabChange} />}
            {activeTab === "Properties" && <PropertiesAndUnitsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Leasing" && <LeasingAndTenantsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Messages" && <ConversationTab orgData={orgData} adminProfile={adminProfile} />}
            {activeTab === "Maintenance" && <MaintenanceTab orgData={orgData} isLoading={isLoading} highlightTicketId={highlightTicketId} />}
            {activeTab === "Billing" && <BillingTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "KPI" && <KPIReportsTab orgData={orgData} isLoading={isLoading} />}
            {activeTab === "Tickets" && <ViewTicketTab orgData={orgData} isLoading={isLoading} highlightTicketId={highlightTicketId} onNavigate={handleTabChange} />}
            {activeTab === "Team" && <TeamTab orgData={orgData} isLoading={isLoading} />}
          </div>
        </main>
      </div>

      {/* 🌟 PREMIUM USER PROFILE MODAL */}
      {isUserProfileModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          {/* ✨ Bottom Sheet sa Mobile (rounded-t), Center Modal sa Desktop (rounded-2xl) */}
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Admin Profile</h2>
              <button 
                onClick={() => setIsUserProfileModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-slate-50/50 p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              {/* Profile Banner Card */}
              <div className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] rounded-[1.5rem] sm:rounded-3xl p-5 sm:p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shadow-[#0a1e3f]/10 shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-white/20 uppercase shadow-inner z-10">
                  {/* ✨ FIX: Kukunin ang unang letra ng bawat salita para sa initials */}
                  {adminProfile.name
                    .split(' ')
                    .map((word: string) => word.charAt(0))
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()}
                </div>
                <div className="z-10 mt-1 min-w-0 w-full px-2">
                  <h3 className="font-extrabold text-lg sm:text-xl tracking-tight truncate">{adminProfile.name}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-blue-200 mt-1 tracking-widest uppercase">System Administrator</p>
                </div>
              </div>

              {/* Account Details Box */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-sm border border-slate-200/60 p-5 sm:p-6 space-y-4 sm:space-y-5">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-3 border-b border-slate-100">
                  Account Details
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5 sm:mb-1">Full Name</label>
                    <p className="text-sm sm:text-[15px] font-extrabold text-[#0a1e3f] tracking-tight break-words">{adminProfile.name}</p>
                  </div>
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                    <p className="text-xs sm:text-sm font-semibold text-slate-600 break-all bg-slate-50 py-2 rounded-xl inline-block border border-slate-100/50 leading-normal">
                      {adminProfile.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Access Role</label>
                    <span className="inline-flex text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shadow-sm">
                      Full Admin Access
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM WORKSPACE MODAL (ORGANIZATION PROFILE) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          {/* ✨ Bottom Sheet sa Mobile, Center Modal sa Desktop */}
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
            
            {/* Modal Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Organization Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Scrollable Content Area */}
            <div className="overflow-y-auto bg-slate-50/50 custom-scrollbar flex-1 pb-8 sm:pb-0">
              
              {/* Header Banner */}
              <div className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] px-5 sm:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-6 relative shrink-0 text-center sm:text-left">
                <div className="absolute top-0 left-0 right-0 h-full overflow-hidden opacity-10 pointer-events-none">
                  <div className="absolute -top-24 -right-10 w-64 sm:w-96 h-64 sm:h-96 bg-white rounded-full blur-3xl"></div>
                </div>

                {/* Logo Container */}
                <div className="relative group w-20 h-20 sm:w-24 sm:h-24 shrink-0 z-10">
                  <div className="w-full h-full rounded-2xl border-[3px] border-white bg-white flex items-center justify-center overflow-hidden relative shadow-md">
                    {orgData?.logo_url ? (
                      <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain p-1.5 sm:p-2" />
                    ) : (
                      <Building className="text-slate-300 w-8 h-8 sm:w-10 sm:h-10" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm">
                      <label className="cursor-pointer text-white flex flex-col items-center gap-1 w-full h-full justify-center">
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
                      <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-blue-200 animate-pulse">Uploading...</p>
                    </div>
                  )}
                </div>
                
                {/* Organization Info */}
                <div className="text-center sm:text-left text-white flex-1 min-w-0 z-10 w-full">
                  <h3 className="text-xl sm:text-2xl font-black mb-1 truncate tracking-tight" title={orgData?.org_name}>
                    {orgData?.org_name || "Organization Name"}
                  </h3>
                  <p className="text-blue-200 text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#359b46] shadow-[0_0_10px_rgba(53,155,70,0.8)] animate-pulse"></span>
                    Active Workspace
                  </p>
                </div>
              </div>

              {/* Data Display Section */}
              <div className="p-4 sm:p-6 md:p-6">
                <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  
                  {/* Section Header */}
                  <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h4 className="text-xs sm:text-sm font-black text-[#0a1e3f] tracking-tight flex items-center gap-2">
                      <Box size={14} className="text-slate-400 sm:w-4 sm:h-4" />
                      Business Details
                    </h4>
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-200/50 px-2.5 py-1 rounded-md">
                      View Only
                    </span>
                  </div>
                  
                  {/* Data Grid */}
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {orgData ? (
                        Object.entries(orgData).map(([key, value]) => {
                          const excludedFields = ['id', 'logo_url', 'password', 'created_at', 'updated_at', 'org_name'];
                          if (excludedFields.includes(key)) return null;

                          const isFullWidth = key.toLowerCase().includes('address') || key.toLowerCase().includes('description');
                          const displayValue = value !== null && value !== '' ? String(value) : "Not provided";

                          return (
                            <div 
                              key={key} 
                              className={`group flex flex-col p-3.5 rounded-xl transition-all duration-300 border border-transparent hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm overflow-hidden ${isFullWidth ? 'sm:col-span-2 bg-slate-50/40 border-slate-100/50' : 'bg-transparent'}`}
                            >
                              <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/30 group-hover:bg-[#359b46] transition-colors duration-300 shrink-0"></span>
                                {formatColumnName(key)}
                              </label>
                              
                              <div className="pl-2.5 border-l-2 border-slate-200 group-hover:border-[#359b46] transition-colors duration-300 overflow-x-auto custom-scrollbar pb-0.5">
                                <p className={`text-xs sm:text-sm font-extrabold ${value ? 'text-[#0a1e3f]' : 'text-slate-400 italic'} whitespace-nowrap w-max pr-4 tracking-tight`}>
                                  {displayValue}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-1 sm:col-span-2 text-center text-slate-400 text-xs py-8">
                          <div className="animate-pulse flex flex-col items-center gap-2.5">
                            <div className="w-6 h-6 border-3 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
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

      {/* 🌟 PREMIUM LOGOUT MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-white/20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <AlertTriangle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 tracking-tight">Confirm Logout</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">Are you sure you want to log out of your admin workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl sm:rounded-2xl transition-all border border-transparent active:scale-[0.96]"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all shadow-lg shadow-red-500/25 active:scale-[0.96]"
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
          className={`fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-8 sm:right-8 z-[120] flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl shadow-2xl font-black text-xs sm:text-sm transition-all transform animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${
            toast.type === "success" ? "border-l-4 border-l-[#359b46] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"
          }`}
        >
          {toast.type === "success" ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="text-[#359b46] w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
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

// ✨ UPDATED NAV ITEM: 1-line enforce (truncate + whitespace-nowrap) & flex-1 to prevent wrap
// function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
// ✨ REFACTORED NAV ITEM: Idinagdag ang optional custom operational badgeCount container trap
function NavItem({ icon, label, isActive, onClick, badgeCount }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, badgeCount?: number }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] text-[15px] font-extrabold transition-all duration-300 group overflow-hidden ${
        isActive 
          ? "bg-gradient-to-r from-[#359b46] to-[#277534] text-white shadow-lg shadow-emerald-900/20 border border-[#359b46]" 
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent"
      }`}
    >
      <span className={`shrink-0 transition-transform duration-300 ${isActive ? "text-white scale-110" : "text-slate-400 group-hover:scale-110 group-hover:text-slate-200"}`}>
        {icon}
      </span>
      <span className="tracking-wide truncate whitespace-nowrap flex-1 text-left">{label}</span>
      
      {/* ✨ DYNAMIC BADGE BADGE COMPONENT TRAP */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className={`shrink-0 ml-auto flex items-center justify-center font-black text-[10px] h-5 min-w-[20px] px-1.5 rounded-full shadow-sm animate-in zoom-in-50 duration-200 ${
          isActive ? 'bg-white text-[#277534]' : 'bg-red-500 text-white shadow-red-500/10'
        }`}>
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      
      {!isActive && (!badgeCount || badgeCount <= 0) && (
        <ChevronRight size={16} className="shrink-0 ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-500" />
      )}
    </button>
  );
}