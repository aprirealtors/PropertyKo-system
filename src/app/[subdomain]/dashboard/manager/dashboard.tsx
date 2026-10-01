"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowRight, PieChart, Users, Home, Building, Lock, CreditCard, BarChart3, CheckCircle2, Clock, Box, AlertTriangle, LayoutDashboard} from "lucide-react";

export default function DashboardTab({ orgData, isLoading: isOrgLoading, onNavigate }: any) {

  const [units, setUnits] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [orgConfig, setOrgConfig] = useState<any>(null);
  const [soaData, setSoaData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Fetch all units and tickets for calculations
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchDashboardData();
    }
  }, [orgData?.admin_email]);

  const fetchDashboardData = async () => {
    setIsLoadingData(true);

    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    const { data: ticketsData } = await supabase
      .from('tickets')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    const { data: tasksData } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    const { data: leasesData } = await supabase
      .from('leases')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    const { data: orgDataConfig } = await supabase
      .from('organizations')
      .select('dues_rate, default_water, default_electricity, default_parking')
      .eq('admin_email', orgData.admin_email)
      .single();

    let fetchedSoa: any[] = [];
    if (unitsData && unitsData.length > 0) {
      const unitIds = unitsData.map(u => u.id);
      const { data: soa } = await supabase.from('soa').select('*').in('unit_id', unitIds);
      fetchedSoa = soa || [];
    }

    setUnits(unitsData || []);
    setTickets(ticketsData || []);
    setTasks(tasksData || []);
    setLeases(leasesData || []); 
    setOrgConfig(orgDataConfig);
    setSoaData(fetchedSoa);
    setIsLoadingData(false);
  };

  // --- MATH & CALCULATIONS ---
  const totalUnits = units.length;

  const totalVacantCount = units.filter(u => u.status === 'Vacant').length;
  const vacancyRate = totalUnits > 0 ? ((totalVacantCount / totalUnits) * 100).toFixed(1) : "0.0";

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

  const occupancyPercentage = totalUnits > 0 ? ((ownersCount / totalUnits) * 100) : 0;
  const ownersPct = totalUnits > 0 ? (ownersCount / totalUnits) * 100 : 0;
  const availablePct = totalUnits > 0 ? (availableCount / totalUnits) * 100 : 0;
  const holdPct = totalUnits > 0 ? (holdCount / totalUnits) * 100 : 0;

  const totalRentPotential = units.reduce((acc, curr) => acc + (curr.monthly_rent || 0), 0);
  const revpau = totalUnits > 0 ? Math.round(totalRentPotential / totalUnits) : 0;

  // --- BILLING COLLECTIONS CALCULATION ---
  let totalExpectedBilling = 0;
  let totalCollectedBilling = 0;

  const duesRate = orgConfig?.dues_rate || 0;
  const defaultWater = orgConfig?.default_water || 0;
  const defaultElectricity = orgConfig?.default_electricity || 0;
  const defaultParking = orgConfig?.default_parking || 0;

  soaData.forEach(soa => {
    const unit = units.find(u => u.id === soa.unit_id);
    if(!unit) return;

    const unitArea = parseFloat(String(unit.unit_area || "0").replace(/[^\d.]/g, '')) || 0;
    const rawDues = duesRate * unitArea;

    let ownerDue = 0;
    if(soa.owner_dues) ownerDue += rawDues;
    if(soa.owner_parking) ownerDue += defaultParking;
    if(soa.owner_water) ownerDue += defaultWater;
    if(soa.owner_electricity) ownerDue += defaultElectricity;

    totalExpectedBilling += ownerDue;
    if(soa.owner_status === 'Paid') totalCollectedBilling += ownerDue;

    let tenantDue = 0;
    if(soa.tenant_dues) tenantDue += rawDues;
    if(soa.tenant_parking) tenantDue += defaultParking;
    if(soa.tenant_water) tenantDue += defaultWater;
    if(soa.tenant_electricity) tenantDue += defaultElectricity;

    totalExpectedBilling += tenantDue;
    if(soa.tenant_status === 'Paid') totalCollectedBilling += tenantDue;
  });

  const collectionPct = totalExpectedBilling > 0 ? (totalCollectedBilling / totalExpectedBilling) * 100 : 0;
  const overdueAccountsCount = soaData.filter(soa => soa.owner_status === 'Overdue' || soa.tenant_status === 'Overdue').length;

  const activeLeases = units.filter(u => u.tenant_name && u.tenant_name !== '—' && u.status !== 'Vacant').length;
  
  const now = new Date().getTime();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  
  const expiringSoon = leases.filter(l => {
    if (l.status !== 'Active' || !l.end_date) return false;
    const endMs = new Date(l.end_date).getTime();
    const diff = endMs - now;
    return diff >= 0 && diff <= thirtyDaysInMs;
  }).length;

  const soasToIssue = ownersCount; 
  const openInboxCount = tickets.filter(t => t.status === 'Open').length;
  const activeTasksCount = tasks.filter(t => !['completed', 'resolved', 'closed', 'rejected'].includes(String(t.status).toLowerCase())).length;
  const totalOpenRepairs = openInboxCount + activeTasksCount;

  const closedTasks = tasks.filter(t => ['completed', 'resolved', 'closed'].includes(String(t.status).toLowerCase()));
  let totalTurnaroundDays = 0;

  closedTasks.forEach(t => {
    const start = new Date(t.created_at).getTime();
    const end = t.updated_at ? new Date(t.updated_at).getTime() : start + (12 * 60 * 60 * 1000); 

    let diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays < 0.1) diffDays = 0.5; 

    totalTurnaroundDays += diffDays;
  });

  const avgTurnaroundDays = closedTasks.length > 0 ? (totalTurnaroundDays / closedTasks.length).toFixed(1) : "0.0";

  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";

  const getLabelCoord = (startPct: number, slicePct: number) => {
    const midPct = startPct + (slicePct / 2);
    const angle = (midPct / 100) * 2 * Math.PI - (Math.PI / 2);
    return {
      x: 50 + 27 * Math.cos(angle),
      y: 50 + 27 * Math.sin(angle)
    };
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10 animate-in fade-in duration-500">

      {/* 🌟 HEADER */}
      <div className="shrink-0 mb-6 px-4 sm:px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 lg:px-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">

          <div className="w-full sm:w-auto min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-white rounded-xl border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                <LayoutDashboard className="text-[var(--color-text)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <span>Dashboard</span>
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap">Portfolio Overview</span> <span className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block"></span> 
              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-inner whitespace-nowrap">
                {isOrgLoading ? "..." : orgData?.units_count || 0} Units Limit
              </span>
            </p>
          </div>

          <div className="flex flex-row items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
            <div className="flex items-center gap-2 bg-emerald-50/70 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm flex-1 sm:flex-none justify-center">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-black text-emerald-700 uppercase tracking-widest whitespace-nowrap">Live Sync</span>
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-3 bg-white px-3 sm:px-3.5 py-1.5 rounded-xl shadow-sm border border-slate-100 flex-1 sm:flex-none">
              <span className="text-[10px] sm:text-xs font-black text-[var(--color-text)] uppercase tracking-wider">Manager</span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs sm:text-sm shadow-sm shrink-0">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoadingData ? (
        <DashboardSkeleton />
      ) : (
        <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row gap-6 lg:gap-8 overflow-y-auto lg:overflow-hidden custom-scrollbar px-4 sm:px-0">

          {/* LEFT COLUMN - Independent scroll on Desktop */}
          <div className="flex-1 w-full flex flex-col gap-6 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pr-2 pb-12 lg:pb-8">

            {/* STATS GRID - 1 Col Mobile, 2 Col Tablet, 4 Col Large Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 shrink-0">
              <StatCard 
                title="VACANCY RATE" 
                value={`${vacancyRate}%`} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><Home size={12} className="shrink-0"/> <span>{totalVacantCount} Vacant</span></span>} 
                icon={Building}
              />
              <StatCard 
                title="COLLECTIONS" 
                value={`${collectionPct.toFixed(1)}%`} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><Clock size={12} className="shrink-0"/> <span>{totalExpectedBilling > 0 ? 'Live SOA Data' : 'Awaiting Data'}</span></span>} 
                icon={CreditCard}
              />
              <StatCard 
                title="REVPAU" 
                value={`₱${revpau.toLocaleString()}`} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><BarChart3 size={12} className="shrink-0"/> <span>Per Avail. Unit</span></span>} 
                icon={BarChart3}
              />
              <StatCard 
                title="ACTIVE LEASES" 
                value={activeLeases.toString()} 
                subtext={<span className="flex items-center text-slate-400 gap-1 font-medium"><Users size={12} className="shrink-0"/> <span>Tenants</span></span>} 
                icon={Users}
              />
            </div>

            <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] p-4 sm:p-6 lg:p-8 shrink-0 flex flex-col gap-6 sm:gap-8 border border-[var(--color-border)]">
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-0 mb-4">
                  <h3 className="font-black text-[var(--color-text)] text-base sm:text-lg tracking-tight">Billing Collected This Month</h3>
                  <span className="bg-slate-50 text-slate-500 font-bold text-[11px] sm:text-xs px-3 py-1.5 rounded-[var(--radius-md)] border border-slate-200 shadow-sm flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start">
                    <CreditCard size={14} className="shrink-0"/> <span>₱{totalCollectedBilling.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    <span className="font-medium text-slate-400 whitespace-nowrap">of ₱{totalExpectedBilling.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </span>
                </div>
                <div className="h-3 sm:h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-[var(--color-primary)] rounded-full shadow-[0_0_12px_var(--color-primary)] relative transition-all duration-1000" style={{ width: `${collectionPct}%` }}>
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>

              <div className="pt-4 sm:pt-6 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-md)] sm:rounded-2xl bg-white border border-[var(--color-primary)]/20 shadow-sm flex items-center justify-center text-[var(--color-text)] shrink-0">
                    <PieChart size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] uppercase tracking-tight">Unit Distribution Overview</h2>
                    <p className="text-slate-400 text-[11px] sm:text-xs font-medium mt-0.5">Current Portfolio Occupancy Overview</p>
                  </div>
                </div>

                {/* PIE CHART SECTION - Flex responsive layout (Col -> Row -> Col -> Row) */}
                <div className="bg-slate-50/50 rounded-[var(--radius-xl)] lg:rounded-[2rem] p-5 sm:p-6 lg:p-8 mb-6 sm:mb-8 border border-slate-100 flex flex-col md:flex-row lg:flex-col xl:flex-row items-center justify-center gap-6 sm:gap-8 lg:gap-12 shadow-sm">
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 shrink-0 transition-transform hover:scale-105 duration-500">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl rounded-full">
                      <g transform="rotate(-90 50 50)">
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="var(--color-slate-700)" strokeWidth="50" strokeDasharray={`${(ownersPct/100)*157.08} 157.08`} strokeDashoffset="0" className="transition-all duration-1000 ease-out" />
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="var(--color-blue-800)" strokeWidth="50" strokeDasharray={`${(availablePct/100)*157.08} 157.08`} strokeDashoffset={`${-(ownersPct/100)*157.08}`} className="transition-all duration-1000 ease-out" />
                        <circle cx="50" cy="50" r="25" fill="transparent" stroke="var(--color-amber-500)" strokeWidth="50" strokeDasharray={`${(holdPct/100)*157.08} 157.08`} strokeDashoffset={`${-((ownersPct + availablePct)/100)*157.08}`} className="transition-all duration-1000 ease-out" />
                        {ownersPct > 0 && availablePct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(${(ownersPct/100)*360} 50 50)`} />}
                        {availablePct > 0 && holdPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(${((ownersPct+availablePct)/100)*360} 50 50)`} />}
                        {holdPct > 0 && ownersPct > 0 && <line x1="50" y1="50" x2="100" y2="50" stroke="white" strokeWidth="1" transform={`rotate(0 50 50)`} />}
                      </g>
                      {ownersPct > 5 && <text x={getLabelCoord(0, ownersPct).x} y={getLabelCoord(0, ownersPct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(ownersPct)}%</text>}
                      {availablePct > 5 && <text x={getLabelCoord(ownersPct, availablePct).x} y={getLabelCoord(ownersPct, availablePct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(availablePct)}%</text>}
                      {holdPct > 5 && <text x={getLabelCoord(ownersPct + availablePct, holdPct).x} y={getLabelCoord(ownersPct + availablePct, holdPct).y} fill="white" fontSize="12" fontWeight="900" textAnchor="middle" dominantBaseline="central" className="drop-shadow-md">{Math.round(holdPct)}%</text>}
                    </svg>
                  </div>

                  <div className="flex-1 w-full max-w-md bg-white rounded-[var(--radius-xl)] lg:rounded-[1.5rem] shadow-lg border border-slate-100 overflow-hidden flex flex-col hover:shadow-xl transition-shadow shrink-0">
                    <div className="bg-[var(--color-secondary)] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-5 text-white shrink-0">
                      <PieChart size={20} className="text-white shrink-0 sm:w-6 sm:h-6" strokeWidth={2.5}/>
                      <span className="font-black text-[14px] sm:text-[16px] lg:text-[18px] tracking-[0.15em] uppercase">Summary Unit</span>
                    </div>
                    <div className="flex flex-col px-2 sm:px-3 py-2 sm:py-3 flex-1">
                      <SummaryRow icon={<Users size={18} className="sm:w-5 sm:h-5 text-[var(--color-text)]" strokeWidth={2.5}/>} title="Owners of Units" sub="Total Occupied" count={ownersCount} pct={Math.round(ownersPct)} color="text-[var(--color-text)]" bg="bg-[var(--color-secondary)]/10" />
                      <div className="h-px bg-slate-100 mx-3 sm:mx-5"></div>
                      <SummaryRow icon={<Building size={18} className="sm:w-5 sm:h-5 text-[var(--color-text)]" strokeWidth={2.5}/>} title="Available Units" sub="Ready for Occupancy" count={availableCount} pct={Math.round(availablePct)} color="text-blue-800" bg="bg-[var(--color-secondary)]/10" />
                      <div className="h-px bg-slate-100 mx-3 sm:mx-5"></div>
                      <SummaryRow icon={<Lock size={18} className="sm:w-5 sm:h-5 text-[var(--color-text)]" strokeWidth={2.5}/>} title="Hold Units" sub="On Hold / Reserved" count={holdCount} pct={Math.round(holdPct)} color="text-amber-500" bg="bg-[var(--color-secondary)]/10" />
                    </div>
                    <div className="bg-[var(--color-secondary)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center mt-auto border-t border-white/10">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-sm shrink-0">
                          <Box size={16} className="text-white/70 sm:w-[18px] sm:h-[18px]"/>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="text-[9px] sm:text-[11px] uppercase font-black text-white/70 tracking-widest">Total Inventory</div>
                          <div className="text-[11px] sm:text-xs font-extrabold text-white">{totalUnits} Recorded Units</div>
                        </div>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-white shrink-0 pl-2">100%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-3 sm:gap-0">
                  <h3 className="font-black text-[var(--color-text)] text-base sm:text-lg tracking-tight">Occupancy Level</h3>
                  <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-[var(--radius-md)] border border-slate-100 flex items-center justify-center w-full sm:w-auto whitespace-nowrap">
                    <span className="text-[var(--color-text)]">{ownersCount} occupied</span> <span className="text-slate-300 mx-1.5 shrink-0">|</span> <span>{totalVacantCount} vacant</span>
                  </span>
                </div>
                <div className="h-3 sm:h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div className="h-full bg-[var(--color-secondary)] transition-all duration-1000 rounded-full" style={{ width: `${occupancyPercentage}%` }}></div>
                  <div className="h-full bg-slate-200 transition-all duration-1000" style={{ width: `${100 - occupancyPercentage}%` }}></div>
                </div>
              </div>

              <div className="pt-4 lg:pt-6 w-full">
                <div className="w-full overflow-x-auto custom-scrollbar pb-2 border-t border-[var(--color-border)] pt-4 sm:pt-6">
                  <table className="w-full text-left text-[11px] sm:text-sm min-w-[450px]">
                    <thead className="text-slate-400 text-[9px] sm:text-[10px] uppercase font-black tracking-widest border-b-2 border-slate-100">
                      <tr>
                        <th className="pb-3 px-2">Recent Units Added</th>
                        <th className="pb-3 px-2">Tenant</th>
                        <th className="pb-3 px-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80 text-slate-700">
                        {units.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-8 sm:py-10 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <Box size={24} className="text-slate-300" />
                                <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">No recent activity detected</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          units.slice(0, 3).map(unit => (
                            <tr key={unit.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="py-3 sm:py-4 px-2 font-extrabold text-[var(--color-text)] group-hover:text-[var(--color-secondary)] transition-colors flex items-center gap-2 sm:gap-3 whitespace-nowrap">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[var(--radius-sm)] sm:rounded-lg bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Home size={14} className="sm:w-3.5 sm:h-3.5"/>
                                </div>
                                <span>{unit.property_name} {unit.unit_number}</span>
                              </td>
                              <td className="py-3 sm:py-4 px-2 text-slate-500 font-semibold whitespace-nowrap">{unit.tenant_name || <span className="italic text-slate-300">Unassigned</span>}</td>
                              <td className="py-3 sm:py-4 px-2 text-right">
                                <span className={`inline-flex items-center justify-center px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shadow-[var(--shadow-sm)] whitespace-nowrap ${unit.status === 'Vacant' ? 'bg-white text-slate-500 border-slate-200' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20'}`}>
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
          </div>

          {/* RIGHT COLUMN - Independent scroll on Desktop, adaptive Grid on Tablet */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col mt-6 lg:mt-0 lg:h-full lg:overflow-y-auto custom-scrollbar lg:pl-2 pb-12 lg:pb-8">
            
            <div className="bg-white rounded-[var(--radius-xl)] lg:rounded-[2rem] shadow-[var(--shadow-sm)] flex flex-col w-full h-fit border border-[var(--color-border)] shrink-0">
              
              <div className="bg-[var(--color-secondary)] p-4 sm:p-5 text-white relative overflow-hidden shrink-0 rounded-t-[var(--radius-xl)] lg:rounded-t-[2rem]">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none"></div>
                <h3 className="font-black text-base sm:text-lg mb-0.5 sm:mb-1 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-400 sm:w-[18px] sm:h-[18px]" strokeWidth={2.5}/> Needs Action
                </h3>
                <p className="text-white/70 text-[10px] sm:text-[11px] font-medium leading-relaxed opacity-90 pr-4">
                  Auto-flagged from live operations. The workflow that used to take 7 days a month.
                </p>
              </div>

              <div className="p-4 sm:p-5 pb-3 sm:pb-4">
                {/* Responsive Action Item Grid: 1 Col (Mobile), 2 Col (Tablet), 1 Col (Desktop Sidebar) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2.5">
                  <AttentionItem label="SOAs To Issue" value={soasToIssue.toString()} isUrgent={soasToIssue > 0} color="text-amber-500" />
                  <AttentionItem label="Overdue Accounts" value={overdueAccountsCount.toString()} isUrgent={overdueAccountsCount > 0} color="text-red-500" />
                  <AttentionItem label="Open Repair Tickets" value={totalOpenRepairs.toString()} isUrgent={totalOpenRepairs > 0} color="text-red-500" />
                  <AttentionItem label="Leases Expiring <30 Days" value={expiringSoon.toString()} isUrgent={expiringSoon > 0} color="text-amber-500" />
                  <AttentionItem label="Avg Repair Turn Around" value={`${avgTurnaroundDays} Days`} isUrgent={Number(avgTurnaroundDays) > 7} color="text-amber-500" />
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-0">
                <button 
                  onClick={() => onNavigate("Billing")}
                  className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] font-black py-3 sm:py-3.5 rounded-[var(--radius-md)] lg:rounded-[var(--radius-lg)] transition-all shadow-[var(--shadow-md)] flex justify-center items-center gap-2 active:scale-95 uppercase tracking-wider text-[11px] sm:text-xs border border-transparent whitespace-nowrap"
                >
                  Issue SOAs & Collect <ArrowRight size={16} strokeWidth={3} className="sm:w-4 sm:h-4 shrink-0" />
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

function StatCard({ title, value, subtext, icon: Icon }: { title: string, value?: string | React.ReactNode, subtext: React.ReactNode, icon?: any }) {
  return (
    <div className="bg-white p-4 sm:p-5 lg:p-6 rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)] lg:rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative border border-transparent hover:border-slate-100 min-h-[120px] lg:min-h-[140px]">
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-slate-50 rounded-full blur-2xl group-hover:bg-[var(--color-primary)]/10 transition-colors pointer-events-none"></div>

      <div className="flex justify-between items-start mb-2 sm:mb-3 relative shrink-0 gap-2">
        <div className="text-[8px] sm:text-xs font-black text-slate-400 tracking-widest uppercase flex-1">{title}</div>
        {Icon && (
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-md)] lg:rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-[var(--color-secondary)] group-hover:scale-110 transition-all shadow-sm shrink-0">
            <Icon size={14} strokeWidth={2.5} className="sm:w-4 sm:h-4" />
          </div>
        )}
      </div>
      <div className="relative flex flex-col justify-end w-full h-full min-w-0">
        {value && <div className="text-2xl sm:text-3xl font-black text-[var(--color-text)] mt-1 mb-1 sm:mb-1.5 tracking-tight group-hover:text-[var(--color-secondary)] transition-colors">{value}</div>}
        <div className="text-[8px] sm:text-xs text-slate-500 w-full">{subtext}</div>
      </div>
    </div>
  );
}

function AttentionItem({ label, value, isUrgent, color }: { label: string, value: string, isUrgent: boolean, color?: string }) {
  return (
    <div className="flex justify-between items-center py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-md)] hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 gap-2">
      <span className="text-[11px] sm:text-[13px] font-semibold text-slate-600 flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
        {isUrgent && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color ? color.replace('text-', 'bg-') : 'bg-[var(--color-secondary)]'} animate-pulse`}></span>}
        <span>{label}</span>
      </span>

      <span className={`shrink-0 text-[10px] sm:text-xs font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-md)] ${
        isUrgent 
          ? `${color ? color.replace('text-', 'bg-').replace(/\d00/g, '50') : 'bg-slate-100'} ${color} border${color ? color.replace('text-', 'border-').replace(/\d00/g, '200') : 'border-slate-200'} shadow-sm` 
          : 'text-slate-400 bg-slate-50 border border-slate-100'
      }`}>
        {value}
      </span>
    </div>
  );
}

function SummaryRow({ icon, title, sub, count, pct, color, bg }: any) {
  return (
    <div className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50 transition-all rounded-[var(--radius-md)] sm:rounded-xl border border-transparent hover:border-slate-100 hover:shadow-[var(--shadow-sm)] group gap-2">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-[var(--radius-sm)] sm:rounded-2xl flex items-center justify-center ${bg} shrink-0 border border-white shadow-sm group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="text-[12px] sm:text-[14px] font-black text-[var(--color-text)] tracking-tight">{title}</div>
          <div className="text-[10px] sm:text-[12px] font-medium text-slate-500">{sub} <span className="font-bold text-slate-400 ml-1">({count})</span></div>
        </div>
      </div>
      <div className={`text-xl sm:text-2xl font-black ${color} tracking-tighter drop-shadow-sm shrink-0`}>
        {pct}%
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row gap-6 lg:gap-8 px-4 sm:px-0 animate-in fade-in duration-300 pb-12 lg:pb-16 overflow-y-auto lg:overflow-hidden">

      <div className="flex-1 w-full flex flex-col gap-6 lg:h-full overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 shrink-0">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-4 sm:p-5 lg:p-6 rounded-[var(--radius-md)] sm:rounded-[var(--radius-lg)] lg:rounded-[var(--radius-xl)] h-[120px] lg:h-[140px] flex flex-col justify-between animate-pulse shadow-sm border border-[var(--color-border)]">
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="w-1/2 h-2.5 bg-slate-200 rounded-md"></div>
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-100 rounded-[var(--radius-sm)] sm:rounded-[var(--radius-md)] lg:rounded-xl shrink-0"></div>
              </div>
              <div className="w-full">
                <div className="w-2/3 h-6 sm:h-8 bg-slate-200 rounded-lg mb-1.5 sm:mb-2"></div>
                <div className="w-1/2 h-2 bg-slate-100 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="w-full flex-1 bg-white rounded-[var(--radius-xl)] animate-pulse shadow-sm p-5 sm:p-6 lg:p-8 flex flex-col border border-[var(--color-border)] shrink-0 min-h-[400px]">
           <div className="w-1/3 min-w-[150px] h-4 sm:h-6 bg-slate-200 rounded-md mb-6 sm:mb-8"></div>
           <div className="w-full h-3 sm:h-4 bg-slate-100 rounded-full mb-10 sm:mb-16"></div>
           <div className="flex flex-col md:flex-row lg:flex-col xl:flex-row items-center gap-8 xl:gap-12 justify-center border-t border-[var(--color-border)] pt-8 sm:pt-10 flex-1">
             <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full border-[24px] sm:border-[30px] border-slate-100 shrink-0"></div>
             <div className="w-full max-w-sm h-56 sm:h-64 bg-slate-50 rounded-2xl border border-[var(--color-border)]"></div>
           </div>
        </div>
      </div>

      <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col mt-6 lg:mt-0">
        <div className="w-full h-auto lg:h-full bg-white rounded-[var(--radius-xl)] lg:rounded-[2rem] animate-pulse shadow-sm flex flex-col overflow-hidden border border-[var(--color-border)] shrink-0">
           <div className="h-28 sm:h-32 bg-slate-200 w-full mb-4 sm:mb-6 shrink-0"></div>
           <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5 flex-1">
             {[1,2,3,4,5].map(i => <div key={i} className="w-full h-10 bg-slate-50 rounded-[var(--radius-md)] border border-slate-100"></div>)}
             <div className="w-full h-12 bg-slate-200 rounded-[var(--radius-lg)] mt-2 sm:mt-4 md:col-span-2 lg:col-span-1"></div>
           </div>
        </div>
      </div>

    </div>
  );
}