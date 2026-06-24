"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, Users, X, MapPin, Banknote } from "lucide-react";

export default function LeasingAndTenantsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [leasedUnits, setLeasedUnits] = useState<any[]>([]);
  const [vacantUnits, setVacantUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form States
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchData();
    }
  }, [orgData?.admin_email]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // 1. Fetch Leased Units (Occupied)
    const { data: leased } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .neq('status', 'Vacant')
      .order('created_at', { ascending: false });

    // 2. Fetch Vacant Units (for the Dropdown)
    const { data: vacant } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .eq('status', 'Vacant');

    setLeasedUnits(leased || []);
    setVacantUnits(vacant || []);
    
    // Auto-select the first vacant unit if available
    if (vacant && vacant.length > 0) {
      setSelectedUnitId(vacant[0].id);
    }
    
    setIsLoading(false);
  };

  const handleNewLease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitId) {
      setErrorMsg("Please select a vacant unit.");
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Update the existing vacant unit with the tenant and rent
      const { error } = await supabase
        .from('units')
        .update({
          tenant_name: tenantName.trim(),
          monthly_rent: parseFloat(monthlyRent) || 0,
          status: 'Occupied'
        })
        .eq('id', selectedUnitId);

      if (error) throw new Error(`Database Error: ${error.message}`);

      // Refresh the data to move the unit from Vacant -> Leased
      await fetchData();
      setIsModalOpen(false);
      setTenantName("");
      setMonthlyRent("");

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Leasing & tenants</h2>
          <p className="text-slate-500 text-sm mt-1">Screening, e-lease and renewals</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units, SOA..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-[#0a1e3f] text-lg">
                Tenants & leases · {isLoading ? "..." : leasedUnits.length}
              </h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                + New lease
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-slate-500 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
                  <tr>
                    <th className="px-6 py-4 whitespace-nowrap">TENANT</th>
                    <th className="px-6 py-4 whitespace-nowrap">UNIT</th>
                    <th className="px-6 py-4 whitespace-nowrap">RENT</th>
                    <th className="px-6 py-4 whitespace-nowrap">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  
                  {isLoading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading tenants...</td></tr>
                  ) : leasedUnits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Users size={32} className="text-slate-300" />
                          <p>No active tenants found.</p>
                          <p className="text-xs text-slate-400 mt-1">Click "+ New lease" to assign a tenant to a vacant unit.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    leasedUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">{unit.tenant_name}</td>
                        <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.property_name} {unit.unit_number}</td>
                        <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">₱{unit.monthly_rent.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full text-[11px] border border-emerald-100">Active</span>
                        </td>
                      </tr>
                    ))
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel (Zeroed Out) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h3 className="font-bold text-[#0a1e3f] text-lg mb-2">Screening pipeline</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">Auto-accept when owner criteria are met - onboarding drops from days to minutes.</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium">New inquiries</span><span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full text-xs border border-slate-200">0</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium">ID / KYC verified</span><span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full text-xs border border-slate-200">0</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium">Auto-approved</span><span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full text-xs border border-slate-200">0</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-600 font-medium">e-Lease awaiting signature</span><span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full text-xs border border-slate-200">0</span></div>
            </div>
            
            <div className="bg-emerald-50/50 p-4 rounded-xl text-[13px] text-slate-600 border border-emerald-100/50 leading-relaxed font-medium">
              Conversion 0.0% · avg time to lease 0 days — tracked live from these events.
            </div>
          </div>
        </div>
      </div>

      {/* NEW LEASE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Create New Lease</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleNewLease} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><MapPin size={16} className="text-[#359b46]" /> Select Vacant Unit</label>
                  {vacantUnits.length === 0 ? (
                    <div className="p-3 text-sm text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                      You do not have any vacant units available. Please add a new unit in the "Properties & Units" tab first.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedUnitId}
                      onChange={(e) => setSelectedUnitId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white"
                      disabled={isSubmitting}
                    >
                      {vacantUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.property_name} {unit.unit_number} (Owner: {unit.owner_name || 'N/A'})
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
                    placeholder="e.g. Deivid Valderama"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting || vacantUnits.length === 0}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Banknote size={16} className="text-[#359b46]" /> Agreed Monthly Rent (₱)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 25000"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting || vacantUnits.length === 0}
                  />
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting || vacantUnits.length === 0} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
                    {isSubmitting ? "Saving..." : "Start Lease"}
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