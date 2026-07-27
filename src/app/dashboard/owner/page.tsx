"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  Bell, CheckCircle2, ChevronRight, Camera, 
  Wrench, X, AlertTriangle, Briefcase, CheckCheck, Trash2, MapPin, CheckCircle, Home, Receipt, FileText, User, PenTool, LogOut, Inbox, PauseCircle, MessageSquare, FileCheck, AlertCircle,
  Clock, Check
} from "lucide-react";
import ConversationTab from "./conversation"; 
import FinancialTab from "./financial"; 
import LeaseTab from "./lease";

// ✨ ADDED: Standardized EmptyState Component for clean UI when there's no data
const EmptyState = ({ icon: Icon, title, message }: { icon: any, title: string, message: string }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 h-full animate-in fade-in duration-300">
    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-slate-400 border border-slate-100">
      <Icon size={26} strokeWidth={1.5} />
    </div>
    <h4 className="font-extrabold text-slate-700 mb-1.5">{title}</h4>
    <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">{message}</p>
  </div>
);

export default function OwnerDashboard() {
  const router = useRouter();
  
  // TABS STATE
  const [activeTab, setActiveTab] = useState('home');

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

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // ✨ UNREAD MESSAGES STATE (Like Tenant Side)
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [reviewOnHoldTicket, setReviewOnHoldTicket] = useState<any>(null);

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

        const { count: msgCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('admin_email', data.admin_email)
          .eq('is_read', false)
          .neq('sender_email', authData.user.email)
          .or(`recipient_role.eq.owner,tenant_email.eq.${authData.user.email}`);
          
        if (msgCount !== null) {
          setUnreadMessages(msgCount);
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
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient=eq.${userEmail}` },
        (payload) => {
          setNotifications((current) => [payload.new, ...current]);
          setUnreadCount((count) => count + 1);
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [userEmail]);

  useEffect(() => {
    if (!userData?.admin_email || !userEmail) return;

    const chatChannel = supabase
      .channel('owner-live-chat-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          if (
            msg && 
            msg.sender_email !== userEmail && 
            !msg.is_read &&
            (msg.recipient_role === 'owner' || msg.tenant_email === userEmail)
          ) {
            setUnreadMessages((count) => count + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          const msg = payload.new;
          const old = payload.old;
          if (
            msg && 
            msg.sender_email !== userEmail && 
            msg.is_read && 
            !old.is_read &&
            (msg.recipient_role === 'owner' || msg.tenant_email === userEmail)
          ) {
             setUnreadMessages((count) => Math.max(0, count - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [userData, userEmail]);

  useEffect(() => {
    if (!userData?.admin_email || !userEmail) return;

    const isOwnerTicket = (ticket: any) => {
      return ticket.reporter_email === userEmail || 
             (String(ticket.description).includes(userData.name) && String(ticket.description).includes('(Owner)'));
    };

    const ticketsChannel = supabase
      .channel('owner-live-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `admin_email=eq.${userData.admin_email}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (isOwnerTicket(payload.new)) setMyTickets((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            if (isOwnerTicket(payload.new)) setMyTickets((current) => current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
          } else if (payload.eventType === 'DELETE') {
            setMyTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      ).subscribe();

    const tasksChannel = supabase
      .channel('owner-live-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tasks', filter: `admin_email=eq.${userData.admin_email}` },
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
  }, [userData, userEmail]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleConversationClick = () => {
    setActiveTab('messages');
    setHighlightTicketId(null);
    setIsWorkspaceModalOpen(false);
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

  const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleReportRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImage) {
      showToast("Please upload a photo of the issue.", "error");
      return;
    }
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

      const capitalizedIssue = capitalizeWords(repairIssue);
      const capitalizedTime = capitalizeWords(repairTime);
      
      const { data: currentAuth } = await supabase.auth.getUser();
      const finalEmail = currentAuth.user?.email || userEmail;

      const { data: newTicket, error } = await supabase
        .from('tickets') 
        .insert([{
          admin_email: userData?.admin_email,
          reporter_email: finalEmail,
          title: capitalizedIssue,
          location: selectedUnitForRepair || userData?.access_level || "Owner's Unit",
          description: `Best time to visit: ${capitalizedTime}. Reported by ${userData?.name || 'Owner'} (Owner).`, 
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
          message: `${userData?.name || 'An owner'} (Owner) reported an issue: ${capitalizedIssue}`, 
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

    const type = notif.type?.toUpperCase() || '';
    if (type === 'TICKET' || type === 'MAINTENANCE') {
      setActiveTab("repair"); 
      if (notif.reference_id) {
        setHighlightTicketId(`${notif.reference_id}_${Date.now()}`); 
      }
    } else if (type === 'BILLING' || type === 'STATEMENT') {
      setActiveTab("financials");
    } else if (type === 'MESSAGE' || type === 'CHAT') {
      handleConversationClick(); 
    } else {
      setActiveTab("home");
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Open', styles: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') return { label: 'In Progress', styles: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (s === 'on_hold' || s === 'on hold') return { label: 'On Hold', styles: 'bg-purple-100 text-purple-700 border-purple-200' };
    if (s === 'completed' || s === 'resolved' || s === 'closed' || s === 'success') return { label: 'Resolved', styles: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (s === 'failed') return { label: 'Failed', styles: 'bg-red-100 text-red-800 border-red-200' };
    return { label: statusValue, styles: 'bg-slate-100 text-slate-700 border-slate-200' };
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

  useEffect(() => {
    if (activeTab === "repair" && highlightTicketId && !isLoading && enrichedTickets.length > 0) {
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
  }, [highlightTicketId, isLoading, enrichedTickets, activeTab]);

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
  
  const fullUnitsDisplay = myUnitsList.length > 0 
    ? myUnitsList.map(u => `${u.property_name} - Unit ${u.unit_number}`).join(" • ")
    : "No assigned units";

  const uniqueBusinessNames = Array.from(new Set(myUnitsList.map(u => u.business_name).filter(b => b && b !== "—")));
  const businessNameDisplay = uniqueBusinessNames.join(" | ");

  const KanbanSkeleton = () => (
    <div className="h-[340px] shrink-0 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col animate-pulse">
      <div className="w-full h-32 bg-slate-100 border-b border-slate-100"></div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1">
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-5 bg-slate-200 rounded-full w-14"></div>
        </div>
        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
        <div className="h-3 bg-slate-200 rounded w-full mt-3"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="h-6 bg-slate-200 rounded-full w-24"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      
      {/* UNIFIED TOP NAVIGATION */}
      <header className="h-16 bg-[#0a1e3f] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative z-40 border-b border-white/5 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              <Image src={orgLogo || "/fpps-logo.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          
          <div 
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0a1e3f] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* NOTIFICATION MODAL */}
          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200">
                
                <div className="px-5 py-4 flex justify-between items-center bg-white border-b border-slate-100">
                  <h3 className="font-extrabold text-[#0a1e3f] text-base flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-[#359b46] text-white text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>
                    )}
                  </h3>
                  <div className="flex gap-3 relative z-10">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[11px] font-bold text-[#359b46] hover:text-green-700 transition-colors" title="Mark all as read">
                        Read All
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAllNotifications} className="text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors" title="Clear all">
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto relative z-10 custom-scrollbar bg-slate-50/30">
                  {notifications.length === 0 ? (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                        <Bell size={28} />
                      </div>
                      <h4 className="font-bold text-slate-700 mb-1">All caught up!</h4>
                      <p className="text-xs text-slate-500">You have no new notifications right now.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const type = notif.type?.toUpperCase() || '';
                      let Icon = Bell;
                      let iconColor = "text-[#359b46]"; // Default emerald
                      let iconBg = "bg-emerald-100";

                      if (type === 'BILLING' || type === 'STATEMENT') {
                        Icon = Receipt; iconColor = "text-blue-500"; iconBg = "bg-blue-100";
                      } else if (type === 'MAINTENANCE' || type === 'TICKET') {
                        Icon = Wrench; iconColor = "text-orange-500"; iconBg = "bg-orange-100";
                      } else if (type === 'MESSAGE' || type === 'CHAT') {
                        Icon = MessageSquare; iconColor = "text-[#359b46]"; iconBg = "bg-emerald-100";
                      }

                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-all flex gap-3 ${!notif.is_read ? 'bg-emerald-50/40' : 'opacity-80'}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor} border border-white shadow-sm`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 gap-2">
                              <span className={`text-sm truncate pr-2 ${!notif.is_read ? 'font-bold text-[#0a1e3f]' : 'font-semibold text-slate-700'}`}>
                                {notif.title}
                              </span>
                              {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[#359b46] shrink-0 mt-1.5 shadow-[0_0_8px_rgba(53,155,70,0.5)]"></span>}
                            </div>
                            <p className={`text-xs line-clamp-2 mb-1.5 ${!notif.is_read ? 'text-slate-600' : 'text-slate-500'}`}>{notif.message}</p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End of notifications</span>
                  </div>
                )}
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold border border-emerald-500/30 text-emerald-50 bg-gradient-to-r from-emerald-600 to-green-700">Owner Portal</span>
          
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 py-1.5 border border-transparent hover:border-slate-600 rounded-full active:scale-95"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER: Sidebar & Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0a1e3f] px-4 py-6 hidden md:flex flex-col border-t border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-20 transition-all">
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <button
              onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} 
              className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                activeTab === 'home' 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${activeTab === 'home' ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
                  <Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                </div>
                <span className="tracking-wide">Home</span>
              </div>
              {activeTab === 'home' && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
            </button>

            {/* MESSAGES TAB (With Badge) */}
            <button
              onClick={handleConversationClick} 
              className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                activeTab === 'messages' 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${activeTab === 'messages' ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
                  <MessageSquare size={18} strokeWidth={activeTab === 'messages' ? 2.5 : 2} />
                </div>
                <span className="tracking-wide">Messages</span>
              </div>
              {unreadMessages > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-in zoom-in">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
              {activeTab === 'messages' && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
            </button>

            <button 
              onClick={() => setActiveTab('repair')} 
              className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                activeTab === 'repair' 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${activeTab === 'repair' ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
                  <Wrench size={18} strokeWidth={activeTab === 'repair' ? 2.5 : 2} />
                </div>
                <span className="tracking-wide">Repairs</span>
              </div>
              {activeTab === 'repair' && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
            </button>

            <div className="mt-8 mb-4 pt-4 border-t border-white/5">
              <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Finance & Documents</h3>
            </div>

            <button 
              onClick={() => {setActiveTab('leases'); setHighlightTicketId(null);}} 
              className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                activeTab === 'leases' 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${activeTab === 'leases' ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
                  <FileCheck size={18} strokeWidth={activeTab === 'leases' ? 2.5 : 2} />
                </div>
                <span className="tracking-wide">Leases</span>
              </div>
              {activeTab === 'leases' && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
            </button>

            <button 
              onClick={() => {setActiveTab('financials'); setHighlightTicketId(null);}} 
              className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
                activeTab === 'financials' 
                  ? 'bg-white/10 text-white shadow-sm border border-white/5' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`transition-transform duration-300 ${activeTab === 'financials' ? 'text-[#359b46] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
                  <FileText size={18} strokeWidth={activeTab === 'financials' ? 2.5 : 2} />
                </div>
                <span className="tracking-wide">Financials</span>
              </div>
              {activeTab === 'financials' && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#359b46] rounded-r-full shadow-[0_0_10px_#359b46]" />}
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-white/5">
             <div 
               onClick={() => setIsWorkspaceModalOpen(true)}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-[#359b46] flex items-center justify-center font-bold text-xs border border-emerald-500/30 shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{isLoading ? "..." : fullName}</p>
                  <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">Owner Account</p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 relative transition-all ${activeTab === 'repair' || activeTab === 'messages' ? 'flex flex-col overflow-hidden pb-16 md:pb-0' : 'overflow-y-auto p-4 md:p-8 pb-28'}`}>
          
          {/* TAB 1: HOME (OVERVIEW) */}
          {activeTab === 'home' && (
            <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Header Section */}
              {/* ✨ Tinanggal ang whitespace-nowrap at ginawang flex-col sa mobile para hindi lumagpas ang mahabang pangalan */}
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-2 gap-3 sm:gap-0">
                <div className="w-full">
                  <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Dashboard Overview</p>
                    
                    {isLoading ? (
                      <div className="h-7 sm:h-8 md:h-10 w-48 bg-slate-200 rounded-xl sm:rounded-2xl animate-pulse inline-block mt-1"></div>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-1 tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                        Welcome back,
                        <span className="text-[#0a1e3f] break-words">{fullName}</span>
                      </h1>
                    )}
                  
                  {businessNameDisplay && (
                    <div className="flex items-center gap-2 mt-2.5 sm:mt-2 bg-emerald-50 border border-emerald-100/60 px-3 py-1.5 rounded-xl w-fit shadow-sm">
                      <Briefcase size={14} className="text-[#359b46] shrink-0" />
                      <span className="text-[#359b46] font-black text-[10px] sm:text-xs uppercase tracking-wider">{businessNameDisplay}</span>
                    </div>
                  )}
                  {isLoading && !businessNameDisplay && (
                    <div className="h-6 w-32 bg-slate-200 rounded-xl animate-pulse mt-2.5 sm:mt-2"></div>
                  )}
                </div>
              </header>

              {/* Hero Card: Payout Display */}
              {/* ✨ Inayos ang scaling ng padding (p-5 sa mobile) at text sizes para sa mas maliliit na screen */}
              <section className="bg-gradient-to-br from-[#0a1e3f] via-[#112d56] to-[#1a3d6c] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 text-white shadow-xl shadow-slate-900/10 relative overflow-hidden group border border-white/5">
                {/* Decorative background shapes */}
                <div className="absolute -top-10 -right-10 w-48 sm:w-72 h-48 sm:h-72 bg-emerald-500/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-colors duration-500"></div>
                <div className="absolute -bottom-10 -left-10 w-40 sm:w-52 h-40 sm:h-52 bg-blue-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col justify-between h-full space-y-5 sm:space-y-6">
                  <div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full w-fit backdrop-blur-sm">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
                      <p className="text-slate-300 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Your Payout This Month</p>
                    </div>
                    
                    {/* ✨ Responsive text: text-3xl sa mobile, aakyat hanggang text-5xl sa desktop */}
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-3 sm:mt-4 tracking-tight flex items-center min-h-[36px] sm:min-h-[40px] md:min-h-[48px] bg-gradient-to-r from-white via-white to-slate-200 bg-clip-text text-transparent break-all sm:break-normal">
                      {isLoading ? (
                        <div className="h-8 sm:h-10 md:h-12 w-40 sm:w-48 bg-white/10 rounded-xl sm:rounded-2xl animate-pulse"></div>
                      ) : (
                        `₱${payoutThisMonth.toLocaleString()}`
                      )}
                    </h2>
                    
                    <div className="text-[11px] sm:text-xs md:text-sm text-slate-300 font-medium mt-3 flex items-center gap-2 bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm w-fit max-w-full">
                      <MapPin size={14} className="text-emerald-400 shrink-0" />
                      <div className="truncate min-w-0">
                        {isLoading ? (
                          <div className="h-3 sm:h-4 bg-white/10 rounded-md animate-pulse w-32 sm:w-48"></div>
                        ) : (
                          <p className="font-semibold truncate">{fullUnitsDisplay} {payoutThisMonth > 0 && <span className="text-emerald-400 font-bold ml-1">· Remitted</span>}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('financials')} 
                    disabled={payoutThisMonth === 0}
                    className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-[#0a1e3f] transition-all rounded-xl sm:rounded-2xl py-3.5 sm:py-4 font-black text-sm md:text-base flex items-center justify-center gap-2 active:scale-[0.99] border border-slate-100 shadow-md hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none duration-300"
                  >
                    {isLoading ? "Checking..." : payoutThisMonth > 0 ? "See Statements" : "All caught up"} 
                    {!isLoading && payoutThisMonth > 0 && <ChevronRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />}
                  </button>
                </div>
              </section>

              {/* Metric Grid: 4 Interactive Columns */}
              {/* ✨ Tinanggal ang sumisirang "whitespace-nowrap" para mag-wrap ang mahahabang labels sa maliliit na screen */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                
                {/* Card 1: Report Issue */}
                <button onClick={() => setActiveTab('repair')} className="bg-white flex flex-col p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="bg-amber-50 group-hover:bg-amber-100 transition-colors w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-amber-100/50 relative z-10 shrink-0 shadow-sm">
                    <PenTool size={18} className="text-amber-600 sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Maintenance</h3>
                    <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5 sm:mt-1 leading-tight">Report Issue</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">Create repair request</p>
                  </div>
                </button>
                
                {/* Card 2: Owned Properties */}
                <button onClick={() => setActiveTab('leases')} className="bg-white flex flex-col p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="bg-blue-50 group-hover:bg-blue-100 transition-colors w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-blue-100/50 relative z-10 shrink-0 shadow-sm">
                    <Home size={18} className="text-blue-600 sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1 w-full min-w-0">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Properties</h3>
                    <div className="text-sm sm:text-lg font-black text-slate-900 mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px]">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-10"></div> : `${unitsCount} ${unitsCount === 1 ? 'Unit' : 'Units'}`}
                    </div>
                    <div className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug truncate w-full">
                      {isLoading ? <div className="h-2.5 sm:h-3 bg-slate-100 rounded animate-pulse w-16 sm:w-24"></div> : fullUnitsDisplay}
                    </div>
                  </div>
                </button>
                
                {/* Card 3: Collected Gross */}
                <button onClick={() => setActiveTab('financials')} className="bg-white flex flex-col p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="bg-emerald-50 group-hover:bg-emerald-100 transition-colors w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-emerald-100/50 relative z-10 shrink-0 shadow-sm">
                    <Receipt size={18} className="text-[#359b46] sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1 min-w-0">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Gross Income</h3>
                    <div className="text-sm sm:text-lg font-black text-slate-900 mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px] truncate">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-16 sm:w-20"></div> : `₱${collectedGross.toLocaleString()}`}
                    </div>
                    <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug hidden sm:block">Total revenue collected</p>
                  </div>
                </button>
                
                {/* Card 4: Occupied Units */}
                <button className="bg-white flex flex-col p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full cursor-default">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="bg-purple-50 w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 border border-purple-100/50 relative z-10 shrink-0 shadow-sm">
                    <CheckCircle size={18} className="text-purple-600 sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Occupancy</h3>
                    <div className="text-sm sm:text-lg font-black text-slate-900 mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px]">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-10 sm:w-14"></div> : `${occupiedCount} / ${unitsCount}`}
                    </div>
                    <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug hidden sm:block">Active current leases</p>
                  </div>
                </button>
              </div>

              {/* Section: Recent Statements List */}
              <section className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-200/60 transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex flex-row items-center justify-between mb-4 sm:mb-5 border-b border-slate-100 pb-3 sm:pb-4 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-base sm:text-lg text-[#0a1e3f] tracking-tight truncate">Recent Statements</h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 font-medium truncate hidden sm:block">Overview of recent monthly financial payouts</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('financials')} 
                    className="text-[10px] sm:text-xs font-black text-[#359b46] hover:text-green-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm whitespace-nowrap shrink-0"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((skeleton) => (
                        <div key={skeleton} className="flex items-center justify-between p-3 sm:p-4 bg-slate-50/50 rounded-xl sm:rounded-2xl border border-slate-100 animate-pulse">
                          <div className="space-y-2">
                            <div className="h-3 sm:h-4 w-20 sm:w-28 bg-slate-200 rounded"></div>
                            <div className="h-2.5 sm:h-3 w-12 sm:w-16 bg-slate-100 rounded"></div>
                          </div>
                          <div className="h-3 sm:h-4 w-16 sm:w-20 bg-slate-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : statements.length === 0 ? (
                    <div className="py-8 sm:py-10 text-center border-2 border-dashed border-slate-100 rounded-xl sm:rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6">
                      <div className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-300 mb-2 sm:mb-3 shadow-sm">
                        <FileText size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 font-extrabold">No recent statements</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-[240px]">Monthly generated financial statements will appear here.</p>
                    </div>
                  ) : (
                    statements.slice(0, 3).map((stmt, idx) => {
                      const isSuccess = String(stmt.status).toLowerCase() === 'success' || String(stmt.status).toLowerCase() === 'paid' || String(stmt.status).toLowerCase() === 'remitted';
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setActiveTab('financials')}
                          className="flex items-center justify-between p-3 sm:p-4 bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer shadow-sm group gap-2"
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-emerald-200 transition-colors shadow-inner shrink-0">
                              <FileText size={16} className="sm:w-[18px] sm:h-[18px] group-hover:text-[#359b46] transition-colors" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-800 text-xs sm:text-sm group-hover:text-[#0a1e3f] transition-colors truncate">Statement {stmt.period}</p>
                              <span className={`inline-flex items-center text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 rounded border ${
                                isSuccess 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {stmt.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                            <span className="font-black text-slate-900 text-sm sm:text-base md:text-lg">₱{stmt.net.toLocaleString()}</span>
                            <ChevronRight size={14} className="sm:w-4 sm:h-4 text-slate-300 group-hover:text-slate-500 transition-transform group-hover:translate-x-0.5 hidden sm:block" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

            </div>
          )}

          {/* TAB 2: MESSAGES */}
          {activeTab === 'messages' && (
            <div className="absolute inset-0 bg-white z-20 flex animate-in fade-in duration-300">
              <ConversationTab userData={userData} units={myUnitsList} />
            </div>
          )}

          {/* ✨ TAB 3: REPAIRS KANBAN (Main Page/Tab Level Scrolling with Premium UI) */}
          {activeTab === 'repair' && (
            <div className="flex flex-col w-full max-w-[1400px] mx-auto overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-6 lg:p-8">
              
              {/* Kanban Header */}
              <div className="flex-none pb-6 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 md:p-6 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100/60">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Maintenance & Repairs</h2>
                    <p className="text-slate-500 text-sm mt-1.5 font-medium">Track your requested property repairs and updates here.</p>
                  </div>
                  <button 
                    onClick={openRepairModal} 
                    className="w-full sm:w-auto justify-center bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 active:scale-95"
                  >
                    <Wrench size={16} /> New Request
                  </button>
                </div>
              </div>

              {/* Kanban Board Container - Natural Grid Layout (Mag-iscroll na ang buong page) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full overflow-y-auto custom-scrollbar">
                  
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
            </div>
          )}

          {/* TAB 4: LEASES */}
          {activeTab === 'leases' && (
            <div className="flex flex-col w-full h-auto pb-10 md:pb-4 max-w-6xl mx-auto animate-in fade-in duration-300">
              <LeaseTab userData={userData} units={myUnitsList} />
            </div>
          )}

          {/* TAB 5: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="flex flex-col w-full h-auto pb-10 md:pb-4 max-w-6xl mx-auto animate-in fade-in duration-300">
              <FinancialTab userData={userData} units={myUnitsList} />
            </div>
          )}
        </main>
      </div>

      {/* ✨ MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200/80 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.06)]">
        <div className="flex justify-around items-center px-1 py-1.5 max-w-md mx-auto">
          
          {/* HOME */}
          <button onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {activeTab === 'home' && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'home' ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <Home size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Home</span>
            </div>
          </button>
          
          {/* REPAIRS */}
          <button onClick={() => setActiveTab('repair')} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {activeTab === 'repair' && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'repair' ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <Wrench size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Repairs</span>
            </div>
          </button>

          {/* MESSAGES */}
          <button onClick={handleConversationClick} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {activeTab === 'messages' && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'messages' ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <div className="relative">
                <MessageSquare size={20} />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-white animate-pulse shadow-sm">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Messages</span>
            </div>
          </button>

          {/* LEASES */}
          <button onClick={() => {setActiveTab('leases'); setHighlightTicketId(null);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {activeTab === 'leases' && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'leases' ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <FileCheck size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Leases</span>
            </div>
          </button>
          
          {/* FINANCE */}
          <button onClick={() => {setActiveTab('financials'); setHighlightTicketId(null);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {activeTab === 'financials' && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'financials' ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <FileText size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Finance</span>
            </div>
          </button>
          
          {/* PROFILE */}
          <button onClick={() => setIsWorkspaceModalOpen(true)} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
            {isWorkspaceModalOpen && <span className="absolute inset-1 bg-emerald-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${isWorkspaceModalOpen ? 'text-[#359b46] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
              <User size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Profile</span>
            </div>
          </button>

        </div>
      </nav>

      {/* MODALS */}
      {/* 1. WORKSPACE PROFILE MODAL */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          {/* ✨ MOBILE RESPONSIVE WRAPPER: Nagiging bottom sheet sa mobile, standard rounded modal naman sa desktop view */}
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-white/20">
            
            {/* HEADER BAR */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-white shrink-0 border-b border-slate-50">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Owner Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors active:scale-95 shrink-0"
              >
                {/* ✨ Ginagamitan natin ng className para sa responsive height at width scaling ng SVG ng Lucide! */}
                <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>
            
            {/* CONTENT SPACE - Added our sleek minimalist custom scrollbar layout handler */}
            <div className="overflow-y-auto bg-slate-50/50 px-5 pb-6 sm:px-8 sm:pb-8 pt-2 space-y-5 sm:space-y-6 custom-scrollbar">
              
              {/* PROFILE IDENTIFIER BANNER */}
              {/* ✨ GINAWANG WRAP AT RESPONSIVE PADDING PARA SA CELLPHONE INTERFACES */}
              <div className="bg-gradient-to-br from-[#081832] to-[#122955] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 text-white flex flex-row items-center gap-4 sm:gap-5 shadow-xl shadow-[#081832]/20 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-white/10 flex items-center justify-center font-black text-xl sm:text-3xl border border-white/20 shadow-inner backdrop-blur-sm shrink-0 z-10">
                  {initials}
                </div>
                <div className="z-10 min-w-0 flex-1">
                  {/* ✨ Tinanggal ang whitespace-nowrap at pinalitan ng responsive typography text scaling */}
                  <h3 className="font-black text-lg sm:text-2xl tracking-tight break-words leading-tight">{fullName}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-blue-200 mt-0.5 sm:mt-1 tracking-widest uppercase">Property Owner</p>
                </div>
              </div>

              {/* ACCOUNT DETAILS SPACE CARD */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-100 p-5 sm:p-8 space-y-5 sm:space-y-6">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400/80 uppercase tracking-[0.2em] pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
                  Account Details
                </h4>
                <div className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5 sm:mb-1">Full Name</label>
                    <p className="text-base font-extrabold text-slate-800 tracking-tight break-words">{fullName}</p>
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-bold text-slate-600 break-all bg-slate-50 py-2 rounded-xl inline-block border border-slate-100 leading-normal">{userEmail || "Not available"}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Owned Properties</label>
                    {/* ✨ Inayos ang dynamic join structure para maging flexible row blocks sa mobile screen grids */}
                    <div className="text-xs sm:text-sm font-bold text-slate-700 break-words leading-relaxed bg-emerald-50/50 py-2 rounded-xl sm:rounded-2xl border border-emerald-100/50">
                      {myUnitsList.length > 0 
                        ? myUnitsList.map(u => `${u.property_name} - Unit ${u.unit_number}`).join(' • ')
                        : "Not Assigned"}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Access Role</label>
                    <div className="shrink-0">
                      <span className="inline-flex text-[10px] sm:text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg tracking-widest uppercase shadow-sm">
                        Owner
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}

      {/* 2. REPORT REPAIR MODAL */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
            
            <div className="px-6 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Report a repair</h2>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 pb-safe">
              <form onSubmit={handleReportRepair} className="space-y-4 sm:space-y-5">
                
                {myUnitsList.length > 1 && (
                  <div>
                    <select
                      required
                      value={selectedUnitForRepair}
                      onChange={(e) => setSelectedUnitForRepair(e.target.value)}
                      className="w-full px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 transition-all cursor-pointer shadow-sm appearance-none"
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
                    className="w-full px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-semibold text-slate-700 placeholder:text-slate-400 hover:border-slate-300 transition-all shadow-sm" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div>
                  <select
                    required
                    value={repairPriority}
                    onChange={(e) => setRepairPriority(e.target.value)}
                    className="w-full px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 transition-all cursor-pointer shadow-sm appearance-none"
                    disabled={isSubmitting}
                  >
                    <option value="Normal">Normal (Can wait)</option>
                    <option value="Urgent">🚨 Urgent (Needs attention today)</option>
                  </select>
                </div>

                <div>
                  <label className={`flex items-center gap-3 sm:gap-4 w-full px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl border-2 border-dashed cursor-pointer hover:bg-slate-50 transition-all group ${selectedImage ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-slate-400'}`}>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-colors shadow-sm shrink-0 ${selectedImage ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-100 text-slate-400 group-hover:text-slate-500'}`}>
                      <Camera size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={selectedImage ? 2.5 : 2} />
                    </div>
                    <span className={`text-xs sm:text-sm flex-1 truncate ${selectedImage ? 'text-emerald-800 font-extrabold' : 'text-slate-500 font-bold'}`}>
                      {selectedImage ? selectedImage.name : "Upload photo evidence"}
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
                    className="w-full px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-sm font-semibold text-slate-700 placeholder:text-slate-400 hover:border-slate-300 transition-all shadow-sm" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="pt-2 sm:pt-4">
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-emerald-300 disabled:to-green-400 text-white py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base font-black transition-all shadow-md sm:shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex justify-center items-center gap-2 sm:gap-3"
                  >
                    {isSubmitting ? (
                      <><div className="w-4 h-4 sm:w-5 sm:h-5 border-2 sm:border-3 border-white/30 border-t-white rounded-full animate-spin"></div> Submitting...</>
                    ) : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. REVIEW RESOLUTION MODAL */}
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-purple-200 pb-2 mb-2">Description:</span>
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

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4 shrink-0">
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

      {/* 4. SUCCESS MODAL */}
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

      {/* 5. LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#081832]/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm p-6 sm:p-10 text-center transform transition-all animate-in zoom-in-95 duration-500 border border-white/20">
            
            {/* ✨ Responsive Premium Icon Wrapper */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1rem] sm:rounded-[2rem] bg-red-50 flex items-center justify-center mx-auto mb-5 sm:mb-6 border-4 border-red-50/50 shadow-sm">
              <LogOut size={28} className="text-red-500 sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 sm:mb-3 tracking-tight">Sign out</h3>
            <p className="text-slate-500 text-[13px] sm:text-sm mb-8 sm:mb-10 leading-relaxed font-medium px-2 sm:px-0">
              Are you sure you want to securely log out of your portal?
            </p>
            
            <div className="flex gap-3 sm:gap-4">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-[0.96] text-sm sm:text-base duration-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/25 active:scale-[0.96] text-sm sm:text-base duration-200"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. REVIEW ON HOLD MODAL (2-Column Layout) */}
      {reviewOnHoldTicket && (
        <div className="fixed inset-0 bg-[#081832]/80 backdrop-blur-md z-[60] flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
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
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-purple-200 pb-2 mb-2">Description:</span>
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

                  {/* ✨ IN-APPLY NA YUNG TENANT-SIDE LOGIC DITO */}
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
                    
                    {/* ✨ ADDED STAFF IN CHARGE SECTION */}
                    <div className="flex justify-between items-center text-xs sm:text-sm border-t border-purple-200/60 pt-4 mt-2">
                      <span className="text-[10px] sm:text-xs font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">👤 Staff In Charge</span>
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

      {/* ✨ GLOBAL CSS: INVISIBLE SCROLLBARS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        .custom-scrollbar::-webkit-scrollbar { 
          display: none; /* Chrome, Safari, Opera */
        }
        
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
      `}} />
    </div>
  );
}

// ✨ FIXED HEIGHT KANBAN SKELETON (Matched to 340px)
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