"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Search, Users, X, MapPin, CheckCircle, BellRing, Check, 
  CalendarDays, AlertTriangle, FolderOpen, Clock, FileText, 
  Download 
} from "lucide-react";

export default function LeasingAndTenantsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [leasesList, setLeasesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States (Approve)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal States (View Contract)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewLeaseData, setViewLeaseData] = useState<any>(null);

  // Form States
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Search State
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
    
    // If a specific lease was clicked from the grid
    if (leaseId) {
      const lease = pendingLeases.find(l => l.id === leaseId);
      if (lease) {
        setSelectedLeaseId(lease.id);
        setTenantName(lease.tenant_name);
        setStartDate(lease.start_date || "");
        setEndDate(lease.end_date || "");
      }
    } 
    // Otherwise, pick the first pending lease
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

  // Open View Modal
  const handleViewContract = (lease: any) => {
    setViewLeaseData(lease);
    setIsViewModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-300 italic">—</span>;
    return <span className="font-bold text-slate-700">{new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  const pendingLeases = leasesList.filter(l => l.status === 'Pending');

  // Filter logic for the search bar
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
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500 bg-[#f4f7f9]">
      
      {/* 🌟 PREMIUM HEADER - Static Shrink Block */}
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
              Manage and organize owner and tenant lease records
            </p>
          </div>
          
          {/* Right Side: Search & Admin Badge */}
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#359b46] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              <input 
                type="text"
                placeholder="Search tenant, owner, unit..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white relative"
              />
            </div>

            {/* Admin Profile Badge */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Admin</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-[#359b46] text-white flex items-center justify-center font-black text-xs shadow-inner group-hover:scale-105 transition-transform duration-300">
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
              <h4 className="font-black text-amber-900 text-sm sm:text-base tracking-tight">New Lease Awaiting Approval</h4>
              <p className="text-xs sm:text-sm text-amber-700/80 font-semibold mt-0.5">Owners have declared <strong className="text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded">{pendingLeases.length}</strong> new tenant(s). Please review the pending folders below.</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenApproveModal()}
            className="hidden sm:flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all shrink-0"
          >
            Review All
          </button>
        </div>
      )}

      {/* 🌟 FOLDER GRID SYSTEM */}
      <div className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar pb-24 px-1 sm:px-0">
        
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col h-full animate-pulse mt-4">
                <div className="w-1/2 h-8 bg-slate-200 rounded-t-xl z-10 translate-y-[1px]"></div>
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-b-2xl rounded-tr-2xl p-5 h-56"></div>
              </div>
            ))}
          </div>
        ) : leasesList.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm mt-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
              <FolderOpen size={36} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-slate-700 font-black text-xl">No Lease Folders Found</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">When owners declare tenants, their lease folders will be generated here automatically.</p>
          </div>
        ) : filteredLeases.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-slate-200/60 shadow-sm mt-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
              <Search size={36} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-slate-700 font-black text-xl">No Matches Found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search query for "{searchQuery}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-6 sm:gap-x-6 sm:gap-y-8 mt-2">
            {filteredLeases.map((lease) => {
              const isActive = lease.status === 'Active';
              
              return (
                <div key={lease.id} className="flex flex-col h-full group hover:-translate-y-1 transition-transform duration-300">
                  
                  {/* ✨ The "Folder Tab" */}
                  <div className="flex items-end">
                    <div className={`px-4 py-2 rounded-t-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 z-10 border-t border-l border-r relative shadow-[0_-2px_6px_rgba(0,0,0,0.02)] translate-y-[1px] transition-colors ${
                      isActive 
                        ? 'bg-emerald-50 text-[#359b46] border-emerald-200/60' 
                        : 'bg-amber-50 text-amber-600 border-amber-200/60'
                    }`}>
                      {isActive ? <CheckCircle size={14} /> : <Clock size={14} />}
                      {lease.status}
                    </div>
                  </div>
                  
                  {/* ✨ The "Folder Body" */}
                  <div className={`flex-1 bg-white border rounded-b-[1.5rem] rounded-tr-[1.5rem] p-5 sm:p-6 shadow-sm group-hover:shadow-[0_8px_25px_rgba(0,0,0,0.05)] transition-all flex flex-col relative overflow-hidden ${
                      isActive ? 'border-emerald-200/60 border-t-emerald-200/60' : 'border-amber-200/60 border-t-amber-200/60'
                  }`}>
                    
                    {/* Decorative Folder Icon Watermark */}
                    <FolderOpen className="absolute -bottom-6 -right-6 text-slate-50 opacity-[0.4] w-32 h-32 rotate-[-10deg] pointer-events-none" />

                    {/* Tenant & Unit Info */}
                    <div className="mb-5 relative z-10">
                      <h4 className="text-xl font-black text-[#0a1e3f] truncate tracking-tight">{lease.tenant_name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-slate-400" />
                        <p className="text-xs font-bold text-slate-500 truncate">{lease.units?.property_name} · Unit {lease.units?.unit_number}</p>
                      </div>
                    </div>

                    {/* Lease Details Box */}
                    <div className="space-y-4 mb-6 flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 relative z-10">
                      
                      <div className="flex flex-col gap-1 pb-3 border-b border-slate-200/60">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Users size={12}/> Property Owner</span>
                        <span className="text-sm font-bold text-slate-700 truncate">{lease.units?.owner_name || <span className="italic text-slate-400">Unassigned</span>}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays size={12}/> Start Date</span>
                          <span className="text-sm">{formatDate(lease.start_date)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays size={12}/> End Date</span>
                          <span className="text-sm">{formatDate(lease.end_date)}</span>
                        </div>
                      </div>

                    </div>

                    {/* Action Area */}
                    <div className="mt-auto relative z-10">
                      {!isActive ? (
                        <button 
                          onClick={() => handleOpenApproveModal(lease.id)}
                          className="w-full bg-gradient-to-b from-[#1d82f5] to-[#1565c0] hover:from-[#1565c0] hover:to-[#0f4d92] text-white px-4 py-3.5 rounded-[12px] text-xs font-black uppercase tracking-widest transition-all shadow-[0_4px_10px_rgba(29,130,245,0.3)] active:scale-95 flex items-center justify-center gap-2 group/btn"
                        >
                          <AlertTriangle size={16} className="group-hover/btn:animate-pulse" /> Review & Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewContract(lease)} 
                          className="w-full bg-emerald-50 hover:bg-emerald-100 text-[#359b46] px-4 py-3.5 rounded-[12px] text-xs font-black uppercase tracking-widest border border-emerald-200/60 hover:border-emerald-300 transition-all flex items-center justify-center gap-2 shadow-inner active:scale-95 group/btn"
                        >
                          <CheckCircle size={18} strokeWidth={2.5} className="group-hover/btn:scale-110 transition-transform" /> View Contract
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                {errorMsg && <div className="mb-5 p-4 bg-red-50 text-red-600 text-[13px] font-bold rounded-2xl border border-red-200/60 shadow-sm flex items-center gap-3"><AlertTriangle size={18} className="shrink-0" /> {errorMsg}</div>}

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <FolderOpen size={14} className="text-[#359b46]" /> Pending Folder Selection
                  </label>
                  {pendingLeases.length === 0 ? (
                    <div className="p-4 text-sm font-bold text-amber-700 bg-amber-50 rounded-xl border border-amber-200/60">
                      There are no pending folders to approve.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedLeaseId}
                      onChange={(e) => handleLeaseSelectionChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all appearance-none cursor-pointer"
                      disabled={isSubmitting}
                    >
                      {pendingLeases.map((lease) => (
                        <option key={lease.id} value={lease.id}>
                          {lease.units?.property_name} {lease.units?.unit_number} - Requested by {lease.units?.owner_name || 'Owner'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
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
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
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
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
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

                <div className="mt-8 flex gap-3 pt-5 border-t border-slate-200/80 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 sm:px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl transition-all active:scale-95">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting || pendingLeases.length === 0} className="flex-1 bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:from-[#2c813a] disabled:bg-slate-300 disabled:shadow-none text-white px-4 sm:px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center">
                    {isSubmitting ? <span className="animate-pulse">Processing...</span> : "Approve & Activate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 VIEW CONTRACT MODAL */}
      {isViewModalOpen && viewLeaseData && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight relative z-10 flex items-center gap-2">
                <FileText className="text-[#359b46]" size={24} strokeWidth={2.5} />
                Contract Details
              </h2>
              <button onClick={() => setIsViewModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar bg-slate-50/50 space-y-5">
              
              {/* Tenant & Property Overview */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                <div>
                  <h4 className="text-xl font-black text-[#0a1e3f]">{viewLeaseData.tenant_name}</h4>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400"/>
                      {viewLeaseData.units?.property_name} · Unit {viewLeaseData.units?.unit_number}
                    </p>
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400"/>
                      Owner: <span className="text-slate-700">{viewLeaseData.units?.owner_name || <span className="italic text-slate-400">Unassigned</span>}</span>
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200/60 text-[#359b46] rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle size={14} /> Active
                </div>
              </div>

              {/* Two Column details: Dates & Rent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Dates */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                      <CalendarDays size={14} className="text-[#359b46]" /> Lease Start
                    </label>
                    <div className="text-sm font-bold text-slate-700">{formatDate(viewLeaseData.start_date)}</div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                      <CalendarDays size={14} className="text-[#359b46]" /> Lease End
                    </label>
                    <div className="text-sm font-bold text-slate-700">{formatDate(viewLeaseData.end_date)}</div>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col justify-center">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <span className="text-[#359b46] font-black text-xs leading-none">₱</span> Monthly Rent Amount
                  </label>
                  <div className="text-3xl font-black text-[#0a1e3f]">
                    ₱{(viewLeaseData.units?.monthly_rent || viewLeaseData.monthly_rent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-2">Agreed upon monthly rate.</p>
                </div>

              </div>

              {/* PDF Document Download Area */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                  <FileText size={14} className="text-[#359b46]" /> Contract Document
                </label>
                
                {/* Check if a document exists. We assume `document_url` or `lease_document_url` might be present */}
                {viewLeaseData.document_url || viewLeaseData.lease_document_url ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
                        <FileText size={18} className="text-[#359b46]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0a1e3f]">Lease Agreement</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">PDF Document</p>
                      </div>
                    </div>
                    
                    <a 
                      href={viewLeaseData.document_url || viewLeaseData.lease_document_url} 
                      download="Lease_Agreement.pdf"
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#359b46] hover:bg-[#2c813a] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_4px_10px_rgba(53,155,70,0.2)] hover:shadow-[0_4px_15px_rgba(53,155,70,0.3)] shrink-0"
                    >
                      <Download size={16} /> Download
                    </a>
                  </div>
                ) : (
                  <div className="py-10 text-center flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200/60 border-dashed">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-3">
                      <FileText size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">No PDF Contract Attached</p>
                    <p className="text-xs text-slate-400 mt-1">A digital copy hasn't been uploaded for this folder yet.</p>
                  </div>
                )}
              </div>
              
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