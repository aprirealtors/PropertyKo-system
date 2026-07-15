"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase/client";
import { MapPin, AlertCircle, X, Wrench, Camera, CheckCircle2, ArrowRight } from "lucide-react";

export default function ViewTicketTab({ orgData, highlightTicketId, onNavigate }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedTicketData, setSelectedTicketData] = useState<any | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTicketsAndLiveStatuses();

      const ticketsChannel = supabase.channel('viewticket-live-tickets').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            if (payload.eventType === 'INSERT') setTickets((current) => [payload.new, ...current]);
            else if (payload.eventType === 'UPDATE') setTickets((current) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
                return [payload.new, ...current];
              });
            else if (payload.eventType === 'DELETE') setTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        ).subscribe();

      const tasksChannel = supabase.channel('viewticket-live-tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${orgData.admin_email}` },
          (payload) => {
            if (payload.eventType === 'INSERT') setLiveTasks((current) => [payload.new, ...current]);
            else if (payload.eventType === 'UPDATE') setLiveTasks((current) => {
                const exists = current.find(t => t.id === payload.new.id);
                if (exists) return current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t);
                return [payload.new, ...current];
              });
            else if (payload.eventType === 'DELETE') setLiveTasks((current) => current.filter(t => t.id !== payload.old.id));
          }
        ).subscribe();

      return () => {
        supabase.removeChannel(ticketsChannel);
        supabase.removeChannel(tasksChannel);
      };
    }
  }, [orgData]);

  const fetchTicketsAndLiveStatuses = async () => {
    setIsLoading(true);
    try {
      const { data: membersData } = await supabase.from('team_members').select('name, email').eq('admin_email', orgData.admin_email);
      if (membersData) setTeamMembers(membersData);

      const { data: tasksData } = await supabase.from('maintenance_tasks').select('id, title, location, status, assigned_to, cost, resolution_photo_url, description, priority').eq('admin_email', orgData.admin_email);
      if (tasksData) setLiveTasks(tasksData);

      const { data: ticketsData } = await supabase.from('tickets').select('*').eq('admin_email', orgData.admin_email).order('created_at', { ascending: false });
      if (ticketsData) setTickets(ticketsData || []);
    } catch (err) {
      console.error("Error loading tickets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') return { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-100' };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', color: 'bg-purple-50 text-purple-700 border-purple-100' };
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') return { label: 'Resolved', color: 'bg-emerald-50 text-[#359b46] border-emerald-100' };
    return { label: statusValue, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

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
        setSelectedTicketData({ ticket: updatedTicket, liveMatch: updatedLiveMatch, staffName, label, color });
      }
    }
  }, [tickets, liveTasks]);

  const enrichedTickets = useMemo(() => {
    return tickets.map(ticket => {
      const liveMatch = liveTasks.find(task => task.title === ticket.title && task.location === ticket.location);
      const currentLiveStatus = liveMatch ? liveMatch.status : ticket.status;
      const { label, color } = getStatusDisplay(currentLiveStatus);
      let staffName = "Unassigned";
      if (liveMatch?.assigned_to) {
        const profile = teamMembers.find(m => m.email === liveMatch.assigned_to);
        staffName = profile?.name ? profile.name : liveMatch.assigned_to.split('@');
      }
      return { ...ticket, liveMatch, currentLiveStatus, label, color, staffName, priority: ticket.priority || liveMatch?.priority || 'Normal' };
    });
  }, [tickets, liveTasks, teamMembers]);

  const openInProgressTasks = enrichedTickets.filter(t => {
    const s = String(t.currentLiveStatus).toLowerCase();
    return s === 'pending' || s === 'open' || s === 'in_progress' || s === 'in progress' || s === 'assigned to maintenance' || s === 'working';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const onHoldTasks = enrichedTickets.filter(t => {
    const s = String(t.currentLiveStatus).toLowerCase();
    return s === 'on_hold' || s === 'on hold';
  }).sort((a, b) => (a.priority === 'Urgent' ? -1 : 1));

  const resolvedTasks = enrichedTickets.filter(t => {
    const s = String(t.currentLiveStatus).toLowerCase();
    return s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success';
  });

  useEffect(() => {
    if (highlightTicketId && !isLoading && enrichedTickets.length > 0) {
      const actualId = highlightTicketId.split('_')[0];
      setTimeout(() => {
        const matchingTicket = enrichedTickets.find(t => String(t.id) === actualId || (t.liveMatch && String(t.liveMatch.id) === actualId));
        if (matchingTicket) {
          const targetId = String(matchingTicket.id);
          const targetElement = document.getElementById(`ticket-${targetId}`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            setActiveHighlightId(targetId); 
            setTimeout(() => setActiveHighlightId(null), 3500);
          }
        }
      }, 300);
    }
  }, [highlightTicketId, isLoading, enrichedTickets]);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Assigned Tickets</h2>
          <p className="text-slate-500 text-sm mt-1">View and monitor maintenance requests</p>
        </div>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <span className="text-sm font-bold text-slate-700">Total Open: </span>
          <span className="text-sm font-extrabold text-[#359b46]">{openInProgressTasks.length}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-500">Loading tickets...</div>
      ) : enrichedTickets.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-[#0a1e3f] text-lg">No tickets found</h3>
          <p className="text-slate-500 text-sm mt-1">There are no active repair requests right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1 */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-4">Open & In Progress <span className="ml-2 bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{openInProgressTasks.length}</span></h4>
            <div className="space-y-4">
              {openInProgressTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No open tasks</div> : (
                openInProgressTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} id={`ticket-${t.id}`}
                      onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                      className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all cursor-pointer active:scale-[0.98] duration-500 ${isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' : t.priority === 'Urgent' ? 'bg-white border-red-300 shadow-red-500/10' : 'bg-white border-slate-200 hover:border-[#359b46]'}`}
                    >
                      {t.photo_url ? (
                        <div className="relative w-full h-32 bg-slate-100 border-b border-slate-100"><img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover" /></div>
                      ) : (
                        <div className="relative w-full h-16 bg-slate-50 border-b border-slate-100 flex items-center justify-center"><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span></div>
                      )}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="font-bold text-[#0a1e3f] text-sm leading-tight">{t.title}</h3>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${t.color}`}>{t.label}</span>
                        </div>
                        <p className={`text-xs mb-3 flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        <div className={`flex flex-col gap-1.5 mt-auto pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-slate-500"><MapPin size={12} className="text-slate-400" /> <span className="truncate max-w-[120px]">{t.location}</span></div>
                            {t.priority === 'Urgent' && <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 animate-pulse">🚨 URGENT</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>👤 {t.staffName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: On Hold */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-4">On Hold <span className="ml-2 bg-purple-100 text-purple-700 px-2 rounded-full text-xs font-bold">{onHoldTasks.length}</span></h4>
            <div className="space-y-4">
              {onHoldTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No tasks on hold</div> : (
                onHoldTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} id={`ticket-${t.id}`} 
                      onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                      className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all cursor-pointer opacity-90 hover:opacity-100 duration-500 ${isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse opacity-100 z-10' : t.priority === 'Urgent' ? 'bg-white border-red-300 shadow-red-500/10' : 'bg-white border-slate-200'}`}
                    >
                      {t.photo_url ? (
                        <div className="relative w-full h-32 bg-slate-100 border-b border-slate-100"><img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover grayscale-[30%]" /></div>
                      ) : (
                        <div className="relative w-full h-16 bg-slate-50 border-b border-slate-100 flex items-center justify-center"><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span></div>
                      )}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <h3 className="font-bold text-[#0a1e3f] text-sm leading-tight">{t.title}</h3>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${t.color}`}>{t.label}</span>
                        </div>
                        <p className={`text-xs mb-3 flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        <div className={`flex flex-col gap-1.5 mt-auto pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-slate-500"><MapPin size={12} className="text-slate-400" /> <span className="truncate max-w-[120px]">{t.location}</span></div>
                            {t.priority === 'Urgent' && <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-red-100 text-red-700 border border-red-200 animate-pulse">🚨 URGENT</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>👤 {t.staffName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Resolved */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-4">Resolved <span className="ml-2 bg-emerald-100 text-emerald-700 px-2 rounded-full text-xs font-bold">{resolvedTasks.length}</span></h4>
            <div className="space-y-4">
              {resolvedTasks.length === 0 ? <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No resolved tasks</div> : (
                resolvedTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} id={`ticket-${t.id}`} 
                      onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                      className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all cursor-pointer duration-500 ${isHighlighted ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' : 'bg-emerald-50 border-emerald-100'}`}
                    >
                      {(t.liveMatch?.resolution_photo_url || t.photo_url) ? (
                        <div className={`relative w-full h-32 border-b ${isHighlighted ? 'bg-blue-100 border-blue-200' : 'bg-emerald-100/50 border-emerald-100'}`}>
                          <img src={t.liveMatch?.resolution_photo_url || t.photo_url} alt="Resolved issue" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`relative w-full h-16 border-b flex items-center justify-center ${isHighlighted ? 'bg-blue-100 border-blue-200 text-blue-300' : 'bg-emerald-100/30 border-emerald-100 text-emerald-300'}`}><span className="text-xs font-bold uppercase tracking-wider">No Photo</span></div>
                      )}
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 size={16} className={`${isHighlighted ? 'text-blue-500' : 'text-[#359b46]'} shrink-0 mt-0.5`} />
                            <h3 className="font-bold text-[#0a1e3f] text-sm leading-tight line-clamp-1">{t.title}</h3>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${t.color}`}>{t.label}</span>
                        </div>
                        <p className={`text-xs mb-3 flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        <div className={`flex flex-col gap-1.5 mt-auto pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-emerald-200/50'}`}>
                          <div className="flex items-center gap-1.5 text-slate-500"><MapPin size={12} className="text-slate-400" /> <span className="truncate">{t.location}</span></div>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`font-medium px-2 py-0.5 rounded-full ${isHighlighted ? 'bg-blue-100 text-blue-700' : 'bg-white/50 text-slate-500'}`}>👤 {t.staffName}</span>
                            {t.liveMatch?.cost !== undefined && t.liveMatch.cost > 0 && <span className="font-black text-[#0a1e3f]">₱{t.liveMatch.cost.toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* BEFORE & AFTER MODAL */}
      {selectedTicketData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
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

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Before Column */}
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

                {/* After Column */}
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

            {/* ✨ NEW: MODAL ACTION FOOTER (Seamless Navigation to Maintenance) */}
            {(() => {
               const statusStr = String(selectedTicketData.ticket.status).toLowerCase();
               const isResolved = statusStr === 'completed' || statusStr === 'resolved' || statusStr === 'closed' || statusStr === 'success';
               const isUnassigned = statusStr === 'open' || statusStr === 'pending';

               if (isResolved) return null; // Wala nang button kapag tapos na

               return (
                 <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                   {isUnassigned ? (
                     <button
                       onClick={() => {
                         setSelectedTicketData(null);
                         if (onNavigate) onNavigate("Maintenance", `NEW_TICKET_${Date.now()}`); // I-trigger ang +New Ticket pulse
                       }}
                       className="bg-[#359b46] hover:bg-[#2c813a] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                     >
                       <Wrench size={18} /> Process & Assign Ticket
                     </button>
                   ) : (
                     <button
                       onClick={() => {
                         setSelectedTicketData(null);
                         // Ipasa yung mismong maintenance task id
                         const passId = selectedTicketData.liveMatch?.id || selectedTicketData.ticket.id;
                         if (onNavigate) onNavigate("Maintenance", `${passId}_${Date.now()}`);
                       }}
                       className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                     >
                       <ArrowRight size={18} /> Open in Maintenance Board
                     </button>
                   )}
                 </div>
               );
            })()}

          </div>
        </div>
      )}
    </div>
  );
}