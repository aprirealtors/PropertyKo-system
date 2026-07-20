"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Wrench, MapPin, User, HardHat, Bell, CheckCircle2, Camera, Clock, AlertCircle } from "lucide-react";

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

      const ticketsChannel = supabase.channel('manager-live-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              if (payload.new.status === 'Open') setInboxTickets((current: any[]) => [payload.new, ...current]);
            } 
            else if (payload.eventType === 'UPDATE') {
              if (payload.new.status === 'Open') {
                setInboxTickets((current: any[]) => {
                  const exists = current.find(t => t.id === payload.new.id);
                  if (exists) return current.map(t => t.id === payload.new.id ? payload.new : t);
                  return [payload.new, ...current];
                });
              } else {
                setInboxTickets((current: any[]) => current.filter(t => t.id !== payload.new.id));
              }
            }
            else if (payload.eventType === 'DELETE') setInboxTickets((current: any[]) => current.filter(t => t.id !== payload.old.id));
          }
        ).subscribe();

      const tasksChannel = supabase.channel('manager-live-tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            if (payload.eventType === 'INSERT') setTickets((current: any[]) => [payload.new, ...current]);
            else if (payload.eventType === 'UPDATE') {
              setTickets((current: any[]) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
                return [payload.new, ...current];
              });
            } 
            else if (payload.eventType === 'DELETE') setTickets((current: any[]) => current.filter(t => t.id !== payload.old.id));
          }
        ).subscribe();

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
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Maintenance & repairs</h2>
          <p className="text-slate-500 text-sm mt-1">Tickets, vendors and SLA turnaround</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-[#0a1e3f] text-lg">Repair tickets</h3>
          {inboxTickets.length > 0 && (
            <span className="bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full text-xs font-bold animate-pulse">
              {inboxTickets.length} Pending Inbox
            </span>
          )}
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          + New ticket
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">Open</h4>
            <span className="bg-amber-100 text-amber-700 px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : openTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? <p className="text-xs text-slate-400">Loading...</p> : openTickets.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No open tickets</div> : (
              openTickets.map((ticket) => (
                <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="yellow" statusLabel="New" />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">In progress</h4>
            <span className="bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : inProgressTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? <p className="text-xs text-slate-400">Loading...</p> : inProgressTickets.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No tickets in progress</div> : (
              inProgressTickets.map((ticket) => (
                <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="blue" statusLabel="Working" />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">On Hold</h4>
            <span className="bg-purple-100 text-purple-700 px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : onHoldTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? <p className="text-xs text-slate-400">Loading...</p> : onHoldTickets.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No tickets on hold</div> : (
              onHoldTickets.map((ticket) => (
                <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="purple" statusLabel="On Hold" />
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">Resolved</h4>
            <span className="bg-emerald-100 text-emerald-700 px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : resolvedTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? <p className="text-xs text-slate-400">Loading...</p> : resolvedTickets.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No resolved tickets</div> : (
              resolvedTickets.map((ticket) => (
                <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="green" statusLabel="Closed" showCost onClick={() => setReviewTicket(ticket)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* RESOLUTION REVIEW MODAL */}
      {reviewTicket && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-[#359b46]" size={20} />
                <h2 className="text-xl font-bold text-[#0a1e3f]">Review Resolution</h2>
              </div>
              <button onClick={() => setReviewTicket(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6">
              <h3 className="font-bold text-lg text-slate-800 mb-1">{reviewTicket.title}</h3>
              <p className="text-sm text-slate-500 mb-6">{reviewTicket.location}</p>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Staff</span>
                  <span className="text-sm font-semibold text-slate-800">{teamMembers?.find((m: any) => m.email === reviewTicket.assigned_to)?.name || reviewTicket.assigned_to.split('@')}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment Cost</span>
                  <span className="text-sm font-bold text-[#0a1e3f]">₱{(reviewTicket.cost || 0).toLocaleString()}</span>
                </div>
                {/* 🌟 STAFF REMARKS DISPLAY sa MODAL */}
                {reviewTicket.remarks && (
                  <div className="flex flex-col border-t border-slate-200 pt-2 mt-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Staff Remarks</span>
                    <span className="text-sm font-medium text-slate-700 italic bg-white p-2.5 rounded-lg border border-slate-100">"{reviewTicket.remarks}"</span>
                  </div>
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Proof of Resolution</span>
                {reviewTicket.resolution_photo_url ? (
                  <div className="w-full h-64 rounded-2xl border border-slate-200 overflow-hidden bg-slate-100"><img src={reviewTicket.resolution_photo_url} alt="Fixed Issue" className="w-full h-full object-cover" /></div>
                ) : (
                  <div className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-slate-50 text-slate-400"><Camera size={24} className="mb-2 opacity-50" /><span className="text-sm font-medium">No photo uploaded by staff.</span></div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setReviewTicket(null)} className="w-full bg-[#0a1e3f] hover:bg-[#0a1e3f]/90 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm">Close Review</button>
            </div>
          </div>
        </div>
      )}

      {/* NEW TICKET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Create New Ticket</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200"><X size={20} /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddTicket} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}
                {inboxTickets.length > 0 && (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-[#0a1e3f] mb-2"><Bell size={16} className="text-[#1d82f5]" /> Process Pending Request</label>
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
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm bg-white"
                      disabled={isSubmitting}
                    >
                      <option value="">-- Create custom ticket from scratch --</option>
                      {inboxTickets.map(t => <option key={t.id} value={String(t.id)}>{t.priority === 'Urgent' ? '🚨 URGENT - ' : ''}{t.title} ({t.location})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Wrench size={16} className="text-[#359b46]" /> Issue Description</label>
                  <input type="text" required placeholder="e.g. Aircon leaking" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><MapPin size={16} className="text-[#359b46]" /> Location / Unit</label>
                  <select required value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white" disabled={isSubmitting || !!selectedInboxId}>
                    <option value="" disabled>Select unit...</option>
                    <option value="Common Area">Common Area (Lobby, Hallway, etc.)</option>
                    {units.map((u) => <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>{u.property_name} {u.unit_number}</option>)}
                    {location && !units.find(u => `${u.property_name} - ${u.unit_number}` === location) && location !== "Common Area" && <option value={location}>{location} (Custom)</option>}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Clock size={16} className="text-[#359b46]" /> Best Time to Visit (Optional)</label>
                  <input type="text" placeholder="e.g. Tomorrow morning, Weekends only" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><User size={16} className="text-[#359b46]" /> Reported By</label>
                  <input type="text" placeholder="e.g. Deivid Valderama (Owner)" value={reporter} onChange={(e) => setReporter(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><HardHat size={16} className="text-[#359b46]" /> Assign To</label>
                    <select required value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white" disabled={isSubmitting}>
                      <option value="" disabled>Select staff...</option>
                      {teamMembers.filter(m => { const r = String(m.role || "").toLowerCase(); return !r.includes('owner') && !r.includes('tenant') && !r.includes('manager'); }).map((member) => ( <option key={member.email} value={member.email}>{member.name}</option> ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><AlertCircle size={16} className="text-[#359b46]" /> Priority Level</label>
                    <select required value={priority} onChange={(e) => setPriority(e.target.value)} className={`w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none text-sm bg-white ${selectedInboxId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "focus:ring-2 focus:ring-[#359b46]"}`} disabled={isSubmitting || !!selectedInboxId}>
                      <option value="Normal">Normal (Flexible)</option>
                      <option value="Urgent">🚨 Urgent (Due Today)</option>
                    </select>
                    {selectedInboxId && <p className="text-[10px] text-slate-400 mt-1 italic">Priority set by {selectedInboxId ? "tenant/owner" : "you"}.</p>}
                  </div>
                </div>
                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">{isSubmitting ? "Saving..." : "Create Ticket"}</button>
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
      /* DITO ANG PAGBABAGO: Naka-lock na sa h-[260px] ang buong card */
      className={`bg-white p-4 rounded-2xl shadow-sm border transition-all duration-500 flex flex-col h-[260px] ${
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
      
      {/* Naka flex-1 at overflow-hidden para kung sumobra ang haba, hindi sisirain ang size ng card */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <p className={`text-xs mb-3 line-clamp-2 ${isHighlighted ? 'text-blue-700' : 'text-slate-500'}`}>{ticket.description}</p>
        
        {/* 🌟 ON HOLD REASON */}
        {statusColor === 'purple' && ticket.on_hold_reason && (
          <div className="px-3 py-2.5 bg-purple-50/70 rounded-xl border border-purple-100 text-[11px] text-purple-700 leading-snug">
            <span className="font-extrabold text-purple-800 block mb-0.5 flex items-center gap-1.5"><AlertCircle size={12} /> Hold Reason:</span>
            <span className="font-medium italic line-clamp-2">{ticket.on_hold_reason}</span>
          </div>
        )}

        {/* 🌟 RESOLUTION REMARKS */}
        {statusColor === 'green' && ticket.remarks && (
          <div className="px-3 py-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 leading-snug">
            <span className="font-extrabold text-emerald-800 block mb-0.5 flex items-center gap-1.5"><CheckCircle2 size={12} /> Staff Remarks:</span>
            <span className="font-medium italic line-clamp-2">{ticket.remarks}</span>
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