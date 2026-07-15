"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  LayoutDashboard, Box, Home, Wrench, CreditCard, BarChart3, 
  Ticket, AlertTriangle, Menu, X, Users, Bell, CheckCheck, Trash2, 
  Upload, Building, CheckCircle2, User
} from "lucide-react";

// Import all split components
import DashboardTab from "./dashboard";
import PropertiesAndUnitsTab from "./propertiesandunits";
import LeasingAndTenantsTab from "./leasingandtenants";
import MaintenanceTab from "./maintenance";
import BillingTab from "./billing";
import KPIReportsTab from "./kpireports";
import ViewTicketTab from "./viewticket";
import UsersTab from "./user"; 

export default function ManagerDashboard() {
  const router = useRouter();
  
  // Navigation & Modal States
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ✨ Workspace Info Modal & White Label States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  // ✨ Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Database States for the logged-in Organization
  const [orgData, setOrgData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // TICKETS & MAINTENANCE HIGHLIGHT STATE
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

  // Fetch the logged-in user and their parent organization data
  useEffect(() => {
    const fetchOrgData = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        
        if (authData?.user) {
          const adminParentEmail = authData.user.user_metadata?.admin_parent || authData.user.email;

          // Note: select('*') ensures we get ALL columns from the table
          const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('admin_email', adminParentEmail)
            .single();
            
          if (data) {
            setOrgData(data);
          }
        }
      } catch (err) {
        console.error("Error fetching org data:", err);
      }
      setIsLoading(false);
    };

    fetchOrgData();
  }, []);

  // FETCH NOTIFICATIONS & SETUP REAL-TIME LISTENER
  useEffect(() => {
    const fetchNotifications = async () => {
      if (orgData?.admin_email) {
        const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .eq('recipient', 'MANAGER') 
        .eq('is_hidden', false) 
        .order('created_at', { ascending: false })
        .limit(15);

        if (!error && data) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.is_read).length);
        }
      }
    };

    fetchNotifications();

    if (orgData?.admin_email) {
      const realtimeChannel = supabase
        .channel('manager-live-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient=eq.MANAGER` 
          },
          (payload) => {
            if (payload.new.admin_email === orgData.admin_email) {
              setNotifications((currentNotifs) => [payload.new, ...currentNotifs]);
              setUnreadCount((currentCount) => currentCount + 1);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(realtimeChannel);
      };
    }
  }, [orgData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ✨ Handle Tab Changes with Ticket/Maintenance Highlights
  const handleTabChange = (tabName: string, highlightId: string | null = null) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false); 
    if (highlightId) {
      setHighlightTicketId(highlightId);
    } else if (tabName !== "Tickets" && tabName !== "Maintenance") {
      setHighlightTicketId(null);
    }
  };

  // ✨ Helper to trigger the toast
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto close after 3 seconds
  };

  // Logo Upload Handler
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !orgData?.id) return;

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${orgData.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);
      const newLogoUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: newLogoUrl })
        .eq('id', orgData.id);

      if (updateError) throw updateError;

      setOrgData((prev: any) => ({ ...prev, logo_url: newLogoUrl }));
      showToast("Logo updated successfully!", "success");
    } catch (error) {
      console.error("Error uploading logo:", error);
      showToast("Failed to upload logo. Please try again.", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const markAllAsRead = async () => {
    if (!orgData?.admin_email) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('admin_email', orgData.admin_email)
    .eq('recipient', 'MANAGER') 
    .eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!orgData?.admin_email) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase
    .from('notifications')
    .update({ is_hidden: true }) 
    .eq('admin_email', orgData.admin_email)
    .eq('recipient', 'MANAGER');
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => 
        n.id === notif.id ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }

    setIsNotifOpen(false);

    const type = notif.type?.toUpperCase() || '';
    if (type === 'BILLING' || type === 'SOA') handleTabChange("Billing");
    else if (type === 'TICKET' || type === 'MAINTENANCE') {
      if (notif.reference_id) setHighlightTicketId(`${notif.reference_id}_${Date.now()}`);
      handleTabChange("Tickets"); 
    } else handleTabChange("Dashboard");
  };

  // Helper function to format database column names (e.g. 'contact_number' -> 'Contact Number')
  const formatColumnName = (key: string) => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Global Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="sm:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors mr-1"
          >
            <Menu size={20} />
          </button>

          {/* ✨ ALWAYS VISIBLE PROFILE ICON ✨ */}
          <button 
            onClick={() => setIsWorkspaceModalOpen(true)}
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-full transition-colors border border-white/10 shadow-sm"
            title="Organization Profile"
          >
            <User size={16} />
          </button>

          {/* Only render logo box if an uploaded logo URL exists */}
          {orgData?.logo_url && (
            <div 
              className="inline-block bg-white p-1.5 rounded-lg shadow-sm cursor-pointer hover:ring-2 hover:ring-[#359b46] transition-all"
              onClick={() => setIsWorkspaceModalOpen(true)}
              title="Organization Profile"
            >
              <div className="relative w-24 sm:w-28 h-8 sm:h-8 flex items-center justify-center">
                <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm relative">
          
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
              <div className="absolute top-12 right-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col text-slate-800">
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
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${notif.type === 'TICKET' || notif.type === 'MAINTENANCE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
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

          <div className="hidden sm:block px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-[#359b46] bg-[#2c813a]">
            Manager Portal
          </div>
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-[#0a1e3f]/50 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        <aside 
          className={`absolute sm:static inset-y-0 left-0 z-50 w-64 bg-[#0a1e3f] text-slate-300 flex flex-col shrink-0 overflow-y-auto border-t border-white/5 transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
          }`}
        >
          <div className="sm:hidden flex items-center justify-between p-4 border-b border-white/10">
            <span className="font-bold text-white text-sm">Menu</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:mt-2">
            <div 
              onClick={() => setIsWorkspaceModalOpen(true)}
              className="bg-[#122955] rounded-xl p-3 border border-[#1e3a63] shadow-inner cursor-pointer hover:bg-[#1a3a78] transition-all group"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Workspace</div>
                <Building size={12} className="text-slate-400 group-hover:text-white transition-colors" />
              </div>
              <div className="font-bold text-white text-sm flex items-center gap-2 truncate" title={orgData?.org_name}>
                {isLoading ? "Loading..." : orgData?.org_name || "Setup Required"} 
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-normal text-emerald-100 bg-[#359b46] px-1.5 py-0.5 rounded shadow-sm">
                  Property Manager
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-1 mb-6">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" isActive={activeTab === "Dashboard"} onClick={() => handleTabChange("Dashboard")} />
            <NavItem icon={<Box size={18} />} label="Properties & units" isActive={activeTab === "Properties"} onClick={() => handleTabChange("Properties")} />
            <NavItem icon={<Home size={18} />} label="Leasing & tenants" isActive={activeTab === "Leasing"} onClick={() => handleTabChange("Leasing")} />
            <NavItem icon={<Wrench size={18} />} label="Maintenance & repairs" isActive={activeTab === "Maintenance"} onClick={() => handleTabChange("Maintenance")} />
            <NavItem icon={<CreditCard size={18} />} label="Billing & payments" isActive={activeTab === "Billing"} onClick={() => handleTabChange("Billing")} />
            <NavItem icon={<BarChart3 size={18} />} label="KPI reports" isActive={activeTab === "KPI"} onClick={() => handleTabChange("KPI")} />
            <NavItem icon={<Ticket size={18} />} label="View tickets" isActive={activeTab === "Tickets"} onClick={() => handleTabChange("Tickets")} />
            <NavItem icon={<Users size={18} />} label="Accounts" isActive={activeTab === "Users"} onClick={() => handleTabChange("Users")} />
          </nav>
        </aside>

        <main className="flex-1 bg-[#f8fafc] overflow-y-auto p-4 sm:p-6 lg:p-10 w-full">
          {activeTab === "Dashboard" && <DashboardTab orgData={orgData} isLoading={isLoading} onNavigate={handleTabChange} />}
          {activeTab === "Properties" && <PropertiesAndUnitsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Leasing" && <LeasingAndTenantsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Maintenance" && <MaintenanceTab orgData={orgData} isLoading={isLoading} highlightTicketId={highlightTicketId} />}
          {activeTab === "Billing" && <BillingTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "KPI" && <KPIReportsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Tickets" && <ViewTicketTab orgData={orgData} isLoading={isLoading} highlightTicketId={highlightTicketId} onNavigate={handleTabChange} />}
          {activeTab === "Users" && <UsersTab orgData={orgData} isLoading={isLoading} />}
        </main>
      </div>

      {/* ✨ PROFESSIONAL WORKSPACE INFO MODAL */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Organization Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="overflow-y-auto bg-slate-50/50">
              
              {/* Banner & Logo Section */}
              <div className="bg-gradient-to-r from-[#0a1e3f] to-[#122955] px-6 py-8 flex flex-col sm:flex-row items-center sm:items-end gap-6 relative">
                <div className="relative group w-28 h-28 shrink-0">
                  <div className="w-full h-full rounded-2xl border-4 border-white bg-white flex items-center justify-center overflow-hidden relative shadow-lg">
                    {orgData?.logo_url ? (
                      <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain p-2" />
                    ) : (
                      <Building size={40} className="text-slate-300" />
                    )}
                    
                    {/* Hover Upload Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[2px]">
                      <label className="cursor-pointer text-white flex flex-col items-center gap-1 w-full h-full justify-center">
                        <Upload size={20} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Change Logo</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                        />
                      </label>
                    </div>
                  </div>
                  {isUploadingLogo && (
                    <div className="absolute -bottom-6 left-0 right-0 text-center">
                      <p className="text-[10px] text-blue-200 animate-pulse font-medium">Uploading...</p>
                    </div>
                  )}
                </div>
                
                <div className="text-center sm:text-left text-white pb-2 flex-1">
                  <h3 className="text-2xl font-bold mb-1 truncate" title={orgData?.org_name}>
                    {orgData?.org_name || "Organization Name"}
                  </h3>
                  <p className="text-blue-200 text-sm flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#359b46] shadow-[0_0_8px_rgba(53,155,70,0.8)]"></span>
                    Active Workspace
                  </p>
                </div>
              </div>

              {/* Dynamic Database Fields Map */}
              <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                  <h4 className="text-sm font-bold text-slate-800 mb-5 pb-2 border-b border-slate-50">
                    Business Details
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    {orgData ? (
                      Object.entries(orgData).map(([key, value]) => {
                        // Exclude org_name since it's now in the header banner
                        const excludedFields = ['id', 'logo_url', 'password', 'created_at', 'updated_at', 'org_name'];
                        if (excludedFields.includes(key)) return null;

                        // Smart check to make wide fields (like addresses) span both columns
                        const isFullWidth = key.toLowerCase().includes('address') || key.toLowerCase().includes('description');

                        return (
                          <div key={key} className={`flex flex-col ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              {formatColumnName(key)}
                            </label>
                            <p className={`text-sm font-medium ${value ? 'text-slate-800' : 'text-slate-400 italic'} break-words`}>
                              {value !== null && value !== '' ? String(value) : "Not provided"}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-1 sm:col-span-2 text-center text-slate-400 text-sm py-8">
                        <div className="animate-pulse flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
                          Loading organization details...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
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
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your workspace?</p>
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

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all ${
        isActive 
          ? "bg-[#359b46] text-white shadow-sm" 
          : "text-slate-400 hover:bg-[#122955] hover:text-slate-200"
      }`}
    >
      <span className={isActive ? "text-white" : "text-slate-400"}>{icon}</span>
      {label}
    </button>
  );
}