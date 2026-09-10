"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, FileCheck, User, Plus, X, CalendarDays, Upload, Loader2, CheckCircle } from 'lucide-react';

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

  // File Upload State
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false); // ✨ Added success state
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Upload Logic for PDF Documents
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return;
    }

    if (!activeLease) {
      alert("No active lease found to attach the document to.");
      return;
    }

    setIsUploadingDoc(true);
    setUploadSuccess(false);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `lease-${activeLease.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`; 

      // 1. Upload the file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Retrieve the public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const documentUrl = publicUrlData.publicUrl;

      // 3. Save the document URL to the leases table
      const { error: updateError } = await supabase
        .from('leases')
        .update({ document_url: documentUrl })
        .eq('id', activeLease.id);

      if (updateError) throw updateError;

      // 4. Update the local state so the View button works immediately
      setActiveLease({ ...activeLease, document_url: documentUrl });
      
      // ✨ Professional Success State Trigger
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000); // Revert back to normal after 3 seconds

    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Error uploading document: " + error.message);
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  if (!sortedUnits || sortedUnits.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 font-[family-name:var(--font-corporate)]">
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-8 sm:p-12 md:p-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-bg)] text-slate-300 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border border-slate-100">
            <Home size={32} className="sm:w-9 sm:h-9" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">No Properties Found</h2>
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
  const hasDocument = !!activeLease?.document_url;
  
  const leaseStartDate = activeLease?.start_date 
    ? new Date(activeLease.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  const leaseEndDate = activeLease?.end_date 
    ? new Date(activeLease.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="absolute inset-0 flex flex-col bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] z-20 overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER - Glassmorphism & Fully Responsive */}
      <div className="shrink-0 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 sm:px-6 py-4 sm:py-5 z-20 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                <FileText className="text-[var(--color-primary)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight truncate">
                  Lease Contracts
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium truncate">
                  Review and declare active tenant contracts
                </p>
              </div>
            </div>
            {/* Mobile Profile Icon */}
            <div className="md:hidden w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-xs shadow-inner border border-[var(--color-primary)]/20 shrink-0">
              {userData?.name 
                ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                : "OW"}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full md:w-auto gap-3">
            {sortedUnits.length > 1 && (
              <div className="relative w-full sm:w-auto min-w-[240px] max-w-full group">
                <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-primary)] z-10 pointer-events-none w-4 h-4" strokeWidth={2.5} />
                <select
                  value={selectedUnit?.id || ''}
                  onChange={(e) => setSelectedUnit(sortedUnits.find((u: any) => u.id === e.target.value))}
                  className="w-full pl-10 pr-8 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)] bg-white transition-all hover:bg-slate-50 appearance-none cursor-pointer shadow-sm"
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

            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5  rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
            <span className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider">Owner</span>
            <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
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
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="h-6 w-40 sm:w-48 bg-slate-200 rounded-md"></div>
                  <div className="h-6 w-20 sm:w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-14 sm:h-16 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
                  <div className="h-14 sm:h-16 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
                  <div className="h-14 sm:h-16 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-14 sm:h-16 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
                    <div className="h-14 sm:h-16 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
                  </div>
                  <div className="h-16 sm:h-20 w-full bg-slate-100 rounded-[var(--radius-md)] mt-4"></div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col animate-pulse">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col h-full">
                <div className="h-40 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>
              </div>
            </div>
          </>
        ) : isVacant ? (
          /* EMPTY STATE (VACANT) */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 sm:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>
              
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mb-5 sm:mb-6 shadow-inner border border-[var(--color-primary)]/20 relative z-10">
                <User size={32} strokeWidth={1.5} className="sm:w-9 sm:h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-3 tracking-tight relative z-10">Unit is Vacant</h2>
              <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-6 sm:mb-8 relative z-10">
                There is currently no active lease record for <span className="font-bold text-[var(--color-text)]">{propertyName} {unitNumber}</span>. Once a tenant moves in, declare the lease below.
              </p>
              <button 
                onClick={handleOpenDeclareModal}
                className="w-full sm:w-auto bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] border border-transparent px-6 sm:px-8 py-3.5 sm:py-4 rounded-[var(--radius-md)] font-black uppercase tracking-wider text-[11px] sm:text-xs shadow-[var(--shadow-md)] flex items-center justify-center gap-2 transition-all active:scale-95 relative z-10"
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
              <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                {/* Internal Scrollable Area */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-5 sm:mb-6 border-b border-[var(--color-border)] pb-4 shrink-0 gap-3">
                    <h3 className="font-black text-lg sm:text-xl text-[var(--color-secondary)] tracking-tight truncate">Contract Summary</h3>
                    <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm shrink-0 ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30'}`}>
                      {isPending ? 'Pending Approval' : 'Active'}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
                    <FormField label="Tenant Name" icon={<User size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-secondary)]" />} value={tenantName} />
                    <FormField label="Property" icon={<Home size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-secondary)]" />} value={`${propertyName} · ${unitNumber}`} />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-primary)]" />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[var(--color-primary)]" />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-secondary)]" />} value={leaseStartDate} />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-secondary)]" />} value={leaseEndDate} />
                    </div>
                    
                    {/* View Full Contract Button */}
                    <div className="mt-3 sm:mt-4 pt-4 border-t border-[var(--color-border)]">
                      <button 
                        onClick={() => {
                          if (hasDocument) {
                            window.open(activeLease.document_url, '_blank');
                          }
                        }}
                        disabled={!hasDocument}
                        className={`w-full p-4 sm:p-5 rounded-[1.25rem] sm:rounded-[var(--radius-lg)] border flex items-center justify-between group transition-all ${
                          hasDocument 
                            ? "bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30 active:scale-[0.98] cursor-pointer" 
                            : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] cursor-not-allowed opacity-80"
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className={`p-2.5 sm:p-3 bg-white shadow-sm border rounded-[var(--radius-md)] shrink-0 ${hasDocument ? "border-[var(--color-primary)]/30 text-[var(--color-primary)]" : "border-[var(--color-border)] text-slate-400"}`}>
                            <FileCheck size={20} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className={`font-black text-[13px] sm:text-base block tracking-tight truncate ${hasDocument ? "text-[var(--color-secondary)]" : "text-slate-400"}`}>
                              {hasDocument ? "View Full Contract" : "No Contract Available"}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 truncate">
                              {hasDocument ? "PDF • Official Copy" : "Upload document to view"}
                            </span>
                          </div>
                        </div>
                        
                        {hasDocument && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20 group-hover:scale-105 group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] group-hover:border-[var(--color-primary)] transition-all shrink-0">
                            <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: MANAGEMENT ACTIONS */}
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col mt-2 lg:mt-0">
              <div className="bg-[var(--color-secondary)] rounded-[var(--radius-lg)] text-[var(--color-bg)] shadow-[var(--shadow-md)] relative overflow-hidden transition-all flex flex-col lg:h-full border border-[var(--color-border)]">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                
                {/* Internal Scrollable wrapper */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  <div className="flex items-center gap-2 text-[var(--color-primary)] mb-5 sm:mb-6 pb-4 border-b border-white/10 shrink-0">
                    <FileText size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Lease Actions</span>
                  </div>
                  
                  <h3 className="font-black text-xl sm:text-2xl tracking-tight mb-2 sm:mb-3 shrink-0 text-white">Management</h3>
                  <p className="text-white/60 text-[11px] sm:text-sm font-medium leading-relaxed mb-6 sm:mb-8 shrink-0">
                    Update lease terms, initiate renewals, or upload physical signed documents for record keeping.
                  </p>
                  
                  <div className="mt-auto space-y-3 shrink-0">
                    <button 
                      onClick={handleOpenDeclareModal}
                      disabled={isPending}
                      className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-primary-text)] rounded-[var(--radius-md)] py-3.5 sm:py-4 font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all shadow-[var(--shadow-md)] active:scale-95 flex justify-center items-center gap-2 border border-transparent"
                    >
                      {isPending ? "Awaiting Approval" : "Update Lease"} <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    {/* Hidden file input for PDF only */}
                    <input 
                      type="file" 
                      accept="application/pdf"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden" 
                    />
                    
                    {/* ✨ Professional Upload Button State */}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingDoc || uploadSuccess}
                      className={`w-full rounded-[var(--radius-md)] py-3.5 sm:py-4 font-black uppercase tracking-wider text-[10px] sm:text-[11px] transition-all duration-300 active:scale-[0.98] flex justify-center items-center gap-2 border ${
                        uploadSuccess 
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/30" 
                          : "bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      }`}
                    >
                      {isUploadingDoc ? (
                        <>
                          <Loader2 size={16} className="animate-spin text-slate-300" />
                          Uploading...
                        </>
                      ) : uploadSuccess ? (
                        <>
                          <CheckCircle size={16} className="text-emerald-400" /> Uploaded Successfully
                        </>
                      ) : (
                        <>
                          <Upload size={16} /> Upload Signed Doc
                        </>
                      )}
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
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] sm:max-h-[95vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              
              <div className="relative z-10 min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-secondary)] tracking-tight truncate">Declare Lease</h2>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--color-text)] opacity-70 mt-0.5 sm:mt-1 truncate">{propertyName} / {unitNumber}</p>
              </div>
              <button onClick={() => !isSubmitting && setIsDeclareModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-white border border-[var(--color-border)] rounded-[var(--radius-sm)] text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0 shadow-sm" disabled={isSubmitting}>
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
                    className="w-full px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Monthly Rent</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-[13px] sm:text-sm">₱</span>
                    <input 
                      required type="number" min="0" placeholder="0.00"
                      value={formRent} onChange={e => setFormRent(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting}
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
                      className="w-full px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">End Date</label>
                    <input 
                      required type="date"
                      value={formEndDate} onChange={e => setFormEndDate(e.target.value)}
                      className="w-full px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] bg-white transition-all shadow-[var(--shadow-sm)]" disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Buttons: Col-reverse on mobile (cancel below), Row on desktop */}
                <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 justify-end pt-5 border-t border-[var(--color-border)] sticky bottom-0 bg-[var(--color-bg)]/90 backdrop-blur-md pb-2 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsDeclareModalOpen(false)} disabled={isSubmitting} className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-slate-50 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-[var(--shadow-sm)]">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="w-full flex-1 sm:flex-none bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] py-3.5 sm:py-4 rounded-[var(--radius-md)] text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center min-w-[160px] border border-transparent">
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
function FormField({ label, icon, value, valueColor = "text-[var(--color-text)]" }: any) {
  return (
    <div className="flex flex-col min-w-0">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">
        {label}
      </label>
      <div className="flex items-center gap-3 bg-[var(--color-bg)]/50 border border-[var(--color-border)] p-3 sm:p-4 rounded-[var(--radius-md)] hover:bg-white hover:border-[var(--color-primary)]/40 transition-colors shadow-inner w-full min-w-0">
        <div className="text-slate-400 shrink-0 bg-white p-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-sm flex items-center justify-center">
          {icon}
        </div>
        <div className={`font-black text-[13px] sm:text-base truncate tracking-tight min-w-0 w-full ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}