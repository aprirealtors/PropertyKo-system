"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from "@/utils/supabase/client";
import { Receipt, CreditCard, Download, ShieldCheck, AlertCircle, X, CalendarClock, CheckCircle, Clock, History, ChevronLeft, ArrowRight } from 'lucide-react';

export default function PayTab() {
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0, water: 0, electricity: 0, parking: 0,
    penaltyType: 'percent', penaltyValue: 0, collectionDay: 1, gracePeriod: 15,
    bankName: '', bankAccountName: '', bankAccountNumber: '',
    qrCodeUrl: '' 
  });

  const [soaConfig, setSoaConfig] = useState<any>({
    dues: false, parking: false, water: true, electricity: true, penalty: true, tenant_payment_method: null
  });
  
  const [tenantStatus, setTenantStatus] = useState('Pending');
  const [isAssigned, setIsAssigned] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  
  const [isMobileHistoryVisible, setIsMobileHistoryVisible] = useState(false);

  const PAYMENT_METHODS = [
    'Digital Wallet', 'Bank Transfer', 'Check', 'Cash'
  ];
  const [paymentMethod, setPaymentMethod] = useState<string>('Digital Wallet');
  const [referenceNumber, setReferenceNumber] = useState("");
  
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      setIsLoading(false); return;
    }
    
    try {
      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (profile) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days, bank_name, bank_account_name, bank_account_number, qr_code_url')
          .eq('admin_email', profile.admin_email)
          .single();

        if (orgData) {
          setGlobalComp({
            duesRate: orgData.dues_rate || 0, water: orgData.default_water || 0,
            electricity: orgData.default_electricity || 0, parking: orgData.default_parking || 0,
            penaltyType: orgData.penalty_type || 'percent', penaltyValue: orgData.penalty_value || 0,
            collectionDay: orgData.collection_day || 1, gracePeriod: orgData.grace_period_days || 15,
            bankName: orgData.bank_name || '', bankAccountName: orgData.bank_account_name || '', bankAccountNumber: orgData.bank_account_number || '',
            qrCodeUrl: orgData.qr_code_url || '' 
          });
        }

        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();
          
        if (unitData) {
          setUnit(unitData);

          const { data: soaData } = await supabase
            .from('soa')
            .select('*')
            .eq('unit_id', unitData.id)
            .single();

          if (soaData) {
            setSoaConfig({
              dues: soaData.tenant_dues,
              parking: soaData.tenant_parking,
              water: soaData.tenant_water,
              electricity: soaData.tenant_electricity,
              penalty: soaData.tenant_penalty,
              tenant_payment_method: soaData.tenant_payment_method 
            } as any);
            setTenantStatus(soaData.tenant_status || 'Pending');
            setIsAssigned(true);
          } else {
            setIsAssigned(false);
          }
        }

        const { data: txData } = await supabase
          .from('transactions') 
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .order('created_at', { ascending: false });

        if (txData) setTransactions(txData);
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!unit?.id) return;

    const channelName = `tenant-soa-updates-${unit.id}-${Date.now()}`;

    const soaChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'soa',
          filter: `unit_id=eq.${unit.id}` 
        },
        () => {
          console.log("SOA Updated! Recalculating Hero Card for Tenant...");
          fetchBillingData(); 
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(soaChannel);
    };
  }, [unit?.id]);

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const displayStatus = !isAssigned ? 'Unassigned' : tenantStatus;
  const isPaid = displayStatus === 'Paid';
  const unitArea = getUnitAreaValue(unit?.unit_area);

  // ==========================================
  // UNIT-SPECIFIC BILLING CALCULATION
  // ==========================================
  const activeDuesRate = unit?.dues_rate ?? globalComp.duesRate;
  const activeWater = unit?.water ?? globalComp.water;
  const activeElectricity = unit?.electricity ?? globalComp.electricity;
  const activeParking = unit?.parking ?? globalComp.parking;
  
  const colDay = unit?.collection_day ?? globalComp.collectionDay;
  const grace = unit?.grace_period_days ?? globalComp.gracePeriod;
  const pType = unit?.penalty_type ?? globalComp.penaltyType;
  const pVal = unit?.penalty_value ?? globalComp.penaltyValue;

  const activeBankName = unit?.bank_name || globalComp.bankName;
  const activeBankAccountName = unit?.bank_account_name || globalComp.bankAccountName;
  const activeBankAccountNumber = unit?.bank_account_number || globalComp.bankAccountNumber;
  const activeQrCodeUrl = unit?.qr_code_url || globalComp.qrCodeUrl;
  
  const rawDues = activeDuesRate * unitArea;
  const rawParking = activeParking;
  const rawWater = activeWater;
  const rawElectricity = activeElectricity;

  const dues = isAssigned && soaConfig.dues ? rawDues : 0;
  const parking = isAssigned && soaConfig.parking ? rawParking : 0;
  const water = isAssigned && soaConfig.water ? rawWater : 0;
  const electricity = isAssigned && soaConfig.electricity ? rawElectricity : 0;

  const baseTotal = dues + parking + water + electricity;

  let lateFee = 0;
  if (tenantStatus === 'Overdue') {
    if (pType === 'percent') {
      lateFee = baseTotal * (pVal / 100);
    } else {
      lateFee = pVal;
    }
  }

  const totalDue = baseTotal + lateFee;

  const isTenantProcessing = !!soaConfig?.tenant_payment_method && tenantStatus !== 'Paid';

  let ledgerLateFee = 0;
  if (tenantStatus === 'Overdue' || soaConfig.penalty) {
    if (pType === 'percent') {
      ledgerLateFee = baseTotal * (pVal / 100);
    } else {
      ledgerLateFee = pVal;
    }
  }
  const ledgerTotal = baseTotal + ledgerLateFee;

  const generateLedgerMonths = () => {
    const months = [];
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      let stat = "Upcoming";
      if (i < currentMonthIndex) stat = "Paid"; 
      else if (i === currentMonthIndex) stat = displayStatus; 
      const dueDate = `${monthName} ${colDay}, ${currentYear}`;
      months.push({ monthName, year: currentYear, dueDate, status: stat, isCurrentMonth: i === currentMonthIndex });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleExportCSV = () => {
    if (!unit || ledgerData.length === 0) return;
    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    const rows = ledgerData.map(row => {
      const rowPenalty = row.isCurrentMonth ? ledgerLateFee : 0;
      const rowTotal = row.isCurrentMonth ? ledgerTotal : baseTotal;
      return [`"${row.monthName} ${row.year}"`, `"${row.dueDate}"`, dues, parking, (water + electricity), rowPenalty, `"${row.status}"`, rowTotal].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${unit.property_name.replace(/\s+/g, '_')}_Unit_${unit.unit_number}_Statement_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    
    try {
      const isCash = paymentMethod === 'Cash';

      const updatePayload: any = {
        tenant_payment_amount: totalDue,
        tenant_payment_method: paymentMethod,
        tenant_reference_number: isCash ? 'N/A' : referenceNumber,
        unit_name: `${unit.property_name} - Unit ${unit.unit_number}`
      };

      const { error: soaError } = await supabase.from('soa').update(updatePayload).eq('unit_id', unit.id);

      if (soaError) throw soaError;

      await supabase.from('notifications').insert([{
        admin_email: unit.admin_email,
        recipient: 'MANAGER', 
        type: 'BILLING',
        title: 'Payment Verification Required',
        message: `${unit.tenant_name || 'A Tenant'} submitted a ${paymentMethod} payment of ₱${totalDue.toLocaleString()} for ${unit.property_name} Unit ${unit.unit_number}.`,
        reference_id: unit.id,
        is_read: false
      }]);

      setShowSuccessModal(true);

    } catch (error) {
      console.error("Error processing payment submission:", error);
      alert("There was an error submitting your payment. Please try again.");
    } finally {
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
      setReferenceNumber(""); 
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER */}
      <div className="shrink-0 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 sm:px-6 py-4 sm:py-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0">
                <Receipt className="text-[var(--color-primary)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight whitespace-normal break-words">
                  Financial Statements
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium whitespace-normal break-words">
                  Manage your statement of account and transactions
                </p>
              </div>
            </div>
            <div className="md:hidden w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-xs shadow-inner border border-[var(--color-primary)]/30 shrink-0 ml-3">
              {unit?.tenant_name 
              ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 1).toUpperCase() 
              : "TE"}
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
            <span className="text-xs font-black text-[var(--color-primary)] uppercase tracking-wider">Tenant</span>
            <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
              {unit?.tenant_name 
                ? unit.tenant_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 1).toUpperCase() 
                : "TE"}
            </div>
          </div>

        </div>
      </div>

      {/* ✨ MASTER-DETAIL Wrapper */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col md:flex-row overflow-y-auto lg:overflow-hidden relative custom-scrollbar">
        
        {isLoading ? (
          <div className="flex-1 flex w-full flex-col lg:flex-row gap-5 sm:gap-6 animate-pulse p-4 sm:p-6 lg:p-8">
            <div className="flex-1 bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[var(--shadow-sm)] p-5 sm:p-8 flex flex-col">
              <div className="h-8 w-48 bg-slate-200 rounded-md mb-6"></div>
              <div className="h-48 w-full bg-[var(--color-bg)] rounded-[var(--radius-lg)] mb-6"></div>
              <div className="h-16 w-full bg-slate-100 rounded-[var(--radius-lg)] mb-4"></div>
              <div className="h-40 w-full bg-[var(--color-bg)] rounded-[var(--radius-lg)]"></div>
            </div>
            <div className="w-full lg:w-[340px] xl:w-[400px] shrink-0 bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col">
              <div className="h-6 w-32 bg-slate-200 rounded-md mb-6"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-20 w-full bg-[var(--color-bg)] rounded-[var(--radius-md)]"></div>)}
              </div>
            </div>
          </div>
        ) : !unit ? (
          <div className="flex-1 flex items-center justify-center w-full bg-[var(--color-bg)] p-4">
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-8 sm:p-14 text-center max-w-lg w-full animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-6 shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20">
                <Receipt size={36} className="w-10 h-10" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-3 tracking-tight whitespace-normal break-words">No Active Lease Found</h2>
              <p className="text-[13px] sm:text-sm text-slate-500 leading-relaxed max-w-[280px] sm:max-w-xs mx-auto whitespace-normal break-words">
                You are currently not assigned as an active tenant to any property. Please contact administration.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ✨ LEFT MAIN AREA (SOA Summary & Ledger) */}
            <div className={`flex-1 flex-col bg-[var(--color-bg)] relative lg:overflow-y-auto custom-scrollbar ${!isMobileHistoryVisible ? 'flex' : 'hidden md:flex'}`}>
              <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-24 lg:pb-12">
                
                <div className="md:hidden flex justify-end">
                  <button 
                    onClick={() => setIsMobileHistoryVisible(true)}
                    className="flex items-center gap-2 bg-white border border-[var(--color-border)] shadow-[var(--shadow-sm)] px-4 py-2.5 rounded-[var(--radius-md)] text-[11px] font-black text-[var(--color-secondary)] uppercase tracking-wider active:scale-95 transition-transform"
                  >
                    <History size={14} className="text-[var(--color-primary)]" /> View History
                  </button>
                </div>

                <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] overflow-hidden">
                  
                  <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)]">
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-[var(--color-secondary)] text-xl sm:text-2xl md:text-3xl tracking-tight leading-tight whitespace-normal break-words">
                        {unit?.property_name} · Unit {unit?.unit_number}
                      </h3>
                      <p className="text-slate-500 text-[11px] sm:text-sm mt-1 sm:mt-1.5 font-medium whitespace-normal break-words">
                        Tenant: <span className="font-bold text-[var(--color-primary)]">{unit?.tenant_name}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2 shrink-0">
                      {!isAssigned && <span className="bg-[var(--color-bg)] text-slate-500 font-bold px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-widest border border-[var(--color-border)] shadow-sm shrink-0">Unassigned</span>}
                      {isAssigned && displayStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-widest border border-red-200 shadow-[var(--shadow-sm)] flex items-center gap-1.5 shrink-0"><AlertCircle size={14} /> Overdue</span>}
                      {isAssigned && displayStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-widest border border-amber-200 shadow-[var(--shadow-sm)] flex items-center gap-1.5 shrink-0"><CalendarClock size={14} /> Pending</span>}
                      {isAssigned && displayStatus === 'Sent' && <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-widest border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] flex items-center gap-1.5 shrink-0"><Receipt size={14} /> SOA Sent</span>}
                      {isAssigned && displayStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] uppercase tracking-widest border border-emerald-200 shadow-[var(--shadow-sm)] flex items-center gap-1.5 shrink-0"><CheckCircle size={14} /> Settled</span>}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 md:p-8 bg-[var(--color-bg)]/30 relative flex flex-col">
                    <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[var(--color-border)]">
                      <h4 className="font-black text-[var(--color-primary)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Tenant</h4>
                      <p className="font-black text-[var(--color-secondary)] text-[13px] sm:text-[15px] uppercase tracking-widest whitespace-normal break-words">Assigned to You</p>
                    </div>

                    <div className="space-y-3 sm:space-y-3.5 flex-1 opacity-80 hover:opacity-100 transition-opacity">
                        {isAssigned ? (
                          <>
                            {soaConfig.dues && (
                              <div className="flex justify-between items-center gap-3 text-[13px] sm:text-sm"><span className="text-slate-500 font-medium whitespace-normal break-words">Assoc. Dues <span className="text-[10px] ml-1 opacity-70 hidden sm:inline">({unitArea} sqm)</span></span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.parking && (
                              <div className="flex justify-between items-center gap-3 text-[13px] sm:text-sm"><span className="text-slate-500 font-medium whitespace-normal break-words">Parking</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.water && (
                              <div className="flex justify-between items-center gap-3 text-[13px] sm:text-sm"><span className="text-slate-500 font-medium whitespace-normal break-words">Water</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.electricity && (
                              <div className="flex justify-between items-center gap-3 text-[13px] sm:text-sm"><span className="text-slate-500 font-medium whitespace-normal break-words">Electricity</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {tenantStatus === 'Overdue' && lateFee > 0 && (
                              <div className="flex justify-between items-center gap-3 text-[13px] sm:text-sm"><span className="text-red-500 font-bold whitespace-normal break-words">Late Penalty</span><span className="font-black text-red-600 shrink-0">₱{lateFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {baseTotal === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium pt-2">No assigned balances for this period.</p>}
                          </>
                        ) : (
                          <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium pt-2">Pending SOA assignment from administration.</p>
                        )}
                    </div>
                  </div>

                  <div className="bg-[var(--color-primary)]/10 border-t border-[var(--color-primary)]/20 p-5 sm:p-6 md:p-8 text-[var(--color-primary-text)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                    <div className="min-w-0">
                      <span className="font-black text-[var(--color-primary)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-1 block whitespace-normal break-words">Total Due <span className="font-medium text-[var(--color-primary)]/70 ml-1 normal-case hidden sm:inline">(Your Account)</span></span>
                    </div>
                    <span className="font-black text-[var(--color-primary)] text-3xl sm:text-4xl md:text-5xl tracking-tight drop-shadow-sm shrink-0 whitespace-normal break-words">
                      {isAssigned ? `₱${totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                    </span>
                  </div>
                </div>
                
                {/* Action Button */}
                <div className="w-full shrink-0">
                  <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    disabled={!isAssigned || isPaid || totalDue === 0 || isLoading || isTenantProcessing}
                    className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] border border-transparent px-4 sm:px-8 py-4 sm:py-4 rounded-[var(--radius-md)] text-[13px] sm:text-sm font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[var(--shadow-md)]"
                  >
                    {!isAssigned ? (
                      'Pending Assignment'
                    ) : isPaid ? (
                      <><CheckCircle size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Payment Settled</>
                    ) : isTenantProcessing ? (
                      <><Clock size={18} className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" /> Verifying Payment</>
                    ) : totalDue === 0 ? (
                      'No Payment Needed'
                    ) : (
                      <><CreditCard size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Pay Now</>
                    )}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-bold text-slate-400 mt-3 sm:mt-4 uppercase tracking-widest whitespace-normal break-words">
                    <ShieldCheck size={14} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-primary)]/50" /> Secure Payment Processing
                  </p>
                </div>

                <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-4 sm:p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-6 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0">
                        <CalendarClock size={20} className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[var(--color-secondary)] text-base sm:text-xl tracking-tight whitespace-normal break-words">Ledger & Projection</h4>
                        <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 whitespace-normal break-words">
                          Due: Day {colDay} <span className="mx-1.5 text-slate-300">|</span> Penalty: Day {colDay + grace}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportCSV}
                      className="w-full sm:w-auto justify-center flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 px-4 sm:px-5 py-2.5 sm:py-3 rounded-[var(--radius-sm)] transition-all active:scale-95 border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0"
                    >
                      <Download size={16} className="w-4 h-4 sm:w-5 sm:h-5" /> Export CSV
                    </button>
                  </div>
                  
                  <div className="hidden md:block overflow-x-auto border border-[var(--color-border)] rounded-[var(--radius-md)] custom-scrollbar shadow-[var(--shadow-inner)] max-h-[600px] relative">
                    <table className="w-full text-left text-xs min-w-[800px] border-collapse">
                      <thead className="bg-[var(--color-primary)] text-[var(--color-primary-text)] font-extrabold border-b border-transparent sticky top-0 z-20 shadow-sm">
                        <tr>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">PERIOD</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">DUE DATE</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">DUES</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">PARKING</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">UTILS</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap bg-red-600 text-white text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-red-700">PENALTY</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-center whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-widest border-r border-white/20">STATUS</th>
                          <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap text-white text-[9px] sm:text-[10px] uppercase tracking-widest">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)] bg-white font-medium relative z-0">
                        {ledgerData.map((row, idx) => {
                          const isRowPaid = row.status === 'Paid';
                          const activeRow = row.isCurrentMonth;
                          const rowPenalty = activeRow ? ledgerLateFee : 0;
                          const rowTotal = activeRow ? ledgerTotal : baseTotal;
                          
                          return (
                            <tr key={idx} className={`transition-colors group ${activeRow ? "bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10" : "hover:bg-slate-50"}`}>
                              <td className={`relative px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap font-black uppercase text-[10px] sm:text-[11px] tracking-wide border-r border-[var(--color-border)] ${activeRow ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'}`}>
                                {activeRow && <div className="absolute inset-y-0 left-0 w-1 bg-[var(--color-primary)] rounded-r-sm pointer-events-none"></div>}
                                {row.monthName} {row.year} {activeRow && <span className="ml-1.5 text-[9px] tracking-widest opacity-80">(NOW)</span>}
                              </td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap text-slate-500 font-medium text-[11px] sm:text-xs border-r border-[var(--color-border)]">{row.dueDate}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-medium text-[11px] sm:text-xs text-[var(--color-text)] border-r border-[var(--color-border)]">{dues > 0 ? `₱${dues.toLocaleString()}` : "0"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-medium text-[11px] sm:text-xs text-[var(--color-text)] border-r border-[var(--color-border)]">{parking > 0 ? `₱${parking.toLocaleString()}` : "0"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-medium text-[11px] sm:text-xs text-[var(--color-text)] border-r border-[var(--color-border)]">{(water + electricity) > 0 ? `₱${(water + electricity).toLocaleString()}` : "0"}</td>
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-bold text-[11px] sm:text-xs border-r border-[var(--color-border)] ${rowPenalty > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                {rowPenalty > 0 ? `₱${rowPenalty.toLocaleString()}` : "0"}
                              </td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 text-center whitespace-nowrap font-bold text-[9px] sm:text-[10px] tracking-wider uppercase border-r border-[var(--color-border)]">
                                {row.status === 'Paid' && <span className="text-emerald-600 bg-emerald-50 px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] border border-emerald-100 shadow-[var(--shadow-sm)]">Paid</span>}
                                {row.status === 'Overdue' && <span className="text-red-600 bg-red-50 px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] border border-red-100 shadow-[var(--shadow-sm)]">Overdue</span>}
                                {row.status === 'Pending' && <span className="text-amber-600 bg-amber-50 px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] border border-amber-100 shadow-[var(--shadow-sm)]">Pending</span>}
                                {row.status === 'Sent' && <span className="text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]">Sent</span>}
                                {row.status === 'Unassigned' && <span className="text-slate-500 bg-[var(--color-bg)] border border-[var(--color-border)] px-2 sm:px-3 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)]">Unassigned</span>}
                                {row.status === 'Upcoming' && <span className="text-slate-400 font-medium px-2 sm:px-3">Upcoming</span>}
                              </td>
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-black text-[12px] sm:text-sm ${isRowPaid ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}>
                                ₱{rowTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="block md:hidden space-y-4">
                    {ledgerData.map((row, idx) => {
                      const isRowPaid = row.status === 'Paid';
                      const activeRow = row.isCurrentMonth;
                      const rowPenalty = activeRow ? ledgerLateFee : 0;
                      const rowTotal = activeRow ? ledgerTotal : baseTotal;
                      
                      return (
                        <div key={idx} className={`relative p-4 sm:p-5 rounded-[var(--radius-lg)] border ${activeRow ? "bg-[var(--color-primary)]/5 border-[var(--color-primary)] shadow-[var(--shadow-md)]" : "bg-white border-[var(--color-border)] shadow-[var(--shadow-sm)]"}`}>
                          {activeRow && <div className="absolute inset-y-0 left-0 w-1.5 bg-[var(--color-primary)] rounded-l-[var(--radius-lg)]"></div>}
                          
                          <div className="flex justify-between items-start mb-3 border-b border-[var(--color-border)] pb-3">
                            <div>
                              <span className={`font-black uppercase text-[13px] tracking-wide ${activeRow ? 'text-[var(--color-primary)]' : 'text-[var(--color-secondary)]'}`}>
                                {row.monthName} {row.year}
                              </span>
                              {activeRow && <span className="ml-1.5 text-[9px] font-bold text-[var(--color-primary)] tracking-widest opacity-80">(NOW)</span>}
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Due: {row.dueDate}</div>
                            </div>
                            <div>
                              {row.status === 'Paid' && <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-[var(--radius-sm)] border border-emerald-100 font-bold text-[9px] uppercase tracking-wider">Paid</span>}
                              {row.status === 'Overdue' && <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-[var(--radius-sm)] border border-red-100 font-bold text-[9px] uppercase tracking-wider">Overdue</span>}
                              {row.status === 'Pending' && <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-[var(--radius-sm)] border border-amber-100 font-bold text-[9px] uppercase tracking-wider">Pending</span>}
                              {row.status === 'Sent' && <span className="text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 font-bold text-[9px] uppercase tracking-wider">Sent</span>}
                              {row.status === 'Unassigned' && <span className="text-slate-500 bg-[var(--color-bg)] border border-[var(--color-border)] px-2.5 py-1 rounded-[var(--radius-sm)] font-bold text-[9px] uppercase tracking-wider">Unassigned</span>}
                              {row.status === 'Upcoming' && <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Upcoming</span>}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 mb-4">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-slate-500 font-medium">Dues:</span>
                              <span className="text-[12px] font-bold text-[var(--color-text)]">{dues > 0 ? `₱${dues.toLocaleString()}` : "0"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-slate-500 font-medium">Parking:</span>
                              <span className="text-[12px] font-bold text-[var(--color-text)]">{parking > 0 ? `₱${parking.toLocaleString()}` : "0"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-slate-500 font-medium">Utils:</span>
                              <span className="text-[12px] font-bold text-[var(--color-text)]">{(water + electricity) > 0 ? `₱${(water + electricity).toLocaleString()}` : "0"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-slate-500 font-medium">Penalty:</span>
                              <span className={`text-[12px] font-bold ${rowPenalty > 0 ? 'text-red-600' : 'text-slate-700'}`}>{rowPenalty > 0 ? `₱${rowPenalty.toLocaleString()}` : "0"}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center bg-[var(--color-secondary)] p-3.5 rounded-[var(--radius-md)] border border-transparent shadow-[var(--shadow-sm)]">
                            <span className="text-[11px] font-black uppercase tracking-widest text-white/80">Total:</span>
                            <span className={`font-black text-[16px] tracking-tight text-white`}>
                              ₱{rowTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* ✨ RIGHT SIDEBAR (Transaction History via Ledger) */}
            <div className={`w-full md:w-auto md:min-w-[320px] lg:min-w-[360px] lg:max-w-[400px] shrink-0 bg-white border-t md:border-t-0 md:border-l border-[var(--color-border)] flex-col h-full z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] ${isMobileHistoryVisible ? 'flex' : 'hidden md:flex'} animate-in fade-in slide-in-from-right-4 duration-300`}>
              
              {(() => {
                // Filter the ledger for only "Paid" statuses
                const paidHistory = ledgerData.filter(row => row.status === 'Paid');

                return (
                  <>
                    <div className="p-4 sm:p-5 border-b border-[var(--color-border)] shrink-0 bg-white flex justify-between items-center">
                      <h3 className="font-black text-[var(--color-secondary)] text-[12px] sm:text-[13px] uppercase tracking-wider flex items-center gap-2 whitespace-normal break-words">
                        <History size={16} className="text-[var(--color-primary)] w-4 h-4 sm:w-5 sm:h-5"/> Transaction History
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-[var(--color-bg)] border border-[var(--color-border)] px-2 sm:px-2.5 py-1 rounded-[var(--radius-sm)] shadow-[var(--shadow-sm)] whitespace-nowrap">{paidHistory.length} Total</span>
                        <button 
                          onClick={() => setIsMobileHistoryVisible(false)}
                          className="md:hidden p-1.5 text-slate-400 hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] active:scale-95 transition-colors"
                        >
                          <X size={18} strokeWidth={2.5}/>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-visible md:overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-2.5 sm:space-y-3 bg-[var(--color-bg)]/30 pb-24 md:pb-4">
                      {paidHistory.length === 0 ? (
                        <div className="text-center py-10 sm:py-12 px-5 border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] w-full bg-white shadow-sm">
                          <div className="w-12 h-12 bg-[var(--color-bg)] rounded-full flex items-center justify-center mx-auto mb-3 border border-[var(--color-border)]">
                             <AlertCircle className="text-slate-300" size={24} />
                          </div>
                          <p className="text-[var(--color-secondary)] font-black text-[13px] sm:text-sm tracking-tight mb-1 whitespace-normal break-words">No history found</p>
                          <p className="text-slate-400 text-[11px] sm:text-xs font-medium leading-relaxed whitespace-normal break-words">You haven't made any payments yet. Records will appear here.</p>
                        </div>
                      ) : (
                        paidHistory.map((tx, idx) => (
                          <HistoryItem 
                            key={idx} 
                            title={`Statement Payment`} 
                            method={`${tx.monthName} ${tx.year}`} 
                            date={`Posted: ${tx.dueDate}`} 
                            amount={`₱${(tx.isCurrentMonth ? ledgerTotal : baseTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                            status="Paid" 
                          />
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {/* 🌟 PREMIUM PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] sm:max-h-[95vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            {/* Header - Fixed */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20 shrink-0 shadow-sm">
                  <CreditCard size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-secondary)] tracking-tight whitespace-normal break-words">Submit Payment</h2>
              </div>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-white border border-[var(--color-border)] rounded-[var(--radius-sm)] text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors active:scale-95 shrink-0" disabled={isSimulating}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-[var(--color-bg)]/50 flex-1 flex flex-col">
              
              <div className="flex justify-between items-center bg-white p-4 sm:p-5 rounded-[1.25rem] sm:rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] mb-5 sm:mb-6 gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 whitespace-normal break-words">Amount Due</span>
                  <span className="block text-[12px] sm:text-[14px] font-bold text-[var(--color-secondary)] whitespace-normal break-words">
                    {unit?.property_name} · Unit {unit?.unit_number}
                  </span>
                </div>
                <span className="font-black text-[var(--color-primary)] text-2xl sm:text-3xl tracking-tight shrink-0 whitespace-nowrap">
                  ₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
              
              <div className="mb-5 sm:mb-6 shrink-0">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5 ml-1 whitespace-normal break-words">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)} 
                      className={`w-full px-2 sm:px-3 py-3 sm:py-3.5 rounded-[var(--radius-md)] text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-[var(--shadow-sm)] whitespace-normal break-words leading-tight ${paymentMethod === method ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-2 border-[var(--color-primary)]/40 shadow-[0_2px_8px_rgba(0,0,0,0.1)]' : 'bg-white text-slate-500 border border-[var(--color-border)] hover:bg-[var(--color-bg)]'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5 sm:mb-6 p-4 sm:p-5 rounded-[1.25rem] sm:rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)] text-[13px] sm:text-sm text-[var(--color-text)] transition-all shrink-0">
                {paymentMethod === 'Digital Wallet' && (
                  <div className="flex flex-col items-center">
                    <p className="mb-4 font-black text-[10px] sm:text-[11px] uppercase tracking-widest text-[var(--color-secondary)] text-center whitespace-normal break-words">Scan QR code using GCash, Maya, or QR Ph</p>
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-[var(--color-bg)] relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-inner p-3">
                      {activeQrCodeUrl ? (
                        <img src={activeQrCodeUrl} alt="Scan to pay" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                          <span className="text-[10px] font-bold uppercase text-center mt-2">No QR Setup</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {paymentMethod === 'Bank Transfer' && (
                  <div className="space-y-3">
                    <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-2 border-b border-[var(--color-border)] pb-2 whitespace-normal break-words">Admin Bank Details</p>
                    {activeBankName || activeBankAccountNumber ? (
                      <div className="bg-[var(--color-bg)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] space-y-3">
                        <p className="flex justify-between items-start gap-3"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0 whitespace-normal break-words">Bank</span> <span className="font-black text-[var(--color-secondary)] text-[11px] sm:text-xs text-right whitespace-normal break-words">{activeBankName}</span></p>
                        <p className="flex justify-between items-start gap-3"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0 whitespace-normal break-words">Name</span> <span className="font-black text-[var(--color-secondary)] text-[11px] sm:text-xs text-right whitespace-normal break-words">{activeBankAccountName}</span></p>
                        <div className="flex justify-between items-start gap-3 mt-1 pt-1"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0 whitespace-normal break-words">Account No.</span> <span className="font-black font-mono text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 text-[11px] sm:text-xs text-right break-all whitespace-normal">{activeBankAccountNumber}</span></div>
                      </div>
                    ) : (
                      <p className="text-[11px] sm:text-xs italic text-slate-500 text-center py-5 bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] whitespace-normal break-words">Bank details will be displayed here once configured.</p>
                    )}
                  </div>
                )}
                {paymentMethod === 'Check' && (
                  <div className="space-y-2 text-center py-2 sm:py-3">
                    <p className="text-[11px] sm:text-xs font-bold text-slate-500 whitespace-normal break-words">Make checks payable to:</p>
                    <p className="font-black text-base sm:text-lg text-[var(--color-secondary)] px-2 leading-tight whitespace-normal break-words">{activeBankAccountName || 'HOA Administration'}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2.5 sm:py-3 rounded-[var(--radius-sm)] mt-4 uppercase tracking-wide leading-relaxed whitespace-normal break-words">Please drop off post-dated checks at the admin office within 3 business days.</p>
                  </div>
                )}
                {paymentMethod === 'Cash' && (
                  <div className="text-center py-3 sm:py-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20"><ShieldCheck size={24} className="w-5 h-5 sm:w-7 sm:h-7" /></div>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-600 leading-relaxed px-2 sm:px-4 whitespace-normal break-words">Please pay in exact amounts at the Administration Office. Retain your physical receipt.</p>
                  </div>
                )}
              </div>

              {paymentMethod !== 'Cash' && (
                <div className="mb-6 shrink-0">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1 whitespace-normal break-words">Reference / Transaction No.</label>
                  <input 
                    type="text" 
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. 1002934823"
                    className="w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-md)] px-4 py-3 sm:py-4 text-[13px] sm:text-sm font-bold text-[var(--color-text)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all shadow-[var(--shadow-sm)]"
                  />
                </div>
              )}

              <div className="mt-auto flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-5 sm:pt-6 border-t border-[var(--color-border)] sticky bottom-0 bg-[var(--color-bg)]/90 backdrop-blur-md pb-1 sm:pb-2 z-20">
                <button 
                  type="button" 
                  onClick={() => setIsPaymentModalOpen(false)} 
                  disabled={isSimulating} 
                  className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-[var(--color-border)] hover:border-slate-300 hover:bg-slate-50 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-[var(--shadow-sm)] whitespace-nowrap"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSimulatePayment} 
                  disabled={isSimulating || (paymentMethod !== 'Cash' && referenceNumber.length < 3)} 
                  className="w-full flex-1 min-w-0 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] border border-transparent py-3.5 sm:py-4 rounded-[var(--radius-md)] text-[12px] sm:text-[13px] font-black uppercase tracking-widest transition-all shadow-[var(--shadow-md)] active:scale-95 flex justify-center items-center gap-2 whitespace-normal break-words"
                >
                  {isSimulating ? <span className="animate-pulse">Processing...</span> : "Submit Payment"} <ArrowRight size={16} strokeWidth={2.5} className={`w-4 h-4 sm:w-4 sm:h-4 shrink-0 ${isSimulating ? "hidden" : "block"}`} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 UNIFIED SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-[var(--shadow-sm)] border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight whitespace-normal break-words">Request Submitted</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2 whitespace-normal break-words">
              Payment details for <strong className="text-[var(--color-text)]">{paymentMethod}</strong> submitted successfully. 
              {paymentMethod === 'Cash' || paymentMethod === 'Check'
                ? " Please proceed to the Administration Office to complete your payment." 
                : " Please wait for the Administration to verify and confirm your transaction."}
            </p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] border border-transparent font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95 whitespace-nowrap"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryItem({ title, method, date, amount, status }: any) {
  return (
    <div className="w-full cursor-default p-3.5 sm:p-4 rounded-[var(--radius-md)] transition-all border bg-white border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-sm)] flex items-start sm:items-center justify-between gap-3 group">
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 overflow-hidden min-w-0 pr-2">
        <div className="p-2 sm:p-2.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-[var(--radius-sm)] shrink-0 border border-[var(--color-primary)]/20 group-hover:scale-105 transition-transform mt-0.5 sm:mt-0">
          <Receipt size={16} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[var(--color-secondary)] text-[12px] sm:text-[13px] tracking-tight whitespace-normal break-words leading-tight">{title}</span>
          <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 sm:mt-0.5 whitespace-normal break-words">{method} • {date}</span>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end pl-2">
        <span className="font-black text-[var(--color-primary)] text-[13px] sm:text-[15px] whitespace-nowrap">{amount}</span>
        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-[var(--radius-sm)] mt-1 border shadow-[var(--shadow-sm)] whitespace-nowrap ${status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}