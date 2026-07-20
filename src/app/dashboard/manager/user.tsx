"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, UserPlus, Shield, Mail, Lock, Home, UserCheck, Eye, EyeOff } from "lucide-react";

export default function UsersTab({ orgData }: any) {
  // Database States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("Tenant");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Initial Load
  useEffect(() => {
    if (orgData?.admin_email) {
      loadData();
    }
  }, [orgData]);

  // ✨ FIX: Refetch units when the role tab switches or usersList changes.
  // It will now fetch units from the DB even if the usersList is empty.
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchUnits(usersList || [], role);
    }
  }, [role, usersList, orgData?.admin_email]); 

  const loadData = async () => {
    setIsLoading(true);
    await fetchUsers();
    setIsLoading(false);
  };

  const fetchUsers = async () => {
    const { data: usersData, error: usersError } = await supabase
      .from('team_members')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .in('role', ['Tenant', 'Owner'])
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error("Error fetching users:", usersError);
    } else {
      setUsersList(usersData || []);
    }
  };

  const fetchUnits = async (currentUsers: any[], targetRole: string) => {
    // 1. Fetch units (where owners are stored)
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email); 

    // 2. Fetch active leases (for tenants)
    const { data: activeLeases } = await supabase
      .from('leases')
      .select('unit_id')
      .eq('admin_email', orgData.admin_email)
      .eq('status', 'Active');

    if (unitsData) {
      const assignedUnitStrings = new Set<string>();
      
      currentUsers.forEach(user => {
        if (user.access_level && user.role === targetRole) {
          const userUnits = user.access_level.split(", ");
          userUnits.forEach((u: string) => assignedUnitStrings.add(u));
        }
      });

      // Quick lookup for active leases
      const activeLeasedUnitIds = new Set((activeLeases || []).map(l => l.unit_id));

      const filteredUnits = unitsData.filter(unit => {
        const unitString = `${unit.property_name} - ${unit.unit_number}`;
        const isNotAssignedToSameRole = !assignedUnitStrings.has(unitString);
        
        const hasValidName = (nameValue: any) => {
          if (!nameValue) return false;
          const str = String(nameValue).trim().toLowerCase();
          return str !== '' && str !== 'n/a' && str !== 'none' && str !== '-' && str !== '—' && str !== 'null';
        };

        let isValidOccupant = false;
        
        if (targetRole === 'Tenant') {
          // A tenant can only be invited if they have a valid name AND an active lease exists
          isValidOccupant = hasValidName(unit.tenant_name) && activeLeasedUnitIds.has(unit.id);
        } else {
          // Check the owner_name directly from the units table
          isValidOccupant = hasValidName(unit.owner_name);
        }

        return isNotAssignedToSameRole && isValidOccupant;
      });

      const sortedUnits = filteredUnits.sort((a, b) => {
        const propA = a.property_name || "";
        const propB = b.property_name || "";
        const propCompare = propA.localeCompare(propB);
        
        if (propCompare !== 0) return propCompare; 
        
        const unitA = String(a.unit_number || "").trim();
        const unitB = String(b.unit_number || "").trim();

        const aStartsLetter = /^[a-zA-Z]/.test(unitA);
        const bStartsLetter = /^[a-zA-Z]/.test(unitB);

        if (aStartsLetter && !bStartsLetter) return -1;
        if (!aStartsLetter && bStartsLetter) return 1;

        return unitA.localeCompare(unitB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setAvailableUnits(sortedUnits);
    }
  };

  const handleUnitToggle = (unitString: string, unitData: any) => {
    setSelectedUnits(prev => {
      const isCurrentlySelected = prev.includes(unitString);
      
      if (!isCurrentlySelected) {
        // ✨ Auto-fill the Name and Email fields cleanly
        let occupantName = "";
        
        if (role === "Tenant") {
          occupantName = unitData.tenant_name || "";
        } else {
          // If there are multiple owners, split by comma and just take the primary (first) one
          if (unitData.owner_name) {
            occupantName = unitData.owner_name.split(',')[0].trim();
          }
        }
        
        const occupantEmail = role === "Tenant" ? unitData.tenant_email : unitData.owner_email;
        
        if (occupantName) setName(occupantName);
        if (occupantEmail) setEmail(occupantEmail);
        
        return [...prev, unitString];
      }
      
      return prev.filter(u => u !== unitString);
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    if (selectedUnits.length === 0) {
      setErrorMsg("Please assign at least one unit/property to this user.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Create user auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            org_name: orgData.org_name,
            role: role.toLowerCase(), 
            admin_parent: orgData.admin_email
          }
        }
      });

      if (authError && !authError.message.includes("Error sending confirmation email")) {
        throw new Error(`Auth Error: ${authError.message}`);
      }

      const finalAccessLevel = selectedUnits.join(", ");

      // Insert into team_members table
      const { error: dbError } = await supabase
        .from('team_members')
        .insert([
          { 
            admin_email: orgData.admin_email,
            name: name.trim(),
            email: email.trim(),
            role: role,
            access_level: finalAccessLevel,
            status: 'Active'
          }
        ]);

      if (dbError) throw new Error(`Database Error: ${dbError.message}`);

      // If Tenant, link their newly created email back to the leases table
      if (role === 'Tenant') {
        const { data: tenantLeases } = await supabase
          .from('leases')
          .select('id')
          .ilike('tenant_name', name.trim())
          .eq('admin_email', orgData.admin_email)
          .eq('status', 'Active');
          
        if (tenantLeases && tenantLeases.length > 0) {
          const leaseIds = tenantLeases.map(l => l.id);
          await supabase
            .from('leases')
            .update({ tenant_email: email.trim() })
            .in('id', leaseIds);
        }
      }

      await fetchUsers(); 
      setIsModalOpen(false);
      
      setName("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setRole("Tenant");
      setSelectedUnits([]);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "MG";

  const formatUnitsForTable = (accessLevelStr: string) => {
    if (!accessLevelStr) return "Not assigned";
    return accessLevelStr.split(", ").map(u => u.split(" - ")[1] || u).join(", ");
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Client Accounts</h2>
          <p className="text-slate-500 text-sm mt-1">Manage portal access for Owners and Tenants</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search accounts..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Manager</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-[#0a1e3f] text-lg">Active Accounts</h3>
          <button 
            onClick={() => {
              setErrorMsg(null);
              setIsModalOpen(true);
            }}
            className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            <UserPlus size={16} /> Add Account
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">NAME / EMAIL</th>
                <th className="px-6 py-4 whitespace-nowrap">ROLE</th>
                <th className="px-6 py-4 whitespace-nowrap">UNIT(S)</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading accounts...</td></tr>
              ) : usersList.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-medium">No tenants or owners onboarded yet.</td></tr>
              ) : (
                usersList.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#0a1e3f]">{user.name}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-bold text-xs px-2.5 py-1 rounded-full border ${
                        user.role === 'Owner' 
                          ? 'bg-purple-50 text-purple-700 border-purple-100' 
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium max-w-[200px] truncate" title={user.access_level}>
                      {formatUnitsForTable(user.access_level)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[11px] px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                        <UserCheck size={12} /> {user.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Create Account</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* TABS FOR OWNER / TENANT */}
              <div className="flex mb-6 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => { setRole("Tenant"); setSelectedUnits([]); setName(""); setEmail(""); }}
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${role === "Tenant" ? "border-[#359b46] text-[#359b46]" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                  disabled={isSubmitting}
                >
                  Tenant Account
                </button>
                <button
                  type="button"
                  onClick={() => { setRole("Owner"); setSelectedUnits([]); setName(""); setEmail(""); }}
                  className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${role === "Owner" ? "border-[#359b46] text-[#359b46]" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
                  disabled={isSubmitting}
                >
                  Owner Account
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                {/* DYNAMIC UNIT SELECTION */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      <Home size={16} className="text-[#359b46]" /> Select Unit
                    </label>
                  </div>
                  
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-slate-50/50">
                    {availableUnits.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        {role === 'Tenant' ? "No units with active leases found. You must declare a lease before creating a tenant account." : "No available units with assigned owners found."}
                      </p>
                    ) : (
                      availableUnits.map(unit => {
                        const unitString = `${unit.property_name} - ${unit.unit_number}`;
                        const isSelected = selectedUnits.includes(unitString);
                        // Clean display of the occupant name directly below the unit property
                        const occupantName = role === "Tenant" ? unit.tenant_name : (unit.owner_name ? unit.owner_name.split(',')[0].trim() : "");
                        
                        return (
                          <div 
                            key={unit.id} 
                            onClick={() => !isSubmitting && handleUnitToggle(unitString, unit)}
                            className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors border ${isSelected ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-white border-transparent'}`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              readOnly
                              className="w-4 h-4 text-[#359b46] rounded border-slate-300 focus:ring-[#359b46]"
                              disabled={isSubmitting}
                            />
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${isSelected ? 'text-[#0a1e3f]' : 'text-slate-700'}`}>
                                {unit.property_name} <span className="font-medium text-slate-500">• {unit.unit_number}</span>
                              </span>
                              {occupantName && (
                                <span className="text-xs text-slate-500 font-medium">
                                  {occupantName}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* FORM FIELDS */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <UserPlus size={16} className="text-[#359b46]" /> Full Name
                  </label>
                  <input type="text" required placeholder="e.g. Juan Reyes" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Mail size={16} className="text-[#359b46]" /> Login Email
                  </label>
                  <input type="email" required placeholder="juan@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" disabled={isSubmitting} />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Lock size={16} className="text-[#359b46]" /> Initial Password
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required 
                      minLength={6} 
                      placeholder="Minimum 6 characters" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      className="w-full px-4 py-2 pr-10 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm" 
                      disabled={isSubmitting} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                    {isSubmitting ? "Creating..." : "Create Account"}
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