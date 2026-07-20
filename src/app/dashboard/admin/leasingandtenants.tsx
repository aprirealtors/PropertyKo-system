"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, Users, X, MapPin, CheckCircle, BellRing, Check, CalendarDays } from "lucide-react";

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
      // NOTE: lease_end removed to prevent schema cache errors
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
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  const pendingLeases = leasesList.filter(l => l.status === 'Pending');

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Leasing & tenants</h2>
          <p className="text-slate-500 text-sm mt-1">Review owner assignments and manage active contracts.</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      {/* New Tenant Notification Banner */}
      {pendingLeases.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-full text-amber-600">
              <BellRing size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-amber-800">New Tenant Assignment Awaiting Approval</h4>
              <p className="text-sm text-amber-700">Property Owners have submitted <strong>{pendingLeases.length}</strong> new tenant(s). Please review and approve them below.</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Width Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#0a1e3f] text-lg">
              Lease Contracts
            </h3>
            {pendingLeases.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200 shadow-sm animate-pulse">
                {pendingLeases.length} Pending Approval
              </span>
            )}
          </div>
          <button 
            onClick={() => handleOpenApproveModal()}
            disabled={pendingLeases.length === 0}
            className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#359b46]/50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
          >
            Review Pending Leases
          </button>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">OWNER</th>
                <th className="px-6 py-4 whitespace-nowrap">TENANT</th>
                <th className="px-6 py-4 whitespace-nowrap">UNIT</th>
                <th className="px-6 py-4 whitespace-nowrap">LEASE START</th>
                <th className="px-6 py-4 whitespace-nowrap">LEASE ENDS</th>
                <th className="px-6 py-4 whitespace-nowrap">STATUS</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">Loading leases...</td></tr>
              ) : leasesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Users size={32} className="text-slate-300" />
                      <p>No active or pending leases found.</p>
                      <p className="text-xs text-slate-400 mt-1">When owners assign tenants, they will appear here for approval.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                leasesList.map((lease) => {
                  const isActive = lease.status === 'Active';
                  
                  return (
                    <tr key={lease.id} className={`transition-colors ${isActive ? 'hover:bg-slate-50/80' : 'bg-amber-50/30 hover:bg-amber-50/60'}`}>
                      <td className="px-6 py-4 font-medium text-slate-600 whitespace-nowrap">
                        {lease.units?.owner_name || '—'}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                        {lease.tenant_name}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {lease.units?.property_name} {lease.units?.unit_number}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(lease.start_date)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                        {formatDate(lease.end_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full text-[11px] border border-amber-200">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {!isActive ? (
                          <button 
                            onClick={() => handleOpenApproveModal(lease.id)}
                            className="bg-[#1d82f5] hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs font-bold">
                            <CheckCircle size={14} /> Approved
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

      {/* APPROVAL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Approve Lease Request</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <form onSubmit={handleApproveSubmit} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><MapPin size={16} className="text-[#359b46]" /> Pending Request</label>
                  {pendingLeases.length === 0 ? (
                    <div className="p-3 text-sm text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                      There are no pending lease requests to approve.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedLeaseId}
                      onChange={(e) => handleLeaseSelectionChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white"
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

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Users size={16} className="text-[#359b46]" /> Tenant Name</label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting || pendingLeases.length === 0}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><CalendarDays size={16} className="text-[#359b46]" /> Start Date</label>
                    <input 
                      required type="date"
                      value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" 
                      disabled={isSubmitting || pendingLeases.length === 0}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><CalendarDays size={16} className="text-[#359b46]" /> End Date</label>
                    <input 
                      required type="date"
                      value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" 
                      disabled={isSubmitting || pendingLeases.length === 0}
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting || pendingLeases.length === 0} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
                    {isSubmitting ? "Processing..." : "Approve Lease"}
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