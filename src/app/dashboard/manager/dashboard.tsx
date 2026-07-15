"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowRight, PieChart, Users, Home, Building, Lock } from "lucide-react";

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
  
  // Categorize Units for the Pie Chart
  let holdCount = 0;
  let availableCount = 0;
  let ownersCount = 0;

  units.forEach(u => {
    const remarksLower = (u.remarks || '').toLowerCase();
    const isHold = remarksLower.includes('hold') || remarksLower.includes('reserved');

    if (isHold) {
      holdCount++;
    } else if (u.status === 'Vacant') {
      availableCount++;
    } else {
      ownersCount++;
    }
  });

  const vacancyRate = totalUnits > 0 ? ((availableCount / totalUnits) * 100).toFixed(1) : "0.0";
  const occupancyPercentage = totalUnits > 0 ? ((ownersCount / totalUnits) * 100) : 0;
  
  // Percentages for Pie Chart
  const ownersPct = totalUnits > 0 ? (ownersCount / totalUnits) * 100 : 0;
  const availablePct = totalUnits > 0 ? (availableCount / totalUnits) * 100 : 0;
  const holdPct = totalUnits > 0 ? (holdCount / totalUnits) * 100 : 0;
  
  // REVPAU = Total Potential Rent / Total Units
  const totalRentPotential = units.reduce((acc, curr) => acc + (curr.monthly_rent || 0), 0);
  const revpau = totalUnits > 0 ? Math.round(totalRentPotential / totalUnits) : 0;

  // Needs Attention
  const soasToIssue = ownersCount; 
  const openTickets = tickets.filter(t => t.status === 'Open').length;

  // Generate initials for the avatar
  const initials = orgData?.org_name 
    ? orgData.org_name.substring(0, 2).toUpperCase() 
    : "AD";

  // --- SVG PIE CHART MATH HELPERS ---
  const getLabelCoord = (startPct: number, slicePct: number) => {
    const midPct = startPct + (slicePct / 2);
    const angle = (midPct / 100) * 2 * Math.PI - (Math.PI / 2);
    // 50 is center, 27 is the radius distance to place the text
    return {
      x: 50 + 27 * Math.cos(angle),
      y: 50 + 27 * Math.sin(angle)
    };
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      
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
            <span className="text-sm font-semibold text-[#359b46]">Manager</span>
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
          subtext={<span className="flex items-center text-slate-400 gap-1 font-medium">{availableCount} vacant units</span>} 
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            
            {/* Rent Collected Bar */}
            <div className="mb-10">
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

            {/* ✨ EXACT REPLICA: Pie Chart Section */}
            <div className="pt-8 border-t border-slate-100">
              
              {/* Header Title */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-full bg-[#0a1e3f] flex items-center justify-center text-white shadow-md shrink-0">
                  <Building size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0a1e3f] uppercase tracking-tight">Unit Distribution Overview</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Current status of building units</p>
                  <div className="h-0.5 w-12 bg-amber-500 mt-2 rounded-full"></div>
                </div>
              </div>

              {/* Chart & Summary Container -> Adjusted for professional mobile & desktop layout */}
              <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 mb-10 border border-slate-100 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 shadow-sm">
                
                {/* 1. Solid SVG Pie Chart */}
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl rounded-full">
                    <g transform="rotate(-90 50 50)">
                      {/* Owners Slice (Navy) */}
                      <circle cx="50" cy="50" r="25" fill="transparent" stroke="#0a1e3f" strokeWidth="50" 
                        strokeDasharray={`${(ownersPct/100)*157.08} 157.08`} strokeDashoffset="0" />
                      
                      {/* Available Slice (Green) */}
                      <circle cx="50" cy="50" r="25" fill="transparent" stroke="#48a457" strokeWidth="50" 
                        strokeDasharray={`${(availablePct/100)*157.08} 157.08`} strokeDashoffset={`${-(ownersPct/100)*157.08}`} />
                      
                      {/* Hold Slice (Grey) */}
                      <circle cx="50" cy="50" r="25" fill="transparent" stroke="#94a3b8" strokeWidth="50" 
                        strokeDasharray={`${(holdPct/100)*157.08} 157.08`} strokeDashoffset={`${-((ownersPct + availablePct)/100)*157.08}`} />
                      
                      {/* White Dividers */}
                      {ownersPct > 0 && availablePct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.8" transform={`rotate(${(ownersPct/100)*360} 50 50)`} />}
                      {availablePct > 0 && holdPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.8" transform={`rotate(${((ownersPct+availablePct)/100)*360} 50 50)`} />}
                      {holdPct > 0 && ownersPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.8" transform={`rotate(0 50 50)`} />}
                    </g>
                    
                    {/* Big Percentages inside Slices */}
                    {ownersPct > 5 && (
                      <text x={getLabelCoord(0, ownersPct).x} y={getLabelCoord(0, ownersPct).y} fill="white" fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        {Math.round(ownersPct)}%
                      </text>
                    )}
                    {availablePct > 5 && (
                      <text x={getLabelCoord(ownersPct, availablePct).x} y={getLabelCoord(ownersPct, availablePct).y} fill="white" fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        {Math.round(availablePct)}%
                      </text>
                    )}
                    {holdPct > 5 && (
                      <text x={getLabelCoord(ownersPct + availablePct, holdPct).x} y={getLabelCoord(ownersPct + availablePct, holdPct).y} fill="white" fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                        {Math.round(holdPct)}%
                      </text>
                    )}
                  </svg>
                </div>

                {/* 2. Unit Summary Card */}
                <div className="flex-1 w-full min-w-[280px] max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
                  
                  {/* Card Header */}
                  <div className="bg-[#0a1e3f] px-6 py-4 flex items-center gap-3 text-white shrink-0">
                    <PieChart size={20} className="opacity-90"/>
                    <span className="font-bold text-[14px] tracking-wide">UNIT SUMMARY</span>
                  </div>
                  
                  {/* Card Rows */}
                  <div className="flex flex-col px-2 py-2 flex-1">
                    <SummaryRow icon={<Users size={22} className="text-[#0a1e3f]"/>} title="Owners of Units" sub="Total Occupied" count={ownersCount} pct={Math.round(ownersPct)} color="text-[#0a1e3f]" bg="bg-blue-50" />
                    <div className="h-px bg-slate-100 mx-4"></div>
                    <SummaryRow icon={<Building size={22} className="text-[#48a457]"/>} title="Available Units" sub="Ready for Occupancy" count={availableCount} pct={Math.round(availablePct)} color="text-[#48a457]" bg="bg-green-50" />
                    <div className="h-px bg-slate-100 mx-4"></div>
                    <SummaryRow icon={<Lock size={22} className="text-slate-500"/>} title="Hold Units" sub="On Hold / Reserved" count={holdCount} pct={Math.round(holdPct)} color="text-slate-500" bg="bg-slate-100" />
                  </div>
                  
                  {/* Card Footer */}
                  <div className="bg-[#0a1e3f] px-6 py-5 flex justify-between items-center text-white mt-auto border-t-4 border-[#0a1e3f]">
                    <div className="flex items-center gap-4">
                      <Building size={32} strokeWidth={1.5} className="opacity-80"/>
                      <div className="flex flex-col">
                        <div className="text-[11px] uppercase font-bold text-slate-300 tracking-widest">TOTAL UNITS</div>
                        <div className="text-sm font-semibold">{totalUnits} units total</div>
                      </div>
                    </div>
                    <div className="text-4xl font-bold">100%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Occupancy Bar (Kept Below as requested) */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <h3 className="font-bold text-[#0a1e3f] text-base">Occupancy</h3>
                <span className="text-slate-500 text-sm font-medium">
                  {ownersCount} occupied · {availableCount} vacant
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
                       <tr key={unit.id} className="hover:bg-slate-50 transition-colors">
                         <td className="py-4 font-medium text-slate-900">{unit.property_name} {unit.unit_number}</td>
                         <td className="py-4 text-slate-600">{unit.tenant_name}</td>
                         <td className="py-4 text-right">
                           <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${unit.status === 'Vacant' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
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

// --- SUBCOMPONENTS ---

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

// Helper for the Right Card Rows
function SummaryRow({ icon, title, sub, count, pct, color, bg }: any) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-xl">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg} shrink-0`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <div className="text-[15px] font-bold text-[#0a1e3f]">{title}</div>
          <div className="text-[13px] text-slate-500">{sub} <span className="font-medium text-slate-400">({count})</span></div>
        </div>
      </div>
      <div className={`text-3xl font-bold ${color}`}>
        {pct}%
      </div>
    </div>
  );
}