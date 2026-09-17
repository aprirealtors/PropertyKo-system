"use client";

import React, { useState } from "react";
import { MapPin, X, CheckCircle, PauseCircle, Camera, PhilippinePesoIcon, AlertCircle, AlertTriangle, Wrench, Clock, Activity, Info, Inbox, Trash2, CheckCircle2, ChevronRight, User, Check } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

export default function TasksTab({ tasks, profile, showToast, fetchTasks, isLoading = false }: any) {
  const [completeModalTask, setCompleteModalTask] = useState<string | null>(null);
  const [completionStatus, setCompletionStatus] = useState(""); 
  const [onHoldReason, setOnHoldReason] = useState(""); 
  const [customHoldReason, setCustomHoldReason] = useState(""); 
  const [completionRemarks, setCompletionRemarks] = useState(""); 
  const [completionCost, setCompletionCost] = useState("");
  const [completionImage, setCompletionImage] = useState<File | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // ✨ Tab Switcher State (Para sa Mobile View na lang)
  const [activeView, setActiveView] = useState<'open' | 'on_hold' | 'resolved'>('open');

  // ✨ MODAL STATES
  const [reviewActiveTask, setReviewActiveTask] = useState<any | null>(null);
  const [reviewOnHoldTask, setReviewOnHoldTask] = useState<any | null>(null);
  const [reviewResolvedTask, setReviewResolvedTask] = useState<any | null>(null);

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '' });

  const showAlert = (type: any, title: string, message: string) => {
    setAlertConfig({ isOpen: true, type, title, message });
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from('maintenance_tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) {
      showToast("Failed to update status", "error");
      fetchTasks();
    } else {
      showToast(`Task marked as ${newStatus.replace('_', ' ')}!`, "success");
    }
  };

  const openCompleteModal = (taskId: string) => {
    setCompleteModalTask(taskId);
    setCompletionStatus(""); setOnHoldReason(""); setCustomHoldReason(""); 
    setCompletionRemarks(""); setCompletionCost(""); setCompletionImage(null);
  };

  const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalTask || !completionStatus) return;

    if (completionStatus === "On Hold") {
      if (!onHoldReason) return showAlert('warning', 'Missing Information', 'Please select a reason for putting the task on hold.');
      if (onHoldReason === "Other" && !customHoldReason.trim()) return showAlert('warning', 'Specific Reason Needed', 'Please type the specific reason for putting the task on hold.');
    }
    
    if (!completionImage) return showAlert('warning', 'Photo Required', 'Please upload a photo as proof of work or visit.');
    
    setIsCompleting(true);

    try {
      const task = tasks.find((t: any) => t.id === completeModalTask);
      if (!task) throw new Error("Task details not found");

      let photoUrl = "";
      if (completionImage) {
        const fileExt = completionImage.name.split('.').pop();
        const fileName = `resolved-${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage.from('tickets').upload(`resolved-uploads/${fileName}`, completionImage);
        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);
        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const formattedCustomReason = customHoldReason.trim() ? capitalizeWords(customHoldReason.trim()) : "";
      const formattedRemarks = completionRemarks.trim() ? capitalizeWords(completionRemarks.trim()) : "";

      const finalStatus = completionStatus === "Success" ? "completed" : "on_hold";
      const finalHoldReason = completionStatus === "On Hold" ? (onHoldReason === "Other" ? formattedCustomReason : onHoldReason) : null;
      
      const updatePayload: any = { 
        status: finalStatus, 
        cost: parseFloat(completionCost) || 0, 
        updated_at: new Date().toISOString(),
        on_hold_reason: finalHoldReason,
        remarks: completionStatus === "Success" ? formattedRemarks : null
      };
      
      if (photoUrl) updatePayload.resolution_photo_url = photoUrl;

      const { error } = await supabase.from('maintenance_tasks').update(updatePayload).eq('id', completeModalTask);
      if (error) throw error;

      const { data: ticketData } = await supabase.from('tickets').select('*').ilike('title', task.title).ilike('location', task.location).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (ticketData) {
        await supabase.from('tickets').update({ 
          status: completionStatus === "Success" ? "Resolved" : "On Hold",
          on_hold_reason: finalHoldReason,
          remarks: completionStatus === "Success" ? formattedRemarks : null
        }).eq('id', ticketData.id);
      }

      let notifMessage = `${profile.name} marked this task as COMPLETED. Remarks: ${formattedRemarks}`;
      if (completionStatus === "On Hold") notifMessage = `${profile.name} put this task ON HOLD. Reason: ${finalHoldReason}.`;

      const notificationsToInsert = [{ admin_email: task.admin_email, recipient: 'MANAGER', type: 'MAINTENANCE', title: `Task ${completionStatus}: ${task.title}`, message: notifMessage, reference_id: task.id, is_read: false }];
      if (ticketData?.reporter_email) {
        notificationsToInsert.push({ admin_email: task.admin_email, recipient: ticketData.reporter_email, type: 'MAINTENANCE', title: `Repair Update: ${task.title}`, message: `Your repair request was marked as ${completionStatus.toUpperCase()}. ${completionStatus === 'On Hold' ? `It is currently on hold due to: ${finalHoldReason}.` : 'It has been resolved!'}`, reference_id: task.id, is_read: false });
      }

      await supabase.from('notifications').insert(notificationsToInsert);
      setCompleteModalTask(null);
      showToast("Report submitted successfully!", "success");
      fetchTasks();
    } catch (err: any) {
      showAlert('error', 'Submission Failed', err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsCompleting(false);
    }
  };

  const openTasks = tasks.filter((t: any) => t.status === 'pending' || t.status === 'in_progress').sort((a: any, b: any) => (a.priority === 'Urgent' ? -1 : 1));
  const onHoldTasks = tasks.filter((t: any) => t.status === 'on_hold').sort((a: any, b: any) => (a.priority === 'Urgent' ? -1 : 1));
  const resolvedTasks = tasks.filter((t: any) => t.status === 'completed');

  return (
    <div className="flex flex-col w-full h-[calc(100vh-130px)] md:h-[calc(100vh-130px)] relative pb-2 overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .animate-bounce-slow { animation: bounce 3s infinite; }
      `}} />

      {/* PREMIUM HEADER */}
      <div className="mb-4 shrink-0">
        <div className="bg-white px-5 py-4 sm:px-6 sm:py-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--color-secondary)] tracking-tight">My Tasks</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">Manage and update your assigned tickets.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-[var(--color-primary)]/5 px-3.5 py-2 rounded-2xl border border-[var(--color-primary)]/10 shadow-inner">
              <Activity size={15} className="text-[var(--color-primary)] animate-pulse" strokeWidth={2.5} />
              <span className="text-sm font-extrabold text-[var(--color-text)] tracking-tight">{isLoading ? "-" : openTasks.length} Active Tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ MOBILE TAB SWITCHER (Nakatago sa Desktop) */}
      <div className="md:hidden shrink-0 mb-4 bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200/80 mx-1 sm:mx-0">
        <button 
          onClick={() => setActiveView('open')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'open' ? 'bg-white text-[var(--color-primary)] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-[var(--color-text)]'}`}
        >
          <Clock size={14} strokeWidth={2.5}/> Open <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : openTasks.length}</span>
        </button>
        <button 
          onClick={() => setActiveView('on_hold')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'on_hold' ? 'bg-white text-amber-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <PauseCircle size={14} strokeWidth={2.5}/> Hold <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : onHoldTasks.length}</span>
        </button>
        <button 
          onClick={() => setActiveView('resolved')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'resolved' ? 'bg-white text-[var(--color-primary)] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CheckCircle size={14} strokeWidth={2.5}/> Resolved <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : resolvedTasks.length}</span>
        </button>
      </div>

      {/* ✨ HYBRID BOARD WRAPPER (Stacked sa Mobile, 3-Columns sa Desktop) */}
      <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pb-6 px-1 sm:px-0 custom-scrollbar animate-in fade-in duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start w-full h-full min-h-[400px]">
          
          {/* ================= COLUMN 1: OPEN TASKS ================= */}
          <div className={`${activeView === 'open' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
            {/* Desktop Only Header */}
            <h4 className="hidden md:flex font-black text-[var(--color-secondary)] text-sm mb-4 items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><Clock size={16} className="text-[var(--color-primary)]" strokeWidth={2.5}/> Open &amp; In Progress</span>
              <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-0.5 rounded-xl text-xs font-black border border-[var(--color-primary)]/20 shadow-inner">{isLoading ? "-" : openTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <> <SkeletonCard /> <SkeletonCard /> </>
              ) : openTasks.length === 0 ? (
                <EmptyState icon={Inbox} title="No active tasks" message="Assigned and pending requests will appear here." />
              ) : (
                openTasks.map((task: any) => (
                  <div 
                    key={task.id} 
                    onClick={() => setReviewActiveTask(task)}
                    className={`group h-[200px] shrink-0 bg-white rounded-[1.5rem] border flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 p-5 ${
                      task.priority === 'Urgent' ? 'border-l-4 border-l-red-500 shadow-sm shadow-red-500/5 border-[var(--color-border)]' : 'hover:border-[var(--color-primary)]/50 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border-[var(--color-border)]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{task.title}</h4>
                      {task.status === 'in_progress' ? (
                        <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[9px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-[var(--shadow-sm)]">Working</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-[var(--shadow-sm)]">New</span>
                      )}
                    </div>
                    
                    <p className="text-[var(--color-primary)] font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{task.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto pt-3 border-t border-[var(--color-border)]">
                      {task.status === 'pending' ? (
                        <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'in_progress'); }} className="w-full py-2.5 rounded-[var(--radius-md)] text-xs font-bold bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 active:scale-[0.98] transition-all shadow-[var(--shadow-md)] border border-transparent">Start Task</button>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); openCompleteModal(task.id); }} className="w-full py-2.5 rounded-[var(--radius-md)] text-xs font-bold bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 active:scale-[0.98] transition-all shadow-sm border border-[var(--color-primary)]/20">Update Report</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ================= COLUMN 2: ON HOLD TASKS ================= */}
          <div className={`${activeView === 'on_hold' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
            {/* Desktop Only Header */}
            <h4 className="hidden md:flex font-black text-[var(--color-secondary)] text-sm mb-4 items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><PauseCircle size={16} className="text-amber-500" strokeWidth={2.5}/> On Hold</span>
              <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-amber-100 shadow-inner">{isLoading ? "-" : onHoldTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <> <SkeletonCard /> <SkeletonCard /> </>
              ) : onHoldTasks.length === 0 ? (
                <EmptyState icon={PauseCircle} title="No tasks on hold" message="Tasks awaiting parts or feedback will show here." />
              ) : (
                onHoldTasks.map((task: any) => (
                  <div 
                    key={task.id} 
                    onClick={() => setReviewOnHoldTask(task)}
                    className="group h-[200px] shrink-0 bg-white rounded-[1.5rem] border border-[var(--color-border)] flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-400 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{task.title}</h4>
                      <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-[var(--shadow-sm)]">On Hold</span>
                    </div>

                    <p className="text-slate-500 font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{task.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-slate-500 line-clamp-2">
                        {task.description}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto pt-3 border-t border-[var(--color-border)]">
                      <button onClick={(e) => { e.stopPropagation(); openCompleteModal(task.id); }} className="w-full py-2.5 rounded-[var(--radius-md)] text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition-all shadow-md border border-transparent">Update Report</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ================= COLUMN 3: RESOLVED TASKS ================= */}
          <div className={`${activeView === 'resolved' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
            {/* Desktop Only Header */}
            <h4 className="hidden md:flex font-black text-[var(--color-secondary)] text-sm mb-4 items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><CheckCircle size={16} className="text-[var(--color-primary)]" strokeWidth={2.5}/> Resolved</span>
              <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-2.5 py-0.5 rounded-xl text-xs font-black border border-[var(--color-primary)]/20 shadow-inner">{isLoading ? "-" : resolvedTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <> <SkeletonCard /> <SkeletonCard /> </>
              ) : resolvedTasks.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No resolved tasks" message="Completed tasks will be logged here." />
              ) : (
                resolvedTasks.map((task: any) => (
                  <div 
                    key={task.id} 
                    onClick={() => setReviewResolvedTask(task)} 
                    className="group h-[200px] shrink-0 bg-white rounded-[1.5rem] border flex flex-col transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-[var(--color-primary)]/50 border-[var(--color-border)] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5"
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{task.title}</h4>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-[var(--shadow-sm)]">Success</span>
                    </div>
                    
                    <p className="text-slate-500 font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{task.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-emerald-700 line-clamp-2">
                        <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" strokeWidth={3} />
                        {task.remarks || "Task completed successfully."}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                      <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1 group-hover:text-[var(--color-primary)] transition-colors">Tap to Review <ChevronRight size={12}/></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ✨ 1. UPDATE / COMPLETE REPORT MODAL (Matching Tenant Photo Upload Layout) */}
      {completeModalTask && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-[var(--color-border)]">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0">
              <h2 className="text-lg font-black text-[var(--color-secondary)] tracking-tight">Update Task</h2>
              <button onClick={() => !isCompleting && setCompleteModalTask(null)} className="text-slate-400 hover:text-[var(--color-primary)] bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors active:scale-90" disabled={isCompleting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 sm:p-6 bg-[var(--color-bg)]/50 overflow-y-auto custom-scrollbar">
              <form onSubmit={handleCompleteTask} className="space-y-6">
                
                {/* STATUS SELECTION */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Repair Result</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex flex-col items-center justify-center gap-1.5 p-4 border-2 rounded-[var(--radius-lg)] cursor-pointer transition-all active:scale-95 duration-200 shadow-sm ${completionStatus === "Success" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-[var(--color-border)] bg-white text-slate-400 hover:border-slate-300"}`}>
                      <input type="radio" name="status" value="Success" checked={completionStatus === "Success"} onChange={(e) => {setCompletionStatus(e.target.value); setOnHoldReason(""); setCustomHoldReason("");}} className="hidden" />
                      <CheckCircle size={24} strokeWidth={2.5} />
                      <span className="text-sm font-bold">Success</span>
                    </label>
                    <label className={`flex flex-col items-center justify-center gap-1.5 p-4 border-2 rounded-[var(--radius-lg)] cursor-pointer transition-all active:scale-95 duration-200 shadow-sm ${completionStatus === "On Hold" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-[var(--color-border)] bg-white text-slate-400 hover:border-slate-300"}`}>
                      <input type="radio" name="status" value="On Hold" checked={completionStatus === "On Hold"} onChange={(e) => setCompletionStatus(e.target.value)} className="hidden" />
                      <PauseCircle size={24} strokeWidth={2.5} />
                      <span className="text-sm font-bold">On Hold</span>
                    </label>
                  </div>
                </div>

                {/* ON HOLD FIELDS */}
                {completionStatus === "On Hold" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                    <div>
                      <label className="block text-[10px] font-black text-amber-700/60 uppercase tracking-widest mb-2">Reason for holding</label>
                      <select required value={onHoldReason} onChange={(e) => { setOnHoldReason(e.target.value); if (e.target.value !== "Other") setCustomHoldReason(""); }} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-sm font-bold text-slate-700" disabled={isCompleting}>
                        <option value="" disabled>Select reason...</option>
                        <option value="Need Parts">Need Parts</option>
                        <option value="No Access">No Access to Unit</option>
                        <option value="Budget Approval">Awaiting Budget Approval</option>
                        <option value="Other">Other reason...</option>
                      </select>
                    </div>
                    {onHoldReason === "Other" && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-[10px] font-black text-amber-700/60 uppercase tracking-widest ml-1">Please specify reason</label>
                          <span className="text-[10px] font-bold text-slate-400">{customHoldReason.length}/25</span>
                        </div>
                        <input type="text" required maxLength={25} value={customHoldReason} onChange={(e) => setCustomHoldReason(e.target.value)} placeholder="Type the specific reason here..." className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-sm font-bold text-slate-700" disabled={isCompleting} />
                      </div>
                    )}
                  </div>
                )}

                {/* SUCCESS FIELDS */}
                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="bg-white p-4 rounded-2xl border border-[var(--color-border)] shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Remarks / What was fixed?</label>
                        <span className="text-[10px] font-bold text-slate-400">{completionRemarks.length}/30</span>
                      </div>
                      <textarea required maxLength={30} value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Briefly describe the fix..." className="w-full border border-[var(--color-border)] bg-slate-50 rounded-[var(--radius-md)] p-3 text-sm font-bold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] min-h-[80px]" disabled={isCompleting} />
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-[var(--color-border)] shadow-sm">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Materials Cost (Optional)</label>
                      <div className="relative">
                        <PhilippinePesoIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={2.5} />
                        <input type="number" min="0" step="0.01" placeholder="0.00" value={completionCost} onChange={(e) => setCompletionCost(e.target.value)} className="w-full pl-10 p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)]" disabled={isCompleting} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ✨ PHOTO UPLOAD (Required for both) */}
                {completionStatus && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Required: Proof of Work / Visit</label>
                    
                    {completionImage ? (
                      <div className="flex flex-col w-full p-2 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-[var(--shadow-sm)]">
                        <div className="relative w-full h-40 rounded-xl overflow-hidden bg-slate-900 mb-2">
                          <img src={URL.createObjectURL(completionImage)} alt="Resolution preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between px-2 pb-1">
                          <span className="text-[10px] text-[var(--color-primary)] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12} strokeWidth={3}/> Image Ready</span>
                          <button type="button" onClick={(e) => { e.preventDefault(); setCompletionImage(null); }} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-100 px-2 py-1 rounded-[var(--radius-sm)] transition-colors" disabled={isCompleting}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* MOBILE VIEW (Side-by-side) */}
                        <div className="flex md:hidden gap-3 w-full">
                          <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-sm transition-all group">
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors"><Camera size={20} strokeWidth={2.5}/></div>
                            <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[var(--color-primary)] uppercase tracking-wide">Take Photo</span>
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])} className="hidden" disabled={isCompleting} />
                          </label>
                          <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-sm transition-all group">
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                            <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[var(--color-primary)] uppercase tracking-wide">Gallery</span>
                            <input type="file" accept="image/*" onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])} className="hidden" disabled={isCompleting} />
                          </label>
                        </div>

                        {/* DESKTOP VIEW (Full Width Upload) */}
                        <div className="hidden md:flex w-full">
                          <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-[var(--shadow-sm)] transition-all group">
                            <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                            <span className="text-sm font-black text-slate-700 group-hover:text-[var(--color-primary)] uppercase tracking-wide">Upload Photo</span>
                            <span className="text-xs text-slate-400 font-medium">Click to browse from your computer</span>
                            <input type="file" accept="image/*" onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])} className="hidden" disabled={isCompleting} />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setCompleteModalTask(null)} disabled={isCompleting} className="flex-1 py-3.5 rounded-[var(--radius-md)] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-xs active:scale-95 duration-150">Cancel</button>
                  <button type="submit" disabled={isCompleting || !completionStatus || !completionImage} className="flex-[2] bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:text-[var(--color-primary-text)] border border-transparent text-[var(--color-primary-text)] py-3.5 rounded-[var(--radius-md)] text-xs font-black transition-all shadow-[var(--shadow-md)] active:scale-[0.98] flex items-center justify-center">
                    {isCompleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : "Submit Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 2. ACTIVE TASK REVIEW MODAL (NEW: Before starting work) */}
      {reviewActiveTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Task Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <Inbox size={16} className="text-[var(--color-primary)] shrink-0" /> {reviewActiveTask.title}
                </div>
              </div>
              <button onClick={() => setReviewActiveTask(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE (Tenant's Report) */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-border)] shadow-sm">Report</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Tenant Evidence</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewActiveTask.photo_url ? (
                      <img src={reviewActiveTask.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo provided</span></div>
                    )}
                  </div>
                </div>

                {/* TASK INFORMATION */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-primary)]/20 shadow-sm">Info</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Task Overview</span>
                    </div>
                    {reviewActiveTask.status === 'in_progress' ? (
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[10px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-sm">Working</span>
                    ) : (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-sm">New</span>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-[var(--color-border)] flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Issue Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">{reviewActiveTask.description}</p>
                    
                    <div className="mt-8 space-y-4 pt-2">
                      <div className="flex justify-between items-center border-t border-[var(--color-border)] pt-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin size={14} /> Location</span>
                        <span className="font-extrabold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] text-xs">
                          {reviewActiveTask.location}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-[var(--color-border)] pt-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={14} /> Priority</span>
                        <span className={`font-extrabold px-3 py-1.5 rounded-[var(--radius-sm)] border shadow-sm text-xs ${reviewActiveTask.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-white text-[var(--color-text)] border-[var(--color-border)]'}`}>
                          {reviewActiveTask.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.02)]">
              <button onClick={() => setReviewActiveTask(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 3. REVIEW ON HOLD MODAL (Before & After) */}
      {reviewOnHoldTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-60 flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-[var(--shadow-sm)]">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Hold Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <PauseCircle size={16} className="text-amber-500 shrink-0" /> {reviewOnHoldTask.title}
                </div>
              </div>
              <button onClick={() => setReviewOnHoldTask(null)} className="w-12 h-12 flex items-center hidden md:flex justify-center bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-border)] shadow-[var(--shadow-sm)]">Before</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Reported Issue</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-[var(--shadow-inner)] group p-1">
                    {reviewOnHoldTask.photo_url ? (
                      <img src={reviewOnHoldTask.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Camera size={32} className="mx-auto mb-2 opacity-40" />
                        <span className="text-xs font-bold block uppercase tracking-widest">No photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-[var(--color-border)] flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">
                      {reviewOnHoldTask.description}
                    </p>
                  </div>
                </div>

                {/* ON HOLD UPDATE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-amber-100 shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-amber-200/60 shadow-[var(--shadow-sm)]">After</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Your Report</span>
                    </div>
                    <span className="px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200/60 shrink-0 shadow-[var(--shadow-sm)]">
                      On Hold
                    </span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-amber-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewOnHoldTask.resolution_photo_url ? (
                      <img 
                        src={reviewOnHoldTask.resolution_photo_url} 
                        alt="On hold status" 
                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <PauseCircle size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-40 text-amber-500" />
                        <span className="text-xs font-black block uppercase tracking-widest text-amber-600/70">Awaiting action or parts</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50/40 rounded-[1.5rem] p-5 border border-amber-100/50 space-y-2 shrink-0 flex flex-col justify-between flex-1">
                    <div>
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block border-b border-amber-100 pb-2 mb-2">Reason for delay:</span>
                      <p className="text-sm text-amber-800 leading-relaxed font-bold">
                        {reviewOnHoldTask.on_hold_reason || "Task is currently on hold."}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[var(--shadow-sm)]">
              <button onClick={() => setReviewOnHoldTask(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 4. REVIEW RESOLUTION MODAL (Before & After) */}
      {reviewResolvedTask && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-[var(--shadow-sm)]">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Resolution Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0" /> {reviewResolvedTask.title}
                </div>
              </div>
              <button onClick={() => setReviewResolvedTask(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-border)] shadow-[var(--shadow-sm)]">Before</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Reported Issue</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewResolvedTask.photo_url ? (
                      <img src={reviewResolvedTask.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo</span></div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-[1.5rem] p-5 border border-[var(--color-border)] flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">{reviewResolvedTask.description}</p>
                  </div>
                </div>

                {/* AFTER */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]">After</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Your Resolution</span>
                    </div>
                    <span className="px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]"><Check size={12} className="inline mr-1"/> Success</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-primary)]/20 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group relative z-10 p-1">
                    {reviewResolvedTask.resolution_photo_url ? (
                      <img src={reviewResolvedTask.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-[var(--color-primary)]/70 p-4"><CheckCircle2 size={32} className="mx-auto mb-2 opacity-60" /><span className="text-xs font-bold block uppercase tracking-widest text-[var(--color-primary)]/60">No evidence photo</span></div>
                    )}
                  </div>

                  <div className="bg-[var(--color-primary)]/5 rounded-[1.5rem] p-5 border border-[var(--color-primary)]/10 space-y-4 shrink-0 flex flex-col justify-between flex-1 relative z-10">
                    {reviewResolvedTask.remarks && (
                       <div>
                         <span className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest block border-b border-[var(--color-primary)]/20 pb-2 mb-2">My Remarks:</span>
                         <p className="text-sm text-[var(--color-text)] leading-relaxed font-bold">"{reviewResolvedTask.remarks}"</p>
                       </div>
                    )}

                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex justify-between items-center border-t border-[var(--color-primary)]/20 pt-4">
                        <span className="text-[10px] font-black text-[var(--color-primary)]/70 uppercase tracking-widest flex items-center gap-2"><PhilippinePesoIcon size={14} /> Materials Cost</span>
                        <span className="font-extrabold text-[var(--color-primary)] bg-white px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] text-xs">
                          {reviewResolvedTask.cost > 0 ? `₱${reviewResolvedTask.cost.toLocaleString()}` : "₱0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[var(--shadow-sm)]">
              <button onClick={() => setReviewResolvedTask(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ALERT MODAL */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--color-secondary)]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[2rem] shadow-2xl w-full max-w-sm p-6 text-center border border-[var(--color-border)] transform transition-all animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center mx-auto mb-4 border-4 shadow-inner ${alertConfig.type === 'success' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : alertConfig.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-amber-50 text-amber-500 border-amber-100'}`}>
              {alertConfig.type === 'success' && <CheckCircle size={28} strokeWidth={2.5} />}
              {alertConfig.type === 'error' && <AlertCircle size={28} strokeWidth={2.5} />}
              {alertConfig.type === 'warning' && <AlertTriangle size={28} strokeWidth={2.5} />}
            </div>
            <h2 className="text-lg font-black text-[var(--color-secondary)] mb-2 tracking-tight">{alertConfig.title}</h2>
            <p className="text-slate-500 text-xs mb-6 leading-relaxed whitespace-pre-wrap font-medium">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className={`w-full text-white px-4 py-3.5 rounded-[var(--radius-md)] text-xs font-black transition-all shadow-[var(--shadow-sm)] active:scale-[0.98] duration-150 border border-transparent ${alertConfig.type === 'success' ? 'bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)]' : alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-[var(--color-border)] flex flex-col h-[200px] animate-pulse overflow-hidden mb-4 shrink-0 shadow-[var(--shadow-sm)]">
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="h-4 bg-slate-200 rounded-md w-3/4 mb-3"></div>
        <div className="h-3 bg-slate-200 rounded-md w-1/2 mb-4"></div>
        <div className="h-2 bg-slate-100 rounded w-full mb-2"></div>
        <div className="h-2 bg-slate-100 rounded w-5/6"></div>
        <div className="mt-auto pt-4"><div className="h-10 bg-slate-200 rounded-[var(--radius-sm)] w-full"></div></div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-[var(--color-border)] bg-slate-50/50 rounded-3xl p-6 text-center h-[200px]">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-border)] mb-3">
        <Icon size={24} className="text-slate-400" strokeWidth={2}/>
      </div>
      <h4 className="text-sm font-black text-[var(--color-secondary)] mb-1">{title}</h4>
      <p className="text-xs font-semibold text-slate-400 max-w-[200px] leading-relaxed">{message}</p>
    </div>
  );
}