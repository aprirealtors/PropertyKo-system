"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, CalendarDays } from 'lucide-react';

export default function LeaseTab({ setActiveTab }: any) {
  const [lease, setLease] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaseData();
  }, []);

  const fetchLeaseData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch Tenant Profile
      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (profile) {
        // 2. Fetch the Active Lease from the new leases table
        const { data: leaseData } = await supabase
          .from('leases')
          .select('*, units!inner(*)') // Joins the unit data so we get property name
          .eq('tenant_email', profile.email)
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (leaseData) {
          setLease(leaseData);
          setUnit(leaseData.units);
        }
      }
    } catch (error) {
      console.error("Error fetching lease data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  const monthlyRent = lease?.monthly_rent || 0;
  
  const leaseStartDate = lease?.start_date 
    ? new Date(lease.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  const leaseEndDate = lease?.end_date 
    ? new Date(lease.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  if (isLoading) {
    // We handle the loading state inside the unified layout below for a seamless transition.
  }

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#1e88e5]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Fixed Header Zone */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 shadow-sm">
                <FileText className="text-[#1e88e5]" size={24} strokeWidth={2.5} />
              </div>
              My Lease
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              View your contract details and history
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            {/* Premium Profile Badge */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0 ml-auto sm:ml-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Tenant</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shadow-inner border border-blue-100 group-hover:scale-105 transition-transform duration-300">
                {unit?.tenant_name 
                  ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "TE"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ KANBAN LAYOUT Main Wrapper */}
      <div className="flex-1 w-full max-w-full min-h-0 flex flex-col lg:flex-row gap-6 px-1 sm:px-0 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
        
        {isLoading ? (
          /* 🌟 PREMIUM SKELETON LOADING */
          <>
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 animate-pulse">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col lg:h-full">
                <div className="h-8 w-48 bg-slate-200 rounded-md mb-8"></div>
                <div className="space-y-4">
                  <div className="h-16 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                  <div className="h-16 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                    <div className="h-16 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                  </div>
                  <div className="h-20 w-full bg-slate-100 rounded-2xl mt-4"></div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[32%] xl:w-[28%] shrink-0 flex flex-col animate-pulse mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 flex flex-col lg:h-full">
                <div className="h-8 w-32 bg-slate-200 rounded-md mb-6"></div>
                <div className="h-24 w-full bg-slate-50 rounded-xl mb-6"></div>
                <div className="h-14 w-full bg-slate-100 rounded-xl mt-auto"></div>
              </div>
            </div>
          </>
        ) : !lease ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>
              
              <div className="w-20 h-20 bg-blue-50 text-[#1e88e5] rounded-full flex items-center justify-center mb-6 shadow-inner border border-blue-100 relative z-10">
                <FileText size={36} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">No Active Lease Found</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                We couldn't find an active lease assigned to your profile. If you believe this is a mistake, please contact your property manager to link your contract.
              </p>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: CONTRACT SUMMARY */}
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-0">
              <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                {/* Internal Scrollable Area */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
                    <h3 className="font-black text-xl text-[#0a1e3f] tracking-tight">Contract Summary</h3>
                    <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200/60">
                      Active
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-4 shrink-0">
                    <FormField label="Unit Address" icon={<Home size={18} strokeWidth={2.5} />} value={`${propertyName} · ${unitNumber}`} />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#1e88e5]" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} />} value={leaseStartDate} />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} />} value={leaseEndDate} />
                    </div>
                    
                    {/* Full Width Document Button */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <button className="w-full bg-blue-50/50 hover:bg-blue-50 text-[#1e88e5] p-4 sm:p-5 rounded-2xl border border-blue-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white shadow-sm border border-blue-100 rounded-xl shrink-0 text-[#1e88e5]">
                            <FileText size={20} strokeWidth={2.5} />
                          </div>
                          <div className="text-left">
                            <span className="font-black text-sm sm:text-base text-[#0a1e3f] block tracking-tight">View Full Contract</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">PDF • Official Copy</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-blue-100 group-hover:scale-105 group-hover:bg-[#1e88e5] group-hover:text-white group-hover:border-[#1e88e5] transition-all shrink-0">
                          <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTACT MANAGEMENT */}
            <div className="w-full lg:w-[32%] xl:w-[28%] shrink-0 flex flex-col mt-6 lg:mt-0">
              <div className="bg-gradient-to-br from-[#1e88e5] to-[#0a1e3f] p-6 sm:p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden transition-all h-full flex flex-col">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="font-black text-2xl tracking-tight mb-4 shrink-0">Need assistance?</h3>
                  <p className="text-blue-100/90 text-sm font-medium leading-relaxed mb-8 shrink-0">
                    If you have questions about your lease, need to terminate early, or want to negotiate a renewal, please message management directly.
                  </p>
                  
                  <div className="mt-auto shrink-0">
                    {/* ✨ FIX: Ginamit ang setActiveTab para lumipat sa Repair/Conversation tab */}
                    <button 
                      onClick={() => setActiveTab('conversation')}
                      className="w-full bg-white text-[#0a1e3f] rounded-xl py-4 font-black uppercase tracking-wider text-[11px] hover:bg-slate-50 transition-all active:scale-[0.98] hover:shadow-xl hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(255,255,255,0.15)] flex justify-center items-center gap-2"
                    >
                      Message Manager <ArrowRight size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FormField({ label, icon, value, valueColor = "text-[#0a1e3f]" }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}
      </label>
      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl hover:bg-white hover:border-[#1e88e5]/40 transition-colors shadow-inner w-full">
        <div className="text-slate-400 shrink-0 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
          {icon}
        </div>
        <div className={`font-black text-sm md:text-base truncate tracking-tight ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}