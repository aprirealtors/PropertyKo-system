"use client";

import React, { useState } from "react";
import { MapPin, X, CheckCircle, PauseCircle, Camera, DollarSign, AlertCircle, AlertTriangle, Wrench } from "lucide-react";
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

      const finalStatus = completionStatus === "Success" ? "completed" : "on_hold";
      const updatePayload: any = { status: finalStatus, cost: parseFloat(completionCost) || 0, updated_at: new Date().toISOString() };
      if (photoUrl) updatePayload.resolution_photo_url = photoUrl;

      const { error } = await supabase.from('maintenance_tasks').update(updatePayload).eq('id', completeModalTask);
      if (error) throw error;

      const { data: ticketData } = await supabase.from('tickets').select('*').ilike('title', task.title).ilike('location', task.location).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (ticketData) await supabase.from('tickets').update({ status: completionStatus === "Success" ? "Resolved" : "On Hold" }).eq('id', ticketData.id);

      let notifMessage = `${profile.name} marked this task as COMPLETED. Remarks: ${completionRemarks}`;
      if (completionStatus === "On Hold") notifMessage = `${profile.name} put this task ON HOLD. Reason: ${onHoldReason === "Other" ? customHoldReason : onHoldReason}.`;

      const notificationsToInsert = [{ admin_email: task.admin_email, recipient: 'MANAGER', type: 'MAINTENANCE', title: `Task ${completionStatus}: ${task.title}`, message: notifMessage, reference_id: task.id, is_read: false }];
      if (ticketData?.reporter_email) {
        notificationsToInsert.push({ admin_email: task.admin_email, recipient: ticketData.reporter_email, type: 'MAINTENANCE', title: `Repair Update: ${task.title}`, message: `Your repair request was marked as ${completionStatus.toUpperCase()}. ${completionStatus === 'On Hold' ? 'It is currently on hold.' : 'It has been resolved!'}`, reference_id: task.id, is_read: false });
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
    <div className="flex flex-col w-full h-auto md:h-[calc(100vh-100px)] pb-10 md:pb-4">
      <div className="flex-none pb-6 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">My Tasks</h2>
        <p className="text-slate-500 text-sm mt-1">Manage and update your assigned maintenance tickets.</p>
      </div>

      {/* Kanban Board - 3 Columns */}
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-full w-full">
          
          {/* OPEN TASKS COLUMN */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center justify-between">
              Open & In Progress <span className="bg-blue-100 text-[#1d82f5] px-2.5 py-0.5 rounded-full text-xs font-bold">{openTasks.length}</span>
            </h4>
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {openTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No active tasks</div> : (
                openTasks.map((task: any) => (
                  <div key={task.id} className={`h-auto min-h-[260px] bg-white rounded-2xl shadow-sm border flex flex-col ${task.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'}`}>
                    {task.photo_url ? (
                      <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100"><img src={task.photo_url} className="w-full h-full object-cover rounded-t-2xl" /></div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center rounded-t-2xl"><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span></div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-bold text-[#0a1e3f] text-sm leading-snug">{task.title}</h4>
                        {task.status === 'in_progress' && <span className="bg-blue-100 text-[#1d82f5] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-0.5">In Progress</span>}
                      </div>
                      <div className="flex items-center justify-between mb-2 mt-1">
                        <p className="text-[#359b46] font-semibold text-xs pr-2"><MapPin size={12} className="inline mr-1 -mt-0.5" />{task.location}</p>
                        {task.priority === 'Urgent' && <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">🚨 URGENT</span>}
                      </div>
                      <p className="text-xs text-slate-500 flex-1">{task.description}</p>
                      <div className="shrink-0 pt-4 mt-auto">
                        {task.status === 'pending' ? (
                          <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#359b46] text-white hover:bg-[#2c813a] transition-colors shadow-sm">Start Task</button>
                        ) : (
                          <button onClick={() => openCompleteModal(task.id)} className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#1d82f5] text-white hover:bg-blue-600 transition-colors shadow-sm">Update / Finish</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ON HOLD TASKS COLUMN */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center justify-between">
              On Hold <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{onHoldTasks.length}</span>
            </h4>
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {onHoldTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No tasks on hold</div> : (
                onHoldTasks.map((task: any) => (
                  <div key={task.id} className={`h-auto min-h-[260px] bg-slate-50 rounded-2xl shadow-sm border flex flex-col ${task.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'}`}>
                    {task.photo_url ? (
                      <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100"><img src={task.photo_url} className="w-full h-full object-cover rounded-t-2xl grayscale-[30%]" /></div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center rounded-t-2xl"><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span></div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-bold text-slate-600 text-sm leading-snug">{task.title}</h4>
                        <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 mt-0.5">On Hold</span>
                      </div>
                      <div className="flex items-center justify-between mb-2 mt-1">
                        <p className="text-slate-500 font-semibold text-xs pr-2"><MapPin size={12} className="inline mr-1 -mt-0.5" />{task.location}</p>
                        {task.priority === 'Urgent' && <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">🚨 URGENT</span>}
                      </div>
                      <p className="text-xs text-slate-500 flex-1">{task.description}</p>
                      <div className="shrink-0 pt-4 mt-auto">
                        <button onClick={() => openCompleteModal(task.id)} className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm">Update Report</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RESOLVED TASKS COLUMN */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 flex items-center justify-between">
              Resolved <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{resolvedTasks.length}</span>
            </h4>
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {resolvedTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No resolved tasks</div> : (
                resolvedTasks.map((task: any) => (
                  <div key={task.id} onClick={() => setReviewTask(task)} className="h-auto min-h-[260px] bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden flex flex-col hover:shadow-md transition-all duration-300 cursor-pointer hover:border-emerald-300 active:scale-[0.98]">
                    {(task.resolution_photo_url || task.photo_url) ? (
                      <div className="relative w-full h-32 shrink-0 bg-emerald-50 border-b border-emerald-100"><img src={task.resolution_photo_url || task.photo_url} alt="Resolved issue" className="w-full h-full object-cover" /></div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 bg-emerald-50 border-b border-emerald-100 flex items-center justify-center"><span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">No Photo</span></div>
                    )}
                    <div className="p-4 flex-1 flex flex-col bg-emerald-50/30">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle size={14} className="text-[#359b46] mt-0.5 shrink-0" />
                          <h4 className="font-bold text-[#0a1e3f] text-sm leading-snug">{task.title}</h4>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border bg-emerald-50 text-[#359b46] border-emerald-100 mt-0.5">Success</span>
                      </div>
                      <p className="text-slate-500 font-semibold text-xs mt-1 pr-2 mb-2"><MapPin size={12} className="inline mr-1 -mt-0.5" />{task.location}</p>
                      <p className="text-xs flex-1 text-slate-500">{task.description}</p>
                      <div className="shrink-0 flex items-center justify-between mt-4 pt-3 border-t border-emerald-200/60 text-xs">
                        <span className="font-medium px-2 py-0.5 rounded-full border bg-white text-slate-600 border-slate-200">👤 You</span>
                        {task.cost !== undefined && task.cost > 0 ? (
                          <span className="font-black text-[#0a1e3f] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">₱{task.cost.toLocaleString()}</span>
                        ) : (
                          <span className="font-bold text-slate-400 text-[10px] uppercase">No Cost</span>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4 overflow-y-auto">
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
                      <select required value={onHoldReason} onChange={(e) => { setOnHoldReason(e.target.value); if (e.target.value !== "Other") setCustomHoldReason(""); }} className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-amber-900" disabled={isCompleting}>
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
                        <input type="text" required value={customHoldReason} onChange={(e) => setCustomHoldReason(e.target.value)} placeholder="Type the specific reason here..." className="w-full px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm text-amber-900 placeholder:text-amber-700/50" disabled={isCompleting} />
                      </div>
                    )}
                  </div>
                )}

                {completionStatus === "Success" && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Remarks / Notes</label>
                    <textarea required value={completionRemarks} onChange={(e) => setCompletionRemarks(e.target.value)} placeholder="Briefly describe what was fixed..." className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0a1e3f] focus:border-transparent min-h-[80px]" disabled={isCompleting} />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Proof of Work / Visit</label>
                  <label className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-[#359b46] hover:bg-emerald-50 transition-all cursor-pointer bg-slate-50">
                    <Camera size={24} className={completionImage ? "text-[#359b46]" : ""} />
                    <span className={`text-sm text-center px-2 ${completionImage ? 'text-[#0a1e3f] font-medium' : 'text-slate-500'}`}>
                      {completionImage ? completionImage.name : "Upload photo (e.g. fixed item or closed door)"}
                    </span>
                    <input type="file" accept="image/*" onChange={(e) => e.target.files && setCompletionImage(e.target.files[0])} className="hidden" disabled={isCompleting} />
                  </label>
                </div>

                {completionStatus === "Success" && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Equipment Cost (Optional)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="number" min="0" step="0.01" placeholder="e.g. 500 for parts" value={completionCost} onChange={(e) => setCompletionCost(e.target.value)} className="w-full pl-10 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" disabled={isCompleting} />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setCompleteModalTask(null)} disabled={isCompleting} className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                  <button type="submit" disabled={isCompleting || !completionStatus} className="flex-1 bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:text-slate-500 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">{isCompleting ? "Submitting..." : "Submit Report"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION REVIEW MODAL */}
      {reviewTask && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-[60] flex items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[93vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2 truncate">{reviewTask.title}</h2>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 mt-1 truncate"><MapPin size={14} className="text-slate-400 shrink-0" /> {reviewTask.location}</div>
              </div>
              <button onClick={() => setReviewTask(null)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors p-2 rounded-xl shrink-0"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-0 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 h-full">
                
                {/* BEFORE */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Before</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-700">Reported Issue</span>
                  </div>
                  <div className="w-full aspect-video sm:h-48 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTask.photo_url ? (
                      <img src={reviewTask.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={28} className="mx-auto mb-1.5 opacity-40" /><span className="text-xs font-medium block">No photo submitted</span></div>
                    )}
                  </div>
                  <div className="flex-1 bg-slate-50/60 rounded-xl p-3 sm:p-4 border border-slate-100 flex flex-col justify-between">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">{reviewTask.description}</p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-medium border-t border-slate-200/60 pt-2.5 mt-3 shrink-0">
                      Reported on: {new Date(reviewTask.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">After</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700">My Resolution</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-[#359b46] border-emerald-100 shrink-0">Success</span>
                  </div>
                  <div className="w-full aspect-video sm:h-48 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTask.resolution_photo_url ? (
                      <img src={reviewTask.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Wrench size={28} className="mx-auto mb-1.5 opacity-40" /><span className="text-xs font-medium block">No photo uploaded</span></div>
                    )}
                  </div>
                  <div className="bg-slate-50/60 rounded-xl p-3 sm:p-4 border border-slate-100 space-y-3 shrink-0">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">👤 Staff In Charge</span>
                      <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">You</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200/60 pt-3 text-xs sm:text-sm">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Equipment Cost</span>
                      {reviewTask.cost !== undefined && reviewTask.cost > 0 ? (
                        <span className="font-extrabold text-[#0a1e3f] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200/60">₱{reviewTask.cost.toLocaleString()}</span>
                      ) : (
                        <span className="font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] uppercase">₱0.00</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100 shrink-0 md:hidden">
              <button onClick={() => setReviewTask(null)} className="w-full bg-[#0a1e3f] text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-[0.99] transition-all">Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ALERT MODAL */}
      {alertConfig.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0a1e3f]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${alertConfig.type === 'success' ? 'bg-emerald-50 text-[#359b46]' : alertConfig.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
              {alertConfig.type === 'success' && <CheckCircle size={36} />}
              {alertConfig.type === 'error' && <AlertCircle size={36} />}
              {alertConfig.type === 'warning' && <AlertTriangle size={36} />}
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">{alertConfig.title}</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap">{alertConfig.message}</p>
            <button onClick={() => setAlertConfig({ ...alertConfig, isOpen: false })} className={`w-full text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm ${alertConfig.type === 'success' ? 'bg-[#359b46] hover:bg-[#2c813a]' : alertConfig.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}