"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { MapPin, AlertCircle, X, Wrench, Camera, CheckCircle2 } from "lucide-react";

export default function ViewTicketTab({ orgData }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  // ✨ NEW: State para sa Selected Ticket (Modal)
  const [selectedTicketData, setSelectedTicketData] = useState<any | null>(null);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTicketsAndLiveStatuses();

      // 1. REAL-TIME LISTENER FOR TICKETS
      const ticketsChannel = supabase
        .channel('viewticket-live-tickets')
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
              setTickets((current) => [payload.new, ...current]);
            } else if (payload.eventType === 'UPDATE') {
              setTickets((current) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
                return [payload.new, ...current];
              });
            } else if (payload.eventType === 'DELETE') {
              setTickets((current) => current.filter(t => t.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // 2. REAL-TIME LISTENER FOR MAINTENANCE TASKS
      const tasksChannel = supabase
        .channel('viewticket-live-tasks')
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
              setLiveTasks((current) => [payload.new, ...current]);
            } else if (payload.eventType === 'UPDATE') {
              setLiveTasks((current) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
                return [payload.new, ...current];
              });
            } else if (payload.eventType === 'DELETE') {
              setLiveTasks((current) => current.filter(t => t.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ticketsChannel);
        supabase.removeChannel(tasksChannel);
      };
    }
  }, [orgData]);

  const fetchTicketsAndLiveStatuses = async () => {
    setIsLoading(true);
    try {
      const { data: membersData } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('admin_email', orgData.admin_email);
      if (membersData) setTeamMembers(membersData);

      // ✨ FIX: Idinagdag natin ang 'resolution_photo_url' sa kukunin sa database
      const { data: tasksData } = await supabase
        .from('maintenance_tasks')
        .select('id, title, location, status, assigned_to, cost, resolution_photo_url, description') 
        .eq('admin_email', orgData.admin_email);
      if (tasksData) setLiveTasks(tasksData);

      const { data: ticketsData, error } = await supabase
        .from('tickets') 
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .order('created_at', { ascending: false });

      if (error) console.error("Error fetching tickets:", error);
      else setTickets(ticketsData || []);

    } catch (err) {
      console.error("Error loading tickets context view:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') {
      return { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') {
      return { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-100' };
    }
    if (s === 'on_hold' || s === 'on hold') {
      return { label: 'On Hold', color: 'bg-purple-50 text-purple-700 border-purple-100' };
    }
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') {
      return { label: 'Resolved', color: 'bg-emerald-50 text-[#359b46] border-emerald-100' };
    }
    return { label: statusValue, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  // Helper para kapag na-update yung task, mag-uupdate din ang modal nang live kung naka-open ito
  useEffect(() => {
    if (selectedTicketData) {
      const updatedTicket = tickets.find(t => t.id === selectedTicketData.ticket.id);
      const updatedLiveMatch = liveTasks.find(lt => lt.title === updatedTicket?.title && lt.location === updatedTicket?.location);
      
      if (updatedTicket) {
        const currentLiveStatus = updatedLiveMatch ? updatedLiveMatch.status : updatedTicket.status;
        const { label, color } = getStatusDisplay(currentLiveStatus);
        
        let staffName = "Unassigned";
        if (updatedLiveMatch?.assigned_to) {
          const profile = teamMembers.find(m => m.email === updatedLiveMatch.assigned_to);
          staffName = profile?.name ? profile.name : updatedLiveMatch.assigned_to.split('@');
        }

        setSelectedTicketData({
          ticket: updatedTicket,
          liveMatch: updatedLiveMatch,
          staffName,
          label,
          color
        });
      }
    }
  }, [tickets, liveTasks]);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Assigned Tickets</h2>
          <p className="text-slate-500 text-sm mt-1">Click a ticket to view Before & After reports</p>
        </div>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <span className="text-sm font-bold text-slate-700">Total Open: </span>
          <span className="text-sm font-extrabold text-[#359b46]">
            {tickets.filter(t => {
              const match = liveTasks.find(lt => lt.title === t.title && lt.location === t.location);
              const s = String(match ? match.status : t.status).toLowerCase();
              return s === 'pending' || s === 'open';
            }).length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-500">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-[#0a1e3f] text-lg">No tickets found</h3>
          <p className="text-slate-500 text-sm mt-1">There are no active repair requests right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map(ticket => {
            const liveMatch = liveTasks.find(task => 
              task.title === ticket.title && 
              task.location === ticket.location
            );

            const currentLiveStatus = liveMatch ? liveMatch.status : ticket.status;
            const { label, color } = getStatusDisplay(currentLiveStatus);

            let staffName = "Unassigned";
            if (liveMatch?.assigned_to) {
              const profile = teamMembers.find(m => m.email === liveMatch.assigned_to);
              staffName = profile?.name ? profile.name : liveMatch.assigned_to.split('@');
            }

            return (
              <div 
                key={ticket.id} 
                onClick={() => setSelectedTicketData({ ticket, liveMatch, staffName, label, color })}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md hover:border-[#359b46] transition-all cursor-pointer active:scale-[0.98]"
              >
                {/* Image Header */}
                {ticket.photo_url ? (
                  <div className="relative w-full h-48 bg-slate-100 border-b border-slate-100">
                    <img src={ticket.photo_url} alt="Repair issue" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="relative w-full h-24 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo Provided</span>
                  </div>
                )}

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-[#0a1e3f] text-base line-clamp-2 leading-tight">{ticket.title}</h3>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${color}`}>
                      {label}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-5 flex-1 line-clamp-3">
                    {ticket.description}
                  </p>

                  <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <MapPin size={14} className="text-slate-400" /> 
                      <span className="truncate">{ticket.location}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-slate-400 font-medium">
                        Reported: {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500 border border-slate-200 bg-slate-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          👤 {staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ✨ NEW: BEFORE & AFTER MODAL */}
      {selectedTicketData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2">
                  {selectedTicketData.ticket.title}
                </h2>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mt-1">
                  <MapPin size={14} className="text-slate-400" /> {selectedTicketData.ticket.location}
                </div>
              </div>
              <button onClick={() => setSelectedTicketData(null)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (2 Columns for Before & After) */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 🔴 BEFORE (Reported by Owner/Tenant) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Before</span>
                    <span className="text-sm font-bold text-slate-700">Reported Issue</span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center">
                    {selectedTicketData.ticket.photo_url ? (
                      <img src={selectedTicketData.ticket.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Camera size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-sm font-medium">No photo submitted</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      {selectedTicketData.ticket.description}
                    </p>
                    <div className="text-xs text-slate-400 font-medium border-t border-slate-200 pt-3">
                      Submitted on: {new Date(selectedTicketData.ticket.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* 🟢 AFTER (Maintenance Resolution) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">After</span>
                      <span className="text-sm font-bold text-slate-700">Maintenance Update</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${selectedTicketData.color}`}>
                      {selectedTicketData.label}
                    </span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center relative">
                    {selectedTicketData.liveMatch?.resolution_photo_url ? (
                      <img src={selectedTicketData.liveMatch.resolution_photo_url} alt="Resolution" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Wrench size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-sm font-medium">No maintenance photo yet</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Staff</span>
                      <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        👤 {selectedTicketData.staffName}
                      </span>
                    </div>
                    
                    {selectedTicketData.liveMatch?.cost !== undefined && selectedTicketData.liveMatch.cost > 0 && (
                      <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment Cost</span>
                        <span className="text-sm font-black text-[#0a1e3f]">₱{selectedTicketData.liveMatch.cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}