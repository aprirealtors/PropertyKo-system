"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowRight } from "lucide-react";

export default function DashboardTab({ orgData, isLoading: isOrgLoading, onNavigate }: any) {
  
  const [units, setUnits] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch all units and tickets for calculations
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchDashboardData();
    }
  }, [orgData?.admin_email]);

  const fetchDashboardData = async () => {
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

  // --- MATH & CALCULATIONS ---
  const totalUnits = units.length;
  const occupiedUnits = units.filter(u => u.status !== 'Vacant').length;
  const vacantUnits = units.filter(u => u.status === 'Vacant').length;
  
  const vacancyRate = totalUnits > 0 ? ((vacantUnits / totalUnits) * 100).toFixed(1) : "0.0";
  const occupancyPercentage = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100) : 0;
  
  // REVPAU = Total Potential Rent / Total Units
  const totalRentPotential = units.reduce((acc, curr) => acc + (curr.monthly_rent || 0), 0);
  const revpau = totalUnits > 0 ? Math.round(totalRentPotential / totalUnits) : 0;

  // Needs Attention
  const soasToIssue = occupiedUnits; // 1 SOA per occupied unit
  const openTickets = tickets.filter(t => t.status === 'Open').length;

  // Generate initials for the avatar
  const initials = orgData?.org_name 
    ? orgData.org_name.substring(0, 2).toUpperCase() 
    : "AD";

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Dashboard</h2>
          {/* DYNAMIC Units Count from Org Data */}
          <p className="text-slate-500 text-sm mt-1">
            Portfolio overview · <span className="font-bold text-slate-700">{isOrgLoading ? "..." : orgData?.units_count || 0}</span> units limit
          </p>
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search tenants, units, SOA..." 
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] focus:border-transparent bg-white shadow-sm"
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

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard 
          title="VACANCY RATE" 
          value={`${isLoadingData ? "-" : vacancyRate}%`} 
          subtext={<span className="flex items-center text-slate-400 gap-1 font-medium">{vacantUnits} vacant units</span>} 
        />
        <StatCard 
          title="RENT COLLECTION" 
          value="0.0%" 
          subtext={<span className="flex items-center text-slate-400 gap-1 font-medium">Awaiting billing data</span>} 
        />
        <StatCard 
          title="REVPAU" 
          value={`₱${isLoadingData ? "0" : revpau.toLocaleString()}`} 
          subtext={<span className="text-slate-400 font-medium">per available unit</span>} 
        />
        <StatCard 
          title="LEASE RENEWAL" 
          value="0.0%" 
          subtext={<span className="text-slate-400 font-medium">0 / 0 renewed</span>} 
        />
      </div>

      {/* Bottom Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Charts & Table) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            
            {/* Rent Collected Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <h3 className="font-bold text-[#0a1e3f] text-base">Rent collected this month</h3>
                <span className="bg-slate-50 text-slate-500 font-bold text-xs px-2.5 py-1 rounded-full border border-slate-200">
                  ₱0 of ₱{totalRentPotential.toLocaleString()}
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-[#359b46] rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-200"></div> Collected (0%)
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-200"></div> Outstanding ₱{totalRentPotential.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Occupancy Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <h3 className="font-bold text-[#0a1e3f] text-base">Occupancy</h3>
                <span className="text-slate-500 text-sm font-medium">
                  {occupiedUnits} occupied · {vacantUnits} vacant
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-2 flex">
                <div className="h-full bg-[#359b46] rounded-l-full transition-all duration-1000" style={{ width: `${occupancyPercentage}%` }}></div>
                <div className="h-full bg-slate-200 rounded-r-full transition-all duration-1000" style={{ width: `${100 - occupancyPercentage}%` }}></div>
              </div>
            </div>

            {/* Recent Activity Table */}
            <div>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500 text-[11px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="pb-3 font-semibold">RECENT UNITS ADDED</th>
                    <th className="pb-3 font-semibold">TENANT</th>
                    <th className="pb-3 font-semibold text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                   {units.length === 0 ? (
                     <tr>
                       <td colSpan={3} className="py-8 text-center text-slate-400">No recent activity detected.</td>
                     </tr>
                   ) : (
                     units.slice(0, 3).map(unit => (
                       <tr key={unit.id}>
                         <td className="py-3 font-medium text-slate-900">{unit.property_name} {unit.unit_number}</td>
                         <td className="py-3 text-slate-600">{unit.tenant_name}</td>
                         <td className="py-3 text-right">
                           <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${unit.status === 'Vacant' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                             {unit.status}
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

        {/* Right Column (Needs Attention) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <h3 className="font-bold text-[#0a1e3f] text-lg mb-2">Needs attention</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Auto-flagged from live data - the work that used to take 7 days a month.
            </p>
            
            <div className="space-y-4 mb-8">
              <AttentionItem label="SOAs to issue" value={soasToIssue.toString()} isUrgent={soasToIssue > 0} color="text-amber-600" />
              <AttentionItem label="Overdue accounts" value="0" isUrgent={false} />
              <AttentionItem label="Open repair tickets" value={openTickets.toString()} isUrgent={openTickets > 0} color="text-red-600" />
              <AttentionItem label="Leases expiring <30d" value="0" isUrgent={false} />
              <AttentionItem label="Avg repair turnaround" value="-- days" isUrgent={false} />
              <AttentionItem label="Days in A/R (DSO)" value="--" isUrgent={false} />
            </div>

            <button 
              onClick={() => onNavigate("Billing")}
              className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex justify-center items-center gap-2"
            >
              Issue SOAs & collect <ArrowRight size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Subcomponents specifically for Dashboard Tab
function StatCard({ title, value, subtext }: { title: string, value: string, subtext: React.ReactNode }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="text-[11px] font-bold text-slate-500 tracking-wider uppercase mb-1">{title}</div>
      <div>
        <div className="text-3xl font-extrabold text-[#0a1e3f] mt-1 mb-2 tracking-tight">{value}</div>
        <div className="text-xs">{subtext}</div>
      </div>
    </div>
  );
}

function AttentionItem({ label, value, isUrgent, color }: { label: string, value: string, isUrgent: boolean, color?: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-extrabold ${isUrgent ? color : 'text-[#0a1e3f]'}`}>{value}</span>
    </div>
  );
}