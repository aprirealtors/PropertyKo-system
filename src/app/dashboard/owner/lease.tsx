"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, FileCheck, User, Plus, X, CalendarDays } from 'lucide-react';

export default function LeaseTab({ userData, units }: any) {
  // Sort the units alphabetically by Property Name, then numerically by Unit Number
  const sortedUnits = useMemo(() => {
    if (!units) return [];
    return [...units].sort((a, b) => {
      const nameA = String(a.property_name || "");
      const nameB = String(b.property_name || "");
      const nameComparison = nameA.localeCompare(nameB);
      
      if (nameComparison !== 0) {
        return nameComparison; // Sort by Property Name (A-Z)
      }
      
      // If property names are the same, sort by unit number
      const unitA = String(a.unit_number || "");
      const unitB = String(b.unit_number || "");
      return unitA.localeCompare(unitB, undefined, { numeric: true });
    });
  }, [units]);

  const [selectedUnit, setSelectedUnit] = useState<any>(sortedUnits?.[0] || null);
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
    if (sortedUnits && sortedUnits.length > 0 && !selectedUnit) {
      setSelectedUnit(sortedUnits[0]);
    }
  }, [sortedUnits, selectedUnit]);

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

  if (!sortedUnits || sortedUnits.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 sm:p-12 md:p-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border border-slate-100">
            <Home size={32} className="sm:w-9 sm:h-9" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 sm:mb-3 tracking-tight">No Properties Found</h2>
          <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-6 sm:mb-8">
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
    <div className="absolute inset-0 flex flex-col bg-[#f4f7f9] font-sans z-20 overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER - Glassmorphism & Fully Responsive */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 sm:py-5 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm shrink-0">
                <FileText className="text-[#359b46] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight truncate">
                  Lease Contracts
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium truncate">
                  Review and declare active tenant contracts
                </p>
              </div>
            </div>
            {/* Mobile Profile Icon */}
            <div className="md:hidden w-9 h-9 rounded-[10px] bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shadow-inner border border-purple-100 shrink-0">
              {userData?.name 
                  ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "OW"}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full md:w-auto gap-3">
            {sortedUnits.length > 1 && (
              // ✨ FIX: Tinanggal ang sm:w-64, pinalitan ng sm:w-auto para flexible.
              <div className="relative w-full sm:w-auto min-w-[240px] max-w-full group">
                <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#359b46] z-10 pointer-events-none w-4 h-4" strokeWidth={2.5} />
                <select
                  value={selectedUnit?.id || ''}
                  onChange={(e) => setSelectedUnit(sortedUnits.find((u: any) => u.id === e.target.value))}
                  // ✨ FIX: Tinanggal ang "truncate" class dito para lumabas ang buong text.
                  className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200/80 text-[13px] sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#359b46]/15 focus:border-[#359b46] bg-slate-50 transition-all hover:bg-white appearance-none cursor-pointer shadow-inner"
                >
                  {sortedUnits.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.property_name} - Unit {u.unit_number}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            )}

            <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4 shrink-0">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-[11px] font-extrabold text-[#0a1e3f] leading-none">Owner</span>
              </div>
              <div className="w-10 h-10 rounded-[12px] bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shadow-inner border border-purple-100 group-hover:scale-105 transition-transform duration-300">
                {userData?.name 
                  ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "OW"}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ✨ KANBAN LAYOUT Main Wrapper - Mobile Stack, Desktop Side-by-Side */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto custom-scrollbar lg:overflow-hidden pb-[100px] lg:pb-6">
        
        {isLoadingLease ? (
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
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col animate-pulse">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border border-slate-200/60 p-5 sm:p-8 flex flex-col h-full">
                <div className="h-40 w-full bg-slate-50 rounded-2xl"></div>
              </div>
            </div>
          </>
        ) : isVacant ? (
          /* EMPTY STATE (VACANT) */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 sm:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mb-5 sm:mb-6 shadow-inner border border-emerald-100 relative z-10">
                <User size={32} strokeWidth={1.5} className="sm:w-9 sm:h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">Unit is Vacant</h2>
              <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-6 sm:mb-8 relative z-10">
                There is currently no active lease record for <span className="font-bold text-slate-700">{propertyName} {unitNumber}</span>. Once a tenant moves in, declare the lease below.
              </p>
              <button 
                onClick={handleOpenDeclareModal}
                className="w-full sm:w-auto bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:from-[#2c813a] hover:to-[#236b2f] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-black uppercase tracking-wider text-[11px] sm:text-xs shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95 relative z-10"
              >
                <Plus size={16} strokeWidth={2.5} /> Declare New Lease
              </button>
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
                    <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm shrink-0 ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-emerald-50 text-[#359b46] border-emerald-200/60'}`}>
                      {isPending ? 'Pending Approval' : 'Active'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
                    <FormField label="Tenant Name" icon={<User size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={tenantName} />
                    <FormField label="Property" icon={<Home size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={`${propertyName} · ${unitNumber}`} />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#359b46]" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={leaseStartDate} />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />} value={leaseEndDate} />
                    </div>
                    
                    {/* Full Width Document Button */}
                    <div className="mt-3 sm:mt-4 pt-4 border-t border-slate-100">
                      <button className="w-full bg-emerald-50/50 hover:bg-emerald-50 text-[#359b46] p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl border border-emerald-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="p-2.5 sm:p-3 bg-white shadow-sm border border-emerald-100 rounded-xl shrink-0 text-[#359b46]">
                            <FileCheck size={20} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="font-black text-[13px] sm:text-base text-[#0a1e3f] block tracking-tight truncate">View Full Contract</span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 truncate">PDF • Official Copy</span>
                          </div>
                        </div>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100 group-hover:scale-105 group-hover:bg-[#359b46] group-hover:text-white group-hover:border-[#359b46] transition-all shrink-0">
                          <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: MANAGEMENT ACTIONS */}
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col mt-2 lg:mt-0">
              <div className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] rounded-[1.5rem] sm:rounded-[2rem] text-white shadow-xl relative overflow-hidden transition-all flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                
                {/* Internal Scrollable wrapper */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  <div className="flex items-center gap-2 text-emerald-300 mb-5 sm:mb-6 pb-4 border-b border-white/10 shrink-0">
                    <FileText size={18} strokeWidth={2.5} className="text-emerald-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400">Lease Actions</span>
                  </div>
                  
                  <h3 className="font-black text-xl sm:text-2xl tracking-tight mb-2 sm:mb-3 shrink-0">Management</h3>
                  <p className="text-blue-100/70 text-[11px] sm:text-sm font-medium leading-relaxed mb-6 sm:mb-8 shrink-0">
                    Update lease terms, initiate renewals, or upload physical signed documents for record keeping.
                  </p>
                  
                  <div className="mt-auto space-y-3 shrink-0">
                    <button 
                      onClick={handleOpenDeclareModal}
                      disabled={isPending}
                      className="w-full bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:from-[#2c813a] hover:to-[#236b2f] disabled:from-slate-500/50 disabled:to-slate-500/50 disabled:text-slate-300 disabled:cursor-not-allowed text-white rounded-xl py-3.5 sm:py-4 font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] active:scale-95 flex justify-center items-center gap-2 border border-transparent disabled:border-white/10 disabled:shadow-none"
                    >
                      {isPending ? "Awaiting Approval" : "Update Lease"} <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    <button className="w-full bg-white/5 hover:bg-white/10 text-white rounded-xl py-3.5 sm:py-4 font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all active:scale-[0.98] flex justify-center items-center gap-2 border border-white/10 hover:border-white/20">
                      Upload Signed Doc
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🌟 PREMIUM DECLARE LEASE MODAL (Bottom Sheet for Mobile, Center for Desktop) */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] sm:max-h-[95vh] border border-slate-200/80 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-white shrink-0 border-b border-slate-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              
              <div className="relative z-10 min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight truncate">Declare Lease</h2>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5 sm:mt-1 truncate">{propertyName} / {unitNumber}</p>
              </div>
              <button onClick={() => !isSubmitting && setIsDeclareModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1">
              <form onSubmit={handleDeclareLease} className="space-y-4 sm:space-y-5">
                
                {/* Auto-filled Tenant Name */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Tenant Full Name</label>
                  <input 
                    required type="text" placeholder="e.g. Juan Dela Cruz"
                    value={formTenantName} onChange={e => setFormTenantName(e.target.value)}
                    className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-[13px] sm:text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Monthly Rent</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[13px] sm:text-sm">₱</span>
                    <input 
                      required type="number" min="0" placeholder="0.00"
                      value={formRent} onChange={e => setFormRent(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-[13px] sm:text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Dates: Stacked on mobile, 2 columns on desktop */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Start Date</label>
                    <input 
                      required type="date"
                      value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-[13px] sm:text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">End Date</label>
                    <input 
                      required type="date"
                      value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                      className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-[13px] sm:text-sm font-bold text-slate-700 bg-white transition-all shadow-sm" disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Buttons: Col-reverse on mobile (cancel below), Row on desktop */}
                <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 justify-end pt-5 border-t border-slate-200/60 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-2 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsDeclareModalOpen(false)} disabled={isSubmitting} className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all active:scale-95 shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="w-full flex-1 sm:flex-none bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:from-[#2c813a] hover:to-[#236b2f] disabled:from-slate-300 disabled:to-slate-300 disabled:text-white/70 text-white py-3.5 sm:py-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] disabled:shadow-none active:scale-95 flex items-center justify-center min-w-[160px]">
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

// ✨ FIX: Updated FormField to truncate properly on mobile
function FormField({ label, icon, value, valueColor = "text-[#0a1e3f]" }: any) {
  return (
    <div className="flex flex-col min-w-0">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">
        {label}
      </label>
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/70 p-3 sm:p-4 rounded-xl hover:bg-white hover:border-[#359b46]/40 transition-colors shadow-inner w-full min-w-0">
        <div className="text-slate-400 shrink-0 bg-white p-2 rounded-lg border border-slate-100 shadow-sm flex items-center justify-center">
          {icon}
        </div>
        <div className={`font-black text-[13px] sm:text-base truncate tracking-tight min-w-0 w-full ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}