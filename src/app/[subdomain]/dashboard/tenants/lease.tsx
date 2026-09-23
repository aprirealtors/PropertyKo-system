"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, CalendarDays, User, FileCheck, AlertTriangle, RefreshCw, XOctagon, CheckCircle, X } from 'lucide-react';

export default function LeaseTab({ setActiveTab }: any) {
  const [lease, setLease] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✨ Universal Beautiful Modals
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: "", desc: "" });
  const [errorModal, setErrorModal] = useState({ isOpen: false, message: "" });
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, desc: string, action: (() => void) | null}>({ 
    isOpen: false, title: "", desc: "", action: null 
  });

  // Decline Renewal Modal
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (profile) {
        const { data: leaseData } = await supabase
          .from('leases')
          .select('*, units!inner(*)') 
          .eq('tenant_email', profile.email)
          .in('status', ['Active', 'Pending', 'Expired']) 
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (leaseData) {
          // ✨ AUTO-EXPIRATION CHECK
          if (leaseData.status === 'Active' && leaseData.end_date) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const end = new Date(leaseData.end_date);
            end.setHours(0,0,0,0);
            
            if (end.getTime() < today.getTime()) {
              await supabase.from('leases').update({ status: 'Expired' }).eq('id', leaseData.id);
              leaseData.status = 'Expired';
            }
          }
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

  const showSuccess = (title: string, desc: string) => setSuccessModal({ isOpen: true, title, desc });
  const showError = (message: string) => setErrorModal({ isOpen: true, message });

  // ✨ CONFIRMATION: Accept Renewal
  const confirmAcceptRenewal = () => {
    setConfirmModal({
      isOpen: true,
      title: "Accept Renewal",
      desc: "Are you sure you want to accept the lease renewal? Your property owner will be notified to prepare the new contract.",
      action: executeAcceptRenewal
    });
  };

  const executeAcceptRenewal = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leases')
        .update({ renewal_status: 'Accepted' })
        .eq('id', lease.id);

      if (error) throw error;
      
      setLease((prev: any) => ({ ...prev, renewal_status: 'Accepted' }));
      showSuccess("Renewal Accepted", "The property owner has been notified. They will upload the new contract details shortly.");
    } catch (err: any) {
      console.error(err);
      showError(err?.message || "An unexpected error occurred while accepting the renewal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✨ CONFIRMATION: Decline Renewal
  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineReason.trim()) {
      showError("Please provide a reason for declining the renewal.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('leases')
        .update({ renewal_status: 'Declined', renewal_reason: declineReason })
        .eq('id', lease.id);

      if (error) throw error;
      
      setLease((prev: any) => ({ ...prev, renewal_status: 'Declined', renewal_reason: declineReason }));
      setIsDeclineModalOpen(false);
      showSuccess("Renewal Declined", "The property owner has been notified of your decision.");
    } catch (err: any) {
      console.error(err);
      showError(err?.message || "An unexpected error occurred while declining the renewal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  const ownerName = unit?.owner_name || "Administration"; 
  const monthlyRent = lease?.monthly_rent || 0;
  const hasDocument = !!lease?.document_url;
  
  const leaseStartDate = lease?.start_date 
    ? new Date(lease.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  const leaseEndDate = lease?.end_date 
    ? new Date(lease.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  // ✨ Strict Days Calculation
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const endDate = lease?.end_date ? new Date(lease.end_date) : null;
  if (endDate) endDate.setHours(0,0,0,0);
  
  const diffDays = endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  const isExpired = lease?.status === 'Expired' || (diffDays !== null && diffDays < 0); 
  const isExpiringSoon = diffDays !== null && diffDays >= 0 && diffDays <= 30;

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 sm:px-6 py-4 sm:py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 bg-slate-200 rounded-[var(--radius-md)] border border-slate-300 shadow-sm shrink-0">
                <FileText className="text-[var(--color-text)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] tracking-tight truncate">
                  My Lease
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium truncate">
                  View your contract details and history
                </p>
              </div>
            </div>
            {/* Mobile Profile Icon */}
            <div className="md:hidden w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs shadow-inner border border-[var(--color-primary)]/30 shrink-0">
              {unit?.tenant_name 
                ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 1).toUpperCase() 
                : "TE"}
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
            <span className="text-xs font-black text-[var(--color-text)] uppercase tracking-wider">Tenant</span>
            <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
              {unit?.tenant_name 
                ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 1).toUpperCase() 
                : "TE"}
            </div>
          </div>

        </div>
      </div>

      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto custom-scrollbar lg:overflow-hidden pb-[100px] lg:pb-6">

        {/* ✨ DYNAMIC NOTIFICATION BANNERS WRAPPER */}
        {lease && (lease.renewal_status || (isExpiringSoon && !isExpired) || isExpired) && (
          <div className="w-full shrink-0 lg:absolute lg:top-[100px] lg:left-6 lg:right-6 lg:z-30 lg:w-[calc(100%-48px)] flex flex-col lg:flex-row gap-4 mb-4 lg:mb-0">
            
            {/* ✨ RENEWAL OFFERED */}
            {lease.renewal_status === 'Offered' && (
              <div className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-200/60 p-4 sm:p-5 rounded-[1.5rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 shadow-inner border border-blue-200 shrink-0">
                    <RefreshCw size={22} strokeWidth={2.5} className="animate-spin-slow" />
                  </div>
                  <div>
                    <h4 className="font-black text-blue-900 text-sm sm:text-base tracking-tight">Lease Renewal Offered</h4>
                    <p className="text-xs sm:text-sm text-blue-700/80 font-semibold mt-0.5">Your property owner has sent an offer to renew your lease.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button 
                    onClick={() => setIsDeclineModalOpen(true)}
                    className="flex-1 sm:flex-none bg-white border border-blue-200 hover:bg-blue-100 text-blue-600 px-4 py-2.5 rounded-[var(--radius-sm)] text-xs font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={confirmAcceptRenewal}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-[var(--radius-sm)] text-xs font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                  >
                    Accept Offer
                  </button>
                </div>
              </div>
            )}

            {/* ✨ RENEWAL ACCEPTED */}
            {lease.renewal_status === 'Accepted' && (
              <div className="flex-1 bg-gradient-to-r from-emerald-50 to-green-50/50 border border-emerald-200/60 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shadow-inner border border-emerald-200 shrink-0">
                    <CheckCircle size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-900 text-sm sm:text-base tracking-tight">Renewal Accepted</h4>
                    <p className="text-xs sm:text-sm text-emerald-700/80 font-semibold mt-0.5">You accepted the renewal. Awaiting the owner to upload the new contract details.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ RENEWAL DECLINED */}
            {lease.renewal_status === 'Declined' && (
              <div className="flex-1 bg-gradient-to-r from-slate-100 to-slate-200/50 border border-slate-300 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-200 p-3 rounded-2xl text-slate-600 shadow-inner border border-slate-300 shrink-0">
                    <XOctagon size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm sm:text-base tracking-tight">Renewal Declined</h4>
                    <p className="text-xs sm:text-sm text-slate-600 font-semibold mt-0.5">You declined the renewal. Reason: <strong className="text-slate-700">{lease.renewal_reason}</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ EXPIRING SOON (Only if no renewal status yet) */}
            {isExpiringSoon && !isExpired && !lease.renewal_status && (
              <div className="flex-1 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 shadow-inner border border-amber-200 shrink-0">
                    <AlertTriangle size={22} strokeWidth={2.5} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-amber-900 text-sm sm:text-base tracking-tight">Your Lease is Expiring Soon</h4>
                    <p className="text-xs sm:text-sm text-amber-700/80 font-semibold mt-0.5">Your contract will automatically expire in <strong className="text-amber-600 bg-amber-100/50 px-1.5 py-0.5 rounded">{diffDays} days</strong>. If your owner offers a renewal, you will be notified.</p>
                  </div>
                </div>
              </div>
            )}

            {/* ✨ EXPIRED (Only if no renewal status yet) */}
            {isExpired && !lease.renewal_status && (
              <div className="flex-1 bg-gradient-to-r from-red-50 to-rose-50/50 border border-red-200/60 p-4 sm:p-5 rounded-[1.5rem] flex items-start sm:items-center justify-between gap-4 shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4">
                  <div className="bg-red-100 p-3 rounded-2xl text-red-600 shadow-inner border border-red-200 shrink-0">
                    <AlertTriangle size={22} strokeWidth={2.5} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-red-900 text-sm sm:text-base tracking-tight">Your Lease Has Expired</h4>
                    <p className="text-xs sm:text-sm text-red-700/80 font-semibold mt-0.5">Your lease expired <strong className="text-red-600 bg-red-100/50 px-1.5 py-0.5 rounded">{Math.abs(diffDays as number)} days ago</strong>. Please contact management or your property owner immediately.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          /* SKELETON LOADING */
          <>
            <div className="w-full lg:flex-1 flex flex-col animate-pulse">
              <div className="bg-white rounded-[var(--radius-lg)] sm:rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="h-6 w-40 sm:w-48 bg-slate-200 rounded-md"></div>
                  <div className="h-6 w-20 sm:w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-[var(--radius-md)]"></div>
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-[var(--radius-md)]"></div>
                  <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-[var(--radius-md)]"></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-[var(--radius-md)]"></div>
                    <div className="h-14 sm:h-16 w-full bg-slate-50 rounded-[var(--radius-md)]"></div>
                  </div>
                  <div className="h-16 sm:h-20 w-full bg-slate-100 rounded-[var(--radius-md)] mt-4"></div>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col animate-pulse">
              <div className="bg-white rounded-[var(--radius-lg)] sm:rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col h-full">
                <div className="h-8 w-32 bg-slate-200 rounded-md mb-6"></div>
                <div className="h-24 w-full bg-slate-50 rounded-xl mb-6"></div>
                <div className="h-14 w-full bg-slate-100 rounded-xl mt-auto"></div>
              </div>
            </div>
          </>
        ) : !lease ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[var(--radius-lg)] sm:rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] p-6 sm:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="absolute top-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0 opacity-60"></div>

              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mb-5 sm:mb-6 shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20 relative z-10">
                <FileText size={32} strokeWidth={1.5} className="sm:w-9 sm:h-9" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-3 tracking-tight relative z-10">No Active Lease Found</h2>
              <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                We couldn't find an active lease assigned to your profile. If you believe this is a mistake, please contact your property manager to link your contract.
              </p>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: CONTRACT SUMMARY */}
            <div className={`w-full lg:flex-1 lg:min-w-0 flex flex-col transition-all ${(lease?.renewal_status || isExpiringSoon || isExpired) ? 'lg:mt-24' : ''}`}>
              <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
                  <div className="flex justify-between items-center mb-5 sm:mb-6 border-b border-[var(--color-border)] pb-4 shrink-0 gap-3">
                    <h3 className="font-black text-lg sm:text-xl text-[var(--color-text)] tracking-tight truncate">Contract Summary</h3>
                    
                    <span className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm shrink-0 ${
                      lease.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 
                      isExpired ? 'bg-red-50 text-red-600 border-red-200' : 
                      'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {lease.status === 'Pending' ? 'Pending Approval' : isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 sm:gap-4 shrink-0">
                    <FormField label="Property Owner" icon={<User size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text)]" />} value={ownerName} valueColor="text-[var(--color-text)]"/>
                    <FormField label="Unit Address" icon={<Home size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text)]" />} value={`${propertyName} · ${unitNumber}`} valueColor="text-[var(--color-text)]" />
                    <FormField label="Monthly Rent" icon={<CreditCard size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text)]" />} value={`₱${monthlyRent.toLocaleString()}`} valueColor="text-[var(--color-text)]" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <FormField label="Lease Start" icon={<CalendarDays size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text)]" />} value={leaseStartDate} valueColor="text-[var(--color-text)]" />
                      <FormField label="Lease Ends" icon={<Calendar size={18} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text)]" />} value={leaseEndDate} valueColor="text-[var(--color-text)]"/>
                    </div>

                    <div className="mt-3 sm:mt-4 pt-4 border-t border-[var(--color-border)]">
                      <button 
                        onClick={() => {
                          if (hasDocument) window.open(lease.document_url, '_blank');
                        }}
                        disabled={!hasDocument}
                        className={`w-full p-4 sm:p-5 rounded-[var(--radius-xl)] border flex items-center justify-between group transition-all ${
                          hasDocument 
                            ? "bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 text-[var(--color-primary)] border-[var(--color-primary)]/30 active:scale-[0.98] cursor-pointer" 
                            : "bg-[var(--color-bg)] text-slate-400 border-[var(--color-border)] cursor-not-allowed opacity-80"
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className={`p-2.5 sm:p-3 bg-white shadow-sm border rounded-[var(--radius-xl)] shrink-0 ${hasDocument ? "border-[var(--color-primary)]/30 text-[var(--color-text)]" : "border-[var(--color-border)] text-slate-400"}`}>
                            <FileCheck size={20} strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div className="text-left min-w-0">
                            <span className={`font-black text-[13px] sm:text-base block tracking-tight truncate ${hasDocument ? "text-[var(--color-text)]" : "text-slate-400"}`}>
                              {hasDocument ? "View Full Contract" : "No Contract Available"}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5 truncate">
                              {hasDocument ? "PDF • Official Copy" : "Upload document to view"}
                            </span>
                          </div>
                        </div>

                        {hasDocument && (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/30 group-hover:scale-105 group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] group-hover:border-[var(--color-primary)] transition-all shrink-0">
                            <ArrowRight size={16} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTACT MANAGEMENT */}
            <div className={`w-full lg:w-[320px] xl:w-[380px] shrink-0 flex flex-col mt-4 lg:mt-0 transition-all ${(lease?.renewal_status || isExpiringSoon || isExpired) ? 'lg:mt-24' : ''}`}>
              <div className="bg-[var(--color-secondary)] p-5 sm:p-6 md:p-8 rounded-[var(--radius-lg)] text-white shadow-[var(--shadow-md)] relative overflow-hidden transition-all lg:h-full flex flex-col border border-[var(--color-border)]">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-[var(--color-primary)] opacity-10 rounded-full -mr-16 sm:-mr-20 -mt-16 sm:-mt-20 pointer-events-none"></div>

                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="font-black text-xl sm:text-2xl tracking-tight mb-3 sm:mb-4 shrink-0 text-white">Need assistance?</h3>
                  <p className="text-white/70 text-[12px] sm:text-sm font-medium leading-relaxed mb-6 shrink-0">
                    If you have questions about your lease or want to negotiate a renewal, please message management directly.
                  </p>

                  <div className="mt-auto shrink-0">
                    <button 
                      onClick={() => setActiveTab('conversation')}
                      className="w-full bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-[var(--radius-md)] py-3.5 sm:py-4 font-black uppercase tracking-wider text-[11px] sm:text-xs hover:opacity-90 transition-all active:scale-[0.98] hover:shadow-[var(--shadow-sm)] hover:-translate-y-0.5 shadow-[var(--shadow-md)] flex justify-center items-center gap-2 border border-transparent mt-2"
                    >
                      Go to Messages <ArrowRight size={16} strokeWidth={2.5} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ✨ DECLINE RENEWAL MODAL */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] sm:max-h-[95vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-slate-50 shrink-0 border-b border-slate-200">
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <XOctagon size={20} strokeWidth={2.5} className="text-slate-500" />
                <h2 className="text-lg sm:text-xl font-black text-slate-700 tracking-tight truncate">Decline Renewal</h2>
              </div>
              <button onClick={() => !isSubmitting && setIsDeclineModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-[var(--radius-sm)] text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0 shadow-sm" disabled={isSubmitting}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1">
              <form onSubmit={handleDeclineSubmit} className="space-y-4 sm:space-y-5">
                <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed">
                  Please let the owner know why you are declining the renewal offer.
                </p>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Reason for Declining</label>
                  <textarea
                    required
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    placeholder="e.g. Relocating to a new city..."
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-slate-500/10 focus:border-slate-400 text-[12px] sm:text-sm font-medium text-[var(--color-text)] bg-white transition-all shadow-sm resize-none h-28 custom-scrollbar"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 justify-end pt-5 border-t border-[var(--color-border)] sticky bottom-0 bg-[var(--color-bg)]/90 backdrop-blur-md pb-2 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsDeclineModalOpen(false)} disabled={isSubmitting} className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-[var(--color-border)] hover:bg-slate-50 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-sm">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="w-full flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white py-3.5 sm:py-4 rounded-[var(--radius-md)] text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center min-w-[160px] border border-transparent">
                    {isSubmitting ? "Submitting..." : "Confirm Decline"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ UNIVERSAL CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30`}>
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">{confirmModal.title}</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {confirmModal.desc}
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmModal({ isOpen: false, title: "", desc: "", action: null })} className="flex-1 bg-white hover:bg-slate-50 text-slate-500 border border-[var(--color-border)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-sm active:scale-95">
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmModal.action) confirmModal.action();
                  setConfirmModal({ isOpen: false, title: "", desc: "", action: null });
                }} 
                className={`flex-1 text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-md border border-transparent active:scale-95 bg-[var(--color-primary)] hover:opacity-90`}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ SUCCESS MODAL */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-emerald-200">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">{successModal.title}</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {successModal.desc}
            </p>
            <button onClick={() => setSuccessModal({ isOpen: false, title: "", desc: "" })} className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ✨ ERROR MODAL */}
      {errorModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-red-200">
              <AlertTriangle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">An error occurred</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              {errorModal.message}
            </p>
            <button onClick={() => setErrorModal({ isOpen: false, message: "" })} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all active:scale-95">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function FormField({ label, icon, value, valueColor = "text-[var(--color-text)]" }: any) {
  return (
    <div className="flex flex-col min-w-0">
      <label className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">
        {label}
      </label>
      <div className="flex items-center gap-3 bg-[var(--color-bg)]/50 border border-[var(--color-border)] p-3 sm:p-4 rounded-[var(--radius-md)] hover:bg-white hover:border-[var(--color-primary)]/40 transition-colors shadow-inner w-full min-w-0">
        <div className="text-[var(--color-primary)] shrink-0 bg-white p-2 sm:p-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] flex items-center justify-center">
          {icon}
        </div>
        <div className={`font-black text-[13px] sm:text-base truncate tracking-tight min-w-0 w-full ${valueColor}`}>
          {value}
        </div>
      </div>
    </div>
  );
}