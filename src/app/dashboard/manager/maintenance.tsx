"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Wrench, MapPin, Bell, CheckCircle2, Camera, AlertCircle, Inbox, PauseCircle, Trash2, Clock, CheckCircle } from "lucide-react";

export default function MaintenanceTab({ orgData, isLoading: isOrgLoading, highlightTicketId }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [inboxTickets, setInboxTickets] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]); 
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // ✨ NEW: Reject Ticket States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [reviewTicket, setReviewTicket] = useState<any | null>(null);
  const [selectedInboxId, setSelectedInboxId] = useState(""); 
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [visitTime, setVisitTime] = useState(""); 
  const [reporter, setReporter] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Normal"); 
  // State for the uploaded image
  const [ticketImage, setTicketImage] = useState<File | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredTickets = tickets.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(searchLower)) ||
      (t.location && t.location.toLowerCase().includes(searchLower)) ||
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.assigned_to && t.assigned_to.toLowerCase().includes(searchLower))
    );
  });

  // ✨ Derive the existing photo from the selected inbox ticket
  const selectedInboxTicket = inboxTickets.find(t => String(t.id) === selectedInboxId);
  const existingPhotoUrl = selectedInboxTicket?.photo_url;

  const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTickets();
      fetchTeamMembers();
      fetchUnits();

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

  // ✨ NEW: Handle Reject Ticket Logic
  const handleRejectTicket = async () => {
    if (!selectedInboxId || !rejectReason.trim()) {
      setErrorMsg("Please provide a reason for rejecting the request.");
      return;
    }
    setIsRejecting(true);
    setErrorMsg(null);

    try {
      const ticketToReject = inboxTickets.find(t => String(t.id) === selectedInboxId);
      if (!ticketToReject) throw new Error("Ticket not found.");

      // 1. Update ticket status to Rejected AND save the reason
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          status: 'Rejected',
          remarks: rejectReason // ✨ FIX: I-save natin yung reason dito para mabasa ng View Tickets Tab!
        })
        .eq('id', selectedInboxId);

      if (updateError) throw updateError;

      // 2. Notify the reporter directly (Ibabato papunta sa pulang modal ni Owner/Tenant)
      if (ticketToReject.reporter_email) {
        await supabase.from('notifications').insert([{
          admin_email: orgData.admin_email,
          recipient: ticketToReject.reporter_email,
          type: 'TICKET',
          title: 'Repair Request Rejected',
          message: `Your request "${ticketToReject.title}" was not approved. Reason: ${rejectReason}`,
          reference_id: ticketToReject.id,
          is_read: false
        }]);
      }

      // 3. Clean up at isara ang modals
      setIsRejectModalOpen(false);
      setIsModalOpen(false);
      setRejectReason("");
      setSelectedInboxId("");
      setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setAssignedTo(""); setPriority("Normal"); setTicketImage(null);
      
      await fetchTickets(); // Refresh ang view

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to reject ticket.");
    } finally {
      setIsRejecting(false);
    }
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

    if (!ticketImage && !selectedInboxId) {
      setErrorMsg("Please upload or take a photo of the issue.");
      setIsSubmitting(false);
      return;
    }

    try {
      let photoUrlToSave = "";
      
      if (ticketImage) {
        const fileExt = ticketImage.name.split('.').pop();
        const fileName = `ticket-upload-${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage.from('tickets').upload(`ticket-uploads/${fileName}`, ticketImage);
        
        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);
        
        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrlToSave = publicUrlData.publicUrl;
        }
      } else if (selectedInboxId) {
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
      
      setSelectedInboxId(""); setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setAssignedTo(""); setPriority("Normal"); setTicketImage(null);

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

  const openTickets = filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'pending' || s === 'open';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));
  
  const inProgressTickets = filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'in_progress' || s === 'in progress' || s === 'working';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const onHoldTickets = filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'on_hold' || s === 'on hold';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));
  
  const resolvedTickets = filteredTickets.filter(t => {
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
      <div className="flex flex-col w-full h-[calc(100vh-130px)] md:h-[calc(100vh-130px)] relative pb-2 overflow-hidden font-sans selection:bg-[#359b46]/10">
        
        {/* PREMIUM HEADER */}
        <div className="shrink-0 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#0a1e3f] tracking-tight">Maintenance &amp; repairs</h2>
              <p className="text-slate-400 text-sm mt-0.5 font-medium">Tickets, vendors and SLA turnaround</p>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto shrink-0">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search name, title, id, units..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] bg-white shadow-sm font-medium text-slate-700 placeholder:text-slate-400" 
                />
              </div>
              <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                <span className="text-xs font-black text-[#359b46] uppercase tracking-wider">Manager</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-xs border border-emerald-100/60">{initials}</div>
              </div>
            </div>
          </div>
        </div>
  
        {/* SECONDARY ROW */}
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
            onClick={() => { setIsModalOpen(true); setTicketImage(null); }}
            className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 duration-150"
          >
            + New ticket
          </button>
        </div>
  
        {/* KANBAN BOARD WRAPPER */}
        <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pr-1 pb-3 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start w-full h-full min-h-[400px]">
            
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
                    <TicketCard 
                      key={ticket.id} 
                      id={`maintenance-card-${ticket.id}`} 
                      isHighlighted={activeHighlightId === String(ticket.id)} 
                      ticket={ticket} 
                      teamMembers={teamMembers} 
                      statusColor="green" 
                      statusLabel="Closed" 
                      showCost 
                       
                    />
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
                <button onClick={() => { if(!isSubmitting) { setIsModalOpen(false); setTicketImage(null); } }} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-50 active:scale-90" disabled={isSubmitting}>
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
                          setTicketImage(null); // Reset manual upload if switching inbox requests
                          if (id) {
                            const t = inboxTickets.find(x => String(x.id) === id);
                            if (t) {
                              // ✨ FIX: Capitalized title
                              setTitle(t.title ? capitalizeWords(t.title) : ""); 
                              setLocation(t.location || ""); 
                              setPriority(t.priority || "Normal");
                              const desc = t.description || "";
                              if (desc.includes("Best time to visit:")) {
                                const timeMatch = desc.split("Best time to visit:")[1]?.split(".")[0];
                                // ✨ FIX: Capitalized visit time
                              if (timeMatch) setVisitTime(capitalizeWords(timeMatch.trim()));
                              } else setVisitTime("");
                              if (desc.includes("Reported by ")) {
                                const repMatch = desc.split("Reported by ")[1]?.split(".")[0];
                                // ✨ FIX: Capitalized reporter
                              if (repMatch) setReporter(capitalizeWords(repMatch.trim()));
                              } else setReporter("Resident"); 
                            }
                          } else { setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setPriority("Normal"); }
                        }}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm font-semibold bg-white text-slate-700 shadow-inner"
                        disabled={isSubmitting}
                      >
                        <option value="">-- Create custom ticket from scratch --</option>
                        {inboxTickets.map(t => <option key={t.id} value={String(t.id)}>{t.title} ({t.location}){t.priority === 'Urgent' ? ' 🚨URGENT' : ''}</option>)}
                      </select>
                    </div>
                  )}

                  {/* ✨ UPDATED: IMAGE UPLOAD BLOCK WITH INBOX PREVIEW */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Photo Evidence
                    </label>
                    <div>
                      {ticketImage ? (
                        <div className="flex flex-col gap-2.5 w-full p-2.5 sm:p-3 rounded-xl border-2 border-solid border-emerald-400 bg-emerald-50/50 transition-all shadow-sm">
                          <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
                            <img 
                              src={URL.createObjectURL(ticketImage)} 
                              alt="Ticket preview" 
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 flex flex-col">
                              <span className="text-xs truncate text-emerald-900 font-black">
                                {ticketImage.name}
                              </span>
                              <span className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <CheckCircle2 size={12} strokeWidth={3} /> Ready to submit
                              </span>
                            </div>
                            <button 
                              type="button" 
                              onClick={(e) => { e.preventDefault(); setTicketImage(null); }} 
                              className="flex items-center gap-1.5 px-3 py-2 bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-lg shadow-sm border border-red-100 transition-all active:scale-95 shrink-0 font-bold text-[10px] uppercase tracking-wider"
                              title="Remove photo"
                            >
                              <Trash2 size={14} strokeWidth={2.5} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : existingPhotoUrl ? (
                        // ✨ Read-only preview block for inbox photo (No replace button)
                        <div className="flex flex-col gap-2.5 w-full p-2.5 sm:p-3 rounded-xl border-2 border-solid border-blue-400 bg-blue-50/50 transition-all shadow-sm">
                          <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
                            <img 
                              src={existingPhotoUrl} 
                              alt="Resident's submitted photo" 
                              className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 flex flex-col">
                              <span className="text-xs truncate text-blue-900 font-black">
                                Resident's Submitted Photo
                              </span>
                              <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <CheckCircle2 size={12} strokeWidth={3} /> From Pending Request
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3 w-full">
                          {/* ✨ Take Photo - Mobile Only (Hidden on Desktop via md:hidden) */}
                          <label className="flex md:hidden flex-1 flex-col items-center justify-center gap-2 px-2 py-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group text-center shadow-sm bg-white">
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
                              onChange={(e) => e.target.files && setTicketImage(e.target.files[0])}
                              className="hidden"
                              disabled={isSubmitting}
                            />
                          </label>
                          {/* ✨ Gallery - Always visible, fills full width on Desktop */}
                          <label className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group text-center shadow-sm bg-white">
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm ring-2 ring-slate-50 group-hover:ring-emerald-50 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-700 group-hover:text-emerald-700 block leading-none mt-1">
                                Gallery
                              </span>
                            </div>
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={(e) => e.target.files && setTicketImage(e.target.files[0])}
                              className="hidden"
                              disabled={isSubmitting}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issue Description</label>
                    <input type="text" required placeholder="e.g. Aircon leaking" value={title} onChange={(e) => setTitle(capitalizeWords(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
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
                    <input type="text" placeholder="e.g. Tomorrow morning, Weekends only" value={visitTime} onChange={(e) => setVisitTime(capitalizeWords(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Reported By</label>
                    <input type="text" placeholder="e.g. Deivid Valderama (Owner)" value={reporter} onChange={(e) => setReporter(capitalizeWords(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 shadow-sm" disabled={isSubmitting} />
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
                    <button type="button" onClick={() => { setIsModalOpen(false); setTicketImage(null); }} disabled={isSubmitting} className="py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 duration-150">Cancel</button>
                    
                    {/* ✨ NEW: Reject Button (Lalabas lang kung may piniling Pending Request na may ID) */}
                    {selectedInboxId && (
                      <button 
                        type="button" 
                        onClick={() => setIsRejectModalOpen(true)} 
                        disabled={isSubmitting} 
                        className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 py-2.5 px-4 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Reject Request
                      </button>
                    )}

                    <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-200 disabled:text-slate-400 border border-transparent text-white py-2.5 px-5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-[0.98]">{isSubmitting ? "Saving..." : "Create Ticket"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {/* ✨ REJECT TICKET MODAL */}
        {isRejectModalOpen && (
          <div className="fixed inset-0 bg-[#0a1e3f]/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all flex flex-col border border-slate-200/40 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50 shrink-0">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle size={18} strokeWidth={2.5} />
                  <h2 className="text-base font-black tracking-tight">Reject Request</h2>
                </div>
                <button onClick={() => !isRejecting && setIsRejectModalOpen(false)} className="text-red-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-red-100 active:scale-90" disabled={isRejecting}>
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">
                  Please provide a reason for rejecting this request. This will be sent directly to the tenant or owner to inform them.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Rejection</label>
                  <textarea 
                    autoFocus
                    placeholder="e.g. This issue is outside HOA coverage and must be handled privately." 
                    value={rejectReason} 
                    onChange={(e) => setRejectReason(capitalizeWords(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-400 text-sm font-medium text-slate-700 shadow-sm min-h-[100px] resize-none"
                    disabled={isRejecting}
                  />
                </div>
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setIsRejectModalOpen(false)} disabled={isRejecting} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all">Cancel</button>
                  <button type="button" onClick={handleRejectTicket} disabled={isRejecting || !rejectReason.trim()} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 active:scale-95 transition-all shadow-md shadow-red-500/20">
                    {isRejecting ? "Rejecting..." : "Confirm Reject"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  function TicketCard({ id, ticket, teamMembers, statusColor, statusLabel, showCost, onClick, isHighlighted }: any) {
    const colors: any = {
      yellow: 'bg-amber-50 text-amber-700 border-amber-200/60',
      blue: 'bg-blue-50 text-blue-600 border-blue-200/60',
      purple: 'bg-purple-50 text-purple-700 border-purple-200/60',
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:shadow-emerald-500/20 hover:border-emerald-300 transition-all cursor-pointer',
    };
  
    let assigneeName = "Unassigned";
    if (ticket.assigned_to) {
      const memberMatch = teamMembers?.find((m: any) => m.email === ticket.assigned_to);
      if (memberMatch && memberMatch.name) assigneeName = memberMatch.name; 
      else assigneeName = ticket.assigned_to.split('@')[0];
    }
  
    return (
      <div 
        id={id}
        onClick={onClick} 
        // ✨ FIX: Sinet sa compact h-[150px] dahil 4 na data points na lang ang laman
        className={`bg-white p-4 sm:p-5 rounded-3xl border flex flex-col h-[180px] shrink-0 group transition-all duration-300 overflow-hidden ${
          isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
          : ticket.priority === 'Urgent' && statusColor !== 'green' ? 'border-l-4 border-red-500 border-y-slate-100 border-r-slate-100 shadow-sm' : 'border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)]'
        } ${onClick ? 'cursor-pointer' : ''}`}
      >
        {/* 1 & 2: TITLE & STATUS */}
        <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            {statusColor === 'green' && <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" strokeWidth={2.5} />}
            <h4 title={ticket.title} className={`font-extrabold text-[#0a1e3f] text-[15px] leading-snug tracking-tight line-clamp-2 transition-colors cursor-help ${onClick ? 'group-hover:text-blue-600' : ''}`}>
              {ticket.title}
            </h4>
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${colors[statusColor]}`}>
            {statusLabel}
          </span>
        </div>
        
        {/* 3: LOCATION */}
        <div className="flex items-center justify-between mt-auto mb-3 shrink-0">
          <p className="text-slate-500 font-bold text-xs flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 truncate">
            <MapPin size={12} className="text-[#359b46] shrink-0" />
            <span className="truncate">{ticket.location}</span>
          </p>
          {ticket.priority === 'Urgent' && statusColor !== 'green' && (
            <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider animate-pulse shrink-0" title="Urgent">
              🚨
            </span>
          )}
        </div>
  
        {/* 4: ASSIGNED TO */}
        <div className={`flex justify-between items-center shrink-0 border-t pt-3 ${isHighlighted ? 'border-blue-200' : 'border-slate-100/80'}`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0">
              {assigneeName !== "Unassigned" ? assigneeName.substring(0, 1) : "?"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned To</span>
              <span className="text-xs font-bold text-slate-600 truncate">{assigneeName}</span>
            </div>
          </div>
        </div>
      </div>
    );
}

function SkeletonCard() {
  return (
    // ✨ FIX: Strict h-[150px] din para pumantay
    <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[150px] animate-pulse shrink-0 overflow-hidden">
      <div className="flex justify-between items-start mb-3 shrink-0">
        <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
        <div className="h-4 bg-slate-200 rounded-lg w-16"></div>
      </div>
      <div className="h-3 bg-slate-200 rounded-md w-1/2 mt-auto mb-4 shrink-0"></div>
      <div className="flex justify-between items-center border-t border-slate-100 pt-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-200 rounded-full"></div>
          <div className="h-4 bg-slate-200 rounded-md w-24"></div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: any) {
  return (
    // ✨ FIX: Strict h-[150px] din para pumantay
    <div className="flex flex-col items-center justify-center h-[180px] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-3xl p-4 text-center shrink-0">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-2">
        <Icon size={18} className="text-slate-400" />
      </div>
      <h4 className="text-sm font-bold text-slate-600 mb-1">{title}</h4>
      <p className="text-[10px] text-slate-400 max-w-[200px] leading-tight">{message}</p>
    </div>
  );
}