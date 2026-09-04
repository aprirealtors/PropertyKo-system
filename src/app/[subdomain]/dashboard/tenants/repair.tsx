"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Clock, Wrench, AlertCircle, Inbox, PauseCircle, CheckCircle2, AlertTriangle, MapPin, X, CheckCircle, User, ChevronRight, Check, Trash2, Droplets, Zap, Wind, Sparkles } from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

// ✨ ENTERPRISE: Symptom-Based Categories
const CATEGORIES = [
  { id: "Plumbing", label: "Plumbing / Water", icon: Droplets, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "Electrical", label: "Electrical / Light", icon: Zap, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "Aircon", label: "Aircon / HVAC", icon: Wind, color: "text-cyan-500", bg: "bg-cyan-50", border: "border-cyan-200" },
  { id: "Housekeeping", label: "Cleaning / Pest", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200" },
  { id: "General", label: "General Repair", icon: Wrench, color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" },
];

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
  
  const [repairTime, setRepairTime] = useState("");
  const [repairPriority, setRepairPriority] = useState("Normal");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [issueCategory, setIssueCategory] = useState(""); 
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // ✨ FIX: Mobile Tab Switcher State Added
  const [activeView, setActiveView] = useState<'open' | 'on_hold' | 'resolved'>('open');

  const [reviewActiveTicket, setReviewActiveTicket] = useState<any | null>(null); 
  const [reviewOnHoldTicket, setReviewOnHoldTicket] = useState<any | null>(null);
  const [reviewTicket, setReviewTicket] = useState<any | null>(null); 
  
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
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
    if (!issueCategory) {
      showToast("Please select an issue category.", "error");
      return;
    }
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

      const capitalizedTime = capitalizeWords(repairTime);
      const unitLoc = unit?.property_name ? `${unit.property_name} - ${unit.unit_number}` : (profile?.access_level || "Tenant Unit");
      
      const fullDesc = `Best time to visit: ${capitalizedTime || 'Anytime'}. Reported by ${profile?.name || 'Tenant'} (Tenant).`;

      const uniqueId = Math.floor(100000 + Math.random() * 900000);
      const finalTitle = `${issueCategory} Ticket #${uniqueId}`;

      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert([{
          admin_email: profile?.admin_email,
          reporter_email: currentEmail, 
          title: finalTitle,
          location: unitLoc,
          description: fullDesc,
          status: 'Open',
          photo_url: photoUrl,
          priority: repairPriority,
          remarks: issueCategory 
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
          message: `${profile?.name || 'A tenant'} (Tenant) reported a ${issueCategory} issue.`,
          reference_id: newTicket.id,
          is_read: false
        }]);

      setIssueCategory("");
      setRepairTime("");
      setRepairPriority("Normal");
      setSelectedImage(null);
      setIsRepairModalOpen(false); 
      setIsSuccessModalOpen(true);

    } catch (err: any) {
      console.error("Submit error:", err);
      showToast(`Failed to submit request: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Submitted', color: 'bg-slate-100 text-slate-700 border-slate-200', step: 1 };
    if (s === 'assigned to maintenance') return { label: 'Assigned', color: 'bg-amber-100 text-amber-800 border-amber-200', step: 2 };
    if (s === 'in_progress' || s === 'in progress' || s === 'working') return { label: 'Working', color: 'bg-blue-100 text-blue-700 border-blue-200', step: 3 };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', color: 'bg-purple-100 text-purple-700 border-purple-200', step: 2 };
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') return { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', step: 4 };
    return { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200', step: 1 };
  };

  const enrichedTickets = useMemo(() => {
    return tickets.map(ticket => {
      const match = liveTasks.find(task => task.title === ticket.title && task.location === ticket.location);
      const currentLiveStatus = match ? match.status : ticket.status;
      const badge = getStatusDisplay(currentLiveStatus);

      let staffName = "Pending Assignment";
      if (match?.assigned_to) {
        const memberMatch = teamMembers.find(m => m.email === match.assigned_to);
        staffName = memberMatch?.name ? memberMatch.name : match.assigned_to.split('@')[0];
      }

      return {
        ...ticket,
        liveMatch: match,
        currentLiveStatus,
        label: badge.label,
        color: badge.color,
        step: badge.step, 
        staffName,
        priority: match?.priority || ticket.priority || 'Normal',
        on_hold_reason: match?.on_hold_reason || ticket.on_hold_reason || null,
        staffRemarks: match?.remarks || null
      };
    });
  }, [tickets, liveTasks, teamMembers]);

  // ✨ ENTERPRISE FIX: Auto-Open Modal & Auto-Switch Mobile Tab on Notification Click
  useEffect(() => {
    if (highlightTicketId && !isLoading && enrichedTickets.length > 0) {
      const actualId = highlightTicketId.split('_')[0]; 
      setTimeout(() => {
        const matchingTicket = enrichedTickets.find(t => 
          String(t.id) === actualId || 
          (t.liveMatch && String(t.liveMatch.id) === actualId)
        );
        
        if (matchingTicket) {
          // 1. Aalamin ng system kung anong status para malaman anong Modal at Tab ang bubuksan
          const status = String(matchingTicket.currentLiveStatus).toLowerCase();
          
          if (status === 'on_hold' || status === 'on hold') {
            setActiveView('on_hold'); // Auto-switch tab sa mobile
            setReviewOnHoldTicket(matchingTicket); // Auto-open On Hold Modal
          } else if (status === 'completed' || status === 'resolved' || status === 'closed' || status === 'success') {
            setActiveView('resolved'); // Auto-switch tab sa mobile
            setReviewTicket(matchingTicket); // Auto-open Resolved Modal
          } else {
            setActiveView('open'); // Auto-switch tab sa mobile
            setReviewActiveTicket(matchingTicket); // Auto-open Active Modal
          }

          // 2. I-ha-highlight pa rin yung card sa background para alam nila kung nasaan
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
      }, 300); // 300ms delay para siguradong naka-render na ang DOM
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
    <div className="flex flex-col w-full max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-6 lg:p-8 md:pb-10">
      
      {/* Header */}
      <div className="flex-none shrink-0 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:px-8 sm:py-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight">Repair Tickets</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Request maintenance and track the progress live.</p>
          </div>
          <button 
            onClick={() => {
              setIssueCategory("");
              setRepairTime("");
              setSelectedImage(null);
              setIsRepairModalOpen(true);
            }} 
            className="w-full sm:w-auto justify-center bg-gradient-to-r from-[#359b46] to-[#277534] hover:from-[#2c813a] hover:to-[#1e5a28] text-white px-8 py-3.5 rounded-2xl text-sm font-black transition-all shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 active:scale-95"
          >
            <Wrench size={18} strokeWidth={2.5}/> Request Repair
          </button>
        </div>
      </div>

      {/* ✨ MOBILE TAB SWITCHER (Nakatago sa Desktop) */}
      <div className="md:hidden shrink-0 mb-4 bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200/80 mx-1 sm:mx-0">
        <button 
          onClick={() => setActiveView('open')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'open' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Inbox size={14} strokeWidth={2.5}/> Active <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : openInProgressTasks.length}</span>
        </button>
        <button 
          onClick={() => setActiveView('on_hold')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'on_hold' ? 'bg-white text-amber-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <PauseCircle size={14} strokeWidth={2.5}/> Hold <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : onHoldTasks.length}</span>
        </button>
        <button 
          onClick={() => setActiveView('resolved')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${activeView === 'resolved' ? 'bg-white text-[#359b46] shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CheckCircle2 size={14} strokeWidth={2.5}/> Resolved <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">{isLoading ? "-" : resolvedTasks.length}</span>
        </button>
      </div>

      {/* Grid Kanban (Hybrid UI) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 w-full overflow-y-auto custom-scrollbar">
          
        {/* ================= Column 1: Active Tickets ================= */}
        <div className={`${activeView === 'open' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]`}>
          <h4 className="hidden md:flex font-extrabold text-slate-800 text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
            <span className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Inbox size={16} strokeWidth={2.5} /></div>
              Active Requests
            </span>
            <span className="bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : openInProgressTasks.length}
            </span>
          </h4>
          
          <div className="flex flex-col space-y-4">
            {isLoading ? (
              <><KanbanSkeleton /><KanbanSkeleton /></>
            ) : openInProgressTasks.length === 0 ? (
              <EmptyState icon={Inbox} title="No active requests" message="When you report an issue, it will be tracked here." />
            ) : (
              openInProgressTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewActiveTicket(t)}
                    className={`group h-[200px] shrink-0 bg-white rounded-3xl border flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 p-5 ${
                      isHighlighted ? 'ring-4 ring-emerald-500/50 bg-emerald-50 border-emerald-400 scale-[1.02] shadow-xl animate-pulse z-10' : 
                      t.priority === 'Urgent' ? 'border-l-4 border-red-500 border-y-slate-100 border-r-slate-100 shadow-sm' : 'border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[#0a1e3f] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${t.color}`}>{t.label}</span>
                    </div>

                    <p className="text-[#359b46] font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{t.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-slate-500 line-clamp-2">
                        {t.description}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0a1e3f] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                          {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned Staff</span>
                          <span className="text-xs font-bold text-slate-700">{t.staffName}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-[#359b46] transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= Column 2: On Hold ================= */}
        <div className={`${activeView === 'on_hold' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]`}>
          <h4 className="hidden md:flex font-extrabold text-slate-800 text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
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
              <EmptyState icon={PauseCircle} title="No Holding Tickets" message="If a repair needs parts or gets delayed, it will show here." />
            ) : (
              onHoldTasks.map(t => {
                const holdReason = t.on_hold_reason;
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewOnHoldTicket(t)}
                    className="group h-[200px] shrink-0 bg-white rounded-3xl border border-amber-200/60 flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-400 p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]"
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[#0a1e3f] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${t.color}`}>{t.label}</span>
                    </div>

                    <p className="text-slate-500 font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{t.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-slate-500 line-clamp-2">
                        {t.description}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold shadow-sm">
                          {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned Staff</span>
                          <span className="text-xs font-bold text-slate-700">{t.staffName}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= Column 3: Resolved ================= */}
        <div className={`${activeView === 'resolved' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-slate-50/70 rounded-[28px] p-4 sm:p-5 border border-slate-200/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]`}>
          <h4 className="hidden md:flex font-extrabold text-slate-800 text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
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
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewTicket(t)} 
                    className="group h-[200px] shrink-0 bg-white rounded-3xl border flex flex-col transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-[#359b46]/50 border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5"
                  >
                    <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                      <h4 className="font-extrabold text-[#0a1e3f] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                      <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${t.color}`}>{t.label}</span>
                    </div>
                    
                    <p className="text-slate-500 font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                      <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{t.location}</span>
                    </p>

                    <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                      <p className="text-xs leading-relaxed font-semibold text-emerald-700 line-clamp-2">
                        <CheckCircle2 size={12} className="inline mr-1 text-emerald-500" strokeWidth={3} />
                        {t.staffRemarks || "Task completed successfully."}
                      </p>
                    </div>

                    <div className="shrink-0 mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold border border-emerald-100">
                          {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Fixed By</span>
                          <span className="text-xs font-bold text-slate-700">{t.staffName}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
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
          className={`fixed bottom-6 right-4 md:right-10 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] font-bold text-sm transition-all transform animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${
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

      {/* ✨ 1. ENTERPRISE REPORT REPAIR MODAL */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-white/10">
            
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 shadow-sm z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Report an Issue</h2>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5">Let us know what needs fixing.</p>
              </div>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/50 pb-safe">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Visual Category Grid */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Step 1: Select Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {CATEGORIES.map(cat => {
                      const isSelected = issueCategory === cat.id;
                      const Icon = cat.icon;
                      return (
                        <div 
                          key={cat.id}
                          onClick={() => {
                            setIssueCategory(cat.id);
                          }}
                          className={`cursor-pointer rounded-2xl border-2 flex flex-col items-center justify-center p-3 sm:p-4 text-center transition-all duration-200 active:scale-95 ${
                            isSelected ? `${cat.border} ${cat.bg} shadow-md scale-[1.02]` : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm hover:shadow'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isSelected ? 'bg-white shadow-sm' : cat.bg}`}>
                            <Icon size={20} className={cat.color} strokeWidth={isSelected ? 2.5 : 2} />
                          </div>
                          <span className={`text-[10px] sm:text-xs font-black tracking-tight ${isSelected ? cat.color : 'text-slate-600'}`}>{cat.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Animated reveal */}
                {issueCategory && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 2: Upload Photo (Required)</label>
                      
                      {selectedImage ? (
                        <div className="flex flex-col w-full p-2 rounded-2xl border-2 border-[#359b46] bg-emerald-50 shadow-sm">
                          <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-900 mb-2">
                            <img src={URL.createObjectURL(selectedImage)} alt="Repair issue preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center justify-between px-2 pb-1">
                            <span className="text-[10px] text-emerald-700 font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12} strokeWidth={3}/> Image Ready</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); setSelectedImage(null); }} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-100 px-2 py-1 rounded transition-colors" disabled={isSubmitting}>Remove</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* MOBILE VIEW (Side-by-side) */}
                          <div className="flex md:hidden gap-3 w-full">
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#359b46] hover:bg-emerald-50 cursor-pointer bg-white shadow-sm transition-all group">
                              <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-[#359b46] transition-colors"><Camera size={20} strokeWidth={2.5}/></div>
                              <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[#359b46] uppercase tracking-wide">Take Photo</span>
                              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                            </label>
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#359b46] hover:bg-emerald-50 cursor-pointer bg-white shadow-sm transition-all group">
                              <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-[#359b46] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                              </div>
                              <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[#359b46] uppercase tracking-wide">Gallery</span>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                            </label>
                          </div>

                          {/* DESKTOP VIEW (Full Width Upload) */}
                          <div className="hidden md:flex w-full">
                            <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#359b46] hover:bg-emerald-50 cursor-pointer bg-white shadow-sm transition-all group">
                              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-emerald-100 flex items-center justify-center text-slate-400 group-hover:text-[#359b46] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                              </div>
                              <span className="text-sm font-black text-slate-700 group-hover:text-[#359b46] uppercase tracking-wide">Upload Photo</span>
                              <span className="text-xs text-slate-400 font-medium">Click to browse from your computer</span>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                            </label>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                        <select required value={repairPriority} onChange={(e) => setRepairPriority(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#359b46] focus:ring-4 focus:ring-[#359b46]/10 text-xs sm:text-sm font-bold text-slate-700 bg-white hover:border-slate-300 transition-all shadow-sm" disabled={isSubmitting}>
                          <option value="Normal">Normal</option>
                          <option value="Urgent">🚨 Urgent</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Time</label>
                        <input type="text" required placeholder="e.g. Morning..." value={repairTime} onChange={(e) => setRepairTime(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-[#359b46] focus:ring-4 focus:ring-[#359b46]/10 text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 transition-all shadow-sm" disabled={isSubmitting} />
                      </div>
                    </div>

                    <div className="pt-2 sm:pt-4 pb-2">
                      <button type="submit" disabled={isSubmitting} className="w-full bg-[#0a1e3f] hover:bg-[#122b54] disabled:bg-slate-300 text-white py-4 rounded-2xl text-sm font-black transition-all shadow-lg active:scale-[0.98] flex justify-center items-center gap-2">
                        {isSubmitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Sending...</> : "Submit Request"}
                      </button>
                    </div>

                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 2. ACTIVE REQUEST DETAILS MODAL */}
      {reviewActiveTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-white/20">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] flex items-center gap-2 truncate tracking-tight">
                  Request Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <Inbox size={16} className="text-blue-500 shrink-0" /> {reviewActiveTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewActiveTicket(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* SUBMITTED DETAILS */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">Report</span>
                    <span className="text-sm sm:text-base font-black text-slate-800">Issue Evidence</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewActiveTicket.photo_url ? (
                      <img src={reviewActiveTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo</span></div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-2">Description:</span>
                    <p className="text-sm text-slate-700 leading-relaxed font-semibold">{reviewActiveTicket.description}</p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-slate-200 pt-4 mt-5 shrink-0">
                      Reported: {new Date(reviewActiveTicket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* CURRENT STATUS */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-blue-100 shadow-sm flex flex-col space-y-5">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200/60 shadow-sm">Status</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">Current Progress</span>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${reviewActiveTicket.color} shrink-0 shadow-sm`}>{reviewActiveTicket.label}</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-blue-50/50 rounded-3xl border border-blue-100 overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-inner p-6 text-center">
                    <Clock size={48} className="text-blue-400 mb-4 opacity-50" strokeWidth={1.5} />
                    <h3 className="font-black text-blue-900 text-lg sm:text-xl mb-2">
                      {String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('progress') || String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('working') ? "Work in Progress" : "Request Received"}
                    </h3>
                    <p className="text-sm text-blue-700/80 font-medium max-w-[250px]">
                      {String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('progress') || String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('working') ? "Our maintenance staff is currently working on your request." : "Your request is in queue and will be assigned to a staff member shortly."}
                    </p>
                  </div>

                  <div className="bg-blue-50/40 rounded-2xl p-5 border border-blue-100/50 space-y-4 shrink-0 flex flex-col justify-between flex-1">
                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex justify-between items-center border-t border-blue-100/60 pt-4">
                        <span className="text-[10px] font-black text-blue-600/60 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Assigned To</span>
                        <span className="font-extrabold text-blue-900 bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm text-xs">
                          {reviewActiveTicket.staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 shrink-0 md:hidden z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.02)]">
              <button onClick={() => setReviewActiveTicket(null)} className="w-full bg-[#081832] text-white py-4 rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 3. REVIEW RESOLUTION MODAL */}
      {reviewTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-white/20">
            
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] flex items-center gap-2 truncate tracking-tight">
                  Resolution Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <CheckCircle2 size={16} className="text-[#359b46] shrink-0" /> {reviewTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewTicket(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                
                {/* BEFORE */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">Before</span>
                    <span className="text-sm sm:text-base font-black text-slate-800">Your Initial Report</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewTicket.photo_url ? (
                      <img src={reviewTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo</span></div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2 mb-2">Description:</span>
                    <p className="text-sm text-slate-700 leading-relaxed font-semibold">{reviewTicket.description}</p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-slate-200 pt-4 mt-5 shrink-0">
                      Reported: {new Date(reviewTicket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-emerald-100 shadow-[0_4px_20px_rgba(16,185,129,0.05)] flex flex-col space-y-5 hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)] transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200/60 shadow-sm">After</span>
                      <span className="text-sm sm:text-base font-black text-slate-800">Resolution Status</span>
                    </div>
                    <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border bg-emerald-50 text-[#359b46] border-emerald-200/60 shadow-sm"><Check size={12} className="inline mr-1"/> Success</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-3xl border border-emerald-100 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group relative z-10 p-1">
                    {reviewTicket.liveMatch?.resolution_photo_url ? (
                      <img src={reviewTicket.liveMatch.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-emerald-300 p-4"><CheckCircle2 size={32} className="mx-auto mb-2 opacity-60" /><span className="text-xs font-bold block uppercase tracking-widest text-emerald-600/70">No evidence photo</span></div>
                    )}
                  </div>

                  <div className="bg-emerald-50/40 rounded-2xl p-5 border border-emerald-100/50 space-y-4 shrink-0 flex flex-col justify-between flex-1 relative z-10">
                    {reviewTicket.staffRemarks && (
                       <div>
                         <span className="text-[10px] font-black text-[#359b46] uppercase tracking-widest block border-b border-emerald-100 pb-2 mb-2">Staff Remarks:</span>
                         <p className="text-sm text-emerald-900 leading-relaxed font-bold">"{reviewTicket.staffRemarks}"</p>
                       </div>
                    )}

                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex justify-between items-center border-t border-emerald-100/60 pt-4">
                        <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Fixed By</span>
                        <span className="font-extrabold text-emerald-900 bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm text-xs">
                          {reviewTicket.staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-white border-t border-slate-100 shrink-0 md:hidden z-10 shadow-[0_-10px_20px_rgb(0,0,0,0.02)]">
              <button onClick={() => setReviewTicket(null)} className="w-full bg-[#081832] text-white py-4 rounded-2xl font-black text-base shadow-lg active:scale-[0.98] transition-all">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 4. REVIEW ON HOLD MODAL */}
      {reviewOnHoldTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-60 flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-white/20">

            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 z-10 shadow-sm">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] flex items-center gap-2 truncate tracking-tight">
                  Hold Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <Inbox size={16} className="text-blue-500 shrink-0" /> {reviewOnHoldTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewOnHoldTicket(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-2xl shrink-0 active:scale-95 text-slate-500">
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

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewOnHoldTicket.photo_url ? (
                      <img src={reviewOnHoldTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
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

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-3xl border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {(reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url) ? (
                      <img 
                        src={reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url} 
                        alt="On hold status" 
                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" 
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

      {/* ✨ 5. SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 sm:p-10 animate-in zoom-in-95 duration-500 border border-white/20">
            <div className="w-20 h-20 bg-emerald-100 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-emerald-50">
              <CheckCircle2 size={40} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] mb-3">Request Sent!</h2>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium px-2">
              Your repair request is now with the property manager. Check your Active Requests to track its progress.
            </p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)} 
              className="w-full bg-gradient-to-r from-[#359b46] to-[#277534] hover:from-[#2c813a] hover:to-[#1e5a28] text-white px-4 py-4 rounded-2xl text-base font-black transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
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
// ✨ FIXED HEIGHT KANBAN SKELETON
// -------------------------------------------------------------
function KanbanSkeleton() {
  return (
    <div className="h-[200px] shrink-0 bg-white rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden flex flex-col animate-pulse">
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1 shrink-0">
          <div className="h-5 bg-slate-200 rounded-md w-1/2"></div>
        </div>
        <div className="flex-1 flex flex-col gap-2.5">
          <div className="h-3 bg-slate-200 rounded-md w-1/3 mt-2"></div>
          <div className="h-3 bg-slate-100 rounded-md w-full mt-3"></div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ✨ STANDARDIZED EMPTY STATE
// -------------------------------------------------------------
function EmptyState({ icon: Icon, title, message }: { icon: any, title: string, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 h-[200px] animate-in fade-in duration-300">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-400 border border-slate-100">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <h4 className="font-extrabold text-[#0a1e3f] mb-1.5">{title}</h4>
      <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">{message}</p>
    </div>
  );
}