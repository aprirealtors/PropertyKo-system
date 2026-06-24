"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search } from "lucide-react";

export default function KPIReportsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [units, setUnits] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch all units and tickets for KPI calculations
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchKPIData();
    }
  }, [orgData?.admin_email]);

  const fetchKPIData = async () => {
    setIsLoadingData(true);
    
    // Fetch Units
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email);
      
    // Fetch Tickets
    const { data: ticketsData } = await supabase
      .from('tickets')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    setUnits(unitsData || []);
    setTickets(ticketsData || []);
    setIsLoadingData(false);
  };

  // --- KPI CALCULATIONS ---
  const totalUnits = units.length;
  const vacantUnits = units.filter(u => u.status === 'Vacant').length;
  
  // 1. Vacancy Rate
  const vacancyRate = totalUnits > 0 ? ((vacantUnits / totalUnits) * 100).toFixed(2) + '%' : "0.00%";
  
  // 2. RevPAU (Revenue Per Available Unit)
  const totalRentPotential = units.reduce((acc, curr) => acc + (curr.monthly_rent || 0), 0);
  const revpau = totalUnits > 0 ? `₱${(totalRentPotential / totalUnits).toLocaleString(undefined, {minimumFractionDigits: 2})}` : "₱0.00";

  // 3. Maintenance Cost per Unit
  const totalTicketCost = tickets.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);
  const maintenanceCostPerUnit = totalUnits > 0 ? `₱${Math.round(totalTicketCost / totalUnits).toLocaleString()}/unit/yr` : "₱0/unit/yr";

  // Generate initials for the avatar
  const initials = orgData?.org_name 
    ? orgData.org_name.substring(0, 2).toUpperCase() 
    : "AD";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">KPI reports</h2>
          <p className="text-slate-500 text-sm mt-1">Live operational scoreboard</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search tenants, units, SOA..." 
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" 
            />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">
              {initials}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-lg text-[#0a1e3f]">KPI scoreboard: on-demand vs. monthly manual</h3>
          <button className="bg-white border border-slate-200 hover:border-[#359b46] hover:text-[#359b46] text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm">
            Export
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-400 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">INDICATOR</th>
                <th className="px-6 py-4 whitespace-nowrap">CURRENT</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">USE</th>
                <th className="px-6 py-4 whitespace-nowrap">WAS</th>
                <th className="px-6 py-4 whitespace-nowrap">WITH PROPERTYKO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {isLoadingData ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">Calculating live metrics...</td>
                </tr>
              ) : (
                <>
                  {/* Dynamic Database KPIs */}
                  <KPIRow label="Vacancy rate" current={vacancyRate} use="High" was="Monthly" />
                  <KPIRow label="RevPAU" current={revpau} use="High" was="Monthly" />
                  <KPIRow label="Maintenance cost / unit" current={maintenanceCostPerUnit} use="High" was="Monthly" />
                  
                  {/* Mock/Simulated KPIs (Pending other modules) */}
                  <KPIRow label="Tenant turnover" current="0.00%" use="High" was="Monthly" />
                  <KPIRow label="Lease renewal" current="0.00%" use="High" was="Monthly" />
                  <KPIRow label="Avg time to lease" current="0 days" use="High" was="Monthly" />
                  <KPIRow label="Lease conversion" current="0.00%" use="High" was="Monthly" />
                  <KPIRow label="Rent collection" current="0.00%" use="High" was="Monthly" />
                  <KPIRow label="Days in A/R (DSO)" current="0.0" use="Med" was="N/A" />
                  <KPIRow label="Marketing cost / lease" current="₱0/unit/yr" use="High" was="Monthly" />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPIRow({ label, current, use, was }: any) {
  const useColor = use === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100';
  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{label}</td>
      <td className="px-6 py-4 font-bold text-[#0a1e3f] whitespace-nowrap">{current}</td>
      <td className="px-6 py-4 text-center whitespace-nowrap">
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${useColor}`}>{use}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">{was}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="bg-emerald-50 text-[#359b46] border border-emerald-100 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide">
          On-demand
        </span>
      </td>
    </tr>
  );
}