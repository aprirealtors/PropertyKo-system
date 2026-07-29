"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, BarChart3, Download, Activity } from "lucide-react";

export default function KPIReportsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database States
  const [units, setUnits] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState("");

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

  // Consolidate KPI data to allow search filtering
  const allKPIs = [
    { id: 1, label: "Vacancy rate", current: vacancyRate, use: "High", was: "Monthly" },
    { id: 2, label: "RevPAU", current: revpau, use: "High", was: "Monthly" },
    { id: 3, label: "Maintenance cost / unit", current: maintenanceCostPerUnit, use: "High", was: "Monthly" },
    { id: 4, label: "Tenant turnover", current: "0.00%", use: "High", was: "Monthly" },
    { id: 5, label: "Lease renewal", current: "0.00%", use: "High", was: "Monthly" },
    { id: 6, label: "Avg time to lease", current: "0 days", use: "High", was: "Monthly" },
    { id: 7, label: "Lease conversion", current: "0.00%", use: "High", was: "Monthly" },
    { id: 8, label: "Rent collection", current: "0.00%", use: "High", was: "Monthly" },
    { id: 9, label: "Days in A/R (DSO)", current: "0.0", use: "Med", was: "N/A" },
    { id: 10, label: "Marketing cost / lease", current: "₱0/unit/yr", use: "High", was: "Monthly" }
  ];

  const filteredKPIs = allKPIs.filter(kpi => 
    kpi.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kpi.current.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ✨ ADDED: Export to CSV Function
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
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-40px)] md:h-[calc(100vh-50px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Fixed Header Zone */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm">
                <BarChart3 className="text-[#359b46]" size={24} strokeWidth={2.5} />
              </div>
              KPI Reports
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Live operational scoreboard and automated metrics
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            
            {/* Search Bar */}
            <div className="relative flex-1 sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#359b46] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search metrics..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white relative"
              />
            </div>

            {/* Premium Admin Profile Badge */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Admin</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-[#359b46] hover:bg-[#2c813a] text-white flex items-center justify-center font-black text-xs shadow-inner group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ KANBAN LAYOUT: Main Wrapper for Table */}
      <div className="flex-1 w-full max-w-6xl mx-auto min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-12">
        <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-sm border border-slate-200/80 flex flex-col overflow-hidden relative">
          
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

          {/* Table Header Section */}
          <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/80 backdrop-blur-sm shrink-0 z-10 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-blue-50 text-[#1d82f5] rounded-lg border border-blue-100">
                <Activity size={18} strokeWidth={2.5} />
              </div>
              <h3 className="font-black text-lg text-[#0a1e3f] tracking-tight">KPI Scoreboard: On-demand vs. Monthly Manual</h3>
            </div>
            {/* ✨ ATTACHED THE FUNCTION HERE */}
            <button 
              onClick={handleExportCSV}
              disabled={filteredKPIs.length === 0}
              className="flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#1d82f5] bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:pointer-events-none px-4 py-2 rounded-xl transition-all border border-blue-200/60 shadow-sm active:scale-95 w-full sm:w-auto"
            >
              <Download size={14} strokeWidth={2.5} /> Export Report
            </button>
          </div>
          
          {/* Scrollable Table Area */}
          <div className="flex-1 min-h-0 overflow-auto relative z-10">
            <table className="w-full text-left text-sm relative">
              <thead className="text-emerald-50 bg-[#359b46] font-extrabold uppercase tracking-widest border-b border-[#2c813a] sticky top-0 z-20 text-[10px] shadow-md">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Indicator</th>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Current Value</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap border-r border-[#43af55]">Priority Use</th>
                  <th className="px-6 py-4 whitespace-nowrap border-r border-[#43af55]">Traditional Was</th>
                  <th className="px-6 py-4 whitespace-nowrap">With App</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                {isLoadingData ? (
                  /* ✨ SKELETON LOADING ROWS */
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-5 w-48 bg-slate-200 rounded-md"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-5 w-24 bg-slate-200 rounded-md"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap flex justify-center">
                        <div className="h-5 w-12 bg-slate-200 rounded-full"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-5 w-20 bg-slate-100 rounded-md"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 w-24 bg-emerald-100/50 rounded-full"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredKPIs.length === 0 ? (
                  /* NO RESULTS FOUND */
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center">
                      <Search className="mx-auto text-slate-300 mb-3" size={32} />
                      <p className="text-slate-500 font-bold text-sm">No metrics found</p>
                      <p className="text-slate-400 text-xs mt-1">Try a different search term.</p>
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
    <tr className="hover:bg-blue-50/30 transition-colors group">
      <td className="px-6 py-4 font-black text-[#0a1e3f] tracking-tight whitespace-nowrap border-r border-slate-50">
        {label}
      </td>
      <td className="px-6 py-4 font-bold text-[#359b46] whitespace-nowrap border-r border-slate-50 text-base">
        {current}
      </td>
      <td className="px-6 py-4 text-center whitespace-nowrap border-r border-slate-50">
        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${useColor}`}>
          {use}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap border-r border-slate-50 text-slate-400 font-semibold text-xs">
        {was}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm group-hover:bg-[#359b46] group-hover:text-white transition-colors">
          On-demand
        </span>
      </td>
    </tr>
  );
}