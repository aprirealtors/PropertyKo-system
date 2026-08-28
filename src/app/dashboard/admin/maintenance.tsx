"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Search, X, Wrench, MapPin, Bell, CheckCircle2, Camera, AlertCircle, 
  Inbox, PauseCircle, Trash2, CheckCircle, 
  LayoutGrid, List, ArrowUpDown, Clock
} from "lucide-react";

export default function MaintenanceTab({ orgData, isLoading: isOrgLoading, highlightTicketId }: any) {
  const [tickets, setTickets] = useState<any[]>([]); // Combined tasks & rejected requests
  const [inboxTickets, setInboxTickets] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]); 
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Reject Ticket States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  
  // ✨ UNIVERSAL MODAL STATE
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<any | null>(null);
  
  const [selectedInboxId, setSelectedInboxId] = useState(""); 
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [visitTime, setVisitTime] = useState(""); 
  const [reporter, setReporter] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Normal"); 
  const [ticketImage, setTicketImage] = useState<File | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  
  // VIEW MODE & SORT STATES
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [sortBy, setSortBy] = useState('newest');

  // Base Filter
  const filteredTickets = tickets.filter(t => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (t.title && t.title.toLowerCase().includes(searchLower)) ||
      (t.location && t.location.toLowerCase().includes(searchLower)) ||
      (t.description && t.description.toLowerCase().includes(searchLower)) ||
      (t.assigned_to && t.assigned_to.toLowerCase().includes(searchLower))
    );
  });

  // SORTING FUNCTION LOGIC
  const applySort = (ticketsArray: any[]) => {
    return [...ticketsArray].sort((a, b) => {
      if (sortBy === 'priority') {
        if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1;
        if (b.priority === 'Urgent' && a.priority !== 'Urgent') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); 
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); 
      }
    });
  };

  // ✨ FIX: Apply "Rejected Only" filter specially for Table View
  const tableBaseTickets = sortBy === 'rejected' 
    ? filteredTickets.filter(t => String(t.status).toLowerCase() === 'rejected')
    : filteredTickets;
    
  const displayTickets = applySort(tableBaseTickets); // Master list for Table View

  // Get photo preview for Add Ticket
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
          { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            fetchTickets(); 
          }
        )
        .subscribe();

      const tasksChannel = supabase
        .channel('manager-live-tasks')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            fetchTickets(); 
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
    
    // 1. Fetch Maintenance Tasks (Active & Resolved)
    const { data: tasksData } = await supabase.from('maintenance_tasks').select('*').eq('admin_email', orgData.admin_email);
    
    // 2. Fetch Open Inbox Tickets
    const { data: inboxData } = await supabase.from('tickets').select('*').eq('admin_email', orgData.admin_email).eq('status', 'Open');
    
    // 3. Fetch Rejected Inbox Tickets (Para isama sa Table View)
    const { data: rejectedData } = await supabase.from('tickets').select('*').eq('admin_email', orgData.admin_email).eq('status', 'Rejected');

    if (inboxData) setInboxTickets(inboxData.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    
    // Combine Tasks and Rejected Requests for Universal State
    let combined: any[] = [];
    if (tasksData) combined = [...combined, ...tasksData];
    if (rejectedData) {
      const mappedRejected = rejectedData.map((r: any) => ({
        ...r,
        description: r.description || 'Request rejected by admin.',
        assigned_to: 'Unassigned',
      }));
      combined = [...combined, ...mappedRejected];
    }
    
    setTickets(combined);
    setIsLoadingTickets(false);
  };

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from('team_members').select('name, email, role').eq('admin_email', orgData.admin_email); 
    if (data) setTeamMembers(data);
  };

  const fetchUnits = async () => {
    const { data } = await supabase.from('units').select('*').eq('admin_email', orgData.admin_email).order('property_name', { ascending: true }).order('unit_number', { ascending: true }); 
    if (data) setUnits(data);
  };

  // Reject Ticket Logic
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

      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'Rejected', remarks: rejectReason })
        .eq('id', selectedInboxId);

      if (updateError) throw updateError;

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

      setIsRejectModalOpen(false);
      setIsModalOpen(false);
      setRejectReason("");
      setSelectedInboxId("");
      setTitle(""); setLocation(""); setVisitTime(""); setReporter(""); setAssignedTo(""); setPriority("Normal"); setTicketImage(null);
      
      await fetchTickets(); 

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
          setViewMode('board'); 
          setTimeout(() => {
            const targetElement = document.getElementById(`maintenance-card-${newTask.id}`);
            if (targetElement) {
              targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
              setActiveHighlightId(newTask.id);
              setTimeout(() => setActiveHighlightId(null), 3500);
            }
          }, 300);
        }, 300);
      }

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SORT APPLIED TO BOARD COLUMNS AS WELL
  const openTickets = applySort(filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'pending' || s === 'open';
  }));
  
  const inProgressTickets = applySort(filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'in_progress' || s === 'in progress' || s === 'working';
  }));

  const onHoldTickets = applySort(filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'on_hold' || s === 'on hold';
  }));
  
  const resolvedTickets = applySort(filteredTickets.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'completed' || s === 'resolved' || s === 'closed';
  }));

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";

  const getAssigneeName = (email: string) => {
    if (!email || email === 'Unassigned') return "Unassigned";
    const match = teamMembers?.find((m: any) => m.email === email);
    return match?.name || email.split('@')[0];
  };

  const getUniversalStatusUI = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'rejected') return { label: 'Rejected', color: 'red', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <AlertCircle size={16} /> };
    if (s === 'pending' || s === 'open') return { label: 'New', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Inbox size={16} /> };
    if (s === 'in_progress' || s === 'in progress' || s === 'working') return { label: 'Working', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: <Wrench size={16} /> };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', color: 'purple', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: <PauseCircle size={16} /> };
    if (s === 'completed' || s === 'resolved' || s === 'closed') return { label: 'Closed', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 size={16} /> };
    return { label: status || 'Unknown', color: 'slate', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: <Inbox size={16} /> };
  };

  // ✨ ENTERPRISE FIX: Auto-Open Modal Logic with "Ghost Ticket" Cross-Referencing
  useEffect(() => {
    const processHighlight = async () => {
      if (highlightTicketId && !isLoadingTickets) {
        const actualId = highlightTicketId.split('_')[0];
        if (actualId !== "NEW") {
          
          // 1. Initial Check: Hanapin sa Kanban Board at sa Pending Inbox
          let existingTask = tickets.find(t => String(t.id) === actualId);
          const pendingInbox = inboxTickets.find(t => String(t.id) === actualId);

          // ✨ 2. GHOST TICKET FIX: Kung wala sa pareho, baka lumang tenant request ito na na-assign na!
          if (!existingTask && !pendingInbox) {
            try {
              // Silipin sa lumang tickets database table
              const { data: oldTicket } = await supabase
                .from('tickets')
                .select('title, location, status')
                .eq('id', actualId)
                .single();

              // Kung na-assign na pala, hanapin ang bagong ID niya sa Kanban Board gamit ang Title at Location
              if (oldTicket && oldTicket.status === 'Assigned to Maintenance') {
                existingTask = tickets.find(t => t.title === oldTicket.title && t.location === oldTicket.location);
              }
            } catch (err) {
              console.error("Ghost ticket cross-reference failed:", err);
            }
          }

          // 3. EXECUTE ACTIONS
          if (existingTask) {
            // SCENARIO A: Nasa Board na (Open, In Progress, On Hold, Resolved, Rejected)
            setViewMode('board');
            setSelectedTicketForModal(existingTask); // ✨ AUTO-POP UP UNIVERSAL MODAL
            
            setTimeout(() => {
              const targetElement = document.getElementById(`maintenance-card-${existingTask.id}`);
              if (targetElement) {
                targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
                setActiveHighlightId(String(existingTask.id)); // ✨ AUTO-HIGHLIGHT TARGET CARD
                setTimeout(() => setActiveHighlightId(null), 3500);
              }
            }, 500);
          } 
          else if (pendingInbox) {
            // SCENARIO B: Bago pa lang (Nasa Inbox, kailangan pang gawan ng task)
            setIsModalOpen(true);
            setSelectedInboxId(actualId);
            setTicketImage(null);
            
            setTitle(pendingInbox.title ? capitalizeWords(pendingInbox.title) : ""); 
            setLocation(pendingInbox.location || ""); 
            setPriority(pendingInbox.priority || "Normal");
            
            const desc = pendingInbox.description || "";
            if (desc.includes("Best time to visit:")) {
              const timeMatch = desc.split("Best time to visit:")[1]?.split(".")[0];
              if (timeMatch) setVisitTime(capitalizeWords(timeMatch.trim()));
            } else {
              setVisitTime("");
            }
            
            if (desc.includes("Reported by ")) {
              const repMatch = desc.split("Reported by ")[1]?.split(".")[0];
              if (repMatch) setReporter(capitalizeWords(repMatch.trim()));
            } else {
              setReporter("Resident"); 
            }
          }
        }
      }
    };

    processHighlight();
  }, [highlightTicketId, isLoadingTickets, tickets, inboxTickets]);

  return (
      <div className="flex flex-col w-full h-[calc(100vh-130px)] md:h-[calc(100vh-130px)] relative pb-2 overflow-hidden font-sans selection:bg-[#359b46]/10">
        
        {/* PREMIUM HEADER */}
        <div className="shrink-0 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-[#0a1e3f] tracking-tight">Maintenance &amp; Repairs</h2>
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
                <span className="text-xs font-black text-[#359b46] uppercase tracking-wider">Admin</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-xs border border-emerald-100/60">{initials}</div>
              </div>
            </div>
          </div>
        </div>
  
        {/* ✨ SECONDARY ROW (WITH SORT & VIEW TOGGLE) */}
        <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-extrabold text-[#0a1e3f] text-base tracking-tight">Workspace</h3>
            {inboxTickets.length > 0 && (
              <span className="bg-red-50 border border-red-100 text-red-600 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse shadow-sm">
                {inboxTickets.length} Pending Inbox
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Sort Dropdown */}
            <div className="relative">
               <select 
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    if (e.target.value === 'rejected') setViewMode('list'); // Force table view if they select "Rejected Only"
                  }}
                  className="appearance-none bg-white border border-slate-200/80 text-slate-600 text-xs font-bold py-2 sm:py-2.5 pl-3 pr-8 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#359b46]/20 shadow-sm cursor-pointer"
               >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="priority">Sort: Priority (Urgent)</option>
                  <option value="rejected">Show: Rejected Only</option>
               </select>
               <ArrowUpDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* View Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
               <button 
                 onClick={() => setViewMode('board')} 
                 title="Board View"
                 disabled={sortBy === 'rejected'}
                 className={`p-1.5 rounded-lg transition-all ${sortBy === 'rejected' ? 'opacity-50 cursor-not-allowed' : ''} ${viewMode === 'board' ? 'bg-white shadow-sm text-[#0a1e3f]' : 'text-slate-400 hover:text-slate-600'}`}
               >
                  <LayoutGrid size={16} strokeWidth={2.5}/>
               </button>
               <button 
                 onClick={() => setViewMode('list')} 
                 title="Table View"
                 className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#0a1e3f]' : 'text-slate-400 hover:text-slate-600'}`}
               >
                  <List size={16} strokeWidth={2.5}/>
               </button>
            </div>

            <button 
              onClick={() => { setIsModalOpen(true); setTicketImage(null); }}
              className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 duration-150 shrink-0"
            >
              + New ticket
            </button>
          </div>
        </div>
  
        {/* ✨ DYNAMIC CONTENT AREA */}
        {viewMode === 'board' ? (
          
          /* =========================================
             VIEW 1: KANBAN BOARD
             ========================================= */
          <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pr-1 pb-3 custom-scrollbar animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-start w-full h-full min-h-[400px]">
              
              {/* COLUMN 1: OPEN */}
              <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
                <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                  <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">● Open Tickets</h4>
                  <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-amber-100 shadow-inner">{isLoadingTickets ? "-" : openTickets.length}</span>
                </div>
                <div className="flex flex-col space-y-4">
                  {isLoadingTickets ? (
                    <> <SkeletonCard /> <SkeletonCard /> </>
                  ) : openTickets.length === 0 ? (
                    <EmptyState icon={Inbox} title="No open tickets" message="New maintenance requests will appear here." />
                  ) : (
                    openTickets.map((ticket) => (
                      <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="yellow" statusLabel="New" onClick={() => setSelectedTicketForModal(ticket)} />
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
                    <> <SkeletonCard /> <SkeletonCard /> </>
                  ) : inProgressTickets.length === 0 ? (
                    <EmptyState icon={Wrench} title="No active work" message="Tasks currently being worked on will be shown here." />
                  ) : (
                    inProgressTickets.map((ticket) => (
                      <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="blue" statusLabel="Working" onClick={() => setSelectedTicketForModal(ticket)} />
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
                    <> <SkeletonCard /> <SkeletonCard /> </>
                  ) : onHoldTickets.length === 0 ? (
                    <EmptyState icon={PauseCircle} title="Nothing on hold" message="Tasks that need further action or parts will be placed here." />
                  ) : (
                    onHoldTickets.map((ticket) => (
                      <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="purple" statusLabel="On Hold" onClick={() => setSelectedTicketForModal(ticket)} />
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
                    <> <SkeletonCard /> <SkeletonCard /> </>
                  ) : resolvedTickets.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="No resolved tickets" message="Successfully completed tasks will be logged here." />
                  ) : (
                    resolvedTickets.map((ticket) => (
                      <TicketCard key={ticket.id} id={`maintenance-card-${ticket.id}`} isHighlighted={activeHighlightId === String(ticket.id)} ticket={ticket} teamMembers={teamMembers} statusColor="green" statusLabel="Closed" onClick={() => setSelectedTicketForModal(ticket)} />
                    ))
                  )}
                </div>
              </div>
    
            </div>
          </div>

        ) : (

          /* =========================================
             VIEW 2: ENTERPRISE DATA TABLE
             ========================================= */
          <div className="flex-1 w-full bg-white rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200/80 overflow-hidden flex flex-col h-full animate-in fade-in duration-300">
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-sm min-w-[900px] border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 font-black text-[10px] sm:text-[11px] uppercase tracking-widest border-b border-slate-200/80 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">Ticket Details</th>
                    <th className="px-6 py-4 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 whitespace-nowrap">Priority</th>
                    <th className="px-6 py-4 whitespace-nowrap">Location</th>
                    <th className="px-6 py-4 whitespace-nowrap">Assigned To</th>
                    <th className="px-6 py-4 whitespace-nowrap text-right">Date Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {isLoadingTickets ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Loading data...</td></tr>
                  ) : displayTickets.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">No records match your filters.</td></tr>
                  ) : (
                    displayTickets.map((ticket) => {
                      const ui = getUniversalStatusUI(ticket.status);
                      return (
                        <tr 
                          key={ticket.id} 
                          onClick={() => setSelectedTicketForModal(ticket)}
                          className={`hover:bg-slate-50 transition-colors group cursor-pointer ${activeHighlightId === String(ticket.id) ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <p className="font-extrabold text-[#0a1e3f] text-[13px] sm:text-sm line-clamp-1">{ticket.title}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{ticket.description || 'No description provided'}</p>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm ${ui.bg} ${ui.text} ${ui.border}`}>
                              {ui.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {ticket.priority === 'Urgent' ? (
                              <span className="flex items-center gap-1.5 text-xs font-black text-red-600"><AlertCircle size={14} /> Urgent</span>
                            ) : (
                              <span className="text-xs font-semibold text-slate-500">Normal</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg w-fit">
                              <MapPin size={12} className="text-[#359b46]" /> {ticket.location}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-black border border-slate-300">
                                {getAssigneeName(ticket.assigned_to).substring(0,1)}
                              </div>
                              <span className="text-xs font-bold text-slate-700">{getAssigneeName(ticket.assigned_to)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-xs font-bold text-slate-500">
                              {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer info */}
            <div className="px-6 py-3 border-t border-slate-200/80 bg-slate-50/50 flex justify-between items-center shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Records: {displayTickets.length}</span>
              <span className="text-[10px] font-semibold text-slate-400">Export capability coming in the next module upgrade.</span>
            </div>
          </div>
        )}
  
        {/* ✨ UNIVERSAL TICKET DETAILS MODAL (UPSIZED FOR PHOTOS) */}
        {selectedTicketForModal && (
          <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden transform transition-all flex flex-col border border-slate-200/40 max-h-[95vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              
              {/* Dynamic Header Based on Status */}
              <div className={`px-6 py-5 border-b border-slate-100 flex justify-between items-center shrink-0 ${getUniversalStatusUI(selectedTicketForModal.status).bg}`}>
                <div className={`flex items-center gap-2.5 ${getUniversalStatusUI(selectedTicketForModal.status).text}`}>
                  {getUniversalStatusUI(selectedTicketForModal.status).icon}
                  <h2 className="text-base sm:text-lg font-black tracking-tight uppercase">
                    {getUniversalStatusUI(selectedTicketForModal.status).label}
                  </h2>
                </div>
                <button onClick={() => setSelectedTicketForModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-black/5 active:scale-90">
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                <div className="mb-6">
                  <h3 className="font-black text-xl sm:text-2xl text-[#0a1e3f] tracking-tight mb-2">{selectedTicketForModal.title}</h3>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm"><MapPin size={12} className="text-[#359b46]"/> {selectedTicketForModal.location}</span>
                    <span className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm"><Clock size={12} className="text-[#1d82f5]"/> {new Date(selectedTicketForModal.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* REJECTED REASON / ON HOLD REMARKS HIGHLIGHT */}
                {['rejected', 'on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) && selectedTicketForModal.remarks && (
                  <div className={`mb-6 p-4 rounded-xl border shadow-sm ${String(selectedTicketForModal.status).toLowerCase() === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${String(selectedTicketForModal.status).toLowerCase() === 'rejected' ? 'text-red-800' : 'text-amber-800'}`}>
                      {String(selectedTicketForModal.status).toLowerCase() === 'rejected' ? 'Reason for Rejection' : 'Hold Remarks'}
                    </h4>
                    <p className={`text-sm font-semibold italic ${String(selectedTicketForModal.status).toLowerCase() === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>
                      "{selectedTicketForModal.remarks}"
                    </p>
                  </div>
                )}

                {/* Ticket Description */}
                <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Request Description</h4>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedTicketForModal.description || 'No detailed description provided.'}</p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Assigned To</span>
                    <span className="text-sm font-bold text-[#0a1e3f]">{getAssigneeName(selectedTicketForModal.assigned_to)}</span>
                  </div>
                  {['completed', 'resolved', 'closed'].includes(String(selectedTicketForModal.status).toLowerCase()) ? (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-sm">
                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Final Cost</span>
                      <span className="text-lg font-black text-emerald-800">₱{(selectedTicketForModal.cost || 0).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Priority</span>
                      <span className={`text-sm font-bold ${selectedTicketForModal.priority === 'Urgent' ? 'text-red-600' : 'text-slate-600'}`}>
                        {selectedTicketForModal.priority || 'Normal'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ✨ UPSIZED BEFORE & AFTER PHOTO GALLERY */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Photo Evidence</h4>
                  <div className={`grid gap-4 ${
                    ['completed', 'resolved', 'closed'].includes(String(selectedTicketForModal.status).toLowerCase()) || selectedTicketForModal.on_hold_photo_url || selectedTicketForModal.resolution_photo_url
                    ? 'grid-cols-1 sm:grid-cols-2' 
                    : 'grid-cols-1 max-w-2xl mx-auto'
                  }`}>
                    
                    {/* BEFORE PHOTO (Always show if exists) */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-200/50 w-fit px-2 py-0.5 rounded">Before / Issue</span>
                      {selectedTicketForModal.photo_url ? (
                        <div className="w-full h-64 sm:h-[400px] rounded-2xl border border-slate-200 overflow-hidden bg-slate-900/95 shadow-inner p-1">
                          <img src={selectedTicketForModal.photo_url} alt="Reported Issue" className="w-full h-full object-contain transition-transform duration-700 hover:scale-[1.02]" />
                        </div>
                      ) : (
                        <div className="w-full h-64 sm:h-[400px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center bg-white text-slate-400 shadow-inner">
                          <Camera size={32} strokeWidth={1.5} className="mb-3 opacity-50" />
                          <span className="text-sm font-bold text-slate-400">No issue photo provided.</span>
                        </div>
                      )}
                    </div>

                    {/* ✨ AFTER PHOTO OR HOLD EVIDENCE */}
                    {/* Show if Resolved OR if On Hold WITH an uploaded photo */}
                    {(['completed', 'resolved', 'closed'].includes(String(selectedTicketForModal.status).toLowerCase()) || selectedTicketForModal.on_hold_photo_url || selectedTicketForModal.resolution_photo_url) && (
                      <div className="flex flex-col gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider w-fit px-2 py-0.5 rounded ${
                          ['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) 
                          ? 'text-amber-600 bg-amber-100' 
                          : 'text-emerald-600 bg-emerald-100'
                        }`}>
                          {['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) ? 'Hold Evidence' : 'After / Resolution'}
                        </span>
                        
                        {selectedTicketForModal.resolution_photo_url || selectedTicketForModal.on_hold_photo_url ? (
                          <div className={`w-full h-64 sm:h-[400px] rounded-2xl border-2 overflow-hidden bg-slate-900/95 shadow-md p-1 ${
                            ['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) ? 'border-amber-400' : 'border-emerald-400'
                          }`}>
                            <img src={selectedTicketForModal.resolution_photo_url || selectedTicketForModal.on_hold_photo_url} alt="Status Evidence" className="w-full h-full object-contain transition-transform duration-700 hover:scale-[1.02]" />
                          </div>
                        ) : (
                          <div className={`w-full h-64 sm:h-[400px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center shadow-inner ${
                            ['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) 
                            ? 'border-amber-200 bg-amber-50 text-amber-500' 
                            : 'border-emerald-200 bg-emerald-50 text-emerald-500'
                          }`}>
                            {['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) ? (
                               <PauseCircle size={32} strokeWidth={1.5} className="mb-3 opacity-50" />
                            ) : (
                               <CheckCircle2 size={32} strokeWidth={1.5} className="mb-3 opacity-50" />
                            )}
                            <span className={`text-sm font-bold ${['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {['on_hold', 'on hold'].includes(String(selectedTicketForModal.status).toLowerCase()) ? 'No evidence photo uploaded.' : 'No resolution photo uploaded.'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Final Remarks if Resolved */}
                {['completed', 'resolved', 'closed'].includes(String(selectedTicketForModal.status).toLowerCase()) && selectedTicketForModal.remarks && (
                  <div className="mt-6 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 shadow-sm">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Staff Final Remarks</span>
                    <p className="text-sm font-medium text-emerald-800 leading-relaxed">"{selectedTicketForModal.remarks}"</p>
                  </div>
                )}
                
              </div>

              <div className="px-6 py-4 bg-white border-t border-slate-100 shrink-0 flex justify-end">
                <button onClick={() => setSelectedTicketForModal(null)} className="w-full sm:w-auto px-8 bg-[#0a1e3f] hover:bg-[#122b54] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98]">
                  Close Details
                </button>
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
                          setTicketImage(null); 
                          if (id) {
                            const t = inboxTickets.find(x => String(x.id) === id);
                            if (t) {
                              setTitle(t.title ? capitalizeWords(t.title) : ""); 
                              setLocation(t.location || ""); 
                              setPriority(t.priority || "Normal");
                              const desc = t.description || "";
                              if (desc.includes("Best time to visit:")) {
                                const timeMatch = desc.split("Best time to visit:")[1]?.split(".")[0];
                              if (timeMatch) setVisitTime(capitalizeWords(timeMatch.trim()));
                              } else setVisitTime("");
                              if (desc.includes("Reported by ")) {
                                const repMatch = desc.split("Reported by ")[1]?.split(".")[0];
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
                            >
                              <Trash2 size={14} strokeWidth={2.5} /> Remove
                            </button>
                          </div>
                        </div>
                      ) : existingPhotoUrl ? (
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
                          <label className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer transition-all group text-center shadow-sm bg-white">
                            <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shadow-sm ring-2 ring-slate-50 group-hover:ring-emerald-50 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-700 group-hover:text-emerald-700 block leading-none mt-1">
                                Upload Photo
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
                  
                  {/* ✨ FIX: LOCKED FIELDS WHEN INBOX IS SELECTED FOR DATA INTEGRITY */}
                  {selectedInboxId && (
                    <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex items-start gap-2 mb-2">
                      <AlertCircle size={14} className="text-slate-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] font-bold text-slate-500 leading-tight">
                        Resident inputs are locked to preserve data integrity and maintain an accurate audit trail.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Issue Description</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Aircon leaking" 
                      value={title} 
                      onChange={(e) => setTitle(capitalizeWords(e.target.value))} 
                      className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none text-sm font-medium shadow-sm transition-colors ${
                        selectedInboxId 
                          ? "bg-slate-50 border-slate-200/60 text-slate-500 cursor-not-allowed" 
                          : "bg-white border-slate-200 focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-slate-700"
                      }`}
                      disabled={isSubmitting || !!selectedInboxId} 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Location / Unit</label>
                    <select 
                      required 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value)} 
                      className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none text-sm font-semibold shadow-sm transition-colors ${
                        selectedInboxId 
                          ? "bg-slate-50 border-slate-200/60 text-slate-500 cursor-not-allowed appearance-none" 
                          : "bg-white border-slate-200 focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-slate-700"
                      }`}
                      disabled={isSubmitting || !!selectedInboxId}
                    >
                      <option value="" disabled>Select unit...</option>
                      <option value="Common Area">Common Area (Lobby, Hallway, etc.)</option>
                      {units.map((u) => <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>{u.property_name} {u.unit_number}</option>)}
                      {location && !units.find(u => `${u.property_name} - ${u.unit_number}` === location) && location !== "Common Area" && <option value={location}>{location} (Custom)</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Best Time to Visit (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tomorrow morning, Weekends only" 
                      value={visitTime} 
                      onChange={(e) => setVisitTime(capitalizeWords(e.target.value))} 
                      className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none text-sm font-medium shadow-sm transition-colors ${
                        selectedInboxId 
                          ? "bg-slate-50 border-slate-200/60 text-slate-500 cursor-not-allowed" 
                          : "bg-white border-slate-200 focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-slate-700"
                      }`}
                      disabled={isSubmitting || !!selectedInboxId} 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Reported By</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Deivid Valderama (Owner)" 
                      value={reporter} 
                      onChange={(e) => setReporter(capitalizeWords(e.target.value))} 
                      className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none text-sm font-medium shadow-sm transition-colors ${
                        selectedInboxId 
                          ? "bg-slate-50 border-slate-200/60 text-slate-500 cursor-not-allowed" 
                          : "bg-white border-slate-200 focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-slate-700"
                      }`}
                      disabled={isSubmitting || !!selectedInboxId} 
                    />
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
  
  function TicketCard({ id, ticket, teamMembers, statusColor, statusLabel, onClick, isHighlighted }: any) {
    const colors: any = {
      yellow: 'bg-amber-50 text-amber-700 border-amber-200/60',
      blue: 'bg-blue-50 text-blue-600 border-blue-200/60',
      purple: 'bg-purple-50 text-purple-700 border-purple-200/60',
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
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
      // ✨ FIX: Ibinalik ang hover transition (-translate-y-1.5) sa lahat para uniform at halatang clickable!
      className={`bg-white p-4 sm:p-5 rounded-3xl border flex flex-col h-[180px] shrink-0 group transition-all duration-300 overflow-hidden cursor-pointer ${
        isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
        : ticket.priority === 'Urgent' && statusColor !== 'green' ? 'border-l-4 border-red-500 border-y-slate-100 border-r-slate-100 shadow-sm hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)]' 
        : statusColor === 'green' ? 'border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgba(16,185,129,0.1)] hover:border-emerald-200' 
        : 'border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)]'
      }`}
    >
        {/* 1 & 2: TITLE & STATUS */}
        <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            {statusColor === 'green' && <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" strokeWidth={2.5} />}
            <h4 title={ticket.title} className={`font-extrabold text-[#0a1e3f] text-[15px] leading-snug tracking-tight line-clamp-2 ${statusColor !== 'green' ? 'transition-colors group-hover:text-blue-600' : ''}`}>
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
    <div className="flex flex-col items-center justify-center h-[180px] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-3xl p-4 text-center shrink-0">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-2">
        <Icon size={18} className="text-slate-400" />
      </div>
      <h4 className="text-sm font-bold text-slate-600 mb-1">{title}</h4>
      <p className="text-[10px] text-slate-400 max-w-[200px] leading-tight">{message}</p>
    </div>
  );
}