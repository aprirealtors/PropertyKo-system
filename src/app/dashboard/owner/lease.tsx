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
    <div className="w-full pb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#0a1e3f] tracking-tight">Lease Contracts</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">Review and declare active tenant contracts.</p>
        </div>
        
        {units.length > 1 && (
          <select
            value={selectedUnit?.id || ''}
            onChange={(e) => setSelectedUnit(units.find((u: any) => u.id === e.target.value))}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 bg-white font-bold shadow-sm"
          >
            {units.map((u: any) => (
              <option key={u.id} value={u.id}>
                {u.property_name} - Unit {u.unit_number}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoadingLease ? (
        <div className="flex justify-center py-20 text-slate-400">Loading lease details...</div>
      ) : isVacant ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-10 md:p-20 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mb-6 shadow-inner border border-emerald-100">
            <User size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-3 tracking-tight">Unit is Vacant</h2>
          <p className="text-slate-500 text-sm md:text-base max-w-md mx-auto leading-relaxed mb-8">
            There is currently no active lease record for {propertyName} {unitNumber}. Once a tenant moves in, declare the lease below.
          </p>
          <button 
            onClick={handleOpenDeclareModal}
            className="bg-[#359b46] hover:bg-[#2c813a] text-white px-6 py-3 rounded-xl font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus size={18} /> Declare New Lease
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          
          {/* LEFT COLUMN: Contract Summary */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-extrabold text-lg md:text-xl text-[#0a1e3f]">Contract Summary</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-[#359b46] border-emerald-100'}`}>
                  {isPending ? 'Pending Approval' : 'Active'}
                </span>
              </div>
              
              <div className="flex flex-col gap-4">
                <FormField label="Tenant Name" icon={<User size={20} />} value={tenantName} />
                <FormField label="Property" icon={<Home size={20} />} value={`${propertyName} · ${unitNumber}`} />
                <FormField label="Monthly Rent" icon={<CreditCard size={20} />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[#359b46]" />
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Lease Start" icon={<CalendarDays size={20} />} value={leaseStartDate} />
                  <FormField label="Lease Ends" icon={<Calendar size={20} />} value={leaseEndDate} />
                </div>
                
                {/* Full Width Document Button */}
                <div className="mt-4 pt-2">
                  <button className="w-full bg-emerald-50/50 hover:bg-emerald-50 text-[#359b46] p-4 sm:p-5 rounded-2xl border border-emerald-200/60 flex items-center justify-between group transition-all active:scale-[0.98]">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 bg-white shadow-sm border border-emerald-100 rounded-xl shrink-0">
                        <FileCheck size={20} />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-sm sm:text-base text-[#0a1e3f] block">View Full Contract</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">PDF • Official Copy</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100 group-hover:scale-105 transition-transform shrink-0">
                      <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Management Actions */}
          <div className="lg:col-span-5">
            <section className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] p-6 md:p-8 rounded-3xl text-white shadow-2xl sticky top-6 relative overflow-hidden transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-emerald-300 mb-5">
                  <FileText size={22} className="text-emerald-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Lease Actions</span>
                </div>
                <h3 className="font-extrabold text-2xl md:text-3xl mb-4 tracking-tight">Contract Management</h3>
                <p className="text-blue-100/90 mb-8 text-sm md:text-base leading-relaxed">
                  Update lease terms, initiate renewals, or upload physical signed documents for record keeping.
                </p>
                
                <button 
                  onClick={handleOpenDeclareModal}
                  disabled={isPending}
                  className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#359b46]/50 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-black text-sm md:text-base transition-all shadow-lg mb-3 flex justify-center items-center gap-2 border border-[#359b46]"
                >
                  {isPending ? "Awaiting Manager Approval..." : "Update Lease Details"} <ArrowRight size={18} />
                </button>

                <button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-2xl py-4 font-black text-sm md:text-base transition-all active:scale-[0.98] flex justify-center items-center gap-2 border border-white/20">
                  Upload Signed Document
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* DECLARE LEASE MODAL */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#0a1e3f]">Declare Lease</h2>
                <p className="text-xs text-slate-500 mt-0.5">{propertyName} {unitNumber}</p>
              </div>
              <button onClick={() => !isSubmitting && setIsDeclareModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleDeclareLease} className="space-y-4">
                
                {/* Auto-filled Tenant Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Tenant Full Name</label>
                  <input 
                    required type="text" placeholder="e.g. John Doe"
                    value={formTenantName} onChange={e => setFormTenantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Monthly Rent</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input 
                      required type="number" min="0" placeholder="0.00"
                      value={formRent} onChange={e => setFormRent(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Start Date</label>
                    <input 
                      required type="date"
                      value={formStartDate} onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">End Date</label>
                    <input 
                      required type="date"
                      value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700" disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white py-3.5 rounded-xl font-bold shadow-sm transition-colors">
                    {isSubmitting ? "Submitting for Approval..." : "Submit Lease Details"}
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
      <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}
      </label>
      <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/70 p-4 rounded-2xl hover:bg-white hover:border-[#359b46]/40 transition-colors shadow-sm w-full">
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