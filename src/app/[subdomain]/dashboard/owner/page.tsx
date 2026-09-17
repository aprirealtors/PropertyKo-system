"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  Bell, CheckCircle2, ChevronRight, Camera, 
  Wrench, X, AlertTriangle, Briefcase, CheckCheck, Trash2, MapPin, CheckCircle, Home, Receipt, FileText, User, PenTool, LogOut, Inbox, PauseCircle, MessageSquare, FileCheck, AlertCircle,
  Clock, Check, Lock, Key, Eye, EyeOff, Droplets, Zap, Wind, Sparkles, Edit2, PanelLeft
} from "lucide-react";
import ConversationTab from "./conversation"; 
import FinancialTab from "./financial"; 
import LeaseTab from "./lease";

// ✨ ENTERPRISE: Symptom-Based Categories
const CATEGORIES = [
  { id: "Plumbing", label: "Plumbing / Water", icon: Droplets, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "Electrical", label: "Electrical / Light", icon: Zap, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "Aircon", label: "Aircon / HVAC", icon: Wind, color: "text-cyan-500", bg: "bg-cyan-50", border: "border-cyan-200" },
  { id: "Housekeeping", label: "Cleaning / Pest", icon: Sparkles, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200" },
  { id: "General", label: "General Repair", icon: Wrench, color: "text-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200" },
];

export default function OwnerDashboard() {
  const router = useRouter();

  // TABS STATE
  const [activeTab, setActiveTab] = useState('home');
  // ✨ NEW: Collapsible Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 

  // BILLING & FINANCIAL STATES
  const [totalDue, setTotalDue] = useState(0);
  const [collectedGross, setCollectedGross] = useState(0);
  const [hasOverdue, setHasOverdue] = useState(false); 

  const [myUnitsList, setMyUnitsList] = useState<any[]>([]); 
  const [unitsCount, setUnitsCount] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedUnitForRepair, setSelectedUnitForRepair] = useState(""); 
  const [repairPriority, setRepairPriority] = useState("Normal");
  const [issueCategory, setIssueCategory] = useState(""); 

  // --- NEW: Edit Name States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isConfirmNameModalOpen, setIsConfirmNameModalOpen] = useState(false);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [reviewTicket, setReviewTicket] = useState<any | null>(null);

  const [activeView, setActiveView] = useState<'open' | 'on_hold' | 'resolved'>('open');
  const [reviewActiveTicket, setReviewActiveTicket] = useState<any | null>(null); 

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // NEW: Delete Notification Modal States
  const [isDeleteNotifModalOpen, setIsDeleteNotifModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<any>(null);

  // UNREAD MESSAGES STATE
  const [unreadMessages, setUnreadMessages] = useState<number>(0);

  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);
  const [rejectedTicketModalData, setRejectedTicketModalData] = useState<any | null>(null);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [reviewOnHoldTicket, setReviewOnHoldTicket] = useState<any>(null);

  // --- Change Password States ---
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // --- Eye Toggle States ---
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            .select('logo_url, dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value')
            .eq('admin_email', data.admin_email)
            .single();

          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
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

            let totalOwnerBill = 0;
            let totalGross = 0;
            let anyOverdue = false; 
            let globalOwnerBase = 0; 

            if (myUnits.length > 0) {
              const unitIds = myUnits.map((u: any) => u.id);

              const { data: activeLeases } = await supabase
                .from('leases')
                .select('unit_id')
                .eq('status', 'Active')
                .in('unit_id', unitIds);

              const occupiedUnitIds = new Set(activeLeases?.map((l: any) => l.unit_id) || []);
              setOccupiedCount(occupiedUnitIds.size);

              const { data: soaData } = await supabase
                .from('soa')
                .select('*')
                .in('unit_id', unitIds);

              myUnits.forEach((unit: any) => {
                totalGross += (unit.monthly_rent || 0);

                const soa = soaData?.find((s: any) => s.unit_id === unit.id);
                if (soa) {
                  const getUnitAreaValue = (areaStr: string) => {
                    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
                    return isNaN(parsed) ? 0 : parsed;
                  };

                  const unitArea = getUnitAreaValue(unit.unit_area);

                  // ==========================================
                  // UNIT-SPECIFIC BILLING CALCULATION FALLBACK
                  // ==========================================
                  const activeDuesRate = unit.dues_rate ?? orgData?.dues_rate ?? 0;
                  const activeParking = unit.parking ?? orgData?.default_parking ?? 0;
                  const activeWater = unit.water ?? orgData?.default_water ?? 0;
                  const activeElectricity = unit.electricity ?? orgData?.default_electricity ?? 0;

                  const pType = unit.penalty_type ?? orgData?.penalty_type ?? 'percent';
                  const pVal = unit.penalty_value ?? orgData?.penalty_value ?? 0;

                  const rawDues = activeDuesRate * unitArea;
                  const rawParking = activeParking;
                  const rawWater = activeWater;
                  const rawElectricity = activeElectricity;

                  const dues = soa.owner_dues ? rawDues : 0;
                  const parking = soa.owner_parking ? rawParking : 0;
                  const water = soa.owner_water ? rawWater : 0;
                  const electricity = soa.owner_electricity ? rawElectricity : 0;

                  const baseTotal = dues + parking + water + electricity;
                  const isOwnerVacant = !unit.owner_name || unit.owner_name === '—';

                  if (soa.owner_status !== 'Unassigned') {
                     globalOwnerBase += baseTotal; 
                  }

                  let lateFee = 0;
                  if (soa.owner_status === 'Overdue' && !isOwnerVacant) {
                    anyOverdue = true; 
                    if (pType === 'percent') {
                      lateFee = baseTotal * (pVal / 100);
                    } else {
                      lateFee = pVal;
                    }
                  }

                  if (soa.owner_status !== 'Paid' && soa.owner_status !== 'Unassigned') {
                    totalOwnerBill += (baseTotal + lateFee);
                  }
                }
              });
            }

            setCollectedGross(totalGross);
            setTotalDue(totalOwnerBill); 
            setHasOverdue(anyOverdue); 

            const recentStatementsArray = [];
            if (myUnits.length > 0 && globalOwnerBase > 0) {
              const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              const d = new Date();
              const curMonth = d.getMonth();
              const curYear = d.getFullYear();

              let curStatus = 'Paid';
              if (totalOwnerBill > 0) curStatus = anyOverdue ? 'Overdue' : 'Pending';

              recentStatementsArray.push({
                period: `${monthNames[curMonth]} ${curYear}`,
                status: curStatus,
                net: totalOwnerBill > 0 ? totalOwnerBill : globalOwnerBase
              });

              for (let i = 1; i <= 2; i++) {
                let pMonth = curMonth - i;
                let pYear = curYear;
                if (pMonth < 0) {
                  pMonth += 12;
                  pYear -= 1;
                }
                recentStatementsArray.push({
                  period: `${monthNames[pMonth]} ${pYear}`,
                  status: 'Paid',
                  net: globalOwnerBase
                });
              }
            }
            setStatements(recentStatementsArray); 
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
            .select('id, title, location, status, admin_email, assigned_to, cost, resolution_photo_url, priority, description, created_at, on_hold_reason, remarks')
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

  // Realtime SOA Updates
  useEffect(() => {
    if (myUnitsList.length === 0) return;

    const unitIds = myUnitsList.map(u => u.id); 

    const soaChannel = supabase
      .channel('owner-soa-live-updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'soa'
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;

          const isMyUnit = unitIds.includes(newRecord?.unit_id) || unitIds.includes(oldRecord?.unit_id);

          if (isMyUnit) {
            fetchOwnerData(); 
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(soaChannel);
    };
  }, [myUnitsList]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Handle Name Update Function (using Auth user_metadata) ---
  const handleInitiateNameSave = () => {
    if (!editedName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }

    // Only open the modal if the name actually changed
    const currentFullName = userData?.name || "Owner";
    if (editedName.trim() === currentFullName) {
      setIsEditingName(false);
      return;
    }

    setIsConfirmNameModalOpen(true);
  };

  const confirmNameSave = async () => {
    setIsConfirmNameModalOpen(false);
    setIsSavingName(true);
    try {
      const newName = editedName.trim();
      const oldName = userData?.name; // Original name mapped directly from DB

      // 1. Update name directly in Supabase Auth user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: newName }
      });
      if (authError) throw authError;

      // 2. Update name in the team_members table
      const { data, error: dbError } = await supabase
        .from('team_members')
        .update({ name: newName })
        .eq('email', userEmail)
        .select();
      if (dbError) throw dbError;

      // 3. Catch Silent RLS Failures
      if (!data || data.length === 0) {
        throw new Error("Update blocked by database permissions (RLS) or email not found.");
      }

      // 4. ✨ NEW: Update the owner_name in the units table to maintain the link
      if (oldName) {
        const { error: unitError } = await supabase
          .from('units')
          .update({ owner_name: newName })
          .eq('owner_name', oldName);

        if (unitError) console.error("Failed to update owner name in units", unitError);
      }

      setUserData((prev: any) => ({ ...prev, name: newName }));

      // ✨ NEW: Update local units list so the UI reflects correctly
      setMyUnitsList((prev: any[]) => 
        prev.map(unit => ({
            ...unit,
            owner_name: unit.owner_name === oldName ? newName : unit.owner_name
        }))
      );

      showToast("Owner name updated successfully!", "success");
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Error updating owner name:", err);
      showToast(err.message || "Failed to update owner name.", "error");
    } finally {
      setIsSavingName(false);
    }
  }; 

  // --- Handle Password Change ---
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    setIsSubmittingPassword(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error("Incorrect current password.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`);
      }

      showToast("Password updated successfully!", "success");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsSubmittingPassword(false);
    }
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
    setIssueCategory(""); 
    setRepairIssue(""); 
    setIsRepairModalOpen(true);
  };

  const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  };

  const handleReportRepair = async (e: React.FormEvent) => {
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

      const capitalizedTime = capitalizeWords(repairTime);

      const { data: currentAuth } = await supabase.auth.getUser();
      const finalEmail = currentAuth.user?.email || userEmail;

      const uniqueId = Math.floor(100000 + Math.random() * 900000);
      const finalTitle = `${issueCategory} Ticket #${uniqueId}`;

      const { data: newTicket, error } = await supabase
        .from('tickets') 
        .insert([{
          admin_email: userData?.admin_email,
          reporter_email: finalEmail,
          title: finalTitle,
          location: selectedUnitForRepair || userData?.access_level || "Owner's Unit",
          description: `Best time to visit: ${capitalizedTime || 'Anytime'}. Reported by ${userData?.name || 'Owner'} (Owner).`, 
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
          admin_email: userData?.admin_email,
          recipient: 'MANAGER',
          type: 'TICKET',
          title: 'New Repair Request',
          message: `${userData?.name || 'An owner'} (Owner) reported a ${issueCategory} issue.`, 
          reference_id: newTicket.id,
          is_read: false
        }]);

      setIsRepairModalOpen(false);
      setIssueCategory("");
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

  // --- NEW: Initiate Single Delete Modal ---
  const handleInitiateDeleteNotification = (e: React.MouseEvent, notif: any) => {
    e.stopPropagation(); // Prevents clicking the background notification body
    setNotificationToDelete(notif);
    setIsDeleteNotifModalOpen(true);
  };

  // --- NEW: Actual Function Called by the Delete Modal ---
  const confirmDeleteNotification = async () => {
    if (!userEmail || !notificationToDelete) return;

    // 1. Update local state immediately for snappy UI
    setNotifications((prev) => prev.filter((n) => n.id !== notificationToDelete.id));
    
    // 2. Adjust unread count if the deleted notification was unread
    if (!notificationToDelete.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // Close the modal
    setIsDeleteNotifModalOpen(false);

    // 3. Update database
    await supabase
      .from('notifications')
      .update({ is_hidden: true })
      .eq('id', notificationToDelete.id);

    // Clear the tracked notification
    setNotificationToDelete(null);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    setIsNotifOpen(false);

    const type = notif.type?.toUpperCase() || '';

    if ((type === 'TICKET' || type === 'MAINTENANCE') && String(notif.title).toLowerCase().includes('rejected')) {
      if (notif.reference_id) {
        const { data: ticketData } = await supabase.from('tickets').select('*').eq('id', notif.reference_id).single();
        if (ticketData) {
          setRejectedTicketModalData({ ...ticketData, reason: notif.message });
          return; 
        }
      }
    }

    if (type === 'BILLING' || type === 'STATEMENT' || type === 'SOA') {
      setActiveTab("financials"); 
    } else if (type === 'MAINTENANCE' || type === 'TICKET') {
      if (notif.reference_id) {
        setHighlightTicketId(`${notif.reference_id}_${Date.now()}`); 
      }
      setActiveTab("repair");
    } else if (type === 'MESSAGE' || type === 'CHAT') {
      handleConversationClick();
    } else {
      setActiveTab("home");
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') return { label: 'Submitted', styles: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') return { label: 'Working', styles: 'bg-blue-100 text-blue-700 border-blue-200' };
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
        color: badge.styles,
        staffName,
        priority: match?.priority || ticket.priority || 'Normal',
        on_hold_reason: match?.on_hold_reason || ticket.on_hold_reason || null,
        staffRemarks: match?.remarks || (ticket.status === 'Resolved' ? ticket.remarks : null)
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
          const status = String(matchingTicket.currentLiveStatus).toLowerCase();

          if (status === 'on_hold' || status === 'on hold') {
            setActiveView('on_hold');
            setReviewOnHoldTicket(matchingTicket);
          } else if (status === 'completed' || status === 'resolved' || status === 'closed' || status === 'success') {
            setActiveView('resolved');
            setReviewTicket(matchingTicket);
          } else {
            setActiveView('open');
            setReviewActiveTicket(matchingTicket);
          }

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
    // Return "O" for Owner or missing names
    if (!name || name === "Owner") return "O"; 

    // Get the first character, remove leading spaces, and capitalize it
    return name.trim().charAt(0).toUpperCase();
  };

  // Pass fullName instead of userData?.name to utilize your fallback
  const initials = getInitials(fullName);

  const fullUnitsDisplay = useMemo(() => {
    if (myUnitsList.length === 0) return "No assigned units";

    const grouped = myUnitsList.reduce((acc: Record<string, string[]>, unit: any) => {
      const propName = unit.property_name || "Unknown Property";

      if (!acc[propName]) acc[propName] = [];
      acc[propName].push(unit.unit_number);

      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([prop, units]: [string, string[]]) => {
        const sortedUnits = units.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return `${prop} - ${sortedUnits.join(' & ')}`;
      })
      .join(" • ");
  }, [myUnitsList]);

  const uniqueBusinessNames = Array.from(new Set(myUnitsList.map(u => u.business_name).filter(b => b && b !== "—")));
  const businessNameDisplay = uniqueBusinessNames.join(" | ");

  return (
    <div className="flex flex-col h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)] font-[family-name:var(--font-corporate)] overflow-hidden">

      {/* UNIFIED TOP NAVIGATION */}
      <header className="h-16 bg-[var(--color-secondary)] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative shadow-[var(--shadow-md)] z-20">
        <div className="flex items-center gap-3">
          {orgLogo ? (
            <div 
              onClick={() => setIsLogoModalOpen(true)}
              className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-300"
            >
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src={orgLogo} alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          ) : (
            <div className="inline-block bg-white p-1.5 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
              <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
                <Image src="/logos.png" alt="Organization Logo" fill className="object-contain object-center" priority sizes="112px" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">

          <div 
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-95"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 p-2 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[var(--color-secondary)] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* NOTIFICATION MODAL */}
          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-[340px] sm:w-[380px] bg-[var(--color-bg)] rounded-[var(--radius-lg)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-[var(--color-border)] z-50 overflow-hidden flex flex-col text-[var(--color-text)] animate-in fade-in zoom-in-95 duration-200">

                <div className="px-5 py-4 flex justify-between items-center bg-[var(--color-bg)] border-b border-[var(--color-border)]">
                  <h3 className="font-extrabold text-[var(--color-secondary)] text-base flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-[var(--color-primary)] text-[var(--color-primary-text)] text-[10px] px-2 py-0.5 rounded-full">{unreadCount} new</span>
                    )}
                  </h3>
                  <div className="flex gap-3 relative z-10">
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} className="text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 transition-colors" title="Mark all as read">
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
                      <h4 className="font-bold text-[var(--color-secondary)] mb-1">All caught up!</h4>
                      <p className="text-xs text-slate-500">You have no new notifications right now.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const type = notif.type?.toUpperCase() || '';
                      let Icon = Bell;
                      let iconColor = "text-[var(--color-primary)]"; 
                      let iconBg = "bg-[var(--color-primary)]/10";

                      if (type === 'BILLING' || type === 'STATEMENT') {
                        Icon = Receipt; iconColor = "text-blue-500"; iconBg = "bg-blue-100";
                      } else if (type === 'MAINTENANCE' || type === 'TICKET') {
                        Icon = Wrench; iconColor = "text-orange-500"; iconBg = "bg-orange-100";
                      } else if (type === 'MESSAGE' || type === 'CHAT') {
                        Icon = MessageSquare; iconColor = "text-[var(--color-primary)]"; iconBg = "bg-[var(--color-primary)]/10";
                      }

                      return (
                        <div 
                          key={notif.id} 
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-4 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-primary)]/5 transition-all flex gap-3 relative group ${!notif.is_read ? 'bg-[var(--color-primary)]/10' : 'opacity-80'}`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor} border border-white shadow-[var(--shadow-sm)]`}>
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5 gap-2">
                              <span className={`text-sm truncate pr-2 ${!notif.is_read ? 'font-bold text-[var(--color-secondary)]' : 'font-semibold text-slate-700'}`}>
                                {notif.title}
                              </span>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0 mt-1 shadow-[var(--shadow-sm)]"></span>}
                                
                                <button
                                  onClick={(e) => handleInitiateDeleteNotification(e, notif)}
                                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                  title="Delete notification"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <p className={`text-xs line-clamp-2 mb-1.5 ${!notif.is_read ? 'text-[var(--color-text)]' : 'text-slate-500'}`}>{notif.message}</p>
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
                  <div className="p-2 bg-[var(--color-bg)] border-t border-[var(--color-border)] text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End of notifications</span>
                  </div>
                )}
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px] sm:text-xs font-extrabold border border-[var(--color-primary)]/30 text-[var(--color-primary-text)] bg-[var(--color-primary)]">Owner Portal</span>

          {/* Logout Icon Button */}
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/10 font-bold transition-all text-xs px-3 py-2 sm:px-4 rounded-[var(--radius-sm)]"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER: Sidebar & Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ✨ MODERN COLLAPSIBLE DESKTOP SIDEBAR (Edge-to-Edge Profile) */}
        <aside className={`${isSidebarCollapsed ? 'md:w-[84px]' : 'md:w-[260px]'} bg-[var(--color-secondary)] pt-6 hidden md:flex flex-col transition-all duration-300 relative shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.15)]`}>

          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute top-[72px] -right-3 w-6 h-6 rounded-full bg-white border border-[var(--color-border)] shadow-md items-center justify-center z-20 text-slate-500 hover:text-[var(--color-primary)] hover:scale-110 hover:shadow-lg transition-all duration-200 group"
          >
            <PanelLeft size={13} strokeWidth={2.5} className={`transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
              {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>

          {/* Navigation Links - Padding moved here */}
          <nav className={`flex-1 space-y-1 ${isSidebarCollapsed ? "px-2 overflow-visible" : "px-4 overflow-y-auto custom-scrollbar"}`}>
            <NavSectionLabel collapsed={isSidebarCollapsed}>Overview</NavSectionLabel>
            <NavItem icon={<Home size={18} strokeWidth={2.5} />} label="Home" isActive={activeTab === "home"} onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
            <NavItem icon={<Wrench size={18} strokeWidth={2.5} />} label="Repairs" isActive={activeTab === "repair"} onClick={() => setActiveTab('repair')} collapsed={isSidebarCollapsed} />
            <NavItem icon={<MessageSquare size={18} strokeWidth={2.5} />} label="Messages" isActive={activeTab === "messages"} onClick={handleConversationClick} badgeCount={unreadMessages} collapsed={isSidebarCollapsed} />

            <div className="pt-4">
              <NavSectionLabel collapsed={isSidebarCollapsed}>Finance & Docs</NavSectionLabel>
            </div>
            <NavItem icon={<Receipt size={18} strokeWidth={2.5} />} label="Financials" isActive={activeTab === "financials"} onClick={() => {setActiveTab('financials'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
            <NavItem icon={<FileText size={18} strokeWidth={2.5} />} label="My Lease" isActive={activeTab === "leases"} onClick={() => {setActiveTab('leases'); setHighlightTicketId(null);}} collapsed={isSidebarCollapsed} />
          </nav>

          {/* ✨ MATCHED UI: Premium Bottom User Tag (Edge-to-Edge Layout) */}
          <div className="shrink-0 mt-auto border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.15)]">
            <button 
              onClick={() => {
                setIsWorkspaceModalOpen(true);
                setIsChangingPassword(false);
                setPasswordError(null);
                setShowCurrentPassword(false);
                setShowNewPassword(false);
                setShowConfirmPassword(false);
                setIsEditingName(false);
              }}
              className={`w-full flex items-center gap-3.5 py-4 transition-colors hover:bg-white/5 text-left group relative focus:outline-none ${isSidebarCollapsed ? "justify-center px-0" : "px-5"}`}
              title={isSidebarCollapsed ? "View Profile Details" : undefined}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm text-slate-900 shadow-sm group-hover:scale-105 transition-transform shrink-0" style={{backgroundColor: "var(--color-primary)"}}>
                {isLoading ? '...' : initials}
              </div>
              
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 flex flex-col justify-center mt-0.5">
                  {isLoading ? (
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-24 bg-white/10 rounded animate-pulse"></div>
                      <div className="h-2 w-16 bg-white/5 rounded animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[15px] font-extrabold text-white truncate leading-none mb-1.5">{fullName}</p>
                      <p className="text-[10px] font-extrabold text-white/50 truncate uppercase tracking-widest leading-none">OWNER PROFILE</p>
                    </>
                  )}
                </div>
              )}

              {/* Collapsed Tooltip for Profile */}
              {isSidebarCollapsed && !isLoading && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
                  {fullName}
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={`flex-1 relative transition-all ${activeTab === 'repair' || activeTab === 'messages' ? 'flex flex-col overflow-hidden pb-16 md:pb-0' : 'overflow-y-auto p-4 md:p-8 pb-28'}`}>

          {/* TAB 1: HOME (OVERVIEW) */}
          {activeTab === 'home' && (
            <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Header Section */}
              <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end pb-2 gap-3 sm:gap-0">
                <div className="w-full">
                  <p className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Dashboard Overview</p>

                    {isLoading ? (
                      <div className="h-7 sm:h-8 md:h-10 w-48 bg-slate-200 rounded-[var(--radius-md)] animate-pulse inline-block mt-1"></div>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-700 mt-1 tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
                        Welcome back,
                        <span className="text-[var(--color-secondary)] break-words">{fullName}</span>
                      </h1>
                    )}

                  {businessNameDisplay && (
                    <div className="flex items-center gap-2 mt-2.5 sm:mt-2 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-3 py-1.5 rounded-[var(--radius-sm)] w-fit shadow-[var(--shadow-sm)]">
                      <Briefcase size={14} className="text-[var(--color-primary)] shrink-0" />
                      <span className="text-[var(--color-primary)] font-black text-[10px] sm:text-xs uppercase tracking-wider">{businessNameDisplay}</span>
                    </div>
                  )}
                  {isLoading && !businessNameDisplay && (
                    <div className="h-6 w-32 bg-slate-200 rounded-[var(--radius-md)] animate-pulse mt-2.5 sm:mt-2"></div>
                  )}
                </div>
              </header>

              {/* Hero Card: Owner Bill Display */}
              <section className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 md:p-8 text-white shadow-xl relative overflow-hidden group border border-[var(--color-border)]">
                {/* Decorative background shapes */}
                <div className="absolute -top-10 -right-10 w-48 sm:w-72 h-48 sm:h-72 bg-[var(--color-primary)]/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none group-hover:bg-[var(--color-primary)]/20 transition-colors duration-500"></div>
                <div className="absolute -bottom-10 -left-10 w-40 sm:w-52 h-40 sm:h-52 bg-blue-500/10 rounded-full blur-xl sm:blur-2xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col justify-between h-full space-y-5 sm:space-y-6">
                  <div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full w-fit backdrop-blur-sm">
                      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${totalDue > 0 ? (hasOverdue ? 'bg-red-400 animate-pulse' : 'bg-amber-400 animate-pulse') : 'bg-[var(--color-primary)]'}`}></div>
                      <p className="text-white/80 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Current Statement Balance</p>
                    </div>

                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mt-3 sm:mt-4 tracking-tight flex items-center min-h-[36px] sm:min-h-[40px] md:min-h-[48px] text-white break-all sm:break-normal">
                      {isLoading ? (
                        <div className="h-8 sm:h-10 md:h-12 w-40 sm:w-48 bg-white/10 rounded-[var(--radius-md)] animate-pulse"></div>
                      ) : (
                        `₱${totalDue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                      )}
                    </h2>

                    <div className="text-[11px] sm:text-xs md:text-sm text-white/70 font-medium mt-3 flex items-center gap-2 bg-white/5 border border-white/5 p-2.5 sm:p-3 rounded-[var(--radius-md)] backdrop-blur-sm w-fit max-w-full">
                      <MapPin size={14} className="text-[var(--color-primary)] shrink-0" />
                      <div className="truncate min-w-0">
                        {isLoading ? (
                          <div className="h-3 sm:h-4 bg-white/10 rounded-[var(--radius-sm)] animate-pulse w-32 sm:w-48"></div>
                        ) : (
                          <p className="font-semibold truncate text-[10px] sm:text-[11px] uppercase tracking-widest">
                            {fullUnitsDisplay} 
                            {totalDue > 0 && (
                              <span className={`font-bold ml-1 ${hasOverdue ? 'text-[var(--color-primary)]' : 'text[var(--color-primary-text)]'}`}>
                                · {hasOverdue ? 'Overdue Payment' : 'Pending Payment'}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setActiveTab('financials')} 
                    disabled={totalDue === 0}
                    className="w-full bg-white hover:bg-slate-50 disabled:bg-white/10 disabled:text-white/50 disabled:border-transparent text-[var(--color-secondary)] transition-all rounded-[var(--radius-md)] py-3.5 sm:py-4 font-black text-sm md:text-base flex items-center justify-center gap-2 active:scale-[0.99] border border-transparent shadow-[var(--shadow-md)] hover:shadow-xl hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none duration-300"
                  >
                    {isLoading ? "Checking..." : totalDue > 0 ? "View Statements" : "All caught up"} 
                    {!isLoading && totalDue > 0 && <ChevronRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />}
                  </button>
                </div>
              </section>

              {/* Metric Grid: 4 Interactive Columns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">

                {/* Card 1: Report Issue */}
                <button onClick={() => setActiveTab('repair')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
                    <PenTool size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Maintenance</h3>
                    <p className="text-sm sm:text-base font-black text-[var(--color-text)] mt-0.5 sm:mt-1 leading-tight">Report Issue</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 font-medium leading-snug hidden sm:block">Create repair request</p>
                  </div>
                </button>

                {/* Card 2: Owned Properties */}
                <button onClick={() => setActiveTab('leases')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
                    <Home size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1 w-full min-w-0">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Properties</h3>
                    <div className="text-sm sm:text-lg font-black text-[var(--color-text)] mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px]">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-10"></div> : `${unitsCount} ${unitsCount === 1 ? 'Unit' : 'Units'}`}
                    </div>
                    <div className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug truncate w-full">
                      {isLoading ? <div className="h-2.5 sm:h-3 bg-slate-100 rounded animate-pulse w-16 sm:w-24"></div> : fullUnitsDisplay}
                    </div>
                  </div>
                </button>

                {/* Card 3: Collected Gross */}
                <button onClick={() => setActiveTab('leases')} className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
                    <Receipt size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1 min-w-0">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Gross Income</h3>
                    <div className="text-sm sm:text-lg font-black text-[var(--color-text)] mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px] truncate">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-16 sm:w-20"></div> : `₱${collectedGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                    </div>
                    <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug hidden sm:block">Total revenue collected</p>
                  </div>
                </button>

                {/* Card 4: Occupied Units */}
                <button className="bg-[var(--color-primary)]/10 flex flex-col p-4 sm:p-5 rounded-[var(--radius-2xl)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] text-left relative overflow-hidden group h-full cursor-default">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className=" transition-colors w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center mb-3 sm:mb-4 relative z-10 shrink-0">
                    <CheckCircle size={18} className="text-[var(--color-primary)] sm:w-5 sm:h-5" />
                  </div>
                  <div className="relative z-10 flex flex-col flex-1">
                    <h3 className="font-extrabold text-[10px] sm:text-sm text-slate-500 uppercase tracking-wider line-clamp-1">Occupancy</h3>
                    <div className="text-sm sm:text-lg font-black text-[var(--color-text)] mt-0.5 sm:mt-1 flex items-center min-h-[20px] sm:min-h-[28px]">
                      {isLoading ? <div className="h-4 sm:h-5 bg-slate-200 rounded animate-pulse w-10 sm:w-14"></div> : `${occupiedCount} / ${unitsCount}`}
                    </div>
                    <p className="text-[9px] sm:text-[11px] font-semibold text-slate-400 mt-1 leading-snug hidden sm:block">Active current leases</p>
                  </div>
                </button>
              </div>

              {/* Section: Recent Statements List */}
              <section className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[var(--shadow-sm)] border border-[var(--color-border)] transition-all hover:shadow-[var(--shadow-md)]">
                <div className="flex flex-row items-center justify-between mb-4 sm:mb-5 border-b border-[var(--color-border)] pb-3 sm:pb-4 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-base sm:text-lg text-[var(--color-secondary)] tracking-tight truncate">Recent Statements</h3>
                    <p className="text-slate-400 text-[10px] sm:text-xs mt-0.5 font-medium truncate hidden sm:block">Overview of recent monthly financial statements</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('financials')} 
                    className="text-[10px] sm:text-xs font-black text-[var(--color-primary)] hover:opacity-80 bg-[var(--color-primary)]/10 px-3 py-2 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-[var(--shadow-sm)] whitespace-nowrap shrink-0 border border-[var(--color-primary)]/20"
                  >
                    View All
                  </button>
                </div>

                <div className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((skeleton) => (
                        <div key={skeleton} className="flex items-center justify-between p-3 sm:p-4 bg-[var(--color-bg)]/50 rounded-[var(--radius-md)] border border-[var(--color-border)] animate-pulse">
                          <div className="space-y-2">
                            <div className="h-3 sm:h-4 w-20 sm:w-28 bg-slate-200 rounded"></div>
                            <div className="h-2.5 sm:h-3 w-12 sm:w-16 bg-slate-100 rounded"></div>
                          </div>
                          <div className="h-3 sm:h-4 w-16 sm:w-20 bg-slate-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : statements.length === 0 ? (
                    <div className="py-8 sm:py-10 text-center border-2 border-dashed border-[var(--color-border)] rounded-[1.5rem] bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6">
                      <div className="p-3 bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] text-slate-300 mb-2 sm:mb-3 shadow-[var(--shadow-sm)]">
                        <FileText size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-text)] font-extrabold">No recent statements</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-1 max-w-[200px] sm:max-w-[240px]">Monthly generated financial statements will appear here.</p>
                    </div>
                  ) : (
                    statements.slice(0, 3).map((stmt, idx) => {
                      const isSuccess = String(stmt.status).toLowerCase() === 'success' || String(stmt.status).toLowerCase() === 'paid' || String(stmt.status).toLowerCase() === 'remitted';
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setActiveTab('financials')}
                          className="flex items-center justify-between p-3 sm:p-4 bg-white hover:bg-[var(--color-primary)]/5 border border-[var(--color-border)] rounded-[var(--radius-lg)] transition-all duration-200 cursor-pointer shadow-[var(--shadow-sm)] group gap-2"
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] transition-colors shadow-inner shrink-0">
                              <FileText size={16} className="sm:w-[18px] sm:h-[18px] transition-colors" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-[var(--color-text)] text-xs sm:text-sm group-hover:text-[var(--color-primary)] transition-colors truncate">Statement {stmt.period}</p>
                              <span className={`inline-flex items-center text-[9px] sm:text-[10px] font-black uppercase tracking-wider mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 rounded-[var(--radius-sm)] border ${
                                isSuccess 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : stmt.status === 'Overdue' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {stmt.status}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                            <span className="font-black text-[var(--color-secondary)] text-sm sm:text-base md:text-lg">₱{stmt.net.toLocaleString()}</span>
                            <ChevronRight size={14} className="sm:w-4 sm:h-4 text-slate-300 group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5 hidden sm:block" />
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
            <div className="absolute inset-0 bg-[var(--color-bg)] flex animate-in fade-in duration-300">
              <ConversationTab userData={userData} units={myUnitsList} />
            </div>
          )}

          {/* ✨ TAB 3: REPAIRS KANBAN */}
          {activeTab === 'repair' && (
            <div className="flex flex-col w-full max-w-[1400px] mx-auto h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-6 lg:p-8 md:pb-10">

              {/* Kanban Header */}
              <div className="flex-none shrink-0 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:px-8 sm:py-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-secondary)] tracking-tight">Repair Tickets</h2>
                    <p className="text-slate-500 text-sm mt-1.5 font-medium">Request maintenance and track the progress live.</p>
                  </div>
                  <button 
                    onClick={openRepairModal} 
                    className="w-full sm:w-auto justify-center bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-8 py-3.5 rounded-[var(--radius-lg)] text-sm font-black transition-all shadow-[var(--shadow-md)] hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 active:scale-95 border border-transparent"
                  >
                    <Wrench size={18} strokeWidth={2.5}/> Request Repair
                  </button>
                </div>
              </div>

              {/* ✨ MOBILE TAB SWITCHER */}
              <div className="md:hidden shrink-0 mb-4 bg-slate-100 p-1.5 rounded-[var(--radius-lg)] flex border border-slate-200/80 mx-1 sm:mx-0">
                <button 
                  onClick={() => setActiveView('open')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] text-xs font-black transition-all ${activeView === 'open' ? 'bg-white text-[var(--color-primary)] shadow-[var(--shadow-sm)] border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Inbox size={14} strokeWidth={2.5}/> Active <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px]">{isLoading ? "-" : openInProgressTasks.length}</span>
                </button>
                <button 
                  onClick={() => setActiveView('on_hold')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] text-xs font-black transition-all ${activeView === 'on_hold' ? 'bg-white text-amber-600 shadow-[var(--shadow-sm)] border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <PauseCircle size={14} strokeWidth={2.5}/> Hold <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px]">{isLoading ? "-" : onHoldTasks.length}</span>
                </button>
                <button 
                  onClick={() => setActiveView('resolved')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] text-xs font-black transition-all ${activeView === 'resolved' ? 'bg-white text-[var(--color-primary)] shadow-[var(--shadow-sm)] border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CheckCircle2 size={14} strokeWidth={2.5}/> Resolved <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px]">{isLoading ? "-" : resolvedTasks.length}</span>
                </button>
              </div>

              {/* Grid Kanban (Hybrid UI) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 w-full overflow-y-auto custom-scrollbar">

                {/* ================= Column 1: Active Tickets ================= */}
                <div className={`${activeView === 'open' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
                  <h4 className="hidden md:flex font-extrabold text-[var(--color-text)] text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
                    <span className="flex items-center gap-2">
                      <div className="p-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20"><Inbox size={16} strokeWidth={2.5} /></div>
                      Active Requests
                    </span>
                    <span className="bg-white border border-[var(--color-border)] text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-[var(--shadow-sm)]">
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
                            className={`group h-[200px] shrink-0 bg-white rounded-[1.5rem] border flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 p-5 ${
                              isHighlighted ? 'ring-4 ring-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 border-[var(--color-primary)] scale-[1.02] shadow-xl animate-pulse z-10' : 
                              t.priority === 'Urgent' ? 'border-l-4 border-l-red-500 shadow-[var(--shadow-sm)] border-[var(--color-border)]' : 'hover:border-[var(--color-primary)]/60 shadow-[var(--shadow-sm)] border-[var(--color-border)]'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                              <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                              <span className={`shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] font-black uppercase tracking-widest border shadow-[var(--shadow-sm)] ${t.color}`}>{t.label}</span>
                            </div>

                            <p className="text-[var(--color-primary)] font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                              <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{t.location}</span>
                            </p>

                            <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                              <p className="text-xs leading-relaxed font-semibold text-slate-500 line-clamp-2">
                                {t.description}
                              </p>
                            </div>

                            <div className="shrink-0 mt-auto pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] flex items-center justify-center text-[10px] font-bold shadow-[var(--shadow-sm)] border border-transparent">
                                  {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned Staff</span>
                                  <span className="text-xs font-bold text-[var(--color-text)]">{t.staffName}</span>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-[var(--color-primary)] transition-colors" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ================= Column 2: On Hold ================= */}
                <div className={`${activeView === 'on_hold' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
                  <h4 className="hidden md:flex font-extrabold text-[var(--color-text)] text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
                    <span className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100 text-amber-600 rounded-[var(--radius-sm)] border border-amber-200"><PauseCircle size={16} strokeWidth={2.5} /></div>
                      Delayed / On Hold
                    </span>
                    <span className="bg-white border border-[var(--color-border)] text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-[var(--shadow-sm)]">
                      {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : onHoldTasks.length}
                    </span>
                  </h4>

                  <div className="flex flex-col space-y-4">
                    {isLoading ? (
                      <KanbanSkeleton />
                    ) : onHoldTasks.length === 0 ? (
                      <EmptyState icon={PauseCircle} title="No delays" message="If a repair needs parts or gets delayed, it will show here." />
                    ) : (
                      onHoldTasks.map(t => {
                        const holdReason = t.on_hold_reason;
                        return (
                          <div 
                            key={t.id} 
                            id={`ticket-${t.id}`}
                            onClick={() => setReviewOnHoldTicket(t)}
                            className="group h-[200px] shrink-0 bg-white rounded-[1.5rem] border border-[var(--color-border)] flex flex-col cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-amber-400 p-5 shadow-[var(--shadow-sm)]"
                          >
                            <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                              <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                              <span className={`shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] font-black uppercase tracking-widest border shadow-[var(--shadow-sm)] ${t.color}`}>{t.label}</span>
                            </div>

                            <p className="text-[var(--color-primary)] font-extrabold text-xs flex items-center gap-1.5 truncate mb-2 shrink-0">
                              <MapPin size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">{t.location}</span>
                            </p>

                            <div className="space-y-2 mb-3 flex-1 overflow-hidden">
                              <p className="text-xs leading-relaxed font-semibold text-amber-700 line-clamp-2">
                                <AlertTriangle size={12} className="inline mr-1 text-amber-500" strokeWidth={2.5} />
                                {holdReason || "Awaiting management review."}
                              </p>
                            </div>

                            <div className="shrink-0 mt-auto pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] flex items-center justify-center text-[10px] font-bold shadow-[var(--shadow-sm)] border border-amber-200">
                                  {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Assigned Staff</span>
                                  <span className="text-xs font-bold text-[var(--color-text)]">{t.staffName}</span>
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
                <div className={`${activeView === 'resolved' ? 'flex' : 'hidden'} md:flex flex-col h-auto bg-[var(--color-bg)]/50 rounded-[var(--radius-xl)] p-4 sm:p-5 border border-[var(--color-border)] shadow-inner`}>
                  <h4 className="hidden md:flex font-extrabold text-[var(--color-text)] text-sm mb-5 shrink-0 items-center justify-between tracking-wide">
                    <span className="flex items-center gap-2">
                      <div className="p-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-[var(--radius-sm)]"><CheckCircle2 size={16} strokeWidth={2.5} /></div>
                      Resolved
                    </span>
                    <span className="bg-white border border-[var(--color-border)] text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-[var(--shadow-sm)]">
                      {isLoading ? <div className="h-3 w-3 bg-slate-200 rounded-full animate-pulse inline-block"></div> : resolvedTasks.length}
                    </span>
                  </h4>

                  <div className="flex flex-col space-y-4">
                    {isLoading ? (
                      <><KanbanSkeleton /><KanbanSkeleton /></>
                    ) : resolvedTasks.length === 0 ? (
                      <EmptyState icon={CheckCircle} title="No resolved tasks" message="Completed tasks and resolution photos will be logged here." />
                    ) : (
                      resolvedTasks.map(t => {
                        return (
                          <div 
                            key={t.id} 
                            id={`ticket-${t.id}`}
                            onClick={() => setReviewTicket(t)} 
                            className="group h-[200px] shrink-0 bg-white rounded-[1.5rem] border flex flex-col transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-[var(--color-primary)]/50 border-[var(--color-border)] shadow-[var(--shadow-sm)] p-5"
                          >
                            <div className="flex justify-between items-start mb-3 gap-3 shrink-0">
                              <h4 className="font-extrabold text-[var(--color-secondary)] text-base leading-snug tracking-tight line-clamp-2">{t.title}</h4>
                              <span className={`shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] font-black uppercase tracking-widest border shadow-[var(--shadow-sm)] ${t.color}`}>{t.label}</span>
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

                            <div className="shrink-0 mt-auto flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold border border-[var(--color-primary)]/20">
                                  {t.staffName !== "Pending Assignment" ? t.staffName.substring(0, 1) : "?"}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Fixed By</span>
                                  <span className="text-xs font-bold text-[var(--color-text)]">{t.staffName}</span>
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-[var(--color-primary)] transition-colors" />
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

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[var(--color-bg)]/90 backdrop-blur-xl pb-safe z-50 shadow-[var(--shadow-md)]">
        <div className="flex justify-around items-center px-1 py-1.5 max-w-md mx-auto">

          <button onClick={() => {setActiveTab('home'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group">
            {activeTab === 'home' && !isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'home' && !isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: activeTab === 'home' && !isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              <Home size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Home</span>
            </div>
          </button>

          <button onClick={() => {setActiveTab('repair'); setIsWorkspaceModalOpen(false);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group">
            {activeTab === 'repair' && !isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'repair' && !isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: activeTab === 'repair' && !isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              <Wrench size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Repairs</span>
            </div>
          </button>

          <button onClick={handleConversationClick} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group">
            {activeTab === 'messages' && !isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'messages' && !isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: activeTab === 'messages' && !isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              
              <div className="relative w-5 h-5 block shrink-0">
                <MessageSquare size={20} className="absolute inset-0" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-500 text-white text-[9px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border-2 border-[var(--color-bg)] shadow-[var(--shadow-sm)] z-20">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </div>

              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Chat</span>
            </div>
          </button>

          {/* FINANCE */}
          <button onClick={() => {setActiveTab('financials'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group">
            {activeTab === 'financials' && !isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'financials' && !isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: activeTab === 'financials' && !isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              <Receipt size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Finance</span>
            </div>
          </button>

          {/* LEASES */}
          <button onClick={() => {setActiveTab('leases'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group">
            {activeTab === 'leases' && !isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${activeTab === 'leases' && !isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: activeTab === 'leases' && !isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              <FileText size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Lease</span>
            </div>
          </button>

          {/* PROFILE */}
          <button 
            onClick={() => {
              setIsWorkspaceModalOpen(true);
              setIsChangingPassword(false);
              setPasswordError(null);
              setShowCurrentPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
              setIsEditingName(false);
            }} 
            className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors group"
          >
            {isWorkspaceModalOpen && <span className="absolute inset-1 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] animate-in zoom-in duration-200 shadow-[var(--shadow-sm)]" />}
            <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${isWorkspaceModalOpen ? '-translate-y-1 scale-[1.05]' : 'text-slate-500 group-hover:text-[var(--color-primary)]'}`} style={{ color: isWorkspaceModalOpen ? 'var(--color-primary)' : '' }}>
              <User size={20} />
              <span className="text-[8.5px] sm:text-[9px] font-black mt-1 uppercase tracking-tight">Profile</span>
            </div>
          </button>

        </div>
      </nav>

      {/* MODALS */}
      {/* 1. REPORT REPAIR MODAL (Symptom-Based) */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-[var(--color-border)]">

            <div className="px-5 py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 shadow-[var(--shadow-sm)] z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-secondary)] tracking-tight">Report an Issue</h2>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 mt-0.5">Let us know what needs fixing.</p>
              </div>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-sm)] text-slate-500 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-[var(--color-bg)]/50 pb-safe">
              <form onSubmit={handleReportRepair} className="space-y-6">

                {myUnitsList.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Property Unit</label>
                    <div className="relative">
                      <select
                        required
                        value={selectedUnitForRepair}
                        onChange={(e) => setSelectedUnitForRepair(e.target.value)}
                        className="w-full px-4 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-text)] bg-white hover:border-[var(--color-primary)]/50 transition-all cursor-pointer shadow-[var(--shadow-sm)] appearance-none pr-10"
                        disabled={isSubmitting}
                      >
                        <option value="" disabled>Select which unit needs repair...</option>
                        {[...myUnitsList]
                          .sort((a, b) => {
                            const nameA = `${a.property_name} - ${a.unit_number}`;
                            const nameB = `${b.property_name} - ${b.unit_number}`;
                            return nameA.localeCompare(nameB, undefined, { numeric: true });
                          })
                          .map((u) => (
                            <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>
                              {u.property_name} - {u.unit_number}
                            </option>
                          ))}
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                        <ChevronRight size={16} className="rotate-90"/>
                      </div>
                    </div>
                  </div>
                )}

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
                          className={`cursor-pointer rounded-[var(--radius-md)] border-2 flex flex-col items-center justify-center p-3 sm:p-4 text-center transition-all duration-200 active:scale-95 ${
                            isSelected ? `${cat.border} ${cat.bg} shadow-[var(--shadow-md)] scale-[1.02]` : 'border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${isSelected ? 'bg-white shadow-[var(--shadow-sm)]' : cat.bg}`}>
                            <Icon size={20} className={cat.color} strokeWidth={isSelected ? 2.5 : 2} />
                          </div>
                          <span className={`text-[10px] sm:text-xs font-black tracking-tight ${isSelected ? cat.color : 'text-[var(--color-text)]'}`}>{cat.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Animated reveal for the rest of the form */}  
                {issueCategory && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 2: Upload Photo (Required)</label>

                      {selectedImage ? (
                        <div className="flex flex-col w-full p-2 rounded-[var(--radius-lg)] border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-[var(--shadow-sm)]">
                          <div className="relative w-full h-32 rounded-[var(--radius-md)] overflow-hidden bg-slate-900 mb-2">
                            <img src={URL.createObjectURL(selectedImage)} alt="Repair issue preview" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center justify-between px-2 pb-1">
                            <span className="text-[10px] text-[var(--color-primary)] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12} strokeWidth={3}/> Image Ready</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); setSelectedImage(null); }} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-100 px-2 py-1 rounded-[var(--radius-sm)] transition-colors" disabled={isSubmitting}>Remove</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* MOBILE VIEW (Side-by-side) */}
                          <div className="flex md:hidden gap-3 w-full">
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-[var(--shadow-sm)] transition-all group">
                              <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors"><Camera size={20} strokeWidth={2.5}/></div>
                              <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[var(--color-primary)] uppercase tracking-wide">Take Photo</span>
                              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                            </label>
                            <label className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-[var(--shadow-sm)] transition-all group">
                              <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                              </div>
                              <span className="text-[10px] sm:text-xs font-black text-slate-700 group-hover:text-[var(--color-primary)] uppercase tracking-wide">Gallery</span>
                              <input type="file" accept="image/*" onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} className="hidden" disabled={isSubmitting} />
                            </label>
                          </div>

                          {/* DESKTOP VIEW (Full Width Upload) */}
                          <div className="hidden md:flex w-full">
                            <label className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 cursor-pointer bg-white shadow-[var(--shadow-sm)] transition-all group">
                              <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                              </div>
                              <span className="text-sm font-black text-[var(--color-text)] group-hover:text-[var(--color-primary)] uppercase tracking-wide">Upload Photo</span>
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
                        <select required value={repairPriority} onChange={(e) => setRepairPriority(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 text-xs sm:text-sm font-bold text-[var(--color-text)] bg-white hover:border-[var(--color-primary)]/50 transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting}>
                          <option value="Normal">Normal</option>
                          <option value="Urgent">🚨 Urgent</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Time</label>
                        <input type="text" required placeholder="e.g. Morning..." value={repairTime} onChange={(e) => setRepairTime(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10 text-xs sm:text-sm font-bold text-[var(--color-text)] placeholder:text-slate-400 transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting} />
                      </div>
                    </div>

                    <div className="pt-2 sm:pt-4 pb-2">
                      <button type="submit" disabled={isSubmitting} className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] border border-transparent py-4 rounded-[var(--radius-md)] text-sm font-black transition-all shadow-[var(--shadow-md)] active:scale-[0.98] flex justify-center items-center gap-2">
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
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">

            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-[var(--shadow-sm)]">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Request Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <Inbox size={16} className="text-[var(--color-primary)] shrink-0" /> {reviewActiveTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewActiveTicket(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-[var(--color-bg)]/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                {/* SUBMITTED DETAILS */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-border)] shadow-[var(--shadow-sm)]">Report</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Issue Evidence</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewActiveTicket.photo_url ? (
                      <img src={reviewActiveTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo</span></div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-[1.5rem] p-5 border border-[var(--color-border)] flex flex-col justify-start">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">{reviewActiveTicket.description}</p>
                  </div>
                </div>

                {/* CURRENT STATUS */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]">Status</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Current Progress</span>
                    </div>
                    <span className={`px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border ${reviewActiveTicket.color} shrink-0 shadow-[var(--shadow-sm)]`}>{reviewActiveTicket.label}</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-[var(--color-primary)]/5 rounded-[1.5rem] border border-[var(--color-primary)]/20 overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-inner p-6 text-center">
                    <Clock size={48} className="text-[var(--color-primary)]/50 mb-4" strokeWidth={1.5} />
                    <h3 className="font-black text-[var(--color-secondary)] text-lg sm:text-xl mb-2">
                      {String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('progress') || String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('working') ? "Work in Progress" : "Request Received"}
                    </h3>
                    <p className="text-sm text-slate-600 font-medium max-w-[250px] mx-auto">
                      {String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('progress') || String(reviewActiveTicket.currentLiveStatus).toLowerCase().includes('working') ? "Our maintenance staff is currently working on your request." : "Your request is in queue and will be assigned to a staff member shortly."}
                    </p>
                  </div>

                  <div className="bg-[var(--color-primary)]/5 rounded-[1.5rem] p-5 border border-[var(--color-primary)]/10 space-y-4 shrink-0 flex flex-col justify-between flex-1 relative z-10">
                    <div className="mt-auto pt-2 space-y-4">
                      {/* ✨ MOVED "REPORTED ON" HERE */}
                      <div className="flex justify-between items-center border-b border-[var(--color-primary)]/10 pb-4">
                        <span className="text-[10px] font-black text-[var(--color-primary)]/80 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={14} className="shrink-0" /> Reported On
                        </span>
                        <span className="font-extrabold text-[var(--color-text)] text-xs">
                          {new Date(reviewActiveTicket.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* ASSIGNED TO */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-[var(--color-primary)]/80 uppercase tracking-widest flex items-center gap-2">
                          <User size={14} className="shrink-0" /> Assigned To
                        </span>
                        <span className="font-extrabold text-[var(--color-text)] bg-white px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] text-xs truncate max-w-[150px] sm:max-w-[200px]">
                          {reviewActiveTicket.staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[var(--shadow-sm)]">
              <button onClick={() => setReviewActiveTicket(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] hover:opacity-90 py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 3. REVIEW ON HOLD MODAL (Before & After) */}
      {reviewOnHoldTicket && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-60 flex items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">

            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-[var(--shadow-sm)]">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Hold Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <PauseCircle size={16} className="text-amber-500 shrink-0" /> {reviewOnHoldTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewOnHoldTicket(null)} className="w-12 h-12 flex items-center hidden md:flex justify-center bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                {/* BEFORE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-amber-200/60 shadow-[var(--shadow-sm)]">Before</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Initial Report</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewOnHoldTicket.photo_url ? (
                      <img src={reviewOnHoldTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <Camera size={32} className="mx-auto mb-2 opacity-40" />
                        <span className="text-xs font-bold block uppercase tracking-widest">No photo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-5 border border-[var(--color-border)] flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">
                      {reviewOnHoldTicket.description}
                    </p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-[var(--color-border)] pt-5 mt-5 shrink-0">
                      Reported: {new Date(reviewOnHoldTicket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* ON HOLD UPDATE COLUMN */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-amber-100 shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-purple-200/60 shadow-[var(--shadow-sm)]">Update</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Staff Report</span>
                    </div>
                    <span className={`px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border ${reviewOnHoldTicket.color} shrink-0 shadow-[var(--shadow-sm)]`}>
                      {reviewOnHoldTicket.label}
                    </span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-amber-200/60 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {(reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url) ? (
                      <img 
                        src={reviewOnHoldTicket.liveMatch?.on_hold_photo_url || reviewOnHoldTicket.liveMatch?.resolution_photo_url} 
                        alt="On hold status" 
                        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105" 
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <PauseCircle size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-40 text-amber-500" />
                        <span className="text-xs font-black block uppercase tracking-widest text-amber-600/70">Awaiting action or parts</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 rounded-[1.5rem] p-5 border border-amber-100/50 space-y-2 shrink-0 flex flex-col justify-between flex-1">
                    <div>
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block border-b border-amber-100 pb-2 mb-2">Reason for delay:</span>
                      <p className="text-sm text-amber-800 leading-relaxed font-bold">
                        {reviewOnHoldTicket.liveMatch?.on_hold_reason || reviewOnHoldTicket.liveMatch?.remarks || "Task is currently on hold. We will update you soon as possible."}
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-xs sm:text-sm border-t border-amber-200/60 pt-4 mt-2">
                      <span className="text-[10px] sm:text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5"><User size={12} /> Staff</span>
                      <span className="font-bold text-amber-900 bg-white px-3 py-1.5 rounded-[var(--radius-sm)] border border-amber-100 shadow-[var(--shadow-sm)]">
                        {reviewOnHoldTicket.staffName || "Pending Assignment"}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[var(--shadow-sm)]">
              <button onClick={() => setReviewOnHoldTicket(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ 4. REVIEW RESOLUTION MODAL (Before & After) */}
      {reviewTicket && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-500">
          <div className="bg-[var(--color-bg)] rounded-t-[var(--radius-xl)] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] absolute bottom-0 sm:relative transform transition-transform animate-in slide-in-from-bottom sm:zoom-in duration-500 border border-[var(--color-border)]">

            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 z-10 shadow-[var(--shadow-sm)]">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] flex items-center gap-2 truncate tracking-tight">
                  Resolution Details
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 mt-1.5 truncate">
                  <CheckCircle2 size={16} className="text-[var(--color-primary)] shrink-0" /> {reviewTicket.title}
                </div>
              </div>
              <button onClick={() => setReviewTicket(null)} className="w-12 h-12 flex items-center justify-center hidden md:flex bg-slate-100 hover:bg-slate-200 transition-colors rounded-[var(--radius-sm)] shrink-0 active:scale-95 text-slate-500">
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-[var(--color-bg)]/50 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

                {/* BEFORE */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex flex-col space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-border)] shadow-[var(--shadow-sm)]">Before</span>
                    <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Your Initial Report</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-inner group p-1">
                    {reviewTicket.photo_url ? (
                      <img src={reviewTicket.photo_url} alt="Reported issue" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-slate-400 p-4"><Camera size={32} className="mx-auto mb-2 opacity-40" /><span className="text-xs font-bold block uppercase tracking-widest">No photo</span></div>
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-[1.5rem] p-5 border border-[var(--color-border)] flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-[var(--color-border)] pb-2 mb-2">Description:</span>
                    <p className="text-sm text-[var(--color-text)] leading-relaxed font-semibold">{reviewTicket.description}</p>
                    <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest border-t border-[var(--color-border)] pt-4 mt-5 shrink-0">
                      Reported: {new Date(reviewTicket.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* AFTER */}
                <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] flex flex-col space-y-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-bl-full blur-2xl pointer-events-none"></div>

                  <div className="flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                      <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]">After</span>
                      <span className="text-sm sm:text-base font-black text-[var(--color-text)]">Resolution Status</span>
                    </div>
                    <span className="px-3 py-1 rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 shadow-sm"><Check size={12} className="inline mr-1"/> Success</span>
                  </div>

                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[1.5rem] border border-[var(--color-primary)]/20 overflow-hidden flex items-center justify-center shrink-0 shadow-inner group relative z-10 p-1">
                    {reviewTicket.liveMatch?.resolution_photo_url ? (
                      <img src={reviewTicket.liveMatch.resolution_photo_url} alt="Resolution proof" className="w-full h-full object-contain transition-transform group-hover:scale-105 duration-700" />
                    ) : (
                      <div className="text-center text-[var(--color-primary)]/60 p-4"><CheckCircle2 size={32} className="mx-auto mb-2 opacity-60" /><span className="text-xs font-bold block uppercase tracking-widest text-[var(--color-primary)]/70">No evidence photo</span></div>
                    )}
                  </div>

                  <div className="bg-[var(--color-primary)]/5 rounded-[1.5rem] p-5 border border-[var(--color-primary)]/10 space-y-4 shrink-0 flex flex-col justify-between flex-1 relative z-10">
                    {reviewTicket.staffRemarks && (
                       <div>
                         <span className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest block border-b border-[var(--color-primary)]/20 pb-2 mb-2">Staff Remarks:</span>
                         <p className="text-sm text-[var(--color-text)] leading-relaxed font-bold">"{reviewTicket.staffRemarks}"</p>
                       </div>
                    )}

                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex justify-between items-center border-t border-[var(--color-primary)]/20 pt-4">
                        <span className="text-[10px] font-black text-[var(--color-primary)]/70 uppercase tracking-widest flex items-center gap-2"><User size={14} /> Fixed By</span>
                        <span className="font-extrabold text-[var(--color-text)] bg-white px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] text-xs">
                          {reviewTicket.staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-5 bg-[var(--color-bg)] border-t border-[var(--color-border)] shrink-0 md:hidden z-10 shadow-[var(--shadow-sm)]">
              <button onClick={() => setReviewTicket(null)} className="w-full bg-[var(--color-primary)] text-[var(--color-text)] py-4 rounded-[var(--radius-md)] font-black text-base shadow-[var(--shadow-md)] active:scale-[0.98] transition-all border border-transparent">Close Details</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTED TICKET MODAL */}
      {rejectedTicketModalData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[95vh] border border-[var(--color-border)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">

            {/* Red Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 bg-red-50 border-b border-red-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-[var(--shadow-sm)]">
                  <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-red-600 tracking-tight">Request Rejected</h2>
                  <p className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-widest mt-0.5">Admin Action</p>
                </div>
              </div>
              <button onClick={() => setRejectedTicketModalData(null)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors shadow-sm active:scale-95 shrink-0">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto bg-[var(--color-bg)]/50 custom-scrollbar pb-10 sm:pb-8">

              {/* Reason Box */}
              <div className="bg-red-500 rounded-[1.5rem] p-5 sm:p-6 text-white mb-6 shadow-md shadow-red-500/20">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-200 mb-2">Reason for rejection:</h4>
                <p className="text-sm font-semibold leading-relaxed">
                  {rejectedTicketModalData.reason?.replace(/Your request ".*?" was not approved\. Reason: /, '') || "This request was not approved by the administration."}
                </p>
              </div>

              {/* Original Report Details */}
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Original Report</h4>
              <div className="bg-white rounded-2xl p-5 border border-[var(--color-border)] shadow-[var(--shadow-sm)] space-y-4">

                {rejectedTicketModalData.photo_url && (
                  <div className="w-full h-64 sm:h-[400px] bg-slate-900/95 rounded-[var(--radius-md)] overflow-hidden mb-4 border border-[var(--color-border)] p-1">
                    <img src={rejectedTicketModalData.photo_url} alt="Reported issue" className="w-full h-full object-contain" />
                  </div>
                )}

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Issue Title</span>
                  <p className="font-extrabold text-[var(--color-text)]">{rejectedTicketModalData.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Location</span>
                    <p className="font-bold text-[var(--color-text)] text-xs">{rejectedTicketModalData.location}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Reported On</span>
                    <p className="font-bold text-[var(--color-text)] text-xs">{new Date(rejectedTicketModalData.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Description</span>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                    {rejectedTicketModalData.description}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE PROFILE MODAL */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-[var(--color-border)]">

            <div className="px-5 py-4 sm:px-8 sm:py-6 flex justify-between items-center bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight">Owner Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-slate-100 rounded-[var(--radius-xl)] text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0"
              >
                <X size={18} className="sm:w-5 sm:h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">

              <div className="bg-[var(--color-secondary)] rounded-[1.5rem] sm:rounded-[var(--radius-xl)] p-5 sm:p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl sm:text-3xl border-2 border-[var(--color-primary)] uppercase shadow-inner z-10" style={{backgroundColor: "var(--color-primary)", color: "var(--color-primary-text)"}}>
                  {initials}
                </div>
                <div className="z-10 min-w-0 flex-1 text-white">
                  <h3 className="font-black text-lg sm:text-2xl tracking-tight break-words leading-tight">{fullName}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-white/70 mt-1 tracking-widest uppercase">Property Owner</p>
                </div>
              </div>

              <div className="bg-white rounded-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6 space-y-4 sm:space-y-5">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-3 border-b border-slate-100">
                  Account Details
                </h4>
                <div className="space-y-4 sm:space-y-5">
                  {/* --- MODIFIED FULL NAME SECTION --- */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5 sm:mb-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Full Name</label>

                      {!isEditingName ? (
                        <button 
                          onClick={() => {
                            setEditedName(fullName);
                            setIsEditingName(true);
                          }}
                          className="text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                        >
                          <Edit2 size={12} strokeWidth={2.5} /> Edit
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <button 
                            onClick={() => setIsEditingName(false)}
                            className="text-slate-500 bg-slate-50 border border-[var(--color-border)] hover:bg-slate-100 px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                            disabled={isSavingName}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleInitiateNameSave}
                            className="text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 border border-transparent px-3 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all shadow-[var(--shadow-sm)] active:scale-95"
                            disabled={isSavingName}
                          >
                            {isSavingName ? (
                              <span className="animate-pulse">Saving...</span>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditingName ? (
                      <p className="text-sm sm:text-[15px] font-extrabold text-[var(--color-text)] tracking-tight break-words px-3 py-2.5 bg-slate-50 rounded-[var(--radius-md)] border border-[var(--color-border)] transition-all">
                        {fullName}
                      </p>
                    ) : (
                      <div className="relative animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 text-sm sm:text-[15px] font-extrabold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]"
                          disabled={isSavingName}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInitiateNameSave();
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {/* --- END MODIFIED FULL NAME SECTION --- */}

                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-bold text-[var(--color-text)]/80 break-all bg-slate-50 py-2 px-3 rounded-[var(--radius-md)] inline-block border border-[var(--color-border)] leading-normal">{userEmail || "Not available"}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5 sm:mb-2">Owned Properties</label>
                    <div className="text-xs sm:text-sm font-bold text-[var(--color-primary)] break-words leading-relaxed bg-[var(--color-primary)]/10 py-2 px-3 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20">
                      {myUnitsList.length > 0 
                        ? Object.entries(
                            myUnitsList.reduce((acc: Record<string, string[]>, unit: any) => {
                              const propName = unit.property_name || "Unknown Property";
                              if (!acc[propName]) acc[propName] = [];
                              acc[propName].push(unit.unit_number);
                              return acc;
                            }, {})
                          )
                          .map(([prop, units]: [string, any]) => {
                            const sortedUnits = units.sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
                            return `${prop} - Unit ${sortedUnits.join(' & ')}`;
                          })
                          .join(' • ')
                        : "Not Assigned"}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Access Role</label>
                    <div className="shrink-0">
                      <span className="inline-flex text-[10px] sm:text-[11px] font-black text-[var(--color-primary)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 px-2.5 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] tracking-widest uppercase shadow-sm">
                        Owner
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400/80 uppercase tracking-[0.2em]">
                    Security
                  </h4>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-[var(--color-primary)] text-xs font-bold hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Key size={14} /> Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-[var(--radius-md)] border border-red-100 flex items-center gap-2">
                        <AlertTriangle size={14} className="shrink-0" />
                        {passwordError}
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Current Password</label>
                      <div className="relative">
                        <input 
                          type={showCurrentPassword ? "text" : "password"}
                          required 
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showCurrentPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showNewPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Confirm New Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPassword ? "text" : "password"}
                          required 
                          minLength={6}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          className="w-full px-4 pr-11 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-[var(--color-bg)] focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[var(--color-primary)] transition-colors p-1"
                        >
                          {showConfirmPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsChangingPassword(false);
                          setPasswordError(null);
                          setCurrentPassword("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                          setShowCurrentPassword(false);
                          setShowNewPassword(false);
                          setShowConfirmPassword(false);
                        }}
                        disabled={isSubmittingPassword}
                        className="flex-1 py-3 rounded-[var(--radius-md)] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs shadow-sm active:scale-95 border border-transparent"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingPassword}
                        className="flex-1 py-3 rounded-[var(--radius-md)] font-black text-[var(--color-primary-text)] bg-[var(--color-primary)] hover:opacity-90 transition-all shadow-[var(--shadow-md)] text-xs flex items-center justify-center gap-2 active:scale-95 border border-transparent"
                      >
                        {isSubmittingPassword ? (
                          <span className="animate-pulse">Updating...</span>
                        ) : (
                          <><Lock size={14} strokeWidth={2.5} /> Update Password</>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM CONFIRM NAME CHANGE MODAL */}
      {isConfirmNameModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">

            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/5 text-[var(--color-primary)] rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5 border-4 border-[var(--color-primary)]/20 shadow-inner">
              <User size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Name Change</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              Are you sure you want to change your profile name to <strong className="text-[var(--color-primary)] font-black">"{editedName.trim()}"</strong>?
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfirmNameModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-[var(--radius-md)] transition-all border border-[var(--color-border)] active:scale-[0.96] shadow-sm"
                disabled={isSavingName}
              >
                Cancel
              </button>
              <button 
                onClick={confirmNameSave} 
                className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-black transition-all shadow-[var(--shadow-md)] active:scale-[0.96] flex justify-center items-center border border-transparent"
                disabled={isSavingName}
              >
                {isSavingName ? <span className="animate-pulse">Updating...</span> : "Yes, Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM LOGOUT MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <AlertTriangle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Confirm Logout</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">Are you sure you want to log out of your owner workspace?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-all border border-transparent active:scale-[0.96]"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-sm sm:text-sm font-black transition-all shadow-lg shadow-[var(--color-primary)]/25 active:scale-[0.96]"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM DELETE NOTIFICATION MODAL */}
      {isDeleteNotifModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 text-red-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50 shadow-inner">
              <Trash2 size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight">Delete Notification</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              Are you sure you want to delete this notification? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setIsDeleteNotifModalOpen(false);
                  setNotificationToDelete(null);
                }} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-all border border-transparent active:scale-[0.96]"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteNotification} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 sm:py-3.5 rounded-[var(--radius-md)] text-sm sm:text-sm font-black transition-all shadow-lg shadow-red-500/25 active:scale-[0.96]"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM LOGO LIGHTBOX MODAL */}
      {isLogoModalOpen && orgLogo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 sm:p-10 animate-in fade-in duration-300" onClick={() => setIsLogoModalOpen(false)}>
          <div
            className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[50vh] sm:h-[70vh] flex items-center justify-center p-8 sm:p-12 transform transition-all animate-in zoom-in-95 duration-500 border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsLogoModalOpen(false)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-all active:scale-95 shadow-sm z-10"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
            <div className="relative w-full h-full">
              <Image
                src={orgLogo}
                alt="Organization Logo Expanded"
                fill
                className="object-contain drop-shadow-lg"
                sizes="(max-width: 1024px) 100vw, 1024px"
                priority
              />
            </div>
          </div>
        </div>
      )}

      {/* TOAST UI */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex items-center gap-3 px-5 py-4 rounded-[var(--radius-xl)] shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-[var(--color-bg)] ${toast.type === "success" ? "border-l-4 border-l-[var(--color-primary)] text-[var(--color-text)]" : "border-l-4 border-l-red-500 text-[var(--color-text)]"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-[var(--color-primary)]" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
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

        .pb-safe { padding-bottom: max(4px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// COMPONENTS
// -------------------------------------------------------------------------------------------------

// ✨ FIXED HEIGHT KANBAN SKELETON
function KanbanSkeleton() {
  return (
    <div className="h-[200px] shrink-0 bg-white rounded-3xl shadow-[var(--shadow-sm)] border border-[var(--color-border)] overflow-hidden flex flex-col animate-pulse">
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

// ✨ STANDARDIZED EMPTY STATE
function EmptyState({ icon: Icon, title, message }: { icon: any, title: string, message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-[1.5rem] border border-dashed border-[var(--color-border)] h-[200px] animate-in fade-in duration-300">
      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-4 shadow-[var(--shadow-sm)] text-[var(--color-primary)]/50 border border-[var(--color-border)]">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <h4 className="font-extrabold text-[var(--color-secondary)] mb-1.5">{title}</h4>
      <p className="text-xs text-slate-500 max-w-[220px] mx-auto leading-relaxed">{message}</p>
    </div>
  );
}

// ✨ NAV SECTION LABEL: Typography with trailing divider
function NavSectionLabel({ children, collapsed }: { children: React.ReactNode, collapsed?: boolean }) {
  if (collapsed) {
    return <div className="h-px bg-white/10 mx-4 my-3 first:mt-1" />;
  }
  return (
    <div className="flex items-center gap-3 px-4 pt-5 pb-2 first:pt-2 select-none">
      <span className="text-[11px] font-semibold text-slate-400/80 uppercase tracking-widest whitespace-nowrap">
        {children}
      </span>
      <div className="h-px bg-white/5 flex-1 mt-0.5"></div>
    </div>
  );
}

// ✨ REFACTORED NAV ITEM: Uses CSS Variables for dynamic active states; supports collapsed tooltip mode
function NavItem({ icon, label, isActive, onClick, badgeCount, collapsed }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, badgeCount?: number, collapsed?: boolean }) {
  return (
    <div className="relative group/navitem">
      <button 
        onClick={onClick} 
        className={`w-full flex items-center gap-3 rounded-[var(--radius-xl)] text-[15px] font-extrabold transition-all duration-300 group overflow-hidden ${
          collapsed ? "justify-center px-0 py-3" : "px-3 py-2.5"
        } ${
          isActive 
            ? "text-[var(--nav-active-text)] shadow-[var(--shadow-sm)]" 
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
        style={{
          backgroundColor: isActive ? 'var(--nav-active-bg)' : 'transparent',
          borderLeftWidth: isActive && !collapsed ? 'var(--nav-border-left-width, 0px)' : '0px',
          borderLeftColor: isActive ? 'var(--color-primary)' : 'transparent',
        }}
      >
        <span className={`shrink-0 relative transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`}
              style={{ color: isActive ? 'var(--nav-active-text)' : 'inherit' }}>
          {icon}
          {collapsed && badgeCount !== undefined && badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[var(--color-secondary)]"></span>
          )}
        </span>

        {!collapsed && (
          <>
            <span className="truncate whitespace-nowrap flex-1 text-left pr-4">{label}</span>
            {badgeCount !== undefined && badgeCount > 0 && (
              <span className={`shrink-0 ml-auto flex items-center justify-center font-black text-[10px] h-5 min-w-[20px] px-1.5 rounded-full shadow-sm animate-in zoom-in-50 duration-200 ${
                isActive ? 'bg-white text-[var(--color-primary)]' : 'bg-red-500 text-white shadow-red-500/10'
              }`}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </>
        )}

        {!collapsed && !isActive && (!badgeCount || badgeCount <= 0) && (
          <ChevronRight size={16} className="shrink-0 absolute right-3 opacity-0 group-hover:opacity-100 transition-all text-slate-500" />
        )}
      </button>

      {/* Tooltip shown only in collapsed (icon-only) mode */}
      {collapsed && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold whitespace-nowrap opacity-0 -translate-x-1 group-hover/navitem:opacity-100 group-hover/navitem:translate-x-0 transition-all duration-150 z-[70] shadow-lg">
          {label}
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="ml-1.5 text-red-400">({badgeCount > 99 ? '99+' : badgeCount})</span>
          )}
        </div>
      )}
    </div>
  );
}