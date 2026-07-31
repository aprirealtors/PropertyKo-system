"use client";

import React, { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Building2, Calendar, Edit2, 
  X, AlertTriangle, Mail, Lock, Users, Home, CreditCard, CheckCircle, Search, Eye, EyeOff
} from "lucide-react";

export default function OrganizationDirectory({ organizations, isLoadingOrgs, fetchOrganizations }: any) {
  // Modal & UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{orgName: string, email: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [plan, setPlan] = useState("Per Asset (₱99/unit)");
  const [usersCount, setUsersCount] = useState("1");
  const [unitsCount, setUnitsCount] = useState("0");
  const [billingDay, setBillingDay] = useState("1"); 

  const resetForm = () => {
    setOrgName("");
    setAdminEmail("");
    setAdminPassword("");
    setPlan("Per Asset (₱99/unit)");
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

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: { org_name: orgName, plan_type: "Per Asset (₱99/unit)", role: 'admin' }
        }
      });

      if (authError && !authError.message.includes("Error sending confirmation email")) {
         throw new Error(`Auth Error: ${authError.message}`);
      }

      const { error: dbError } = await supabase
        .from('organizations')
        .insert([{ 
          org_name: orgName, 
          admin_email: adminEmail, 
          plan: "Per Asset (₱99/unit)",
          users_count: parseInt(usersCount) || 1,
          units_count: requestedUnits,
          billing_day: requestedDay 
        }]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      setSuccessData({ orgName: orgName, email: adminEmail });
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
    setPlan(org.plan || "Per Asset (₱99/unit)");
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
          plan: "Per Asset (₱99/unit)",
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

  // Filter organizations based on search term
  const filteredOrgs = organizations?.filter((org: any) => 
    org.org_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    org.admin_email.toLowerCase().includes(searchTerm.toLowerCase())
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
            className="bg-gradient-to-r from-[#1d82f5] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg w-full sm:w-auto text-center flex items-center justify-center gap-2 transform active:scale-95 shrink-0"
          >
            <Building2 size={16} /> Add New Organization
          </button>
        </div>
        
        {/* Profile Grid Layout with Search */}
        <div className="bg-slate-50/50 -mx-6 -mb-6 p-6 sm:p-8">
          
          {/* Search & Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-extrabold text-lg text-[#0a1e3f] flex items-center gap-2">
              <Building2 size={20} className="text-[#1d82f5]" /> 
              Organization Profiles
            </h2>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search organizations..." 
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
                    <div className="h-3 w-1/2 bg-slate-100 rounded-full mb-4"></div>
                    <div className="h-6 w-1/2 bg-slate-100 rounded-lg mb-auto"></div>
                    <div className="h-10 w-full bg-slate-100 rounded-xl mt-4"></div>
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
              {filteredOrgs.map((org: any, index: number) => (
                <div key={index} className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group overflow-hidden">
                  
                  {/* Profile Banner */}
                  <div className="h-24 bg-gradient-to-r from-blue-50 to-slate-100 w-full relative group-hover:from-blue-100 group-hover:to-blue-50 transition-colors">
                    <div className="absolute top-4 right-4 z-10">
                      <StatusBadge text="Active" color="green" />
                    </div>
                  </div>
                  
                  {/* Profile Content */}
                  <div className="px-6 pb-6 pt-0 flex flex-col flex-1 relative">
                    {/* Floating Logo/Avatar */}
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
                    
                    {/* Organization Info */}
                    <div className="text-center mb-5 flex flex-col flex-1">
                      <h3 className="font-extrabold text-[#0a1e3f] text-lg truncate mb-1" title={org.org_name}>
                        {org.org_name}
                      </h3>
                      <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-medium mb-4">
                        <Mail size={12} />
                        <span className="truncate" title={org.admin_email}>{org.admin_email}</span>
                      </div>
                      
                      {/* Users and Units */}
                      <div className="flex justify-center items-center gap-6 mb-5">
                        <div className="flex flex-col items-center">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            <Users size={12} /> Teams
                          </span>
                          <span className="text-sm font-extrabold text-slate-700">{org.users_count || 1}</span>
                        </div>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div className="flex flex-col items-center">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            <Home size={12} /> Units
                          </span>
                          <span className="text-sm font-extrabold text-slate-700">{org.units_count || 0}</span>
                        </div>
                      </div>

                      {/* MRR Impact Detail Card */}
                      <div className="w-full text-left px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col mt-auto">
                        
                        {/* Per-Asset Rate */}
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Per-Asset Rate</p>
                          <p className="text-[10px] text-blue-600 font-semibold">₱99 / unit / mo</p>
                        </div>
                        
                        {/* Est. MRR */}
                        <div className="flex justify-between items-end mb-3">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Est. MRR</p>
                          <p className="text-lg font-black text-[#0a1e3f] leading-none">
                            ₱{((parseInt(org.units_count) || 0) * 99).toLocaleString()}
                          </p>
                        </div>

                        {/* Billing Cycle (Placed at the bottom) */}
                        <div className="pt-2.5 border-t border-blue-100/80 flex justify-center items-center">
                          <p className="text-[10px] text-blue-800 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar size={12} className="text-blue-600" />
                            Every {org.billing_day || 1} of the month
                          </p>
                        </div>

                      </div>
                    </div>
                    
                    {/* Action Area */}
                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => openEditModal(org)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-[#1d82f5] text-slate-600 hover:text-white border border-slate-200 hover:border-[#1d82f5] px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm"
                      >
                        <Edit2 size={16} /> Manage Profile
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
              <button 
                onClick={() => { if(!isSubmitting) { setIsModalOpen(false); resetForm(); } }}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full"
                disabled={isSubmitting}
              >
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
                  <input
                    type="text" required placeholder="e.g. Apex Realty Group"
                    value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Mail size={16} className="text-[#359b46]" /> Primary Admin Email
                  </label>
                  <input
                    type="email" required placeholder="admin@apexrealty.com"
                    value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Lock size={16} className="text-[#359b46]" /> Initial Admin Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} required placeholder="Create a strong password" minLength={6}
                      value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      tabIndex={-1}
                    >
                      {/* Swapped Icons Here */}
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Users size={16} className="text-[#359b46]" /> Initial Users
                    </label>
                    <input
                      type="number" min="1" required
                      value={usersCount} onChange={(e) => setUsersCount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Home size={16} className="text-[#359b46]" /> Units Managed
                    </label>
                    <input
                      type="number" min="0" required
                      value={unitsCount} onChange={(e) => setUnitsCount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm shadow-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Calendar size={16} className="text-[#359b46]" /> Billing Cycle
                  </label>
                  <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#359b46]/50 focus-within:border-[#359b46] text-sm shadow-sm bg-white">
                    <span className="text-slate-500 font-medium">Every</span>
                    <input
                      type="number" min="1" max="31" required
                      value={billingDay} onChange={(e) => setBillingDay(e.target.value)}
                      className="w-12 text-center outline-none font-bold text-[#0a1e3f] bg-slate-50 p-1 rounded-md"
                      disabled={isSubmitting}
                    />
                    <span className="text-slate-500 font-medium">of the month</span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <CreditCard size={16} className="text-[#359b46]" /> Billing Preview
                  </label>
                  <div className="w-full px-5 py-4 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Per-Asset Rate</p>
                      <p className="text-sm text-emerald-600 font-semibold">₱99 / unit / mo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#0a1e3f]">₱{((parseInt(unitsCount) || 0) * 99).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Est. Monthly MRR</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3 justify-end">
                <button
                  type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} disabled={isSubmitting}
                  className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >Cancel</button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#8bc994] text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-500/20 min-w-[160px]"
                >{isSubmitting ? "Creating..." : "Create Organization"}</button>
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
              <button 
                onClick={() => { if(!isSubmitting) { setIsEditModalOpen(false); resetForm(); } }}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full"
                disabled={isSubmitting}
              >
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
                  <input
                    type="text" required
                    value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Users size={16} className="text-[#1d82f5]" /> Max Team Users
                    </label>
                    <input
                      type="number" min="1" required
                      value={usersCount} onChange={(e) => setUsersCount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                      <Home size={16} className="text-[#1d82f5]" /> Units Allowed
                    </label>
                    <input
                      type="number" min="0" required
                      value={unitsCount} onChange={(e) => setUnitsCount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm shadow-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Calendar size={16} className="text-[#1d82f5]" /> Billing Cycle
                  </label>
                  <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#1d82f5]/50 focus-within:border-[#1d82f5] text-sm shadow-sm bg-white">
                    <span className="text-slate-500 font-medium">Every</span>
                    <input
                      type="number" min="1" max="31" required
                      value={billingDay} onChange={(e) => setBillingDay(e.target.value)}
                      className="w-12 text-center outline-none font-bold text-[#0a1e3f] bg-slate-50 p-1 rounded-md"
                      disabled={isSubmitting}
                    />
                    <span className="text-slate-500 font-medium">of the month</span>
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <CreditCard size={16} className="text-[#1d82f5]" /> MRR Impact
                  </label>
                  <div className="w-full px-5 py-4 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Per-Asset Rate</p>
                      <p className="text-sm text-blue-600 font-semibold">₱99 / unit / mo</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#0a1e3f]">₱{((parseInt(unitsCount) || 0) * 99).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">New Monthly MRR</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3 justify-end">
                <button
                  type="button" onClick={() => { setIsEditModalOpen(false); resetForm(); }} disabled={isSubmitting}
                  className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >Cancel</button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="bg-gradient-to-r from-[#1d82f5] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 min-w-[160px]"
                >{isSubmitting ? "Updating..." : "Save Limits"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SUCCESS MODAL */}
      {successData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-10 border border-emerald-100">
            <div className="w-24 h-24 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-emerald-50/50">
              <CheckCircle size={48} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight">Organization Active!</h2>
            <p className="text-slate-600 text-sm mb-8 leading-relaxed font-medium">
              <span className="font-extrabold text-slate-900 block text-base mb-1">{successData.orgName}</span> 
              is securely onboarded. Workspace access granted via <span className="font-bold text-[#1d82f5]">{successData.email}</span>.
            </p>
            <button
              onClick={() => setSuccessData(null)}
              className="w-full bg-[#0a1e3f] hover:bg-[#15305c] text-white px-6 py-4 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-[0.98]"
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