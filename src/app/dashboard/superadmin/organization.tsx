"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Building2, Calendar, Edit2, 
  X, AlertTriangle, Mail, Lock, Users, Home, CreditCard, CheckCircle, Search, Eye, EyeOff, Globe, Palette, Type, CheckCircle2, RotateCcw,
  Ban, Trash2
} from "lucide-react";

// ✨ CONSTANT: Default PropertyKo Theme (Fallback/Reset)
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

export default function OrganizationDirectory({ organizations, isLoadingOrgs, fetchOrganizations }: any) {
  // Modal & UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{orgName: string, email: string, subdomain: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // State to store live calculated MRR from the units table
  const [liveStats, setLiveStats] = useState<Record<string, { totalMRR: number, ownerOnly: number, tenanted: number, activeCount: number }>>({});
  
  // THEME BUILDER STATES
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [activeThemeOrg, setActiveThemeOrg] = useState<any>(null);
  const [themeForm, setThemeForm] = useState(defaultTheme);

  // THEME ACTION CONFIRMATION MODAL STATES
  const [themeConfirmModal, setThemeConfirmModal] = useState<{
    isOpen: boolean;
    type: 'reset' | 'apply' | null;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: string;
  }>({
    isOpen: false, type: null, title: "", message: "", confirmText: "", confirmStyle: ""
  });

  // ✨ NEW: ORG ACTIONS CONFIRMATION MODAL (Suspend & Delete)
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    isOpen: boolean;
    actionType: 'suspend' | 'activate' | 'delete' | null;
    orgId: string | null;
    title: string;
    message: string;
    confirmText: string;
    confirmStyle: string;
    iconType: 'ban' | 'trash' | 'check';
  }>({
    isOpen: false, actionType: null, orgId: null, title: "", message: "", confirmText: "", confirmStyle: "", iconType: 'ban'
  });

  // Form State
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [subdomain, setSubdomain] = useState(""); 
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [plan, setPlan] = useState("Dynamic (₱99-₱198/unit)");
  const [usersCount, setUsersCount] = useState("1");
  const [unitsCount, setUnitsCount] = useState("0");
  const [billingDay, setBillingDay] = useState("1"); 

  // Fetch live units to calculate exact MRR based on tenant status
  useEffect(() => {
    const fetchLiveMRR = async () => {
      const { data, error } = await supabase.from('units').select('admin_email, tenant_name, status');
      
      if (!error && data) {
        const statsMap: Record<string, { totalMRR: number, ownerOnly: number, tenanted: number, activeCount: number }> = {};
        
        data.forEach(unit => {
          const email = unit.admin_email;
          if (!statsMap[email]) {
            statsMap[email] = { totalMRR: 0, ownerOnly: 0, tenanted: 0, activeCount: 0 };
          }
          
          const hasTenant = unit.tenant_name && unit.tenant_name !== '—' && unit.tenant_name !== 'Vacant' && unit.status !== 'Vacant';
          
          if (hasTenant) {
            statsMap[email].tenanted += 1;
            statsMap[email].totalMRR += 198; 
          } else {
            statsMap[email].ownerOnly += 1;
            statsMap[email].totalMRR += 99; 
          }
          statsMap[email].activeCount += 1;
        });
        
        setLiveStats(statsMap);
      }
    };

    if (organizations && organizations.length > 0) {
      fetchLiveMRR();
    }
  }, [organizations]);

  const resetForm = () => {
    setOrgName("");
    setSubdomain(""); 
    setAdminEmail("");
    setAdminPassword("");
    setPlan("Dynamic (₱99-₱198/unit)");
    setUsersCount("1");
    setUnitsCount("0");
    setBillingDay("1"); 
    setEditingOrgId(null);
    setErrorMsg(null);
    setShowPassword(false);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const requestedUnits = parseInt(unitsCount) || 0;
    const requestedDay = parseInt(billingDay) || 1;
    
    // Ensure subdomain is URL safe
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (!cleanSubdomain) {
      setErrorMsg("Please provide a valid subdomain.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: { org_name: orgName, plan_type: plan, role: 'admin' }
        }
      });

      if (authError && !authError.message.includes("Error sending confirmation email")) {
         throw new Error(`Auth Error: ${authError.message}`);
      }

      const { error: dbError } = await supabase
        .from('organizations')
        .insert([{ 
          org_name: orgName,
          subdomain: cleanSubdomain, 
          admin_email: adminEmail, 
          plan: plan,
          users_count: parseInt(usersCount) || 1,
          units_count: requestedUnits, 
          billing_day: requestedDay,
          status: 'active'
        }]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      setSuccessData({ orgName: orgName, email: adminEmail, subdomain: cleanSubdomain });
      await fetchOrganizations(); 
      setIsSubmitting(false);
      setIsModalOpen(false); 
      resetForm();

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
      setIsSubmitting(false);
    }
  };

  const openEditModal = (org: any) => {
    setEditingOrgId(org.id);
    setOrgName(org.org_name);
    setPlan(org.plan || "Dynamic (₱99-₱198/unit)");
    setUsersCount(org.users_count?.toString() || "1");
    setUnitsCount(org.units_count?.toString() || "0"); 
    setBillingDay(org.billing_day?.toString() || "1"); 
    setIsEditModalOpen(true);
    setErrorMsg(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrgId) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const requestedUnits = parseInt(unitsCount) || 0;
    const requestedDay = parseInt(billingDay) || 1;

    try {
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ 
          org_name: orgName, 
          plan: plan,
          users_count: parseInt(usersCount) || 1,
          units_count: requestedUnits,
          billing_day: requestedDay 
        })
        .eq('id', editingOrgId);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      await fetchOrganizations(); 
      setIsSubmitting(false);
      setIsEditModalOpen(false); 
      resetForm();

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
      setIsSubmitting(false);
    }
  };

  const openThemeModal = (org: any) => {
    setActiveThemeOrg(org);
    if (org.master_theme) {
      setThemeForm(org.master_theme);
    } else if (org.theme_config) {
      setThemeForm({ ...defaultTheme, ...org.theme_config });
    } else {
      setThemeForm(defaultTheme);
    }
    setIsThemeModalOpen(true);
    setErrorMsg(null);
  };

  const handleThemeSubmit = async () => {
    if (!activeThemeOrg) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = { ...themeForm, enableShadows: true }; 
      
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ master_theme: payload, theme_config: payload, theme_preset: 'strict' })
        .eq('id', activeThemeOrg.id);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      await fetchOrganizations(); 
      setIsSubmitting(false);
      setIsThemeModalOpen(false); 
      setThemeConfirmModal(prev => ({ ...prev, isOpen: false }));

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
      setIsSubmitting(false);
    }
  };

  const handleRestoreDefaultTheme = async () => {
    if (!activeThemeOrg) return;
    setIsSubmitting(true);
    
    try {
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ master_theme: null, theme_config: defaultTheme, theme_preset: 'default' })
        .eq('id', activeThemeOrg.id);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      await fetchOrganizations(); 
      setIsSubmitting(false);
      setIsThemeModalOpen(false); 
      setThemeConfirmModal(prev => ({ ...prev, isOpen: false }));

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
      setIsSubmitting(false);
    }
  };

  const executeThemeAction = () => {
    if (themeConfirmModal.type === 'reset') handleRestoreDefaultTheme();
    if (themeConfirmModal.type === 'apply') handleThemeSubmit();
  };

  // ✨ MODAL TRIGGERS FOR ACTIONS
  const confirmToggleStatus = (org: any) => {
    const isSuspended = org.status === 'suspended';
    setActionConfirmModal({
      isOpen: true,
      actionType: isSuspended ? 'activate' : 'suspend',
      orgId: org.id,
      title: isSuspended ? 'Reactivate Workspace?' : 'Suspend Workspace?',
      message: isSuspended 
        ? `Are you sure you want to restore access for ${org.org_name}? They will be able to log in again.` 
        : `Are you sure you want to suspend ${org.org_name}? They will be immediately locked out of their workspace until reactivated.`,
      confirmText: isSuspended ? 'Yes, Reactivate' : 'Yes, Suspend',
      confirmStyle: isSuspended ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25',
      iconType: isSuspended ? 'check' : 'ban'
    });
  };

  const confirmDeleteOrg = (org: any) => {
    setActionConfirmModal({
      isOpen: true,
      actionType: 'delete',
      orgId: org.id,
      title: 'Delete Organization?',
      message: `DANGER: Are you sure you want to permanently delete ${org.org_name}? This action cannot be undone and all their data will be lost.`,
      confirmText: 'Yes, Delete',
      confirmStyle: 'bg-red-500 hover:bg-red-600 shadow-red-500/25',
      iconType: 'trash'
    });
  };

  // ✨ EXECUTE CONFIRMED ACTIONS
  const executeOrgAction = async () => {
    if (!actionConfirmModal.orgId) return;
    setIsSubmitting(true);

    try {
      if (actionConfirmModal.actionType === 'delete') {
        const { error } = await supabase.from('organizations').delete().eq('id', actionConfirmModal.orgId);
        if (error) throw error;
      } else {
        const newStatus = actionConfirmModal.actionType === 'suspend' ? 'suspended' : 'active';
        const { error } = await supabase.from('organizations').update({ status: newStatus }).eq('id', actionConfirmModal.orgId);
        if (error) throw error;
      }
      
      await fetchOrganizations();
      setActionConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      console.error(error);
      alert(`Action failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrgs = organizations?.filter((org: any) => 
    org.org_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    org.admin_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.subdomain && org.subdomain.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <>
      <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header containing the Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
          <div>
            <h2 className="font-extrabold text-xl text-[#0a1e3f]">Organizations</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Directory of all onboarded property management companies.</p>
          </div>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-gradient-to-r from-[#1d82f5] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto text-center flex items-center justify-center gap-2 transform active:scale-95 shrink-0 outline-none focus:outline-none"
          >
            <Building2 size={16} /> Add New Organization
          </button>
        </div>
        
        {/* Profile Grid Layout with Search */}
        <div className="bg-slate-50/50 -mx-6 -mb-6 p-6 sm:p-8">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-extrabold text-lg text-[#0a1e3f] flex items-center gap-2">
              <Building2 size={20} className="text-[#1d82f5]" /> 
              Organization Profiles
            </h2>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search organizations or subdomains..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] bg-white shadow-sm transition-all"
              />
            </div>
          </div>

          {isLoadingOrgs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white rounded-3xl h-[320px] border border-slate-200 shadow-sm animate-pulse flex flex-col overflow-hidden">
                  <div className="h-24 w-full bg-slate-100"></div>
                  <div className="px-6 pb-6 flex flex-col items-center flex-1">
                    <div className="-mt-12 w-24 h-24 bg-white rounded-2xl p-1.5 shadow-sm mb-4">
                      <div className="w-full h-full bg-slate-100 rounded-xl"></div>
                    </div>
                    <div className="h-5 w-3/4 bg-slate-100 rounded-full mb-3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 py-20 text-center flex flex-col items-center">
              <div className="bg-slate-50 p-5 rounded-full mb-4">
                <Building2 size={48} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">No Organizations Found</h3>
              <p className="text-slate-500">We couldn't find any organizations matching your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {filteredOrgs.map((org: any, index: number) => {
                const orgStats = liveStats[org.admin_email] || { totalMRR: 0, ownerOnly: 0, tenanted: 0, activeCount: 0 };
                const isSuspended = org.status === 'suspended';

                return (
                  <div key={index} className={`bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group overflow-hidden ${isSuspended ? 'border-red-300 opacity-90' : 'border-slate-200/60'}`}>
                    
                    <div className={`h-24 w-full relative transition-colors ${isSuspended ? 'bg-red-50' : 'bg-gradient-to-r from-blue-50 to-slate-100 group-hover:from-blue-100 group-hover:to-blue-50'}`}>
                      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                        {org.theme_preset === 'strict' && (
                          <StatusBadge text="Strict Spec" color="orange" />
                        )}
                        {isSuspended ? (
                          <StatusBadge text="Suspended" color="red" />
                        ) : (
                          <StatusBadge text="Active" color="green" />
                        )}
                      </div>
                    </div>
                    
                    <div className="px-6 pb-6 pt-0 flex flex-col flex-1 relative">
                      <div className="-mt-12 mb-4 w-24 h-24 bg-white rounded-2xl p-1.5 shadow-md border border-slate-100 mx-auto z-10 group-hover:border-blue-200 transition-colors">
                        <div className="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden">
                          {org.logo_url ? (
                            <img src={org.logo_url} alt={`${org.org_name} logo`} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-xl font-black text-slate-400 tracking-widest uppercase">
                              {org.org_name ? org.org_name.substring(0, 3) : "ORG"}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-center mb-5 flex flex-col flex-1">
                        <h3 className="font-extrabold text-[#0a1e3f] text-lg truncate mb-1" title={org.org_name}>
                          {org.org_name}
                        </h3>
                        {org.subdomain && (
                          <div className="flex items-center justify-center gap-1.5 text-[#1d82f5] text-xs font-bold mb-1">
                            <Globe size={12} />
                            <span className={isSuspended ? 'line-through opacity-70' : ''}>{org.subdomain}.propertyko.com</span>
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-medium mb-4">
                          <Mail size={12} />
                          <span className="truncate" title={org.admin_email}>{org.admin_email}</span>
                        </div>
                        
                        <div className="flex justify-center items-center gap-6 mb-5">
                          <div className="flex flex-col items-center">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              <Users size={12} /> Teams
                            </span>
                            <span className="text-sm font-extrabold text-slate-700">{org.users_count || 1}</span>
                          </div>
                          <div className="w-px h-8 bg-slate-200"></div>
                          <div className="flex flex-col items-center" title="Active Units / Allowed Limit">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              <Home size={12} /> Units
                            </span>
                            <span className="text-sm font-extrabold text-slate-700">{orgStats.activeCount} / {org.units_count || 0}</span>
                          </div>
                        </div>

                        <div className="w-full text-left px-4 py-3 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col mt-auto">
                          
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">Active Status</p>
                            <p className="text-[10px] text-emerald-600 font-bold">{orgStats.ownerOnly} Owner-Only | {orgStats.tenanted} Tenanted</p>
                          </div>
                          
                          <div className="flex justify-between items-end mb-3">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live Est. MRR</p>
                            <p className="text-xl font-black text-[#0a1e3f] leading-none">
                              ₱{orgStats.totalMRR.toLocaleString()}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-emerald-100/80 flex justify-center items-center">
                            <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <Calendar size={12} className="text-emerald-600" />
                              Every {org.billing_day || 1} of the month
                            </p>
                          </div>

                        </div>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => openEditModal(org)}
                          className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-[#1d82f5] text-slate-600 hover:text-white border border-slate-200 hover:border-[#1d82f5] px-2 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-sm outline-none focus:outline-none"
                        >
                          <Edit2 size={14} /> Limits
                        </button>
                        <button 
                          onClick={() => openThemeModal(org)}
                          className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-[#0a1e3f] text-slate-600 hover:text-white border border-slate-200 hover:border-[#0a1e3f] px-2 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-sm outline-none focus:outline-none"
                        >
                          <Palette size={14} /> Branding
                        </button>
                        
                        {/* ✨ MODAL TRIGGERS INSTEAD OF WINDOW.CONFIRM */}
                        <button 
                          onClick={() => confirmToggleStatus(org)}
                          className={`w-full flex items-center justify-center gap-2 px-2 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-sm outline-none border ${isSuspended ? 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white border-emerald-200 hover:border-emerald-500' : 'bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white border-orange-200 hover:border-orange-500'}`}
                        >
                          <Ban size={14} /> {isSuspended ? "Reactivate" : "Suspend"}
                        </button>
                        <button 
                          onClick={() => confirmDeleteOrg(org)}
                          className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 px-2 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] shadow-sm outline-none focus:outline-none"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 1. ONBOARDING FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-extrabold text-[#0a1e3f]">Add New Organization</h2>
              <button onClick={() => { if(!isSubmitting) { setIsModalOpen(false); resetForm(); } }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full outline-none focus:outline-none" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="p-8 overflow-y-auto max-h-[75vh]">
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Building2 size={16} className="text-[#359b46]" /> Organization Name
                  </label>
                  <input type="text" required placeholder="e.g. Apex Realty Group" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" disabled={isSubmitting} />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Globe size={16} className="text-[#359b46]" /> Subdomain URL
                  </label>
                  <div className="flex items-center">
                    <input 
                      type="text" 
                      required 
                      placeholder="futurepoint" 
                      value={subdomain} 
                      onChange={(e) => setSubdomain(e.target.value)} 
                      className="w-full px-4 py-3 rounded-l-xl border border-r-0 border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" 
                      disabled={isSubmitting} 
                    />
                    <span className="bg-slate-50 border border-slate-200 border-l-0 px-4 py-3 rounded-r-xl text-slate-500 text-sm font-medium shadow-sm">
                      .propertyko.com
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Must be lowercase letters, numbers, or hyphens only.</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Mail size={16} className="text-[#359b46]" /> Primary Admin Email
                  </label>
                  <input type="email" required placeholder="admin@apexrealty.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" disabled={isSubmitting} />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Lock size={16} className="text-[#359b46]" /> Initial Admin Password
                  </label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required placeholder="Create a strong password" minLength={6} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" disabled={isSubmitting} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors outline-none" tabIndex={-1}>
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Users size={16} className="text-[#359b46]" /> Team Seats
                    </label>
                    <input type="number" min="1" required value={usersCount} onChange={(e) => setUsersCount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Home size={16} className="text-[#359b46]" /> Max Unit Limit
                    </label>
                    <input type="number" min="0" required value={unitsCount} onChange={(e) => setUnitsCount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm" disabled={isSubmitting} />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Calendar size={16} className="text-[#359b46]" /> Billing Cycle
                  </label>
                  <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#359b46]/50 focus-within:border-[#359b46] text-sm shadow-sm bg-white">
                    <span className="text-slate-500 font-medium">Every</span>
                    <input type="number" min="1" max="31" required value={billingDay} onChange={(e) => setBillingDay(e.target.value)} className="w-12 text-center outline-none font-bold text-[#0a1e3f] bg-slate-50 p-1 rounded-md" disabled={isSubmitting} />
                    <span className="text-slate-500 font-medium">of the month</span>
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <CreditCard size={16} className="text-[#359b46]" /> Potential MRR Preview
                  </label>
                  <div className="w-full px-5 py-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1">Dynamic Rate</p>
                      <p className="text-xs text-emerald-600 font-semibold">₱99 Owner | ₱198 Tenanted</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#0a1e3f]">
                        ₱{((parseInt(unitsCount) || 0) * 99).toLocaleString()} - ₱{((parseInt(unitsCount) || 0) * 198).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Est. MRR Range (Min - Max)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3 justify-end">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} disabled={isSubmitting} className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors outline-none focus:outline-none">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#8bc994] text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/20 min-w-[160px] outline-none focus:outline-none">{isSubmitting ? "Creating..." : "Create Organization"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT LIMITS MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-extrabold text-[#0a1e3f]">Manage Organization Profile</h2>
              <button onClick={() => { if(!isSubmitting) { setIsEditModalOpen(false); resetForm(); } }} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full outline-none focus:outline-none" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-8 overflow-y-auto max-h-[75vh]">
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Building2 size={16} className="text-[#1d82f5]" /> Organization Name
                  </label>
                  <input type="text" required value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm" disabled={isSubmitting} />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Users size={16} className="text-[#1d82f5]" /> Max Team Users
                    </label>
                    <input type="number" min="1" required value={usersCount} onChange={(e) => setUsersCount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Home size={16} className="text-[#1d82f5]" /> Max Allowed Limit
                    </label>
                    <input type="number" min="0" required value={unitsCount} onChange={(e) => setUnitsCount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm" disabled={isSubmitting} />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Calendar size={16} className="text-[#1d82f5]" /> Billing Cycle
                  </label>
                  <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#1d82f5]/50 focus-within:border-[#1d82f5] text-sm shadow-sm bg-white">
                    <span className="text-slate-500 font-medium">Every</span>
                    <input type="number" min="1" max="31" required value={billingDay} onChange={(e) => setBillingDay(e.target.value)} className="w-12 text-center outline-none font-bold text-[#0a1e3f] bg-slate-50 p-1 rounded-md" disabled={isSubmitting} />
                    <span className="text-slate-500 font-medium">of the month</span>
                  </div>
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <CreditCard size={16} className="text-[#1d82f5]" /> Max Potential MRR
                  </label>
                  <div className="w-full px-5 py-4 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-1">Dynamic Rate</p>
                      <p className="text-xs text-blue-600 font-semibold">₱99 Owner | ₱198 Tenanted</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#0a1e3f]">
                        ₱{((parseInt(unitsCount) || 0) * 99).toLocaleString()} - ₱{((parseInt(unitsCount) || 0) * 198).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MRR Range (Min - Max)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3 justify-end">
                <button type="button" onClick={() => { setIsEditModalOpen(false); resetForm(); }} disabled={isSubmitting} className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors outline-none focus:outline-none">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="bg-gradient-to-r from-[#1d82f5] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 min-w-[160px] outline-none focus:outline-none">{isSubmitting ? "Updating..." : "Save Limits"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✨ 3. SUPERADMIN MASTER THEME BUILDER MODAL */}
      {isThemeModalOpen && activeThemeOrg && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200/50 text-[#0a1e3f] flex items-center justify-center shrink-0">
                  <Palette size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#0a1e3f] tracking-tight">Theme Builder</h2>
                  <p className="text-xs text-slate-500 font-medium">Corporate Spec: <strong className="text-[#0a1e3f]">{activeThemeOrg.org_name}</strong></p>
                </div>
              </div>
              <button onClick={() => !isSubmitting && setIsThemeModalOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full outline-none focus:outline-none" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
              <form onSubmit={(e) => { e.preventDefault(); setThemeConfirmModal({
                isOpen: true,
                type: 'apply',
                title: 'Apply Theme Spec',
                message: 'This will lock the theme spec for the organization. Do you want to proceed?',
                confirmText: 'Apply Spec',
                confirmStyle: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
              }); }} className="space-y-5">
                {errorMsg && (
                  <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-3 mb-2">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    {errorMsg}
                  </div>
                )}

                {/* Colors */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-sm focus-within:ring-2 focus-within:ring-[#1d82f5]">
                      <input type="color" value={themeForm.primaryColor} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Primary Color (Buttons & Active States)</label>
                      <input type="text" value={themeForm.primaryColor.toUpperCase()} onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/30 uppercase transition-all" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-sm focus-within:ring-2 focus-within:ring-[#1d82f5]">
                      <input type="color" value={themeForm.secondaryColor} onChange={(e) => setThemeForm({ ...themeForm, secondaryColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Secondary Color (Sidebar & Headers)</label>
                      <input type="text" value={themeForm.secondaryColor.toUpperCase()} onChange={(e) => setThemeForm({ ...themeForm, secondaryColor: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/30 uppercase transition-all" />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shrink-0 shadow-sm focus-within:ring-2 focus-within:ring-[#1d82f5]">
                      <input type="color" value={themeForm.backgroundColor} onChange={(e) => setThemeForm({ ...themeForm, backgroundColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">App Canvas Color (Background)</label>
                      <input type="text" value={themeForm.backgroundColor.toUpperCase()} onChange={(e) => setThemeForm({ ...themeForm, backgroundColor: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/30 uppercase transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm focus-within:ring-2 focus-within:ring-[#1d82f5]">
                        <input type="color" value={themeForm.textColor} onChange={(e) => setThemeForm({ ...themeForm, textColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-tight">Text Color <br/><span className="font-medium opacity-70">(Main Typography)</span></label>
                        <input type="text" value={themeForm.textColor.toUpperCase()} onChange={(e) => setThemeForm({ ...themeForm, textColor: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none uppercase" />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 shadow-sm focus-within:ring-2 focus-within:ring-[#1d82f5]">
                        <input type="color" value={themeForm.borderColor} onChange={(e) => setThemeForm({ ...themeForm, borderColor: e.target.value })} className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5 leading-tight">Border Color <br/><span className="font-medium opacity-70">(Dividers)</span></label>
                        <input type="text" value={themeForm.borderColor.toUpperCase()} onChange={(e) => setThemeForm({ ...themeForm, borderColor: e.target.value })} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none uppercase" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* UI Style / Radius */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a1e3f] mb-1.5">
                    Interactive Corner Style
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium mb-3">Applies only to buttons, inputs, and badges to preserve the system's structural layout.</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      type="button"
                      onClick={() => setThemeForm({ ...themeForm, borderRadius: "0px" })}
                      className={`py-2.5 text-xs font-bold border outline-none focus:outline-none transition-all ${themeForm.borderRadius === "0px" ? "bg-[#1d82f5] text-white border-[#1d82f5] shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      Sharp
                    </button>
                    <button 
                      type="button"
                      onClick={() => setThemeForm({ ...themeForm, borderRadius: "2px" })}
                      className={`py-2.5 text-xs font-bold border outline-none focus:outline-none rounded-[2px] transition-all ${themeForm.borderRadius === "2px" ? "bg-[#1d82f5] text-white border-[#1d82f5] shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      Strict
                    </button>
                    <button 
                      type="button"
                      onClick={() => setThemeForm({ ...themeForm, borderRadius: "0.5rem" })}
                      className={`py-2.5 text-xs font-bold border outline-none focus:outline-none rounded-lg transition-all ${themeForm.borderRadius === "0.5rem" ? "bg-[#1d82f5] text-white border-[#1d82f5] shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      Modern
                    </button>
                    <button 
                      type="button"
                      onClick={() => setThemeForm({ ...themeForm, borderRadius: "9999px" })}
                      className={`py-2.5 text-xs font-bold border outline-none focus:outline-none rounded-full transition-all ${themeForm.borderRadius === "9999px" ? "bg-[#1d82f5] text-white border-[#1d82f5] shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      Pill
                    </button>
                  </div>
                </div>

                {/* ✨ UNLOCKED TYPOGRAPHY */}
                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#0a1e3f] mb-2 flex items-center gap-1.5">
                    <Type size={12} className="text-[#1d82f5]" /> Corporate Typography
                  </label>
                  <select 
                    value={themeForm.fontFamily}
                    onChange={(e) => setThemeForm({ ...themeForm, fontFamily: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] bg-white text-sm font-bold text-slate-700 shadow-sm cursor-pointer transition-colors"
                  >
                    <option value="Inter">Inter (System Default)</option>
                    <option value="Archivo">Archivo (Corporate Geometric)</option>
                    <option value="Roboto">Roboto (Clean Sans)</option>
                    <option value="Poppins">Poppins (Modern Round)</option>
                  </select>
                </div>
                
                {/* Hidden submit button to allow form submission via Enter key if needed */}
                <button type="submit" className="hidden"></button>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setThemeConfirmModal({
                  isOpen: true,
                  type: 'reset',
                  title: 'Reset to Defaults',
                  message: 'Are you sure you want to revert to the default PropertyKo theme? All customizations will be wiped out.',
                  confirmText: 'Reset Theme',
                  confirmStyle: 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                })}
                disabled={isSubmitting}
                className="w-1/3 bg-white hover:bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-xs py-3.5 rounded-xl transition-all shadow-sm active:scale-95 border border-slate-200 outline-none focus:outline-none"
              >
                Reset Default
              </button>
              <button 
                type="button"
                onClick={() => setThemeConfirmModal({
                  isOpen: true,
                  type: 'apply',
                  title: 'Apply Theme Spec',
                  message: 'This will lock the theme spec for the organization. Do you want to proceed?',
                  confirmText: 'Apply Spec',
                  confirmStyle: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25'
                })}
                disabled={isSubmitting}
                className="w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-md active:scale-95 border border-transparent outline-none focus:outline-none"
              >
                {isSubmitting ? "Saving..." : "Apply Theme Spec"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ THEME ACTION CONFIRMATION MODAL */}
      {themeConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0a1e3f]/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center transform transition-all animate-in zoom-in-95 duration-500 border border-slate-200">
            
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border-4 ${
              themeConfirmModal.type === 'reset' ? 'bg-red-50 text-red-500 border-red-100' :
              'bg-emerald-50 text-emerald-500 border-emerald-100'
            }`}>
              {themeConfirmModal.type === 'reset' && <RotateCcw size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
              {themeConfirmModal.type === 'apply' && <CheckCircle2 size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 tracking-tight">
              {themeConfirmModal.title}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              {themeConfirmModal.message}
            </p>
            
            <div className="flex gap-3 sm:gap-4">
              <button 
                onClick={() => setThemeConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="flex-1 py-3 sm:py-3.5 rounded-[0.5rem] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all active:scale-[0.96] text-xs sm:text-sm duration-200 outline-none focus:outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={executeThemeAction} 
                className={`flex-1 py-3 sm:py-3.5 rounded-[0.5rem] text-white font-black transition-all shadow-lg active:scale-[0.96] text-xs sm:text-sm duration-200 border border-transparent outline-none focus:outline-none ${themeConfirmModal.confirmStyle}`}
              >
                {themeConfirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ ACTION CONFIRMATION MODAL (Suspend & Delete) */}
      {actionConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#0a1e3f]/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center transform transition-all animate-in zoom-in-95 duration-500 border border-slate-200">
            
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[1rem] sm:rounded-[2rem] flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border-4 ${
              actionConfirmModal.iconType === 'trash' ? 'bg-red-50 text-red-500 border-red-100' :
              actionConfirmModal.iconType === 'check' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' :
              'bg-orange-50 text-orange-500 border-orange-100'
            }`}>
              {actionConfirmModal.iconType === 'trash' && <Trash2 size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
              {actionConfirmModal.iconType === 'check' && <CheckCircle2 size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
              {actionConfirmModal.iconType === 'ban' && <Ban size={32} className="sm:w-9 sm:h-9" strokeWidth={2.5} />}
            </div>
            
            <h3 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 tracking-tight">
              {actionConfirmModal.title}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-8 sm:mb-10 leading-relaxed px-1">
              {actionConfirmModal.message}
            </p>
            
            <div className="flex gap-3 sm:gap-4">
              <button 
                onClick={() => setActionConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                disabled={isSubmitting}
                className="flex-1 py-3 sm:py-3.5 rounded-[0.5rem] font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all active:scale-[0.96] text-xs sm:text-sm duration-200 outline-none focus:outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={executeOrgAction} 
                disabled={isSubmitting}
                className={`flex-1 py-3 sm:py-3.5 rounded-[0.5rem] text-white font-black transition-all shadow-lg active:scale-[0.96] text-xs sm:text-sm duration-200 border border-transparent outline-none focus:outline-none ${actionConfirmModal.confirmStyle}`}
              >
                {isSubmitting ? "Processing..." : actionConfirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUCCESS MODAL */}
      {successData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-10 border border-emerald-100">
            <div className="w-24 h-24 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-emerald-50/50">
              <CheckCircle size={48} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight">Organization Active!</h2>
            <p className="text-slate-600 text-sm mb-4 leading-relaxed font-medium">
              <span className="font-extrabold text-slate-900 block text-base mb-1">{successData.orgName}</span> 
              is securely onboarded. Workspace access granted via <span className="font-bold text-[#359b46]">{successData.email}</span>.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-8 border border-slate-200">
              <p className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">Enterprise URL</p>
              <p className="text-[#359b46] font-extrabold text-sm">{successData.subdomain}.propertyko.com</p>
            </div>
            <button
              onClick={() => setSuccessData(null)}
              className="w-full bg-[#0a1e3f] hover:bg-[#15305c] text-white px-6 py-4 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] outline-none focus:outline-none"
            >
              Back to Directory
            </button>
          </div>
        </div>
      )}
    </>
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