"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { CalendarClock, Download, X, Receipt, ShieldCheck, AlertCircle, CheckCircle, CreditCard, ArrowRight, Home, ChevronLeft, Clock } from "lucide-react";

export default function FinancialTab({ userData, units }: any) {
  
  // Sort the units alphanumerically
  const sortedUnits = useMemo(() => {
    if (!units || units.length === 0) return [];
    return [...units].sort((a, b) => {
      const propA = a.property_name || "";
      const propB = b.property_name || "";
      const propCompare = propA.localeCompare(propB);
      if (propCompare !== 0) return propCompare; 
      
      const unitA = String(a.unit_number || "").trim();
      const unitB = String(b.unit_number || "").trim();

      const aStartsLetter = /^[a-zA-Z]/.test(unitA);
      const bStartsLetter = /^[a-zA-Z]/.test(unitB);

      if (aStartsLetter && !bStartsLetter) return -1;
      if (!aStartsLetter && bStartsLetter) return 1;

      return unitA.localeCompare(unitB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [units]);

  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [allSoaConfigs, setAllSoaConfigs] = useState<Record<string, any>>({});
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0, water: 0, electricity: 0, parking: 0,
    penaltyType: 'percent', penaltyValue: 3, collectionDay: 1, gracePeriod: 15,
    bankName: '', bankAccountName: '', bankAccountNumber: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showCashSuccessModal, setShowCashSuccessModal] = useState(false);
  
  // ✨ Mobile Master-Detail State
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  
  // Updated payment methods (Removed Credit/Debit Card)
  const PAYMENT_METHODS = [
    'Digital Wallet', 'Bank Transfer', 'Check', 'Cash'
  ];
  const [paymentMethod, setPaymentMethod] = useState<string>('Digital Wallet');
  const [referenceNumber, setReferenceNumber] = useState("");
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userData?.admin_email) {
      fetchBillingConfig();
    }
    
    if (sortedUnits && sortedUnits.length > 0) {
      // ✨ FIX: Wag mag-auto select kapag mobile para malinis ang empty state listahan
      if (!selectedUnit) {
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          setSelectedUnit(sortedUnits[0]); 
        } else {
          setSelectedUnit(null);
        }
      }

      const fetchSoaConfigs = async () => {
        const unitIds = sortedUnits.map((u: any) => u.id);
        const { data, error } = await supabase.from('soa').select('*').in('unit_id', unitIds);

        if (!error && data) {
          const soaMap: Record<string, any> = {};
          const statuses: Record<string, string> = {};
          data.forEach(row => {
            soaMap[row.unit_id] = row;
            statuses[row.unit_id] = row.owner_status || 'Pending'; 
          });
          setAllSoaConfigs(soaMap);
          setLocalStatuses(statuses);
        }
      };
      fetchSoaConfigs();
    }
  }, [userData?.admin_email, sortedUnits]);

  const fetchBillingConfig = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days, bank_name, bank_account_name, bank_account_number')
      .eq('admin_email', userData.admin_email)
      .single();

    if (data && !error) {
      setGlobalComp({
        duesRate: data.dues_rate || 0, water: data.default_water || 0,
        electricity: data.default_electricity || 0, parking: data.default_parking || 0,
        penaltyType: data.penalty_type || 'percent', penaltyValue: data.penalty_value || 0,
        collectionDay: data.collection_day || 1, gracePeriod: data.grace_period_days || 15,
        bankName: data.bank_name || '', bankAccountName: data.bank_account_name || '', bankAccountNumber: data.bank_account_number || ''
      });
    }
    setIsLoading(false);
  };

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const ownerStatus = selectedUnit ? localStatuses[selectedUnit.id] : 'Pending';
  const isPaid = ownerStatus === 'Paid';
  const isVacant = selectedUnit?.status === 'Vacant';
  const unitArea = getUnitAreaValue(selectedUnit?.unit_area);
  
  const rawDues = globalComp.duesRate * unitArea;
  const rawParking = globalComp.parking;
  const rawWater = globalComp.water;
  const rawElectricity = globalComp.electricity;

  const existingSoa = selectedUnit ? allSoaConfigs[selectedUnit.id] : null;
  const isAssigned = !!existingSoa;

  const soaConfig = existingSoa ? {
    owner: {
      dues: existingSoa.owner_dues, parking: existingSoa.owner_parking,
      water: existingSoa.owner_water, electricity: existingSoa.owner_electricity,
      penalty: existingSoa.owner_penalty
    },
    tenant: {
      dues: existingSoa.tenant_dues, parking: existingSoa.tenant_parking,
      water: existingSoa.tenant_water, electricity: existingSoa.tenant_electricity,
      penalty: existingSoa.tenant_penalty
    }
  } : {
    owner: { dues: true, parking: true, water: isVacant, electricity: isVacant, penalty: false },
    tenant: { dues: false, parking: false, water: !isVacant, electricity: !isVacant, penalty: !isVacant && ownerStatus === 'Overdue' }
  };

  const ownerDues = isAssigned && soaConfig.owner.dues ? rawDues : 0;
  const ownerParking = isAssigned && soaConfig.owner.parking ? rawParking : 0;
  const ownerWater = isAssigned && soaConfig.owner.water ? rawWater : 0;
  const ownerElectricity = isAssigned && soaConfig.owner.electricity ? rawElectricity : 0;

  const ownerBase = ownerDues + ownerParking + ownerWater + ownerElectricity;

  const tenantBase = 
    (soaConfig.tenant.dues ? rawDues : 0) + 
    (soaConfig.tenant.parking ? rawParking : 0) + 
    (!isVacant && soaConfig.tenant.water ? rawWater : 0) + 
    (!isVacant && soaConfig.tenant.electricity ? rawElectricity : 0);

  let ownerPenalty = 0;
  if (isAssigned && ownerStatus === 'Overdue' && soaConfig.owner.penalty) {
    ownerPenalty = globalComp.penaltyType === 'percent' ? ownerBase * (globalComp.penaltyValue / 100) : globalComp.penaltyValue;
  }

  const ownerTotalDue = ownerBase + ownerPenalty;

  const generateLedgerMonths = () => {
    const months = [];
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      let stat = "Upcoming";
      if (i < currentMonthIndex) stat = "Paid"; 
      else if (i === currentMonthIndex) stat = !isAssigned ? 'Unassigned' : ownerStatus; 
      const dueDate = `${monthName} ${globalComp.collectionDay}, ${currentYear}`;
      months.push({ monthName, year: currentYear, dueDate, status: stat, isCurrentMonth: i === currentMonthIndex });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleExportCSV = () => {
    if (!selectedUnit || ledgerData.length === 0) return;
    
    // Define headers
    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    
    // Map ledger data into rows
    const rows = ledgerData.map(row => {
      const isOverdue = row.status === 'Overdue';
      const rowPenalty = isOverdue ? ownerPenalty : 0;
      const rowTotal = isOverdue ? ownerTotalDue : ownerBase;
      const utilsTotal = ownerWater + ownerElectricity;
      
      return [
        `"${row.monthName} ${row.year}"`, 
        `"${row.dueDate}"`, 
        ownerDues.toFixed(2), 
        ownerParking.toFixed(2), 
        utilsTotal.toFixed(2), 
        rowPenalty.toFixed(2), 
        `"${row.status}"`, 
        rowTotal.toFixed(2)
      ].join(",");
    });
    
    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // Add BOM (\ufeff) so Excel parses the UTF-8 encoding correctly (prevents character issues)
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Safely generate a filename (preventing crashes if property_name or unit_number is undefined)
    const safePropertyName = (selectedUnit.property_name || "Property").replace(/\s+/g, '_');
    const safeUnitNumber = String(selectedUnit.unit_number || "Unit").replace(/\s+/g, '');
    const fileName = `${safePropertyName}_Unit_${safeUnitNumber}_SOA_${new Date().getFullYear()}.csv`;
    
    // Create a temporary link, trigger download, and clean up
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    
    // Cleanup DOM and free memory
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    
    try {
      const isCash = paymentMethod === 'Cash';

      const updatePayload: any = { 
        owner_payment_amount: ownerTotalDue,
        owner_payment_method: paymentMethod,
        owner_reference_number: isCash ? 'N/A' : referenceNumber,
        unit_name: `${selectedUnit.property_name} - Unit ${selectedUnit.unit_number}` 
      };

      if (!isCash) {
        updatePayload.owner_status = 'Paid';
      }

      const { error: soaError } = await supabase.from('soa').update(updatePayload).eq('unit_id', selectedUnit.id);

      if (soaError) throw soaError;

      if (!isCash) {
        setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
        setAllSoaConfigs(prev => ({
          ...prev,
          [selectedUnit.id]: {
            ...prev[selectedUnit.id],
            owner_status: 'Paid',
            owner_payment_method: paymentMethod,
            owner_reference_number: referenceNumber,
            owner_payment_amount: ownerTotalDue
          }
        }));
      } else {
        setAllSoaConfigs(prev => ({
          ...prev,
          [selectedUnit.id]: {
            ...prev[selectedUnit.id],
            owner_payment_method: paymentMethod,
            owner_reference_number: 'N/A',
            owner_payment_amount: ownerTotalDue
          }
        }));
        setShowCashSuccessModal(true);
      }

    } catch (error) {
      console.error("Error processing payment submission:", error);
      alert("There was an error submitting your payment. Please try again.");
    } finally {
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
      setReferenceNumber(""); 
    }
  };

  if (!sortedUnits || sortedUnits.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-6 sm:mt-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 sm:p-12 md:p-20 text-center flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border border-slate-100">
            <Receipt size={32} className="sm:w-9 sm:h-9" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 sm:mb-3 tracking-tight">No Units Assigned</h2>
          <p className="text-slate-500 text-[13px] sm:text-sm max-w-md mx-auto leading-relaxed mb-6 sm:mb-8">
            You currently don't have any active units billed under your name.
          </p>
        </div>
      </div>
    );
  }

  return (
    // ✨ LOCKED LAYOUT WINDOW SHELL
    <div className="absolute inset-0 flex flex-col bg-[#f4f7f9] font-sans z-20 overflow-hidden">
      
      {/* 🌟 PREMIUM HEADER - Glassmorphism & Fully Responsive */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 sm:py-5 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 max-w-[1600px] mx-auto w-full">
          
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl border border-emerald-200/50 shadow-sm shrink-0">
                <Receipt className="text-[#359b46] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight truncate">
                  Financial Statements
                </h2>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 font-medium truncate">
                  Review your SOA and pay dues securely
                </p>
              </div>
            </div>
            {/* Mobile Profile Icon */}
            <div className="md:hidden w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shadow-inner border border-purple-100 shrink-0">
              {userData?.name 
                  ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "OW"}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
              <span className="text-[11px] font-extrabold text-[#0a1e3f] leading-none">Owner</span>
            </div>
            <div className="w-9 h-9 rounded-[12px] bg-purple-50 text-purple-600 flex items-center justify-center font-black text-xs shadow-inner border border-purple-100 group-hover:scale-105 transition-transform duration-300">
                {userData?.name 
                  ? userData.name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 2).toUpperCase() 
                  : "OW"}
              </div>
          </div>

        </div>
      </div>

      {/* ✨ KANBAN LAYOUT Main Wrapper - Mobile Stack, Desktop Side-by-Side */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col md:flex-row overflow-hidden relative">
        
        {isLoading ? (
          /* 🌟 PREMIUM SKELETON LOADING */
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-wider gap-3">
            <Clock size={24} className="animate-spin text-[#359b46]" /> Loading financial data...
          </div>
        ) : (
          <>
            {/* ✨ FIX: SIDEBAR (Properties Inventory) - Shows on Mobile if isMobileListVisible is true */}
            <div className={`w-full md:w-[320px] lg:w-[360px] shrink-0 bg-white border-r border-slate-200/60 flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white flex justify-between items-center">
                <h3 className="font-black text-[#0a1e3f] text-[12px] sm:text-[13px] uppercase tracking-wider flex items-center gap-2">
                  <Home size={14} className="text-[#359b46]"/> Your Properties
                </h3>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-2 sm:px-2.5 py-1 rounded-lg shadow-sm">{sortedUnits.length} Total</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3 space-y-1 bg-slate-50/30">
                {sortedUnits.map((unit: any) => {
                  const status = localStatuses[unit.id];
                  const isSelected = selectedUnit?.id === unit.id;
                  const isRowTenantVacant = unit.status === 'Vacant' || !unit.tenant_name || unit.tenant_name === '—';
                  
                  return (
                    <div 
                      key={unit.id} 
                      onClick={() => {
                        setSelectedUnit(unit);
                        setIsMobileListVisible(false); // Hide list on mobile
                      }}
                      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-200 group border ${isSelected ? 'bg-gradient-to-br from-[#359b46] to-[#2c813a] border-transparent shadow-md text-white' : 'bg-white border-transparent hover:border-slate-200/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] text-slate-700'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[13px] sm:text-[14px] truncate tracking-tight font-black ${isSelected ? 'text-white' : 'text-[#0a1e3f]'}`}>
                          {unit.property_name} {unit.unit_number}
                        </h4>
                        <div className={`text-[10px] sm:text-[11px] font-medium truncate mt-1 ${isSelected ? 'text-green-100' : 'text-slate-500'}`}>
                          <span className="font-bold opacity-70">T:</span> {isRowTenantVacant ? 'Vacant' : unit.tenant_name}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        {status === 'Paid' && <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>Paid</span>}
                        {status === 'Overdue' && <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : 'bg-red-50 text-red-600 border-red-100'}`}>Overdue</span>}
                        {status === 'Pending' && <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>Pending</span>}
                        {status === 'Sent' && <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>Sent</span>}
                        {(!status || status === 'Pending' && !allSoaConfigs[unit.id]) && <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>Unassigned</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ✨ FIX: MAIN DETAILS - Shows on Mobile if list is hidden */}
            <div className={`flex-1 flex-col overflow-hidden bg-[#f4f7f9] relative ${!isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              {!selectedUnit ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full animate-in fade-in duration-300">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                    <Receipt size={28} className="text-slate-300 sm:w-8 sm:h-8" />
                  </div>
                  <p className="text-slate-700 font-black text-lg sm:text-xl tracking-tight">No unit selected</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Choose a unit from the sidebar to view billing details.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                  
                  {/* ✨ FIX: NEW SOA DETAILS CARD (Stacked Mobile, Border Divider Desktop) */}
                  <div className="bg-white rounded-[1.5rem] sm:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-800 overflow-hidden">
                    
                    {/* Header with Mobile Back Button */}
                    <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-5 flex items-center justify-between gap-3 border-b border-slate-800">
                      <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                        <button 
                          onClick={() => setIsMobileListVisible(true)}
                          className="md:hidden mt-0.5 -ml-1.5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 shrink-0"
                        >
                          <ChevronLeft size={22} strokeWidth={2.5} />
                        </button>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[#0a1e3f] text-base sm:text-xl tracking-tight leading-tight whitespace-normal break-words">
                            {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                          </h3>
                          <p className="text-slate-500 text-[11px] sm:text-sm mt-1 sm:mt-1.5 font-medium truncate">
                            Tenant: <span className={`font-bold ${isVacant ? 'text-slate-400' : 'text-[#1d82f5]'}`}>{isVacant ? 'Vacant' : selectedUnit?.tenant_name || '—'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {!isAssigned && <span className="bg-slate-50 text-slate-500 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm shrink-0">Unassigned</span>}
                        {isAssigned && ownerStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-widest border border-red-200 shadow-sm flex items-center gap-1 sm:gap-1.5 shrink-0"><AlertCircle size={12} className="sm:w-[14px] sm:h-[14px]" /> Overdue</span>}
                        {isAssigned && ownerStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-widest border border-amber-200 shadow-sm flex items-center gap-1 sm:gap-1.5 shrink-0"><CalendarClock size={12} className="sm:w-[14px] sm:h-[14px]" /> Pending</span>}
                        {isAssigned && ownerStatus === 'Sent' && <span className="bg-blue-50 text-blue-700 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-widest border border-blue-200 shadow-sm flex items-center gap-1 sm:gap-1.5 shrink-0"><Receipt size={12} className="sm:w-[14px] sm:h-[14px]" /> Sent</span>}
                        {isAssigned && ownerStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] uppercase tracking-widest border border-emerald-200 shadow-sm flex items-center gap-1 sm:gap-1.5 shrink-0"><CheckCircle size={12} className="sm:w-[14px] sm:h-[14px]" /> Settled</span>}
                      </div>
                    </div>

                    {/* Split Breakdown - Flex Col on Mobile / Grid 2 Columns + Line Divider on Desktop */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-800">
                      
                      {/* OWNER COLUMN */}
                      <div className="p-4 sm:p-6 md:p-8 relative flex flex-col">
                         <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100">
                             <h4 className="font-black text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Owner</h4>
                             <p className="font-black text-[#0a1e3f] text-[13px] sm:text-[15px] uppercase tracking-widest truncate">Assigned to You</p>
                         </div>

                         <div className="space-y-3 sm:space-y-3.5 flex-1">
                            {isAssigned ? (
                              <>
                                {soaConfig.owner.dues && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm">
                                    <span className="text-slate-500 font-medium truncate">Assoc. dues <span className="text-[10px] text-slate-400 ml-1 hidden sm:inline">({unitArea} sqm)</span></span>
                                    <span className="font-bold text-[#0a1e3f] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                  </div>
                                )}
                                {soaConfig.owner.parking && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Parking</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.owner.water && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Water</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.owner.electricity && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Electricity</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.owner.penalty && ownerPenalty > 0 && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-500 font-bold truncate">Late Penalty</span><span className="font-black text-red-600 shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {ownerTotalDue === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">No assigned balances.</p>}
                              </>
                            ) : (
                              <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">Pending SOA assignment.</p>
                            )}
                         </div>
                      </div>

                      {/* TENANT COLUMN */}
                      <div className="p-4 sm:p-6 md:p-8 bg-slate-50/30 relative flex flex-col border-t lg:border-t-0 border-slate-800">
                         <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-200/60">
                             <h4 className="font-black text-[#1d82f5] text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Tenant</h4>
                             <p className="font-black text-[#1d82f5] text-[13px] sm:text-[15px] uppercase tracking-widest truncate">Assigned to Tenant</p>
                         </div>

                         <div className="space-y-3 sm:space-y-3.5 flex-1 opacity-80 hover:opacity-100 transition-opacity">
                            {isAssigned ? (
                              <>
                                {soaConfig.tenant.dues && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Assoc. dues</span><span className="font-bold text-slate-700 shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.tenant.parking && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Parking</span><span className="font-bold text-slate-700 shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.tenant.water && !isVacant && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Water</span><span className="font-bold text-slate-700 shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.tenant.electricity && !isVacant && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Electricity</span><span className="font-bold text-slate-700 shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                )}
                                {soaConfig.tenant.penalty && existingSoa?.tenant_status === 'Overdue' && (
                                  <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-400 font-bold truncate">Late Penalty</span><span className="font-black text-red-500 shrink-0">Pending</span></div>
                                )}
                                {tenantBase === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">No assigned balances.</p>}
                              </>
                            ) : (
                              <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">Pending SOA assignment.</p>
                            )}
                         </div>
                      </div>
                    </div>

                    {/* Total Hero Banner inside the card */}
                    <div className="bg-gradient-to-r from-[#0a1e3f] to-[#163666] p-4 sm:p-6 md:p-8 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                      <div className="min-w-0">
                        <span className="font-black text-blue-200 text-[10px] sm:text-[11px] uppercase tracking-widest mb-1 truncate block">Total Due <span className="font-medium text-slate-400 ml-1 normal-case hidden sm:inline">(Your Account)</span></span>
                      </div>
                      <span className="font-black text-white text-3xl sm:text-4xl tracking-tight drop-shadow-md shrink-0">
                        {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div className="w-full shrink-0">
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={!isAssigned || isPaid || ownerTotalDue === 0 || isLoading}
                      className="w-full bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:shadow-[0_4px_15px_rgba(53,155,70,0.3)] disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-400 disabled:shadow-none text-white px-4 py-4 rounded-xl sm:rounded-2xl text-[12px] sm:text-sm font-black uppercase tracking-wider transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {!isAssigned ? 'Pending Assignment' : isPaid ? <><CheckCircle size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Payment Settled</> : ownerTotalDue === 0 ? 'No Payment Needed' : <><CreditCard size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Pay Now</>}
                    </button>
                  </div>

                  {/* COMBINED LEDGER TABLE */}
                  <div className="bg-white rounded-[1.5rem] sm:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 p-4 sm:p-6 md:p-8 overflow-hidden mb-14">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-6 gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
                          <CalendarClock size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-[#0a1e3f] text-base sm:text-lg tracking-tight truncate">Ledger & Projection</h4>
                          <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                            Due: Day {globalComp.collectionDay} <span className="mx-1.5 text-slate-300">|</span> Penalty: Day {globalComp.collectionDay + globalComp.gracePeriod}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={handleExportCSV}
                        className="w-full sm:w-auto justify-center flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-4 sm:px-5 py-2.5 rounded-xl transition-all active:scale-95 border border-blue-100 shadow-sm shrink-0"
                      >
                        <Download size={16} className="w-4 h-4" /> Export CSV
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto border border-slate-200/80 rounded-2xl custom-scrollbar relative shadow-inner">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-[#359b46] text-white font-extrabold border-b border-[#2c813a] sticky top-0 z-10 shadow-md">
                          <tr>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">PERIOD</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">DUE DATE</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">DUES</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">PARKING</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">UTILS</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap bg-red-600 text-white border-r border-red-700 text-[9px] sm:text-[10px] uppercase tracking-widest">
                              PENALTY
                            </th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 whitespace-nowrap border-r border-[#43af55] text-[9px] sm:text-[10px] uppercase tracking-widest">STATUS</th>
                            <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right whitespace-nowrap text-white text-[9px] sm:text-[10px] uppercase tracking-widest">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-medium">
                          {ledgerData.map((row, idx) => {
                            const isRowPaid = row.status === 'Paid';
                            const isRowOverdue = row.status === 'Overdue';
                            const activeRow = row.isCurrentMonth;
                            
                            return (
                              <tr key={idx} className={`transition-colors ${activeRow ? "bg-blue-50/40 hover:bg-blue-50/60" : "hover:bg-slate-50"}`}>
                                <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-black uppercase text-[10px] sm:text-[11px] tracking-wide ${activeRow ? 'text-[#359b46]' : 'text-[#0a1e3f]'}`}>
                                  {row.monthName} {row.year} {activeRow && <span className="ml-1 text-lg leading-none align-middle text-[#359b46]">•</span>}
                                </td>
                                <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 text-slate-500 font-medium text-[11px] sm:text-xs">{row.dueDate}</td>
                                <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-[11px] sm:text-xs">{ownerDues > 0 ? `₱${ownerDues.toLocaleString()}` : "0"}</td>
                                <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-[11px] sm:text-xs">{ownerParking > 0 ? `₱${ownerParking.toLocaleString()}` : "0"}</td>
                                <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-[11px] sm:text-xs">{(ownerWater + ownerElectricity) > 0 ? `₱${(ownerWater + ownerElectricity).toLocaleString()}` : "0"}</td>
                                
                                <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-bold text-[11px] sm:text-xs ${isRowOverdue ? 'text-red-600 bg-red-50/50' : 'text-slate-400'}`}>
                                  {isRowOverdue && ownerPenalty > 0 ? `₱${ownerPenalty.toLocaleString()}` : "0"}
                                </td>
                                
                                <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-bold text-[9px] sm:text-[10px] tracking-wider uppercase">
                                  {row.status === 'Paid' && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-emerald-100 shadow-sm">Paid</span>}
                                  {row.status === 'Overdue' && <span className="text-red-600 bg-red-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-red-100 shadow-sm">Overdue</span>}
                                  {row.status === 'Pending' && <span className="text-amber-600 bg-amber-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-amber-100 shadow-sm">Pending</span>}
                                  {row.status === 'Sent' && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-blue-100 shadow-sm">Sent</span>}
                                  {row.status === 'Unassigned' && <span className="text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-sm">Unassigned</span>}
                                  {row.status === 'Upcoming' && <span className="text-slate-400">Upcoming</span>}
                                </td>

                                <td className={`px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-black text-[12px] sm:text-sm ${isRowPaid ? 'text-[#359b46]' : 'text-[#0a1e3f]'}`}>
                                  ₱{(isRowOverdue ? ownerTotalDue : ownerBase).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 🌟 PREMIUM PAYMENT MODAL (Bottom Sheet for Mobile, Center for Desktop) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh] sm:max-h-[95vh] border border-slate-200/80 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            {/* Header - Fixed */}
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-white shrink-0 border-b border-slate-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-[#1d82f5] flex items-center justify-center border border-blue-100 shrink-0 shadow-sm">
                  <CreditCard size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight truncate">Submit Payment</h2>
              </div>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors active:scale-95 shrink-0" disabled={isSimulating}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1 flex flex-col">
              
              {/* Premium Amount Due Card */}
              <div className="flex justify-between items-center bg-white p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mb-5 sm:mb-6 gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Amount Due</span>
                  <span className="truncate block text-[12px] sm:text-[14px] font-bold text-[#0a1e3f]">
                    {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                  </span>
                </div>
                <span className="font-black text-[#1d82f5] text-2xl sm:text-3xl tracking-tight shrink-0">
                  ₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
              
              {/* Payment Method Selector */}
              <div className="mb-5 sm:mb-6 shrink-0">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2.5 ml-1">Select Payment Method</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {PAYMENT_METHODS.map((method) => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)} 
                      className={`w-full px-2 sm:px-3 py-3 sm:py-3.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-sm truncate ${paymentMethod === method ? 'bg-blue-50 text-[#1d82f5] border-2 border-blue-200 shadow-[0_2px_8px_rgba(29,130,245,0.15)]' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Instructions Based on Payment Method */}
              <div className="mb-5 sm:mb-6 p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-[13px] sm:text-sm text-slate-600 transition-all shrink-0">
                {paymentMethod === 'Digital Wallet' && (
                  <div className="flex flex-col items-center">
                    <p className="mb-4 font-black text-[10px] sm:text-[11px] uppercase tracking-widest text-[#0a1e3f] text-center">Scan QR code using GCash or QR Ph</p>
                    <div className="w-32 h-32 sm:w-40 sm:h-40 bg-slate-50 relative overflow-hidden rounded-2xl border border-slate-200 shadow-inner p-3">
                      <Image src="/qr-ph.png" alt="Scan to pay" fill className="object-contain p-2" />
                    </div>
                  </div>
                )}
                {paymentMethod === 'Bank Transfer' && (
                  <div className="space-y-3">
                    <p className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 pb-2">Admin Bank Details</p>
                    {globalComp.bankName || globalComp.bankAccountNumber ? (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                        <p className="flex justify-between items-center gap-3"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0">Bank</span> <span className="font-black text-[#0a1e3f] text-[11px] sm:text-xs truncate text-right">{globalComp.bankName}</span></p>
                        <p className="flex justify-between items-center gap-3"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0">Name</span> <span className="font-black text-[#0a1e3f] text-[11px] sm:text-xs truncate text-right">{globalComp.bankAccountName}</span></p>
                        <div className="flex justify-between items-center gap-3 mt-1 pt-1"><span className="text-slate-500 font-bold text-[11px] sm:text-xs shrink-0">Account No.</span> <span className="font-black font-mono text-[#1d82f5] bg-blue-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-md border border-blue-100 text-[11px] sm:text-xs truncate text-right">{globalComp.bankAccountNumber}</span></div>
                      </div>
                    ) : (
                      <p className="text-[11px] sm:text-xs italic text-slate-500 text-center py-5 bg-slate-50 rounded-xl border border-dashed border-slate-200">Bank details will be displayed here once configured by the administration.</p>
                    )}
                  </div>
                )}
                {paymentMethod === 'Check' && (
                  <div className="space-y-2 text-center py-3 sm:py-4">
                    <p className="text-[11px] sm:text-xs font-bold text-slate-500">Make checks payable to:</p>
                    <p className="font-black text-base sm:text-lg text-[#0a1e3f] break-words px-2 leading-tight">{globalComp.bankAccountName || 'HOA Administration'}</p>
                    <p className="text-[9px] sm:text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2.5 sm:py-3 rounded-lg mt-4 uppercase tracking-wide leading-relaxed">Please drop off post-dated checks at the admin office within 3 business days.</p>
                  </div>
                )}
                {paymentMethod === 'Cash' && (
                  <div className="text-center py-4 sm:py-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-sm border border-emerald-100"><ShieldCheck size={24} className="w-5 h-5 sm:w-7 sm:h-7" /></div>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-600 leading-relaxed px-4">Please pay in exact amounts at the Administration Office. Retain your physical receipt.</p>
                  </div>
                )}
              </div>

              {/* Reference Number Input */}
              {paymentMethod !== 'Cash' && (
                <div className="mb-6 shrink-0">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-1 truncate">Reference / Transaction No.</label>
                  <input 
                    type="text" 
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. 1002934823"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 sm:py-4 text-[13px] sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-[#1d82f5]/15 focus:border-[#1d82f5] transition-all shadow-sm"
                  />
                </div>
              )}

              {/* Stacked Mobile Buttons, Perfectly Balanced Desktop Buttons */}
              <div className="mt-auto flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-5 sm:pt-6 border-t border-slate-200/60 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-1 sm:pb-2 z-20">
                <button 
                  type="button" 
                  onClick={() => setIsPaymentModalOpen(false)} 
                  disabled={isSimulating} 
                  className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSimulatePayment} 
                  disabled={isSimulating || (paymentMethod !== 'Cash' && referenceNumber.length < 3)} 
                  className="w-full flex-1 min-w-0 bg-gradient-to-b from-[#1d82f5] to-[#1565c0] hover:from-[#1565c0] hover:to-[#0f4d92] disabled:from-slate-300 disabled:to-slate-300 disabled:text-white/70 disabled:shadow-none text-white py-3.5 sm:py-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(29,130,245,0.3)] hover:shadow-[0_6px_20px_rgba(29,130,245,0.4)] active:scale-95 flex justify-center items-center gap-2"
                >
                  {isSimulating ? <span className="animate-pulse">Processing...</span> : "Submit Payment"} <ArrowRight size={16} strokeWidth={2.5} className={`w-4 h-4 sm:w-4 sm:h-4 ${isSimulating ? "hidden" : "block"}`} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 CASH SUCCESS MODAL */}
      {showCashSuccessModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-slate-200/80 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-inner border border-emerald-100">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] mb-2 sm:mb-3 tracking-tight">Request Submitted</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              Payment method recorded as <strong className="text-slate-700">Cash</strong>. Please proceed to the Administration Office to complete your payment.
            </p>
            <button 
              onClick={() => setShowCashSuccessModal(false)}
              className="w-full bg-gradient-to-b from-[#359b46] to-[#2c813a] hover:from-[#2c813a] hover:to-[#236b2f] text-white font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-xl transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}