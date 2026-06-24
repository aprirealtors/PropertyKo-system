"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ChevronUp, ChevronDown, X, Building2, Mail, CreditCard, Lock, CheckCircle, Users, Home, AlertTriangle, Edit2 } from "lucide-react";

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Database Data State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // NEW: Edit modal state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{orgName: string, email: string} | null>(null);
  
  // Form State
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null); // NEW: Track which org is being edited
  const [orgName, setOrgName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [plan, setPlan] = useState("Growth");
  const [usersCount, setUsersCount] = useState("1");
  const [unitsCount, setUnitsCount] = useState("0");

  // Fetch organizations when the dashboard loads
  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false }); // Newest first

    if (error) {
      console.error("Error fetching organizations:", error);
    } else {
      setOrganizations(data || []);
    }
    setIsLoadingOrgs(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const resetForm = () => {
    setOrgName("");
    setAdminEmail("");
    setAdminPassword("");
    setPlan("Growth");
    setUsersCount("1");
    setUnitsCount("0");
    setEditingOrgId(null);
    setErrorMsg(null);
  };

  // --- ONBOARDING LOGIC ---
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // 1. BUSINESS LOGIC VALIDATION
    const requestedUnits = parseInt(unitsCount) || 0;
    
    if (plan === "Starter" && requestedUnits > 50) {
      setErrorMsg("Starter plan allows a maximum of 50 units. Please upgrade the plan or reduce the units.");
      setIsSubmitting(false);
      return; 
    }
    if (plan === "Growth" && requestedUnits > 250) {
      setErrorMsg("Growth plan allows a maximum of 250 units. Please upgrade the plan or reduce the units.");
      setIsSubmitting(false);
      return; 
    }

    try {
      // 2. CREATE THE LOGIN ACCOUNT
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            org_name: orgName,
            plan_type: plan,
            role: 'admin' 
          }
        }
      });

      if (authError && !authError.message.includes("Error sending confirmation email")) {
         throw new Error(`Auth Error: ${authError.message}`);
      }

      // 3. INSERT INTO DATABASE WITH USERS AND UNITS
      const { error: dbError } = await supabase
        .from('organizations')
        .insert([
          { 
            org_name: orgName, 
            admin_email: adminEmail, 
            plan: plan,
            users_count: parseInt(usersCount) || 1,
            units_count: requestedUnits
          }
        ]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      // Success! Show modal and refresh the table instantly
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

  // --- EDITING LOGIC ---
  const openEditModal = (org: any) => {
    setEditingOrgId(org.id);
    setOrgName(org.org_name);
    setPlan(org.plan);
    setUsersCount(org.users_count?.toString() || "1");
    setUnitsCount(org.units_count?.toString() || "0");
    setIsEditModalOpen(true);
    setErrorMsg(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrgId) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    // Validate limits based on plan
    const requestedUnits = parseInt(unitsCount) || 0;
    if (plan === "Starter" && requestedUnits > 50) {
      setErrorMsg("Starter plan allows a maximum of 50 units. Please upgrade the plan or reduce the units.");
      setIsSubmitting(false);
      return;
    }
    if (plan === "Growth" && requestedUnits > 250) {
      setErrorMsg("Growth plan allows a maximum of 250 units. Please upgrade the plan or reduce the units.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ 
          org_name: orgName, 
          plan: plan,
          users_count: parseInt(usersCount) || 1,
          units_count: requestedUnits
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

  // Calculate total units dynamically from database
  const totalUnits = organizations.reduce((sum, org) => sum + (org.units_count || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <header className="w-full bg-[#0a1e3f] text-white px-6 py-3 flex items-center justify-between shadow-md shrink-0 relative z-20">
        <div className="flex items-center gap-4">
          <div className="inline-block bg-white p-2.5 rounded-xl shadow-lg">
            <div className="relative w-35 h-9">
              <Image
                src="/logos.png"
                alt="PropertyKo Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div className="hidden sm:block bg-[#1e3a63] px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-[#2a4d7a] shadow-inner">
            Super admin
          </div>
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-sm"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a1e3f] mb-1 tracking-tight">Platform Console</h1>
            <p className="text-slate-500 text-sm font-medium">Manage all client organizations and platform health.</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#1d82f5] flex items-center justify-center font-bold text-lg border border-blue-100 shadow-sm shrink-0">
            SA
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard 
            title="ACTIVE ORGS" 
            value={organizations.length.toString()} 
            subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronUp size={14} strokeWidth={3} /> 0 this quarter</span>} 
          />
          <StatCard 
            title="UNITS MANAGED" 
            value={totalUnits.toString()} 
            subtext={<span className="text-[#359b46] font-medium">across all clients</span>} 
          />
          <StatCard 
            title="MRR" 
            value="₱0" 
            subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronUp size={14} strokeWidth={3} /> 0.0%</span>} 
          />
          <StatCard 
            title="CHURN" 
            value="0.0%" 
            subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronDown size={14} strokeWidth={3} /> healthy</span>} 
          />
        </div>

        {/* Organizations Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <h2 className="font-bold text-lg text-[#0a1e3f]">Organizations (Tenants)</h2>
            <button 
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="bg-[#1d82f5] hover:bg-blue-600 active:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm w-full sm:w-auto text-center flex items-center justify-center gap-2"
            >
              <Building2 size={16} />
              Onboard new org
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 text-xs uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Admin Email</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Users</th>
                  <th className="px-6 py-4">Units</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                
                {isLoadingOrgs ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading database...</td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Building2 size={32} className="text-slate-300" />
                        <p>No organizations onboarded yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  organizations.map((org, index) => (
                    <tr key={index} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-800">{org.org_name}</td>
                      <td className="px-6 py-4 text-slate-600">{org.admin_email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          org.plan === 'Enterprise' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{org.users_count || 1}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{org.units_count || 0}</td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge text="Active" color="green" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => openEditModal(org)}
                          className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-[#1d82f5] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Limits"
                        >
                          <Edit2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Cards: Platform Health & Feature Flags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Platform Health */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h3 className="font-bold text-lg text-[#0a1e3f] mb-6">Platform Health</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-700">Payment gateway (GCash)</span>
                <StatusBadge text="Operational" color="green" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">QR Ph settlement</span>
                <StatusBadge text="Operational" color="green" />
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h3 className="font-bold text-lg text-[#0a1e3f] mb-6">Feature Flags</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-700">Auto-accept tenants</span>
                <StatusBadge text="On · 18 orgs" color="green" />
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-700">Asset monetization beta</span>
                <StatusBadge text="3 orgs" color="blue" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Owner e-statements</span>
                <StatusBadge text="On · all" color="green" />
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs font-medium text-slate-400 pb-8">
          Super admin sees every org but never a tenant's private data — isolation is enforced per workspace.
        </div>
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Confirm Logout</h2>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to log out of the Super Admin dashboard?
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. ONBOARDING FORM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Onboard New Organization</h2>
              <button 
                onClick={() => {
                  if(!isSubmitting) {
                    setIsModalOpen(false);
                    resetForm();
                  }
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="p-6 overflow-y-auto max-h-[75vh]">
              {/* --- Rest of the exact same onboarding form inputs here --- */}
              {errorMsg && (
                <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Building2 size={16} className="text-[#359b46]" />
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Realty Group"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Mail size={16} className="text-[#359b46]" />
                    Primary Admin Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@apexrealty.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Lock size={16} className="text-[#359b46]" />
                    Initial Admin Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Create a strong password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all"
                    disabled={isSubmitting}
                    minLength={6}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Users size={16} className="text-[#359b46]" />
                      Initial Users
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={usersCount}
                      onChange={(e) => setUsersCount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Home size={16} className="text-[#359b46]" />
                      Units Managed
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={unitsCount}
                      onChange={(e) => setUnitsCount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <CreditCard size={16} className="text-[#359b46]" />
                    Subscription Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all bg-white"
                    disabled={isSubmitting}
                  >
                    <option value="Starter">Starter (Up to 50 units)</option>
                    <option value="Growth">Growth (Up to 250 units)</option>
                    <option value="Enterprise">Enterprise (Unlimited units)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#8bc994] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center min-w-[140px]"
                >
                  {isSubmitting ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT LIMITS MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Edit Organization Limits</h2>
              <button 
                onClick={() => {
                  if(!isSubmitting) {
                    setIsEditModalOpen(false);
                    resetForm();
                  }
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto max-h-[75vh]">
              {errorMsg && (
                <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Building2 size={16} className="text-[#1d82f5]" />
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm transition-all"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Users size={16} className="text-[#1d82f5]" />
                      Max Users Allowed
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={usersCount}
                      onChange={(e) => setUsersCount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Home size={16} className="text-[#1d82f5]" />
                      Units Managed
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={unitsCount}
                      onChange={(e) => setUnitsCount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm transition-all"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <CreditCard size={16} className="text-[#1d82f5]" />
                    Subscription Plan
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] text-sm transition-all bg-white"
                    disabled={isSubmitting}
                  >
                    <option value="Starter">Starter (Up to 50 units)</option>
                    <option value="Growth">Growth (Up to 250 units)</option>
                    <option value="Enterprise">Enterprise (Unlimited units)</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#1d82f5] hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center justify-center min-w-[140px]"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. SUCCESS MODAL */}
      {successData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 border border-emerald-100">
            <div className="w-20 h-20 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-emerald-50/50">
              <CheckCircle size={40} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-3 tracking-tight">Organization Onboarded!</h2>
            <p className="text-slate-600 text-[15px] mb-8 leading-relaxed">
              Organization <span className="font-bold text-slate-900">'{successData.orgName}'</span> successfully onboarded. They can now log in using <span className="font-bold text-[#1d82f5]">{successData.email}</span>.
            </p>
            <button
              onClick={() => setSuccessData(null)}
              className="w-full bg-[#0a1e3f] hover:bg-[#15305c] text-white px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Subcomponents
function StatCard({ title, value, subtext }: { title: string, value: string, subtext: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-36 hover:shadow-md transition-shadow">
      <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">{title}</div>
      <div>
        <div className="text-3xl font-extrabold text-[#0a1e3f] mt-1 mb-2 tracking-tight">{value}</div>
        <div className="text-xs">{subtext}</div>
      </div>
    </div>
  );
}

function StatusBadge({ text, color }: { text: string, color: 'green' | 'red' | 'orange' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    red: 'bg-red-50 text-red-700 border-red-200/60',
    orange: 'bg-amber-50 text-amber-700 border-amber-200/60',
    blue: 'bg-blue-50 text-[#1d82f5] border-blue-200/60',
  };

  return (
    <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${colors[color]}`}>
      {text}
    </span>
  );
}