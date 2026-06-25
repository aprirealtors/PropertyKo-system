"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, UserPlus, Shield, CreditCard, Mail, Lock } from "lucide-react";

export default function TeamTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [team, setTeam] = useState<any[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [currentPlan, setCurrentPlan] = useState(orgData?.plan || "Starter");
  const [seatLimit, setSeatLimit] = useState(orgData?.users_count || 1);

  // Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add User Form States
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState("Property manager");
  const [memberAccess, setMemberAccess] = useState("All properties");

  // Billing Form States
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTeam();
      setCurrentPlan(orgData.plan);
      setSeatLimit(orgData.users_count);
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
      // ✨ FIX: Filter out owners and tenants so they don't count towards paid seats!
      const filteredTeam = (data || []).filter(member => {
        const role = String(member.role).toLowerCase();
        return !role.includes('owner') && !role.includes('tenant');
      });
      setTeam(filteredTeam);
    }
    setIsLoadingTeam(false);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // Seat Limit Validation
    if (team.length + 1 >= seatLimit) {
      setErrorMsg(`You have reached your workspace limit of ${seatLimit} seats. Please upgrade your tier plan.`);
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. CREATE AUTH LOGIN ACCOUNT
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

      // 2. INSERT INTO team_members TABLE
      const { error: dbError } = await supabase
        .from('team_members')
        .insert([
          { 
            admin_email: orgData.admin_email,
            name: memberName.trim(),
            email: memberEmail,
            role: memberRole,
            access_level: memberAccess,
            status: 'Active' // Instantly active since account credentials are set
          }
        ]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      await fetchTeam();
      setIsInviteModalOpen(false);
      
      // Clear forms
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

  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    // Match new dynamic variables to requested specifications
    let newUsersCount = 1;
    let newUnitsCount = 50;
    
    if (selectedPlan === 'Growth') {
      newUsersCount = 5;
      newUnitsCount = 250;
    } else if (selectedPlan === 'Enterprise') {
      newUsersCount = 25;
      newUnitsCount = 99999; // Represents unlimited configuration logic safely
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ 
          plan: selectedPlan,
          users_count: newUsersCount,
          units_count: newUnitsCount
        })
        .eq('admin_email', orgData.admin_email);

      if (error) throw new Error(`Database Error: ${error.message}`);

      setCurrentPlan(selectedPlan);
      setSeatLimit(newUsersCount);
      setIsBillingModalOpen(false);
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  
  // Seat metrics calculations
  const seatsUsed = team.length + 1; 
  const seatPercentage = (seatsUsed / seatLimit) * 100;
  const costPerSeat = currentPlan === 'Enterprise' ? 499 : currentPlan === 'Growth' ? 299 : 0;
  const monthlyCost = seatsUsed * costPerSeat;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Team & subscription</h2>
          <p className="text-slate-500 text-sm mt-1">Users, roles and billing</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search team..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0a1e3f] text-lg">Team & roles</h3>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                + Add user
              </button>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">NAME</th>
                    <th className="px-6 py-4 whitespace-nowrap">ROLE</th>
                    <th className="px-6 py-4 whitespace-nowrap">ACCESS</th>
                    <th className="px-6 py-4 text-right whitespace-nowrap">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr className="bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-[#0a1e3f] whitespace-nowrap">You (Admin)</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-emerald-50 text-[#359b46] border border-emerald-100 font-bold text-xs px-2.5 py-1 rounded-full">Owner</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">Full access</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px] px-2.5 py-1 rounded-full">Active</span>
                    </td>
                  </tr>
                  
                  {isLoadingTeam ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading team...</td></tr>
                  ) : (
                    team.map(member => (
                      <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{member.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-600 font-bold text-xs px-2.5 py-1 rounded-full border border-slate-200">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{member.access_level}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px] px-2.5 py-1 rounded-full">
                            {member.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="m-6 mt-4 bg-emerald-50/50 p-4 rounded-xl text-[13px] text-slate-600 border border-emerald-100/50 font-medium leading-relaxed">
              Each role sees only its permitted modules - enforced securely at the layer system level.
            </div>
          </div>
        </div>

        {/* Subscription Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
            <h3 className="font-bold text-[#0a1e3f] text-lg mb-6 relative z-10">Subscription</h3>
            
            <div className="mb-8 relative z-10">
              <span className="text-slate-500 text-sm font-medium">Current plan</span>
              <h4 className="text-3xl font-extrabold text-[#0a1e3f] mb-1">{currentPlan}</h4>
              <p className="text-xs text-slate-400 font-medium">₱{costPerSeat} / seat / month · updates dynamically</p>
            </div>
            
            <div className="space-y-5 mb-8 relative z-10">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 font-medium">Seats used</span>
                  <span className="font-bold text-[#0a1e3f]">{seatsUsed} of {seatLimit}</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${seatPercentage >= 100 ? 'bg-red-500' : 'bg-[#359b46]'}`} style={{ width: `${Math.min(seatPercentage, 100)}%` }}></div>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-sm text-slate-600 font-medium">Max properties capacity</span>
                <span className="font-bold text-[#0a1e3f] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {currentPlan === 'Starter' ? '50 units' : currentPlan === 'Growth' ? '250 units' : 'Unlimited'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600 font-medium">Next invoice</span>
                <span className="font-bold text-[#0a1e3f]">01 Jul 2026 · ₱{monthlyCost.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto pt-4 relative z-10">
              <button 
                onClick={() => setIsBillingModalOpen(true)}
                className="w-full bg-white border-2 border-slate-200 hover:border-[#359b46] text-slate-700 hover:text-[#359b46] font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Manage billing
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ADD USER MODAL (With Auth Integration) */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Add Workspace User</h2>
              <button onClick={() => !isSubmitting && setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddUserSubmit} className="space-y-4">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><UserPlus size={16} className="text-[#359b46]" /> Full Name</label>
                  <input type="text" required placeholder="e.g. Maria Lopez" value={memberName} onChange={(e) => setMemberName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Mail size={16} className="text-[#359b46]" /> Login Email</label>
                  <input type="email" required placeholder="maria@company.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Lock size={16} className="text-[#359b46]" /> Initial Password</label>
                  <input type="password" required minLength={6} placeholder="Minimum 6 characters" value={memberPassword} onChange={(e) => setMemberPassword(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Shield size={16} className="text-[#359b46]" /> System Role</label>
                  <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white" disabled={isSubmitting}>
                    <option value="Property manager">Property Manager</option>
                    <option value="Maintenance staff">Maintenance Staff</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Property Scope Access</label>
                  <input type="text" required placeholder="e.g. All properties, Future Point Only" value={memberAccess} onChange={(e) => setMemberAccess(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div className="mt-6 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsInviteModalOpen(false)} disabled={isSubmitting} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] text-white px-6 py-2 rounded-lg text-sm font-semibold">
                    {isSubmitting ? "Creating Account..." : "Add User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE BILLING MODAL */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Manage Subscription</h2>
              <button onClick={() => !isSubmitting && setIsBillingModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleUpdateBilling} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                  <p className="text-sm text-slate-600 mb-1">Current Plan: <span className="font-bold text-[#0a1e3f]">{currentPlan}</span></p>
                  <p className="text-xs text-slate-500">Upgrading parameters adjusts your property units capacity instantly.</p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><CreditCard size={16} className="text-[#359b46]" /> Select Plan Tier</label>
                  <div className="space-y-3 mt-3">
                    
                    {/* Starter Option */}
                    <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Starter' ? 'border-[#359b46] bg-[#f0f9f1]' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="plan" value="Starter" checked={selectedPlan === 'Starter'} onChange={() => setSelectedPlan('Starter')} className="w-4 h-4 text-[#359b46] focus:ring-[#359b46]" />
                          <span className="font-bold text-[#0a1e3f]">Starter</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500">Free</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-7">1 manager seat · Up to 50 units</p>
                    </label>

                    {/* Growth Option */}
                    <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Growth' ? 'border-[#359b46] bg-[#f0f9f1]' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="plan" value="Growth" checked={selectedPlan === 'Growth'} onChange={() => setSelectedPlan('Growth')} className="w-4 h-4 text-[#359b46] focus:ring-[#359b46]" />
                          <span className="font-bold text-[#0a1e3f]">Growth</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500">₱299/mo</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-7">5 manager seats · Up to 250 units</p>
                    </label>

                    {/* Enterprise Option */}
                    <label className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === 'Enterprise' ? 'border-[#359b46] bg-[#f0f9f1]' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <input type="radio" name="plan" value="Enterprise" checked={selectedPlan === 'Enterprise'} onChange={() => setSelectedPlan('Enterprise')} className="w-4 h-4 text-[#359b46] focus:ring-[#359b46]" />
                          <span className="font-bold text-[#0a1e3f]">Enterprise</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500">₱499/mo</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 ml-7">25 manager seats · Unlimited units</p>
                    </label>
                  </div>
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsBillingModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting || selectedPlan === currentPlan} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
                    {isSubmitting ? "Updating..." : "Update Tier Plan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}