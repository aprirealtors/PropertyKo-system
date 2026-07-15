"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Clock, Wrench, AlertCircle, CheckCircle2, MapPin, X, CheckCircle, ArrowRight, User } from 'lucide-react';
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
  const [successMsg, setSuccessMsg] = useState(false);

  const [reviewTicket, setReviewTicket] = useState<any | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

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
          .select('id, title, location, status, admin_email, assigned_to, cost, resolution_photo_url, priority, description, created_at')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(false);

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

      const unitLoc = unit?.property_name ? `${unit.property_name} - ${unit.unit_number}` : (profile?.access_level || "Tenant Unit");
      const fullDesc = `Best time to visit: ${repairTime}. Reported by ${profile?.name || 'Tenant'} (Tenant).`;

      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert([{
          admin_email: profile?.admin_email,
          reporter_email: currentEmail, 
          title: repairIssue,
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
          message: `${profile?.name || 'A tenant'} (Tenant) reported an issue: ${repairIssue}`,
          reference_id: newTicket.id,
          is_read: false
        }]);

      setRepairIssue("");
      setRepairTime("");
      setRepairPriority("Normal");
      setSelectedImage(null);
      setIsRepairModalOpen(false); 
      setSuccessMsg(true);
      
      setTimeout(() => setSuccessMsg(false), 4000);

    } catch (err: any) {
      console.error("Submit error:", err);
      alert(`Failed to submit request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Pending', color: 'bg-slate-100 text-slate-600 border border-slate-200' };
    if (s === 'in_progress' || s === 'in progress' || s === 'assigned to maintenance') return { label: 'In Progress', color: 'bg-blue-50 text-blue-600 border border-blue-100' };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', color: 'bg-purple-50 text-purple-700 border border-purple-100' };
    if (s === 'completed' || s === 'resolved' || s === 'success') return { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
    if (s === 'failed') return { label: 'Failed', color: 'bg-red-50 text-red-600 border border-red-100' };
    return { label: status, color: 'bg-slate-100 text-slate-600 border border-slate-200' };
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
        color: badge.color,
        staffName,
        priority: match?.priority || ticket.priority || 'Normal'
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
    // ✨ FIX: Main container changed to h-auto on mobile, fixed h-full on desktop
    <div className="flex flex-col w-full h-auto md:h-[calc(100vh-100px)] pb-10 md:pb-4">
      
      {/* FIXED HEADER SECTION */}
      <div className="flex-none pb-6 shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Maintenance & Repairs</h2>
            <p className="text-slate-500 text-sm mt-1">Submit a request and track status updates in real-time.</p>
          </div>
          <button 
            onClick={() => setIsRepairModalOpen(true)} 
            className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Wrench size={16} /> New Request
          </button>
        </div>

        {successMsg && (
          <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-in fade-in duration-300">
            <CheckCircle2 size={24} className="text-[#359b46] shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Request Sent Successfully!</h4>
              <p className="text-xs mt-0.5">Management and maintenance staff have been notified.</p>
            </div>
          </div>
        )}
      </div>

      {/* ✨ KANBAN COLUMNS CONTAINER (No horizontal scroll on mobile) */}
      <div className="flex-1 min-h-0">
        {/* ✨ FIX: grid-cols-1 on mobile naturally stacks downwards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-full w-full">
          
          {/* Column 1: Open & In Progress */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 shrink-0 flex items-center justify-between">
              Open & In Progress 
              <span className="bg-blue-100 text-[#1d82f5] px-2.5 py-0.5 rounded-full text-xs font-bold">{openInProgressTasks.length}</span>
            </h4>
            {/* ✨ FIX: overflow-y-visible on mobile, auto on desktop */}
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {isLoading ? (
                <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
              ) : openInProgressTasks.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No open requests</div>
              ) : (
                openInProgressTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} 
                      id={`ticket-${t.id}`}
                      className={`h-auto min-h-[260px] shrink-0 bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 ${
                        isHighlighted 
                          ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
                          : t.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'
                      }`}
                    >
                      {t.photo_url ? (
                        <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100">
                          <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="relative w-full h-32 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span>
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-[#0a1e3f] text-sm leading-snug">{t.title}</h4>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                            {t.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <p className="text-[#359b46] font-semibold text-xs pr-2">
                            <MapPin size={12} className="inline mr-1 -mt-0.5" />
                            {t.location}
                          </p>
                          {t.priority === 'Urgent' && (
                            <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                              🚨 URGENT
                            </span>
                          )}
                        </div>
                        <p className={`text-xs flex-1 min-h-0 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        
                        <div className={`shrink-0 flex items-center gap-1.5 mt-4 pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                          <span className={`font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                            👤 {t.staffName}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: On Hold */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 shrink-0 flex items-center justify-between">
              On Hold 
              <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{onHoldTasks.length}</span>
            </h4>
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {isLoading ? (
                <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
              ) : onHoldTasks.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No requests on hold</div>
              ) : (
                onHoldTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} 
                      id={`ticket-${t.id}`}
                      className={`h-auto min-h-[260px] shrink-0 bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all opacity-90 hover:opacity-100 duration-500 ${
                        isHighlighted 
                          ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse opacity-100 z-10' 
                          : t.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'
                      }`}
                    >
                      {t.photo_url ? (
                        <div className="relative w-full h-32 shrink-0 bg-slate-100 border-b border-slate-100">
                          <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover grayscale-[30%]" />
                        </div>
                      ) : (
                        <div className="relative w-full h-32 shrink-0 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo</span>
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4 className="font-bold text-slate-600 text-sm leading-snug">{t.title}</h4>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                            {t.label}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2 mt-1">
                          <p className="text-slate-500 font-semibold text-xs pr-2">
                            <MapPin size={12} className="inline mr-1 -mt-0.5" />
                            {t.location}
                          </p>
                          {t.priority === 'Urgent' && (
                            <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                              🚨 URGENT
                            </span>
                          )}
                        </div>
                        <p className={`text-xs flex-1 min-h-0 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        
                        <div className={`shrink-0 flex items-center gap-1.5 mt-4 pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
                          <span className={`font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                            👤 {t.staffName}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Resolved */}
          <div className="flex flex-col h-auto md:h-full bg-slate-100/50 rounded-2xl p-4 border border-slate-200/60 shadow-sm w-full shrink-0">
            <h4 className="font-bold text-slate-700 text-sm mb-4 shrink-0 flex items-center justify-between">
              Resolved 
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{resolvedTasks.length}</span>
            </h4>
            <div className="flex-1 overflow-y-visible md:overflow-y-auto space-y-4 pr-0 md:pr-1 pb-2">
              {isLoading ? (
                <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
              ) : resolvedTasks.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-white">No resolved requests</div>
              ) : (
                resolvedTasks.map(t => {
                  const isHighlighted = activeHighlightId === String(t.id);
                  return (
                    <div 
                      key={t.id} 
                      id={`ticket-${t.id}`}
                      onClick={() => setReviewTicket(t)} 
                      className={`h-auto min-h-[260px] shrink-0 rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all cursor-pointer duration-500 ${
                        isHighlighted 
                          ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
                          : 'bg-white border-emerald-200'
                      }`}
                    >
                      {(t.liveMatch?.resolution_photo_url || t.photo_url) ? (
                        <div className={`relative w-full h-32 shrink-0 border-b ${isHighlighted ? 'bg-blue-100 border-blue-200' : 'bg-emerald-100/50 border-emerald-100'}`}>
                          <img src={t.liveMatch?.resolution_photo_url || t.photo_url} alt="Resolved issue" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`relative w-full h-32 shrink-0 border-b flex items-center justify-center ${isHighlighted ? 'bg-blue-100 border-blue-200 text-blue-300' : 'bg-emerald-50 border-emerald-100 text-emerald-300'}`}>
                          <span className="text-xs font-bold uppercase tracking-wider">No Photo</span>
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col min-h-0 bg-emerald-50/30">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <div className="flex items-start gap-1.5">
                            <CheckCircle size={14} className={`${isHighlighted ? 'text-blue-500' : 'text-[#359b46]'} mt-0.5 shrink-0`} />
                            <h4 className="font-bold text-[#0a1e3f] text-sm leading-snug">{t.title}</h4>
                          </div>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                            {t.label}
                          </span>
                        </div>
                        <p className="text-slate-500 font-semibold text-xs mt-1 pr-2 mb-2">
                          <MapPin size={12} className="inline mr-1 -mt-0.5" />
                          {t.location}
                        </p>
                        <p className={`text-xs flex-1 min-h-0 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                        
                        <div className={`shrink-0 flex items-center justify-between mt-4 pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-emerald-200/60'}`}>
                          <span className={`font-medium px-2 py-0.5 rounded-full border ${isHighlighted ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200'}`}>
                            👤 {t.staffName}
                          </span>
                          {t.liveMatch?.cost !== undefined && t.liveMatch.cost > 0 ? (
                            <span className="font-black text-[#0a1e3f] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              ₱{t.liveMatch.cost.toLocaleString()}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-400 text-[10px] uppercase">No Cost</span>
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
      </div>

      {/* NEW REPAIR MODAL */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f] flex items-center gap-2">
                <Wrench size={18} className="text-blue-600" /> New Request
              </h2>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[75vh]">
              <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  type="text" 
                  required
                  value={repairIssue}
                  onChange={(e) => setRepairIssue(e.target.value)}
                  placeholder="What needs fixing?" 
                  disabled={isSubmitting}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm text-slate-700"
                />
                
                <select
                  required
                  value={repairPriority}
                  onChange={(e) => setRepairPriority(e.target.value)}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm text-slate-700 bg-white"
                  disabled={isSubmitting}
                >
                  <option value="Normal">Normal (Can wait)</option>
                  <option value="Urgent">🚨 Urgent (Needs attention today)</option>
                </select>

                <label className="w-full p-4 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all cursor-pointer bg-slate-50 hover:bg-blue-50/50">
                  <Camera size={20} />
                  <span className={`font-medium text-sm ${selectedImage ? 'text-blue-600 font-bold' : ''}`}>
                    {selectedImage ? selectedImage.name : "Attach photo"}
                  </span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </label>

                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required
                    value={repairTime}
                    onChange={(e) => setRepairTime(e.target.value)}
                    placeholder="Preferred visit time" 
                    disabled={isSubmitting}
                    className="w-full pl-11 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm text-slate-700"
                  />
                </div>

                <div className="pt-2 pb-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-[#1e88e5] disabled:bg-blue-300 text-white rounded-xl py-3.5 font-bold hover:bg-blue-600 active:scale-[0.98] transition-all shadow-md"
                  >
                    {isSubmitting ? "Sending..." : "Send Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW RESOLUTION MODAL */}
      {reviewTicket && (
        <div className="fixed inset-0 bg-[#0a1e3f]/75 backdrop-blur-md z-50 flex items-center justify-center p-0 sm:p-4 transition-all duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[93vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-300">
            
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2 truncate">
                  {reviewTicket.title}
                </h2>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 mt-1 truncate">
                  <MapPin size={14} className="text-slate-400 shrink-0" /> {reviewTicket.location}
                </div>
              </div>
              <button 
                onClick={() => setReviewTicket(null)} 
                className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors p-2 rounded-xl ml-4 shrink-0 shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-0 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 h-full">
                
                {/* BEFORE COLUMN CARD */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">Before</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-700">Your Initial Report</span>
                  </div>

                  <div className="w-full aspect-video sm:h-48 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTicket.photo_url ? (
                      <img src={reviewTicket.photo_url} alt="Reported issue" className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Camera size={28} className="mx-auto mb-1.5 opacity-40" />
                        <span className="text-xs font-medium block">No photo submitted</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50/60 rounded-xl p-3 sm:p-4 border border-slate-100 flex flex-col justify-between">
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                      {reviewTicket.description}
                    </p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-medium border-t border-slate-200/60 pt-2.5 mt-3 shrink-0">
                      Reported on: {new Date(reviewTicket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER COLUMN CARD */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex flex-col space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">After</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700">Staff Resolution</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${reviewTicket.color} shrink-0`}>
                      {reviewTicket.label}
                    </span>
                  </div>

                  <div className="w-full aspect-video sm:h-48 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                    {reviewTicket.liveMatch?.resolution_photo_url ? (
                      <img src={reviewTicket.liveMatch.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-cover transition-transform hover:scale-105 duration-300" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Wrench size={28} className="mx-auto mb-1.5 opacity-40" />
                        <span className="text-xs font-medium block">No resolution photo uploaded</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50/60 rounded-xl p-3 sm:p-4 border border-slate-100 space-y-3 shrink-0">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">👤 Staff In Charge</span>
                      <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {reviewTicket.staffName}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center border-t border-slate-200/60 pt-3 text-xs sm:text-sm">
                      <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Material / Cost Covered</span>
                      {reviewTicket.liveMatch?.cost !== undefined && reviewTicket.liveMatch.cost > 0 ? (
                        <span className="font-extrabold text-[#0a1e3f] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                          ₱{reviewTicket.liveMatch.cost.toLocaleString()}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-400 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] uppercase">
                          ₱0.00
                        </span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex shrink-0 sm:hidden">
              <button 
                onClick={() => setReviewTicket(null)}
                className="w-full bg-[#0a1e3f] text-white py-3 rounded-xl font-bold text-sm shadow-md active:scale-[0.99] transition-all"
              >
                Back to Dashboard
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}