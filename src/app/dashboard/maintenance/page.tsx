"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Camera, DollarSign, X, CheckCircle, PauseCircle, AlertCircle, AlertTriangle } from "lucide-react";

interface UserProfile {
  name: string;
  initials: string;
}

interface MaintenanceTask {
  id: string;
  title: string;
  location: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'failed';
  priority?: string;
  sla?: string;
  isDueToday?: boolean;
  admin_email?: string; 
}

export default function MaintenanceDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({ name: "Staff", initials: "ST" });
  const [userEmail, setUserEmail] = useState<string>(""); // ✨ NEW: Para sa real-time filter
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals States
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: ''
  });

  // Task Completion Modal States
  const [completeModalTask, setCompleteModalTask] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState(""); 
  const [onHoldReason, setOnHoldReason] = useState(""); 
  const [customHoldReason, setCustomHoldReason] = useState(""); 
  const [completionRemarks, setCompletionRemarks] = useState(""); 
  const [completionCost, setCompletionCost] = useState("");
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Metrics states
  const [metrics, setMetrics] = useState({
    assigned: 0,
    dueToday: 0,
    doneThisWeek: 0
  });

  useEffect(() => {
    fetchUserDataAndTasks();
  }, []);

  // ✨ NEW: REAL-TIME LISTENER PARA KAY MAINTENANCE STAFF
  useEffect(() => {
    if (!userEmail) return;

    const tasksChannel = supabase
      .channel('staff-live-tasks')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, and DELETE
          schema: 'public',
          table: 'maintenance_tasks',
          filter: `assigned_to=eq.${userEmail}` // Only listen to tasks assigned to THIS specific staff
        },
        (payload) => {
          console.log("Live Task Update for Staff!", payload);
          
          if (payload.eventType === 'INSERT') {
            const newTask = {
              ...payload.new,
              isDueToday: (payload.new.status !== 'completed' && payload.new.status !== 'on_hold') ? true : payload.new.isDueToday 
            } as MaintenanceTask;
            setTasks((current) => [newTask, ...current]);
          } 
          
          else if (payload.eventType === 'UPDATE') {
            setTasks((current) => {
              const exists = current.find(t => t.id === payload.new.id);
              if (exists) {
                return current.map(t => t.id === payload.new.id ? { 
                  ...t, 
                  ...payload.new,
                  isDueToday: (payload.new.status !== 'completed' && payload.new.status !== 'on_hold') ? true : payload.new.isDueToday 
                } : t);
              }
              // If it was just newly assigned to them from another staff
              const updatedTask = {
                ...payload.new,
                isDueToday: (payload.new.status !== 'completed' && payload.new.status !== 'on_hold') ? true : payload.new.isDueToday 
              } as MaintenanceTask;
              return [updatedTask, ...current];
            });
          } 
          
          else if (payload.eventType === 'DELETE') {
            setTasks((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, [userEmail]);

  useEffect(() => {
    const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'failed');
    const due = activeTasks.filter(t => t.isDueToday).length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    
    setMetrics({
      assigned: activeTasks.length,
      dueToday: due, 
      doneThisWeek: completed
    });
  }, [tasks]);

  const fetchUserDataAndTasks = async () => {
    setIsLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        router.push('/');
        return;
      }

      setUserEmail(user.email || ""); // ✨ Store userEmail for the realtime listener

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

      if (taskError) {
        console.error("Error fetching tasks:", taskError);
        setTasks([]);
      } else if (taskData) {
        const formattedTasks = taskData.map(task => ({
          ...task,
          isDueToday: (task.status !== 'completed' && task.status !== 'on_hold') ? true : task.isDueToday 
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
    // Optimistic update
    setTasks(currentTasks => 
      currentTasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    const { error } = await supabase
      .from('maintenance_tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error("Failed to update task:", error);
      fetchUserDataAndTasks(); // Revert on fail
    }
  };

  const openCompleteModal = (taskId: string) => {
    setCompleteModalTask(taskId);
    setCompletionStatus(""); 
    setOnHoldReason(""); 
    setCustomHoldReason(""); 
    setCompletionRemarks("");
    setCompletionCost("");
    setCompletionImage(null);
  };

  const showAlert = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setAlertConfig({ isOpen: true, type, title, message });
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalTask || !completionStatus) return;

    if (completionStatus === "On Hold") {
      if (!onHoldReason) {
        showAlert('warning', 'Missing Information', 'Please select a reason for putting the task on hold.');
        return;
      }
      if (onHoldReason === "Other" && !customHoldReason.trim()) {
        showAlert('warning', 'Specific Reason Needed', 'Please type the specific reason for putting the task on hold.');
        return;
      }
    }

    if (!completionImage) {
      showAlert('warning', 'Photo Required', 'Please upload a photo as proof of work or visit.');
      return;
    }
    
    setIsCompleting(true);

    try {
      const task = tasks.find(t => t.id === completeModalTask);
      if (!task) throw new Error("Task details not found");

      let photoUrl = "";
      
      if (completionImage) {
        const fileExt = completionImage.name.split('.').pop();
        const fileName = `resolved-${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage
          .from('tickets') 
          .upload(`resolved-uploads/${fileName}`, completionImage);

        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);

        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const finalStatus = completionStatus === "Success" ? "completed" : "on_hold";
      const updatePayload: any = {
        status: finalStatus,
        cost: parseFloat(completionCost) || 0,
      };
      if (photoUrl) updatePayload.resolution_photo_url = photoUrl;

      const { error } = await supabase
        .from('maintenance_tasks')
        .update(updatePayload)
        .eq('id', completeModalTask);

      if (error) throw error;

      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*')
        .ilike('title', task.title)
        .ilike('location', task.location)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ticketData) {
        await supabase.from('tickets').update({
          status: completionStatus === "Success" ? "Resolved" : "On Hold", 
        }).eq('id', ticketData.id);
      }

      let notifMessage = `${profile.name} marked this task as COMPLETED. Remarks: ${completionRemarks}`;
      if (completionStatus === "On Hold") {
        const finalReason = onHoldReason === "Other" ? customHoldReason : onHoldReason;
        notifMessage = `${profile.name} put this task ON HOLD. Reason: ${finalReason}.`;
      }

      const notificationsToInsert = [
        {
          admin_email: task.admin_email,
          recipient: 'MANAGER', 
          type: 'MAINTENANCE',
          title: `Task ${completionStatus}: ${task.title}`,
          message: notifMessage,
          reference_id: task.id,
          is_read: false
        }
      ];

      if (ticketData?.reporter_email) {
        notificationsToInsert.push({
          admin_email: task.admin_email,
          recipient: ticketData.reporter_email, 
          type: 'MAINTENANCE',
          title: `Repair Update: ${task.title}`,
          message: `Your repair request was marked as ${completionStatus.toUpperCase()}. ${completionStatus === 'On Hold' ? 'It is currently on hold due to: ' + (onHoldReason === "Other" ? customHoldReason : onHoldReason) : 'It has been resolved!'}`,
          reference_id: task.id,
          is_read: false
        });
      }

      await supabase.from('notifications').insert(notificationsToInsert);

      setCompleteModalTask(null);
      // Removed `await fetchUserDataAndTasks();` here because Realtime handles the UI update automatically!
      
      showAlert('success', 'Report Submitted', 'Your task report was submitted successfully!');

    } catch (err: any) {
      console.error("Error completing task:", err);
      showAlert('error', 'Submission Failed', err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsCompleting(false);
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
      
      {/* UNIVERSAL ALERT MODAL */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center transform transition-all animate-in fade-in zoom-in-95 duration-200">
            
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${
              alertConfig.type === 'success' ? 'bg-emerald-50 text-[#359b46]' :
              alertConfig.type === 'error' ? 'bg-red-50 text-red-500' :
              'bg-amber-50 text-amber-500'
            }`}>
              {alertConfig.type === 'success' && <CheckCircle size={36} />}
              {alertConfig.type === 'error' && <AlertCircle size={36} />}
              {alertConfig.type === 'warning' && <AlertTriangle size={36} />}
            </div>
            
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">{alertConfig.title}</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap">
              {alertConfig.message}
            </p>
            
            <button 
              onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} 
              className={`w-full text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${
                alertConfig.type === 'success' ? 'bg-[#359b46] hover:bg-[#2c813a]' :
                alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600' :
                'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1e3f]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} />
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

      {/* TASK COMPLETION MODAL */}
      {completeModalTask && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col my-8">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Submit Task Report</h2>
              <button onClick={() => !isCompleting && setCompleteModalTask(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isCompleting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCompleteTask} className="space-y-5">
                
                {/* Status Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Repair Result</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${completionStatus === "Success" ? "border-[#359b46] bg-emerald-50 text-[#2c813a]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      <input type="radio" name="status" value="Success" checked={completionStatus === "Success"} onChange={(e) => {setCompletionStatus(e.target.value); setOnHoldReason(""); setCustomHoldReason("");}} className="hidden" />
                      <CheckCircle size={18} className={completionStatus === "Success" ? "text-[#359b46]" : "text-slate-400"} />
                      <span className="font-semibold text-sm">Success</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${completionStatus === "On Hold" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                      <input type="radio" name="status" value="On Hold" checked={completionStatus === "On Hold"} onChange={(e) => setCompletionStatus(e.target.value)} className="hidden" />
                      <PauseCircle size={18} className={completionStatus === "On Hold" ? "text-amber-600" : "text-slate-400"} />
                      <span className="font-semibold text-[13px] leading-tight">On Hold</span>
                    </label>
                  </div>
                  {!completionStatus && (
                    <p className="text-[13px] text-amber-600 font-medium mt-2 animate-pulse">
                      * Please select a repair result to proceed.
                    </p>
                  )}
                </div>

                {/* On Hold Reason Dropdown + Custom Input */}
                {completionStatus === "On Hold" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Reason for holding</label>
                      <select
                        required
                        value={onHoldReason}
                        onChange={(e) => {
                          setOnHoldReason(e.target.value);
                          if (e.target.value !== "Other") setCustomHoldReason(""); 
                        }}
                        className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-amber-900"
                        disabled={isCompleting}
                      >
                        <option value="" disabled>Select reason...</option>
                        <option value="Need Parts">Need Parts</option>
                        <option value="No Access">No Access</option>
                        <option value="Budget Approval">Budget Approval</option>
                        <option value="Other">Other reason...</option>
                      </select>
                    </div>

                    {onHoldReason === "Other" && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Please specify reason</label>
                        <input
                          type="text"
                          required
                          value={customHoldReason}
                          onChange={(e) => setCustomHoldReason(e.target.value)}
                          placeholder="Type the specific reason here..."
                          className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-amber-900 placeholder:text-amber-700/50"
                          disabled={isCompleting}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Remarks / Notes (Only for Success) */}
                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Remarks / Notes</label>
                    <textarea 
                      required
                      value={completionRemarks}
                      onChange={(e) => setCompletionRemarks(e.target.value)}
                      placeholder="Briefly describe what was fixed..."
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a1e3f] focus:border-transparent min-h-[80px]"
                      disabled={isCompleting}
                    />
                  </div>
                )}

                {/* Image Upload Input */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Proof of Work / Visit</label>
                  <label className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-[#359b46] hover:bg-emerald-50 transition-all cursor-pointer bg-slate-50">
                    <Camera size={24} className={completionImage ? "text-[#359b46]" : ""} />
                    <span className={`text-sm ${completionImage ? 'text-[#0a1e3f] font-medium' : 'text-slate-500'}`}>
                      {completionImage ? completionImage.name : "Upload photo (e.g. fixed item or closed door)"}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])}
                      className="hidden" 
                      disabled={isCompleting}
                    />
                  </label>
                </div>

                {/* Cost Input (Only for Success) */}
                {completionStatus === "Success" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Equipment Cost (Optional)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        placeholder="e.g. 500 for parts" 
                        value={completionCost} 
                        onChange={(e) => setCompletionCost(e.target.value)} 
                        className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" 
                        disabled={isCompleting} 
                      />
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="pt-2 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setCompleteModalTask(null)}
                    disabled={isCompleting}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isCompleting || !completionStatus} 
                    className="flex-1 bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    {isCompleting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Global Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7">
              <Image src="/logos.png" alt="PropertyKo Logo" fill className="object-contain object-center" priority />
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
                        <button 
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm"
                        >
                          Start Task
                        </button>
                      </>
                    )}

                    {task.status === 'in_progress' && (
                      <button 
                        onClick={() => openCompleteModal(task.id)}
                        className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm"
                      >
                        Submit Report
                      </button>
                    )}

                    {task.status === 'on_hold' && (
                      <>
                        <span className="hidden sm:flex px-3 py-1.5 rounded-lg text-[13px] font-bold bg-amber-50 text-amber-700 border border-amber-100 items-center gap-1.5">
                          <PauseCircle size={14} /> On Hold
                        </span>
                        <button 
                          onClick={() => openCompleteModal(task.id)}
                          className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm"
                        >
                          Update Report
                        </button>
                      </>
                    )}

                    {task.status === 'completed' && (
                      <span className="px-4 py-1.5 rounded-lg text-[13px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                        <CheckCircle size={14} /> Success
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm font-medium border border-emerald-100/50">
            Staff only see tasks assigned to them - no rent, no tenant finances, no other properties.
          </div>

        </div>
      </main>
    </div>
  );
}