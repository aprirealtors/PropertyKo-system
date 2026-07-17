"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { 
  Bell, CheckCircle2, AlertTriangle, LogOut, 
  Home, Wrench, MessageSquare, User, CheckCheck, Trash2, X
} from "lucide-react";

// Import Modular Tabs
import HomeTab from "./home";
import TasksTab from "./tasks";
import ConversationTab from "./conversation"; // ✨ UPDATED IMPORT

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

  // Notification States
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

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

  // Real-time Tasks Listener
  useEffect(() => {
    if (!userEmail) return;

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

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(notifChannel);
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
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-500 font-medium">Loading workspace...</div>;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      
      {/* UNIFIED HEADER */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-6 flex-shrink-0 relative z-40">
        <div className="flex items-center gap-3">
          {/* ✨ ALWAYS VISIBLE PROFILE/USER ICON BUTTON */}
          <button 
            onClick={() => setIsWorkspaceModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-full transition-colors border border-white/10 shadow-sm"
            title="User Profile Info"
          >
            <User size={16} />
          </button>

          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              <Image src={orgLogo || "/logos.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-white relative">
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
                    <button onClick={markAllAsRead} className="text-xs text-slate-500 hover:text-[#359b46] flex items-center gap-1"><CheckCheck size={14} /> Read All</button>
                    <button onClick={clearAllNotifications} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"><Trash2 size={14} /> Clear</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto relative z-10">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No new notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${!notif.is_read ? 'bg-emerald-50/50' : 'opacity-70'}`}>
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

          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold text-white border border-[#359b46] bg-[#2c813a]">Maintenance Staff</span>
          <button onClick={() => setShowLogoutModal(true)} className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full">
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0b1727] p-4 hidden md:flex flex-col">
          <nav className="space-y-1 mt-2">
            <button onClick={() => setActiveTab('home')} className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium text-sm ${activeTab === 'home' ? 'bg-[#359b46] text-white shadow-lg' : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'}`}>
              <div className={`transition-transform duration-300 ${activeTab === 'home' ? 'scale-110' : 'scale-100'}`}><Home size={20} /></div>
              <span>Home</span>
              {activeTab === 'home' && <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full hidden md:block" />}
            </button>
            <button onClick={() => setActiveTab('tasks')} className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium text-sm ${activeTab === 'tasks' ? 'bg-[#359b46] text-white shadow-lg' : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'}`}>
              <div className={`transition-transform duration-300 ${activeTab === 'tasks' ? 'scale-110' : 'scale-100'}`}><Wrench size={20} /></div>
              <span>My Tasks</span>
              {activeTab === 'tasks' && <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full hidden md:block" />}
            </button>
            <button onClick={() => setActiveTab('messages')} className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium text-sm ${activeTab === 'messages' ? 'bg-[#359b46] text-white shadow-lg' : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'}`}>
              <div className={`transition-transform duration-300 ${activeTab === 'messages' ? 'scale-110' : 'scale-100'}`}><MessageSquare size={20} /></div>
              <span>Messages</span>
              {activeTab === 'messages' && <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full hidden md:block" />}
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 relative">
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
            {activeTab === 'messages' && <ConversationTab />} {/* ✨ UPDATED RENDER */}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center pt-2 pb-5 z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-full gap-1 ${activeTab === 'home' ? 'text-[#359b46]' : 'text-slate-400 hover:text-slate-600'}`}><Home size={22} /><span className="text-[10px] font-bold">Home</span></button>
        <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center justify-center w-full gap-1 ${activeTab === 'tasks' ? 'text-[#359b46]' : 'text-slate-400 hover:text-slate-600'}`}><Wrench size={22} /><span className="text-[10px] font-bold">Tasks</span></button>
        <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center justify-center w-full gap-1 ${activeTab === 'messages' ? 'text-[#359b46]' : 'text-slate-400 hover:text-slate-600'}`}><MessageSquare size={22} /><span className="text-[10px] font-bold">Messages</span></button>
      </nav>

      {/* MODALS */}
      {/* 1. WORKSPACE PROFILE MODAL */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Staff Profile</h2>
              <button onClick={() => setIsWorkspaceModalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto bg-slate-50/50 p-6 space-y-6">
              <div className="bg-gradient-to-r from-[#0b1727] to-[#1e293b] rounded-2xl p-6 text-white flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl border border-white/20">{profile.initials}</div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={24} /></div>
            <h3 className="text-xl font-bold text-[#0b1727] mb-2">Sign out</h3>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200">Cancel</button>
              <button onClick={confirmLogout} className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm">Log out</button>
            </div>
          </div>
        </div>
      )}

      {/* 3. TOAST */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${toast.type === "success" ? "border-l-4 border-l-[#359b46] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[#359b46]" size={20} /> : <AlertTriangle className="text-red-500" size={20} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}