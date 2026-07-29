"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, Users, X, MapPin, CheckCircle, BellRing, Check, CalendarDays, AlertTriangle } from "lucide-react";

export default function LeasingAndTenantsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [leasesList, setLeasesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ADDED: Search State
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchData();
    }
  }, [orgData?.admin_email]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Leases (Joining with Units to get Property & Owner details)
    const { data: leases, error: leaseError } = await supabase
      .from('leases')
      .select('*, units!inner(property_name, unit_number, owner_name, monthly_rent)')
      .eq('admin_email', orgData.admin_email)
      .order('created_at', { ascending: false });

    if (leaseError) {
      console.error("Error fetching leases:", leaseError);
    } else {
      setLeasesList(leases || []);
    }

    setIsLoading(false);
  };

  const handleOpenApproveModal = (leaseId?: string) => {
    setErrorMsg(null);
    const pendingLeases = leasesList.filter(l => l.status === 'Pending');
    
    // If a specific lease was clicked from the table
    if (leaseId) {
      const lease = pendingLeases.find(l => l.id === leaseId);
      if (lease) {
        setSelectedLeaseId(lease.id);
        setTenantName(lease.tenant_name);
        setStartDate(lease.start_date || "");
        setEndDate(lease.end_date || "");
      }
    } 
    // Otherwise, just pick the first pending lease if clicking the top button
    else if (pendingLeases.length > 0) {
      setSelectedLeaseId(pendingLeases[0].id);
      setTenantName(pendingLeases[0].tenant_name);
      setStartDate(pendingLeases[0].start_date || "");
      setEndDate(pendingLeases[0].end_date || "");
    } else {
      setSelectedLeaseId("");
      setTenantName("");
      setStartDate("");
      setEndDate("");
    }
    
    setIsModalOpen(true);
  };

  const handleLeaseSelectionChange = (leaseId: string) => {
    setSelectedLeaseId(leaseId);
    
    const pending = leasesList.find(l => l.id === leaseId);
    if (pending) {
      setTenantName(pending.tenant_name);
      setStartDate(pending.start_date || "");
      setEndDate(pending.end_date || "");
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) {
      setErrorMsg("Please select a pending lease request.");
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const targetLease = leasesList.find(l => l.id === selectedLeaseId);
      if (!targetLease) throw new Error("Lease not found");

      // 1. Update the existing lease to 'Active'
      const { error: updateError } = await supabase
        .from('leases')
        .update({ 
          status: 'Active', 
          tenant_name: tenantName.trim(), 
          start_date: startDate, 
          end_date: endDate 
        })
        .eq('id', selectedLeaseId);

      if (updateError) throw new Error(`Lease Update Error: ${updateError.message}`);

      // 2. Sync the tenant details to the physical unit so it marks as Occupied
      const { error: unitError } = await supabase
        .from('units')
        .update({
          status: 'Occupied',
          tenant_name: tenantName.trim(),
          monthly_rent: targetLease.monthly_rent || 0
        })
        .eq('id', targetLease.unit_id);

      if (unitError) throw new Error(`Unit Update Error: ${unitError.message}`);

      // Refresh Data
      await fetchData();
      setIsModalOpen(false);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-300 italic">—</span>;
    return <span className="font-semibold text-slate-600">{new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  const pendingLeases = leasesList.filter(l => l.status === 'Pending');

  // ADDED: Filter logic para sa search bar
  const filteredLeases = leasesList.filter(lease => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (lease.tenant_name && lease.tenant_name.toLowerCase().includes(searchLower)) ||
      (lease.units?.property_name && lease.units.property_name.toLowerCase().includes(searchLower)) ||
      (lease.units?.unit_number && String(lease.units.unit_number).toLowerCase().includes(searchLower)) ||
      (lease.units?.owner_name && lease.units.owner_name.toLowerCase().includes(searchLower))
    );
  });

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL: Sagad sa bottom, walang double scroll
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Static Shrink Block (Fixed Header Zone) */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          
          {/* Left Side: Title & Overview */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200/50 shadow-sm">
                <Users className="text-[#1d82f5]" size={24} strokeWidth={2.5} />
              </div>
              Leasing & Tenants
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Review assignments and active contracts
            </p>
          </div>
          
          {/* Right Side: Search & Admin Badge */}
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-64 group">
              
              {/* ✨ FIX: Nagdagdag ng z-10 at pointer-events-none para pumabaw sa input field at hindi matakpan! */}
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#359b46] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              
              <input 
                type="text"
                placeholder="Search tenants, units..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white relative"
              />
            </div>

            {/* Premium Admin Profile Badge (Now visible on mobile, hides text only) */}
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

      {/* 🌟 NEW TENANT NOTIFICATION BANNER */}
      {pendingLeases.length > 0 && (
        <div className="shrink-0 mb-5 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mx-1 sm:mx-0">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-inner border border-amber-200 shrink-0">
              <BellRing size={22} strokeWidth={2.5} className="animate-[wiggle_1s_ease-in-out_infinite]" />
            </div>
            <div>
              <h4 className="font-black text-amber-900 text-sm sm:text-base tracking-tight">New Tenant Assignment Awaiting Approval</h4>
              <p className="text-xs sm:text-sm text-amber-700/80 font-semibold mt-0.5">Property Owners have submitted <strong className="text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded">{pendingLeases.length}</strong> new tenant(s). Please review below.</p>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 ACTION CONTROLS ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0 px-1 sm:px-0">
        <div className="flex items-center gap-3">
          <h3 className="font-black text-[#0a1e3f] text-base tracking-tight">Lease Contracts</h3>
          {pendingLeases.length > 0 && (
            <span className="bg-amber-100 text-amber-700 border border-amber-200/60 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shadow-sm animate-pulse">
              {pendingLeases.length} Pending
            </span>
          )}
        </div>
        <div className="flex w-full sm:w-auto mt-2 sm:mt-0">
          <button 
            onClick={() => handleOpenApproveModal()}
            disabled={pendingLeases.length === 0}
            className={`w-full sm:w-auto flex-1 sm:flex-none justify-center px-6 py-3.5 sm:py-2.5 rounded-xl text-xs uppercase tracking-widest font-black transition-all active:scale-95 flex items-center gap-2 ${
              pendingLeases.length === 0 
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none" 
                : "bg-[#359b46] hover:bg-[#2c813a] text-white shadow-[0_4px_15px_rgba(53,155,70,0.25)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)]"
            }`}
          >
            Review Pending Leases
          </button>
        </div>
      </div>

      {/* 🌟 PREMIUM TABLE WRAPPER (Scrollable Body Sagad Bottom) */}
      <div className="flex-1 w-full min-h-0 bg-white rounded-t-[2rem] shadow-sm border border-slate-200/80 border-b-0 overflow-hidden flex flex-col mt-2">
        <div className="flex-1 overflow-x-auto overflow-y-auto pb-24">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 text-[10px] uppercase font-black tracking-widest sticky top-0 z-20 shadow-sm border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Owner</th>
                <th className="px-6 py-4 whitespace-nowrap">Tenant</th>
                <th className="px-6 py-4 whitespace-nowrap">Unit</th>
                <th className="px-6 py-4 whitespace-nowrap">Lease Start</th>
                <th className="px-6 py-4 whitespace-nowrap">Lease Ends</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-slate-700">
              
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-5 bg-slate-200 rounded-lg w-16"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-slate-100 rounded-md w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : leasesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-2">
                        <Users size={32} className="text-slate-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">No active or pending leases found</p>
                      <p className="text-slate-400 text-xs">When owners assign tenants, they will appear here for approval.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLeases.length === 0 ? (
                // ✨ 4. ADDED: Bagong empty state kapag walang match sa search query
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-2">
                        <Search size={32} className="text-slate-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">No exact matches found</p>
                      <p className="text-slate-400 text-xs">Try adjusting your search query: <span className="font-semibold text-slate-500">"{searchQuery}"</span></p>
                    </div>
                  </td>
                </tr>
              ) : (
                // ✨ 5. UPDATED: leasesList.map pinalitan ng filteredLeases.map
                filteredLeases.map((lease) => {
                  const isActive = lease.status === 'Active';
                  
                  return (
                    <tr key={lease.id} className={`group transition-colors ${isActive ? 'hover:bg-slate-50/80' : 'bg-amber-50/40 hover:bg-amber-50/80'}`}>
                      <td className="px-6 py-4 font-bold text-slate-500 whitespace-nowrap">
                        {lease.units?.owner_name || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className={`px-6 py-4 font-black whitespace-nowrap ${isActive ? 'text-[#0a1e3f]' : 'text-amber-900'}`}>
                        {lease.tenant_name}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 whitespace-nowrap">
                        {lease.units?.property_name} {lease.units?.unit_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(lease.start_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatDate(lease.end_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="bg-emerald-50 text-emerald-700 font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider border border-emerald-200/60 shadow-sm">
                            Active
                          </span>
                        ) : (
                          <span className="bg-white text-amber-600 font-black px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider border border-amber-200 shadow-sm">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {!isActive ? (
                          <button 
                            onClick={() => handleOpenApproveModal(lease.id)}
                            className="bg-[#1d82f5] hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="flex items-center justify-end gap-1.5 text-[#359b46] text-[10px] font-black uppercase tracking-widest bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-transparent group-hover:border-emerald-100 inline-flex w-fit ml-auto">
                            <CheckCircle size={14} strokeWidth={3} /> Approved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 PREMIUM APPROVAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight relative z-10 flex items-center gap-2">
                <CheckCircle className="text-[#359b46]" size={24} strokeWidth={2.5} />
                Approve Lease
              </h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar bg-slate-50/50">
              <form onSubmit={handleApproveSubmit} className="space-y-6">
                {errorMsg && <div className="mb-5 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-200/60 shadow-sm flex items-center gap-3"><AlertTriangle size={18} /> {errorMsg}</div>}

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <MapPin size={14} className="text-[#359b46]" /> Pending Request Selection
                  </label>
                  {pendingLeases.length === 0 ? (
                    <div className="p-4 text-sm font-bold text-amber-700 bg-amber-50 rounded-xl border border-amber-200/60">
                      There are no pending lease requests to approve.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedLeaseId}
                      onChange={(e) => handleLeaseSelectionChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all"
                      disabled={isSubmitting}
                    >
                      {pendingLeases.map((lease) => (
                        <option key={lease.id} value={lease.id}>
                          {lease.units?.property_name} {lease.units?.unit_number} — Requested by {lease.units?.owner_name || 'Owner'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <Users size={14} className="text-[#359b46]" /> Tenant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-[#0a1e3f] bg-slate-50 focus:bg-white transition-all"
                    disabled={isSubmitting || pendingLeases.length === 0}
                  />
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                      <CalendarDays size={14} className="text-[#359b46]" /> Start Date
                    </label>
                    <input 
                      required type="date"
                      value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all" 
                      disabled={isSubmitting || pendingLeases.length === 0}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
                      <CalendarDays size={14} className="text-[#359b46]" /> End Date
                    </label>
                    <input 
                      required type="date"
                      value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all" 
                      disabled={isSubmitting || pendingLeases.length === 0}
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="mt-8 flex gap-3 sm:justify-end pt-5 border-t border-slate-200/80 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 sm:px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl transition-all active:scale-95">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting || pendingLeases.length === 0} className="flex-1 sm:flex-none bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:shadow-none text-white px-4 sm:px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center sm:min-w-[140px]">
                    {isSubmitting ? <span className="animate-pulse">Processing...</span> : "Approve"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Wiggle Animation for Bell */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes wiggle {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
      `}} />

    </div>
  );
}