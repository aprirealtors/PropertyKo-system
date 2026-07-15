"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Clock, Wrench, AlertCircle, CheckCircle2, MapPin, X, CheckCircle } from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

// ✨ Updated: Tanggapin ang highlightTicketId prop
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

  // ✨ NEW: States for Auto-scroll and Heartbeat Animation
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

        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profileData.admin_email)
          .ilike('tenant_name', profileData.name)
          .single();

        if (unitData) {
          setUnit(unitData);
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
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'tickets',
          filter: `admin_email=eq.${profile.admin_email}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isTenantTicket(payload.new)) {
              setTickets((current) => [payload.new, ...current]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (isTenantTicket(payload.new)) {
              setTickets((current) => 
                current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('tenant-live-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_tasks',
          filter: `admin_email=eq.${profile.admin_email}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLiveTasks((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setLiveTasks((current) => 
              current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
            );
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

      const unitLoc = unit ? `${unit.property_name} - ${unit.unit_number}` : (profile?.access_level || "Tenant Unit");
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
    if (s === 'pending' || s === 'open') {
      return { label: 'Pending', color: 'bg-slate-100 text-slate-600 border border-slate-200' };
    }
    if (s === 'in_progress' || s === 'in progress' || s === 'assigned to maintenance') {
      return { label: 'In Progress', color: 'bg-blue-50 text-blue-600 border border-blue-100' };
    }
    if (s === 'on_hold' || s === 'on hold') {
      return { label: 'On Hold', color: 'bg-purple-50 text-purple-700 border border-purple-100' };
    }
    if (s === 'completed' || s === 'resolved' || s === 'success') {
      return { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
    }
    if (s === 'failed') {
      return { label: 'Failed', color: 'bg-red-50 text-red-600 border border-red-100' };
    }
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

  // ✨ HEARTBEAT & SCROLL LOGIC FOR TENANT
  useEffect(() => {
    if (highlightTicketId && !isLoading && enrichedTickets.length > 0) {
      const actualId = highlightTicketId.split('_')[0]; // Tanggalin ang timestamp
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
    <div className="max-w-6xl mx-auto pb-10">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Maintenance & Repairs</h2>
          <p className="text-slate-500 text-sm mt-1">Submit a request and track status updates in real-time.</p>
        </div>
        <button 
          onClick={() => setIsRepairModalOpen(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <Wrench size={16} /> New Request
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-in fade-in duration-300">
          <CheckCircle2 size={24} className="text-[#359b46]" />
          <div>
            <h4 className="font-bold text-sm">Request Sent Successfully!</h4>
            <p className="text-xs mt-0.5">Management and maintenance staff have been notified.</p>
          </div>
        </div>
      )}

      {/* KANBAN BOARD LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: Open & In Progress */}
        <div>
          <h4 className="font-bold text-slate-700 text-sm mb-4">Open & In Progress <span className="ml-2 bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{openInProgressTasks.length}</span></h4>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
            ) : openInProgressTasks.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No open requests</div>
            ) : (
              openInProgressTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 ${
                      isHighlighted 
                        ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
                        : t.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'
                    }`}
                  >
                    {t.photo_url ? (
                      <div className="relative w-full h-28 bg-slate-100 border-b border-slate-100">
                        <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="relative w-full h-12 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">No Photo</span>
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-bold text-[#0a1e3f] text-sm leading-tight line-clamp-2">{t.title}</h4>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                          {t.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2 mt-1">
                        <p className="text-[#359b46] font-semibold text-xs truncate pr-2">
                          <MapPin size={12} className="inline mr-1 -mt-0.5" />
                          {t.location}
                        </p>
                        {t.priority === 'Urgent' && (
                          <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                            🚨 URGENT
                          </span>
                        )}
                      </div>
                      <p className={`text-xs flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                      
                      <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t text-xs ${isHighlighted ? 'border-blue-200' : 'border-slate-100'}`}>
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
        <div>
          <h4 className="font-bold text-slate-700 text-sm mb-4">On Hold <span className="ml-2 bg-purple-100 text-purple-700 px-2 rounded-full text-xs font-bold">{onHoldTasks.length}</span></h4>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
            ) : onHoldTasks.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No requests on hold</div>
            ) : (
              onHoldTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    className={`bg-slate-50 rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all opacity-90 hover:opacity-100 duration-500 ${
                      isHighlighted 
                        ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse opacity-100 z-10' 
                        : t.priority === 'Urgent' ? 'border-red-300 shadow-red-500/10' : 'border-slate-200'
                    }`}
                  >
                    {t.photo_url && (
                      <div className="relative w-full h-28 bg-slate-100 border-b border-slate-100">
                        <img src={t.photo_url} alt="Repair issue" className="w-full h-full object-cover grayscale-[30%]" />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <h4 className="font-bold text-slate-600 text-sm leading-tight line-clamp-2">{t.title}</h4>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                          {t.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2 mt-1">
                        <p className="text-slate-500 font-semibold text-xs truncate pr-2">
                          <MapPin size={12} className="inline mr-1 -mt-0.5" />
                          {t.location}
                        </p>
                        {t.priority === 'Urgent' && (
                          <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                            🚨 URGENT
                          </span>
                        )}
                      </div>
                      <p className={`text-xs flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
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
            {isLoading ? (
              <div className="text-center text-slate-400 text-sm py-4">Loading...</div>
            ) : resolvedTasks.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No resolved requests</div>
            ) : (
              resolvedTasks.map(t => {
                const isHighlighted = activeHighlightId === String(t.id);
                return (
                  <div 
                    key={t.id} 
                    id={`ticket-${t.id}`}
                    onClick={() => setReviewTicket(t)} 
                    className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all cursor-pointer duration-500 ${
                      isHighlighted 
                        ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
                        : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    {(t.liveMatch?.resolution_photo_url || t.photo_url) && (
                      <div className={`relative w-full h-28 border-b ${isHighlighted ? 'bg-blue-100 border-blue-200' : 'bg-emerald-100/50 border-emerald-100'}`}>
                        <img src={t.liveMatch?.resolution_photo_url || t.photo_url} alt="Resolved issue" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle size={14} className={`${isHighlighted ? 'text-blue-500' : 'text-[#359b46]'} mt-0.5 shrink-0`} />
                          <h4 className="font-bold text-[#0a1e3f] text-sm leading-tight line-clamp-2">{t.title}</h4>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${t.color} mt-0.5`}>
                          {t.label}
                        </span>
                      </div>
                      <p className="text-slate-500 font-semibold text-xs mt-1 truncate mb-2">
                        <MapPin size={12} className="inline mr-1 -mt-0.5" />
                        {t.location}
                      </p>
                      <p className={`text-xs flex-1 line-clamp-2 ${isHighlighted ? 'text-blue-600' : 'text-slate-500'}`}>{t.description}</p>
                    </div>
                  </div>
                );
              })
            )}
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

            <div className="p-5">
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

                <div className="pt-2">
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
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-[#0a1e3f] flex items-center gap-2">
                  {reviewTicket.title}
                </h2>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mt-1">
                  <MapPin size={14} className="text-slate-400" /> {reviewTicket.location}
                </div>
              </div>
              <button onClick={() => setReviewTicket(null)} className="text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* BEFORE */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Before</span>
                    <span className="text-sm font-bold text-slate-700">Your Report</span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center">
                    {reviewTicket.photo_url ? (
                      <img src={reviewTicket.photo_url} alt="Reported issue" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Camera size={32} className="mx-auto mb-2 opacity-50" />
                        <span className="text-sm font-medium">No photo submitted</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      {reviewTicket.description}
                    </p>
                    <div className="text-xs text-slate-400 font-medium border-t border-slate-200 pt-3">
                      Reported on: {new Date(reviewTicket.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">After</span>
                      <span className="text-sm font-bold text-slate-700">Resolution</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${reviewTicket.color}`}>
                      {reviewTicket.label}
                    </span>
                  </div>

                  <div className="w-full h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center relative">
                    {reviewTicket.liveMatch?.resolution_photo_url ? (
                      <img src={reviewTicket.liveMatch.resolution_photo_url} alt="Resolution" className="w-full h-full object-cover" />
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
                        👤 {reviewTicket.staffName}
                      </span>
                    </div>
                    
                    {reviewTicket.liveMatch?.cost !== undefined && reviewTicket.liveMatch.cost > 0 && (
                      <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipment Cost</span>
                        <span className="text-sm font-black text-[#0a1e3f]">₱{reviewTicket.liveMatch.cost.toLocaleString()}</span>
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