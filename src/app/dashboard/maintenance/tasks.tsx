"use client";

import React, { useState } from "react";
import { MapPin, X, CheckCircle, PauseCircle, Camera, DollarSign, AlertCircle, AlertTriangle, Wrench, Clock, Activity, Info } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

export default function TasksTab({ tasks, profile, showToast, fetchTasks }: any) {
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

      // Format Custom Reason (Sentence case / First letter Capitalized)
      const formattedCustomReason = customHoldReason.trim() 
        ? customHoldReason.trim().charAt(0).toUpperCase() + customHoldReason.trim().slice(1)
        : "";

      // ✨ FIX: Format Remarks (Sentence case / First letter Capitalized)
      const formattedRemarks = completionRemarks.trim()
        ? completionRemarks.trim().charAt(0).toUpperCase() + completionRemarks.trim().slice(1)
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
    <div className="flex flex-col w-full relative pb-10">
      
      {/* PREMIUM HEADER */}
      <div className="mb-6">
        <div className="bg-white px-5 py-4 sm:px-6 sm:py-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-[#0a1e3f] tracking-tight">My Tasks</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">Manage and update your assigned maintenance tickets.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Activity size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-slate-700">{openTasks.length} Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start w-full">
        
        {/* COLUMN 1: OPEN TASKS */}
        <div className="flex flex-col bg-slate-100/50 rounded-3xl p-4 sm:p-5 border border-slate-200/60 w-full shrink-0">
          <h4 className="font-bold text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1">
            <span className="flex items-center gap-2"><Clock size={16} className="text-blue-500"/> Open & In Progress</span>
            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-black">{openTasks.length}</span>
          </h4>
          <div className="flex flex-col space-y-4">
            {openTasks.length === 0 ? <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-semibold text-slate-400 bg-white/50">No active tasks</div> : (
              openTasks.map((task: any) => (
                <div key={task.id} className={`h-[450px] bg-white rounded-3xl border transition-all duration-300 flex flex-col group hover:-translate-y-1 hover:shadow-lg ${task.priority === 'Urgent' ? 'border-red-300 shadow-red-500/5 hover:border-red-400' : 'border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                  {task.photo_url ? (
                    <div className="relative w-full h-40 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden rounded-t-3xl">
                      <img src={task.photo_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="relative w-full h-40 shrink-0 bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center rounded-t-3xl text-slate-300">
                      <Camera size={24} className="mb-2 opacity-50" /><span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                    </div>
                  )}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-start mb-1 gap-2 shrink-0">
                      <h4 className="font-extrabold text-[#0a1e3f] text-sm leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">{task.title}</h4>
                      {task.status === 'in_progress' && <span className="bg-blue-50 text-blue-600 border border-blue-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 mt-0.5 shadow-sm">In Progress</span>}
                    </div>
                    <div className="flex items-center justify-between mb-3 mt-1.5 shrink-0">
                      <p className="text-[#359b46] font-semibold text-xs pr-2 flex items-center gap-1 truncate"><MapPin size={12} className="shrink-0"/> <span className="truncate">{task.location}</span></p>
                      {task.priority === 'Urgent' && <span className="bg-red-50 text-red-600 border border-red-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 shadow-sm animate-pulse">🚨 URGENT</span>}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">{task.description}</p>
                    <div className="shrink-0 mt-auto">
                      {task.status === 'pending' ? (
                        <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-[#359b46] text-white hover:bg-[#2c813a] active:scale-[0.98] transition-all shadow-sm">Start Task</button>
                      ) : (
                        <button onClick={() => openCompleteModal(task.id)} className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm">Update / Finish</button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: ON HOLD TASKS */}
        <div className="flex flex-col bg-slate-100/50 rounded-3xl p-4 sm:p-5 border border-slate-200/60 w-full shrink-0">
          <h4 className="font-bold text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1">
            <span className="flex items-center gap-2"><PauseCircle size={16} className="text-amber-500"/> On Hold</span>
            <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-black">{onHoldTasks.length}</span>
          </h4>
          <div className="flex flex-col space-y-4">
            {onHoldTasks.length === 0 ? <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-semibold text-slate-400 bg-white/50">No tasks on hold</div> : (
              onHoldTasks.map((task: any) => (
                <div key={task.id} 
                     onClick={() => setReviewTask(task)} /* ✨ GINAWANG CLICKABLE PARA SA MODAL */
                     className={`h-[450px] bg-slate-50/80 rounded-3xl border transition-all duration-300 flex flex-col group hover:-translate-y-1 hover:shadow-md cursor-pointer ${task.priority === 'Urgent' ? 'border-red-300 shadow-red-500/5' : 'border-slate-200 hover:border-amber-300'}`}>
                  {task.photo_url ? (
                    <div className="relative w-full h-40 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden rounded-t-3xl">
                      <img src={task.photo_url} className="w-full h-full object-cover grayscale-[40%] group-hover:grayscale-0 transition-all duration-500" />
                    </div>
                  ) : (
                    <div className="relative w-full h-40 shrink-0 bg-slate-50 border-b border-slate-100 flex flex-col items-center justify-center rounded-t-3xl text-slate-300">
                      <Camera size={24} className="mb-2 opacity-50" /><span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                    </div>
                  )}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-start mb-1 gap-2 shrink-0">
                      <h4 className="font-bold text-slate-700 text-sm leading-snug group-hover:text-amber-700 transition-colors line-clamp-2">{task.title}</h4>
                      <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 mt-0.5 shadow-sm">On Hold</span>
                    </div>
                    <div className="flex items-center justify-between mb-3 mt-1.5 shrink-0">
                      <p className="text-slate-500 font-semibold text-xs pr-2 flex items-center gap-1 truncate"><MapPin size={12} className="shrink-0"/> <span className="truncate">{task.location}</span></p>
                      {task.priority === 'Urgent' && <span className="bg-red-50 text-red-600 border border-red-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 shadow-sm">🚨 URGENT</span>}
                    </div>
                    
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{task.description}</p>
                    
                    {/* DISPLAY THE ON HOLD REASON */}
                    {task.on_hold_reason && (
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex items-start gap-2 shadow-sm shrink-0">
                        <Info size={14} className="text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block mb-0.5">Reason for Hold</span>
                          <span className="text-xs font-semibold text-amber-900 leading-tight block line-clamp-2">{task.on_hold_reason}</span>
                        </div>
                      </div>
                    )}

                    <div className="shrink-0 mt-auto">
                      {/* ✨ FIX: nilagyan natin ng e.stopPropagation para hindi mag-trigger yung Modal kapag Button ang pinindot */}
                      <button onClick={(e) => { e.stopPropagation(); openCompleteModal(task.id); }} className="w-full py-3 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition-all shadow-sm">Update Report</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: RESOLVED TASKS */}
        <div className="flex flex-col bg-slate-100/50 rounded-3xl p-4 sm:p-5 border border-slate-200/60 w-full shrink-0">
          <h4 className="font-bold text-[#0a1e3f] text-sm mb-4 flex items-center justify-between px-1">
            <span className="flex items-center gap-2"><CheckCircle size={16} className="text-[#359b46]"/> Resolved</span>
            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-black">{resolvedTasks.length}</span>
          </h4>
          <div className="flex flex-col space-y-4">
            {resolvedTasks.length === 0 ? <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-semibold text-slate-400 bg-white/50">No resolved tasks</div> : (
              resolvedTasks.map((task: any) => (
                <div key={task.id} onClick={() => setReviewTask(task)} className={`h-[450px] bg-white rounded-3xl border border-emerald-200/60 flex flex-col group hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-[#359b46]/50 active:scale-[0.98]`}>
                  {(task.resolution_photo_url || task.photo_url) ? (
                    <div className="relative w-full h-40 shrink-0 bg-emerald-50/50 border-b border-emerald-100/50 overflow-hidden rounded-t-3xl">
                      <img src={task.resolution_photo_url || task.photo_url} alt="Resolved issue" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="relative w-full h-40 shrink-0 bg-emerald-50/30 border-b border-emerald-100/50 flex flex-col items-center justify-center rounded-t-3xl text-emerald-300">
                      <Camera size={24} className="mb-2 opacity-50" /><span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                    </div>
                  )}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col bg-emerald-50/10 rounded-b-3xl overflow-hidden">
                    <div className="flex justify-between items-start mb-1 gap-2 shrink-0">
                      <div className="flex items-start gap-2 overflow-hidden">
                        <CheckCircle size={16} className="text-[#359b46] mt-0.5 shrink-0" />
                        <h4 className="font-extrabold text-[#0a1e3f] text-sm leading-snug group-hover:text-[#359b46] transition-colors line-clamp-2">{task.title}</h4>
                      </div>
                      <span className="bg-emerald-50 text-[#359b46] border border-emerald-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 mt-0.5 shadow-sm">Success</span>
                    </div>
                    <p className="text-slate-500 font-semibold text-xs mt-2 pr-2 mb-2 flex items-center gap-1 shrink-0 truncate"><MapPin size={12} className="shrink-0" /> <span className="truncate">{task.location}</span></p>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{task.description}</p>
                    
                    {/* DISPLAY THE REMARKS */}
                    {task.remarks && (
                      <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-xl p-3 mb-4 flex items-start gap-2 shadow-sm shrink-0">
                        <CheckCircle size={14} className="text-[#359b46] mt-0.5 shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#359b46] block mb-0.5">Remarks / Notes</span>
                          <span className="text-xs font-semibold text-emerald-900 leading-tight block line-clamp-2">{task.remarks}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="shrink-0 flex items-center justify-between mt-auto pt-4 border-t border-slate-200/60 text-xs">
                      <span className="font-bold px-2.5 py-1 rounded-lg border bg-white text-slate-500 border-slate-200 shadow-sm flex items-center gap-1.5"><Activity size={12}/> You</span>
                      {task.cost !== undefined && task.cost > 0 ? (
                        <span className="font-black text-[#0a1e3f] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">₱{task.cost.toLocaleString()}</span>
                      ) : (
                        <span className="font-bold text-slate-400 text-[9px] uppercase tracking-wider">No Cost</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* UPDATE / COMPLETE MODAL */}
      {completeModalTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col my-8">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-extrabold text-[#0a1e3f]">Submit Task Report</h2>
              <button onClick={() => !isCompleting && setCompleteModalTask(null)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors" disabled={isCompleting}>
                <X size={18} />
              </button>
            </div>

            <div className="p-6 bg-slate-50/50">
              <form onSubmit={handleCompleteTask} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Repair Result</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center gap-2 p-4 border-2 rounded-2xl cursor-pointer transition-all ${completionStatus === "Success" ? "border-[#359b46] bg-emerald-50 text-[#2c813a] shadow-sm" : "border-slate-200/70 text-slate-500 hover:border-slate-300 hover:bg-white bg-white"}`}>
                      <input type="radio" name="status" value="Success" checked={completionStatus === "Success"} onChange={(e) => {setCompletionStatus(e.target.value); setOnHoldReason(""); setCustomHoldReason("");}} className="hidden" />
                      <CheckCircle size={20} className={completionStatus === "Success" ? "text-[#359b46]" : "text-slate-400"} />
                      <span className="font-bold text-sm">Success</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-4 border-2 rounded-2xl cursor-pointer transition-all ${completionStatus === "On Hold" ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm" : "border-slate-200/70 text-slate-500 hover:border-slate-300 hover:bg-white bg-white"}`}>
                      <input type="radio" name="status" value="On Hold" checked={completionStatus === "On Hold"} onChange={(e) => setCompletionStatus(e.target.value)} className="hidden" />
                      <PauseCircle size={20} className={completionStatus === "On Hold" ? "text-amber-500" : "text-slate-400"} />
                      <span className="font-bold text-sm">On Hold</span>
                    </label>
                  </div>
                </div>

                {completionStatus === "On Hold" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Reason for holding</label>
                      <select required value={onHoldReason} onChange={(e) => { setOnHoldReason(e.target.value); if (e.target.value !== "Other") setCustomHoldReason(""); }} className="w-full px-4 py-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-amber-900 transition-shadow" disabled={isCompleting}>
                        <option value="" disabled>Select reason...</option>
                        <option value="Need Parts">Need Parts</option>
                        <option value="No Access">No Access</option>
                        <option value="Budget Approval">Budget Approval</option>
                        <option value="Other">Other reason...</option>
                      </select>
                    </div>
                    {onHoldReason === "Other" && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex justify-between">
                          <span>Please specify reason</span>
                          <span className="font-normal text-[10px]">{customHoldReason.length}/25</span>
                        </label>
                        <input type="text" required maxLength={25} value={customHoldReason} onChange={(e) => setCustomHoldReason(e.target.value)} placeholder="Type the specific reason here..." className="w-full px-4 py-3.5 rounded-2xl border border-amber-200 bg-amber-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-amber-900 placeholder:text-amber-700/40 transition-shadow" disabled={isCompleting} />
                      </div>
                    )}
                  </div>
                )}

                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* ✨ FIX: Added Length Limiter to Remarks (max 30) */}
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1 flex justify-between">
                      <span>Remarks / Notes</span>
                      <span className="font-normal text-[10px]">{completionRemarks.length}/30</span>
                    </label>
                    <textarea required maxLength={30} value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Briefly describe what was fixed..." className="w-full border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] min-h-[100px] transition-shadow shadow-sm bg-white" disabled={isCompleting} />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Proof of Work / Visit</label>
                  <label className="w-full p-6 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-[#359b46] hover:bg-emerald-50/50 transition-all cursor-pointer bg-white">
                    <div className={`p-3 rounded-full ${completionImage ? 'bg-emerald-100 text-[#359b46]' : 'bg-slate-100 text-slate-400'}`}>
                      <Camera size={24} />
                    </div>
                    <span className={`text-sm text-center px-4 ${completionImage ? 'text-[#0a1e3f] font-extrabold' : 'text-slate-500 font-medium'}`}>
                      {completionImage ? completionImage.name : "Tap to upload photo of the result or visit"}
                    </span>
                    <input type="file" accept="image/*" onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])} className="hidden" disabled={isCompleting} />
                  </label>
                </div>

                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Equipment Cost (Optional)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={completionCost} onChange={(e) => setCompletionCost(e.target.value)} className="w-full pl-11 p-3.5 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm font-extrabold text-slate-700 shadow-sm transition-shadow" disabled={isCompleting} />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setCompleteModalTask(null)} disabled={isCompleting} className="flex-1 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-200/70 hover:bg-slate-300 transition-colors">Cancel</button>
                  <button type="submit" disabled={isCompleting || !completionStatus} className="flex-[2] bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:text-slate-500 text-white py-3.5 rounded-2xl text-sm font-extrabold transition-all shadow-md active:scale-[0.98] flex items-center justify-center">
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

      {/* RESOLUTION REVIEW MODAL (Para sa Resolved at On Hold) */}
      {reviewTask && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-[60] flex items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[93vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2 truncate">{reviewTask.title}</h2>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 mt-1 truncate"><MapPin size={14} className="text-slate-400 shrink-0" /> {reviewTask.location}</div>
              </div>
              <button onClick={() => setReviewTask(null)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 rounded-full shrink-0"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-0 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 h-full">
                
                {/* BEFORE */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/60 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200/50">Before</span>
                    <span className="text-sm font-extrabold text-slate-700">Reported Issue</span>
                  </div>
                  <div className="w-full aspect-video sm:h-56 bg-slate-100 rounded-2xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTask.photo_url ? (
                      <img src={reviewTask.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-30" /><span className="text-[10px] font-bold uppercase tracking-widest block">No photo submitted</span></div>
                    )}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-200/60 flex flex-col justify-between">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">{reviewTask.description}</p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold border-t border-slate-200 pt-3 mt-4 shrink-0 uppercase tracking-wider">
                      Reported: {new Date(reviewTask.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER (Dynamic: On Hold o Resolved) */}
                {reviewTask.status === 'on_hold' ? (
                  // ✨ ON HOLD THEME
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-amber-200/60 shadow-sm flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200/50">After</span>
                        <span className="text-sm font-extrabold text-slate-700">Hold Status</span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-amber-50 text-amber-600 border-amber-200/60 shrink-0">On Hold</span>
                    </div>
                    <div className="w-full aspect-video sm:h-56 bg-amber-50/50 rounded-2xl border border-amber-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {reviewTask.resolution_photo_url ? (
                        <img src={reviewTask.resolution_photo_url} alt="On hold proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                      ) : (
                        <div className="text-center text-amber-300 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-[10px] font-bold uppercase tracking-widest block">No photo uploaded</span></div>
                      )}
                    </div>
                    <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100 space-y-3 shrink-0">
                      <div className="flex justify-between items-center text-xs sm:text-sm mb-1">
                        <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest flex items-center gap-1.5"><Info size={14}/> Hold Reason</span>
                        <span className="font-extrabold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm">{reviewTask.on_hold_reason}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-amber-200/60 pt-3 text-xs sm:text-sm">
                        <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14}/> Staff In Charge</span>
                        <span className="font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm">You</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // SUCCESS THEME
                  <div className="bg-white rounded-3xl p-4 sm:p-5 border border-emerald-200/60 shadow-sm flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200/50">After</span>
                        <span className="text-sm font-extrabold text-slate-700">My Resolution</span>
                      </div>
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-[#359b46] border-emerald-200/60 shrink-0">Success</span>
                    </div>
                    <div className="w-full aspect-video sm:h-56 bg-emerald-50/50 rounded-2xl border border-emerald-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                      {reviewTask.resolution_photo_url ? (
                        <img src={reviewTask.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" />
                      ) : (
                        <div className="text-center text-emerald-300 p-4"><Wrench size={32} className="mx-auto mb-2 opacity-40" /><span className="text-[10px] font-bold uppercase tracking-widest block">No photo uploaded</span></div>
                      )}
                    </div>
                    <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100 space-y-3 shrink-0">
                      <div className="flex justify-between items-center text-xs sm:text-sm">
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest flex items-center gap-1.5"><Activity size={14}/> Staff In Charge</span>
                        <span className="font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">You</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-emerald-200/60 pt-3 text-xs sm:text-sm">
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest flex items-center gap-1.5"><DollarSign size={14}/> Equipment Cost</span>
                        {reviewTask.cost !== undefined && reviewTask.cost > 0 ? (
                          <span className="font-black text-[#0a1e3f] bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">₱{reviewTask.cost.toLocaleString()}</span>
                        ) : (
                          <span className="font-bold text-slate-400 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] uppercase shadow-sm">₱0.00</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 shrink-0 md:hidden pb-safe">
              <button onClick={() => setReviewTask(null)} className="w-full bg-[#0a1e3f] text-white py-3.5 rounded-2xl font-extrabold text-sm shadow-lg shadow-[#0a1e3f]/20 active:scale-[0.98] transition-all">Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ALERT MODAL */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center transform transition-all animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner ${alertConfig.type === 'success' ? 'bg-emerald-50 text-[#359b46] border border-emerald-100' : alertConfig.type === 'error' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-amber-50 text-amber-500 border border-amber-100'}`}>
              {alertConfig.type === 'success' && <CheckCircle size={32} strokeWidth={2.5} />}
              {alertConfig.type === 'error' && <AlertCircle size={32} strokeWidth={2.5} />}
              {alertConfig.type === 'warning' && <AlertTriangle size={32} strokeWidth={2.5} />}
            </div>
            <h2 className="text-xl font-extrabold text-[#0a1e3f] mb-2">{alertConfig.title}</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap font-medium">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className={`w-full text-white px-4 py-3.5 rounded-2xl text-sm font-extrabold transition-all shadow-md active:scale-[0.98] ${alertConfig.type === 'success' ? 'bg-[#359b46] hover:bg-[#2c813a] shadow-emerald-600/20' : alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600 shadow-red-600/20' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-600/20'}`}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}