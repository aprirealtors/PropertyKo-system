"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, BarChart3, Download, Activity } from "lucide-react";

export default function KPIReportsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [units, setUnits] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]); // ✨ Added state for leases
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all units and tasks for KPI calculations
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
      
    // Fetch Maintenance Tasks 
    const { data: tasksData } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    // ✨ Fetch Leases (For accurate Renewal Rate tracking)
    const { data: leasesData } = await supabase
      .from('leases')
      .select('*')
      .eq('admin_email', orgData.admin_email);

    setUnits(unitsData || []);
    setTasks(tasksData || []);
    setLeases(leasesData || []);
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

  // 3. Maintenance Cost per Unit (Summing costs from maintenance_tasks)
  const totalTaskCost = tasks.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);
  const maintenanceCostPerUnit = totalUnits > 0 ? `₱${Math.round(totalTaskCost / totalUnits).toLocaleString()}/unit/yr` : "₱0/unit/yr";

  // 4. Closed Tickets
  const closedTicketsCount = tasks.filter(t => {
    const s = String(t.status || '').toLowerCase();
    return s === 'completed' || s === 'resolved' || s === 'closed';
  }).length;

  // 5. ✨ ACCURATE: Lease Renewal Rate
  // Formula: (Renewed Leases) / (Total Ended Leases [Renewed + Expired + Terminated])
  const endedLeases = leases.filter(l => ['Renewed', 'Expired', 'Terminated'].includes(l.status));
  const renewedCount = endedLeases.filter(l => l.status === 'Renewed').length;
  const leaseRenewalRate = endedLeases.length > 0 
    ? ((renewedCount / endedLeases.length) * 100).toFixed(2) + '%' 
    : "0.00%";

  // Nickname-style initials (e.g. "John Doe" -> "JD")
  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";

  // Consolidate KPI data to allow search filtering
  const allKPIs = [
    { id: 1, label: "Vacancy Rate", current: vacancyRate, use: "High", was: "Monthly" },
    { id: 2, label: "RevPAU", current: revpau, use: "High", was: "Monthly" },
    { id: 3, label: "Maintenance Cost / Unit", current: maintenanceCostPerUnit, use: "High", was: "Monthly" },
    { id: 4, label: "Closed Tickets", current: closedTicketsCount.toString(), use: "High", was: "Monthly" },
    { id: 5, label: "Tenant Turnover", current: "0.00%", use: "High", was: "Monthly" },
    { id: 6, label: "Lease Renewal Rate", current: leaseRenewalRate, use: "High", was: "Monthly" },
    { id: 7, label: "Avg Time To Lease", current: "0 Days", use: "High", was: "Monthly" },
    { id: 8, label: "Lease Conversion", current: "0.00%", use: "High", was: "Monthly" },
    { id: 9, label: "Marketing Cost / Lease", current: "₱0/unit/yr", use: "High", was: "Monthly" }
  ];

  const filteredKPIs = allKPIs.filter(kpi => 
    kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kpi.current.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredKPIs.length === 0) return;

    // Build the CSV headers
    const headers = ["Indicator", "Current Value", "Priority Use", "Traditional Was", "With App"];
    
    // Build the CSV rows based on the filtered KPI list
    const rows = filteredKPIs.map(kpi => {
      return [
        `"${kpi.label}"`,
        `"${kpi.current}"`,
        `"${kpi.use}"`,
        `"${kpi.was}"`,
        `"On-demand"`
      ].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('default', { month: 'short' });
    
    link.setAttribute("href", url);
    link.setAttribute("download", `KPI_Scoreboard_${currentMonth}_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    // LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] relative pb-2 overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10 animate-in fade-in duration-500">
      
      {/* ✨ PREMIUM HEADER SECTION - Themified & Responsive */}
      <div className="shrink-0 mb-4 px-1 sm:px-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 p-4 sm:p-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">
          
          <div className="w-full md:w-auto flex items-center justify-between sm:justify-start min-w-0">
            <div className="flex flex-col min-w-0 pr-2">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2 sm:gap-3 truncate">
                <div className="p-1.5 sm:p-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                  <BarChart3 className="text-[var(--color-text)]" size={24} strokeWidth={2.5} />
                </div>
                <span className="truncate">KPI Reports</span>
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-1.5 sm:gap-2 flex-wrap truncate">
                Live Operational Scoreboard & Automated Metrics
              </p>
            </div>
            
            {/* Mobile-only avatar */}
            <div className="flex flex-col items-end gap-2 sm:hidden shrink-0">
              <div className="w-10 h-10 p-2 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                {initials}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-start md:justify-end w-full md:w-auto gap-3 sm:gap-4 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0 shrink-0">
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 lg:w-72 group shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors z-10 pointer-events-none sm:w-4 sm:h-4" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs sm:text-sm font-medium text-[var(--color-text)] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)] bg-white/80 backdrop-blur-sm shadow-[var(--shadow-sm)] transition-all hover:bg-white"
              />
            </div>

            {/* Desktop/Tablet admin badge */}
            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-primary)]/20 shadow-sm shrink-0">
              <span className="text-xs font-black text-[var(--color-text)] uppercase tracking-wider hidden lg:block">Admin</span>
              <div className="w-10 h-10 md:w-12 md:h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KANBAN LAYOUT: Main Wrapper for Table */}
      <div className="flex-1 w-full max-w-[1700px] mx-auto min-h-0 flex flex-col px-1 sm:px-0 lg:pr-2 pb-2 lg:pb-4">
        <div className="flex-1 min-h-0 bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] flex flex-col overflow-hidden relative">
          
          <div className="absolute top-0 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-[var(--color-primary)]/5 rounded-full blur-3xl -translate-y-10 sm:-translate-y-20 translate-x-10 sm:translate-x-20 pointer-events-none z-0"></div>

          {/* Table Header Section */}
          <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-b border-[var(--color-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/80 backdrop-blur-sm shrink-0 z-10 gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
              <div className="p-1.5 sm:p-2 bg-[var(--color-primary)]/10 text-[var(--color-text)] rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shrink-0">
                <Activity size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </div>
              <h3 className="font-black text-sm sm:text-base md:text-lg text-[var(--color-text)] tracking-tight truncate pr-2">KPI Scoreboard: On-demand vs. Monthly</h3>
            </div>
            
            <button 
              onClick={handleExportCSV}
              disabled={filteredKPIs.length === 0}
              className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-text)] disabled:opacity-50 disabled:pointer-events-none px-3 sm:px-4 py-2.5 sm:py-2 rounded-[var(--radius-md)] transition-all border border-transparent shadow-[var(--shadow-sm)] active:scale-95 w-full sm:w-auto shrink-0"
            >
              <Download size={14} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Export Report
            </button>
          </div>
          
          {/* Scrollable Table Area */}
          <div className="flex-1 min-h-0 overflow-auto relative z-10">
            <table className="w-full text-left text-xs sm:text-sm relative min-w-[700px] sm:min-w-[800px]">
              <thead className="text-[var(--color-primary-text)] bg-[var(--color-primary)] uppercase tracking-widest border-b border-transparent sticky top-0 z-20 text-[9px] sm:text-[10px] shadow-sm">
                <tr>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap border-r border-white/20 font-extrabold">Indicator</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap border-r border-white/20 font-extrabold">Current Value</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 text-center whitespace-nowrap border-r border-white/20 font-extrabold">Priority Use</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap border-r border-white/20 font-extrabold">Traditional Was</th>
                  <th className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-extrabold">With App</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)] bg-white">
                {isLoadingData ? (
                  /* SKELETON LOADING ROWS */
                  Array.from({ length: 9 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="h-4 sm:h-5 w-32 sm:w-48 bg-slate-200 rounded-md"></div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="h-4 sm:h-5 w-16 sm:w-24 bg-slate-200 rounded-md"></div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap flex justify-center">
                        <div className="h-4 sm:h-5 w-10 sm:w-12 bg-slate-200 rounded-full"></div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="h-4 sm:h-5 w-16 sm:w-20 bg-slate-100 rounded-md"></div>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                        <div className="h-5 sm:h-6 w-20 sm:w-24 bg-slate-200 rounded-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredKPIs.length === 0 ? (
                  /* NO RESULTS FOUND */
                  <tr>
                    <td colSpan={5} className="px-4 sm:px-6 py-12 sm:py-16 text-center">
                      <Search className="mx-auto text-slate-300 mb-3 sm:w-8 sm:h-8" size={32} />
                      <p className="text-slate-500 font-bold text-xs sm:text-sm">No metrics found</p>
                      <p className="text-slate-400 text-[10px] sm:text-xs mt-1">Try a different search term.</p>
                    </td>
                  </tr>
                ) : (
                  /* ACTUAL DATA ROWS */
                  filteredKPIs.map((kpi) => (
                    <KPIRow 
                      key={kpi.id} 
                      label={kpi.label} 
                      current={kpi.current} 
                      use={kpi.use} 
                      was={kpi.was} 
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPIRow({ label, current, use, was }: any) {
  const useColor = use === 'High' 
    ? 'bg-red-50 text-red-600 border-red-200' 
    : 'bg-amber-50 text-amber-600 border-amber-200';
    
  return (
    <tr className="hover:bg-[var(--color-primary)]/5 transition-colors group">
      <td className="px-4 sm:px-6 py-3 sm:py-4 font-black text-[var(--color-text)] tracking-tight whitespace-nowrap border-r border-[var(--color-border)] text-xs sm:text-sm">
        {label}
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-[var(--color-text)] whitespace-nowrap border-r border-[var(--color-border)] text-[13px] sm:text-base">
        {current}
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4 text-center whitespace-nowrap border-r border-[var(--color-border)]">
        <span className={`px-2.5 sm:px-3 py-1 rounded-[var(--radius-sm)] text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm ${useColor}`}>
          {use}
        </span>
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)] text-slate-500 font-semibold text-[11px] sm:text-xs">
        {was}
      </td>
      <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
        <span className="bg-[var(--color-primary)]/10 text-[var(--color-text)] border border-[var(--color-primary)]/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-sm group-hover:opacity-90 transition-colors">
          On-demand
        </span>
      </td>
    </tr>
  );
}