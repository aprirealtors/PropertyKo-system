"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from "@/utils/supabase/client";
import { Receipt, CreditCard, Download, ShieldCheck, AlertCircle, X, CalendarClock, CheckCircle } from 'lucide-react';

export default function PayTab() {
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0, water: 0, electricity: 0, parking: 0,
    penaltyType: 'percent', penaltyValue: 0, collectionDay: 1, gracePeriod: 15,
    bankName: '', bankAccountName: '', bankAccountNumber: ''
  });

  const [soaConfig, setSoaConfig] = useState({
    dues: false, parking: false, water: true, electricity: true, penalty: true
  });
  
  // New independent status
  const [tenantStatus, setTenantStatus] = useState('Pending');
  const [isAssigned, setIsAssigned] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showCashSuccessModal, setShowCashSuccessModal] = useState(false);
  
  // Updated payment methods and reference state (Removed Credit/Debit Card)
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
          .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days, bank_name, bank_account_name, bank_account_number')
          .eq('admin_email', profile.admin_email)
          .single();

        if (orgData) {
          setGlobalComp({
            duesRate: orgData.dues_rate || 0, water: orgData.default_water || 0,
            electricity: orgData.default_electricity || 0, parking: orgData.default_parking || 0,
            penaltyType: orgData.penalty_type || 'percent', penaltyValue: orgData.penalty_value || 0,
            collectionDay: orgData.collection_day || 1, gracePeriod: orgData.grace_period_days || 15,
            bankName: orgData.bank_name || '', bankAccountName: orgData.bank_account_name || '', bankAccountNumber: orgData.bank_account_number || ''
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
              penalty: soaData.tenant_penalty
            });
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

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const displayStatus = !isAssigned ? 'Unassigned' : tenantStatus;
  const isPaid = displayStatus === 'Paid';
  const unitArea = getUnitAreaValue(unit?.unit_area);
  
  const rawDues = globalComp.duesRate * unitArea;
  const rawParking = globalComp.parking;
  const rawWater = globalComp.water;
  const rawElectricity = globalComp.electricity;

  // Zero out the values if SOA hasn't been assigned
  const dues = isAssigned && soaConfig.dues ? rawDues : 0;
  const parking = isAssigned && soaConfig.parking ? rawParking : 0;
  const water = isAssigned && soaConfig.water ? rawWater : 0;
  const electricity = isAssigned && soaConfig.electricity ? rawElectricity : 0;

  const baseTotal = dues + parking + water + electricity;

  let lateFee = 0;
  // Penalty computed specifically on the TENANT'S base total, using TENANT'S status
  if (isAssigned && tenantStatus === 'Overdue' && soaConfig.penalty) {
    if (globalComp.penaltyType === 'percent') {
      lateFee = baseTotal * (globalComp.penaltyValue / 100);
    } else {
      lateFee = globalComp.penaltyValue;
    }
  }

  const totalDue = baseTotal + lateFee;

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
      const dueDate = `${monthName} ${globalComp.collectionDay}, ${currentYear}`;
      months.push({ monthName, year: currentYear, dueDate, status: stat, isCurrentMonth: i === currentMonthIndex });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleExportCSV = () => {
    if (!unit || ledgerData.length === 0) return;
    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    const rows = ledgerData.map(row => {
      const isOverdue = row.status === 'Overdue';
      const rowPenalty = isOverdue ? lateFee : 0;
      const rowTotal = isOverdue ? totalDue : baseTotal;
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

      // Only mark as Paid if the method is NOT cash
      if (!isCash) {
        updatePayload.tenant_status = 'Paid';
      }

      // 1. Update the SOA table
      const { error: soaError } = await supabase.from('soa').update(updatePayload).eq('unit_id', unit.id);

      if (soaError) throw soaError;
      
      if (!isCash) {
        // 2. Insert into transactions table to maintain ledger history (Skip if cash, admin will generate upon receiving)
        const newTx = {
          admin_email: unit.admin_email,
          tenant_name: unit.tenant_name,
          amount: totalDue,
          description: `Statement Payment for ${unit.property_name} - ${unit.unit_number}`,
          payment_method: paymentMethod,
          status: 'Paid'
        };

        const { data: txData, error: txError } = await supabase.from('transactions').insert([newTx]).select().single();
        if (txError) throw txError;
        
        setTenantStatus('Paid');
        if (txData) setTransactions((prev: any) => [txData, ...prev]);
      } else {
        setShowCashSuccessModal(true);
      }

    } catch (error) {
      console.error("Error processing payment submission:", error);
      alert("There was an error submitting your payment. Please try again.");
    } finally {
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
      setReferenceNumber(""); // reset after submission
    }
  };

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Fixed Header Zone */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm">
                <Receipt className="text-[#359b46]" size={24} strokeWidth={2.5} />
              </div>
              Financial Statements
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Manage your assigned statement of account and view transaction records.
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
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-6">
                  <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
                  <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="h-48 w-full bg-[#0b1727]/10 rounded-[2rem] mb-8"></div>
                <div className="h-14 w-full bg-slate-200 rounded-2xl mb-8"></div>
                <div className="flex-1 min-h-[200px] bg-slate-50 rounded-[1.5rem] border border-slate-100"></div>
              </div>
            </div>
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col animate-pulse mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 flex flex-col lg:h-full">
                <div className="h-6 w-32 bg-slate-200 rounded-md mb-6"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 w-full bg-slate-50 rounded-xl"></div>)}
                </div>
              </div>
            </div>
          </>
        ) : !unit ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100 relative z-10">
                <Receipt size={36} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">No Active Lease Found</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                You are currently not assigned as an active tenant to any property. Please contact administration.
              </p>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: SOA SUMMARY & LEDGER */}
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-0">
              <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 left-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 -translate-x-20 pointer-events-none z-0"></div>

                {/* Internal Scrollable Area */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  
                  {/* Property Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 pb-6 border-b border-slate-100 gap-4 shrink-0">
                    <div>
                      <h3 className="font-black text-2xl text-[#0a1e3f] tracking-tight">{unit?.property_name} · Unit {unit?.unit_number}</h3>
                      <p className="text-slate-500 text-sm mt-1 font-medium">Tenant: <span className="font-bold text-[#1d82f5]">{unit?.tenant_name}</span></p>
                    </div>
                  </div>

                  {/* PREMIUM PAYMENT CARD */}
                  <div className="bg-gradient-to-br from-[#0a1e3f] to-[#122955] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden mb-6 shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                    
                    {/* Status Badge */}
                    <div className="absolute top-6 right-6">
                      {displayStatus === 'Unassigned' && <span className="bg-slate-500/20 text-slate-300 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-slate-500/30">Unassigned</span>}
                      {displayStatus === 'Overdue' && <span className="bg-red-500/20 text-red-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-red-500/30 flex items-center gap-1.5"><AlertCircle size={14} /> Overdue</span>}
                      {displayStatus === 'Pending' && <span className="bg-amber-500/20 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-amber-500/30 flex items-center gap-1.5"><CalendarClock size={14} /> Pending</span>}
                      {displayStatus === 'Sent' && <span className="bg-blue-500/20 text-blue-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-blue-500/30 flex items-center gap-1.5"><Receipt size={14} /> Issued</span>}
                      {displayStatus === 'Paid' && <span className="bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-emerald-500/30 flex items-center gap-1.5"><CheckCircle size={14} /> Settled</span>}
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 mt-2">Total Amount Due</p>
                    <h2 className={`text-4xl sm:text-5xl font-black mb-6 tracking-tighter ${isPaid ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'text-[#359b46] drop-shadow-[0_0_15px_rgba(53,155,70,0.3)]'}`}>
                      {!isAssigned ? "—" : `₱${(isPaid ? 0 : totalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
                    </h2>
                    
                    <div className="space-y-3 mb-2 opacity-90">
                      {isAssigned ? (
                        <>
                          {soaConfig.dues && (
                            <div className="flex justify-between items-center text-xs sm:text-sm border-b border-white/10 pb-3">
                              <span className="font-medium text-slate-300">Assoc. Dues <span className="text-[10px] ml-1 hidden sm:inline">({unitArea} sqm)</span></span>
                              <span className="font-bold">₱{dues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          )}
                          {soaConfig.parking && (
                            <div className="flex justify-between items-center text-xs sm:text-sm border-b border-white/10 pb-3">
                              <span className="font-medium text-slate-300">Parking</span>
                              <span className="font-bold">₱{parking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          )}
                          {soaConfig.water && (
                            <div className="flex justify-between items-center text-xs sm:text-sm border-b border-white/10 pb-3">
                              <span className="font-medium text-slate-300">Water</span>
                              <span className="font-bold">₱{water.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          )}
                          {soaConfig.electricity && (
                            <div className="flex justify-between items-center text-xs sm:text-sm border-b border-white/10 pb-3">
                              <span className="font-medium text-slate-300">Electricity</span>
                              <span className="font-bold">₱{electricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          )}
                          {soaConfig.penalty && lateFee > 0 && !isPaid && (
                            <div className="flex justify-between items-center text-xs sm:text-sm border-b border-white/10 pb-3">
                              <span className="text-red-400 font-bold">Late Penalty</span>
                              <span className="font-bold text-red-400">₱{lateFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                            </div>
                          )}

                          {totalDue === 0 && (
                            <div className="text-xs text-slate-400 italic">No assigned balances for this period.</div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-slate-400 italic">Pending SOA assignment from administration.</div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mb-8 shrink-0">
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={!isAssigned || isPaid || totalDue === 0 || isLoading}
                      className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white px-8 py-4 rounded-xl text-sm font-black uppercase tracking-wider shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {!isAssigned ? 'Pending Assignment' : isPaid ? <><CheckCircle size={18} /> Payment Settled</> : totalDue === 0 ? 'No Payment Needed' : <><CreditCard size={18} /> Pay Now</>}
                    </button>
                    <p className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-wider">
                      <ShieldCheck size={14} /> Secure Payment Processing
                    </p>
                  </div>

                  {/* COMBINED LEDGER TABLE */}
                  <div className="mt-auto border-t border-slate-100 pt-8 w-full shrink-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-gradient-to-br from-emerald-50 to-green-100 rounded-lg border border-emerald-200/40">
                          <CalendarClock className="text-[#359b46]" size={18} />
                        </div>
                        <h4 className="font-black text-[#0a1e3f] text-base sm:text-lg tracking-tight">Ledger & Projection <span className="text-slate-400 font-bold text-sm">({new Date().getFullYear()})</span></h4>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          Due: Day {globalComp.collectionDay} <span className="mx-1.5">|</span> Penalty: Day {globalComp.collectionDay + globalComp.gracePeriod}
                        </div>
                        <button 
                          onClick={handleExportCSV}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-4 py-2.5 rounded-xl transition-all border border-blue-200/60 shadow-sm active:scale-95"
                        >
                          <Download size={14} strokeWidth={2.5} /> Export
                        </button>
                      </div>
                    </div>
                    
                    {/* ✨ FIX: Pinaliit ang horizontal padding (px-2 sm:px-3) para mag-fit sa buong desktop width nang walang horizontal scroll */}
                    <div className="border border-slate-200/90 rounded-[1.25rem] max-h-[300px] overflow-auto relative w-full shadow-sm">
                      <table className="w-full text-left text-xs relative">
                        <thead className="text-emerald-50 bg-[#359b46] font-extrabold uppercase tracking-widest border-b border-[#2c813a] sticky top-0 z-20 shadow-md text-[9px] sm:text-[10px]">
                          <tr>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Period</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Due Date</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Dues</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Parking</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Utils</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap bg-red-600 text-white border-r border-red-700">Penalty</th>
                            <th className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-[#43af55]">Status</th>
                            <th className="px-2 sm:px-3 py-3 text-right whitespace-nowrap text-emerald-50">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-medium">
                          {ledgerData.map((row, idx) => {
                            const isRowPaid = row.status === 'Paid';
                            const isRowOverdue = row.status === 'Overdue';
                            const activeRow = row.isCurrentMonth;
                            
                            return (
                              <tr key={idx} className={`${activeRow ? "bg-blue-50/30" : "hover:bg-slate-50"} transition-colors`}>
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100 font-black text-[#0a1e3f] uppercase tracking-wider text-[9px] sm:text-[10px]">
                                  {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1 text-base leading-none align-middle">*</span>}
                                </td>
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100 text-slate-500 font-semibold">{row.dueDate}</td>
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100">{dues > 0 ? `₱${dues.toLocaleString()}` : "0"}</td>
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100">{parking > 0 ? `₱${parking.toLocaleString()}` : "0"}</td>
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100">{(water + electricity) > 0 ? `₱${(water + electricity).toLocaleString()}` : "0"}</td>
                                
                                <td className={`px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100 ${isRowOverdue ? 'text-red-600 font-black bg-red-50/50' : ''}`}>
                                  {isRowOverdue && lateFee > 0 ? `₱${lateFee.toLocaleString()}` : "0"}
                                </td>
                                
                                <td className="px-2 sm:px-3 py-3 whitespace-nowrap border-r border-slate-100 font-medium text-[9px] sm:text-[10px] tracking-wider uppercase">
                                  {row.status === 'Paid' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">Paid</span>}
                                  {row.status === 'Overdue' && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md border border-red-100">Overdue</span>}
                                  {row.status === 'Pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Pending</span>}
                                  {row.status === 'Sent' && <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Sent</span>}
                                  {row.status === 'Unassigned' && <span className="text-slate-500 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">Unassigned</span>}
                                  {row.status === 'Upcoming' && <span className="text-slate-400 font-bold">Upcoming</span>}
                                </td>

                                <td className={`px-2 sm:px-3 py-3 text-right whitespace-nowrap font-black text-[11px] sm:text-xs ${isRowPaid ? 'text-[#359b46]' : 'text-[#0a1e3f]'}`}>
                                  ₱{(isRowOverdue ? totalDue : baseTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: TRANSACTION HISTORY */}
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col mt-6 lg:mt-0 lg:h-full">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-5 flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden w-full">
                <h3 className="font-black text-[#0a1e3f] text-base mb-4 shrink-0 uppercase tracking-widest px-2 flex items-center gap-2">
                  <Receipt size={16} className="text-[#359b46] shrink-0"/> Transaction History
                </h3>
                
                {/* Transaction List container with scroll limit */}
                <div className="max-h-[350px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto custom-scrollbar pr-2 w-full">
                  <div className="space-y-3 pb-4 w-full">
                    {transactions.length === 0 ? (
                      <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl w-full">
                        <AlertCircle className="mx-auto text-slate-300 mb-3" size={28} />
                        <p className="text-slate-500 font-bold text-sm">No history found</p>
                        <p className="text-slate-400 text-xs mt-1">You haven't made any payments yet.</p>
                      </div>
                    ) : (
                      transactions.map((tx, idx) => (
                        <HistoryItem 
                          key={idx} title={tx.description || "Statement Payment"} method={tx.payment_method || "Online Transfer"} 
                          date={new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                          amount={`₱${(tx.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`} status={tx.status || "Paid"} 
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🌟 PREMIUM PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col border border-slate-200/80 animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-6 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1d82f5] to-[#359b46]"></div>
              <h2 className="text-xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-2">
                <CreditCard className="text-[#359b46]" size={20} strokeWidth={2.5} />
                Submit Payment
              </h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSimulating}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="px-6 pb-8 bg-slate-50/40">
              <p className="text-xs font-semibold text-slate-500 mb-6 leading-relaxed">
                {unit?.property_name} · Unit {unit?.unit_number} - total <span className="font-black text-[#0a1e3f]">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </p>
              
              <div className="mb-6">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Select Payment Method</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)} 
                      className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm ${paymentMethod === method ? 'bg-blue-50 text-[#1d82f5] border border-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Instructions Based on Payment Method */}
              <div className="mb-6 p-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm text-sm text-slate-600">
                {paymentMethod === 'Digital Wallet' && (
                  <div className="flex flex-col items-center">
                    <p className="mb-4 font-bold text-xs uppercase tracking-wider text-[#0a1e3f]">Scan QR code using GCash or QR Ph</p>
                    <div className="w-40 h-40 bg-slate-50 relative overflow-hidden rounded-2xl border border-slate-200 shadow-inner p-3">
                      <Image src="/qr-ph.png" alt="Scan to pay" fill className="object-contain p-2" />
                    </div>
                  </div>
                )}
                {paymentMethod === 'Bank Transfer' && (
                  <div className="space-y-2">
                    <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-3 border-b border-slate-100 pb-2">Admin Bank Details</p>
                    {globalComp.bankName || globalComp.bankAccountNumber ? (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <p className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Bank Name</span> <span className="font-black text-[#0a1e3f]">{globalComp.bankName}</span></p>
                        <p className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Account Name</span> <span className="font-black text-[#0a1e3f]">{globalComp.bankAccountName}</span></p>
                        <p className="flex justify-between items-center text-xs"><span className="text-slate-500 font-bold">Account No.</span> <span className="font-black font-mono text-[#1d82f5] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{globalComp.bankAccountNumber}</span></p>
                      </div>
                    ) : (
                      <p className="text-xs italic text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">Bank details will be displayed here once configured by the administration.</p>
                    )}
                  </div>
                )}
                {paymentMethod === 'Check' && (
                  <div className="space-y-2 text-center py-2">
                    <p className="text-xs font-bold text-slate-500">Make checks payable to:</p>
                    <p className="font-black text-lg text-[#0a1e3f]">{globalComp.bankAccountName || 'HOA Administration'}</p>
                    <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg mt-3 uppercase tracking-wide leading-relaxed">Please drop off post-dated checks at the admin office within 3 business days.</p>
                  </div>
                )}
                {paymentMethod === 'Cash' && (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3"><ShieldCheck size={24} /></div>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed px-4">Please pay in exact amounts at the Administration Office. Retain your physical receipt.</p>
                  </div>
                )}
              </div>

              {/* Reference Number Input */}
              {paymentMethod !== 'Cash' && (
                <div className="mb-6">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Reference / Transaction Number</label>
                  <input 
                    type="text" 
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. 1002934823"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1d82f5]/15 focus:border-[#1d82f5] transition-all shadow-sm"
                  />
                </div>
              )}

              <button 
                onClick={handleSimulatePayment} 
                disabled={isSimulating || (paymentMethod !== 'Cash' && referenceNumber.length < 3)} 
                className="w-full bg-[#1d82f5] hover:bg-blue-600 disabled:bg-slate-300 disabled:text-slate-400 disabled:shadow-none text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(29,130,245,0.3)] active:scale-95 flex justify-center items-center gap-2"
              >
                {isSimulating ? <span className="animate-pulse">Processing...</span> : "I've paid, submit receipt"} 
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 CASH SUCCESS MODAL */}
      {showCashSuccessModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 border border-slate-200/80 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
              <CheckCircle size={40} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight">Request Submitted</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed px-2">
              Payment method recorded as <strong className="text-slate-700">Cash</strong>. Please proceed to the Administration Office to complete your payment.
            </p>
            <button 
              onClick={() => setShowCashSuccessModal(false)}
              className="w-full bg-[#359b46] hover:bg-[#2e8a3d] text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] active:scale-95"
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
    <div className="w-full cursor-pointer p-4 rounded-2xl transition-all border bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 shadow-sm flex items-center justify-between mb-3">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl shrink-0 border border-blue-100"><Receipt size={18} strokeWidth={2.5} /></div>
        <div className="flex flex-col overflow-hidden">
          <span className="font-black text-[#0a1e3f] text-sm truncate tracking-tight">{title}</span>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">{method} • {date}</span>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end pl-2">
        <span className="font-black text-[#359b46] text-sm">{amount}</span>
        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 border ${status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}