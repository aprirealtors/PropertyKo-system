"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { 
  Search, X, UserPlus, Shield, CreditCard, Mail, Lock, Home, Users, ArrowRight, 
  CheckCircle, Receipt, AlertCircle, Palette, DownloadCloud, RotateCcw, Settings
} from "lucide-react";

// Helper function to calculate the actual upcoming date based on the declared billing day
const calculateNextBillingDate = (billingDay: number | undefined | null) => {
  if (!billingDay) return "Not Set";

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let targetDate = new Date(currentYear, currentMonth, billingDay);

  if (today.getDate() > billingDay) {
    targetDate = new Date(currentYear, currentMonth + 1, billingDay);
  }

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ✨ CONSTANT: PropertyKo Default Theme (Fallback)
const defaultTheme = {
  primaryColor: "#359b46",
  secondaryColor: "#0a1e3f",
  backgroundColor: "#f8fafc",
  textColor: "#334155",
  borderColor: "#e2e8f0",
  borderRadius: "0.5rem",
  fontFamily: "Inter",
  enableShadows: true
};

export default function TeamTab({ orgData, isLoading: isOrgLoading, actionIntent }: any) {
  
  // Database States
  const [team, setTeam] = useState<any[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [liveMRR, setLiveMRR] = useState<number | null>(null);
  
  // Per-Asset Billing States
  const [currentPlan, setCurrentPlan] = useState(orgData?.plan || "Dynamic Rate");
  const [seatLimit, setSeatLimit] = useState(orgData?.users_count || 1);
  const [unitLimit, setUnitLimit] = useState(orgData?.units_count || 0);

  // THEME BUILDER STATES
  const [customTheme, setCustomTheme] = useState(defaultTheme);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✨ Catch "open_billing" intention passed down from notifications
  useEffect(() => {
    if (actionIntent === "open_billing") {
      setIsBillingModalOpen(true);
    }
  }, [actionIntent]);

  // Theme Action Confirmation Modal States
  const [themeConfirmModal, setThemeConfirmModal] = useState<{
    isOpen: boolean;
    type: 'load' | 'reset' | 'apply' | null;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: string;
  }>({
    isOpen: false,
    type: null,
    title: "",
    message: "",
    confirmText: "",
    confirmStyle: ""
  });

  // Payment UI States (Digital Wallet Only)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('Digital Wallet');
  const [referenceNumber, setReferenceNumber] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false); 

  // Add User Form States
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState("Property manager");
  const [memberAccess, setMemberAccess] = useState("All properties");

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTeam();
      setCurrentPlan(orgData.plan || "Dynamic Rate");
      setSeatLimit(orgData.users_count || 1);
      setUnitLimit(orgData.units_count || 0);

      if (orgData.theme_config) {
        setCustomTheme({ ...defaultTheme, ...orgData.theme_config });
      }

      const fetchLiveMRR = async () => {
        const { data, error } = await supabase
          .from('units')
          .select('tenant_name, status')
          .eq('admin_email', orgData.admin_email);
          
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
          setLiveMRR(calculatedMRR);
        }
      };
      
      fetchLiveMRR();
    }
  }, [orgData]);

  const fetchTeam = async () => {
    setIsLoadingTeam(true);
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching team:", error);
    } else {
      const filteredTeam = (data || []).filter(member => {
        const role = String(member.role).toLowerCase();
        return !role.includes('owner') && !role.includes('tenant');
      });
      setTeam(filteredTeam);
    }
    setIsLoadingTeam(false);
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateDatabaseTheme = async (payload: any, presetStatus: string) => {
    setIsSavingTheme(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ theme_config: payload, theme_preset: presetStatus })
        .eq('admin_email', orgData.admin_email);

      if (error) throw error;
      showToast("Theme successfully updated! Reloading layout...", "success");
      setTimeout(() => window.location.reload(), 1500); 
    } catch (err: any) {
      showToast(err.message || "Failed to update theme.", "error");
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleApplyCustomTheme = () => updateDatabaseTheme(customTheme, 'custom');
  
  const handleLoadStrictSpec = () => {
    if (!orgData?.master_theme) {
      showToast("No Corporate Spec has been set by the platform admin yet.", "error");
      return;
    }
    updateDatabaseTheme(orgData.master_theme, 'strict');
  };

  const handleResetDefault = () => updateDatabaseTheme(defaultTheme, 'default');

  const executeThemeAction = () => {
    if (themeConfirmModal.type === 'load') handleLoadStrictSpec();
    if (themeConfirmModal.type === 'reset') handleResetDefault();
    if (themeConfirmModal.type === 'apply') handleApplyCustomTheme();
    setThemeConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    if (team.length + 1 >= seatLimit) {
      setErrorMsg(`You have reached your workspace limit of ${seatLimit} seats. Please contact support to increase your capacity.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: memberEmail,
        password: memberPassword,
        options: {
          data: {
            org_name: orgData.org_name,
            role: memberRole === "Property manager" ? "property_manager" : "staff",
            admin_parent: orgData.admin_email
          }
        }
      });

      if (authError && !authError.message.includes("Error sending confirmation email")) {
        throw new Error(`Auth Registration Error: ${authError.message}`);
      }

      const { error: dbError } = await supabase
        .from('team_members')
        .insert([
          { 
            admin_email: orgData.admin_email,
            name: memberName.trim(),
            email: memberEmail,
            role: memberRole,
            access_level: memberAccess,
            status: 'Active' 
          }
        ]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      await fetchTeam();
      setIsInviteModalOpen(false);
      
      setMemberName("");
      setMemberEmail("");
      setMemberPassword("");
      setMemberAccess("All properties");
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentClick = () => {
    setIsBillingModalOpen(false); 
    setIsPaymentModalOpen(true);  
    setPaymentSuccess(false);     
    setReferenceNumber("");       
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ 
          payment_method: paymentMethod,
          payment_reference: referenceNumber
        })
        .eq('admin_email', orgData.admin_email);

      if (updateError) throw updateError;
      setPaymentSuccess(true);
    } catch (error) {
      console.error("Error processing payment submission:", error);
      alert("There was an error submitting your payment. Please try again.");
    } finally {
      setIsSimulating(false);
    }
  };

  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";

  const seatsUsed = team.length + 1; 
  const seatPercentage = (seatsUsed / seatLimit) * 100;
  const monthlyCost = liveMRR !== null ? liveMRR : (unitLimit * 99);
  const nextBillingDateFormatted = calculateNextBillingDate(orgData?.billing_day);
  const billingStatus = orgData?.billing_status || 'Pending'; 

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'late': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  const filteredTeam = team.filter((member) => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      (member.name && member.name.toLowerCase().includes(lowerQ)) ||
      (member.role && member.role.toLowerCase().includes(lowerQ)) ||
      (member.access_level && member.access_level.toLowerCase().includes(lowerQ))
    );
  });

  return (
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Responsive up to xl */}
      <div className="shrink-0 mb-6 px-4 sm:px-0">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white/80 p-4 sm:p-5 lg:px-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">

          <div className="w-full xl:w-auto min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-white rounded-xl border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                <Settings className="text-[var(--color-text)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <span className="truncate" title="Team & Settings">Team & Settings</span>
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex flex-wrap items-center gap-2">
              <span className="truncate" title="Manage workspace access, billing, and branding">Manage workspace access, billing, and branding</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-start xl:justify-end w-full xl:w-auto gap-3 sm:gap-4 border-t xl:border-t-0 border-slate-100 pt-4 xl:pt-0 mt-2 xl:mt-0">
            
            <div className="relative w-full sm:w-64 lg:w-72 group shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors z-10 pointer-events-none w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search members..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-11 pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white/60 focus:bg-white transition-all shadow-sm"
              />
            </div>

            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
              <div className="hidden sm:flex items-center justify-center gap-2 sm:gap-3 bg-white px-3 sm:px-3.5 py-1.5 rounded-xl shadow-sm border border-slate-100 flex-1 sm:flex-none">
                <span className="text-[10px] sm:text-xs font-black text-[var(--color-text)] uppercase tracking-wider truncate" title="Admin">Admin</span>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs sm:text-sm shadow-sm shrink-0">
                  {initials}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 🌟 FULL WORKSPACE (SKELETON OR ACTUAL) */}
      {isLoadingTeam || isOrgLoading ? (
        <TeamTabSkeleton />
      ) : (
        <div className="flex-1 w-full min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden px-4 sm:px-0 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full lg:h-full flex flex-col lg:flex-row gap-4">
            
            {/* TEAM TABLE - Left Column */}
            <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col h-[500px] lg:h-full flex-none lg:overflow-hidden shrink-0">
              <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] flex flex-col h-full relative overflow-hidden">
                
                <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)]/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white text-[var(--color-text)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                      <Users size={16} strokeWidth={2.5} />
                    </div>
                    <h3 className="font-extrabold text-[var(--color-text)] text-base sm:text-lg tracking-tight truncate" title="Access Control">Access Control</h3>
                  </div>
                  <button 
                    onClick={() => setIsInviteModalOpen(true)}
                    className="bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-bold transition-all shadow-[var(--shadow-sm)] active:scale-95 flex items-center gap-2 border border-transparent shrink-0"
                    title="Add User"
                  >
                    <UserPlus size={16} strokeWidth={2.5} /> <span className="hidden sm:inline truncate">Add User</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-auto relative bg-white">
                  <table className="w-full text-left text-sm min-w-[500px] sm:min-w-[600px] border-collapse">
                    <thead className="bg-[var(--color-bg)]/80 text-slate-500 font-black text-[10px] sm:text-[11px] uppercase tracking-widest border-b border-[var(--color-border)] sticky top-0 backdrop-blur-md z-10">
                      <tr>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4 whitespace-nowrap">Member Name</th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4 whitespace-nowrap">Role</th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4 whitespace-nowrap">Access Scope</th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-right whitespace-nowrap">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)]">
                      <tr className="bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10 transition-colors">
                        <td className="px-4 sm:px-6 py-4 font-black text-[var(--color-text)] flex items-center gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] sm:text-[12px] font-black shadow-sm shrink-0">
                            {initials}
                          </div>
                          <span className="truncate max-w-[120px] sm:max-w-[200px]" title="You">You</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <span className="bg-slate-200 text-slate-800 border border-[var(--color-primary)]/20 font-black text-[9px] sm:text-[10px] px-2.5 py-1 rounded-[var(--radius-sm)] uppercase tracking-wider shadow-sm truncate block w-fit" title="Admin">Admin</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-slate-800 font-semibold truncate max-w-[120px] sm:max-w-[180px]" title="Full Platform Access">Full Platform Access</td>
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <span className="bg-emerald-100 text-emerald-700 font-black text-[9px] sm:text-[10px] px-2.5 py-1 rounded-[var(--radius-sm)] uppercase tracking-widest shadow-sm truncate" title="Active">Active</span>
                        </td>
                      </tr>
                      
                      {team.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[11px] font-bold text-slate-400">
                            No additional team members added.
                          </td>
                        </tr>
                      ) : filteredTeam.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-[11px] font-bold text-slate-400">
                            No members match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredTeam.map(member => {
                          const memberInitials = member.name 
                            ? member.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                            : "US";

                          return (
                            <tr key={member.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-4 sm:px-6 py-4 font-bold text-[var(--color-text)] flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] sm:text-[10px] font-extrabold border border-slate-200 group-hover:bg-white transition-colors shrink-0">
                                  {memberInitials}
                                </div>
                                <span className="truncate max-w-[120px] sm:max-w-[200px]" title={member.name}>{member.name}</span>
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="bg-slate-50 text-slate-600 font-bold text-[9px] sm:text-[10px] px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] uppercase tracking-wider group-hover:bg-white transition-colors shadow-sm block w-fit">
                                  {member.role}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-slate-500 font-medium truncate max-w-[120px] sm:max-w-[180px]" title={member.access_level}>{member.access_level}</td>
                              <td className="px-4 sm:px-6 py-4 text-right">
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-black text-[8px] sm:text-[9px] px-2.5 py-1 rounded-[var(--radius-sm)] uppercase tracking-widest shadow-sm">
                                  {member.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="shrink-0 p-3 sm:p-4 bg-[var(--color-primary)]/5 border-t border-[var(--color-border)] text-[10px] sm:text-[11px] text-slate-500 font-semibold leading-relaxed flex items-center gap-2 z-10">
                  <Shield size={14} className="text-[var(--color-text)] shrink-0" strokeWidth={2.5} />
                  <span className="truncate" title="Strict Role-Based Access Control (RBAC) enforced at the system layer.">Strict Role-Based Access Control (RBAC) enforced at the system layer.</span>
                </div>
              </div>
            </div>

            {/* SUBSCRIPTION & THEME PANEL - Right Column */}
            <div className="w-full lg:w-[45%] xl:w-[35%] flex flex-col lg:h-full lg:overflow-y-auto custom-scrollbar gap-6 pb-6 lg:pr-2 shrink-0">
              
              {/* Subscription Box */}
              <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6 lg:p-8 flex flex-col relative group shrink-0">
                
                <div className="flex items-center gap-3 mb-5 sm:mb-6 relative z-10 shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-[var(--color-text)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0">
                    <CreditCard size={18} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-extrabold text-[var(--color-text)] text-lg sm:text-xl tracking-tight truncate" title="Subscription">Subscription</h3>
                </div>
                
                <div className="mb-6 sm:mb-8 relative z-10 bg-slate-50 rounded-[var(--radius-lg)] p-4 sm:p-5 border border-[var(--color-border)] shadow-[var(--shadow-inner)] shrink-0">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1 truncate" title="Current Plan">Current Plan</span>
                  <h4 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight mb-1 truncate" title="Dynamic Rate">Dynamic Rate</h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-2 truncate" title="₱99 Owner | ₱198 Tenanted · Updates dynamically">₱99 Owner | ₱198 Tenanted · Updates dynamically</p>
                </div>
                
                <div className="space-y-5 sm:space-y-6 mb-6 sm:mb-8 relative z-10">
                  <div>
                    <div className="flex justify-between text-[11px] sm:text-xs mb-2 font-bold">
                      <span className="text-slate-500 truncate" title="Team Seats Used">Team Seats Used</span>
                      <span className="text-[var(--color-secondary)] shrink-0 pl-2">{seatsUsed} / {seatLimit}</span>
                    </div>
                    <div className="h-2.5 sm:h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-[var(--shadow-inner)]">
                      <div className={`h-full transition-all duration-1000 ${seatPercentage >= 100 ? 'bg-red-500' : 'bg-[var(--color-secondary)]'}`} style={{ width: `${Math.min(seatPercentage, 100)}%` }}></div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-3 sm:py-4 border-b border-dashed border-[var(--color-border)]">
                    <span className="text-[11px] sm:text-xs text-slate-500 font-bold truncate" title="Units Capacity">Units Capacity</span>
                    <span className="font-black text-[var(--color-text)] bg-[var(--color-primary)]/10 px-2.5 sm:px-3 py-1 rounded-lg border border-[var(--color-primary)]/20 shadow-sm text-[11px] sm:text-xs shrink-0 whitespace-nowrap" title={`${unitLimit} units`}>
                      {unitLimit} units
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[11px] sm:text-xs text-slate-500 font-bold truncate" title="Next Invoice">Next Invoice</span>
                    <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                      <span className="font-black text-[var(--color-text)] text-xs sm:text-sm" title={nextBillingDateFormatted}>{nextBillingDateFormatted}</span>
                      <span className={`px-2 py-0.5 rounded-[var(--radius-sm)] border text-[8px] sm:text-[9px] font-black uppercase tracking-widest shadow-sm truncate ${getStatusColor(billingStatus)}`} title={billingStatus}>
                        {billingStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 relative z-10 shrink-0">
                  <button 
                    onClick={() => setIsBillingModalOpen(true)}
                    className="w-full bg-[var(--color-secondary)] hover:opacity-90 text-white font-black uppercase tracking-widest text-[10px] sm:text-[11px] py-3.5 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95 flex justify-center items-center gap-2 border border-transparent"
                  >
                    <Receipt size={16} strokeWidth={2.5} className="shrink-0" /> <span className="truncate">View Billing Details</span>
                  </button>
                </div>
              </div>

              {/* THEME BUILDER PANEL */}
              <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-6 lg:p-8 flex flex-col relative shrink-0">
                <div className="flex items-center gap-3 mb-5 sm:mb-6 relative z-10 shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100 shadow-sm shrink-0">
                    <Palette size={18} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-[var(--color-text)] text-lg tracking-tight truncate" title="Theme Builder">Theme Builder</h3>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate" title="Customize workspace branding">Customize workspace branding</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-[var(--radius-md)] border border-slate-200 overflow-hidden shrink-0 shadow-sm group">
                        <input type="color" value={customTheme.primaryColor} onChange={(e) => setCustomTheme({ ...customTheme, primaryColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" title="Select Primary Color" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 truncate" title="Primary Color (Buttons & Active States)">Primary Color (Buttons & Active States)</label>
                        <input type="text" value={customTheme.primaryColor.toUpperCase()} onChange={(e) => setCustomTheme({ ...customTheme, primaryColor: e.target.value })} className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-[var(--radius-md)] text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 uppercase transition-all" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-[var(--radius-md)] border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                        <input type="color" value={customTheme.secondaryColor} onChange={(e) => setCustomTheme({ ...customTheme, secondaryColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" title="Select Secondary Color" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 truncate" title="Secondary Color (Sidebar & Headers)">Secondary Color (Sidebar & Headers)</label>
                        <input type="text" value={customTheme.secondaryColor.toUpperCase()} onChange={(e) => setCustomTheme({ ...customTheme, secondaryColor: e.target.value })} className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-[var(--radius-md)] text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 uppercase transition-all" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-[var(--radius-md)] border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                        <input type="color" value={customTheme.backgroundColor} onChange={(e) => setCustomTheme({ ...customTheme, backgroundColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" title="Select Background Color" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 truncate" title="App Canvas Color (Background)">App Canvas Color (Background)</label>
                        <input type="text" value={customTheme.backgroundColor.toUpperCase()} onChange={(e) => setCustomTheme({ ...customTheme, backgroundColor: e.target.value })} className="w-full px-3 py-1.5 sm:py-2 border border-slate-200 rounded-[var(--radius-md)] text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 uppercase transition-all" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                          <input type="color" value={customTheme.textColor} onChange={(e) => setCustomTheme({ ...customTheme, textColor: e.target.value })} className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer" title="Select Text Color" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-tight truncate" title="Text Color">Text Color</label>
                          <input type="text" value={customTheme.textColor.toUpperCase()} onChange={(e) => setCustomTheme({ ...customTheme, textColor: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-[var(--radius-sm)] text-[10px] sm:text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none uppercase" />
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm">
                          <input type="color" value={customTheme.borderColor} onChange={(e) => setCustomTheme({ ...customTheme, borderColor: e.target.value })} className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer" title="Select Border Color" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-tight truncate" title="Border Color">Border Color</label>
                          <input type="text" value={customTheme.borderColor.toUpperCase()} onChange={(e) => setCustomTheme({ ...customTheme, borderColor: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-[var(--radius-sm)] text-[10px] sm:text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none uppercase" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] mb-1.5 truncate" title="Interactive Corner Style">Interactive Corner Style</label>
                    <p className="text-[8px] sm:text-[9px] text-slate-400 font-medium mb-3 truncate" title="Applies only to buttons/badges to preserve structural layout.">Applies only to buttons/badges to preserve structural layout.</p>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      <button onClick={() => setCustomTheme({ ...customTheme, borderRadius: "0px" })} className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-bold border transition-all ${customTheme.borderRadius === "0px" ? "bg-[var(--color-secondary)] text-white border-[var(--color-secondary)] shadow-md" : "bg-white text-slate-600 border-[var(--color-border)] hover:bg-slate-50"}`}>Sharp</button>
                      <button onClick={() => setCustomTheme({ ...customTheme, borderRadius: "2px" })} className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-bold border rounded-[2px] transition-all ${customTheme.borderRadius === "2px" ? "bg-[var(--color-secondary)] text-white border-[var(--color-secondary)] shadow-md" : "bg-white text-slate-600 border-[var(--color-border)] hover:bg-slate-50"}`}>Strict</button>
                      <button onClick={() => setCustomTheme({ ...customTheme, borderRadius: "0.5rem" })} className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-bold border rounded-lg transition-all ${customTheme.borderRadius === "0.5rem" ? "bg-[var(--color-secondary)] text-white border-[var(--color-secondary)] shadow-md" : "bg-white text-slate-600 border-[var(--color-border)] hover:bg-slate-50"}`}>Modern</button>
                      <button onClick={() => setCustomTheme({ ...customTheme, borderRadius: "9999px" })} className={`py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-bold border rounded-full transition-all ${customTheme.borderRadius === "9999px" ? "bg-[var(--color-secondary)] text-white border-[var(--color-secondary)] shadow-md" : "bg-white text-slate-600 border-[var(--color-border)] hover:bg-slate-50"}`}>Pill</button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[var(--color-text)] mb-1.5 truncate" title="Workspace Typography">Workspace Typography</label>
                    <div className="relative">
                      <select 
                        value={customTheme.fontFamily}
                        onChange={(e) => setCustomTheme({ ...customTheme, fontFamily: e.target.value })}
                        className="w-full p-2.5 sm:p-3 border border-[var(--color-border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 focus:border-[var(--color-primary)] bg-white text-[11px] sm:text-sm font-bold text-[var(--color-text)] shadow-sm cursor-pointer transition-colors"
                        title="Select Font Family"
                      >
                        <option value="Inter">Inter (Clean Default)</option>
                        <option value="Archivo">Archivo (Corporate Geometric)</option>
                        <option value="Roboto">Roboto (Modern Sans)</option>
                        <option value="Poppins">Poppins (Friendly Round)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-[var(--color-border)]">
                    {orgData?.master_theme && (
                      <button 
                        onClick={() => setThemeConfirmModal({
                          isOpen: true,
                          type: 'load',
                          title: 'Load Corporate Spec',
                          message: 'This will replace your current unsaved colors with the official corporate theme. Do you want to proceed?',
                          confirmText: 'Load Spec',
                          confirmStyle: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 shadow-[var(--shadow-md)]'
                        })}
                        disabled={isSavingTheme}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[9px] sm:text-[10px] py-2.5 sm:py-3 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] active:scale-[0.98] border border-transparent flex justify-center items-center gap-2"
                      >
                        <DownloadCloud size={14} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Load Corporate Spec</span>
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setThemeConfirmModal({
                          isOpen: true,
                          type: 'reset',
                          title: 'Reset to Defaults',
                          message: 'Are you sure you want to revert to the default system theme? All unsaved customizations will be lost.',
                          confirmText: 'Reset Theme',
                          confirmStyle: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 shadow-[var(--shadow-md)]'
                        })}
                        disabled={isSavingTheme}
                        className="w-1/3 bg-white hover:bg-slate-100 font-extrabold uppercase tracking-wider text-[9px] sm:text-[10px] py-2.5 sm:py-3 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] active:scale-95 border border-red-500 text-red-600 flex justify-center items-center gap-1.5"
                        title="Reset Default Theme"
                      >
                        <RotateCcw size={12} strokeWidth={2.5} className="shrink-0"/> <span className="truncate">Reset</span>
                      </button>
                      <button 
                        onClick={() => setThemeConfirmModal({
                          isOpen: true,
                          type: 'apply',
                          title: 'Apply Custom Colors',
                          message: 'This will officially save and apply your customized theme globally across your workspace. Continue?',
                          confirmText: 'Apply Theme',
                          confirmStyle: 'bg-[var(--color-secondary)] hover:opacity-90 shadow-[var(--shadow-md)]'
                        })}
                        disabled={isSavingTheme}
                        className="w-2/3 bg-[var(--color-secondary)] hover:opacity-90 text-white font-black uppercase tracking-widest text-[9px] sm:text-[10px] py-2.5 sm:py-3 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95 border border-transparent truncate px-2"
                        title="Apply Custom Colors"
                      >
                        {isSavingTheme ? "Applying..." : "Apply Custom Colors"}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 🌟 TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 rounded-[var(--radius-xl)] shadow-2xl font-bold text-[11px] sm:text-xs bg-white border border-[var(--color-border)] animate-in slide-in-from-bottom-5 fade-in duration-300 ${toast.type === "success" ? "border-l-4 border-l-[var(--color-primary)] text-[var(--color-text)]" : "border-l-4 border-l-red-500 text-[var(--color-text)]"}`}>
          {toast.type === "success" ? (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0 border border-[var(--color-primary)]/20"><CheckCircle className="text-[var(--color-primary)] w-3 h-3 sm:w-4 sm:h-4" strokeWidth={2.5} /></div>
          ) : (
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100"><AlertCircle className="text-red-500 w-3 h-3 sm:w-4 sm:h-4" strokeWidth={2.5} /></div>
          )}
          <span className="truncate max-w-[200px] sm:max-w-none" title={toast.message}>{toast.message}</span>
        </div>
      )}

      {/* ADD USER MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] shadow-2xl w-full max-w-[95vw] sm:max-w-md h-[85vh] sm:h-auto overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text)] tracking-tight truncate" title="Add Workspace User">Add Workspace User</h2>
              <button onClick={() => !isSubmitting && setIsInviteModalOpen(false)} className="text-slate-400 hover:opacity-90 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <form onSubmit={handleAddUserSubmit} className="space-y-4">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs sm:text-sm rounded-[var(--radius-md)] border border-red-100">{errorMsg}</div>}

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5"><UserPlus size={16} className="text-[var(--color-text)]" /> Full Name</label>
                  <input type="text" required placeholder="e.g. Maria Lopez" value={memberName} onChange={(e) => setMemberName(e.target.value)} className="w-full px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-xs sm:text-sm shadow-[var(--shadow-sm)]" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5"><Mail size={16} className="text-[var(--color-text)]" /> Login Email</label>
                  <input type="email" required placeholder="maria@company.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="w-full px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-xs sm:text-sm shadow-[var(--shadow-sm)]" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5"><Lock size={16} className="text-[var(--color-text)]" /> Initial Password</label>
                  <input type="password" required minLength={6} placeholder="Minimum 6 characters" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} className="w-full px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-xs sm:text-sm shadow-[var(--shadow-sm)]" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5"><Shield size={16} className="text-[var(--color-text)]" /> System Role</label>
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-xs sm:text-sm bg-white shadow-[var(--shadow-sm)]" disabled={isSubmitting}>
                    <option value="Property manager">Property Manager</option>
                    <option value="Maintenance staff">Maintenance Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5">Property Scope Access</label>
                  <input type="text" required placeholder="e.g. All properties, Future Point Only" value={memberAccess} onChange={(e) => setMemberAccess(e.target.value)} className="w-full px-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-xs sm:text-sm shadow-[var(--shadow-sm)]" disabled={isSubmitting} />
                </div>

              </form>
            </div>
            
            <div className="px-5 sm:px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 flex gap-3 justify-end flex-wrap sm:flex-nowrap">
              <button type="button" onClick={() => setIsInviteModalOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-[var(--radius-md)] border border-transparent shadow-[var(--shadow-sm)] active:scale-95 transition-all order-2 sm:order-1">Cancel</button>
              <button onClick={handleAddUserSubmit} disabled={isSubmitting} className="w-full sm:w-auto bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] border border-transparent px-6 py-2.5 rounded-[var(--radius-md)] text-xs sm:text-sm font-semibold shadow-[var(--shadow-md)] active:scale-95 transition-all order-1 sm:order-2 flex justify-center items-center">
                {isSubmitting ? "Creating Account..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-2xl w-full max-w-[95vw] sm:max-w-md h-[85vh] sm:h-auto overflow-hidden transform transition-all flex flex-col border border-[var(--color-border)] animate-in slide-in-from-bottom sm:zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 sm:px-6 py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight truncate" title="Subscription Details">Subscription Details</h2>
              <button onClick={() => setIsBillingModalOpen(false)} className="text-slate-400 hover:text-[var(--color-text)] transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
              <div className="space-y-4 sm:space-y-5">
                <div className="bg-white p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-2 flex justify-between items-center">
                  <div className="min-w-0 pr-2">
                    <p className="text-[11px] sm:text-sm text-slate-600 mb-1 truncate" title="Current Billing: Dynamic Rate">Current Billing: <span className="font-bold text-[var(--color-text)]">Dynamic Rate</span></p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate" title="For limit increases, contact admin.">For limit increases, contact admin.</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] border text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-sm ${getStatusColor(billingStatus)}`}>
                    {billingStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-4 border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-sm)]">
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5 truncate" title="Units Capacity">
                      <Home size={16} className="text-[var(--color-text)] shrink-0" />
                      <span className="truncate">Units Capacity</span>
                    </label>
                    <p className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] mt-1">{unitLimit}</p>
                  </div>
                  <div className="p-4 border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-sm)]">
                    <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5 truncate" title="Team Limit">
                      <Users size={16} className="text-[var(--color-text)] shrink-0" />
                      <span className="truncate">Team Limit</span>
                    </label>
                    <p className="text-xl sm:text-2xl font-extrabold text-[var(--color-text)] mt-1">{seatLimit}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--color-text)] mb-1.5">
                    <div className="flex items-center gap-2 truncate" title="Estimated Monthly Total">
                      <CreditCard size={16} className="text-[var(--color-text)] shrink-0" />
                      <span className="truncate">Estimated Monthly Total</span>
                    </div>
                  </label>
                  <div className="w-full px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--color-text)]/20 bg-[var(--color-text)]/10 flex items-center justify-between shadow-[var(--shadow-sm)]">
                    <div className="min-w-0 pr-2">
                      <p className="text-[10px] sm:text-xs font-bold text-[var(--color-text)] opacity-80 uppercase tracking-wider truncate" title={`Due on ${nextBillingDateFormatted}`}>Due on {nextBillingDateFormatted}</p>
                      <p className="text-[10px] sm:text-xs text-[var(--color-text)] font-medium truncate" title="₱99 Owner | ₱198 Tenanted">₱99 Owner | ₱198 Tenanted</p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className="text-base sm:text-lg font-extrabold text-[var(--color-text)]" title={`₱${monthlyCost.toLocaleString()}`}>
                        ₱{monthlyCost.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-5 sm:px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 flex justify-end">
              <button 
                type="button" 
                onClick={handlePaymentClick} 
                disabled={billingStatus.toLowerCase() === 'paid'}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] border border-transparent px-8 py-3.5 sm:py-3 rounded-[var(--radius-md)] text-xs sm:text-sm font-semibold transition-colors shadow-[var(--shadow-md)] flex items-center justify-center gap-2 active:scale-95"
              >
                {billingStatus.toLowerCase() === 'paid' ? (
                   <><CheckCircle size={18} /> Settled</>
                ) : (
                   <><CreditCard size={18} /> Pay ₱{monthlyCost.toLocaleString()}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL WALLET PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] shadow-2xl w-full max-w-[95vw] sm:max-w-md h-[90vh] sm:h-auto overflow-hidden transform transition-all flex flex-col border border-[var(--color-border)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            
            {paymentSuccess ? (
              <div className="px-6 py-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-inner border-4 border-amber-50">
                  <CheckCircle className="text-[#d97706]" size={40} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-3 tracking-tight truncate" title="Payment Submitted!">Payment Submitted!</h3>
                <p className="text-slate-500 text-xs sm:text-sm mb-10 leading-relaxed px-4">
                  Your payment receipt has been submitted successfully and is currently <strong className="text-amber-600">Pending Verification</strong>. Your account status will update once confirmed by the system admin.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[10px] sm:text-xs py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] border border-transparent active:scale-95"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 sm:px-6 py-5 sm:py-6 flex justify-between items-center relative overflow-hidden bg-[var(--color-bg)] border-b border-[var(--color-border)] shrink-0">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]"></div>
                  <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2 truncate" title="Submit Payment">
                    <CreditCard className="text-[var(--color-primary)] shrink-0" size={20} strokeWidth={2.5} />
                    <span className="truncate">Submit Payment</span>
                  </h2>
                  <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-[var(--radius-sm)] text-slate-400 hover:text-[var(--color-text)] transition-colors active:scale-95 shrink-0" disabled={isSimulating}>
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
                
                <div className="px-5 sm:px-6 py-6 sm:py-8 bg-[var(--color-bg)] overflow-y-auto custom-scrollbar flex-1 min-h-0">
                  <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mb-6 leading-relaxed">
                    {orgData?.org_name || 'Organization'} · System Subscription - total <span className="font-black text-[var(--color-text)]">₱{monthlyCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </p>
                  
                  <div className="mb-6">
                    <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 truncate" title="Payment Method">Payment Method</label>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-4 py-2.5 rounded-[var(--radius-sm)] text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)]">
                        Digital Wallet
                      </span>
                    </div>
                  </div>

                  <div className="mb-6 p-4 sm:p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] text-sm text-[var(--color-text)]">
                    <div className="flex flex-col items-center">
                      <p className="mb-4 font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[var(--color-text)] text-center">Scan QR code using GCash or QR Ph</p>
                      <div className="w-36 h-36 sm:w-40 sm:h-40 bg-slate-50 relative overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[var(--shadow-inner)] p-3">
                        <Image src="/qr-ph.png" alt="Scan to pay" fill className="object-contain p-2" />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 truncate" title="Reference / Transaction Number">Reference / Transaction Number</label>
                    <input 
                      type="text" 
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. 1002934823"
                      className="w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)] transition-all shadow-[var(--shadow-sm)]"
                    />
                  </div>
                </div>
                
                <div className="px-5 sm:px-6 py-4 border-t border-[var(--color-border)] shrink-0">
                  <button 
                    onClick={handleSimulatePayment} 
                    disabled={isSimulating || referenceNumber.length < 3} 
                    className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[10px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] border border-transparent active:scale-95 flex justify-center items-center gap-2"
                  >
                    {isSimulating ? <span className="animate-pulse">Processing...</span> : "I've paid, submit receipt"} <ArrowRight size={16} strokeWidth={2.5} className={isSimulating ? "hidden" : "block"} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ✨ THEME ACTION CONFIRMATION MODAL */}
      {themeConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-lg)] shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center transform transition-all animate-in zoom-in-95 duration-500 border border-[var(--color-border)]">
            
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border-4 ${
              themeConfirmModal.type === 'load' ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' :
              themeConfirmModal.type === 'reset' ? 'bg-red-50 text-red-500 border-red-100' :
              'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'
            }`}>
              {themeConfirmModal.type === 'load' && <DownloadCloud size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
              {themeConfirmModal.type === 'reset' && <RotateCcw size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
              {themeConfirmModal.type === 'apply' && <CheckCircle size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 tracking-tight truncate" title={themeConfirmModal.title}>
              {themeConfirmModal.title}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              {themeConfirmModal.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button 
                onClick={() => setThemeConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="w-full sm:flex-1 py-3 sm:py-3.5 rounded-[var(--radius-md)] font-black text-[var(--color-text)] bg-slate-50 hover:bg-slate-100 border border-[var(--color-border)] transition-all active:scale-[0.96] text-[11px] sm:text-xs uppercase tracking-wider duration-200 order-2 sm:order-1"
              >
                Cancel
              </button>
              <button 
                onClick={executeThemeAction} 
                className={`w-full sm:flex-1 py-3 sm:py-3.5 rounded-[var(--radius-md)] text-[var(--color-primary-text)] font-black uppercase tracking-wider transition-all shadow-lg active:scale-[0.96] text-[11px] sm:text-xs duration-200 border border-transparent order-1 sm:order-2 flex items-center justify-center truncate px-2 ${themeConfirmModal.confirmStyle}`}
                title={themeConfirmModal.confirmText}
              >
                {themeConfirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ✨ TEAM TAB FULL WORKSPACE SKELETON
function TeamTabSkeleton() {
  return (
    <div className="flex-1 w-full min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden px-4 sm:px-0 custom-scrollbar animate-pulse">
      <div className="max-w-[1600px] mx-auto w-full lg:h-full flex flex-col lg:flex-row gap-4">
        
        {/* Left Col (Access Control) Skeleton */}
        <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col h-[500px] lg:h-full flex-none shrink-0 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 flex justify-between items-center h-[68px] sm:h-[76px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200"></div>
              <div className="w-32 h-5 bg-slate-200 rounded"></div>
            </div>
            <div className="w-24 h-9 bg-slate-200 rounded-[var(--radius-md)]"></div>
          </div>
          <div className="flex-1 p-3 space-y-2 bg-white">
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className="h-[72px] bg-[var(--color-bg)]/80 rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center px-4 sm:px-6 gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                <div className="w-32 sm:w-48 h-4 bg-slate-200 rounded shrink-0"></div>
                <div className="w-16 sm:w-20 h-5 bg-slate-200 rounded-[var(--radius-sm)] ml-auto shrink-0"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col (Subscription & Theme Builder) Skeleton */}
        <div className="w-full lg:w-[45%] xl:w-[35%] flex flex-col gap-6 pb-6 shrink-0 lg:overflow-y-auto custom-scrollbar lg:pr-2">
          
          {/* Subscription Skeleton Box */}
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-5 sm:p-6 lg:p-8 flex flex-col gap-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
              <div className="w-32 h-6 bg-slate-200 rounded"></div>
            </div>
            <div className="h-[100px] bg-[var(--color-bg)]/80 rounded-[var(--radius-lg)] border border-[var(--color-border)]"></div>
            <div className="h-12 bg-slate-100 rounded-full"></div>
            <div className="h-12 bg-slate-100 rounded-lg"></div>
            <div className="h-12 bg-slate-200 rounded-[var(--radius-md)] mt-2"></div>
          </div>
          
          {/* Theme Builder Skeleton Box */}
          <div className="bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] p-5 sm:p-6 lg:p-8 flex flex-col gap-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
              <div className="w-40 h-6 bg-slate-200 rounded"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-[var(--radius-md)] shrink-0"></div>
              <div className="flex-1 h-10 bg-slate-100 rounded-[var(--radius-md)]"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-[var(--radius-md)] shrink-0"></div>
              <div className="flex-1 h-10 bg-slate-100 rounded-[var(--radius-md)]"></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-[var(--radius-md)] shrink-0"></div>
              <div className="flex-1 h-10 bg-slate-100 rounded-[var(--radius-md)]"></div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 rounded-lg shrink-0"></div>
                <div className="flex-1 h-8 bg-slate-100 rounded-[var(--radius-sm)]"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-200 rounded-lg shrink-0"></div>
                <div className="flex-1 h-8 bg-slate-100 rounded-[var(--radius-sm)]"></div>
              </div>
            </div>

            <div className="h-12 bg-slate-100 rounded-lg mt-4"></div>
            <div className="h-12 bg-slate-200 rounded-[var(--radius-md)] mt-2"></div>
          </div>

        </div>

      </div>
    </div>
  );
}