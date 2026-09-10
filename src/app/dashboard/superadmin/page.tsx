"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  X, CreditCard, CheckCircle, Home, AlertTriangle, 
  LogOut, LayoutDashboard, History, User, ChevronRight, Folder,
  ChevronUp, ChevronDown, BarChart3, Users, Building2, Activity,
  Lock, Key, Eye, EyeOff, Edit2, CheckCircle2 // ✨ ADDED Security & Edit icons
} from "lucide-react";

// Import your tab components
import PaymentHistory from './paymenthistory';
import SuperAdminBilling from './billing';
import OrganizationDirectory from './organization';
import HistoryLog from './historylog'; 

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('home');

  // Database Data State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  
  // State for Live Global MRR
  const [liveGlobalMRR, setLiveGlobalMRR] = useState<number | null>(null);

  // Layout Modal States
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // ✨ NEW: Superadmin Profile States
  const [superadminProfile, setSuperadminProfile] = useState({ name: "System Admin", email: "" });

  // ✨ NEW: Edit Name States
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isConfirmNameModalOpen, setIsConfirmNameModalOpen] = useState(false);

  // ✨ NEW: Change Password States
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✨ NEW: Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchOrganizations();
    fetchLiveMRR(); 
    fetchProfile(); // ✨ Fetch profile on load
  }, []);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching organizations:", error);
    } else {
      setOrganizations(data || []);
    }
    setIsLoadingOrgs(false);
  };

  const fetchLiveMRR = async () => {
    const { data, error } = await supabase.from('units').select('tenant_name, status');
    
    if (!error && data) {
      let calculatedMRR = 0;
      data.forEach(unit => {
        const hasTenant = unit.tenant_name && unit.tenant_name !== '—' && unit.tenant_name !== 'Vacant' && unit.status !== 'Vacant';
        if (hasTenant) {
          calculatedMRR += 198; 
        } else {
          calculatedMRR += 99; 
        }
      });
      setLiveGlobalMRR(calculatedMRR);
    } else {
      setLiveGlobalMRR(0);
    }
  };

  // ✨ Fetch Super Admin Profile
  const fetchProfile = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const email = authData.user.email || "";
      const metadataName = authData.user.user_metadata?.name || authData.user.user_metadata?.full_name || "System Admin";
      setSuperadminProfile({ name: metadataName, email });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // ✨ Show Toast Function
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ✨ Handle Name Update Initiation
  const handleInitiateNameSave = () => {
    if (!editedName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }
    
    if (editedName.trim() === superadminProfile.name) {
      setIsEditingName(false);
      return;
    }

    setIsConfirmNameModalOpen(true);
  };

  // ✨ Actual Save Function called from Modal
  const confirmNameSave = async () => {
    setIsConfirmNameModalOpen(false);
    setIsSavingName(true);
    
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { name: editedName.trim() }
      });
      if (authError) throw authError;
      
      setSuperadminProfile(prev => ({ ...prev, name: editedName.trim() }));
      showToast("Profile name updated successfully!", "success");
      setIsEditingName(false);
    } catch (err: any) {
      console.error("Error updating profile name:", err);
      showToast(err.message || "Failed to update profile name.", "error");
    } finally {
      setIsSavingName(false);
    }
  };

  // ✨ Handle Password Change
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
        email: superadminProfile.email,
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

  const getInitials = (name: string) => {
    if (!name) return "SA";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Derived Metrics for HomeView
  const totalUnits = organizations.reduce((sum, org) => sum + (org.units_count || 0), 0);
  const displayMRR = liveGlobalMRR !== null ? liveGlobalMRR : (totalUnits * 99);

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f4f7fb] text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[#0a1e3f] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center">
            <div className="relative w-28 h-6 sm:w-32 sm:h-7">
              <Image
                src="/logos.png"
                alt="PropertyKo Logo"
                fill
                className="object-contain object-center"
                priority
              />
            </div>
          </div>
          <div className="hidden lg:block h-6 w-px bg-white/20 mx-2"></div>
          <h1 className="hidden lg:block text-sm font-bold tracking-wide text-slate-100">Super Admin Console</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <div className="bg-gradient-to-r from-blue-600 to-[#1d82f5] px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm border border-blue-400/30">
            Super Admin
          </div>
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-white/10 hover:bg-white/5 rounded-full"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PREMIUM DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0a1e3f] px-4 py-6 hidden md:flex flex-col border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.05)] z-10">
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-blue-300/70 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <NavButton 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
              icon={<Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} 
              label="Dashboard" 
            />

            <NavButton 
              active={activeTab === 'organizations'} 
              onClick={() => setActiveTab('organizations')} 
              icon={<Folder size={18} strokeWidth={activeTab === 'organizations' ? 2.5 : 2} />} 
              label="Organizations" 
            />

            <NavButton 
              active={activeTab === 'systemlogs'} 
              onClick={() => setActiveTab('systemlogs')} 
              icon={<Activity size={18} strokeWidth={activeTab === 'systemlogs' ? 2.5 : 2} />} 
              label="System Logs" 
            />
            
            <div className="mt-8 mb-4 pt-4 border-t border-white/10">
              <h3 className="px-3 text-[10px] font-black text-blue-300/70 tracking-[0.25em] uppercase">Finance & Billing</h3>
            </div>

            <NavButton 
              active={activeTab === 'billing'} 
              onClick={() => setActiveTab('billing')} 
              icon={<CreditCard size={18} strokeWidth={activeTab === 'billing' ? 2.5 : 2} />} 
              label="Organization Billing" 
            />

            <NavButton 
              active={activeTab === 'paymenthistory'} 
              onClick={() => setActiveTab('paymenthistory')} 
              icon={<History size={18} strokeWidth={activeTab === 'paymenthistory' ? 2.5 : 2} />} 
              label="Payment History" 
            />
          </nav>

          {/* Premium Bottom User Tag */}
          <div className="mt-auto pt-4 border-t border-white/10">
             <div 
               onClick={() => {
                 setIsAccountModalOpen(true);
                 setIsChangingPassword(false);
                 setPasswordError(null);
                 setShowCurrentPassword(false);
                 setShowNewPassword(false);
                 setShowConfirmPassword(false);
                 setIsEditingName(false);
               }}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-[#1e88e5] flex items-center justify-center font-bold text-xs border border-blue-500/30 shrink-0 uppercase tracking-wider">
                  {getInitials(superadminProfile.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{superadminProfile.name}</p>
                  <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">Root Account</p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 relative transition-all overflow-y-auto p-4 md:p-8 pb-[100px] md:pb-8 custom-scrollbar">
           <div className="mx-auto w-full max-w-7xl transition-all duration-300">
             {activeTab === 'home' && (
               <HomeView 
                 organizations={organizations}
                 totalUnits={totalUnits}
                 totalMRR={displayMRR} 
               />
             )}
             {activeTab === 'organizations' && (
               <OrganizationDirectory 
                 organizations={organizations}
                 isLoadingOrgs={isLoadingOrgs}
                 fetchOrganizations={fetchOrganizations}
               />
             )}
             {activeTab === 'systemlogs' && (
               <HistoryLog />
             )}
             {activeTab === 'billing' && (
               <SuperAdminBilling 
                 onNavigateToHistory={() => setActiveTab('paymenthistory')} 
               />
             )}
             {activeTab === 'paymenthistory' && <PaymentHistory />}
           </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/50 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] overflow-x-auto custom-scrollbar">
        <div className="flex justify-between items-center px-1 py-2 min-w-max w-full">
          <MobileNavItem 
            active={activeTab === 'home' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('home'); setIsAccountModalOpen(false);}} 
            icon={<LayoutDashboard size={22} />} 
            label="Dashboard" 
          />
          <MobileNavItem 
            active={activeTab === 'organizations' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('organizations'); setIsAccountModalOpen(false);}} 
            icon={<Folder size={22} />} 
            label="Orgs" 
          />
          <MobileNavItem 
            active={activeTab === 'systemlogs' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('systemlogs'); setIsAccountModalOpen(false);}} 
            icon={<Activity size={22} />} 
            label="Logs" 
          />
          <MobileNavItem 
            active={activeTab === 'billing' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('billing'); setIsAccountModalOpen(false);}} 
            icon={<CreditCard size={22} />} 
            label="Billing" 
          />
          <MobileNavItem 
            active={activeTab === 'paymenthistory' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('paymenthistory'); setIsAccountModalOpen(false);}} 
            icon={<History size={22} />} 
            label="History" 
          />
          <MobileNavItem 
            active={isAccountModalOpen} 
            onClick={() => {
              setIsAccountModalOpen(true);
              setIsChangingPassword(false);
              setPasswordError(null);
              setShowCurrentPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
              setIsEditingName(false);
            }} 
            icon={<User size={22} />} 
            label="Account" 
          />
        </div>
      </nav>

      {/* ✨ ACCOUNT / WORKSPACE MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-[#f4f7fb] rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500 border border-slate-200">
            
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 shadow-sm z-10">
              <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Super Admin Profile</h2>
              <button 
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-600 transition-colors active:scale-95"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6 custom-scrollbar pb-8 sm:pb-6">
              
              <div className="bg-gradient-to-r from-[#0a1e3f] to-[#15305c] rounded-2xl p-6 text-white flex flex-col items-center text-center gap-3 relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/20 text-[#1e88e5] flex items-center justify-center font-black text-2xl sm:text-3xl border border-blue-500/30 shadow-inner z-10 tracking-widest uppercase">
                  {getInitials(superadminProfile.name)}
                </div>
                
                <div className="z-10 min-w-0 flex-1 text-white">
                  <h3 className="font-black text-lg sm:text-2xl tracking-tight break-words leading-tight">{superadminProfile.name}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-blue-200 mt-1 tracking-widest uppercase">Root Account</p>
                </div>
              </div>

              {/* Account Details Box */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4 sm:space-y-5">
                <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-3 border-b border-slate-100">
                  Account Details
                </h4>
                
                <div className="space-y-4 sm:space-y-5">
                  {/* --- FULL NAME SECTION --- */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5 sm:mb-1">
                      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block">Full Name</label>
                      {!isEditingName ? (
                        <button 
                          onClick={() => {
                            setEditedName(superadminProfile.name);
                            setIsEditingName(true);
                          }}
                          className="text-blue-600 text-[10px] font-bold hover:underline flex items-center gap-1 transition-colors"
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                      ) : (
                        <div className="flex gap-3 items-center">
                          <button 
                            onClick={() => setIsEditingName(false)}
                            className="text-slate-400 hover:text-slate-600 text-[10px] font-bold transition-colors"
                            disabled={isSavingName}
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleInitiateNameSave}
                            className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold flex items-center gap-1 transition-colors"
                            disabled={isSavingName}
                          >
                            {isSavingName ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditingName ? (
                      <p className="text-sm sm:text-[15px] font-extrabold text-slate-800 tracking-tight break-words px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                        {superadminProfile.name}
                      </p>
                    ) : (
                      <div className="relative animate-in fade-in duration-200">
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm sm:text-[15px] font-extrabold text-slate-700 bg-white transition-all shadow-sm"
                          disabled={isSavingName}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleInitiateNameSave();
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Email Address */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email Address</label>
                    <div className="w-full">
                      <p className="text-xs sm:text-sm font-bold text-slate-600 break-all bg-slate-50 py-2 px-3 rounded-[var(--radius-md)] inline-block border border-slate-100 leading-normal">
                        {superadminProfile.email || "Not available"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Access Role */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 sm:mb-2">Platform Privilege</label>
                    <span className="inline-flex text-[10px] sm:text-[11px] font-black text-purple-600 bg-purple-50 border border-purple-200/60 px-2.5 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] tracking-widest uppercase shadow-sm">
                      Super Admin
                    </span>
                  </div>
                </div>
              </div>

              {/* --- Change Password Box --- */}
              <div className="bg-white rounded-[1.5rem] sm:rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Security
                  </h4>
                  {!isChangingPassword && (
                    <button 
                      onClick={() => setIsChangingPassword(true)}
                      className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 transition-colors"
                    >
                      <Key size={14} /> Change Password
                    </button>
                  )}
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl border border-red-100 flex items-center gap-2">
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
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
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
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
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
                          className="w-full px-4 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all shadow-sm" 
                          disabled={isSubmittingPassword} 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
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
                        className="flex-1 py-3 rounded-xl font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors text-xs shadow-sm active:scale-95 border border-transparent"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingPassword}
                        className="flex-1 py-3 rounded-xl font-black text-white bg-blue-600 hover:opacity-90 transition-all shadow-md text-xs flex items-center justify-center gap-2 active:scale-95 border border-transparent"
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

      {/* ✨ CONFIRM NAME CHANGE MODAL */}
      {isConfirmNameModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-500 border border-slate-200">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-emerald-500 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 border-4 border-emerald-50/50 shadow-inner">
              <User size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2 tracking-tight">Confirm Name Change</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              Are you sure you want to change your profile name to <strong className="text-slate-800 font-black">"{editedName.trim()}"</strong>?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfirmNameModalOpen(false)} 
                className="flex-1 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-all border border-transparent active:scale-[0.96]"
                disabled={isSavingName}
              >
                Cancel
              </button>
              <button 
                onClick={confirmNameSave} 
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-black transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.96] flex justify-center items-center"
                disabled={isSavingName}
              >
                {isSavingName ? <span className="animate-pulse">Updating...</span> : "Yes, Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border-4 border-red-50/50">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight">Sign Out</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">Are you sure you want to log out of the superadmin console?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 px-4 py-3.5 text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-95"
              >Cancel</button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 text-white px-4 py-3.5 rounded-xl text-sm font-black shadow-lg shadow-red-500/20 active:scale-95"
              >Confirm Logout</button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ TOAST UI */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[120] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl font-semibold text-sm transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 border bg-white ${toast.type === "success" ? "border-l-4 border-l-emerald-500 text-slate-800" : "border-l-4 border-l-red-500 text-slate-800"}`}>
          {toast.type === "success" ? <CheckCircle2 className="text-emerald-500" size={22} /> : <AlertTriangle className="text-red-500" size={22} />}
          {toast.message}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// COMPONENTS
// -------------------------------------------------------------------------------------------------

function HomeView({ organizations, totalUnits, totalMRR }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm sm:text-base font-medium">Monitor ecosystem health and manage client tenants.</p>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="ACTIVE ORGS" 
          value={organizations?.length?.toString() || "0"} 
          subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronUp size={14} strokeWidth={3} /> Active accounts</span>} 
          icon={Building2}
        />
        <StatCard 
          title="UNITS MANAGED" 
          value={(totalUnits || 0).toLocaleString()} 
          subtext={<span className="text-[#359b46] font-medium">System-wide ecosystem</span>} 
          icon={Home}
        />
        <StatCard 
          title="PLATFORM MRR" 
          value={`₱${(totalMRR || 0).toLocaleString()}`} 
          subtext={<span className="text-[#359b46] font-medium">Dynamic Rate (₱99/₱198)</span>} 
          icon={BarChart3}
        />
        <StatCard 
          title="GLOBAL CHURN" 
          value="0.0%" 
          subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronDown size={14} strokeWidth={3} /> Exceptionally healthy</span>} 
          icon={Users}
        />
      </div>

      {/* Bottom Cards: Platform Health & Feature Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6 sm:p-8">
          <h3 className="font-extrabold text-lg text-[#0a1e3f] mb-6 flex items-center gap-2">
            <CheckCircle className="text-emerald-500" size={20} />
            Platform Health
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Payment gateway (GCash)</span>
              <StatusBadge text="Operational" color="green" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">QR Ph settlement</span>
              <StatusBadge text="Operational" color="green" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6 sm:p-8">
          <h3 className="font-extrabold text-lg text-[#0a1e3f] mb-6 flex items-center gap-2">
            <LayoutDashboard className="text-[#1d82f5]" size={20} />
            Global Feature Flags
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Auto-accept tenants</span>
              <span className="text-xs font-bold text-slate-500">Enabled Globally</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Asset monetization beta</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">3 Orgs Testing</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-slate-700">Owner e-statements</span>
              <span className="text-xs font-bold text-slate-500">Enabled Globally</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}

function StatCard({ title, value, subtext, icon: Icon }: { title: string, value: string, subtext: React.ReactNode, icon: any }) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex flex-col justify-between h-40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-60 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        {Icon && <Icon size={120} strokeWidth={1} />}
      </div>
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs font-black text-slate-400 tracking-widest uppercase">{title}</div>
          {Icon && <Icon size={18} className="text-slate-300" />}
        </div>
        <div className="text-3xl sm:text-4xl font-black text-[#0a1e3f] mb-2 tracking-tight">{value}</div>
        <div className="text-xs font-semibold">{subtext}</div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
        active ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`transition-transform duration-300 ${active ? 'text-[#1e88e5] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
          {icon}
        </div>
        <span className="tracking-wide">{label}</span>
      </div>
      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#1e88e5] rounded-r-full shadow-[0_0_10px_#1e88e5]" />}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label, badge }: any) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center px-2 py-1 flex-1 h-14 transition-colors shrink-0">
      {active && <span className="absolute inset-1.5 bg-blue-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
      <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${active ? 'text-[#1e88e5] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className="relative">{icon}</div>
        <span className="text-[9px] font-black mt-0.5 uppercase tracking-tight">{label}</span>
      </div>
    </button>
  );
}

function StatusBadge({ text, color }: { text: string, color: 'green' | 'red' | 'orange' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    red: 'bg-red-50 text-red-700 border-red-200/60',
    orange: 'bg-amber-50 text-amber-700 border-amber-200/60',
    blue: 'bg-blue-50 text-[#1d82f5] border-blue-200/60',
  };
  return <span className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-widest border shadow-sm ${colors[color]}`}>{text}</span>;
}