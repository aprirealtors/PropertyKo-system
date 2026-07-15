"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  Bell, CheckCircle2, ChevronRight, Camera, 
  Wrench, X, AlertTriangle, Briefcase, CheckCheck, Trash2, MapPin, CheckCircle, PauseCircle, AlertCircle, User
} from "lucide-react";

export default function OwnerDashboard() {
  const router = useRouter();
  
  const [userData, setUserData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  
  const [payoutThisMonth, setPayoutThisMonth] = useState(0);
  const [myUnitsList, setMyUnitsList] = useState<any[]>([]); 
  const [unitsCount, setUnitsCount] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [collectedGross, setCollectedGross] = useState(0);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedUnitForRepair, setSelectedUnitForRepair] = useState(""); 
  const [repairPriority, setRepairPriority] = useState("Normal");

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [reviewTicket, setReviewTicket] = useState<any | null>(null);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // ✨ NEW: States for Auto-scroll and Heartbeat Animation
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);

  // ✨ White Label & User Modal States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  
  // ✨ Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchOwnerData();
  }, []);

  const fetchOwnerData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      setUserEmail(authData.user.email || "");

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (data) {
        setUserData(data);
        
        // ✨ Fetch the parent admin's organization to get the white-label logo
        if (data.admin_email) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('logo_url')
            .eq('admin_email', data.admin_email)
            .single();

          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }
        }

        const { data: membersData } = await supabase
          .from('team_members')
          .select('name, email')
          .eq('admin_email', data.admin_email);
        if (membersData) setTeamMembers(membersData);
        
        const { data: unitsData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', data.admin_email);

        if (unitsData) {
          const myUnits = unitsData.filter((unit: any) => {
            const unitFullName = `${unit.property_name} - ${unit.unit_number}`;
            const inAccessLevel = data.access_level?.includes(unitFullName);
            const isNamedOwner = unit.owner_name?.toLowerCase().trim() === data.name?.toLowerCase().trim();
            return inAccessLevel || isNamedOwner;
          });

          setMyUnitsList(myUnits); 
          setUnitsCount(myUnits.length);
          setOccupiedCount(myUnits.filter((u: any) => u.status === 'Occupied').length);
          
          const gross = myUnits.reduce((acc: number, curr: any) => acc + (curr.monthly_rent || 0), 0);
          setCollectedGross(gross);
          setPayoutThisMonth(gross); 
        }

        const { data: tasksData } = await supabase
          .from('maintenance_tasks')
          .select('id, title, location, status, admin_email, assigned_to, cost, resolution_photo_url, priority, description, created_at')
          .eq('admin_email', data.admin_email);
        if (tasksData) setLiveTasks(tasksData);

        const { data: ticketsData } = await supabase
          .from('tickets') 
          .select('*')
          .eq('admin_email', data.admin_email)
          .order('created_at', { ascending: false });

        if (ticketsData) {
          const ownerTickets = ticketsData.filter((t: any) => 
            t.reporter_email === authData.user.email || 
            (String(t.description).includes(data.name) && String(t.description).includes('(Owner)'))
          );
          setMyTickets(ownerTickets);
        }

        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient', authData.user.email) 
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (notifData) {
          setNotifications(notifData);
          setUnreadCount(notifData.filter(n => !n.is_read).length);
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!userEmail) return;

    const realtimeChannel = supabase
      .channel('owner-live-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient=eq.${userEmail}` 
        },
        (payload) => {
          setNotifications((current) => [payload.new, ...current]);
          setUnreadCount((count) => count + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userData?.admin_email || !userEmail) return;

    const isOwnerTicket = (ticket: any) => {
      return ticket.reporter_email === userEmail || 
             (String(ticket.description).includes(userData.name) && String(ticket.description).includes('(Owner)'));
    };

    const ticketsChannel = supabase
      .channel('owner-live-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `admin_email=eq.${userData.admin_email}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isOwnerTicket(payload.new)) {
              setMyTickets((current) => [payload.new, ...current]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (isOwnerTicket(payload.new)) {
              setMyTickets((current) => 
                current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setMyTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const tasksChannel = supabase
      .channel('owner-live-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_tasks',
          filter: `admin_email=eq.${userData.admin_email}`
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
  }, [userData, userEmail]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ✨ Helper to trigger the toast
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openRepairModal = () => {
    if (myUnitsList.length === 1) {
      setSelectedUnitForRepair(`${myUnitsList[0].property_name} - ${myUnitsList[0].unit_number}`);
    } else {
      setSelectedUnitForRepair("");
    }
    setRepairPriority("Normal");
    setIsRepairModalOpen(true);
  };

  const handleReportRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let photoUrl = "";
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(`owner-uploads/${fileName}`, selectedImage);
          
        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);
          
        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      const { data: currentAuth } = await supabase.auth.getUser();
      const finalEmail = currentAuth.user?.email || userEmail;

      const { data: newTicket, error } = await supabase
        .from('tickets') 
        .insert([{
          admin_email: userData?.admin_email,
          reporter_email: finalEmail,
          title: repairIssue,
          location: selectedUnitForRepair || userData?.access_level || "Owner's Unit",
          description: `Best time to visit: ${repairTime}. Reported by ${userData?.name || 'Owner'} (Owner).`, 
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
          admin_email: userData?.admin_email,
          recipient: 'MANAGER',
          type: 'TICKET',
          title: 'New Repair Request',
          message: `${userData?.name || 'An owner'} (Owner) reported an issue: ${repairIssue}`,
          reference_id: newTicket.id,
          is_read: false
        }]);

      setIsRepairModalOpen(false);
      setRepairIssue("");
      setRepairTime("");
      setRepairPriority("Normal");
      setSelectedImage(null);
      setSelectedUnitForRepair("");
      
      setIsSuccessModalOpen(true);

    } catch (err: any) {
      console.error("Error submitting repair:", err);
      showToast(err.message || "Failed to submit request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const markAllAsRead = async () => {
    if (!userEmail) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('recipient', userEmail).eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!userEmail) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase.from('notifications').update({ is_hidden: true }).eq('recipient', userEmail);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    setIsNotifOpen(false);

    // ✨ NOTIFICATION CLICK LOGIC FOR OWNER (Auto-scroll Trigger)
    const type = notif.type?.toUpperCase() || '';
    if (type === 'TICKET' || type === 'MAINTENANCE') {
      if (notif.reference_id) {
        setHighlightTicketId(`${notif.reference_id}_${Date.now()}`); // Passed with timestamp!
      }
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Open', styles: 'bg-amber-50 text-amber-700 border-amber-100' };
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') return { label: 'In Progress', styles: 'bg-blue-50 text-blue-600 border-blue-100' };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', styles: 'bg-purple-50 text-purple-700 border-purple-100' };
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') return { label: 'Resolved', styles: 'bg-emerald-50 text-[#359b46] border-emerald-100' };
    if (s === 'failed') return { label: 'Failed', styles: 'bg-red-50 text-red-600 border-red-100' };
    return { label: statusValue, styles: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  const enrichedTickets = useMemo(() => {
    return myTickets.map(ticket => {
      const match = liveTasks.find(task => task.title === ticket.title && task.location === ticket.location);
      const currentLiveStatus = match ? match.status : ticket.status;
      const badge = getStatusBadge(currentLiveStatus);

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
        color: badge.styles,
        staffName,
        priority: match?.priority || ticket.priority || 'Normal'
      };
    });
  }, [myTickets, liveTasks, teamMembers]);

  // ✨ HEARTBEAT & SCROLL LOGIC
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

  const fullName = userData?.name || "Owner";
  const getInitials = (name: string) => {
    if (!name || name === "Owner") return "OW";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const initials = getInitials(userData?.name);
  const unitsDisplayString = myUnitsList.map(u => u.unit_number).join(", ");
  const uniqueBusinessNames = Array.from(new Set(myUnitsList.map(u => u.business_name).filter(b => b && b !== "—")));
  const businessNameDisplay = uniqueBusinessNames.join(" | ");

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-white/10 relative z-30">
        <div className="flex items-center gap-3">
          {/* ✨ ALWAYS VISIBLE PROFILE/USER ICON BUTTON */}
          <button 
            onClick={() => setIsWorkspaceModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-full transition-colors border border-white/10 shadow-sm"
            title="User Profile Info"
          >
            <User size={16} />
          </button>

          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              {/* ✨ Dynamically use orgLogo or fallback to default */}
              <Image src={orgLogo || "/logos.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-5 text-sm relative">
          
          <div 
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0a1e3f] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col text-slate-800">
                <div className="p-3 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0a1e3f] text-sm">Notifications</h3>
                  <div className="flex gap-2 relative z-10">
                    <button onClick={markAllAsRead} className="text-xs text-slate-500 hover:text-[#359b46] flex items-center gap-1 transition-colors">
                      <CheckCheck size={14} /> Read All
                    </button>
                    <button onClick={clearAllNotifications} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto relative z-10">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/50' : 'opacity-70'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-[#0a1e3f] truncate pr-2">
                            {notif.title}
                          </span>
                          {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1"></span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${notif.type === 'BILLING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {notif.type}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-[#359b46] bg-[#2c813a]">
            Owner Portal
          </div>
          
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a1e3f] flex items-center gap-2">
              Good day, {isLoading ? "..." : fullName} 👋
              {/* Clickable Profile Initials Bubble */}
              <div 
                onClick={() => setIsWorkspaceModalOpen(true)}
                className="ml-2 w-8 h-8 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-lg border border-emerald-100 hidden sm:flex cursor-pointer hover:bg-emerald-100 transition-colors"
                title="View Profile Details"
              >
                {initials}
              </div>
            </h1>
            
            {businessNameDisplay && (
              <div className="flex items-center gap-1.5 mt-1.5 mb-0.5">
                <Briefcase size={14} className="text-[#359b46]"/>
                <span className="text-[#359b46] font-bold text-sm">{businessNameDisplay}</span>
              </div>
            )}
            
            <p className="text-slate-500 text-sm mt-1">Here's how your units are doing this month.</p>
          </div>
          <button 
            onClick={openRepairModal} 
            className="bg-white border border-slate-200 hover:border-[#359b46] text-slate-700 hover:text-[#359b46] px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Wrench size={16} /> Report a repair
          </button>
        </div>

        <div className="bg-[#359b46] rounded-2xl p-6 sm:p-8 text-white shadow-md mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <p className="text-emerald-100 text-xs font-bold tracking-wider uppercase mb-2">Your Payout This Month</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                ₱{isLoading ? "0" : payoutThisMonth.toLocaleString()}
              </h2>
              {payoutThisMonth > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium border border-white/10">
                  <CheckCircle2 size={14} className="text-white" /> Remitted to your account
                </div>
              )}
            </div>
            <button className="text-sm font-medium hover:underline flex items-center gap-1 text-emerald-50">
              See breakdown <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">My units</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">{isLoading ? "-" : unitsCount}</h3>
            <p className="text-xs text-slate-400 truncate" title={unitsDisplayString}>
              {unitsDisplayString || "No assigned units"}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">Occupied</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">{isLoading ? "-" : `${occupiedCount} of ${unitsCount}`}</h3>
            {occupiedCount > 0 && (
              <span className="inline-block bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">
                1 renewal due
              </span>
            )}
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">Collected for you</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">₱{isLoading ? "0" : collectedGross.toLocaleString()}</h3>
            <p className="text-xs text-slate-400">gross, before fees</p>
          </div>
        </div>

        {/* KANBAN BOARD LAYOUT */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#0a1e3f] text-lg">My Repair Requests</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: Open & In Progress */}
            <div>
              <h4 className="font-bold text-slate-700 text-sm mb-4">Open & In Progress <span className="ml-2 bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{openInProgressTasks.length}</span></h4>
              <div className="space-y-4">
                {openInProgressTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No open requests</div>
                ) : (
                  openInProgressTasks.map(t => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    return (
                      <div 
                        key={t.id} 
                        id={`ticket-${t.id}`}
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-500 hover:shadow-md ${
                          isHighlighted 
                            ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse z-10' 
                            : t.priority === 'Urgent' ? 'bg-white border-red-300 shadow-red-500/10' : 'bg-white border-slate-200'
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
                {onHoldTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No requests on hold</div>
                ) : (
                  onHoldTasks.map(t => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    return (
                      <div 
                        key={t.id} 
                        id={`ticket-${t.id}`}
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-500 hover:shadow-md opacity-90 hover:opacity-100 ${
                          isHighlighted 
                            ? 'ring-4 ring-blue-500/50 bg-blue-50 border-blue-400 scale-[1.02] shadow-xl animate-pulse opacity-100 z-10' 
                            : t.priority === 'Urgent' ? 'bg-slate-50 border-red-300 shadow-red-500/10' : 'bg-slate-50 border-slate-200'
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
                {resolvedTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">No resolved requests</div>
                ) : (
                  resolvedTasks.map(t => {
                    const isHighlighted = activeHighlightId === String(t.id);
                    return (
                      <div 
                        key={t.id} 
                        id={`ticket-${t.id}`}
                        onClick={() => setReviewTicket(t)} 
                        className={`rounded-2xl shadow-sm border overflow-hidden flex flex-col hover:shadow-md transition-all duration-500 cursor-pointer ${
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
        </div>

        {/* Statements Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-[#0a1e3f] text-base">Your statements</h3>
            <span className="text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600">tap to view</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">PERIOD</th>
                  <th className="px-6 py-3 whitespace-nowrap">GROSS RENT</th>
                  <th className="px-6 py-3 whitespace-nowrap">NET PAYOUT</th>
                  <th className="px-6 py-3 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {statements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No recent statements available.
                    </td>
                  </tr>
                ) : (
                  statements.map((stmt, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-medium">{stmt.period}</td>
                      <td className="px-6 py-4">₱{stmt.gross.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-[#0a1e3f]">₱{stmt.net.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-50 text-[#359b46] border border-emerald-100 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {stmt.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ✨ STATIC WORKSPACE PROFILE MODAL (READ-ONLY) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Owner Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-slate-50/50 p-6 space-y-6">
              <div className="bg-gradient-to-r from-[#0a1e3f] to-[#122955] rounded-2xl p-6 text-white flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl border border-white/20">
                  {initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">{fullName}</h3>
                  <p className="text-xs text-blue-200 mt-0.5">Property Owner</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50">
                  Account Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Full Name</label>
                    <p className="text-sm font-semibold text-slate-800">{fullName}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email Address</label>
                    <p className="text-sm font-semibold text-slate-800 break-all">{userEmail || "Not available"}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Access Role</label>
                    <span className="inline-block text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded mt-1">
                      Owner
                    </span>
                  </div>
                </div>
              </div>
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

      {/* REPORT REPAIR MODAL */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Report a repair</h2>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <form onSubmit={handleReportRepair} className="space-y-4">
                
                {myUnitsList.length > 1 && (
                  <div>
                    <select
                      required
                      value={selectedUnitForRepair}
                      onChange={(e) => setSelectedUnitForRepair(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 bg-white"
                      disabled={isSubmitting}
                    >
                      <option value="" disabled>Select which unit needs repair...</option>
                      {myUnitsList.map((u) => (
                        <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>
                          {u.property_name} {u.unit_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <input 
                    type="text" 
                    required 
                    placeholder="What needs fixing? (e.g. leaking faucet)" 
                    value={repairIssue} 
                    onChange={(e) => setRepairIssue(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 placeholder:text-slate-400" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div>
                  <select
                    required
                    value={repairPriority}
                    onChange={(e) => setRepairPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 bg-white"
                    disabled={isSubmitting}
                  >
                    <option value="Normal">Normal (Can wait)</option>
                    <option value="Urgent">🚨 Urgent (Needs attention today)</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Camera size={20} className="text-slate-400 shrink-0" />
                    <span className={`text-sm ${selectedImage ? 'text-[#0a1e3f] font-medium' : 'text-slate-500'}`}>
                      {selectedImage ? selectedImage.name : "Add a photo"}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <div>
                  <input 
                    type="text" 
                    required 
                    placeholder="Best time for the caretaker to visit" 
                    value={repairTime} 
                    onChange={(e) => setRepairTime(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 placeholder:text-slate-400" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    {isSubmitting ? "Sending..." : "Send request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8">
            <div className="w-16 h-16 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Request Submitted</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Your repair request has been successfully sent to the property manager.
            </p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)} 
              className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Confirm Logout</h2>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your portal?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 px-4 py-3 sm:py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ TOAST NOTIFICATION */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl font-semibold text-sm transition-all transform animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${
            toast.type === "success" ? "border-l-4 border-l-[#359b46] text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="text-[#359b46]" size={20} />
          ) : (
            <AlertTriangle className="text-red-500" size={20} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}