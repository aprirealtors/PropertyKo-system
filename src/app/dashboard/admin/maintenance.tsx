"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Wrench, MapPin, User, HardHat, Bell, CheckCircle2, Camera, Clock, AlertCircle, Inbox, PauseCircle } from "lucide-react";

export default function MaintenanceTab({ orgData, isLoading: isOrgLoading, highlightTicketId }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [inboxTickets, setInboxTickets] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]); 
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [reviewTicket, setReviewTicket] = useState<any | null>(null);

  const [selectedInboxId, setSelectedInboxId] = useState(""); 
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [visitTime, setVisitTime] = useState(""); 
  const [reporter, setReporter] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Normal"); 

  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTickets();
      fetchTeamMembers();
      fetchUnits();

      // 🟦 LIVE TICKETS CHANNEL (Para sa Pending Inbox dropdown/badge)
      const ticketsChannel = supabase
        .channel('manager-live-tickets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tickets',
            filter: `admin_email=eq.${orgData.admin_email}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              if (payload.new.status === 'Open') {
                setInboxTickets((current: any[]) => {
                  // ✨ KONTRA-DUPLICATION FILTER:
                  // Tinitiyak na hindi maisasaksak nang dalawang beses ang id kapag nag-trigger ang manual fetch at realtime
                  const exists = current.some(t => t.id === payload.new.id);
                  if (exists) return current;
                  return [payload.new, ...current];
                });
              }
            } else if (payload.eventType === 'UPDATE') {
              if (payload.new.status === 'Open') {
                setInboxTickets((current: any[]) => {
                  const exists = current.find(t => t.id === payload.new.id);
                  if (exists) return current.map(t => (t.id === payload.new.id ? payload.new : t));
                  return [payload.new, ...current];
                });
              } else {
                setInboxTickets((current: any[]) => current.filter(t => t.id !== payload.new.id));
              }
            } else if (payload.eventType === 'DELETE') {
              setInboxTickets((current: any[]) => current.filter(t => t.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // 🟩 LIVE TASKS CHANNEL (Para sa Kanban Board columns)
      const tasksChannel = supabase
        .channel('manager-live-tasks')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'maintenance_tasks',
            filter: `admin_email=eq.${orgData.admin_email}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setTickets((current: any[]) => {
                // ✨ KONTRA-DUPLICATION FILTER:
                // Sinasala ang mga umiiral nang task ID sa state bago mag-append
                const exists = current.some(t => t.id === payload.new.id);
                if (exists) return current;
                return [payload.new, ...current];
              });
            } else if (payload.eventType === 'UPDATE') {
              setTickets((current: any[]) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => (t.id === payload.new.id ? { ...t, ...payload.new } : t));
                return [payload.new, ...current];
              });
            } else if (payload.eventType === 'DELETE') {
              setTickets((current: any[]) => current.filter(t => t.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ticketsChannel);
        supabase.removeChannel(tasksChannel);
      };
    }
  }, [orgData?.admin_email]);

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    const { data: tasksData } = await supabase.from('maintenance_tasks').select('*').eq('admin_email', orgData.admin_email).order('created_at', { ascending: false });
    if (tasksData) setTickets(tasksData);

    const { data: inboxData } = await supabase.from('tickets').select('*').eq('admin_email', orgData.admin_email).eq('status', 'Open').order('created_at', { ascending: false });
    if (inboxData) setInboxTickets(inboxData);

    setIsLoadingTickets(false);
  };

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase.from('team_members').select('name, email, role').eq('admin_email', orgData.admin_email); 
    if (!error && data) setTeamMembers(data);
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').eq('admin_email', orgData.admin_email).order('property_name', { ascending: true }).order('unit_number', { ascending: true }); 
    if (data) setUnits(data);
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    if (!assignedTo) {
      setErrorMsg("Please assign this ticket to a maintenance staff member.");
      setIsSubmitting(false);
      return;
    }

    try {
      let photoUrlToSave = "";
      if (selectedInboxId) {
        const matchingInboxTicket = inboxTickets.find(t => String(t.id) === selectedInboxId);
        if (matchingInboxTicket && matchingInboxTicket.photo_url) photoUrlToSave = matchingInboxTicket.photo_url;
      }
      const finalDesc = `${visitTime ? `Best time to visit: ${visitTime.trim()}. ` : ''}Reported by ${reporter.trim() || 'Resident'}.`; 

      const { data: newTask, error } = await supabase.from('maintenance_tasks').insert([{ 
        admin_email: orgData.admin_email, title: title, location: location, description: finalDesc, status: 'pending', assigned_to: assignedTo, cost: 0, photo_url: photoUrlToSave, priority: priority 
      }]).select().single();

      if (error) throw new Error(`Database Error: ${error.message}`);

      if (selectedInboxId) await supabase.from('tickets').update({ status: 'Assigned to Maintenance' }).eq('id', selectedInboxId);

      await fetchTickets(); 
      setIsModalOpen(false);
      setSelectedInboxId(""); setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setAssignedTo(""); setPriority("Normal"); 

      if (newTask) {
        setTimeout(() => {
          const targetElement = document.getElementById(`maintenance-card-${newTask.id}`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            setActiveHighlightId(newTask.id);
            setTimeout(() => setActiveHighlightId(null), 3500);
          }
        }, 500);
      }

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTickets = tickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'pending' || s === 'open';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));
  
  const inProgressTickets = tickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'in_progress' || s === 'in progress' || s === 'working';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const onHoldTickets = tickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'on_hold' || s === 'on hold';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));
  
  const resolvedTickets = tickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'completed' || s === 'resolved' || s === 'closed';
  });

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";

  useEffect(() => {
    if (highlightTicketId && !isLoadingTickets) {
      const actualId = highlightTicketId.split('_')[0];
      
      if (actualId !== "NEW") {
        setTimeout(() => {
          const targetElement = document.getElementById(`maintenance-card-${actualId}`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            setActiveHighlightId(actualId);
            setTimeout(() => setActiveHighlightId(null), 3500);
          }
        }, 300);
      }
    }
  }, [highlightTicketId, isLoadingTickets]);

  return (
      // ✨ LOCKED LAYOUT WINDOW SHELL: Nakakandado ang overall portal shell para hindi gumalaw ang background browser axis
      <div className="flex flex-col w-full h-[calc(100vh-140px)] md:h-[calc(100vh-160px)] relative pb-2 overflow-hidden font-sans selection:bg-[#359b46]/10">
        
        {/* PREMIUM HEADER - Static Shrink Block (Fixed Header Zone) */}
        <div className="shrink-0 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#0a1e3f] tracking-tight">Maintenance &amp; repairs</h2>
              <p className="text-slate-400 text-sm mt-0.5 font-medium">Tickets, vendors and SLA turnaround</p>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Search tenants, units..." className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] bg-white shadow-sm font-medium text-slate-700 placeholder:text-slate-400" />
              </div>
              <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                <span className="text-xs font-black text-[#359b46] uppercase tracking-wider">Admin</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-xs border border-emerald-100/60">{initials}</div>
              </div>
            </div>
          </div>
        </div>
  
        {/* SECONDARY ROW - Controls and Quick Badges */}
        <div className="shrink-0 flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-extrabold text-[#0a1e3f] text-base tracking-tight">Repair tickets</h3>
            {inboxTickets.length > 0 && (
              <span className="bg-red-50 border border-red-100 text-red-600 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-sm">
                {inboxTickets.length} Pending Inbox
              </span>
            )}
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 duration-150"
          >
            + New ticket
          </button>
        </div>
  
        {/* KANBAN BOARD WRAPPER - ✨ DITO ANG IISANG INTEGRATED VERTICAL OVERFLOW SCROLL SA BUONG APARTMENT TICKETS */}
        <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pr-1 pb-6 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start w-full">
            
            {/* COLUMN 1: OPEN */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">● Open</h4>
                <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-amber-100 shadow-inner">{isLoadingTickets ? "-" : openTickets.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoadingTickets ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : openTickets.length === 0 ? (
                  <EmptyState icon={Inbox} title="No open tickets" message="New maintenance requests will appear here." />
                ) : (
                  openTickets.map((ticket) => (
                    <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="yellow" statusLabel="New" />
                  ))
                )}
              </div>
            </div>
  
            {/* COLUMN 2: IN PROGRESS */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-blue-600 text-sm flex items-center gap-2">● In progress</h4>
                <span className="bg-blue-50 text-[#1d82f5] px-2.5 py-0.5 rounded-xl text-xs font-black border border-blue-100 shadow-inner">{isLoadingTickets ? "-" : inProgressTickets.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoadingTickets ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : inProgressTickets.length === 0 ? (
                  <EmptyState icon={Wrench} title="No active work" message="Tasks currently being worked on will be shown here." />
                ) : (
                  inProgressTickets.map((ticket) => (
                    <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="blue" statusLabel="Working" />
                  ))
                )}
              </div>
            </div>
  
            {/* COLUMN 3: ON HOLD */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-purple-600 text-sm flex items-center gap-2">● On Hold</h4>
                <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-purple-100 shadow-inner">{isLoadingTickets ? "-" : onHoldTickets.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoadingTickets ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : onHoldTickets.length === 0 ? (
                  <EmptyState icon={PauseCircle} title="Nothing on hold" message="Tasks that need further action or parts will be placed here." />
                ) : (
                  onHoldTickets.map((ticket) => (
                    <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="purple" statusLabel="On Hold" />
                  ))
                )}
              </div>
            </div>
  
            {/* COLUMN 4: RESOLVED */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-[#359b46] text-sm flex items-center gap-2">● Resolved</h4>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-emerald-100 shadow-inner">{isLoadingTickets ? "-" : resolvedTickets.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoadingTickets ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : resolvedTickets.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="No resolved tickets" message="Successfully completed tasks will be logged here." />
                ) : (
                  resolvedTickets.map((ticket) => (
                    <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="green" statusLabel="Closed" showCost onClick={() => setReviewTicket(ticket)} />
                  ))
                )}
              </div>
            </div>
  
          </div>
        </div>
  
        {/* RESOLUTION REVIEW MODAL */}
        {reviewTicket && (
          <div className="fixed inset-0 bg-[#0a1e3f]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col border border-slate-200/40 animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-[#359b46]" size={18} strokeWidth={2.5} />
                  <h2 className="text-lg font-black text-[#0a1e3f] tracking-tight">Review Resolution</h2>
                </div>
                <button onClick={() => setReviewTicket(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-50 active:scale-90"><X size={16} strokeWidth={2.5} /></button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[75vh] bg-slate-50/50 space-y-6">
                <div>
                  <h3 className="font-bold text-base text-slate-800 tracking-tight mb-0.5">{reviewTicket.title}</h3>
                  <p className="text-xs text-slate-400 font-semibold flex items-center gap-1"><MapPin size={12}/> {reviewTicket.location}</p>
                </div>
                
                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Assigned Staff</span>
                    <span className="text-xs font-bold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/50 shadow-inner">{teamMembers?.find((m: any) => m.email === reviewTicket.assigned_to)?.name || reviewTicket.assigned_to.split('@')[0]}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Equipment Cost</span>
                    <span className="text-sm font-black text-[#0a1e3f] bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">₱{(reviewTicket.cost || 0).toLocaleString()}</span>
                  </div>
                  {reviewTicket.remarks && (
                    <div className="flex flex-col border-t border-slate-100 pt-3 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Staff Remarks</span>
                      <span className="text-xs font-semibold text-slate-600 italic bg-slate-50/60 p-3 rounded-xl border border-slate-200/40 block leading-relaxed">"{reviewTicket.remarks}"</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block ml-1">Proof of Resolution</span>
                  {reviewTicket.resolution_photo_url ? (
                    <div className="w-full h-56 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm">
                      <img src={reviewTicket.resolution_photo_url} alt="Fixed Issue" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-white text-slate-400 shadow-inner"><Camera size={24} strokeWidth={1.5} className="mb-1.5 opacity-50" /><span className="text-xs font-bold text-slate-400">No photo uploaded by staff.</span></div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0">
                <button onClick={() => setReviewTicket(null)} className="w-full bg-[#0a1e3f] hover:bg-[#122b54] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98]">Close Review</button>
              </div>
            </div>
          </div>
        )}
  
        {/* NEW TICKET MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-[#0a1e3f]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col my-8 border border-slate-200/40 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                <h2 className="text-lg font-black text-[#0a1e3f] tracking-tight">Create New Ticket</h2>
                <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-50 active:scale-90" disabled={isSubmitting}>
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[75vh] bg-slate-50/50">
                <form onSubmit={handleAddTicket} className="space-y-5">
                  {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-100">{errorMsg}</div>}
                  
                  {inboxTickets.length > 0 && (
                    <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 shadow-sm">
                      <label className="flex items-center gap-2 text-xs font-black text-[#0a1e3f] uppercase tracking-wider mb-2"><Bell size={14} className="text-[#1d82f5]" /> Process Pending Request</label>
                      <select
                        value={selectedInboxId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedInboxId(id);
                          if (id) {
                            const t = inboxTickets.find(x => String(x.id) === id);
                            if (t) {
                              setTitle(t.title || ""); setLocation(t.location || ""); setPriority(t.priority || "Normal");
                              const desc = t.description || "";
                              if (desc.includes("Best time to visit:")) {
                                const timeMatch = desc.split("Best time to visit:")[1]?.split(".")[0];
                                if (timeMatch) setVisitTime(timeMatch.trim());
                              } else setVisitTime("");
                              if (desc.includes("Reported by ")) {
                                const repMatch = desc.split("Reported by ")[1]?.split(".")[0];
                                if (repMatch) setReporter(repMatch.trim());
                              } else setReporter("Resident"); 
                            }
                          } else { setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setPriority("Normal"); }
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-semibold bg-white text-slate-700 shadow-inner"
                        disabled={isSubmitting}
                      >
                        <option value="">-- Create custom ticket from scratch --</option>
                        {inboxTickets.map(t => <option key={t.id} value={String(t.id)}>{t.priority === 'Urgent' ? '🚨 URGENT - ' : ''}{t.title} ({t.location})</option>)}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issue Description</label>
                    <input type="text" required placeholder="e.g. Aircon leaking" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Location / Unit</label>
                    <select required value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-semibold bg-white text-slate-700 shadow-sm" disabled={isSubmitting || !!selectedInboxId}>
                      <option value="" disabled>Select unit...</option>
                      <option value="Common Area">Common Area (Lobby, Hallway, etc.)</option>
                      {units.map((u) => <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>{u.property_name} {u.unit_number}</option>)}
                      {location && !units.find(u => `${u.property_name} - ${u.unit_number}` === location) && location !== "Common Area" && <option value={location}>{location} (Custom)</option>}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Best Time to Visit (Optional)</label>
                    <input type="text" placeholder="e.g. Tomorrow morning, Weekends only" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Reported By</label>
                    <input type="text" placeholder="e.g. Deivid Valderama (Owner)" value={reporter} onChange={(e) => setReporter(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Assign To</label>
                      <select required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-semibold bg-white text-slate-700 shadow-sm" disabled={isSubmitting}>
                        <option value="" disabled>Select staff...</option>
                        {teamMembers.filter(m => { const r = String(m.role || "").toLowerCase(); return !r.includes('owner') && !r.includes('tenant') && !r.includes('manager'); }).map((member) => ( <option key={member.email} value={member.email}>{member.name}</option> ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority Level</label>
                      <select required value={priority} onChange={(e) => setPriority(e.target.value)} className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-sm font-semibold bg-white text-slate-700 shadow-sm ${selectedInboxId ? "bg-slate-50 text-slate-400 cursor-not-allowed border-slate-100" : "focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46]"}`} disabled={isSubmitting || !!selectedInboxId}>
                        <option value="Normal">Normal (Flexible)</option>
                        <option value="Urgent">🚨 Urgent (Due Today)</option>
                      </select>
                      {selectedInboxId && <p className="text-[10px] text-slate-400 font-medium mt-1.5 italic ml-0.5">Priority set by user.</p>}
                    </div>
                  </div>
                  <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 duration-150">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-200 disabled:text-slate-400 border border-transparent text-white py-2.5 px-5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-[0.98]">{isSubmitting ? "Saving..." : "Create Ticket"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  function TicketCard({ id, ticket, teamMembers, statusColor, statusLabel, showCost, onClick, isHighlighted }: any) {
    const colors: any = {
      yellow: 'bg-amber-50 text-amber-700 border border-amber-100',
      blue: 'bg-blue-50 text-[#1d82f5] border border-blue-100',
      purple: 'bg-purple-50 text-purple-700 border border-purple-100',
      green: 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:shadow-emerald-500/20 hover:border-emerald-300 transition-all cursor-pointer',
    };
  
    let assigneeName = "Unassigned";
    if (ticket.assigned_to) {
      const memberMatch = teamMembers?.find((m: any) => m.email === ticket.assigned_to);
      if (memberMatch && memberMatch.name) assigneeName = memberMatch.name; 
      else assigneeName = ticket.assigned_to.split('@');
    }
  
    const formattedCost = ticket.cost !== undefined ? ticket.cost : 0;
  
    return (
      <div 
        id={id}
        onClick={onClick} 
        className={`bg-white p-4 rounded-2xl shadow-sm border transition-all duration-500 flex flex-col h-auto min-h-[250px] ${
          isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
          : ticket.priority === 'Urgent' && statusColor !== 'green' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'
        } ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : ''}`}
      >
        <div className="flex justify-between items-start mb-1 gap-2 shrink-0">
          <h5 className="font-bold text-[#0a1e3f] text-sm line-clamp-2 leading-tight">{ticket.title}</h5>
          {ticket.priority === 'Urgent' && statusColor !== 'green' && (
            <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0 mt-0.5">🚨 URGENT</span>
          )}
        </div>
        
        <div className="mb-2 shrink-0">
          <span className="text-xs font-semibold text-[#359b46] truncate block"><MapPin size={12} className="inline mr-1 -mt-0.5" />{ticket.location}</span>
        </div>
        
        <div className="flex-1 flex flex-col">
          <p className={`text-xs mb-3 line-clamp-2 ${isHighlighted ? 'text-blue-700' : 'text-slate-500'}`}>{ticket.description}</p>
          
          {(statusColor === 'blue' || statusColor === 'yellow') && (
            <div className="px-3 py-2.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-700 leading-snug mt-auto mb-3 shrink-0">
              <span className="font-extrabold text-blue-800 block mb-0.5 flex items-center gap-1.5 uppercase tracking-wider"><AlertCircle size={12} /> Status Update</span>
              <span className="font-bold tracking-wide">● {statusColor === 'yellow' ? 'Awaiting Action' : 'Currently Working'}</span>
            </div>
          )}
  
          {statusColor === 'purple' && ticket.on_hold_reason && (
            <div className="px-3 py-2.5 bg-purple-50/70 rounded-xl border border-purple-100 text-[11px] text-purple-700 leading-snug mt-auto mb-3 shrink-0">
              <span className="font-extrabold text-purple-800 block mb-0.5 flex items-center gap-1.5 uppercase tracking-wider"><AlertCircle size={12} /> Hold Reason</span>
              <span className="font-medium line-clamp-2">● {ticket.on_hold_reason}</span>
            </div>
          )}
  
          {statusColor === 'green' && ticket.remarks && (
            <div className="px-3 py-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 leading-snug mt-auto mb-3 shrink-0">
              <span className="font-extrabold text-emerald-800 block mb-0.5 flex items-center gap-1.5 uppercase tracking-wider"><CheckCircle2 size={12} /> Staff Remarks</span>
              <span className="font-medium line-clamp-2">● {ticket.remarks}</span>
            </div>
          )}
        </div>
  
        <div className={`flex justify-between items-center mt-auto shrink-0 border-t pt-3 ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
          <div className="flex gap-2 items-center flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[statusColor]}`}>{statusLabel}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>👤 {assigneeName}</span>
          </div>
          {showCost && <span className="text-[12px] text-[#0a1e3f] font-black tracking-tight">₱{formattedCost.toLocaleString()}</span>}
        </div>
      </div>
    );
}

// ✨ NEW: SKELETON LOADER COMPONENT
function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[250px] animate-pulse">
      <div className="h-4 bg-slate-200 rounded-md w-3/4 mb-3"></div>
      <div className="h-3 bg-slate-200 rounded-md w-1/2 mb-4"></div>
      <div className="space-y-2 flex-1">
        <div className="h-2.5 bg-slate-100 rounded w-full"></div>
        <div className="h-2.5 bg-slate-100 rounded w-5/6"></div>
      </div>
      <div className="h-14 bg-slate-50 rounded-xl w-full mt-auto mb-3"></div>
      <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-auto">
        <div className="h-5 bg-slate-200 rounded-full w-16"></div>
        <div className="h-5 bg-slate-200 rounded-full w-24"></div>
      </div>
    </div>
  );
}

// ✨ NEW: EMPTY STATE COMPONENT
function EmptyState({ icon: Icon, title, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-[250px] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-6 text-center">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
      <h4 className="text-sm font-bold text-slate-600 mb-1">{title}</h4>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}