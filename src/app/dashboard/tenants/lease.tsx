"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, CalendarDays } from 'lucide-react';

export default function LeaseTab() {
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
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-in fade-in duration-500 w-full">
        <div className="w-12 h-12 border-4 border-[#1e88e5]/20 border-t-[#1e88e5] rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm animate-pulse">Loading lease details...</p>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="w-full mx-auto mt-4 md:mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-10 md:p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
            <FileText size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-3 tracking-tight">No Active Lease Found</h2>
          <p className="text-slate-500 text-sm md:text-base max-w-md mx-auto leading-relaxed">
            We couldn't find an active lease assigned to your profile. If you believe this is a mistake, please contact your property manager to link your contract.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#0a1e3f] tracking-tight">My Lease</h2>
        <p className="text-slate-500 text-sm md:text-base mt-1">View your contract details and history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        
        {/* LEFT COLUMN: 1-Column Form Layout */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md">
            <h3 className="font-extrabold text-lg md:text-xl mb-6 text-[#0a1e3f]">Contract Summary</h3>
            
            <div className="flex flex-col gap-4">
              <FormField label="Unit Address" icon={<Home size={20} />} value={`${propertyName} · ${unitNumber}`} />
              <FormField label="Monthly Rent" icon={<CreditCard size={20} />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#1e88e5]" />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Lease Start" icon={<CalendarDays size={20} />} value={leaseStartDate} />
                <FormField label="Lease Ends" icon={<Calendar size={20} />} value={leaseEndDate} />
              </div>
              
              <div className="mt-4 pt-2">
                <button className="w-full bg-blue-50/50 hover:bg-blue-50 text-[#1e88e5] p-4 sm:p-5 rounded-2xl border border-blue-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-white shadow-sm border border-blue-100 rounded-xl shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="text-left">
                      <span className="font-extrabold text-sm sm:text-base text-[#0a1e3f] block">View Full Contract</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">PDF • Official Copy</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-blue-100 group-hover:scale-105 transition-transform shrink-0">
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Contact Management */}
        <div className="lg:col-span-5">
          <section className="bg-gradient-to-br from-[#1e88e5] to-[#0a1e3f] p-6 md:p-8 rounded-3xl text-white shadow-2xl shadow-blue-900/20 sticky top-24 relative overflow-hidden transition-all">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
            
            <div className="relative z-10">
              <h3 className="font-extrabold text-2xl md:text-3xl mb-4 tracking-tight">Need assistance?</h3>
              <p className="text-blue-100/90 mb-8 text-sm md:text-base leading-relaxed">
                If you have questions about your lease, need to terminate early, or want to negotiate a renewal, please message management directly.
              </p>
              
              <button className="w-full bg-white text-[#0a1e3f] rounded-2xl py-4 font-black text-sm md:text-base hover:bg-slate-50 transition-all active:scale-[0.98] shadow-lg flex justify-center items-center gap-2">
                Message Manager <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
        
      </div>
    </div>
  );
}

function FormField({ label, icon, value, valueColor = "text-[#0a1e3f]" }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}
      </label>
      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/70 p-4 rounded-2xl hover:bg-white hover:border-[#1e88e5]/40 transition-colors shadow-sm w-full">
        <div className="text-slate-400 shrink-0">
          {icon}
        </div>
        <div className={`font-extrabold text-sm md:text-base truncate ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}