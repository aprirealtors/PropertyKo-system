"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Clock, Wrench, AlertCircle, Inbox, PauseCircle, CheckCircle2, AlertTriangle, MapPin, X, CheckCircle, User, ChevronRight, Check, Trash2 } from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

export default function RepairTab({ highlightTicketId }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [profile, setProfile] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>(""); 

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [repairPriority, setRepairPriority] = useState("Normal");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false); // Changed to modal like Owner side

  const [reviewTicket, setReviewTicket] = useState<any | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [reviewOnHoldTicket, setReviewOnHoldTicket] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      setUserEmail(authData.user.email || "");

      const { data: profileData } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (profileData) {
        setProfile(profileData);

        const { data: teamData } = await supabase
          .from('team_members')
          .select('name, email')
          .eq('admin_email', profileData.admin_email);
        if (teamData) setTeamMembers(teamData);

        const { data: allUnitsData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profileData.admin_email);

        if (allUnitsData) {
          const matchedUnit = allUnitsData.find((u: any) => {
            const unitFullName = `${u.property_name} - ${u.unit_number}`;
            return profileData.access_level?.includes(unitFullName);
          });
          
          if (matchedUnit) {
            setUnit(matchedUnit);
          }
        }

        const { data: tasksData } = await supabase
          .from('maintenance_tasks')
          .select('id, title, location, status, admin_email, assigned_to, cost, resolution_photo_url, priority, description, created_at, on_hold_reason, remarks')
          .eq('admin_email', profileData.admin_email);
        if (tasksData) setLiveTasks(tasksData);

        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('*')
          .eq('admin_email', profileData.admin_email)
          .order('created_at', { ascending: false });

        if (ticketsData) {
          const tenantTickets = ticketsData.filter((t: any) => 
            t.reporter_email === authData.user.email || 
            (String(t.description).includes(profileData.name) && String(t.description).includes('(Tenant)'))
          );
          setTickets(tenantTickets);
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!profile?.admin_email || !userEmail) return;

    const isTenantTicket = (ticket: any) => {
      return ticket.reporter_email === userEmail || 
             (String(ticket.description).includes(profile.name) && String(ticket.description).includes('(Tenant)'));
    };

    const ticketsChannel = supabase
      .channel('tenant-live-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${profile.admin_email}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isTenantTicket(payload.new)) setTickets((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            if (isTenantTicket(payload.new)) {
              setTickets((current) => current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      ).subscribe();

    const tasksChannel = supabase
      .channel('tenant-live-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${profile.admin_email}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setLiveTasks((current) => [payload.new, ...current]);
          else if (payload.eventType === 'UPDATE') setLiveTasks((current) => current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
          else if (payload.eventType === 'DELETE') setLiveTasks((current) => current.filter(t => t.id !== payload.old.id));
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [profile, userEmail]);

  const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) {
      showToast("Please upload a photo of the issue.", "error");
      return;
    }
    setIsSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentEmail = authData.user?.email || "";

      let photoUrl = "";
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(`tenant-uploads/${fileName}`, selectedImage);

        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);

        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const capitalizedIssue = capitalizeWords(repairIssue);
      const capitalizedTime = capitalizeWords(repairTime);

      const unitLoc = unit?.property_name ? `${unit.property_name} - ${unit.unit_number}` : (profile?.access_level || "Tenant Unit");
      const fullDesc = `Best time to visit: ${capitalizedTime}. Reported by ${profile?.name || 'Tenant'} (Tenant).`;

      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert([{
          admin_email: profile?.admin_email,
          reporter_email: currentEmail, 
          title: capitalizedIssue,
          location: unitLoc,
          description: fullDesc,
          status: 'Open',
          photo_url: photoUrl,
          priority: repairPriority
        }])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('notifications')
        .insert([{
          admin_email: profile?.admin_email,
          recipient: 'MANAGER',
          type: 'TICKET',
          title: 'New Repair Request',
          message: `${profile?.name || 'A tenant'} (Tenant) reported an issue: ${capitalizedIssue}`,
          reference_id: newTicket.id,
          is_read: false
        }]);

      setRepairIssue("");
      setRepairTime("");
      setRepairPriority("Normal");
      setSelectedImage(null);
      setIsRepairModalOpen(false); 
      setIsSuccessModalOpen(true); // Open Owner style success modal

    } catch (err: any) {
      console.error("Submit error:", err);
      showToast(`Failed to submit request: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Open', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') return { label: 'In Progress', color: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', color: 'bg-purple-100 text-purple-700 border-purple-200' };
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') return { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (s === 'failed') return { label: 'Failed', color: 'bg-red-100 text-red-800 border-red-200' };
    return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  const enrichedTickets = useMemo(() => {
    return tickets.map(ticket => {
      const match = liveTasks.find(task => task.title === ticket.title && task.location === ticket.location);
      const currentLiveStatus = match ? match.status : ticket.status;
      const badge = getStatusDisplay(currentLiveStatus);

      let staffName = "Unassigned";
      if (match?.assigned_to) {
        const memberMatch = teamMembers.find(m => m.email === match.assigned_to);
        staffName = memberMatch?.name ? memberMatch.name : match.assigned_to.split('@');
      }

      return {
        ...ticket,
        liveMatch: match,
        currentLiveStatus,
        label: badge.label,
        color: badge.color, // Maps to exact owner side colors
        staffName,
        priority: match?.priority || ticket.priority || 'Normal',
        on_hold_reason: match?.on_hold_reason || ticket.on_hold_reason || null,
        remarks: match?.remarks || ticket.remarks || null
      };
    });
  }, [tickets, liveTasks, teamMembers]);

  useEffect(() => {
    if (highlightTicketId && !isLoading && enrichedTickets.length > 0) {
      const actualId = highlightTicketId.split('_')[0]; 
      setTimeout(() => {
        const matchingTicket = enrichedTickets.find(t => 
          String(t.id) === actualId || 
          (t.liveMatch && String(t.liveMatch.id) === actualId)
        );
        
        if (matchingTicket) {
          const targetId = String(matchingTicket.id);
          const targetElement = document.getElementById(`ticket-${targetId}`);
          
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            setActiveHighlightId(targetId);
            setTimeout(() => {
              setActiveHighlightId(null);
            }, 3500);
          }
        }
      }, 300);
    }
  }, [highlightTicketId, isLoading, enrichedTickets]);

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

  return (
    // ✨ EXACT OWNER SIDE LAYOUT WRAPPER
    <div className="flex flex-col w-full max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-6 lg:p-8 md:pb-10">
      
      {/* Kanban Header */}
      <div className="flex-none shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white p-4 sm:px-6 sm:py-4 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Maintenance & Repairs</h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium">Track your requested property repairs and updates here.</p>
          </div>
          <button 
            onClick={() => setIsRepairModalOpen(true)} 
            className="w-full sm:w-auto justify-center bg-gradient-to-br from-[#1a3d6c] via-[#1565c0] to-[#0d47a1] hover:from-blue-800 hover:to-blue-900 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 active:scale-95"
          >
            <Wrench size={16} /> New Request
          </button>
        </div>
      </div>

      {/* Kanban Board Container - Natural Grid Layout (Mag-iscroll na ang buong page) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 w-full overflow-y-auto custom-scrollbar">
          
        {/* Column 1: Open & In Progress */}
        <div className="flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          <h4 className="font-extrabold text-slate-800 text-sm mb-5 shrink-0 flex items-center justify-between uppercase tracking-wide">
            <span className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Inbox size={16} strokeWidth={2.5} /></div>
              In Progress
            </span>
            <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : openInProgressTasks.length}
            </span>
          </h4>
          
          <div className="flex flex-col space-y-4">
            {isLoading ? (
              <><KanbanSkeleton /><KanbanSkeleton /></>
            ) : openInProgressTasks.length === 0 ? (
              <EmptyState icon={Inbox} title="No open requests" message="Active and pending maintenance tasks will appear here." />
            ) : (
              openInProgressTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    className={`group h-auto shrink-0 bg-white rounded-3xl border overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1.5 ${
                      isHighlighted ? 'ring-4 ring-emerald-500/50 bg-emerald-50 border-emerald-400 scale-[1.02] shadow-xl animate-pulse z-10' : 
                      t.priority === 'Urgent' ? 'border-l-4 border-red-500 border-y-slate-100 border-r-slate-100 shadow-sm' : 'border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                    }`}
                  >
                    {t.photo_url ? (
                      <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent z-10"></div>
                        <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      </div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 bg-slate-50/80 border-b border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <Camera size={24} className="mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                      </div>
                    )}

                    <div className="p-4 sm:p-5 flex-1 flex flex-col bg-white relative z-20">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <h4 className="font-extrabold text-[#0a1e3f] text-[15px] leading-snug tracking-tight line-clamp-1">{t.title}</h4>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${t.color}`}>{t.label}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3 mt-1 shrink-0">
                        <p className="text-emerald-600 font-bold text-xs flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                          <MapPin size={12} className="text-[#359b46]" />{t.location}
                        </p>
                        {t.priority === 'Urgent' && (
                          <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1 shrink-0">
                            <AlertCircle size={10} /> Urgent
                          </span>
                        )}
                      </div>

                      <div className="space-y-2 mb-3">
                        <p className={`text-xs leading-relaxed font-medium ${isHighlighted ? 'text-emerald-800' : 'text-slate-500'}`}>
                          {t.description}
                        </p>
                      </div>

                      <div className="shrink-0 bg-blue-50/60 border border-blue-100/60 rounded-xl p-2.5 mb-3">
                        <span className="font-black text-blue-600 block mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                          <AlertCircle size={14} /> Status Update
                        </span>
                        <p className="text-xs text-blue-800 font-bold tracking-wide">Awaiting Action</p>
                      </div>

                      <div className="shrink-0 mt-auto pt-3 border-t border-slate-100/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#0a1e3f] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {t.staffName !== "Unassigned" ? t.staffName.substring(0, 1) : "?"}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned</span>
                            <span className="text-xs font-bold text-slate-700">{t.staffName}</span>
                          </div>
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
        <div className="flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          <h4 className="font-extrabold text-slate-800 text-sm mb-5 shrink-0 flex items-center justify-between uppercase tracking-wide">
            <span className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><PauseCircle size={16} strokeWidth={2.5} /></div>
              On Hold
            </span>
            <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : onHoldTasks.length}
            </span>
          </h4>
          
          <div className="flex flex-col space-y-4">
            {isLoading ? (
              <KanbanSkeleton />
            ) : onHoldTasks.length === 0 ? (
              <EmptyState icon={PauseCircle} title="No tasks on hold" message="Tasks awaiting parts or feedback will show here." />
            ) : (
              onHoldTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                const holdReason = t.liveMatch?.on_hold_reason || t.on_hold_reason;
                
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewOnHoldTicket(t)}
                    className={`group h-auto shrink-0 bg-white/90 backdrop-blur-sm rounded-3xl border overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1.5 ${
                      isHighlighted ? 'ring-4 ring-emerald-500/50 bg-emerald-50 border-emerald-400 scale-[1.02] shadow-2xl z-10' : 
                      t.priority === 'Urgent' ? 'border-l-4 border-red-500 border-y-slate-100 border-r-slate-100 shadow-sm' : 'border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                    }`}
                  >
                    {t.photo_url ? (
                      <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100 overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="bg-white/90 text-slate-800 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5">
                            View Details <ChevronRight size={14} />
                          </span>
                        </div>
                        <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover grayscale-[40%] transition-transform duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                      </div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 bg-slate-50/80 border-b border-slate-100 flex flex-col items-center justify-center text-slate-300">
                        <Camera size={24} className="mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                      </div>
                    )}

                    <div className="p-4 sm:p-5 flex-1 flex flex-col bg-white relative z-20">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <h4 className="font-extrabold text-[#0a1e3f] text-[15px] leading-snug tracking-tight line-clamp-1">{t.title}</h4>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${t.color}`}>{t.label}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3 mt-1 shrink-0">
                        <p className="text-slate-500 font-bold text-xs flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                          <MapPin size={12} className="text-[#359b46]" />{t.location}
                        </p>
                      </div>

                      <div className="space-y-3 mb-3">
                        <p className={`text-xs leading-relaxed font-medium ${isHighlighted ? 'text-blue-700' : 'text-slate-500'}`}>
                          {t.description}
                        </p>
                        {holdReason && (
                          <div className="bg-purple-50/60 border-l-4 border-purple-400 p-3 rounded-r-xl">
                            <span className="font-black text-purple-700 text-[10px] uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                              <Clock size={12} strokeWidth={2.5} /> Reason
                            </span>
                            <p className="text-xs text-purple-900 leading-relaxed font-semibold">
                              {holdReason}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 mt-auto pt-3 border-t border-slate-100/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold shadow-sm">
                            {t.staffName !== "Unassigned" ? t.staffName.substring(0, 1) : "?"}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned</span>
                            <span className="text-xs font-bold text-slate-600">{t.staffName}</span>
                          </div>
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
        <div className="flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
          <h4 className="font-extrabold text-slate-800 text-sm mb-5 shrink-0 flex items-center justify-between uppercase tracking-wide">
            <span className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle2 size={16} strokeWidth={2.5} /></div>
              Resolved
            </span>
            <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : resolvedTasks.length}
            </span>
          </h4>
          
          <div className="flex flex-col space-y-4">
            {isLoading ? (
              <><KanbanSkeleton /><KanbanSkeleton /></>
            ) : resolvedTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No resolved requests" message="Completed tasks and resolution photos will be logged here." />
            ) : (
              resolvedTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                const staffRemarks = t.liveMatch?.remarks || t.remarks;

                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewTicket(t)} 
                    className={`group h-auto shrink-0 bg-white rounded-3xl border overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-[0_12px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1.5 ${
                      isHighlighted ? 'ring-4 ring-emerald-500/50 bg-emerald-50 border-emerald-400 scale-[1.02] shadow-2xl z-10' : 'border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                    }`}
                  >
                    {(t.liveMatch?.resolution_photo_url || t.photo_url) ? (
                      <div className="relative w-full h-32 shrink-0 border-b border-emerald-50 overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-900/30 backdrop-blur-[1px] z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="bg-white/95 text-emerald-800 text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5">
                            View Resolution <ChevronRight size={14} />
                          </span>
                        </div>
                        <img src={t.liveMatch?.resolution_photo_url || t.photo_url} alt="Resolved issue" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      </div>
                    ) : (
                      <div className="relative w-full h-32 shrink-0 border-b flex flex-col items-center justify-center bg-emerald-50/40 border-emerald-100 text-emerald-400">
                        <Check size={28} strokeWidth={3} className="mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">No Photo</span>
                      </div>
                    )}

                    <div className="p-4 sm:p-5 flex-1 flex flex-col bg-gradient-to-b from-transparent to-emerald-50/30 relative z-20">
                      <div className="flex justify-between items-start mb-2 gap-3 shrink-0">
                        <div className="flex items-start gap-2">
                          <CheckCircle size={16} className={`${isHighlighted ? 'text-emerald-500' : 'text-emerald-600'} mt-0.5 shrink-0`} strokeWidth={2.5} />
                          <h4 className="font-extrabold text-[#0a1e3f] text-[15px] leading-snug tracking-tight line-clamp-1">{t.title}</h4>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${t.color}`}>{t.label}</span>
                      </div>

                      <div className="flex items-center justify-between mb-3 mt-1 shrink-0 pl-6">
                        <p className="text-slate-500 font-bold text-xs flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">
                          <MapPin size={12} className="text-slate-400 shrink-0" />{t.location}
                        </p>
                      </div>

                      <div className="space-y-3 mb-3 pl-6">
                        <p className={`text-xs leading-relaxed font-medium ${isHighlighted ? 'text-emerald-800' : 'text-slate-500'}`}>
                          {t.description}
                        </p>
                        {staffRemarks && (
                          <div className="bg-emerald-50/80 border border-emerald-100/60 p-3 rounded-xl mt-2">
                            <span className="font-black text-emerald-700 block mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                              <CheckCircle2 size={12} strokeWidth={2.5} /> Remarks
                            </span>
                            <p className="text-xs text-emerald-900 font-semibold leading-relaxed">
                              {staffRemarks}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 mt-auto pt-3 border-t border-emerald-100/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold border border-emerald-200">
                            {t.staffName !== "Unassigned" ? t.staffName.substring(0, 1) : "?"}
                          </div>
                          <span className="text-xs font-bold text-slate-600">{t.staffName}</span>
                        </div>

                        {t.liveMatch?.cost !== undefined && t.liveMatch.cost > 0 ? (
                          <span className="font-black text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm text-sm">₱{t.liveMatch.cost.toLocaleString()}</span>
                        ) : (
                          <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest">No Cost</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ✨ TOAST NOTIFICATION */}
      {toast && (
        <div 
          className={`fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] font-bold text-sm transition-all transform animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${
            toast.type === "success" ? "border-l-4 border-l-[#359b46] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="text-[#359b46]" size={22} strokeWidth={2.5} />
          ) : (
            <AlertTriangle className="text-red-500" size={22} strokeWidth={2.5} />
          )}
          {toast.message}
        </div>
      )}

      {/* ✨ 1. REPORT REPAIR MODAL (Compact Fit) */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[95vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-white/10">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 shadow-sm z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Report a repair</h2>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5">Submit a maintenance request</p>
              </div>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 pb-safe">
              <form onSubmit={handleSubmit} className="space-y-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Description</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Leaking faucet in the kitchen" 
                    value={repairIssue} 
                    onChange={(e) => setRepairIssue(e.target.value)}
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-800 placeholder:text-slate-400 hover:border-slate-300 transition-all shadow-sm" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority Level</label>
                  <div className="relative">
                    <select
                      required
                      value={repairPriority}
                      onChange={(e) => setRepairPriority(e.target.value)}
                      className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-700 bg-white hover:border-slate-300 transition-all cursor-pointer shadow-sm appearance-none pr-10"
                      disabled={isSubmitting}
                    >
                      <option value="Normal">Normal (Can wait)</option>
                      <option value="Urgent">🚨 Urgent (Needs attention today)</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Photo Evidence</label>
                  <div>
                    {selectedImage ? (
                      <div className="flex flex-col gap-2.5 w-full p-2.5 sm:p-3 rounded-xl border-2 border-solid border-emerald-400 bg-emerald-50/50 transition-all shadow-sm">
                        
                        {/* IMAGE PREVIEW BOX */}
                        <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
                          <img 
                            src={URL.createObjectURL(selectedImage)} 
                            alt="Repair issue preview" 
                            className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                          />
                        </div>

                        {/* DETAILS & REMOVE BUTTON */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0 flex flex-col">
                            <span className="text-xs truncate text-emerald-900 font-black">
                              {selectedImage.name}
                            </span>
                            <span className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-widest mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={12} strokeWidth={3} /> Ready to submit
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setSelectedImage(null); }} 
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
                            onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                            className="hidden"
                            disabled={isSubmitting}
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
                            onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                            className="hidden"
                            disabled={isSubmitting}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Visit Time</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Tomorrow morning, Weekends" 
                    value={repairTime} 
                    onChange={(e) => setRepairTime(e.target.value)} 
                    className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold text-slate-800 placeholder:text-slate-400 hover:border-slate-300 transition-all shadow-sm" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="pt-2 sm:pt-3 mb-5 sm:mb-3">
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-emerald-300 disabled:to-green-400 text-white py-3.5 rounded-xl text-sm font-black transition-all shadow-md active:scale-[0.98] flex justify-center items-center gap-2 border border-emerald-400/20"
                  >
                    {isSubmitting ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Submitting...</>
                    ) : "Submit Repair Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 2. REVIEW RESOLUTION MODAL */}
      {reviewTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[93vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-white/20">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 truncate">
                  {reviewTicket.title}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <MapPin size={16} className="text-slate-400 shrink-0" /> {reviewTicket.location}
                </div>
              </div>
              <button onClick={() => setReviewTicket(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col space-y-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200/60 shadow-sm">Before</span>
                    <span className="text-sm sm:text-base font-black text-slate-800">Your Initial Report</span>
                  </div>

                  <div className="w-full aspect-video sm:h-56 bg-slate-100 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group">
                    {reviewTicket.photo_url ? (
                      <img src={reviewTicket.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Camera size={32} className="mx-auto mb-2 opacity-40" />
                        <span className="text-xs font-bold block uppercase tracking-widest">No photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-2">Description:</span>
                    <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                      {reviewTicket.description}
                    </p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-slate-200 pt-4 mt-5 shrink-0">
                      Reported: {new Date(reviewTicket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col space-y-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200/60 shadow-sm">After</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">Staff Resolution</span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${reviewTicket.color} shrink-0 shadow-sm`}>
                      {reviewTicket.label}
                    </span>
                  </div>

                  <div className="w-full aspect-video sm:h-56 bg-emerald-50/50 rounded-3xl border border-emerald-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group">
                    {reviewTicket.liveMatch?.resolution_photo_url ? (
                      <img src={reviewTicket.liveMatch.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-emerald-300 p-4">
                        <CheckCircle2 size={32} className="mx-auto mb-2 opacity-60" />
                        <span className="text-xs font-bold block uppercase tracking-widest text-emerald-600/70">No evidence photo</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 shrink-0 flex flex-col justify-between flex-1">
                    
                    {/* {reviewTicket.remarks && (
                      <div className="bg-emerald-50/80 border border-emerald-100/60 p-3 rounded-xl mb-2 shrink-0">
                        <span className="font-black text-emerald-700 block mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                          <CheckCircle2 size={12} strokeWidth={2.5} /> Remarks
                        </span>
                        <p className="text-xs text-emerald-900 font-semibold leading-relaxed">
                          "{reviewTicket.remarks}"
                        </p>
                      </div>
                    )} */}

                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Staff</span>
                        <span className="font-extrabold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
                          {reviewTicket.staffName}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Covered</span>
                        {reviewTicket.liveMatch?.cost !== undefined && reviewTicket.liveMatch.cost > 0 ? (
                          <span className="font-black text-lg text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200/60 shadow-sm">
                            ₱{reviewTicket.liveMatch.cost.toLocaleString()}
                          </span> 
                        ) : (
                          <span className="font-black text-slate-400 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs uppercase shadow-sm">
                            ₱0.00
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Mobile Footer Button */}
            <div className="p-5 bg-white border-t border-slate-100 shrink-0 md:hidden z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.02)]">
              <button 
                onClick={() => setReviewTicket(null)}
                className="w-full bg-[#081832] text-white py-4 rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ✨ 3. REVIEW ON HOLD MODAL (2-Column Layout) */}
      {reviewOnHoldTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-60 flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[93vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-white/20">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3 truncate">
                  {reviewOnHoldTicket.title}
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <MapPin size={16} className="text-slate-400 shrink-0" /> {reviewOnHoldTicket.location}
                </div>
              </div>
              <button onClick={() => setReviewOnHoldTicket(null)} className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col space-y-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-200/60 shadow-sm">Before</span>
                    <span className="text-sm sm:text-base font-black text-slate-800">Initial Report</span>
                  </div>

                  <div className="w-full aspect-video sm:h-56 bg-slate-100 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group">
                    {reviewOnHoldTicket.photo_url ? (
                      <img src={reviewOnHoldTicket.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Camera size={32} className="mx-auto mb-2 opacity-40" />
                        <span className="text-xs font-bold block uppercase tracking-widest">No photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-2">Description:</span>
                    <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                      {reviewOnHoldTicket.description}
                    </p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-slate-200 pt-5 mt-5 shrink-0">
                      Reported: {new Date(reviewOnHoldTicket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* ON HOLD UPDATE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col space-y-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-200/60 shadow-sm">Update</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">Staff Report</span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${reviewOnHoldTicket.color} shrink-0 shadow-sm`}>
                      {reviewOnHoldTicket.label}
                    </span>
                  </div>

                  <div className="w-full aspect-video sm:h-56 bg-slate-100 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group">
                    {(reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url) ? (
                      <img 
                        src={reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url} 
                        alt="On hold status" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <PauseCircle size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-40 text-purple-500" />
                        <span className="text-xs font-black block uppercase tracking-widest text-purple-600/70">Awaiting action or parts</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-purple-50 rounded-2xl p-5 border border-purple-100 space-y-2 shrink-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block border-b border-purple-200 pb-2 mb-2">Reason for delay:</span>
                      <p className="text-sm text-purple-800 leading-relaxed font-bold">
                        {reviewOnHoldTicket.liveMatch?.on_hold_reason || reviewOnHoldTicket.liveMatch?.remarks || "Task is currently on hold. We will update you soon as possible."}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs sm:text-sm border-t border-purple-200/60 pt-4 mt-2">
                      <span className="text-[10px] sm:text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">👤 Staff</span>
                      <span className="font-bold text-purple-900 bg-white px-3 py-1.5 rounded-xl border border-purple-100 shadow-sm">
                        {reviewOnHoldTicket.staffName || "Pending Assignment"}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Mobile Footer Button */}
            <div className="p-5 bg-white border-t border-slate-100 shrink-0 md:hidden z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.02)]">
              <button 
                onClick={() => setReviewOnHoldTicket(null)} 
                className="w-full bg-[#081832] text-white py-4 rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 4. SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-10 animate-in zoom-in-95 duration-500 border border-white/20">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-emerald-50">
              <CheckCircle2 size={40} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Request Sent!</h2>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">
              Your repair request is now with the property manager. We'll update you soon.
            </p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)} 
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-4 rounded-2xl text-base font-black transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// -------------------------------------------------------------
// ✨ FIXED HEIGHT KANBAN SKELETON (Matched to Owner Side)
// -------------------------------------------------------------
function KanbanSkeleton() {
  return (
    <div className="h-[340px] shrink-0 bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col animate-pulse">
      <div className="w-full h-36 bg-slate-100 shrink-0"></div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1 shrink-0">
          <div className="h-5 bg-slate-200 rounded-md w-1/2"></div>
          <div className="h-5 bg-slate-200 rounded-full w-14"></div>
        </div>
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-3 bg-slate-200 rounded-md w-1/3 mt-2"></div>
          <div className="h-3 bg-slate-100 rounded-md w-full mt-3"></div>
          <div className="h-3 bg-slate-100 rounded-md w-5/6"></div>
        </div>
        <div className="mt-auto pt-4 border-t border-slate-50 flex gap-2 shrink-0">
          <div className="h-8 bg-slate-200 rounded-full w-28"></div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ✨ STANDARDIZED EMPTY STATE (Matched to Owner Side)
// -------------------------------------------------------------
function EmptyState({ icon: Icon, title, message }: { icon: any, title: string, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 h-[340px] animate-in fade-in duration-300">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-400 border border-slate-100">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <h4 className="font-extrabold text-slate-700 mb-1.5">{title}</h4>
      <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">{message}</p>
    </div>
  );
}