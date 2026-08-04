"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase/client";
import { MapPin, AlertCircle, X, Wrench, Camera, CheckCircle2, ArrowRight, Inbox, PauseCircle } from "lucide-react";

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

      // ✨ FIX: Added photo_url and created_at to query so manual tasks have images & dates
      const { data: tasksData } = await supabase.from('maintenance_tasks').select('id, title, location, status, assigned_to, cost, resolution_photo_url, description, priority, on_hold_reason, remarks, photo_url, created_at').eq('admin_email', orgData.admin_email);
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
      // Look in both tickets and liveTasks to keep the modal data fresh
      const updatedTicket = tickets.find(t => t.id === selectedTicketData.ticket.id) || selectedTicketData.ticket;
      const updatedLiveMatch = liveTasks.find(lt => lt.id === selectedTicketData.liveMatch?.id) || liveTasks.find(lt => lt.title === updatedTicket.title && lt.location === updatedTicket.location);
      
      const currentLiveStatus = updatedLiveMatch ? updatedLiveMatch.status : updatedTicket.status;
      const { label, color } = getStatusDisplay(currentLiveStatus);
      let staffName = "Unassigned";
      if (updatedLiveMatch?.assigned_to) {
        const profile = teamMembers.find(m => m.email === updatedLiveMatch.assigned_to);
        staffName = profile?.name ? profile.name : updatedLiveMatch.assigned_to.split('@')[0];
      }
      setSelectedTicketData({ ticket: updatedTicket, liveMatch: updatedLiveMatch, staffName, label, color });
    }
  }, [tickets, liveTasks]);

  // ✨ FIX: Merge both tickets and standalone manual tasks
  const enrichedTickets = useMemo(() => {
    const map = new Map();

    // 1. Process all standard tickets (from residents)
    tickets.forEach(ticket => {
      const liveMatch = liveTasks.find(task => task.title === ticket.title && task.location === ticket.location);
      const currentLiveStatus = liveMatch ? liveMatch.status : ticket.status;
      const { label, color } = getStatusDisplay(currentLiveStatus);
      let staffName = "Unassigned";
      if (liveMatch?.assigned_to) {
        const profile = teamMembers.find(m => m.email === liveMatch.assigned_to);
        staffName = profile?.name ? profile.name : liveMatch.assigned_to.split('@')[0];
      }
      map.set(`${ticket.title}-${ticket.location}`, { ...ticket, liveMatch, currentLiveStatus, label, color, staffName, priority: ticket.priority || liveMatch?.priority || 'Normal' });
    });

    // 2. Append standalone manual tickets (created in MaintenanceTab)
    liveTasks.forEach(task => {
      const key = `${task.title}-${task.location}`;
      if (!map.has(key)) {
        const { label, color } = getStatusDisplay(task.status);
        let staffName = "Unassigned";
        if (task.assigned_to) {
          const profile = teamMembers.find(m => m.email === task.assigned_to);
          staffName = profile?.name ? profile.name : task.assigned_to.split('@')[0];
        }
        
        map.set(key, {
          id: `manual_${task.id}`, 
          title: task.title,
          location: task.location,
          description: task.description,
          photo_url: task.photo_url, 
          created_at: task.created_at || new Date().toISOString(),
          status: task.status,
          priority: task.priority || 'Normal',
          liveMatch: task,
          currentLiveStatus: task.status,
          label,
          color,
          staffName
        });
      }
    });

    return Array.from(map.values());
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
      <div className="flex flex-col w-full h-[calc(100vh)] md:h-[calc(100vh)] relative pb-5 overflow-hidden font-sans selection:bg-[#359b46]/10">
        
        {/* PREMIUM HEADER */}
        <div className="shrink-0 mb-6 px-1 sm:px-0">
          <div className="flex flex-row justify-between items-center gap-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight truncate">Assigned Tickets</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5 font-medium truncate">View and monitor maintenance requests</p>
            </div>
            <div className="bg-white border border-slate-200/80 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-sm shrink-0 flex items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs md:text-sm font-bold text-slate-500 uppercase sm:normal-case tracking-wider sm:tracking-normal sm:text-slate-700">Total Open</span>
              <span className="text-xs sm:text-sm font-black bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-lg">{isLoading ? "-" : openInProgressTasks.length}</span>
            </div>
          </div>
        </div>
  
        {/* KANBAN BOARD WRAPPER */}
        <div className="flex-1 w-full h-full min-h-0 overflow-y-auto pr-1 pb-6 custom-scrollbar px-1 sm:px-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start w-full">
            
            {/* COLUMN 1: OPEN & IN PROGRESS */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-blue-600 text-sm flex items-center gap-2">● Open & In Progress</h4>
                <span className="bg-blue-50 text-[#1d82f5] px-2.5 py-0.5 rounded-xl text-xs font-black border border-blue-100 shadow-inner">{isLoading ? "-" : openInProgressTasks.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : openInProgressTasks.length === 0 ? (
                  <EmptyState icon={Inbox} title="No open tasks" message="Active and pending requests will appear here." />
                ) : (
                  openInProgressTasks.map((t: any) => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    return (
                      <div 
                        key={t.id} id={`ticket-${t.id}`}
                        onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md md:hover:-translate-y-0.5 transition-all cursor-pointer active:scale-[0.98] duration-300 h-[340px] shrink-0 ${
                          isHighlighted 
                            ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.01] shadow-xl animate-pulse z-10' 
                            : t.priority === 'Urgent' 
                              ? 'bg-white border-red-200 shadow-red-500/5 hover:border-red-300' 
                              : 'bg-white border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {t.photo_url ? (
                          <div className="relative w-full h-28 shrink-0 bg-slate-100 border-b border-slate-100">
                            <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="relative w-full h-14 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Photo</span></div>
                        )}
                        <div className="p-4 flex-1 flex flex-col overflow-hidden">
                          <div className="flex justify-between items-start mb-2 gap-2 shrink-0">
                            <h3 className="font-extrabold text-[#0a1e3f] text-sm leading-tight line-clamp-1">{t.title}</h3>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap shadow-sm ${t.color}`}>{t.label}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2">
                            <p className={`text-xs ${isHighlighted ? 'text-blue-700 font-medium' : 'text-slate-500'} leading-relaxed`}>{t.description}</p>
                          </div>
                          
                          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 shrink-0 mb-3">
                            <span className="font-black text-blue-600 block mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                              <AlertCircle size={12} strokeWidth={2.5} /> Status Update
                            </span>
                            <p className="text-xs text-blue-800 font-extrabold tracking-wide flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Awaiting Action
                            </p>
                          </div>
  
                          <div className={`flex flex-col gap-1.5 mt-auto pt-3 shrink-0 border-t text-[11px] ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 text-slate-500 min-w-0"><MapPin size={12} className="text-slate-400 shrink-0" /> <span className="truncate font-semibold">{t.location}</span></div>
                              {t.priority === 'Urgent' && <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse">🚨 URGENT</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`font-bold px-2 py-0.5 rounded-lg border text-[10px] uppercase tracking-wide truncate ${isHighlighted ? 'border-blue-200 bg-blue-100/50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>👤 {t.staffName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
  
            {/* COLUMN 2: ON HOLD */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-purple-600 text-sm flex items-center gap-2">● On Hold</h4>
                <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-purple-100 shadow-inner">{isLoading ? "-" : onHoldTasks.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : onHoldTasks.length === 0 ? (
                  <EmptyState icon={PauseCircle} title="No tasks on hold" message="Tasks awaiting parts or feedback will show here." />
                ) : (
                  onHoldTasks.map((t: any) => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    const holdReason = t.liveMatch?.on_hold_reason || t.on_hold_reason;
                    
                    return (
                      <div 
                        key={t.id} id={`ticket-${t.id}`} 
                        onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md md:hover:-translate-y-0.5 transition-all cursor-pointer opacity-95 hover:opacity-100 duration-300 h-[340px] shrink-0 relative ${
                          isHighlighted 
                            ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.01] shadow-xl animate-pulse opacity-100 z-10' 
                            : t.priority === 'Urgent' 
                              ? 'bg-white border-red-200 shadow-red-500/5 hover:border-red-300' 
                              : 'bg-white border-slate-200 hover:border-purple-400'
                        }`}
                      >
                        {t.photo_url ? (
                          <div className="relative w-full h-28 shrink-0 bg-slate-100 border-b border-slate-100">
                            <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover grayscale-[15%]" />
                          </div>
                        ) : (
                          <div className="relative w-full h-14 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Photo</span></div>
                        )}
                        <div className="p-4 flex-1 flex flex-col overflow-hidden">
                          <div className="flex justify-between items-start mb-2 gap-2 shrink-0">
                            <h3 className="font-extrabold text-[#0a1e3f] text-sm leading-tight line-clamp-1">{t.title}</h3>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap shadow-sm ${t.color}`}>{t.label}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2 space-y-2">
                            <p className={`text-xs ${isHighlighted ? 'text-blue-700 font-medium' : 'text-slate-500'} leading-relaxed`}>{t.description}</p>
                            {holdReason && (
                              <div className="px-3 py-2 bg-purple-50/70 rounded-xl border border-purple-100 text-[11px] text-purple-700 leading-snug">
                                <span className="font-black text-purple-800 block mb-0.5 flex items-center gap-1.5 uppercase tracking-wider text-[9px]"><AlertCircle size={12} strokeWidth={2.5} /> Hold Reason:</span>
                                <span className="font-semibold">● {holdReason}</span>
                              </div>
                            )}
                          </div>
                          <div className={`flex flex-col gap-1.5 mt-auto pt-3 shrink-0 border-t text-[11px] ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 text-slate-500 min-w-0"><MapPin size={12} className="text-slate-400 shrink-0" /> <span className="truncate font-semibold">{t.location}</span></div>
                              {t.priority === 'Urgent' && <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse">🚨 URGENT</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`font-bold px-2 py-0.5 rounded-lg border text-[10px] uppercase tracking-wide truncate ${isHighlighted ? 'border-blue-200 bg-blue-100/50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>👤 {t.staffName}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
  
            {/* COLUMN 3: RESOLVED */}
            <div className="flex flex-col bg-slate-50 border border-slate-200/60 rounded-3xl p-4 sm:p-5 w-full shrink-0 shadow-sm">
              <div className="flex justify-between items-center mb-4 px-1 tracking-tight">
                <h4 className="font-black text-[#359b46] text-sm flex items-center gap-2">● Resolved</h4>
                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-xl text-xs font-black border border-emerald-100 shadow-inner">{isLoading ? "-" : resolvedTasks.length}</span>
              </div>
              <div className="flex flex-col space-y-4">
                {isLoading ? (
                  <>
                    <SkeletonCard />
                    <SkeletonCard />
                  </>
                ) : resolvedTasks.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="No resolved tasks" message="Completed tasks will be logged here." />
                ) : (
                  resolvedTasks.map((t: any) => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    const staffRemarks = t.liveMatch?.remarks || t.remarks;
  
                    return (
                      <div 
                        key={t.id} id={`ticket-${t.id}`} 
                        onClick={() => setSelectedTicketData({ ticket: t, liveMatch: t.liveMatch, staffName: t.staffName, label: t.label, color: t.color })}
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md md:hover:-translate-y-0.5 transition-all cursor-pointer duration-300 h-[340px] shrink-0 relative ${
                          isHighlighted 
                            ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.01] shadow-xl animate-pulse z-10' 
                            : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-400'
                        }`}
                      >
                        {(t.liveMatch?.resolution_photo_url || t.photo_url) ? (
                          <div className={`relative w-full h-28 shrink-0 border-b ${isHighlighted ? 'bg-blue-100 border-blue-200' : 'bg-emerald-100/30 border-emerald-100'}`}>
                            <img src={t.liveMatch?.resolution_photo_url || t.photo_url} alt="Resolved issue" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className={`relative w-full h-14 shrink-0 border-b flex items-center justify-center ${isHighlighted ? 'bg-blue-100 border-blue-200 text-blue-300' : 'bg-emerald-100/20 border-emerald-100 text-emerald-300'}`}><span className="text-[10px] font-black uppercase tracking-widest">No Photo</span></div>
                        )}
                        <div className="p-4 flex-1 flex flex-col overflow-hidden">
                          <div className="flex justify-between items-start mb-2 gap-2 shrink-0">
                            <div className="flex items-start gap-1.5 min-w-0">
                              <CheckCircle2 size={14} strokeWidth={3} className={`${isHighlighted ? 'text-blue-500' : 'text-[#359b46]'} shrink-0 mt-0.5`} />
                              <h3 className="font-extrabold text-[#0a1e3f] text-sm leading-tight line-clamp-1">{t.title}</h3>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border whitespace-nowrap shadow-sm ${t.color}`}>{t.label}</span>
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 mb-2 space-y-2">
                            <p className={`text-xs ${isHighlighted ? 'text-blue-700 font-medium' : 'text-slate-500'} leading-relaxed`}>{t.description}</p>
                            {staffRemarks && (
                              <div className="px-3 py-2 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] text-emerald-700 leading-snug">
                                <span className="font-black text-emerald-800 block mb-0.5 flex items-center gap-1.5 uppercase tracking-wider text-[9px]"><CheckCircle2 size={12} strokeWidth={2.5} /> Remarks:</span>
                                <span className="font-semibold">● {staffRemarks}</span>
                              </div>
                            )}
                          </div>
                          <div className={`flex flex-col gap-1.5 mt-auto pt-3 shrink-0 border-t text-[11px] ${isHighlighted ? 'border-blue-200' : 'border-emerald-200/50'}`}>
                            <div className="flex items-center gap-1 text-slate-500 min-w-0"><MapPin size={12} className="text-slate-400 shrink-0" /> <span className="truncate font-semibold">{t.location}</span></div>
                            <div className="flex justify-between items-center mt-0.5 gap-2">
                              <span className={`font-bold px-2 py-0.5 rounded-lg border text-[10px] uppercase tracking-wide truncate ${isHighlighted ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200'}`}>👤 {t.staffName}</span>
                              
                              <span className={`font-black text-xs sm:text-sm whitespace-nowrap ${(t.liveMatch?.cost > 0 || t.cost > 0) ? 'text-[#0a1e3f]' : 'text-slate-400'}`}>
                                {(t.liveMatch?.cost > 0 || t.cost > 0) 
                                  ? `₱${(t.liveMatch?.cost || t.cost).toLocaleString()}` 
                                  : '₱0'}
                              </span>
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
        </div>
  
        {/* 🌟 BEFORE & AFTER MODAL */}
        {selectedTicketData && (
          <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] transform transition-all animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
              
              <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="text-base sm:text-lg md:text-xl font-black text-[#0a1e3f] tracking-tight truncate">
                    {selectedTicketData.ticket.title}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-0.5 sm:mt-1 truncate">
                    <MapPin size={13} className="text-slate-400 shrink-0" /> <span className="truncate">{selectedTicketData.ticket.location}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicketData(null)} 
                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
                >
                  <X size={16} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
                </button>
              </div>
  
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar space-y-6 sm:space-y-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 md:gap-8">
                  
                  {/* Before Column */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm">Before</span>
                      <span className="text-xs sm:text-sm font-black text-slate-700 tracking-tight">Reported Issue</span>
                    </div>
                    <div className="w-full h-48 sm:h-56 md:h-64 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner relative">
                      {selectedTicketData.ticket.photo_url ? (
                        <img src={selectedTicketData.ticket.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4 text-slate-400">
                          <Camera size={28} className="mx-auto mb-1.5 opacity-40" />
                          <span className="text-xs font-semibold uppercase tracking-wider">No photo submitted</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50/50 rounded-xl sm:rounded-2xl p-4 border border-slate-100">
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium mb-3 break-words">
                        {selectedTicketData.ticket.description}
                      </p>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-400 border-t border-slate-200/60 pt-2.5 uppercase tracking-wide">
                        Submitted on: {new Date(selectedTicketData.ticket.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
  
                  {/* After Column */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0">After</span>
                        <span className="text-xs sm:text-sm font-black text-slate-700 tracking-tight truncate">Maintenance Update</span>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${selectedTicketData.color}`}>
                        {selectedTicketData.label}
                      </span>
                    </div>
                    <div className="w-full h-48 sm:h-56 md:h-64 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center shadow-inner relative">
                      {selectedTicketData.liveMatch?.resolution_photo_url ? (
                        <img src={selectedTicketData.liveMatch.resolution_photo_url} alt="Resolution" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-4 text-slate-400">
                          <Wrench size={28} className="mx-auto mb-1.5 opacity-40" />
                          <span className="text-xs font-semibold uppercase tracking-wider">No maintenance photo yet</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50/50 rounded-xl sm:rounded-2xl p-4 border border-slate-100 space-y-2.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">Assigned Staff</span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-800 truncate bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-sm">
                          👤 {selectedTicketData.staffName}
                        </span>
                      </div>
                      
                      {selectedTicketData.label === 'Resolved' && (
                        <div className="flex justify-between items-center border-t border-slate-200/60 pt-2.5">
                          <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider">Equipment Cost</span>
                          <span className={`text-sm font-black ${(selectedTicketData.liveMatch?.cost > 0 || selectedTicketData.ticket?.cost > 0) ? 'text-[#0a1e3f]' : 'text-slate-400'}`}>
                            {(selectedTicketData.liveMatch?.cost > 0 || selectedTicketData.ticket?.cost > 0) 
                              ? `₱${(selectedTicketData.liveMatch?.cost || selectedTicketData.ticket?.cost).toLocaleString()}` 
                              : 'No Cost'}
                          </span>
                        </div>
                      )}
  
                      {(selectedTicketData.liveMatch?.on_hold_reason || selectedTicketData.ticket.on_hold_reason) && (
                        <div className="flex flex-col border-t border-slate-200/60 pt-3 mt-1">
                          <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <AlertCircle size={12} className="text-purple-500" strokeWidth={2.5} /> Hold Reason
                          </span>
                          <span className="text-xs sm:text-[13px] font-semibold text-slate-600 bg-white p-3 rounded-xl border border-slate-200/50 block leading-relaxed shadow-sm">
                            ● {selectedTicketData.liveMatch?.on_hold_reason || selectedTicketData.ticket.on_hold_reason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
  
                </div>
              </div>
  
              {/* MODAL ACTION FOOTER */}
              {(() => {
                const statusStr = String(selectedTicketData.ticket.status).toLowerCase();
                const isResolved = statusStr === 'completed' || statusStr === 'resolved' || statusStr === 'closed' || statusStr === 'success';
                const isUnassigned = statusStr === 'open' || statusStr === 'pending';
  
                if (isResolved) return null;
  
                return (
                  <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0 pb-7 sm:pb-4">
                    {isUnassigned ? (
                      <button
                        onClick={() => {
                          setSelectedTicketData(null);
                          if (onNavigate) onNavigate("Maintenance", `NEW_TICKET_${Date.now()}`);
                        }}
                        className="w-full sm:w-auto bg-[#359b46] hover:bg-[#2c813a] text-white px-5 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 active:scale-[0.97]"
                      >
                        <Wrench size={16} strokeWidth={2.5} /> Process & Assign Ticket
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedTicketData(null);
                          const passId = selectedTicketData.liveMatch?.id || selectedTicketData.ticket.id;
                          if (onNavigate) onNavigate("Maintenance", `${passId}_${Date.now()}`);
                        }}
                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-[0.97]"
                      >
                        <ArrowRight size={16} strokeWidth={2.5} /> Open in Maintenance Board
                      </button>
                    )}
                  </div>
                );
              })()}
  
            </div>
          </div>
        )}
  
        <style dangerouslySetInnerHTML={{__html: `
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
        `}} />
  
      </div>
    );
}

function SkeletonCard() {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[340px] animate-pulse">
      <div className="w-full h-32 bg-slate-200 rounded-xl mb-4 shrink-0"></div>
      <div className="flex justify-between items-start mb-3">
        <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
        <div className="h-4 bg-slate-200 rounded-full w-16"></div>
      </div>
      <div className="space-y-2 flex-1">
        <div className="h-2.5 bg-slate-100 rounded w-full"></div>
        <div className="h-2.5 bg-slate-100 rounded w-5/6"></div>
        <div className="h-2.5 bg-slate-100 rounded w-4/6"></div>
      </div>
      <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-slate-100">
        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        <div className="h-5 bg-slate-200 rounded-full w-24"></div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: any) {
  return (
    <div className="flex flex-col items-center justify-center h-[340px] border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-2xl p-6 text-center">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
        <Icon size={20} className="text-slate-400" />
      </div>
      <h4 className="text-sm font-bold text-slate-600 mb-1">{title}</h4>
      <p className="text-xs text-slate-400">{message}</p>
    </div>
  );
}