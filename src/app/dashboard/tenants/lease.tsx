"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, CalendarDays, User, FileCheck } from 'lucide-react';

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
          .select('*, units!inner(*)') // Joins the unit data so we get property name AND owner name
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
  const ownerName = unit?.owner_name || "Administration"; // ✨ Fetched the Owner's Name
  const monthlyRent = lease?.monthly_rent || 0;
  
  const leaseStartDate = lease?.start_date 
    ? new Date(lease.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  const leaseEndDate = lease?.end_date 
    ? new Date(lease.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="absolute inset-0 flex flex-col bg-[#f4f7f9] font-sans z-20 overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER - Glassmorphism & Fully Responsive */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 sm:py-5 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 shadow-sm shrink-0">
                <FileText className="text-[#1e88e5] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight truncate">
                  My Lease
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium truncate">
                  View your contract details and history
                </p>
              </div>
            </div>
            {/* Mobile Profile Icon */}
            <div className="md:hidden w-9 h-9 rounded-[10px] bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shadow-inner border border-blue-100 shrink-0">
              {unit?.tenant_name 
                ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                : "TE"}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4 shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
              <span className="text-[11px] font-extrabold text-[#0a1e3f] leading-none">Tenant</span>
            </div>
            <div className="w-10 h-10 rounded-[12px] bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs shadow-inner border border-blue-100 group-hover:scale-105 transition-transform duration-300">
              {unit?.tenant_name 
                ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                : "TE"}
            </div>
          </div>

        </div>
      </div>

      {/* ✨ KANBAN LAYOUT Main Wrapper - Mobile Stack, Desktop Side-by-Side */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto custom-scrollbar lg:overflow-hidden pb-[100px] lg:pb-6">
        
        {isLoading ? (
          /* 🌟 PREMIUM SKELETON LOADING */
          <>
            <div className="w-full lg:flex-1 flex flex-col animate-pulse">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200/60 p-5 sm:p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="h-6 w-40 sm:w-48 bg-slate-200 rounded-md"></div>
                  <div className="h-6 w-20 sm:w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-2xl"></div>
                    <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-2xl"></div>
                  </div>
                  <div className="h-16 sm:h-20 w-full bg-slate-100 rounded-2xl mt-4"></div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col animate-pulse mt-4 lg:mt-0">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200/60 p-5 sm:p-8 flex flex-col h-full">
                <div className="h-8 w-32 bg-slate-200 rounded-md mb-6"></div>
                <div className="h-24 w-full bg-slate-50 rounded-xl mb-6"></div>
                <div className="h-14 w-full bg-slate-100 rounded-xl mt-auto"></div>
              </div>
            </div>
          </>
        ) : !lease ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 sm:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-blue-50 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-50 text-[#1e88e5] rounded-full flex items-center justify-center mb-5 sm:mb-6 shadow-inner border border-blue-100 relative z-10">
                <FileText size={32} strokeWidth={1.5} className="sm:w-9 sm:h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">No Active Lease Found</h2>
              <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                We couldn't find an active lease assigned to your profile. If you believe this is a mistake, please contact your property manager to link your contract.
              </p>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: CONTRACT SUMMARY */}
            <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                {/* Internal Scrollable Area */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-5 sm:mb-6 border-b border-slate-100 pb-4 shrink-0 gap-3">
                    <h3 className="font-black text-lg sm:text-xl text-[#0a1e3f] tracking-tight truncate">Contract Summary</h3>
                    <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200/60 shrink-0">
                      Active
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
                    {/* ✨ Added Owner Display */}
                    <FormField label="Property Owner" icon={<User size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={ownerName} />
                    <FormField label="Unit Address" icon={<Home size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={`${propertyName} · ${unitNumber}`} />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#1e88e5]" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={leaseStartDate} />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={leaseEndDate} />
                    </div>
                    
                    {/* Full Width Document Button */}
                    <div className="mt-3 sm:mt-4 pt-4 border-t border-slate-100">
                      <button className="w-full bg-blue-50/50 hover:bg-blue-50 text-[#1e88e5] p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl border border-blue-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="p-2.5 sm:p-3 bg-white shadow-sm border border-blue-100 rounded-xl shrink-0 text-[#1e88e5]">
                            <FileCheck size={20} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="font-black text-[13px] sm:text-base text-[#0a1e3f] block tracking-tight truncate">View Full Contract</span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 truncate">PDF • Official Copy</span>
                          </div>
                        </div>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-blue-100 group-hover:scale-105 group-hover:bg-[#1e88e5] group-hover:text-white group-hover:border-[#1e88e5] transition-all shrink-0">
                          <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTACT MANAGEMENT */}
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col mt-4 lg:mt-0">
              <div className="bg-gradient-to-br from-[#1e88e5] to-[#0a1e3f] p-5 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] text-white shadow-xl relative overflow-hidden transition-all lg:h-full flex flex-col">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white opacity-5 rounded-full -mr-16 sm:-mr-20 -mt-16 sm:-mt-20 pointer-events-none"></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="font-black text-xl sm:text-2xl tracking-tight mb-3 sm:mb-4 shrink-0">Need assistance?</h3>
                  <p className="text-blue-100/90 text-[12px] sm:text-sm font-medium leading-relaxed mb-6 sm:mb-8 shrink-0">
                    If you have questions about your lease, need to terminate early, or want to negotiate a renewal, please message management directly.
                  </p>
                  
                  <div className="mt-auto shrink-0">
                    <button 
                      onClick={() => setActiveTab('conversation')}
                      className="w-full bg-white text-[#0a1e3f] rounded-xl py-3.5 sm:py-4 font-black uppercase tracking-wider text-[11px] sm:text-xs hover:bg-slate-50 transition-all active:scale-[0.98] hover:shadow-xl hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(255,255,255,0.15)] flex justify-center items-center gap-2"
                    >
                      Message Manager <ArrowRight size={16} strokeWidth={2.5} className="w-4 h-4" />
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

// ✨ FIX: Updated FormField with min-w-0 for perfect mobile truncation
function FormField({ label, icon, value, valueColor = "text-[#0a1e3f]" }: any) {
  return (
    <div className="flex flex-col min-w-0">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">
        {label}
      </label>
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/70 p-3 sm:p-4 rounded-xl hover:bg-white hover:border-[#1e88e5]/40 transition-colors shadow-inner w-full min-w-0">
        <div className="text-slate-400 shrink-0 bg-white p-2 sm:p-2.5 rounded-lg border border-slate-100 shadow-sm flex items-center justify-center">
          {icon}
        </div>
        <div className={`font-black text-[13px] sm:text-base truncate tracking-tight min-w-0 w-full ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}