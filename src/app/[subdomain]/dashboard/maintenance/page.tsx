"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { 
  Bell, CheckCircle2, AlertTriangle, LogOut, 
  Home, Wrench, MessageSquare, User, CheckCheck, Trash2, X, ChevronRight, Lock, Key,
  Eye, EyeOff, Edit2, PanelLeft
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Global Data States
  const [profile, setProfile] = useState({ name: "Staff", initials: "ST" });
  const [userEmail, setUserEmail] = useState<string>(""); 
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & UI States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // --- Edit Name States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isConfirmNameModalOpen, setIsConfirmNameModalOpen] = useState(false);

  // Notification & Messages States
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  // Metrics
  const [metrics, setMetrics] = useState({ assigned: 0, dueToday: 0, doneThisWeek: 0 });

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
      } else if (user.user_metadata?.name || user.user_metadata?.full_name) {
        const metaName = user.user_metadata.name || user.user_metadata.full_name;
        const nameParts = metaName.split(" ");
        const initials = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() 
          : metaName.substring(0, 2).toUpperCase();
        setProfile({ name: metaName, initials });
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
    router.push('/login');
  };

  // --- Trigger Modal Instead of Saving Immediately ---
  const handleInitiateNameSave = () => {
    if (!editedName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    
    if (editedName.trim() === profile.name) {
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
        .eq('email', userEmail)
        .select();
        
      if (dbError) throw dbError;

      // 3. Catch Silent RLS Failures
      if (!data || data.length === 0) {
        throw new Error("Update blocked by database permissions (RLS) or email not found.");
      }
      
      const newName = editedName.trim();
      const nameParts = newName.split(" ");
      const initials = nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() 
        : newName.substring(0, 2).toUpperCase();

      setProfile({ name: newName, initials });
      showToast("Staff name updated successfully!", "success");
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Error updating staff name:", err);
      showToast(err.message || "Failed to update staff name.", "error");
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle Password Change
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
        email: userEmail,
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

  if (isLoading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden">
        <header className="h-16 bg-[var(--color-secondary)] flex items-center justify-between px-4 sm:px-6 border-b border-white/5 z-40 shadow-md shrink-0">
          <div className="w-24 sm:w-28 h-8 bg-white/10 rounded-[var(--radius-sm)] animate-pulse"></div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block w-24 h-6 bg-[var(--color-primary)]/20 rounded-[var(--radius-sm)] animate-pulse"></div>
            <div className="w-20 h-8 bg-white/10 rounded-[var(--radius-sm)] animate-pulse"></div>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-[var(--color-secondary)] hidden md:flex flex-col px-4 py-6 border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-20 shrink-0">
            <div className="w-16 h-3 bg-white/10 rounded mb-6 animate-pulse"></div>
            <div className="space-y-3 flex-1">
              {[1, 2, 3].map(i => <div key={i} className="w-full h-11 bg-white/5 rounded-[var(--radius-md)] animate-pulse"></div>)}
            </div>
            <div className="w-full h-[60px] bg-white/5 rounded-[var(--radius-md)] animate-pulse mt-auto"></div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)] font-[family-name:var(--font-corporate)] overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[var(--color-secondary)] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative z-40 border-b border-white/5 shadow-md">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <div 
              onClick={() => setIsLogoModalOpen(true)}
              className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-sm cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-300"
            >
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src={orgLogo} alt="Organization Logo" fill className="object-contain object-center" priority />
              </div>
            </div>
          ) : (
             <div className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-sm">
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src="/logos.png" alt="Organization Logo" fill className="object-contain object-center" priority />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <span className="hidden sm:block px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] sm:text-xs font-extrabold border border-[var(--color-primary)]/30 text-[var(--color-primary-text)] bg-[var(--color-primary)]">Maintenance Portal</span>
          
          <button onClick={() => setShowLogoutModal(true)} className="flex items-center gap-2 text-white/70 hover:text-white hover:bg-white/10 font-bold transition-all text-xs px-3 py-2 sm:px-4 rounded-[var(--radius-sm)]">
            <LogOut size={16} /> <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* ✨ MODERN COLLAPSIBLE DESKTOP SIDEBAR (Edge-to-Edge Profile) */}
        <aside className={`${isSidebarCollapsed ? 'md:w-[84px]' : 'md:w-[260px]'} bg-[var(--color-secondary)] pt-6 hidden md:flex flex-col transition-all duration-300 relative shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-20`}>

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

          {/* Navigation Links - Padding moved here */}
          <nav className={`flex-1 space-y-1 ${isSidebarCollapsed ? "px-2 overflow-visible" : "px-4 overflow-y-auto custom-scrollbar"}`}>
            <NavSectionLabel collapsed={isSidebarCollapsed}>Overview</NavSectionLabel>
            <NavItem icon={<Home size={18} strokeWidth={2.5} />} label="Home" isActive={activeTab === "home"} onClick={() => setActiveTab('home')} collapsed={isSidebarCollapsed} />
            <NavItem icon={<Wrench size={18} strokeWidth={2.5} />} label="My Tasks" isActive={activeTab === "tasks"} onClick={() => setActiveTab('tasks')} badgeCount={metrics.assigned} collapsed={isSidebarCollapsed} />
            <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "messages"} onClick={() => setActiveTab('messages')} badgeCount={unreadMessageCount} collapsed={isSidebarCollapsed} />
          </nav>

          {/* ✨ MATCHED UI: Premium Bottom User Tag (Edge-to-Edge Layout) */}
          <div className="shrink-0 mt-auto border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
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
              className={`w-full flex items-center gap-3.5 py-4 transition-colors hover:bg-white/5 text-left group relative focus:outline-none ${isSidebarCollapsed ? "justify-center px-0" : "px-5"}`}
              title={isSidebarCollapsed ? "View Profile Details" : undefined}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-slate-900 shadow-sm group-hover:scale-105 transition-transform shrink-0" style={{backgroundColor: "var(--color-primary)"}}>
                {profile.initials}
              </div>
              
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 flex flex-col justify-center mt-0.5">
                  <p className="text-[15px] font-extrabold text-white truncate leading-none mb-1.5">{profile.name}</p>
                  <p className="text-[10px] font-bold text-white/50 truncate uppercase tracking-widest leading-none">STAFF PROFILE</p>
                </div>
              )}

              {/* Collapsed Tooltip for Profile */}
              {isSidebarCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
                  {profile.name}
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-28 relative bg-[var(--color-bg)]">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'home' && (
              <HomeTab 
                profile={profile} 
                metrics={metrics} 
                openProfileModal={() => {
                  setIsWorkspaceModalOpen(true);
                  setIsEditingName(false);
                }} 
                tasks={tasks} 
                setActiveTab={setActiveTab} 
                isLoading={isLoading}
              />
            )}
            {activeTab === 'tasks' && <TasksTab tasks={tasks} profile={profile} showToast={showToast} fetchTasks={fetchUserDataAndTasks} />}
            {activeTab === 'messages' && <ConversationTab />}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-[var(--color-border)] pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1 py-1">
          <MobileNavItem active={activeTab === 'home' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('home'); setIsWorkspaceModalOpen(false);}} icon={<Home size={22} />} label="Home" />
          <MobileNavItem active={activeTab === 'tasks' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('tasks'); setIsWorkspaceModalOpen(false);}} badgeCount={metrics.assigned} icon={<Wrench size={22} />} label="Tasks" />
          <MobileNavItem active={activeTab === 'messages' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('messages'); setIsWorkspaceModalOpen(false);}} badgeCount={unreadMessageCount} icon={<MessageSquare size={22} />} label="Messages" />
          <MobileNavItem 
            active={isWorkspaceModalOpen} 
            onClick={() => {
              setIsWorkspaceModalOpen(true); 
              setIsChangingPassword(false);
              setPasswordError(null);
              setIsEditingName(false);
            }} 
            icon={<User size={22} />} 
            label="Account" 
          />
        </div>
      </nav>

      {/* MODALS */}
      {/* 1. WORKSPACE PROFILE MODAL (STAFF PROFILE) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[1.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-[var(--color-border)]">
            
            <div className="px-5 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight">Staff Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-slate-100 rounded-[var(--radius-xl)] text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-[var(--color-bg)]/50 p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              
              {/* Profile Banner */}
              <div className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[var(--radius-xl)] p-5 sm:p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[var(--color-primary)]/20 rounded-full blur-2xl"></div>
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-[var(--color-primary)] uppercase shadow-inner z-10" style={{backgroundColor: "var(--color-primary)", color: "var(--color-primary-text)"}}>
                  {profile.initials}
                </div>
                
                <div className="z-10 mt-1 min-w-0 w-full px-2">
                  <h3 className="font-extrabold text-lg sm:text-xl tracking-tight truncate">{profile.name}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-white/70 mt-1 tracking-widest uppercase">Maintenance Staff</p>
                </div>
              </div>

              {/* Account Details Box */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-xl shadow-sm border border-[var(--color-border)] p-5 space-y-4 sm:space-y-5">
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
                            setEditedName(profile.name);
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
                        {profile.name}
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
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 sm:mb-1">Email Address</label>
                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-semibold text-slate-600 break-all bg-slate-50 py-2 px-3 rounded-xl inline-block border border-[var(--color-border)] leading-normal">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-1">Access Role</label>
                    <span className="inline-flex text-[9px] sm:text-[10px] font-black text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-3 sm:px-2 py-1 sm:py-0.5 rounded-lg sm:rounded-[var(--radius-sm)] tracking-widest uppercase shadow-sm sm:mt-1">
                      Maintenance Staff
                    </span>
                  </div>
                </div>
              </div>

              {/* --- Change Password Box --- */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-xl shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5">
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
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-[var(--radius-md)] border border-red-100 flex items-center gap-2">
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
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm bg-slate-50 focus:bg-white transition-all shadow-[var(--shadow-sm)]" 
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
                        className="flex-1 py-2.5 rounded-[var(--radius-md)] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs border border-transparent shadow-[var(--shadow-sm)]"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingPassword}
                        className="flex-1 py-2.5 rounded-[var(--radius-md)] font-bold text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 transition-colors shadow-[var(--shadow-md)] text-xs flex items-center justify-center gap-2 border border-transparent"
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
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-[var(--color-text)] bg-slate-50 hover:bg-slate-100 rounded-[var(--radius-md)] transition-all border border-[var(--color-border)] active:scale-[0.96] shadow-sm"
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

      {/* 2. LOGOUT CONFIRMATION */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <AlertTriangle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Logout</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">Are you sure you want to log out of your staff workspace?</p>
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

      {/* 3. TOAST */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex items-center gap-3 px-5 py-4 rounded-[var(--radius-xl)] shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-[var(--color-bg)] ${toast.type === "success" ? "border-l-4 border-l-[var(--color-primary)] text-[var(--color-text)]" : "border-l-4 border-l-red-500 text-[var(--color-text)]"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[var(--color-primary)]" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
          {toast.message}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: none; 
          -ms-overflow-style: none; 
        }
        .custom-scrollbar::-webkit-scrollbar { 
          display: none; 
        }
        
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
          .pb-safe { padding-bottom: max(4px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}

// Premium Desktop Nav Button Component w/ Badge
function NavButton({ active, onClick, icon, label, badgeCount }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[var(--radius-md)] text-[15px] font-extrabold transition-all duration-300 group overflow-hidden ${
        active 
          ? "text-[var(--nav-active-text)] shadow-[var(--shadow-sm)]" 
          : "text-white/50 hover:bg-white/5 hover:text-white"
      }`}
      style={{
        backgroundColor: active ? 'var(--nav-active-bg)' : 'transparent',
      }}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}
           style={{ color: active ? 'var(--nav-active-text)' : 'inherit' }}>
        {icon}
      </div>
      <span className="tracking-wide flex-1 text-left">{label}</span>
      
      {badgeCount > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      
      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 rounded-r-full shadow-sm" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)' }} />}
    </button>
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

// Premium Mobile Nav Button w/ Badge
function MobileNavItem({ active, onClick, icon, label, badgeCount }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`relative flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 group ${active ? '' : 'text-slate-600 hover:text-slate-600'}`}
      style={{ color: active ? 'var(--color-primary)' : '' }}
    >
      {active && (
        <span 
          className="absolute inset-1 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" 
          style={{ backgroundColor: 'var(--color-primary)', opacity: 0.1 }} 
        />
      )}
      
      <div className={`relative z-10 transition-transform duration-300 ${active ? 'scale-110 -translate-y-0.5' : ''}`}>
        <span className="relative leading-none flex items-center justify-center w-5 h-5 shrink-0 block">
          {icon}
          
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-black h-[16px] min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-md border-2 border-[var(--color-bg)] animate-pulse z-20">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </span>
      </div>
      
      <span className="text-[8.5px] sm:text-[9px] font-black mt-1 relative z-10 uppercase tracking-tight">
        {label}
      </span>
    </button>
  );
}