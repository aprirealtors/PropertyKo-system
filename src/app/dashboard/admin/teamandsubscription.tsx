"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, UserPlus, Shield, CreditCard, Mail, Lock, Home, Users, ArrowRight, Calendar } from "lucide-react";

// Helper function to calculate the actual upcoming date based on the declared billing day
const calculateNextBillingDate = (billingDay: number | undefined | null) => {
  if (!billingDay) return "Not Set";

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Create candidate date for the current month
  let targetDate = new Date(currentYear, currentMonth, billingDay);

  // If today is past the billing day, target the same day next month
  if (today.getDate() > billingDay) {
    targetDate = new Date(currentYear, currentMonth + 1, billingDay);
  }

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function TeamTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [team, setTeam] = useState<any[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  
  // Per-Asset Billing States
  const [currentPlan, setCurrentPlan] = useState(orgData?.plan || "Per Asset (₱99/unit)");
  const [seatLimit, setSeatLimit] = useState(orgData?.users_count || 1);
  const [unitLimit, setUnitLimit] = useState(orgData?.units_count || 0);

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

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTeam();
      setCurrentPlan(orgData.plan || "Per Asset (₱99/unit)");
      setSeatLimit(orgData.users_count || 1);
      setUnitLimit(orgData.units_count || 0);
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
      // Filter out owners and tenants so they don't count towards paid seats
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
      setErrorMsg(`You have reached your workspace limit of ${seatLimit} seats. Please contact support to increase your capacity.`);
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

  // --- PAYMENT HANDLER ---
  const handlePayment = () => {
    const amount = unitLimit * 99;
    // In a real scenario, this would redirect to PayMongo, GCash, or Stripe checkout
    alert(`Redirecting to secure payment gateway to settle ₱${amount.toLocaleString()}...`);
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  
  // Seat & Billing metrics calculations
  const seatsUsed = team.length + 1; 
  const seatPercentage = (seatsUsed / seatLimit) * 100;
  
  // New billing model: strictly based on unit count
  const monthlyCost = unitLimit * 99;

  // Actual Next Billing Date Calculation
  const nextBillingDateFormatted = calculateNextBillingDate(orgData?.billing_day);
  
  const billingStatus = orgData?.billing_status || 'Pending'; // 'Pending', 'Paid', or 'Late'

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'late': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': default: return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

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
              <h4 className="text-3xl font-extrabold text-[#0a1e3f] mb-1">Per Asset</h4>
              <p className="text-xs text-slate-400 font-medium">₱99 / unit / month · updates dynamically</p>
            </div>
            
            <div className="space-y-5 mb-8 relative z-10">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600 font-medium">Team seats used</span>
                  <span className="font-bold text-[#0a1e3f]">{seatsUsed} of {seatLimit}</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${seatPercentage >= 100 ? 'bg-red-500' : 'bg-[#359b46]'}`} style={{ width: `${Math.min(seatPercentage, 100)}%` }}></div>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-slate-200">
                <span className="text-sm text-slate-600 font-medium">Units capacity</span>
                <span className="font-bold text-[#0a1e3f] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {unitLimit} units
                </span>
              </div>
              
              {/* Actual Date Display */}
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600 font-medium">Next Invoice</span>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-bold text-[#0a1e3f] text-sm">{nextBillingDateFormatted}</span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(billingStatus)}`}>
                    {billingStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 relative z-10 space-y-3">
              <button 
                onClick={() => setIsBillingModalOpen(true)}
                className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                View billing details
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

      {/* VIEW DETAILS MODAL (Read-Only + Payment) */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Subscription Details</h2>
              <button onClick={() => setIsBillingModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-5">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-2 flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Current Billing: <span className="font-bold text-[#0a1e3f]">Per-Asset</span></p>
                    <p className="text-xs text-slate-500">For limit increases, contact admin.</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold uppercase tracking-wider ${getStatusColor(billingStatus)}`}>
                    {billingStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 rounded-lg bg-white">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Home size={16} className="text-[#359b46]" />
                      Units Capacity
                    </label>
                    <p className="text-2xl font-extrabold text-[#0a1e3f] mt-1">{unitLimit}</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-lg bg-white">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Users size={16} className="text-[#359b46]" />
                      Team Limit
                    </label>
                    <p className="text-2xl font-extrabold text-[#0a1e3f] mt-1">{seatLimit}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1.5">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-[#359b46]" />
                      Estimated Monthly Total
                    </div>
                  </label>
                  <div className="w-full px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Due on {nextBillingDateFormatted}</p>
                      <p className="text-xs text-emerald-600 font-medium">₱99 per unit / month</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-[#0a1e3f]">
                        ₱{(unitLimit * 99).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={handlePayment} 
                    className="w-full sm:w-auto bg-[#359b46] hover:bg-[#2c813a] text-white px-8 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} />
                    Pay ₱{(unitLimit * 99).toLocaleString()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}