"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowRight, PieChart, Users, Home, Building, Lock, CreditCard, BarChart3, CheckCircle2, Clock, Box, AlertTriangle, LayoutDashboard} from "lucide-react";

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
    // ✨ LOCKED LAYOUT WINDOW SHELL: Nakakandado ang overall portal shell para iwas double-scroll at pumantay sa Kanban behavior
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Static Shrink Block (Fixed Header Zone) */}
      <div className="shrink-0 mb-6 px-1 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          
          {/* Left Side: Title & Overview */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm">
                <LayoutDashboard className="text-[#359b46]" size={24} strokeWidth={2.5} />
              </div>
              Dashboard
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Portfolio overview <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-inner">
                {isOrgLoading ? "..." : orgData?.units_count || 0} units limit
              </span>
            </p>
          </div>
          
          {/* Right Side: Live Status & Admin Badge */}
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
            
            {/* System Status Pill (Premium Addition) */}
            <div className="flex items-center gap-2 bg-emerald-50/70 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#359b46]"></span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 uppercase tracking-widest">Live Sync</span>
            </div>

            {/* Enhanced Admin Profile Badge */}
            <div className="flex items-center gap-3 bg-white pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Manager</span>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] sm:rounded-xl bg-[#359b46] hover:bg-[#2c813a] text-white flex items-center justify-center font-black text-xs shadow-inner group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ✨ CONDITIONAL RENDERING: SKELETON LOADER VS REAL DATA */}
      {isLoadingData ? (
        <DashboardSkeleton />
      ) : (
        /* ✨ DUAL COLUMN LAYOUT WRAPPER (Mobile: Auto Stack & Scroll, Desktop: Split) */
        <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row gap-6 lg:gap-8 overflow-y-auto lg:overflow-hidden custom-scrollbar px-1 sm:px-0">
          
          {/* LEFT COLUMN: SCROLLABLE ON DESKTOP */}
          <div className="flex-1 w-full flex flex-col gap-6 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-2 pb-12 lg:pb-16">
            
            {/* 🌟 PREMIUM STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 shrink-0">
              <StatCard 
                title="VACANCY RATE" 
                value={`${vacancyRate}%`} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><Home size={12}/> {availableCount} vacant units</span>} 
                icon={Building}
              />
              <StatCard 
                title="RENT COLLECTION" 
                value="0.0%" 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><Clock size={12}/> Awaiting billing data</span>} 
                icon={CreditCard}
              />
              <StatCard 
                title="REVPAU" 
                value={`₱${revpau.toLocaleString()}`} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><BarChart3 size={12}/> per available unit</span>} 
                icon={BarChart3}
              />
              <StatCard 
                title="LEASE RENEWAL" 
                value="0.0%" 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><CheckCircle2 size={12}/> 0 / 0 renewed</span>} 
                icon={CheckCircle2}
              />
            </div>

            {/* 🌟 MAIN VISUAL DATA CARD */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 sm:p-8 shrink-0">
              
              {/* GLOWING RENT COLLECTED BAR */}
              <div className="mb-12">
                <div className="flex justify-between items-end mb-4">
                  <h3 className="font-black text-[#0a1e3f] text-lg tracking-tight">Rent collected this month</h3>
                  <span className="bg-slate-50 text-slate-500 font-bold text-xs px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
                    <CreditCard size={14}/> ₱0 <span className="font-medium text-slate-400">of ₱{totalRentPotential.toLocaleString()}</span>
                  </span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-3 shadow-inner">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-[#359b46] rounded-full shadow-[0_0_12px_rgba(53,155,70,0.4)] relative" style={{ width: '0%' }}>
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex gap-5 text-xs font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#359b46] shadow-[0_0_5px_rgba(53,155,70,0.5)]"></div> Collected (0%)
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300"></div> Outstanding <span className="text-slate-600">₱{totalRentPotential.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* PIE CHART SECTION */}
              <div className="pt-8 border-t border-slate-100/80">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0a1e3f] to-[#122b54] flex items-center justify-center text-white shadow-lg shadow-blue-900/20 shrink-0 border border-[#0a1e3f]">
                    <PieChart size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#0a1e3f] uppercase tracking-tight">Unit Distribution Overview</h2>
                    <p className="text-slate-400 text-xs font-medium mt-0.5">Current portfolio occupancy overview</p>
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-[2rem] p-6 sm:p-8 mb-10 border border-slate-100 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 shadow-sm">
                  
                  {/* Solid SVG Pie Chart */}
                  <div className="relative w-56 h-56 sm:w-64 sm:h-64 shrink-0 transition-transform hover:scale-105 duration-500">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl rounded-full">
                      <g transform="rotate(-90 50 50)">
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="#0a1e3f" strokeWidth="50" strokeDasharray={`${(ownersPct/100)*157.08} 157.08`} strokeDashoffset="0" className="transition-all duration-1000 ease-out" />
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="#359b46" strokeWidth="50" strokeDasharray={`${(availablePct/100)*157.08} 157.08`} strokeDashoffset={`${-(ownersPct/100)*157.08}`} className="transition-all duration-1000 ease-out" />
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="#94a3b8" strokeWidth="50" strokeDasharray={`${(holdPct/100)*157.08} 157.08`} strokeDashoffset={`${-((ownersPct + availablePct)/100)*157.08}`} className="transition-all duration-1000 ease-out" />
                        {ownersPct > 0 && availablePct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(${(ownersPct/100)*360} 50 50)`} />}
                        {availablePct > 0 && holdPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(${((ownersPct+availablePct)/100)*360} 50 50)`} />}
                        {holdPct > 0 && ownersPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(0 50 50)`} />}
                      </g>
                      {ownersPct > 5 && <text x={getLabelCoord(0, ownersPct).x} y={getLabelCoord(0, ownersPct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(ownersPct)}%</text>}
                      {availablePct > 5 && <text x={getLabelCoord(ownersPct, availablePct).x} y={getLabelCoord(ownersPct, availablePct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(availablePct)}%</text>}
                      {holdPct > 5 && <text x={getLabelCoord(ownersPct + availablePct, holdPct).x} y={getLabelCoord(ownersPct + availablePct, holdPct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(holdPct)}%</text>}
                    </svg>
                  </div>

                  {/* Unit Summary Card */}
                  <div className="flex-1 w-full min-w-[280px] max-w-md bg-white rounded-[1.5rem] shadow-lg border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl transition-shadow">
                    <div className="bg-gradient-to-r from-[#0a1e3f] to-[#122b54] px-6 py-4 flex items-center gap-3 text-white shrink-0">
                      <PieChart size={18} className="text-blue-300" strokeWidth={2.5}/>
                      <span className="font-black text-[12px] tracking-[0.15em] uppercase">Unit Summary</span>
                    </div>
                    <div className="flex flex-col px-3 py-3 flex-1">
                      <SummaryRow icon={<Users size={20} strokeWidth={2.5} className="text-[#0a1e3f]"/>} title="Owners of Units" sub="Total Occupied" count={ownersCount} pct={Math.round(ownersPct)} color="text-[#0a1e3f]" bg="bg-blue-50" />
                      <div className="h-px bg-slate-100 mx-5"></div>
                      <SummaryRow icon={<Building size={20} strokeWidth={2.5} className="text-[#359b46]"/>} title="Available Units" sub="Ready for Occupancy" count={availableCount} pct={Math.round(availablePct)} color="text-[#359b46]" bg="bg-emerald-50" />
                      <div className="h-px bg-slate-100 mx-5"></div>
                      <SummaryRow icon={<Lock size={20} strokeWidth={2.5} className="text-slate-500"/>} title="Hold Units" sub="On Hold / Reserved" count={holdCount} pct={Math.round(holdPct)} color="text-slate-500" bg="bg-slate-100" />
                    </div>
                    <div className="bg-gradient-to-r from-[#0a1e3f] to-[#122b54] px-6 py-4 flex justify-between items-center mt-auto border-t border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                          <Box size={18} className="text-slate-400"/>
                        </div>
                        <div className="flex flex-col">
                          <div className="text-[11px] uppercase font-black text-slate-100 tracking-widest">Total Inventory</div>
                          <div className="text-xs font-extrabold text-slate-100">{totalUnits} recorded units</div>
                        </div>
                      </div>
                      <div className="text-2xl font-black text-slate-300">100%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* OCCUPANCY STACKED BAR */}
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <h3 className="font-black text-[#0a1e3f] text-lg tracking-tight">Occupancy Level</h3>
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <span className="text-[#0a1e3f]">{ownersCount} occupied</span> <span className="text-slate-300 mx-1">|</span> {availableCount} vacant
                  </span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-3 flex shadow-inner">
                  <div className="h-full bg-gradient-to-r from-[#0a1e3f] to-[#1a386d] transition-all duration-1000 rounded-full shadow-[0_0_8px_rgba(10,30,63,0.5)]" style={{ width: `${occupancyPercentage}%` }}></div>
                  <div className="h-full bg-slate-200 transition-all duration-1000" style={{ width: `${100 - occupancyPercentage}%` }}></div>
                </div>
              </div>

              {/* RECENT ACTIVITY TABLE */}
              <div>
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400 text-[10px] uppercase font-black tracking-widest border-b-2 border-slate-100">
                    <tr>
                      <th className="pb-3 px-2">Recent Units Added</th>
                      <th className="pb-3 px-2">Tenant</th>
                      <th className="pb-3 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 text-slate-700">
                     {units.length === 0 ? (
                       <tr>
                         <td colSpan={3} className="py-10 text-center">
                           <div className="flex flex-col items-center gap-2">
                             <Box size={24} className="text-slate-300" />
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">No recent activity detected</span>
                           </div>
                         </td>
                       </tr>
                     ) : (
                       units.slice(0, 3).map(unit => (
                         <tr key={unit.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="py-4 px-2 font-extrabold text-[#0a1e3f] group-hover:text-[#359b46] transition-colors flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                               <Home size={14} />
                             </div>
                             {unit.property_name} {unit.unit_number}
                           </td>
                           <td className="py-4 px-2 text-slate-500 font-semibold">{unit.tenant_name || <span className="italic text-slate-300">Unassigned</span>}</td>
                           <td className="py-4 px-2 text-right">
                             <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm ${unit.status === 'Vacant' ? 'bg-white text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'}`}>
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

          {/* RIGHT COLUMN: NON-SCROLLABLE / FIXED TO RIGHT (DESKTOP) */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col">
            <div className="bg-white rounded-[2rem] shadow-lg shadow-blue-900/5 border border-slate-200 overflow-hidden flex flex-col w-full h-fit lg:h-full">
              <div className="bg-gradient-to-br from-[#0a1e3f] to-[#16305c] p-6 sm:p-8 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none"></div>
                <h3 className="font-black text-xl mb-1 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-400" strokeWidth={2.5}/> Needs Action
                </h3>
                <p className="text-blue-200 text-xs font-medium leading-relaxed opacity-90">
                  Auto-flagged from live operations—the workflow that used to take 7 days a month.
                </p>
              </div>
              
              <div className="p-6 sm:p-8 bg-white flex-1 flex flex-col">
                <div className="space-y-3 mb-8">
                  <AttentionItem label="SOAs to issue" value={soasToIssue.toString()} isUrgent={soasToIssue > 0} color="text-amber-500" />
                  <AttentionItem label="Overdue accounts" value="0" isUrgent={false} />
                  <AttentionItem label="Open repair tickets" value={openTickets.toString()} isUrgent={openTickets > 0} color="text-red-500" />
                  <AttentionItem label="Leases expiring <30d" value="0" isUrgent={false} />
                  <AttentionItem label="Avg repair turnaround" value="-- days" isUrgent={false} />
                  <AttentionItem label="Days in A/R (DSO)" value="--" isUrgent={false} />
                </div>

                <button 
                  onClick={() => onNavigate("Billing")}
                  className="w-full mt-auto bg-gradient-to-r from-[#359b46] to-[#2c813a] hover:from-[#2e883e] hover:to-[#22672e] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 flex justify-center items-center gap-2 active:scale-[0.98] uppercase tracking-wider text-xs"
                >
                  Issue SOAs & Collect <ArrowRight size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTS ---

function StatCard({ title, value, subtext, icon: Icon }: { title: string, value: string, subtext: React.ReactNode, icon?: any }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-[1.5rem] shadow-sm border border-slate-200/60 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative">
      {/* Background Accent Glow */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-slate-50 rounded-full blur-2xl group-hover:bg-blue-50/50 transition-colors pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase">{title}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[#359b46] group-hover:scale-110 transition-all shadow-sm">
            <Icon size={16} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="relative z-10">
        <div className="text-3xl font-black text-[#0a1e3f] mt-1 mb-1.5 tracking-tight group-hover:text-[#359b46] transition-colors">{value}</div>
        <div className="text-xs text-slate-500">{subtext}</div>
      </div>
    </div>
  );
}

function AttentionItem({ label, value, isUrgent, color }: { label: string, value: string, isUrgent: boolean, color?: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 gap-2">
      
      {/* ✨ FIX: min-w-0 at flex-1 para mag-shrink nang tama ang left side container */}
      <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-2 min-w-0 flex-1">
        {isUrgent && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color ? color.replace('text-', 'bg-') : 'bg-[#0a1e3f]'} animate-pulse`}></span>}
        {/* ✨ FIX: truncate class para maging 1-line at magka-ellipsis (...) kapag kulang ang space */}
        <span className="truncate">{label}</span>
      </span>

      {/* ✨ FIX: shrink-0 para hindi lumiit o mapipi ang count badge sa kanan kapag mahaba ang text sa kaliwa */}
      <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-lg ${
        isUrgent 
          ? `${color ? color.replace('text-', 'bg-').replace(/\d00/g, '50') : 'bg-slate-100'} ${color} border ${color ? color.replace('text-', 'border-').replace(/\d00/g, '200') : 'border-slate-200'} shadow-sm` 
          : 'text-slate-400 bg-slate-50 border border-slate-100'
      }`}>
        {value}
      </span>
      
    </div>
  );
}

function SummaryRow({ icon, title, sub, count, pct, color, bg }: any) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all rounded-xl border border-transparent hover:border-slate-100 hover:shadow-sm group">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bg} shrink-0 border border-white shadow-sm group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <div className="text-[14px] font-black text-[#0a1e3f] tracking-tight">{title}</div>
          <div className="text-[12px] font-medium text-slate-500">{sub} <span className="font-bold text-slate-400 ml-1">({count})</span></div>
        </div>
      </div>
      <div className={`text-2xl font-black ${color} tracking-tighter drop-shadow-sm`}>
        {pct}%
      </div>
    </div>
  );
}

// ✨ NEW: SKELETON LOADING UI FOR DASHBOARD (MATCHES KANBAN-STYLE LAYOUT)
function DashboardSkeleton() {
  return (
    <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row gap-6 lg:gap-8 px-1 sm:px-0 animate-in fade-in duration-300 pb-12 lg:pb-16">
      
      {/* SKELETON LEFT COLUMN */}
      <div className="flex-1 w-full flex flex-col gap-6 lg:h-full overflow-hidden">
        {/* Skeleton Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 shrink-0">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-5 sm:p-6 rounded-[1.5rem] border border-slate-200/60 h-32 flex flex-col justify-between animate-pulse shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="w-1/2 h-2.5 bg-slate-200 rounded-md"></div>
                <div className="w-8 h-8 bg-slate-100 rounded-xl"></div>
              </div>
              <div>
                <div className="w-2/3 h-8 bg-slate-200 rounded-lg mb-2"></div>
                <div className="w-1/2 h-2 bg-slate-100 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton Main Visual Card */}
        <div className="w-full flex-1 bg-white rounded-[2rem] border border-slate-200/80 animate-pulse shadow-sm p-6 sm:p-8 flex flex-col">
           <div className="w-1/3 h-6 bg-slate-200 rounded-md mb-8"></div>
           <div className="w-full h-4 bg-slate-100 rounded-full mb-16"></div>
           <div className="flex flex-col md:flex-row items-center gap-12 justify-center border-t border-slate-100 pt-10">
             <div className="w-56 h-56 rounded-full border-[30px] border-slate-100"></div>
             <div className="w-full max-w-sm h-64 bg-slate-50 rounded-2xl"></div>
           </div>
        </div>
      </div>

      {/* SKELETON RIGHT COLUMN */}
      <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col">
        <div className="w-full h-[550px] lg:h-full bg-white rounded-[2rem] border border-slate-200/80 animate-pulse shadow-sm flex flex-col overflow-hidden">
           <div className="h-32 bg-slate-200 w-full mb-6"></div>
           <div className="p-6 space-y-5">
             {[1,2,3,4,5,6].map(i => <div key={i} className="w-full h-10 bg-slate-50 rounded-xl"></div>)}
             <div className="w-full h-12 bg-slate-200 rounded-2xl mt-8"></div>
           </div>
        </div>
      </div>
      
    </div>
  );
}