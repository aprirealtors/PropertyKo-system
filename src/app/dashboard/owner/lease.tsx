"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, FileCheck, User, Plus, X, CalendarDays } from 'lucide-react';

export default function LeaseTab({ userData, units }: any) {
  const [selectedUnit, setSelectedUnit] = useState<any>(units?.[0] || null);
  const [activeLease, setActiveLease] = useState<any>(null);
  const [isLoadingLease, setIsLoadingLease] = useState(false);

  // Declare Lease Modal States
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTenantName, setFormTenantName] = useState("");
  const [formRent, setFormRent] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");

  useEffect(() => {
    if (units && units.length > 0 && !selectedUnit) {
      setSelectedUnit(units[0]);
    }
  }, [units]);

  useEffect(() => {
    if (selectedUnit) {
      fetchActiveLease(selectedUnit.id);
    }
  }, [selectedUnit]);

  const fetchActiveLease = async (unitId: string) => {
    setIsLoadingLease(true);
    const { data, error } = await supabase
      .from('leases')
      .select('*')
      .eq('unit_id', unitId)
      .in('status', ['Active', 'Pending']) // Allows owners to see their Pending requests
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data && !error) {
      setActiveLease(data);
    } else {
      setActiveLease(null);
    }
    setIsLoadingLease(false);
  };

  const handleOpenDeclareModal = () => {
    // Auto-fill the Tenant Name from the units table if it exists
    const existingTenant = selectedUnit?.tenant_name;
    if (existingTenant && existingTenant !== '—' && existingTenant !== 'Vacant') {
      setFormTenantName(existingTenant);
    } else {
      setFormTenantName("");
    }
    
    // Clear other fields for new entry
    setFormRent("");
    setFormStartDate("");
    setFormEndDate("");
    
    setIsDeclareModalOpen(true);
  };

  const handleDeclareLease = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Background Step: Auto-fetch the tenant's email from team_members to maintain the connection
      let fetchedTenantEmail = "";
      if (formTenantName) {
        const { data: tenantData } = await supabase
          .from('team_members')
          .select('email')
          .ilike('name', formTenantName)
          .eq('admin_email', selectedUnit.admin_email)
          .single();
          
        if (tenantData) {
          fetchedTenantEmail = tenantData.email;
        }
      }

      // 1. Insert into leases table as PENDING
      const { data: newLease, error: leaseError } = await supabase.from('leases').insert([{
        admin_email: selectedUnit.admin_email,
        unit_id: selectedUnit.id,
        tenant_name: formTenantName,
        tenant_email: fetchedTenantEmail, 
        monthly_rent: parseFloat(formRent),
        start_date: formStartDate,
        end_date: formEndDate,
        status: 'Pending' // Requires Manager Approval
      }]).select().single();

      if (leaseError) throw leaseError;

      // Notice: We DO NOT update the units table to Occupied here. 
      // The unit stays 'Vacant' until the Manager approves the lease!

      setActiveLease(newLease);
      setIsDeclareModalOpen(false);
      
      // Reset form
      setFormTenantName("");
      setFormRent("");
      setFormStartDate("");
      setFormEndDate("");
      
    } catch (error: any) {
      console.error("Error declaring lease:", error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!units || units.length === 0) {
    return (
      <div className="w-full mx-auto mt-4 md:mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-10 md:p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
            <Home size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-3 tracking-tight">No Properties Found</h2>
          <p className="text-slate-500 text-sm md:text-base max-w-md mx-auto leading-relaxed">
            You do not currently have any properties assigned to your account.
          </p>
        </div>
      </div>
    );
  }

  const propertyName = selectedUnit?.property_name || "Unassigned Property";
  const unitNumber = selectedUnit?.unit_number ? `Unit ${selectedUnit.unit_number}` : "";

  // Use the active lease data as the source of truth if it exists
  const isVacant = !activeLease;
  const isPending = activeLease?.status === 'Pending';
  const monthlyRent = activeLease?.monthly_rent || 0;
  const tenantName = activeLease?.tenant_name || "—";
  
  const leaseStartDate = activeLease?.start_date 
    ? new Date(activeLease.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  const leaseEndDate = activeLease?.end_date 
    ? new Date(activeLease.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Fixed Header Zone */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm">
                <FileText className="text-[#359b46]" size={24} strokeWidth={2.5} />
              </div>
              Lease Contracts
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Review and declare active tenant contracts
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            {units.length > 1 && (
              <div className="relative flex-1 sm:w-64 group">
                <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={16} strokeWidth={2.5} />
                <select
                  value={selectedUnit?.id || ''}
                  onChange={(e) => setSelectedUnit(units.find((u: any) => u.id === e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white appearance-none cursor-pointer"
                >
                  {units.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.property_name} - Unit {u.unit_number}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            )}

            {/* Premium Profile Badge */}
            <div className="flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Owner</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shadow-inner border border-purple-100 group-hover:scale-105 transition-transform duration-300">
                {userData?.name 
                  ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "OW"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ KANBAN LAYOUT Main Wrapper */}
      <div className="flex-1 w-full max-w-full min-h-0 flex flex-col lg:flex-row gap-6 px-1 sm:px-0 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
        
        {isLoadingLease ? (
          /* 🌟 PREMIUM SKELETON LOADING */
          <>
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 animate-pulse">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col lg:h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
                  <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="h-16 w-full bg-slate-50 rounded-2xl"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-16 w-full bg-slate-50 rounded-2xl"></div>
                    <div className="h-16 w-full bg-slate-50 rounded-2xl"></div>
                  </div>
                  <div className="h-20 w-full bg-slate-100 rounded-2xl mt-4"></div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[32%] xl:w-[28%] shrink-0 flex flex-col animate-pulse mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 flex flex-col lg:h-full">
                <div className="h-40 w-full bg-slate-50 rounded-2xl"></div>
              </div>
            </div>
          </>
        ) : isVacant ? (
          /* EMPTY STATE (VACANT) */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>
              
              <div className="w-20 h-20 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-100 relative z-10">
                <User size={36} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">Unit is Vacant</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                There is currently no active lease record for <span className="font-bold text-slate-700">{propertyName} {unitNumber}</span>. Once a tenant moves in, declare the lease below.
              </p>
              <button 
                onClick={handleOpenDeclareModal}
                className="bg-[#359b46] hover:bg-[#2c813a] text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-wider text-xs shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] flex items-center gap-2 transition-all active:scale-95 relative z-10"
              >
                <Plus size={16} strokeWidth={2.5} /> Declare New Lease
              </button>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: CONTRACT SUMMARY */}
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-0">
              <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                {/* ✨ FIX: Added internal scrollable wrapper */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
                    <h3 className="font-black text-xl text-[#0a1e3f] tracking-tight">Contract Summary</h3>
                    <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-emerald-50 text-[#359b46] border-emerald-200/60'}`}>
                      {isPending ? 'Pending Approval' : 'Active'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-4 shrink-0">
                    <FormField label="Tenant Name" icon={<User size={18} strokeWidth={2.5} />} value={tenantName} />
                    <FormField label="Property" icon={<Home size={18} strokeWidth={2.5} />} value={`${propertyName} · ${unitNumber}`} />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#359b46]" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} />} value={leaseStartDate} />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} />} value={leaseEndDate} />
                    </div>
                    
                    {/* Full Width Document Button */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <button className="w-full bg-emerald-50/50 hover:bg-emerald-50 text-[#359b46] p-4 sm:p-5 rounded-2xl border border-emerald-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white shadow-sm border border-emerald-100 rounded-xl shrink-0 text-[#359b46]">
                            <FileCheck size={20} strokeWidth={2.5} />
                          </div>
                          <div className="text-left">
                            <span className="font-black text-sm sm:text-base text-[#0a1e3f] block tracking-tight">View Full Contract</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">PDF • Official Copy</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100 group-hover:scale-105 group-hover:bg-[#359b46] group-hover:text-white group-hover:border-[#359b46] transition-all shrink-0">
                          <ArrowRight size={16} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: MANAGEMENT ACTIONS */}
            <div className="w-full lg:w-[32%] xl:w-[28%] shrink-0 flex flex-col mt-6 lg:mt-0">
              <div className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] rounded-[2rem] text-white shadow-xl relative overflow-hidden transition-all flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                
                {/* ✨ FIX: Added internal scrollable wrapper */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-emerald-300 mb-6 pb-4 border-b border-white/10 shrink-0">
                    <FileText size={20} strokeWidth={2.5} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Lease Actions</span>
                  </div>
                  
                  <h3 className="font-black text-2xl tracking-tight mb-3 shrink-0">Management</h3>
                  <p className="text-blue-100/70 text-xs sm:text-sm font-medium leading-relaxed mb-8 shrink-0">
                    Update lease terms, initiate renewals, or upload physical signed documents for record keeping.
                  </p>
                  
                  <div className="mt-auto space-y-3 shrink-0">
                    <button 
                      onClick={handleOpenDeclareModal}
                      disabled={isPending}
                      className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-500/50 disabled:text-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-4 font-black uppercase tracking-wider text-[11px] transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] active:scale-95 flex justify-center items-center gap-2 border border-[#359b46] disabled:border-transparent"
                    >
                      {isPending ? "Awaiting Approval" : "Update Lease"} <ArrowRight size={16} strokeWidth={2.5} />
                    </button>

                    <button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl py-4 font-black uppercase tracking-wider text-[11px] transition-all active:scale-[0.98] flex justify-center items-center gap-2 border border-white/20">
                      Upload Signed Doc
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🌟 PREMIUM DECLARE LEASE MODAL */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] border border-slate-200/80 animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-xl font-black text-[#0a1e3f] tracking-tight">Declare Lease</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">{propertyName} / {unitNumber}</p>
              </div>
              <button onClick={() => !isSubmitting && setIsDeclareModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/40">
              <form onSubmit={handleDeclareLease} className="space-y-5">
                
                {/* Auto-filled Tenant Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Tenant Full Name</label>
                  <input 
                    required type="text" placeholder="e.g. John Doe"
                    value={formTenantName} onChange={e => setFormTenantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Monthly Rent</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₱</span>
                    <input 
                      required type="number" min="0" placeholder="0.00"
                      value={formRent} onChange={e => setFormRent(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
                    <input 
                      required type="date"
                      value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">End Date</label>
                    <input 
                      required type="date"
                      value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-5 border-t border-slate-200/60 sticky bottom-0 bg-white/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsDeclareModalOpen(false)} disabled={isSubmitting} className="flex-1 sm:flex-none px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all active:scale-95 shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] active:scale-95 flex items-center justify-center min-w-[150px]">
                    {isSubmitting ? "Submitting..." : "Submit Lease"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, icon, value, valueColor = "text-[#0a1e3f]" }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}
      </label>
      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/70 p-3.5 sm:p-4 rounded-xl hover:bg-white hover:border-[#359b46]/40 transition-colors shadow-inner w-full">
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