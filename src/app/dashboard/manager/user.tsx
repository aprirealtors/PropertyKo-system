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
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = usersList.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const assignedUnits = user.access_level ? user.access_level.toLowerCase() : "";
    return (
      (user.name && user.name.toLowerCase().includes(searchLower)) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.role && user.role.toLowerCase().includes(searchLower)) ||
      assignedUnits.includes(searchLower)
    );
  });

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
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Fixed Header Zone */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm">
                <UserCheck className="text-[#359b46]" size={24} strokeWidth={2.5} />
              </div>
              Client Accounts
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Manage portal access for Owners and Tenants
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#359b46] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search accounts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white relative" 
              />
            </div>

            {/* Premium Admin Profile Badge */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Manager</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-[#359b46] hover:bg-[#2c813a] text-white flex items-center justify-center font-black text-xs shadow-inner group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ FULL WIDTH KANBAN DATA TABLE CONTAINER */}
      <div className="flex-1 w-full max-w-7xl mx-auto min-h-0 flex flex-col px-1 sm:px-0 pb-6 lg:pb-12">
        <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-sm border border-slate-200/80 flex flex-col overflow-hidden relative">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

          {/* Table Header Section */}
          <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/80 backdrop-blur-sm shrink-0 z-10 gap-4">
            <h3 className="font-black text-lg text-[#0a1e3f] tracking-tight">Active Accounts</h3>
            <button 
              onClick={() => {
                setErrorMsg(null);
                setIsModalOpen(true);
              }}
              className="bg-[#359b46] hover:bg-[#2c813a] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.25)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <UserPlus size={16} strokeWidth={2.5} /> Add Account
            </button>
          </div>
          
          {/* Scrollable Table Area */}
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar relative z-10 w-full">
            <table className="w-full text-left text-sm relative min-w-[600px]">
              <thead className="text-emerald-50 bg-[#359b46] font-extrabold uppercase tracking-widest border-b border-[#2c813a] sticky top-0 z-20 text-[10px] shadow-md">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Name / Email</th>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Role</th>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Unit(s) Assigned</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Status</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                {isLoading ? (
                  /* ✨ SKELETON LOADING ROWS */
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-40 bg-slate-200 rounded-md mb-2"></div>
                        <div className="h-3 w-32 bg-slate-100 rounded-md"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 w-20 bg-slate-100 rounded-full"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 w-48 bg-slate-200 rounded-md"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap flex justify-end">
                        <div className="h-6 w-20 bg-emerald-50 rounded-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  /* EMPTY STATE */
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mx-auto mb-4">
                        <Search size={28} className="text-slate-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">
                        {searchQuery ? "No matching accounts found." : "No accounts onboarded yet."}
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        {searchQuery ? "Try adjusting your search term." : "Click \"Add Account\" to invite tenants or owners."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  /* ACTUAL DATA ROWS */
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 border-r border-slate-50">
                        <div className="font-black text-[#0a1e3f] tracking-tight">{user.name}</div>
                        <div className="text-slate-500 font-semibold text-xs mt-0.5">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap border-r border-slate-50">
                        <span className={`font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${
                          user.role === 'Owner' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200/60' 
                            : 'bg-blue-50 text-blue-700 border-blue-200/60'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-bold text-xs max-w-[250px] truncate border-r border-slate-50" title={user.access_level}>
                        {formatUnitsForTable(user.access_level)}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm inline-flex items-center gap-1.5 group-hover:bg-[#359b46] group-hover:text-white transition-colors">
                          <UserCheck size={14} strokeWidth={2.5} /> {user.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 🌟 PREMIUM CREATE USER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] border border-slate-200/80 animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl font-black text-[#0a1e3f] tracking-tight relative z-10 flex items-center gap-2">
                <UserPlus className="text-[#359b46]" size={22} strokeWidth={2.5} />
                Create Account
              </h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/40">
              {/* TABS FOR OWNER / TENANT */}
              <div className="flex p-1.5 bg-white border border-slate-200 rounded-xl mb-6 shadow-sm">
                <button
                  type="button"
                  onClick={() => { setRole("Tenant"); setSelectedUnits([]); setName(""); setEmail(""); }}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${role === "Tenant" ? "bg-blue-50 text-blue-600 border border-blue-200/60 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-700"}`}
                  disabled={isSubmitting}
                >
                  Tenant Account
                </button>
                <button
                  type="button"
                  onClick={() => { setRole("Owner"); setSelectedUnits([]); setName(""); setEmail(""); }}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${role === "Owner" ? "bg-purple-50 text-purple-600 border border-purple-200/60 shadow-sm" : "bg-transparent text-slate-500 hover:text-slate-700"}`}
                  disabled={isSubmitting}
                >
                  Owner Account
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-5">
                {errorMsg && <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200">{errorMsg}</div>}

                {/* DYNAMIC UNIT SELECTION */}
                <div>
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <Home size={14} className={role === 'Owner' ? 'text-purple-500' : 'text-blue-500'} /> Select Unit Allocation
                  </label>
                  
                  <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200/80 rounded-xl p-2 space-y-1 bg-white shadow-inner">
                    {availableUnits.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 text-center py-6 px-4">
                        {role === 'Tenant' ? "No active leases found. You must declare a lease before creating a tenant account." : "No units found with assigned owners."}
                      </p>
                    ) : (
                      availableUnits.map(unit => {
                        const unitString = `${unit.property_name} - ${unit.unit_number}`;
                        const isSelected = selectedUnits.includes(unitString);
                        const occupantName = role === "Tenant" ? unit.tenant_name : (unit.owner_name ? unit.owner_name.split(',')[0].trim() : "");
                        
                        return (
                          <div 
                            key={unit.id} 
                            onClick={() => !isSubmitting && handleUnitToggle(unitString, unit)}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? (role === 'Owner' ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-blue-50 border-blue-200 shadow-sm') : 'hover:bg-slate-50 border-transparent'}`}
                          >
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              readOnly
                              className={`w-4 h-4 rounded border-slate-300 ${role === 'Owner' ? 'text-purple-600 focus:ring-purple-600' : 'text-blue-600 focus:ring-blue-600'}`}
                              disabled={isSubmitting}
                            />
                            <div className="flex flex-col">
                              <span className={`text-sm font-black tracking-tight ${isSelected ? 'text-[#0a1e3f]' : 'text-slate-700'}`}>
                                {unit.property_name} <span className="font-bold text-slate-400 ml-1">/ {unit.unit_number}</span>
                              </span>
                              {occupantName && (
                                <span className="text-[11px] text-slate-500 font-bold mt-0.5">
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
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Full Name</label>
                    <div className="relative">
                      <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" required placeholder="e.g. Juan Reyes" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all" disabled={isSubmitting} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Login Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="email" required placeholder="juan@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all" disabled={isSubmitting} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Initial Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        minLength={6} 
                        placeholder="Minimum 6 characters" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all" 
                        disabled={isSubmitting} 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-5 border-t border-slate-200/60 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl transition-all active:scale-95">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center sm:min-w-[150px]">
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