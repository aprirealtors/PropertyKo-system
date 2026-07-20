"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { 
  Bell, CheckCircle2, AlertTriangle, LogOut, 
  Home, Wrench, MessageSquare, User, CheckCheck, Trash2, X, ChevronRight
} from "lucide-react";

// Import Modular Tabs
import HomeTab from "./home";
import TasksTab from "./tasks";
import ConversationTab from "./conversation";

export interface MaintenanceTask {
  id: string;
  title: string;
  location: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'failed';
  priority?: string;
  sla?: string;
  isDueToday?: boolean;
  admin_email?: string; 
  created_at?: string; 
  updated_at?: string; 
  photo_url?: string; 
  resolution_photo_url?: string; 
  cost?: number; 
  assigned_to?: string;
}

export default function MaintenanceDashboard() {
  const router = useRouter();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('home');

  // Global Data States
  const [profile, setProfile] = useState({ name: "Staff", initials: "ST" });
  const [userEmail, setUserEmail] = useState<string>(""); 
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & UI States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Notification & Messages States
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  // Metrics
  const [metrics, setMetrics] = useState({ assigned: 0, dueToday: 0, doneThisWeek: 0 });

  useEffect(() => {
    fetchUserDataAndTasks();
  }, []);

  // Fetch Data
  const fetchUserDataAndTasks = async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        router.push('/');
        return;
      }

      setUserEmail(user.email || ""); 

      const adminParentEmail = user.user_metadata?.admin_parent || user.email;
      const { data: orgData } = await supabase
        .from('organizations')
        .select('logo_url')
        .eq('admin_email', adminParentEmail)
        .single();

      if (orgData?.logo_url) setOrgLogo(orgData.logo_url);

      const { data: userData } = await supabase
        .from('team_members')
        .select('name')
        .eq('email', user.email)
        .single();

      if (userData) {
        const nameParts = userData.name.split(" ");
        const initials = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() 
          : userData.name.substring(0, 2).toUpperCase();
        setProfile({ name: userData.name, initials });
      }

      const { data: taskData, error: taskError } = await supabase
        .from('maintenance_tasks')
        .select('*')
        .eq('assigned_to', user.email)
        .order('created_at', { ascending: false });

      if (!taskError && taskData) setTasks(taskData);

      // Fetch Notifications
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient', user.email) 
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (notifData) {
        setNotifications(notifData);
        setUnreadCount(notifData.filter(n => !n.is_read).length);
      }

    } catch (error) {
      console.error("Error loading maintenance dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time Listeners
  useEffect(() => {
    if (!userEmail) return;

    // Fetch Initial Unread Messages Count
    const fetchUnreadMessages = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_email', userEmail)
        .eq('recipient_role', 'maintenance')
        .eq('tenant_email', userEmail);

      if (!error && count !== null) {
        setUnreadMessageCount(count);
      }
    };
    fetchUnreadMessages();

    const tasksChannel = supabase
      .channel('staff-live-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `assigned_to=eq.${userEmail}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((current) => [payload.new as MaintenanceTask, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((current) => {
              const exists = current.find(t => t.id === payload.new.id);
              if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
              return [payload.new as MaintenanceTask, ...current];
            });
          } else if (payload.eventType === 'DELETE') {
            setTasks((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      ).subscribe();

    const notifChannel = supabase
      .channel('staff-live-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${userEmail}` },
        (payload) => {
          setNotifications((current) => [payload.new, ...current]);
          setUnreadCount((count) => count + 1);
        }
      ).subscribe();

    // Realtime Listener for Messages Count Update
    const messagesCountChannel = supabase
      .channel('staff-live-messages-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `tenant_email=eq.${userEmail}` },
        () => {
          fetchUnreadMessages();
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(messagesCountChannel);
    };
  }, [userEmail]);

  // Update Metrics
  useEffect(() => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed');
    const due = activeTasks.filter(t => t.priority === 'Urgent').length;
    const completedThisWeek = tasks.filter(t => {
      if (t.status !== 'completed') return false;
      const taskDate = new Date(t.updated_at || t.created_at || 0);
      return taskDate >= startOfWeek;
    }).length;
    
    setMetrics({ assigned: activeTasks.length, dueToday: due, doneThisWeek: completedThisWeek });
  }, [tasks]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Notification Actions
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
    setActiveTab("tasks"); 
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
        <div className="w-12 h-12 border-4 border-[#359b46]/20 border-t-[#359b46] rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative z-40 border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              <Image src={orgLogo || "/logos.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <div onClick={() => setIsNotifOpen(!isNotifOpen)} className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0b1727] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* Notifications Dropdown */}
          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col text-slate-800">
                <div className="p-3 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0a1e3f] text-sm">Notifications</h3>
                  <div className="flex gap-2 relative z-10">
                    <button onClick={markAllAsRead} className="text-xs text-slate-500 hover:text-[#359b46] flex items-center gap-1 transition-colors"><CheckCheck size={14} /> Read All</button>
                    <button onClick={clearAllNotifications} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"><Trash2 size={14} /> Clear</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto relative z-10">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No new notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-emerald-50/50' : 'opacity-70'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-[#0a1e3f] truncate pr-2">{notif.title}</span>
                          {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[#359b46] shrink-0 mt-1"></span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold text-[#359b46] border border-emerald-500/30 bg-emerald-500/10">Maintenance Staff</span>
          
          <button onClick={() => setShowLogoutModal(true)} className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full">
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PREMIUM DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0b1727] px-4 py-6 hidden md:flex flex-col border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-20">
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} label="Home" />
            
            {/* ✨ UPDATED: Tasks button now receives metrics.assigned as badgeCount */}
            <NavButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} badgeCount={metrics.assigned} icon={<Wrench size={18} strokeWidth={activeTab === 'tasks' ? 2.5 : 2} />} label="My Tasks" />
            
            <NavButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badgeCount={unreadMessageCount} icon={<MessageSquare size={18} strokeWidth={activeTab === 'messages' ? 2.5 : 2} />} label="Messages" />
          </nav>

          {/* Premium Bottom User Tag (Desktop Only) */}
          <div className="mt-auto pt-4 border-t border-white/5">
             <div 
               onClick={() => setIsWorkspaceModalOpen(true)}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-[#359b46] flex items-center justify-center font-bold text-xs border border-emerald-500/30 shrink-0">
                  {profile.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{profile.name}</p>
                  <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">Maintenance</p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 relative">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'home' && (
              <HomeTab 
                profile={profile} 
                metrics={metrics} 
                openProfileModal={() => setIsWorkspaceModalOpen(true)} 
                tasks={tasks} 
                setActiveTab={setActiveTab} 
              />
            )}
            {activeTab === 'tasks' && <TasksTab tasks={tasks} profile={profile} showToast={showToast} fetchTasks={fetchUserDataAndTasks} />}
            {activeTab === 'messages' && <ConversationTab />}
          </div>
        </main>
      </div>

      {/* UPGRADED PREMIUM MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200/50 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1 py-1.5">
          <MobileNavItem active={activeTab === 'home' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('home'); setIsWorkspaceModalOpen(false);}} icon={<Home size={22} />} label="Home" />
          
          {/* ✨ UPDATED: Mobile Tasks button now receives metrics.assigned as badgeCount */}
          <MobileNavItem active={activeTab === 'tasks' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('tasks'); setIsWorkspaceModalOpen(false);}} badgeCount={metrics.assigned} icon={<Wrench size={22} />} label="Tasks" />
          
          <MobileNavItem active={activeTab === 'messages' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('messages'); setIsWorkspaceModalOpen(false);}} badgeCount={unreadMessageCount} icon={<MessageSquare size={22} />} label="Messages" />
          <MobileNavItem active={isWorkspaceModalOpen} onClick={() => setIsWorkspaceModalOpen(true)} icon={<User size={22} />} label="Account" />
        </div>
      </nav>

      {/* MODALS */}
      {/* 1. WORKSPACE PROFILE MODAL */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Staff Profile</h2>
              <button onClick={() => setIsWorkspaceModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto bg-slate-50/50 p-6 space-y-6">
              <div className="bg-gradient-to-r from-[#0b1727] to-[#1e293b] rounded-2xl p-6 text-white flex items-center gap-4 shadow-md">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center font-black text-2xl border border-emerald-500/30 text-[#359b46]">{profile.initials}</div>
                <div>
                  <h3 className="font-extrabold text-lg">{profile.name}</h3>
                  <p className="text-xs text-emerald-300 mt-0.5">Maintenance Department</p>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50">Account Details</h4>
                <div className="space-y-3">
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Full Name</label><p className="text-sm font-semibold text-slate-800">{profile.name}</p></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email Address</label><p className="text-sm font-semibold text-slate-800 break-all">{userEmail}</p></div>
                  <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Access Role</label><span className="inline-block text-[10px] font-semibold text-[#359b46] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded mt-1">Maintenance Staff</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. LOGOUT CONFIRMATION */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1727]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100"><AlertTriangle size={28} /></div>
            <h3 className="text-xl font-bold text-[#0a1e3f] mb-2">Sign out</h3>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={confirmLogout} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm">Log out</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOAST */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${toast.type === "success" ? "border-l-4 border-l-[#359b46] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[#359b46]" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Premium Desktop Nav Button Component w/ Badge
function NavButton({ active, onClick, icon, label, badgeCount }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
        active 
          ? 'bg-white/10 text-white shadow-sm border border-white/5' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="tracking-wide flex-1 text-left">{label}</span>
      
      {/* DESKTOP BADGE */}
      {badgeCount > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      
      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
    </button>
  );
}

// Premium Mobile Nav Button w/ Badge
function MobileNavItem({ active, onClick, icon, label, badgeCount }: any) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300 ${active ? 'text-[#359b46]' : 'text-slate-400 hover:text-slate-600'}`}>
      {active && <span className="absolute inset-0 bg-[#359b46]/10 rounded-xl animate-in zoom-in duration-200" />}
      <div className={`relative z-10 transition-transform duration-300 ${active ? 'scale-110 -translate-y-0.5' : ''}`}>
        {icon}
        {/* MOBILE BADGE */}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>
      <span className="text-[9px] font-bold mt-0.5 relative z-10">{label}</span>
    </button>
  );
}