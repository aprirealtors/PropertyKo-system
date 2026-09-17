"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Search, Users, X, MapPin, CheckCircle, BellRing, CalendarDays, 
  AlertTriangle, FolderOpen, Clock, FileText, Download, XOctagon, RefreshCw, MessageSquare 
} from "lucide-react";

export default function LeasingAndTenantsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  const [leasesList, setLeasesList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✨ Universal Beautiful Modals
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: "", desc: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, desc: string, action: (() => void) | null}>({ 
    isOpen: false, title: "", desc: "", action: null 
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewLeaseData, setViewLeaseData] = useState<any>(null);

  // Form States
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchData();
    }
  }, [orgData?.admin_email]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const { data: leases, error: leaseError } = await supabase
      .from('leases')
      .select('*, units!inner(property_name, unit_number, owner_name, monthly_rent)')
      .eq('admin_email', orgData.admin_email)
      .order('created_at', { ascending: false });

    if (leaseError) {
      console.error("Error fetching leases:", leaseError);
    } else if (leases) {
      // ✨ GROUP HISTORY & AUTO-HEAL
      const groupedLeases = new Map();
      
      for (const lease of leases) {
        
        // AUTO-EXPIRATION DATABASE CHECK
        if (lease.status === 'Active' && lease.end_date) {
          const today = new Date();
          today.setHours(0,0,0,0);
          const end = new Date(lease.end_date);
          end.setHours(0,0,0,0);

          if (end.getTime() < today.getTime()) {
            await supabase.from('leases').update({ status: 'Expired' }).eq('id', lease.id);
            lease.status = 'Expired';
          }
        }

        if (!groupedLeases.has(lease.unit_id)) {
          // This is the newest lease for this unit
          groupedLeases.set(lease.unit_id, { ...lease, history: [] });
        } else {
          // ✨ AUTO-HEAL STUCK RECORDS: If an older lease is somehow still "Active", force it to "Renewed"
          if (lease.status === 'Active') {
            await supabase.from('leases').update({ status: 'Renewed' }).eq('id', lease.id);
            lease.status = 'Renewed';
          }

          // Push the older lease into the history array
          groupedLeases.get(lease.unit_id).history.push(lease);
        }
      }
      
      setLeasesList(Array.from(groupedLeases.values()));
    }

    setIsLoading(false);
  };

  const showSuccess = (title: string, desc: string) => setSuccessModal({ isOpen: true, title, desc });
  const showError = (message: string) => setErrorModal({ isOpen: true, message });

  const handleOpenApproveModal = (leaseId?: string) => {
    const pendingLeases = leasesList.filter(l => l.status === 'Pending');
    
    if (leaseId) {
      const lease = pendingLeases.find(l => l.id === leaseId);
      if (lease) {
        setSelectedLeaseId(lease.id);
        setTenantName(lease.tenant_name);
        setStartDate(lease.start_date || "");
        setEndDate(lease.end_date || "");
      }
    } else if (pendingLeases.length > 0) {
      setSelectedLeaseId(pendingLeases[0].id);
      setTenantName(pendingLeases[0].tenant_name);
      setStartDate(pendingLeases[0].start_date || "");
      setEndDate(pendingLeases[0].end_date || "");
    } else {
      setSelectedLeaseId(""); setTenantName(""); setStartDate(""); setEndDate("");
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

  const confirmApproveLease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) {
      showError("Please select a pending lease request.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Confirm Approval",
      desc: "Are you sure you want to approve these terms and activate the lease contract?",
      action: executeApproveLease
    });
  };

  const executeApproveLease = async () => {
    setIsSubmitting(true);
    try {
      const targetLease = leasesList.find(l => l.id === selectedLeaseId);
      if (!targetLease) throw new Error("Lease not found");

      // Auto-retire any existing active leases for this unit to prevent duplicates
      await supabase
        .from('leases')
        .update({ status: 'Renewed' })
        .eq('unit_id', targetLease.unit_id)
        .eq('status', 'Active');

      const { error: updateError } = await supabase
        .from('leases')
        .update({ 
          status: 'Active', 
          tenant_name: tenantName.trim(), 
          start_date: startDate, 
          end_date: endDate,
          renewal_status: null, // Clear tracking for the active new lease
          renewal_reason: null
        })
        .eq('id', selectedLeaseId);

      if (updateError) throw new Error(`Lease Update Error: ${updateError.message}`);

      const { error: unitError } = await supabase
        .from('units')
        .update({
          status: 'Occupied',
          tenant_name: tenantName.trim(),
          monthly_rent: targetLease.monthly_rent || 0
        })
        .eq('id', targetLease.unit_id);

      if (unitError) throw new Error(`Unit Update Error: ${unitError.message}`);

      await fetchData();
      setIsModalOpen(false);
      showSuccess("Lease Approved", "The lease contract has been activated and the unit is now officially occupied.");

    } catch (error: any) {
      console.error(error);
      showError(error?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewContract = (lease: any) => {
    setViewLeaseData(lease);
    setIsViewModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-300 italic">—</span>;
    return <span className="font-bold text-slate-700">{new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>;
  };

  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";
  
  const pendingLeases = leasesList.filter(l => l.status === 'Pending');

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
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10 animate-in fade-in duration-500 bg-[var(--color-bg)]">
      
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-secondary)] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-[var(--color-primary)]/10 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
                <Users className="text-[var(--color-primary)]" size={24} strokeWidth={2.5} />
              </div>
              Leasing & Tenants
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Manage & Organize of Owner & Tenant Lease Records
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            <div className="relative flex-1 sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              <input 
                type="text"
                placeholder="Search tenant, owner, unit..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white relative"
              />
            </div>
            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 bg-[var(--color-primary)]/10 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
              <span className="text-xs font-black text-[var(--color-secondary)] uppercase tracking-wider">Admin</span>
              <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-secondary)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingLeases.length > 0 && (
        <div className="shrink-0 mb-5 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mx-1 sm:mx-0">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-inner border border-amber-200 shrink-0">
              <BellRing size={22} strokeWidth={2.5} className="animate-[wiggle_1s_ease-in-out_infinite]" />
            </div>
            <div>
              <h4 className="font-black text-amber-900 text-sm sm:text-base tracking-tight">Lease Action Required</h4>
              <p className="text-xs sm:text-sm text-amber-700/80 font-semibold mt-0.5">Owners have submitted <strong className="text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded">{pendingLeases.length}</strong> lease(s) for approval or renewal.</p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenApproveModal()}
            className="hidden sm:flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-[var(--radius-sm)] text-xs font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all shrink-0"
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
                <div className="flex-1 bg-slate-100 border border-[var(--color-border)] rounded-b-2xl rounded-tr-2xl p-5 h-56"></div>
              </div>
            ))}
          </div>
        ) : leasesList.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-[var(--color-border)] shadow-sm mt-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
              <FolderOpen size={36} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-slate-700 font-black text-xl">No Lease Folders Found</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">When owners declare tenants, their lease folders will be generated here automatically.</p>
          </div>
        ) : filteredLeases.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-[var(--color-border)] shadow-sm mt-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 mb-4">
              <Search size={36} className="text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-slate-700 font-black text-xl">No Matches Found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search query for "{searchQuery}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-6 sm:gap-x-6 sm:gap-y-8 mt-2">
            {filteredLeases.map((lease) => {
              const isExpired = lease.status === 'Expired';
              const isTerminated = lease.status === 'Terminated';
              const isPending = lease.status === 'Pending';
              const isActive = lease.status === 'Active';

              const badgeColor = isPending ? 'bg-amber-50 text-amber-600 border-amber-200/60' :
                                 isTerminated ? 'bg-slate-100 text-slate-500 border-slate-300' :
                                 isExpired ? 'bg-red-50 text-red-600 border-red-200' :
                                 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30';
                                 
              const badgeText = isPending ? 'Pending' : isTerminated ? 'Terminated' : isExpired ? 'Expired' : 'Active';
              const BadgeIcon = isPending ? Clock : isTerminated ? XOctagon : isExpired ? AlertTriangle : CheckCircle;

              return (
                <div key={lease.id} className="flex flex-col h-full group hover:-translate-y-1 transition-transform duration-300">

                  <div className="flex items-end">
                    <div className={`px-4 py-2 rounded-t-xl text-[10px] text-[var(--color-secondary)] font-black uppercase tracking-wider flex items-center gap-1.5 border-t border-l border-r relative shadow-[0_-2px_6px_rgba(0,0,0,0.02)] translate-y-[1px] transition-colors ${badgeColor}`}>
                      <BadgeIcon size={14} />
                      {badgeText}
                    </div>
                  </div>

                  <div className={`flex-1 bg-white border rounded-b-[1.5rem] rounded-tr-[1.5rem] p-5 sm:p-6 shadow-[var(--shadow-sm)] group-hover:shadow-lg transition-all flex flex-col relative overflow-hidden ${
                      isActive ?  'border-[var(--color-primary)]/30 border-t-[var(--color-primary)]/30' : 
                      isExpired ? 'border-red-200 border-t-red-200' :
                      isTerminated ? 'border-slate-300 border-t-slate-300' :
                      'border-amber-200/60 border-t-amber-200/60'
                  }`}>

                    <FolderOpen className="absolute -bottom-6 -right-6 text-slate-50 opacity-[0.4] w-32 h-32 rotate-[-10deg] pointer-events-none" />

                    <div className="mb-5 relative">
                      <h4 className="text-xl font-black text-[var(--color-secondary)] truncate tracking-tight">{lease.tenant_name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-[var(--color-primary)]" />
                        <p className="text-xs font-bold text-slate-500 truncate">{lease.units?.property_name} · Unit {lease.units?.unit_number}</p>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6 flex-1 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 relative">
                      <div className="flex flex-col gap-1 pb-3 border-b border-[var(--color-border)]">
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

                    <div className="mt-auto relative">
                      {isPending ? (
                        <button 
                          onClick={() => handleOpenApproveModal(lease.id)}
                          className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-4 py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center gap-2 group/btn border border-transparent"
                        >
                          <AlertTriangle size={16} className="group-hover/btn:animate-pulse" /> Review & Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleViewContract(lease)} 
                          className="w-full bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-4 py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest border border-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/40 transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 group/btn"
                        >
                          <FileText size={18} strokeWidth={2.5} className="group-hover/btn:scale-110 transition-transform" /> View Folder
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
        <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight relative z-10 flex items-center gap-2">
                <CheckCircle className="text-[var(--color-primary)]" size={24} strokeWidth={2.5} />
                Approve Lease
              </h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-[var(--color-border)] rounded-full text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar bg-slate-50/50">
              <form onSubmit={confirmApproveLease} className="space-y-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <FolderOpen size={14} className="text-[var(--color-primary)]" /> Pending Folder Selection
                  </label>
                  {leasesList.filter(l => l.status === 'Pending').length === 0 ? (
                    <div className="p-4 text-sm font-bold text-amber-700 bg-amber-50 rounded-xl border border-amber-200/60">
                      There are no pending folders to approve.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedLeaseId}
                      onChange={(e) => handleLeaseSelectionChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all appearance-none cursor-pointer"
                      disabled={isSubmitting}
                    >
                      {leasesList.filter(l => l.status === 'Pending').map((lease) => (
                        <option key={lease.id} value={lease.id}>
                          {lease.units?.property_name} {lease.units?.unit_number} - Requested by {lease.units?.owner_name || 'Owner'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                    <Users size={14} className="text-[var(--color-primary)]" /> Tenant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] bg-slate-50 focus:bg-white transition-all"
                    disabled={isSubmitting || leasesList.filter(l => l.status === 'Pending').length === 0}
                  />
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                      <CalendarDays size={14} className="text-[var(--color-primary)]" /> Start Date
                    </label>
                    <input 
                      required type="date"
                      value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all" 
                      disabled={isSubmitting || leasesList.filter(l => l.status === 'Pending').length === 0}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">
                      <CalendarDays size={14} className="text-[var(--color-primary)]" /> End Date
                    </label>
                    <input 
                      required type="date"
                      value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all" 
                      disabled={isSubmitting || leasesList.filter(l => l.status === 'Pending').length === 0}
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3 pt-5 border-t border-[var(--color-border)] sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 sm:px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-slate-200 hover:border-[var(--color-primary)]/50 hover:shadow-sm rounded-[var(--radius-md)] transition-all active:scale-95">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting || leasesList.filter(l => l.status === 'Pending').length === 0} className="flex-1 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] px-4 sm:px-8 py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-wider transition-all shadow-[var(--shadow-md)] border border-transparent active:scale-95 flex items-center justify-center">
                    {isSubmitting ? <span className="animate-pulse">Processing...</span> : "Approve & Activate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 VIEW CONTRACT MODAL WITH RENEWAL TRACKING */}
      {isViewModalOpen && viewLeaseData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>

            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight relative z-10 flex items-center gap-2">
                <FileText className="text-[var(--color-primary)]" size={24} strokeWidth={2.5} />
                Contract Details
              </h2>
              <button onClick={() => setIsViewModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-[var(--color-border)] rounded-full text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0">
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto max-h-[75vh] custom-scrollbar bg-slate-50/50 space-y-5">
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
                <div>
                  <h4 className="text-xl font-black text-[var(--color-secondary)]">{viewLeaseData.tenant_name}</h4>
                  <div className="flex flex-col gap-1 mt-1.5">
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                      <MapPin size={14} className="text-[var(--color-primary)]"/>
                      {viewLeaseData.units?.property_name} · Unit {viewLeaseData.units?.unit_number}
                    </p>
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400"/>
                      Owner: <span className="text-slate-700">{viewLeaseData.units?.owner_name || <span className="italic text-slate-400">Unassigned</span>}</span>
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 border rounded-[var(--radius-sm)] text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[var(--shadow-sm)] ${
                  viewLeaseData.status === 'Terminated' ? 'bg-slate-100 text-slate-500 border-slate-300' :
                  viewLeaseData.status === 'Expired' ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                }`}>
                  {viewLeaseData.status === 'Terminated' ? <XOctagon size={14} /> :
                   viewLeaseData.status === 'Expired' ? <AlertTriangle size={14} /> :
                   <CheckCircle size={14} />} 
                  {viewLeaseData.status}
                </div>
              </div>

              {/* ✨ MANAGER RENEWAL TRACKING BLOCK (Only show if there is an active tracking status) */}
              {viewLeaseData.renewal_status && (
                <div className={`p-4 rounded-xl border shadow-sm ${
                  viewLeaseData.renewal_status === 'Accepted' ? 'bg-emerald-50 border-emerald-200' :
                  viewLeaseData.renewal_status === 'Declined' ? 'bg-slate-100 border-slate-300' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {viewLeaseData.renewal_status === 'Accepted' ? <CheckCircle size={16} className="text-emerald-600" /> :
                     viewLeaseData.renewal_status === 'Declined' ? <MessageSquare size={16} className="text-slate-500" /> :
                     <RefreshCw size={16} className="text-blue-500" />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      viewLeaseData.renewal_status === 'Accepted' ? 'text-emerald-700' :
                      viewLeaseData.renewal_status === 'Declined' ? 'text-slate-600' :
                      'text-blue-700'
                    }`}>Renewal Tracking</span>
                  </div>
                  <div className={`text-sm font-bold ${
                      viewLeaseData.renewal_status === 'Accepted' ? 'text-emerald-900' :
                      viewLeaseData.renewal_status === 'Declined' ? 'text-slate-800' :
                      'text-blue-900'
                  }`}>
                    {viewLeaseData.renewal_status === 'Offered' ? "Renewal Offered to Tenant" : 
                     viewLeaseData.renewal_status === 'Accepted' ? "Tenant Accepted Renewal" : 
                     "Tenant Declined Renewal"}
                  </div>
                  {viewLeaseData.renewal_status === 'Declined' && viewLeaseData.renewal_reason && (
                    <div className="mt-2 text-xs text-slate-600 font-medium italic border-l-2 border-slate-300 pl-3 py-1">
                      "{viewLeaseData.renewal_reason}"
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                      <CalendarDays size={14} className="text-[var(--color-primary)]" /> Lease Start
                    </label>
                    <div className="text-sm font-bold text-slate-700">{formatDate(viewLeaseData.start_date)}</div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                      <CalendarDays size={14} className="text-[var(--color-primary)]" /> Lease End
                    </label>
                    <div className="text-sm font-bold text-slate-700">{formatDate(viewLeaseData.end_date)}</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] flex flex-col justify-center">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <span className="text-[var(--color-primary)] font-black text-xs leading-none">₱</span> Monthly Rent Amount
                  </label>
                  <div className="text-3xl font-black text-[var(--color-secondary)]">
                    ₱{(viewLeaseData.units?.monthly_rent || viewLeaseData.monthly_rent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs font-bold text-slate-400 mt-2">Agreed upon monthly rate.</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                  <FileText size={14} className="text-[var(--color-primary)]" /> Contract Document
                </label>

                {viewLeaseData.document_url || viewLeaseData.lease_document_url ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-border)] shrink-0">
                        <FileText size={18} className="text-[var(--color-primary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-secondary)]">Lease Agreement</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">PDF Document</p>
                      </div>
                    </div>

                    <a 
                      href={viewLeaseData.document_url || viewLeaseData.lease_document_url} 
                      download="Lease_Agreement.pdf"
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-5 py-2.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-[var(--shadow-md)] border border-transparent shrink-0"
                    >
                      <Download size={16} /> Download
                    </a>
                  </div>
                ) : (
                  <div className="py-10 text-center flex flex-col items-center justify-center bg-slate-50 rounded-[var(--radius-lg)] border border-[var(--color-border)] border-dashed">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-[var(--color-border)] mb-3">
                      <FileText size={20} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-bold text-slate-500">No PDF Contract Attached</p>
                    <p className="text-xs text-slate-400 mt-1">A digital copy hasn't been uploaded for this folder yet.</p>
                  </div>
                )}
              </div>

              {/* ✨ LEASE HISTORY BLOCK */}
              {viewLeaseData.history && viewLeaseData.history.length > 0 && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                    <Clock size={14} className="text-[var(--color-primary)]" /> Lease History
                  </label>
                  <div className="space-y-3">
                    {viewLeaseData.history.map((pastLease: any) => (
                      <div key={pastLease.id} className="p-4 bg-slate-50 rounded-[var(--radius-md)] border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-700">{pastLease.tenant_name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">
                            {formatDate(pastLease.start_date)} — {formatDate(pastLease.end_date)}
                          </p>
                          {pastLease.renewal_status && (
                            <p className="text-[10px] font-bold text-blue-600 mt-1.5 flex items-center gap-1.5 uppercase tracking-widest">
                              <RefreshCw size={10} /> Tracking: {pastLease.renewal_status}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded shadow-sm border ${
                            pastLease.status === 'Terminated' ? 'bg-slate-100 text-slate-500 border-slate-300' :
                            pastLease.status === 'Expired' ? 'bg-red-50 text-red-600 border-red-200' :
                            pastLease.status === 'Renewed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {pastLease.status}
                          </span>
                          {(pastLease.document_url || pastLease.lease_document_url) && (
                            <a 
                              href={pastLease.document_url || pastLease.lease_document_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="p-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] shadow-sm transition-colors"
                            >
                              <Download size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ✨ UNIVERSAL CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30`}>
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">{confirmModal.title}</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {confirmModal.desc}
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmModal({ isOpen: false, title: "", desc: "", action: null })} className="flex-1 bg-white hover:bg-slate-50 text-slate-500 border border-[var(--color-border)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-sm active:scale-95">
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.action) confirmModal.action();
                  setConfirmModal({ isOpen: false, title: "", desc: "", action: null });
                }} 
                className={`flex-1 text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-md border border-transparent active:scale-95 bg-[var(--color-primary)] hover:opacity-90`}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ SUCCESS MODAL */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-emerald-200">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">{successModal.title}</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {successModal.desc}
            </p>
            <button onClick={() => setSuccessModal({ isOpen: false, title: "", desc: "" })} className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ✨ ERROR MODAL */}
      {errorModal.isOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-red-200">
              <AlertTriangle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">An error occurred</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {errorModal.message}
            </p>
            <button onClick={() => setErrorModal({ isOpen: false, message: "" })} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all active:scale-95">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, icon, value, valueColor = "text-[var(--color-text)]" }: any) {
  return (
    <div className="flex flex-col min-w-0">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">
        {label}
      </label>
      <div className="flex items-center gap-3 bg-[var(--color-bg)]/50 border border-[var(--color-border)] p-3 sm:p-4 rounded-[var(--radius-md)] hover:bg-white hover:border-[var(--color-primary)]/40 transition-colors shadow-inner w-full min-w-0">
        <div className="text-[var(--color-primary)] shrink-0 bg-white p-2 sm:p-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex items-center justify-center">
          {icon}
        </div>
        <div className={`font-black text-[13px] sm:text-base truncate tracking-tight min-w-0 w-full ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}