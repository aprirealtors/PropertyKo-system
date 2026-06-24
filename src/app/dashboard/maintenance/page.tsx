"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface UserProfile {
  name: string;
  initials: string;
}

interface MaintenanceTask {
  id: string;
  title: string;
  location: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  priority?: string;
  sla?: string;
  isDueToday?: boolean;
}

export default function MaintenanceDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({ name: "Staff", initials: "ST" });
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New State for Logout Modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Metrics states
  const [metrics, setMetrics] = useState({
    assigned: 0,
    dueToday: 0,
    doneThisWeek: 0
  });

  // 1. Initial Load
  useEffect(() => {
    fetchUserDataAndTasks();
  }, []);

  // 2. Auto-update metrics whenever tasks change
  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    const due = activeTasks.filter(t => t.isDueToday).length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    
    setMetrics({
      assigned: activeTasks.length,
      dueToday: due, // This will now accurately reflect the auto-assigned tasks
      doneThisWeek: completed
    });
  }, [tasks]);

  const fetchUserDataAndTasks = async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Protect the route: if no user is logged in, kick them to home/login
      if (authError || !user) {
        router.push('/');
        return;
      }

      // Fetch profile details from team_members table
      const { data: userData } = await supabase
        .from('team_members')
        .select('name')
        .eq('email', user.email)
        .single();

      if (userData) {
        const nameParts = userData.name.split(" ");
        
        // ✨ THE INITIALS FIX (Guaranteed to work this time!)
        const initials = nameParts.length > 1 
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase() 
          : userData.name.substring(0, 2).toUpperCase();
        
        setProfile({ name: userData.name, initials });
      }

      // Fetch Tasks assigned to this exact staff member from the live table
      const { data: taskData, error: taskError } = await supabase
        .from('maintenance_tasks')
        .select('*')
        .eq('assigned_to', user.email)
        .order('created_at', { ascending: false });

      if (taskError) {
        console.error("Error fetching tasks:", taskError);
        setTasks([]);
      } else if (taskData) {
        // ✨ AUTO "DUE TODAY" FIX: 
        // We map over the tasks and automatically ensure pending/in_progress tasks are due today
        const formattedTasks = taskData.map(task => ({
          ...task,
          isDueToday: task.status !== 'completed' ? true : task.isDueToday 
        }));
        setTasks(formattedTasks);
      }

    } catch (error) {
      console.error("Error loading maintenance dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: MaintenanceTask['status']) => {
    // Optimistic UI Update: Instantly change it on the screen so it feels fast
    setTasks(currentTasks => 
      currentTasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    // Update the database in the background
    const { error } = await supabase
      .from('maintenance_tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error("Failed to update task:", error);
      // Revert back to true database state if the update failed
      fetchUserDataAndTasks(); 
    }
  };

  const confirmLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center text-slate-500 font-medium">Loading workspace...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-900">
      
      {/* ✨ LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1e3f]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            <h3 className="text-xl font-bold text-[#0a1e3f] mb-2">Sign out</h3>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutModal(false)} 
                className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout} 
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7">
              <Image
                src="/logos.png"
                alt="PropertyKo Logo"
                fill
                className="object-contain object-center"
                priority
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="hidden sm:block px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/20 bg-white/10">
            Maintenance Staff
          </div>
          <button 
            onClick={() => setShowLogoutModal(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-12 pt-8">
        <div className="max-w-4xl mx-auto px-6">
          
          {/* Header Section */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-[28px] font-extrabold text-[#0a1e3f] tracking-tight leading-tight">My tasks for today</h2>
              <p className="text-slate-500 mt-1 text-[15px]">Hi {profile.name} - here's your assigned work.</p>
            </div>
            {/* ✨ GREEN THEME: Initials Avatar */}
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-lg border border-emerald-100 shadow-sm">
              {profile.initials}
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-2">Assigned</h3>
              <p className="text-3xl font-bold text-[#0a1e3f]">{metrics.assigned}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-2">Due today</h3>
              <p className="text-3xl font-bold text-[#0a1e3f]">{metrics.dueToday}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-2">Done this week</h3>
              <p className="text-3xl font-bold text-[#0a1e3f]">{metrics.doneThisWeek}</p>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
                 <p className="text-slate-500 font-medium">You have no tasks assigned right now. Great job!</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  
                  <div>
                    <h4 className="font-bold text-[#0a1e3f] text-[15px]">
                      {task.title} · <span className="font-semibold">{task.location}</span>
                    </h4>
                    <p className="text-slate-500 text-sm mt-1">
                      {task.description} 
                      {task.sla && <span className="font-semibold text-red-500 ml-1">· {task.sla}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <>
                        <button className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                          Call
                        </button>
                        {/* ✨ GREEN THEME: Start Button */}
                        <button 
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm"
                        >
                          Start
                        </button>
                      </>
                    )}

                    {task.status === 'in_progress' && (
                      // ✨ GREEN THEME: Complete Button
                      <button 
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm"
                      >
                        Complete
                      </button>
                    )}

                    {task.status === 'on_hold' && (
                      <span className="px-4 py-1.5 rounded-lg text-[13px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        On hold
                      </span>
                    )}

                    {task.status === 'completed' && (
                      <span className="px-4 py-1.5 rounded-lg text-[13px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Done
                      </span>
                    )}
                  </div>

                </div>
              ))
            )}
          </div>

          {/* ✨ GREEN THEME: Security / Scope Disclaimer */}
          <div className="mt-8 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium border border-emerald-100/50">
            Staff only see tasks assigned to them - no rent, no tenant finances, no other properties.
          </div>

        </div>
      </main>
    </div>
  );
}