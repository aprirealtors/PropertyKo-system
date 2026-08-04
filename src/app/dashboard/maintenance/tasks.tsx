"use client";

import React, { useState } from "react";
import { MapPin, X, CheckCircle, PauseCircle, Camera, PhilippinePesoIcon, AlertCircle, AlertTriangle, Wrench, Clock, Activity, Info, Inbox, Trash2, CheckCircle2 } from "lucide-react";
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

  const [reviewTask, setReviewTask] = useState<any | null>(null);
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

      // ✨ FIX: Format Custom Reason (Capitalize first letter of every word)
      const formattedCustomReason = customHoldReason.trim() 
        ? capitalizeWords(customHoldReason.trim())
        : "";

      // ✨ FIX: Format Remarks (Capitalize first letter of every word)
      const formattedRemarks = completionRemarks.trim()
        ? capitalizeWords(completionRemarks.trim())
        : "";

      const finalStatus = completionStatus === "Success" ? "completed" : "on_hold";
      const finalHoldReason = completionStatus === "On Hold" 
        ? (onHoldReason === "Other" ? formattedCustomReason : onHoldReason) 
        : null;
      
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
    // Fixed container framework mapping
    <div className="flex flex-col w-full h-[calc(100vh-130px)] md:h-[calc(100vh-130px)] relative pb-2 overflow-hidden font-sans selection:bg-[#359b46]/10">
      
      {/* PREMIUM HEADER - Static Shrink Block */}
      <div className="mb-2 shrink-0">
        <div className="bg-white px-5 py-4 sm:px-6 sm:py-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#0a1e3f] tracking-tight">My Tasks</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium">Manage and update your assigned maintenance tickets.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-inner">
              <Activity size={15} className="text-blue-500 animate-pulse" strokeWidth={2.5} />
              <span className="text-xs font-bold text-slate-700 tracking-tight">{isLoading ? "-" : openTasks.length} Active Tickets</span>
            </div>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD WRAPPER - Single Unified Vertical Scroll Layer */}
      <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pr-1 pb-6 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start w-full">
          
          {/* COLUMN 1: OPEN TASKS */}
          <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
            <h4 className="font-black text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><Clock size={16} className="text-blue-500" strokeWidth={2.5}/> Open &amp; In Progress</span>
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-blue-100 shadow-inner">{isLoading ? "-" : openTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : openTasks.length === 0 ? (
                <EmptyState icon={Inbox} title="No active tasks" message="Assigned and pending requests will appear here." />
              ) : (
                openTasks.map((task: any) => (
                  // ✨ FIXED CARD SIZE: Ginawang h-[460px] para magkakapantay lahat
                  <div key={task.id} className={`h-[460px] bg-white rounded-2xl border border-slate-200/80 transition-all duration-300 flex flex-col group overflow-hidden hover:-translate-y-1 hover:shadow-xl shrink-0 ${task.priority === 'Urgent' ? 'ring-2 ring-red-500/20 border-red-200 shadow-sm shadow-red-500/5' : 'hover:border-blue-400/60 shadow-sm'}`}>
                    {task.photo_url ? (
                      <div className="relative w-full h-36 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden">
                        <img src={task.photo_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Task" />
                      </div>
                    ) : (
                      <div className="relative w-full h-36 shrink-0 bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <Camera size={24} strokeWidth={1.5} className="mb-1.5 opacity-60" /><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No Image Uploaded</span>
                      </div>
                    )}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col overflow-hidden">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <h4 className="font-bold text-[#0a1e3f] text-[15px] leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 tracking-tight">{task.title}</h4>
                        {task.status === 'in_progress' && <span className="bg-blue-50 text-blue-600 border border-blue-200/60 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 shadow-sm">In Progress</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <p className="text-[#359b46] font-bold text-xs pr-2 flex items-center gap-1 truncate"><MapPin size={13} strokeWidth={2.5} className="shrink-0"/> <span className="truncate tracking-tight">{task.location}</span></p>
                        {task.priority === 'Urgent' && <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 shadow-sm animate-pulse">🚨 Urgent</span>}
                      </div>

                      {/* ✨ TEXT CONTENT SCROLL WRAPPER: Sinasalo nito ang haba ng text para hindi masira ang size ng card */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1">
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{task.description}</p>
                        
                        <div className="bg-blue-50/60 border border-blue-100/60 rounded-xl p-3 shadow-sm">
                          <span className="font-bold text-blue-600 block mb-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                            <AlertCircle size={12} strokeWidth={2.5} /> Status Update
                          </span>
                          <p className="text-xs text-blue-800 font-bold tracking-wide flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>Awaiting Action</p>
                        </div>
                      </div>

                      <div className="shrink-0 pt-2 border-t border-slate-100">
                        {task.status === 'pending' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#359b46] text-white border border-emerald-600/10 hover:bg-[#2c813a] active:scale-[0.98] transition-all shadow-sm shadow-emerald-500/10">Start Task</button>
                        ) : (
                          <button onClick={() => openCompleteModal(task.id)} className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white border border-blue-700/10 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm shadow-blue-500/10">Update / Finish</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: ON HOLD TASKS */}
          <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
            <h4 className="font-black text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><PauseCircle size={16} className="text-amber-500" strokeWidth={2.5}/> On Hold</span>
              <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-amber-100 shadow-inner">{isLoading ? "-" : onHoldTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : onHoldTasks.length === 0 ? (
                <EmptyState icon={PauseCircle} title="No tasks on hold" message="Tasks awaiting parts or feedback will show here." />
              ) : (
                onHoldTasks.map((task: any) => (
                  // ✨ FIXED CARD SIZE: Ginawang h-[460px] para magkakapantay lahat
                  <div key={task.id} 
                       onClick={() => setReviewTask(task)}
                       className={`h-[460px] bg-white rounded-2xl border border-slate-200/80 transition-all duration-300 flex flex-col group overflow-hidden hover:-translate-y-1 hover:shadow-xl cursor-pointer shrink-0 ${task.priority === 'Urgent' ? 'ring-2 ring-red-500/20 border-red-200 shadow-sm' : 'hover:border-amber-400/60 shadow-sm'}`}>
                    {task.photo_url ? (
                      <div className="relative w-full h-36 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden">
                        <img src={task.photo_url} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500" alt="Task photo" />
                      </div>
                    ) : (
                      <div className="relative w-full h-36 shrink-0 bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <Camera size={24} strokeWidth={1.5} className="mb-1.5 opacity-60" /><span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No Image Uploaded</span>
                      </div>
                    )}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col overflow-hidden">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <h4 className="font-bold text-slate-700 text-[15px] leading-snug group-hover:text-amber-700 transition-colors line-clamp-2 tracking-tight">{task.title}</h4>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 shadow-sm">On Hold</span>
                      </div>
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <p className="text-slate-500 font-bold text-xs pr-2 flex items-center gap-1 truncate"><MapPin size={13} strokeWidth={2.5} className="shrink-0"/> <span className="truncate tracking-tight">{task.location}</span></p>
                        {task.priority === 'Urgent' && <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 shadow-sm">🚨 Urgent</span>}
                      </div>
                      
                      {/* ✨ TEXT CONTENT SCROLL WRAPPER: Para laging pantay ang button area sa ibaba */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1">
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{task.description}</p>
                        
                        {task.on_hold_reason && (
                          <div className="bg-amber-50/50 border border-amber-100/60 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                            <Info size={14} className="text-amber-600 mt-0.5 shrink-0" strokeWidth={2.5} />
                            <div className="flex-1 overflow-hidden">
                              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">Reason for Hold</span>
                              <span className="text-xs font-bold text-amber-900 leading-tight block line-clamp-2 tracking-tight">{task.on_hold_reason}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 pt-2 border-t border-slate-100">
                        <button onClick={(e) => { e.stopPropagation(); openCompleteModal(task.id); }} className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-white border border-amber-600/10 hover:bg-amber-600 active:scale-[0.98] transition-all shadow-sm shadow-amber-500/10">Update Report</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: RESOLVED TASKS */}
          <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
            <h4 className="font-black text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1 tracking-tight">
              <span className="flex items-center gap-2"><CheckCircle size={16} className="text-[#359b46]" strokeWidth={2.5}/> Resolved</span>
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-emerald-100 shadow-inner">{isLoading ? "-" : resolvedTasks.length}</span>
            </h4>
            
            <div className="flex flex-col space-y-4">
              {isLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : resolvedTasks.length === 0 ? (
                <EmptyState icon={CheckCircle} title="No resolved tasks" message="Completed tasks will be logged here." />
              ) : (
                resolvedTasks.map((task: any) => (
                  // ✨ FIXED CARD SIZE: Ginawang h-[460px] para magkakapantay lahat
                  <div key={task.id} onClick={() => setReviewTask(task)} className="h-[460px] bg-white rounded-2xl border border-slate-200/80 flex flex-col group overflow-hidden hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer hover:border-[#359b46]/40 active:scale-[0.99] shadow-sm shrink-0">
                    {(task.resolution_photo_url || task.photo_url) ? (
                      <div className="relative w-full h-36 shrink-0 bg-emerald-50/20 border-b border-emerald-100/30 overflow-hidden">
                        <img src={task.resolution_photo_url || task.photo_url} alt="Resolved issue" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="relative w-full h-36 shrink-0 bg-emerald-50/20 border-b border-emerald-100/30 flex flex-col items-center justify-center text-emerald-300">
                        <Camera size={24} strokeWidth={1.5} className="mb-1.5 opacity-60" /><span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70">No Image Uploaded</span>
                      </div>
                    )}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col bg-emerald-50/5 overflow-hidden">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <div className="flex items-start gap-2 min-w-0">
                          <CheckCircle size={15} className="text-[#359b46] mt-0.5 shrink-0" strokeWidth={2.5} />
                          <h4 className="font-bold text-[#0a1e3f] text-[15px] leading-snug group-hover:text-[#359b46] transition-colors line-clamp-2 tracking-tight">{task.title}</h4>
                        </div>
                        <span className="bg-emerald-50 text-[#359b46] border border-emerald-200/60 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider shrink-0 mt-0.5 shadow-sm">Success</span>
                      </div>
                      <p className="text-slate-500 font-bold text-xs mb-2 flex items-center gap-1 shrink-0 truncate"><MapPin size={13} strokeWidth={2.5} className="shrink-0" /> <span className="truncate tracking-tight">{task.location}</span></p>
                      
                      {/* ✨ TEXT CONTENT SCROLL WRAPPER: Nilagyan din ng wrapper para sa resolved remarks field */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 mb-4 pr-1">
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{task.description}</p>
                        
                        {task.remarks && (
                          <div className="bg-emerald-50/40 border border-emerald-100/50 rounded-xl p-3 flex items-start gap-2 shadow-sm">
                            <CheckCircle size={14} className="text-[#359b46] mt-0.5 shrink-0" strokeWidth={2.5} />
                            <div className="flex-1 overflow-hidden">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#359b46] block mb-0.5">Remarks / Notes</span>
                              <span className="text-xs font-bold text-emerald-900 leading-tight block line-clamp-2 tracking-tight">{task.remarks}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="shrink-0 flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <span className="font-bold px-2.5 py-1 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500 shadow-inner flex items-center gap-1.5"><Activity size={12} strokeWidth={2.5}/> Assigned Staff</span>
                        {task.cost !== undefined && task.cost > 0 ? (
                          <span className="font-black text-[#0a1e3f] bg-slate-50/50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-sm tracking-tight">₱{task.cost.toLocaleString()}</span>
                        ) : (
                          <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">No Cost</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* UPDATE / COMPLETE MODAL */}
      {completeModalTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a1e3f]/50 backdrop-blur-sm p-2 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col my-8 border border-slate-200/40 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-black text-[#0a1e3f] tracking-tight">Submit Task Report</h2>
              <button onClick={() => !isCompleting && setCompleteModalTask(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors active:scale-90" disabled={isCompleting}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 bg-slate-50/50 overflow-y-auto">
              <form onSubmit={handleCompleteTask} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Repair Result</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center gap-2 p-3.5 border-2 rounded-2xl cursor-pointer transition-all active:scale-95 duration-200 shadow-sm ${completionStatus === "Success" ? "border-[#359b46] bg-emerald-50 text-[#2c813a] font-bold" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                      <input type="radio" name="status" value="Success" checked={completionStatus === "Success"} onChange={(e) => {setCompletionStatus(e.target.value); setOnHoldReason(""); setCustomHoldReason("");}} className="hidden" />
                      <CheckCircle size={18} className={completionStatus === "Success" ? "text-[#359b46]" : "text-slate-400"} strokeWidth={2.5} />
                      <span className="text-sm">Success</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-3.5 border-2 rounded-2xl cursor-pointer transition-all active:scale-95 duration-200 shadow-sm ${completionStatus === "On Hold" ? "border-amber-500 bg-amber-50 text-amber-700 font-bold" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                      <input type="radio" name="status" value="On Hold" checked={completionStatus === "On Hold"} onChange={(e) => setCompletionStatus(e.target.value)} className="hidden" />
                      <PauseCircle size={18} className={completionStatus === "On Hold" ? "text-amber-500" : "text-slate-400"} strokeWidth={2.5} />
                      <span className="text-sm">On Hold</span>
                    </label>
                  </div>
                </div>

                {completionStatus === "On Hold" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Reason for holding</label>
                      <select required value={onHoldReason} onChange={(e) => { setOnHoldReason(e.target.value); if (e.target.value !== "Other") setCustomHoldReason(""); }} className="w-full px-4 py-3 rounded-2xl border border-amber-200 bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-semibold text-amber-900 transition-shadow" disabled={isCompleting}>
                        <option value="" disabled>Select reason...</option>
                        <option value="Need Parts">Need Parts</option>
                        <option value="No Access">No Access</option>
                        <option value="Budget Approval">Budget Approval</option>
                        <option value="Other">Other reason...</option>
                      </select>
                    </div>
                    {onHoldReason === "Other" && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex justify-between">
                          <span>Please specify reason</span>
                          <span className="font-normal text-[10px] text-slate-400">{customHoldReason.length}/25</span>
                        </label>
                        <input type="text" required maxLength={25} value={customHoldReason} onChange={(e) => setCustomHoldReason(e.target.value)} placeholder="Type the specific reason here..." className="w-full px-4 py-3 rounded-2xl border border-amber-200 bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 text-sm font-semibold text-amber-900 placeholder:text-slate-400/50 transition-shadow" disabled={isCompleting} />
                      </div>
                    )}
                  </div>
                )}

                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex justify-between">
                      <span>Remarks / Notes</span>
                      <span className="font-normal text-[10px] text-slate-400">{completionRemarks.length}/25</span>
                    </label>
                    <textarea required maxLength={25} value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Briefly describe what was fixed..." className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] min-h-[90px] transition-shadow shadow-sm bg-white placeholder:text-slate-400/60" disabled={isCompleting} />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Proof of Work / Visit</label>
                  <div>
                    {completionImage ? (
                      <div className="flex flex-col gap-2.5 w-full p-2.5 sm:p-3 rounded-xl border-2 border-solid border-emerald-400 bg-emerald-50/50 transition-all shadow-sm">
                        
                        {/* IMAGE PREVIEW BOX */}
                        <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
                          <img 
                            src={URL.createObjectURL(completionImage)} 
                            alt="Resolution preview" 
                            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                          />
                        </div>

                        {/* DETAILS & REMOVE BUTTON */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span className="text-xs truncate text-emerald-900 font-black">
                              {completionImage.name}
                            </span>
                            <span className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={3} /> Ready to submit
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setCompletionImage(null); }} 
                            className="flex items-center gap-1.5 px-3 py-2 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-lg shadow-sm border border-red-100 transition-all active:scale-95 shrink-0 font-bold text-[10px] uppercase tracking-wider"
                            title="Retake or Remove photo"
                          >
                            <Trash2 size={14} strokeWidth={2.5} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 w-full">
                        {/* CAMERA BUTTON - ✨ FIX: Nilagyan ng md:hidden para mawala sa desktop */}
                        <label className="flex-1 flex md:hidden flex-col items-center justify-center gap-2 px-2 py-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group text-center shadow-sm bg-white">
                          <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm ring-2 ring-slate-50 group-hover:ring-emerald-50 shrink-0">
                            <Camera size={20} strokeWidth={2.5} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-700 group-hover:text-emerald-700 block leading-none mt-1">
                              Take Photo
                            </span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])}
                            className="hidden"
                            disabled={isCompleting}
                          />
                        </label>

                        {/* GALLERY / UPLOAD BUTTON - ✨ FIX: Automatic mag-isa sa desktop, "Upload Photo" ang text */}
                        <label className="flex-1 flex flex-col items-center justify-center gap-2 px-2 py-4 md:py-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group text-center shadow-sm bg-white">
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm ring-2 ring-slate-50 group-hover:ring-emerald-50 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 md:w-6 md:h-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-700 group-hover:text-emerald-700 block leading-none mt-1 md:hidden">
                              Gallery
                            </span>
                            <span className="text-sm font-black text-slate-700 group-hover:text-emerald-700 hidden md:block leading-none mt-1">
                              Upload Photo
                            </span>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])}
                            className="hidden"
                            disabled={isCompleting}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Equipment Cost (Optional)</label>
                    <div className="relative">
                      <PhilippinePesoIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} strokeWidth={2.5} />
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={completionCost} onChange={(e) => setCompletionCost(e.target.value)} className="w-full pl-10 p-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 shadow-sm transition-shadow" disabled={isCompleting} />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setCompleteModalTask(null)} disabled={isCompleting} className="flex-1 py-3 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors text-sm border border-slate-200/20 active:scale-95 duration-150">Cancel</button>
                  <button type="submit" disabled={isCompleting || !completionStatus} className="flex-[2] bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-200 disabled:text-slate-400 border border-transparent text-white py-3 rounded-2xl text-sm font-bold transition-all shadow-md active:scale-[0.98] flex items-center justify-center shadow-emerald-500/10">
                    {isCompleting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Submitting...
                      </div>
                    ) : "Submit Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION REVIEW MODAL */}
      {reviewTask && (
        <div className="fixed inset-0 bg-[#0a1e3f]/50 backdrop-blur-sm z-[60] flex items-center justify-center p-0 sm:p-4 transition-all duration-300 animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] absolute bottom-0 sm:relative border border-slate-200/40 transform transition-transform animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] flex items-center gap-2 truncate tracking-tight">{reviewTask.title}</h2>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mt-0.5 truncate"><MapPin size={13} className="text-slate-400 shrink-0" strokeWidth={2.5} /> {reviewTask.location}</div>
              </div>
              <button onClick={() => setReviewTask(null)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors p-2 rounded-full shrink-0 active:scale-90"><X size={18} strokeWidth={2.5} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-0 bg-slate-50/40 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 h-full">
                
                {/* BEFORE */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-50 text-slate-400 border border-slate-200 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">Before</span>
                    <span className="text-sm font-bold text-slate-700 tracking-tight">Reported Issue</span>
                  </div>
                  <div className="w-full aspect-video bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTask.photo_url ? (
                      <img src={reviewTask.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={28} strokeWidth={1.5} className="mx-auto mb-1.5 opacity-40" /><span className="text-[10px] font-bold uppercase tracking-widest block text-slate-400/80">No photo submitted</span></div>
                    )}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 flex flex-col justify-between shadow-inner">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">{reviewTask.description}</p>
                    <div className="text-[10px] text-slate-400 font-bold border-t border-slate-200 pt-3 mt-4 shrink-0 uppercase tracking-wider">
                      Reported: {new Date(reviewTask.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                {reviewTask.status === 'on_hold' ? (
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-sm flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 border border-blue-100 text-blue-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">After</span>
                        <span className="text-sm font-bold text-slate-700 tracking-tight">Hold Status</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200/60 shrink-0 shadow-sm">On Hold</span>
                    </div>
                    <div className="w-full aspect-video bg-amber-50/20 border border-amber-100/60 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {reviewTask.resolution_photo_url ? (
                        <img src={reviewTask.resolution_photo_url} alt="On hold proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                      ) : (
                        <div className="text-center text-amber-400 p-4"><Camera size={28} strokeWidth={1.5} className="mx-auto mb-1.5 opacity-50" /><span className="text-[10px] font-bold uppercase tracking-widest block text-amber-500/70">No photo uploaded</span></div>
                      )}
                    </div>
                    <div className="bg-amber-50/20 border border-amber-100 rounded-xl p-4 space-y-3 shrink-0 shadow-sm">
                      <div className="flex justify-between items-center text-xs sm:text-sm mb-0.5">
                        <span className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest flex items-center gap-1.5"><Info size={13} strokeWidth={2.5}/> Hold Reason</span>
                        <span className="font-bold text-amber-800 bg-white px-3 py-1 rounded-xl border border-amber-200 shadow-sm text-xs tracking-tight">{reviewTask.on_hold_reason}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-amber-200/60 pt-3 text-xs sm:text-sm">
                        <span className="text-[10px] font-black text-amber-600/80 uppercase tracking-widest flex items-center gap-1.5"><Activity size={13} strokeWidth={2.5}/> Staff In Charge</span>
                        <span className="font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-amber-200 shadow-sm text-xs tracking-tight">You</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-sm flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 border border-blue-100 text-blue-600 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest">After</span>
                        <span className="text-sm font-bold text-slate-700 tracking-tight">My Resolution</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-[#359b46] border-emerald-200/60 shrink-0 shadow-sm">Success</span>
                    </div>
                    <div className="w-full aspect-video bg-emerald-50/20 border border-emerald-100/60 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {reviewTask.resolution_photo_url ? (
                        <img src={reviewTask.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                      ) : (
                        <div className="text-center text-emerald-400 p-4"><Wrench size={28} strokeWidth={1.5} className="mx-auto mb-1.5 opacity-50" /><span className="text-[10px] font-bold uppercase tracking-widest block text-emerald-500/70">No photo uploaded</span></div>
                      )}
                    </div>
                    <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-4 space-y-3 shrink-0 shadow-sm">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-[10px] font-black text-emerald-600/80 uppercase tracking-widest flex items-center gap-1.5"><Activity size={13} strokeWidth={2.5}/> Staff In Charge</span>
                        <span className="font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-sm text-xs tracking-tight">You</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-emerald-200/60 pt-3 text-xs sm:text-sm">
                        <span className="text-[10px] font-black text-emerald-600/80 uppercase tracking-widest flex items-center gap-1.5"><PhilippinePesoIcon size={13} strokeWidth={2.5}/> Equipment Cost</span>
                        {reviewTask.cost !== undefined && reviewTask.cost > 0 ? (
                          <span className="font-black text-[#0a1e3f] bg-white px-3 py-1 rounded-xl border border-emerald-200 shadow-sm text-xs tracking-tight">₱{reviewTask.cost.toLocaleString()}</span>
                        ) : (
                          <span className="font-bold text-slate-400 bg-white px-3 py-1 rounded-xl border border-slate-200 text-[10px] uppercase shadow-sm tracking-tight">₱0.00</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 shrink-0 md:hidden pb-safe">
              <button onClick={() => setReviewTask(null)} className="w-full bg-[#0a1e3f] text-white py-3 rounded-2xl font-bold text-sm shadow-md active:scale-[0.98] transition-all">Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ALERT MODAL */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a1e3f]/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center border border-slate-100 transform transition-all animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-sm ${alertConfig.type === 'success' ? 'bg-emerald-50 text-[#359b46] border-emerald-100' : alertConfig.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-amber-50 text-amber-500 border-amber-100'}`}>
              {alertConfig.type === 'success' && <CheckCircle size={28} strokeWidth={2.5} />}
              {alertConfig.type === 'error' && <AlertCircle size={28} strokeWidth={2.5} />}
              {alertConfig.type === 'warning' && <AlertTriangle size={28} strokeWidth={2.5} />}
            </div>
            <h2 className="text-lg font-black text-[#0a1e3f] mb-1 tracking-tight">{alertConfig.title}</h2>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed whitespace-pre-wrap font-semibold">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className={`w-full text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] duration-150 ${alertConfig.type === 'success' ? 'bg-[#359b46] hover:bg-[#2c813a] shadow-emerald-600/20' : alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-600/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-600/20'}`}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

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

// ✨ NEW: SKELETON LOADER COMPONENT (Matched height with TasksTab cards - h-[450px])
function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 flex flex-col h-[450px] animate-pulse overflow-hidden">
      <div className="w-full h-40 bg-slate-200 shrink-0"></div>
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded-full w-16"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded-md w-1/2 mb-4"></div>
        <div className="space-y-2 mb-4">
          <div className="h-2.5 bg-slate-100 rounded w-full"></div>
          <div className="h-2.5 bg-slate-100 rounded w-5/6"></div>
          <div className="h-2.5 bg-slate-100 rounded w-4/6"></div>
        </div>
        <div className="h-10 bg-slate-200 rounded-lg w-full mt-auto"></div>
      </div>
    </div>
  );
}

// ✨ NEW: EMPTY STATE COMPONENT (Matched height with TasksTab cards - h-[450px])
function EmptyState({ icon: Icon, title, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-[450px] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-3xl p-6 text-center">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
        <Icon size={24} className="text-slate-400" />
      </div>
      <h4 className="text-sm font-bold text-slate-600 mb-1">{title}</h4>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}