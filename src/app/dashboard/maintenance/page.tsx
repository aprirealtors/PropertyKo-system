"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Camera, DollarSign, X, CheckCircle, PauseCircle, AlertCircle, AlertTriangle, Clock, MapPin, Wrench } from "lucide-react";

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
  created_at?: string; 
  updated_at?: string; 
  photo_url?: string; 
  resolution_photo_url?: string; 
  cost?: number; 
}

export default function MaintenanceDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({ name: "Staff", initials: "ST" });
  const [userEmail, setUserEmail] = useState<string>(""); 
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    type: 'success', 
    title: '',
    message: ''
  });

  const [completeModalTask, setCompleteModalTask] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState(""); 
  const [onHoldReason, setOnHoldReason] = useState(""); 
  const [customHoldReason, setCustomHoldReason] = useState(""); 
  const [completionRemarks, setCompletionRemarks] = useState(""); 
  const [completionCost, setCompletionCost] = useState("");
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [reviewTask, setReviewTask] = useState<MaintenanceTask | null>(null);

  const [metrics, setMetrics] = useState({
    assigned: 0,
    dueToday: 0,
    doneThisWeek: 0
  });

  useEffect(() => {
    fetchUserDataAndTasks();
  }, []);

  // REAL-TIME LISTENER
  useEffect(() => {
    if (!userEmail) return;

    const tasksChannel = supabase
      .channel('staff-live-tasks')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'maintenance_tasks',
          filter: `assigned_to=eq.${userEmail}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as MaintenanceTask;
            setTasks((current) => [newTask, ...current]);
          } 
          else if (payload.eventType === 'UPDATE') {
            setTasks((current) => {
              const exists = current.find(t => t.id === payload.new.id);
              if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
              return [payload.new as MaintenanceTask, ...current];
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

  // SMART METRICS
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
    
    setMetrics({
      assigned: activeTasks.length,
      dueToday: due, 
      doneThisWeek: completedThisWeek
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

      setUserEmail(user.email || ""); 

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

    } catch (error) {
      console.error("Error loading maintenance dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: MaintenanceTask['status']) => {
    setTasks(currentTasks => 
      currentTasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );

    const { error } = await supabase
      .from('maintenance_tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error("Failed to update task:", error);
      fetchUserDataAndTasks(); 
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
        updated_at: new Date().toISOString()
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

  // KANBAN COLUMNS SETUP & SORTING
  const openTasks = tasks
    .filter(t => t.status === 'pending' || t.status === 'in_progress')
    .sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const onHoldTasks = tasks
    .filter(t => t.status === 'on_hold')
    .sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const resolvedTasks = tasks
    .filter(t => t.status === 'completed');

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
                </div>

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

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setCompleteModalTask(null)} disabled={isCompleting} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isCompleting || !completionStatus} className="flex-1 bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
                    {isCompleting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION REVIEW MODAL FOR MAINTENANCE STAFF */}
      {reviewTask && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2">
                  {reviewTask.title}
                </h2>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mt-1">
                  <MapPin size={14} className="text-slate-400" /> {reviewTask.location}
                </div>
              </div>
              <button onClick={() => setReviewTask(null)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 🔴 BEFORE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Before</span>
                    <span className="text-sm font-bold text-slate-700">Reported Issue</span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center">
                    {reviewTask.photo_url ? (
                      <img src={reviewTask.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Camera size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-sm font-medium">No photo submitted</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      {reviewTask.description}
                    </p>
                    <div className="text-xs text-slate-400 font-medium border-t border-slate-200 pt-3">
                      Submitted on: {new Date(reviewTask.created_at || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* 🟢 AFTER */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">After</span>
                      <span className="text-sm font-bold text-slate-700">My Update</span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-emerald-50 text-[#359b46] border-emerald-100">
                      Resolved
                    </span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center relative">
                    {reviewTask.resolution_photo_url ? (
                      <img src={reviewTask.resolution_photo_url} alt="Resolution" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Wrench size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-sm font-medium">No photo recorded</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Staff</span>
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        👤 {profile.name} (You)
                      </span>
                    </div>
                    
                    {reviewTask.cost !== undefined && reviewTask.cost > 0 && (
                      <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment Cost</span>
                        <span className="text-sm font-black text-[#0a1e3f]">₱{reviewTask.cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
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
          <button onClick={() => setShowLogoutModal(true)} className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full">
            Log out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-12 pt-8">
        <div className="max-w-[1400px] mx-auto px-6">
          
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-[28px] font-extrabold text-[#0a1e3f] tracking-tight leading-tight">My tasks</h2>
              <p className="text-slate-500 mt-1 text-[15px]">Hi {profile.name} - here's your assigned work.</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-lg border border-emerald-100 shadow-sm">
              {profile.initials}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 text-sm font-medium mb-2">Total Assigned</h3>
              <p className="text-3xl font-bold text-[#0a1e3f]">{metrics.assigned}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-6 border border-red-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-red-500"><Clock size={64}/></div>
              <h3 className="text-red-700 text-sm font-medium mb-2">Due today (Urgent)</h3>
              <p className="text-3xl font-bold text-red-700 relative z-10">{metrics.dueToday}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-emerald-500"><CheckCircle size={64}/></div>
              <h3 className="text-slate-500 text-sm font-medium mb-2">Done this week</h3>
              <p className="text-3xl font-bold text-[#0a1e3f] relative z-10">{metrics.doneThisWeek}</p>
            </div>
          </div>

          {/* KANBAN BOARD LAYOUT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: To Do / In Progress */}
            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-4">Open & In Progress <span className="ml-2 bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{openTasks.length}</span></h4>
              <div className="space-y-4">
                {openTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No tasks assigned</div>
                ) : (
                  openTasks.map(task => (
                    <div key={task.id} className={`bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-4 border ${task.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'}`}>
                      <div>
                        {/* Title at In Progress Status pinagtabi */}
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-[#0a1e3f] text-[15px] leading-tight line-clamp-2">{task.title}</h4>
                          {task.status === 'in_progress' && (
                            <span className="bg-blue-100 text-[#1d82f5] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-0.5">
                              In Progress
                            </span>
                          )}
                        </div>
                        
                        {/* Location at Urgent Badge pinagtabi */}
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <p className="text-[#359b46] font-semibold text-xs truncate pr-2">
                            <MapPin size={12} className="inline mr-1 -mt-0.5" />
                            {task.location}
                          </p>
                          {task.priority === 'Urgent' && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                              🚨 URGENT
                            </span>
                          )}
                        </div>
                        
                        <p className="text-slate-500 text-sm mt-2 leading-relaxed line-clamp-3">{task.description}</p>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0 border-t border-slate-100 pt-3">
                        {task.status === 'pending' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm">
                            Start Task
                          </button>
                        ) : (
                          <button onClick={() => openCompleteModal(task.id)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#1d82f5] text-white hover:bg-blue-600 transition-colors shadow-sm">
                            Submit Report
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 2: On Hold */}
            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-4">On Hold <span className="ml-2 bg-purple-100 text-purple-700 px-2 rounded-full text-xs font-bold">{onHoldTasks.length}</span></h4>
              <div className="space-y-4">
                {onHoldTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No tasks on hold</div>
                ) : (
                  onHoldTasks.map(task => (
                    <div key={task.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-4 opacity-80 hover:opacity-100 transition-opacity">
                      <div>
                        {/* Title and On Hold Badge together */}
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-slate-600 text-[15px] leading-tight line-clamp-2">{task.title}</h4>
                          {task.status === 'on_hold' && (
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-0.5">
                              On Hold
                            </span>
                          )}
                        </div>
                        
                        {/* Location and Urgent Badge together */}
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <p className="text-slate-500 font-semibold text-xs truncate pr-2">
                            <MapPin size={12} className="inline mr-1 -mt-0.5" />
                            {task.location}
                          </p>
                          {task.priority === 'Urgent' && (
                            <span className="bg-red-100 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              🚨 URGENT
                            </span>
                          )}
                        </div>
                        
                        <p className="text-slate-500 text-sm mt-2 leading-relaxed line-clamp-3">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 border-t border-slate-200 pt-3">
                        <button onClick={() => openCompleteModal(task.id)} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm">
                          Update Report
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Column 3: Resolved */}
            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-4">Resolved <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 rounded-full text-xs font-bold">{resolvedTasks.length}</span></h4>
              <div className="space-y-4">
                {resolvedTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No resolved tasks</div>
                ) : (
                  resolvedTasks.map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => setReviewTask(task)} 
                      className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col gap-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all"
                    >
                      <div>
                        {/* Title at Success Badge pinagtabi */}
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-[#0a1e3f] text-[15px] line-clamp-2 leading-tight">{task.title}</h4>
                          <span className="bg-emerald-100 text-[#359b46] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shrink-0 mt-0.5">
                            <CheckCircle size={12} /> Success
                          </span>
                        </div>
                        
                        <p className="text-slate-500 font-semibold text-xs mt-1 truncate mb-2">
                          <MapPin size={12} className="inline mr-1 -mt-0.5" />
                          {task.location}
                        </p>
                        
                        <p className="text-slate-500 text-sm mt-2 leading-relaxed line-clamp-2">{task.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}