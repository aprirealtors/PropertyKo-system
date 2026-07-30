"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { CalendarClock, Download, X, Receipt, ShieldCheck, AlertCircle, CheckCircle, CreditCard, ArrowRight, Home } from "lucide-react";

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

  const [selectedUnit, setSelectedUnit] = useState<any>(sortedUnits?.[0] || null);
  const [allSoaConfigs, setAllSoaConfigs] = useState<Record<string, any>>({});
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0, water: 0, electricity: 0, parking: 0,
    penaltyType: 'percent', penaltyValue: 3, collectionDay: 1, gracePeriod: 15,
    bankName: '', bankAccountName: '', bankAccountNumber: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showCashSuccessModal, setShowCashSuccessModal] = useState(false);
  
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
      if (!selectedUnit) setSelectedUnit(sortedUnits[0]);

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
  const isAssigned = !!existingSoa; // Flag to check if SOA has been assigned

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

  // Assign amounts based on assignment status
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
    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    const rows = ledgerData.map(row => {
      const isOverdue = row.status === 'Overdue';
      const rowPenalty = isOverdue ? ownerPenalty : 0;
      const rowTotal = isOverdue ? ownerTotalDue : ownerBase;
      return [`"${row.monthName} ${row.year}"`, `"${row.dueDate}"`, ownerDues, ownerParking, (ownerWater + ownerElectricity), rowPenalty, `"${row.status}"`, rowTotal].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedUnit.property_name.replace(/\s+/g, '_')}_Unit_${selectedUnit.unit_number}_SOA_${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      // Only mark as Paid if the method is NOT cash
      if (!isCash) {
        updatePayload.owner_status = 'Paid';
      }

      // Update the SOA table
      const { error: soaError } = await supabase.from('soa').update(updatePayload).eq('unit_id', selectedUnit.id);

      if (soaError) throw soaError;

      // Maintain local state if paid instantly
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
        // If cash, we just update the payment info locally but keep the previous status
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
      setReferenceNumber(""); // reset
    }
  };

  if (!sortedUnits || sortedUnits.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center w-full">
        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4"><Receipt size={32} /></div>
        <p className="text-slate-500 font-medium">No units assigned.</p>
        <p className="text-xs text-slate-400 mt-2">You currently don't have any active units billed under your name.</p>
      </div>
    );
  }

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
              Review your Statement of Account (SOA) and pay your dues securely.
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            {/* Premium Profile Badge */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3 bg-white pl-1.5 sm:pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group shrink-0 ml-auto sm:ml-0">
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
        
        {isLoading ? (
          /* 🌟 PREMIUM SKELETON LOADING */
          <>
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 animate-pulse order-2 lg:order-1 mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col lg:h-full">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-6">
                  <div className="space-y-3">
                    <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
                    <div className="h-4 w-32 bg-slate-100 rounded-md"></div>
                  </div>
                  <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  <div className="h-48 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                  <div className="h-48 w-full bg-slate-50 rounded-2xl border border-slate-100"></div>
                </div>
                <div className="h-20 w-full bg-slate-100 rounded-2xl mb-8"></div>
                <div className="h-14 w-full sm:w-48 bg-slate-200 rounded-xl mb-8"></div>
                <div className="flex-1 min-h-[200px] bg-slate-50 rounded-2xl border border-slate-100"></div>
              </div>
            </div>

            {/* ✨ FIX: Nilagyan ng order-1 lg:order-2 para mauna sa mobile */}
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col animate-pulse order-1 lg:order-2">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-6 flex flex-col lg:h-full">
                <div className="h-6 w-32 bg-slate-200 rounded-md mb-6"></div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 w-full bg-slate-50 rounded-xl"></div>)}
                </div>
              </div>
            </div>
          </>
        ) : !sortedUnits || sortedUnits.length === 0 ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 flex flex-col">
            <div className="flex-1 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-10 flex flex-col items-center justify-center text-center relative overflow-hidden lg:h-full">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100 relative z-10">
                <Receipt size={36} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight relative z-10">No Units Assigned</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed mb-8 relative z-10">
                You currently don't have any active units billed under your name.
              </p>
            </div>
          </div>
        ) : (
          /* ✨ ACTUAL CONTENT (Loaded) */
          <>
            {/* LEFT COLUMN: SOA DETAILS & LEDGER */}
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-0 order-2 lg:order-1 mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                {/* Internal Scrollable Area */}
                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 pb-6 border-b border-slate-100 gap-4 shrink-0">
                    <div>
                      <h3 className="font-black text-2xl text-[#0a1e3f] tracking-tight">{selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}</h3>
                      <p className="text-slate-500 text-sm mt-1 font-medium">Tenant: <span className={`font-bold ${isVacant ? 'text-slate-400' : 'text-[#1d82f5]'}`}>{isVacant ? 'Vacant' : selectedUnit?.tenant_name || '—'}</span></p>
                    </div>
                    <div className="shrink-0">
                      {!isAssigned && <span className="bg-slate-50 text-slate-500 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-slate-200 shadow-sm">Unassigned</span>}
                      {isAssigned && ownerStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-red-200 shadow-sm flex items-center gap-1.5"><AlertCircle size={14} /> Overdue</span>}
                      {isAssigned && ownerStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-amber-200 shadow-sm flex items-center gap-1.5"><CalendarClock size={14} /> Pending</span>}
                      {isAssigned && ownerStatus === 'Sent' && <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-blue-200 shadow-sm flex items-center gap-1.5"><Receipt size={14} /> SOA Sent</span>}
                      {isAssigned && ownerStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest border border-emerald-200 shadow-sm flex items-center gap-1.5"><CheckCircle size={14} /> Settled</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 shrink-0">
                    {/* Assigned to You (Owner) */}
                    <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-sm w-full min-w-0">
                      <div className="mb-4 pb-3 border-b border-slate-100">
                        <h4 className="font-bold text-[#0a1e3f] text-xs sm:text-sm uppercase tracking-wide truncate">Assigned to You</h4>
                      </div>
                      <div className="space-y-3">
                        {isAssigned ? (
                          <>
                            {soaConfig.owner.dues && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2">
                                <span className="text-slate-600 truncate">Assoc. dues <span className="text-[10px] text-slate-400 ml-1 hidden sm:inline">({unitArea} sqm)</span></span>
                                <span className="font-bold text-[#0a1e3f] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              </div>
                            )}
                            {soaConfig.owner.parking && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Parking</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.owner.water && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Water</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.owner.electricity && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Electricity</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.owner.penalty && ownerPenalty > 0 && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-red-500 font-semibold truncate">Late payment penalty</span><span className="font-bold text-red-600 shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {ownerTotalDue === 0 && <p className="text-xs text-slate-400 italic">No balances assigned to you this period.</p>}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                        )}
                      </div>
                    </div>

                    {/* Assigned to Tenant */}
                    <div className="border border-[#1d82f5]/20 rounded-2xl p-4 sm:p-5 bg-slate-50 w-full min-w-0">
                      <div className="mb-4 pb-3 border-b border-slate-100">
                        <h4 className="font-bold text-[#1d82f5] text-xs sm:text-sm uppercase tracking-wide truncate">Assigned to Tenant</h4>
                      </div>
                      <div className="space-y-3 opacity-80">
                        {isAssigned ? (
                          <>
                            {soaConfig.tenant.dues && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Association dues</span><span className="font-bold text-slate-700 shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.tenant.parking && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Parking</span><span className="font-bold text-slate-700 shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.tenant.water && !isVacant && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Water</span><span className="font-bold text-slate-700 shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.tenant.electricity && !isVacant && (
                              <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-slate-600 truncate">Electricity</span><span className="font-bold text-slate-700 shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {soaConfig.tenant.penalty && existingSoa?.tenant_status === 'Overdue' && (
                               <div className="flex justify-between items-center text-xs sm:text-sm gap-2"><span className="text-red-400 font-semibold truncate">Late Penalty</span><span className="font-bold text-red-400 shrink-0">Pending</span></div>
                            )}
                            {tenantBase === 0 && <p className="text-xs text-slate-400 italic">No balances assigned to tenant this period.</p>}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Total Due Banner */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 bg-[#0a1e3f] p-4 sm:p-5 rounded-2xl shadow-inner text-white gap-3 sm:gap-0 shrink-0">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-300 text-[10px] sm:text-xs uppercase tracking-widest mb-0.5">Total due <span className="font-medium text-slate-400 ml-1 normal-case">(Your Account)</span></span>
                    </div>
                    <span className="font-black text-[#359b46] text-3xl tracking-tight drop-shadow-md self-end sm:self-auto">
                      {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                    </span>
                  </div>
                  
                  {/* Action Button */}
                  <div className="mb-8 shrink-0">
                    <button 
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={!isAssigned || isPaid || ownerTotalDue === 0 || isLoading}
                      className="w-full sm:w-auto bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white px-8 py-4 rounded-xl text-sm font-black uppercase tracking-wider shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {!isAssigned ? 'Pending Assignment' : isPaid ? <><CheckCircle size={18} /> Payment Settled</> : ownerTotalDue === 0 ? 'No Payment Needed' : <><CreditCard size={18} /> Pay Now</>}
                    </button>
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
                    
                    <div className="border border-slate-200/90 rounded-[1.25rem] max-h-[300px] overflow-auto relative w-full shadow-sm">
                      <table className="w-full text-left text-xs relative">
                        <thead className="text-emerald-50 bg-[#359b46] font-extrabold uppercase tracking-widest border-b border-[#2c813a] sticky top-0 z-20 shadow-md text-[10px]">
                          <tr>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Period</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Due Date</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Dues</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Parking</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Utils</th>
                            <th className="px-5 py-4 whitespace-nowrap bg-red-600 text-white border-r border-red-700">Penalty</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-[#43af55]">Status</th>
                            <th className="px-5 py-4 text-right whitespace-nowrap text-emerald-50">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-medium">
                          {ledgerData.map((row, idx) => {
                            const isRowPaid = row.status === 'Paid';
                            const isRowOverdue = row.status === 'Overdue';
                            const activeRow = row.isCurrentMonth;
                            
                            return (
                              <tr key={idx} className={`${activeRow ? "bg-blue-50/30" : "hover:bg-slate-50"} transition-colors`}>
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100 font-black text-[#0a1e3f] uppercase tracking-wider text-[10px]">
                                  {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1 text-lg leading-none align-middle">*</span>}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100 text-slate-500 font-semibold">{row.dueDate}</td>
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100">{ownerDues > 0 ? `₱${ownerDues.toLocaleString()}` : "0"}</td>
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100">{ownerParking > 0 ? `₱${ownerParking.toLocaleString()}` : "0"}</td>
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100">{(ownerWater + ownerElectricity) > 0 ? `₱${(ownerWater + ownerElectricity).toLocaleString()}` : "0"}</td>
                                
                                <td className={`px-5 py-3.5 whitespace-nowrap border-r border-slate-100 ${isRowOverdue ? 'text-red-600 font-black bg-red-50/50' : ''}`}>
                                  {isRowOverdue && ownerPenalty > 0 ? `₱${ownerPenalty.toLocaleString()}` : "0"}
                                </td>
                                
                                <td className="px-5 py-3.5 whitespace-nowrap border-r border-slate-100 font-medium text-[10px] tracking-wider uppercase">
                                  {row.status === 'Paid' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">Paid</span>}
                                  {row.status === 'Overdue' && <span className="text-red-600 font-bold bg-red-50 px-2.5 py-1 rounded-md border border-red-100">Overdue</span>}
                                  {row.status === 'Pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">Pending</span>}
                                  {row.status === 'Sent' && <span className="text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">Sent</span>}
                                  {row.status === 'Unassigned' && <span className="text-slate-500 font-bold bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">Unassigned</span>}
                                  {row.status === 'Upcoming' && <span className="text-slate-400 font-bold">Upcoming</span>}
                                </td>

                                <td className={`px-5 py-3.5 text-right whitespace-nowrap font-black text-sm ${isRowPaid ? 'text-[#359b46]' : 'text-[#0a1e3f]'}`}>
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
              </div>
            </div>

            {/* RIGHT COLUMN: YOUR PROPERTIES INVENTORY */}
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col lg:h-full order-1 lg:order-2">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-5 flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden w-full">
                <h3 className="font-black text-[#0a1e3f] text-base mb-4 shrink-0 uppercase tracking-widest px-2 flex items-center gap-2">
                  <Home size={16} className="text-[#359b46] shrink-0"/> Your Properties <span className="text-slate-300 font-medium text-sm ml-auto bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{sortedUnits.length}</span>
                </h3>
                
                {/* Inventory List container with scroll limit */}
                <div className="max-h-[350px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto custom-scrollbar pr-2 w-full">
                  <div className="space-y-3 pb-4 w-full">
                    {sortedUnits.map((unit: any) => {
                      const status = localStatuses[unit.id];
                      const isSelected = selectedUnit?.id === unit.id;
                      
                      return (
                        <div 
                          key={unit.id} 
                          onClick={() => setSelectedUnit(unit)}
                          className={`w-full cursor-pointer p-4 rounded-2xl transition-all border ${
                            isSelected 
                              ? 'bg-[#359b46] border-[#359b46] shadow-[0_4px_15px_rgba(53,155,70,0.3)]' 
                              : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1.5 gap-2 overflow-hidden w-full">
                            <span className={`flex-1 min-w-0 block truncate font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#0a1e3f]'}`}>
                              {unit.property_name} {unit.unit_number}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2">
                            <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                              Tenant: {unit.status === 'Vacant' ? 'Vacant' : unit.tenant_name || '—'}
                            </span>
                            
                            <div className="shrink-0 flex items-center justify-end">
                              {status === 'Paid' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>Paid</span>}
                              {status === 'Overdue' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>Overdue</span>}
                              {status === 'Pending' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>Pending</span>}
                              {status === 'Sent' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>Sent</span>}
                              {(!status || status === 'Pending' && !allSoaConfigs[unit.id]) && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>Unassigned</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
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
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-[#359b46]"></div>
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
                {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number} - total <span className="font-black text-[#0a1e3f]">₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
                {isSimulating ? <span className="animate-pulse">Processing...</span> : "I've paid, submit receipt"} <ArrowRight size={16} strokeWidth={2.5} className={isSimulating ? "hidden" : "block"} />
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
    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600"><Receipt size={18} /></div>
        <div>
          <h4 className="font-bold text-[#0a1e3f] text-sm truncate max-w-[180px] sm:max-w-[220px]">{title}</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{method} • {date}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[#0a1e3f] text-sm">{amount}</p>
        <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wide">{status}</p>
      </div>
    </div>
  );
}