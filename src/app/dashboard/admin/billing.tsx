"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Calculator, CalendarClock, Download, Send, CreditCard, CheckCircle, Clock, ChevronLeft } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database & UI States
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [allSoaConfigs, setAllSoaConfigs] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  
  // Mobile Master-Detail State
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  
  // Global Computation Settings
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0,
    water: 0,
    electricity: 0,
    parking: 0,
    penaltyType: 'percent',
    penaltyValue: 3,
    collectionDay: 1,
    gracePeriod: 15,
    bankName: '',
    bankAccountName: '',
    bankAccountNumber: ''
  });

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); 
  const [paymentModalParty, setPaymentModalParty] = useState<'owner' | 'tenant' | null>(null);
  const [isComputationModalOpen, setIsComputationModalOpen] = useState(false);
  const [isSOAModalOpen, setIsSOAModalOpen] = useState(false);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSendingSOA, setIsSendingSOA] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false); 

  // Payment Fetch States
  const [fetchedPayment, setFetchedPayment] = useState<any>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);

  // SOA Assignment States
  const [soaConfig, setSoaConfig] = useState({
    owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
    tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
  });

  // Computation Form States
  const [compDuesRate, setCompDuesRate] = useState("");
  const [compWater, setCompWater] = useState("");
  const [compElec, setCompElec] = useState("");
  const [compParking, setCompParking] = useState("");
  const [compPenaltyType, setCompPenaltyType] = useState("percent");
  const [compPenaltyValue, setCompPenaltyValue] = useState("");
  const [compCollectionDay, setCompCollectionDay] = useState(""); 
  const [compGracePeriod, setCompGracePeriod] = useState(""); 
  const [compBankName, setCompBankName] = useState("");
  const [compBankAccountName, setCompBankAccountName] = useState("");
  const [compBankAccountNumber, setCompBankAccountNumber] = useState("");

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchBillingConfig();
      fetchAllUnits();
    }
  }, [orgData?.admin_email]);

  useEffect(() => {
    if (isPaymentModalOpen && paymentModalParty && selectedUnit) {
      const fetchPayment = async () => {
        setIsFetchingPayment(true);
        const { data, error } = await supabase
          .from('soa')
          .select('owner_payment_method, owner_reference_number, tenant_payment_method, tenant_reference_number')
          .eq('unit_id', selectedUnit.id)
          .single();
        
        if (data && !error) {
          const method = paymentModalParty === 'owner' ? data.owner_payment_method : data.tenant_payment_method;
          const ref = paymentModalParty === 'owner' ? data.owner_reference_number : data.tenant_reference_number;
          
          if (method) {
            setFetchedPayment({
              payment_method: method,
              reference_number: ref,
            });
          } else {
            setFetchedPayment(null);
          }
        } else {
          setFetchedPayment(null);
        }
        setIsFetchingPayment(false);
      };
      fetchPayment();
    } else {
      setFetchedPayment(null);
    }
  }, [isPaymentModalOpen, paymentModalParty, selectedUnit]);

  const fetchBillingConfig = async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days, bank_name, bank_account_name, bank_account_number')
      .eq('admin_email', orgData.admin_email)
      .single();

    if (data && !error) {
      setGlobalComp({
        duesRate: data.dues_rate || 0,
        water: data.default_water || 0,
        electricity: data.default_electricity || 0,
        parking: data.default_parking || 0,
        penaltyType: data.penalty_type || 'percent',
        penaltyValue: data.penalty_value || 0,
        collectionDay: data.collection_day || 1,
        gracePeriod: data.grace_period_days || 15,
        bankName: data.bank_name || '',
        bankAccountName: data.bank_account_name || '',
        bankAccountNumber: data.bank_account_number || ''
      });
    }
  };

  const fetchAllUnits = async () => {
    setIsLoading(true);
    
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email); 

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      setIsLoading(false);
      return;
    }

    if (unitsData && unitsData.length > 0) {
      const sortedData = unitsData.sort((a, b) => {
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

      setAllUnits(sortedData);
      
      // ✨ FIX: Wag i-auto select ang unang unit kapag nasa mobile view para malinis ang listahan
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedUnit(sortedData[0]); 
      } else {
        setSelectedUnit(null);
      }
      
      const statuses: Record<string, string> = {};
      sortedData.forEach((u) => {
        statuses[u.id] = u.payment_status || 'Pending';
      });
      setLocalStatuses(statuses);

      const unitIds = sortedData.map(u => u.id);
      const { data: soaData, error: soaError } = await supabase
        .from('soa')
        .select('*')
        .in('unit_id', unitIds);

      if (!soaError && soaData) {
        const soaMap: Record<string, any> = {};
        soaData.forEach(row => {
          soaMap[row.unit_id] = row;
        });
        setAllSoaConfigs(soaMap);
      }
    }
    setIsLoading(false);
  };

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const isOwnerVacant = !selectedUnit?.owner_name || selectedUnit?.owner_name === '—';
  const isTenantVacant = selectedUnit?.status === 'Vacant' || !selectedUnit?.tenant_name || selectedUnit?.tenant_name === '—';
  const unitArea = getUnitAreaValue(selectedUnit?.unit_area);
  
  const currentSoa = selectedUnit ? allSoaConfigs[selectedUnit.id] : null;
  const isAssigned = !!currentSoa; 
  const ownerStatus = currentSoa?.owner_status || 'Pending';
  const tenantStatus = currentSoa?.tenant_status || 'Pending';
  
  const rawDues = globalComp.duesRate * unitArea;
  const rawWater = globalComp.water;
  const rawElectricity = globalComp.electricity;
  const rawParking = globalComp.parking;

  const activeConfig = currentSoa ? {
    owner: { dues: currentSoa.owner_dues, parking: currentSoa.owner_parking, water: currentSoa.owner_water, electricity: currentSoa.owner_electricity, penalty: currentSoa.owner_penalty },
    tenant: { dues: currentSoa.tenant_dues, parking: currentSoa.tenant_parking, water: currentSoa.tenant_water, electricity: currentSoa.tenant_electricity, penalty: currentSoa.tenant_penalty }
  } : {
    owner: { dues: true, parking: true, water: isTenantVacant, electricity: isTenantVacant, penalty: false },
    tenant: { dues: false, parking: false, water: !isTenantVacant, electricity: !isTenantVacant, penalty: !isTenantVacant && tenantStatus === 'Overdue' }
  };

  const ownerBase = 
    (activeConfig.owner.dues ? rawDues : 0) + 
    (activeConfig.owner.parking ? rawParking : 0) + 
    (activeConfig.owner.water ? rawWater : 0) + 
    (activeConfig.owner.electricity ? rawElectricity : 0);

  const tenantBase = 
    (activeConfig.tenant.dues ? rawDues : 0) + 
    (activeConfig.tenant.parking ? rawParking : 0) + 
    (!isTenantVacant && activeConfig.tenant.water ? rawWater : 0) + 
    (!isTenantVacant && activeConfig.tenant.electricity ? rawElectricity : 0);

  let ownerPenalty = 0;
  if (ownerStatus === 'Overdue' && activeConfig.owner.penalty && !isOwnerVacant) {
    ownerPenalty = globalComp.penaltyType === 'percent' ? ownerBase * (globalComp.penaltyValue / 100) : globalComp.penaltyValue;
  }

  let tenantPenalty = 0;
  if (tenantStatus === 'Overdue' && activeConfig.tenant.penalty && !isTenantVacant) {
    tenantPenalty = globalComp.penaltyType === 'percent' ? tenantBase * (globalComp.penaltyValue / 100) : globalComp.penaltyValue;
  }

  const ownerTotalDue = ownerBase + ownerPenalty;
  const tenantTotalDue = tenantBase + tenantPenalty;
  const totalDue = ownerTotalDue + tenantTotalDue;

  const openComputationModal = () => {
    setCompDuesRate(globalComp.duesRate ? String(globalComp.duesRate) : "");
    setCompWater(globalComp.water ? String(globalComp.water) : "");
    setCompElec(globalComp.electricity ? String(globalComp.electricity) : "");
    setCompParking(globalComp.parking ? String(globalComp.parking) : "");
    setCompPenaltyType(globalComp.penaltyType);
    setCompPenaltyValue(globalComp.penaltyValue ? String(globalComp.penaltyValue) : "");
    setCompCollectionDay(String(globalComp.collectionDay));
    setCompGracePeriod(String(globalComp.gracePeriod));
    setCompBankName(globalComp.bankName);
    setCompBankAccountName(globalComp.bankAccountName);
    setCompBankAccountNumber(globalComp.bankAccountNumber);
    setIsComputationModalOpen(true);
  };

  const openSOAModal = () => {
    if (isAssigned) {
      setSoaConfig(activeConfig);
    } else {
      setSoaConfig({
        owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
        tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
      });
    }
    setIsSOAModalOpen(true);
  };

  const handleToggleSoa = (party: 'owner' | 'tenant', item: keyof typeof soaConfig.owner, value: boolean) => {
    setSoaConfig(prev => {
      const otherParty = party === 'owner' ? 'tenant' : 'owner';
      const newConfig = {
        ...prev,
        [party]: { ...prev[party], [item]: value }
      };

      if (value) {
        newConfig[otherParty] = { ...newConfig[otherParty], [item]: false };
      }
      return newConfig;
    });
  };

  const saveSoaToDatabase = async (statusOverride?: string) => {
    const existing = allSoaConfigs[selectedUnit.id];
    
    const payload: any = {
      unit_id: selectedUnit.id,
      owner_dues: soaConfig.owner.dues,
      owner_parking: soaConfig.owner.parking,
      owner_water: soaConfig.owner.water,
      owner_electricity: soaConfig.owner.electricity,
      owner_penalty: soaConfig.owner.penalty,
      tenant_dues: soaConfig.tenant.dues,
      tenant_parking: soaConfig.tenant.parking,
      tenant_water: soaConfig.tenant.water,
      tenant_electricity: soaConfig.tenant.electricity,
      tenant_penalty: soaConfig.tenant.penalty,
    };

    if (statusOverride === 'Sent') {
      if (!isOwnerVacant) payload.owner_status = 'Sent';
      if (!isTenantVacant) payload.tenant_status = 'Sent';
    }

    if (existing?.id) {
      payload.id = existing.id;
    }

    const { error } = await supabase
      .from('soa')
      .upsert(payload);

    if (error) {
      console.error("Supabase Database Error:", error);
      throw error;
    }
    
    setAllSoaConfigs(prev => ({ ...prev, [selectedUnit.id]: { ...existing, ...payload } }));
  };

  const handleSaveDefaultSOA = async () => {
    setIsSavingDefault(true);
    try {
      await saveSoaToDatabase();
      setIsSOAModalOpen(false);
    } catch (err) {
      console.error("Failed to save default SOA:", err);
      alert("There was an error saving the default SOA configuration.");
    } finally {
      setIsSavingDefault(false);
    }
  };

  const handleSendSOA = async () => {
    setIsSendingSOA(true);
    try {
      await saveSoaToDatabase('Sent');
      setIsSOAModalOpen(false);
    } catch (err) {
      console.error("Failed to send SOA:", err);
      alert("There was an error saving the SOA configuration.");
    } finally {
      setIsSendingSOA(false);
    }
  };

  const handleSaveComputation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      dues_rate: parseFloat(compDuesRate) || 0,
      default_water: parseFloat(compWater) || 0,
      default_electricity: parseFloat(compElec) || 0,
      default_parking: parseFloat(compParking) || 0,
      penalty_type: compPenaltyType,
      penalty_value: parseFloat(compPenaltyValue) || 0,
      collection_day: parseInt(compCollectionDay) || 1,
      grace_period_days: parseInt(compGracePeriod) || 15,
      bank_name: compBankName,
      bank_account_name: compBankAccountName,
      bank_account_number: compBankAccountNumber
    };

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('admin_email', orgData.admin_email)
        .select();

      if (error) throw error;

      setGlobalComp({
        duesRate: payload.dues_rate,
        water: payload.default_water,
        electricity: payload.default_electricity,
        parking: payload.default_parking,
        penaltyType: payload.penalty_type,
        penaltyValue: payload.penalty_value,
        collectionDay: payload.collection_day,
        gracePeriod: payload.grace_period_days,
        bankName: payload.bank_name || '',
        bankAccountName: payload.bank_account_name || '',
        bankAccountNumber: payload.bank_account_number || ''
      });

      setIsComputationModalOpen(false);
    } catch (err: any) {
      console.error("Failed to update global computation:", err);
      alert(`${err.message}`);
    }
  };

  const generateLedgerMonths = () => {
    const months = [];
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      let stat = "Upcoming";
      if (i < currentMonthIndex) {
        stat = "Paid"; 
      } else if (i === currentMonthIndex) {
        if (ownerStatus === 'Overdue' || (!isTenantVacant && tenantStatus === 'Overdue')) stat = 'Overdue';
        else if (ownerStatus === 'Paid' && (isTenantVacant || tenantStatus === 'Paid')) stat = 'Paid';
        else stat = 'Pending';
      }
      
      const dueDate = `${monthName} ${globalComp.collectionDay}, ${currentYear}`;
      
      months.push({
        monthName: monthName,
        year: currentYear,
        dueDate: dueDate,
        status: stat,
        isCurrentMonth: i === currentMonthIndex
      });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleExportCSV = () => {
    if (!selectedUnit || ledgerData.length === 0) return;

    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    
    const rows = ledgerData.map(row => {
      const isOverdue = row.status === 'Overdue';
      const rowPenalty = isOverdue ? (ownerPenalty + tenantPenalty) : 0;
      const rowTotal = isOverdue ? totalDue : (ownerBase + tenantBase);

      return [
        `"${row.monthName} ${row.year}"`,
        `"${row.dueDate}"`,
        rawDues,
        rawParking,
        (rawWater + rawElectricity),
        rowPenalty,
        `"${row.status}"`,
        rowTotal
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const currentYear = new Date().getFullYear();
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedUnit.property_name.replace(/\s+/g, '_')}_Unit_${selectedUnit.unit_number}_Ledger_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmPayment = async () => {
    if (!paymentModalParty || !selectedUnit) return;
    setIsSimulating(true);
    
    try {
      const updateField = paymentModalParty === 'owner' ? { owner_status: 'Paid' } : { tenant_status: 'Paid' };
      await supabase.from('soa').update(updateField).eq('unit_id', selectedUnit.id);
      
      setAllSoaConfigs(prev => ({
        ...prev,
        [selectedUnit.id]: { ...prev[selectedUnit.id], ...updateField }
      }));
    } catch (err) {
      console.error("Error updating payment status", err);
    } finally {
      setIsSimulating(false);
      setPaymentModalParty(null);
      setIsPaymentModalOpen(false); 
      setFetchedPayment(null);
    }
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";

  const renderStatusBadge = (status: string) => {
    if (status === 'Paid') return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-emerald-100 uppercase tracking-wide shadow-sm shrink-0">Paid</span>;
    if (status === 'Overdue') return <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-red-100 uppercase tracking-wide shadow-sm shrink-0">Overdue</span>;
    if (status === 'Sent') return <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-blue-100 uppercase tracking-wide shadow-sm shrink-0">Sent</span>;
    return <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-amber-100 uppercase tracking-wide shadow-sm shrink-0">Pending</span>;
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#f4f7f9] font-sans z-20 overflow-hidden">
      
      {/* TOP HEADER - Premium Glassmorphism */}
      <div className="shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 sm:py-5 z-20 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 max-w-[1600px] mx-auto w-full">
          <div className="w-full sm:w-auto flex justify-between items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight">Billing & payments</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium truncate">SOA, collection and owner remittance</p>
            </div>
            {/* Mobile Profile Icon */}
            <div className="sm:hidden w-9 h-9 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 text-[#359b46] flex items-center justify-center font-black text-xs border border-emerald-200 shadow-sm shrink-0">{initials}</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto mt-1 sm:mt-0">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search units, tenants..." className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-xl border border-slate-200/80 text-[13px] sm:text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] bg-slate-50 transition-all shadow-inner" />
            </div>
            <div className="hidden sm:flex items-center gap-3 pl-2 border-l border-slate-200 shrink-0">
              <span className="text-sm font-bold text-[#359b46]">Admin</span>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 text-[#359b46] flex items-center justify-center font-black text-sm border border-emerald-200 shadow-sm">{initials}</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE - Mobile Master-Detail App Pattern */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto w-full relative">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-wider gap-3">
            <Clock size={24} className="animate-spin text-[#359b46]" /> Loading billing data...
          </div>
        ) : allUnits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-200/60 p-10 sm:p-12 text-center max-w-md w-full">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-slate-100 shadow-inner">
                <CreditCard size={28} className="text-slate-300 sm:w-8 sm:h-8" />
              </div>
              <p className="text-slate-700 font-black text-lg sm:text-xl tracking-tight">No units found</p>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Add units to your property to manage billing.</p>
            </div>
          </div>
        ) : (
          <>
            {/* SIDEBAR (All Units) - Shows on Mobile if isMobileListVisible is true */}
            <div className={`w-full md:w-[320px] lg:w-[360px] shrink-0 bg-white border-r border-slate-200/60 flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              <div className="p-3 sm:p-5 border-b border-slate-100 shrink-0 bg-white flex justify-between items-center">
                <h3 className="font-black text-[#0a1e3f] text-[12px] sm:text-[13px] uppercase tracking-wider">Property Units</h3>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-2 sm:px-2.5 py-1 rounded-lg shadow-sm">{allUnits.length} Total</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3 space-y-1 bg-slate-50/30">
                {allUnits.map((unit) => {
                  const isSelected = selectedUnit?.id === unit.id;
                  const isRowOwnerVacant = !unit.owner_name || unit.owner_name === '—';
                  const isRowTenantVacant = unit.status === 'Vacant' || !unit.tenant_name || unit.tenant_name === '—';
                  
                  const rowSoa = allSoaConfigs[unit.id];
                  const rOwnerStat = rowSoa?.owner_status || 'Pending';
                  const rTenantStat = rowSoa?.tenant_status || 'Pending';
                  
                  return (
                    <div 
                      key={unit.id} 
                      onClick={() => {
                        setSelectedUnit(unit);
                        setIsMobileListVisible(false); // Hide list on mobile when clicked
                      }}
                      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-200 group border ${isSelected ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 shadow-sm shadow-emerald-500/5' : 'bg-white border-transparent hover:border-slate-200/60 hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)]'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[13px] sm:text-[14px] truncate tracking-tight ${isSelected ? 'font-black text-[#2a7a37]' : 'font-bold text-slate-700'}`}>
                          {unit.property_name} {unit.unit_number}
                        </h4>
                        <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-1">
                          <span className="font-bold text-slate-400">O:</span> {isRowOwnerVacant ? 'Vacant' : unit.owner_name} 
                          {!isRowTenantVacant && <span className="ml-1.5"><span className="font-bold text-slate-400">T:</span> {unit.tenant_name}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        {isRowOwnerVacant && isRowTenantVacant ? (
                          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">
                            VACANT
                          </span>
                        ) : (
                          <>
                            {!isRowOwnerVacant && (
                              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${rOwnerStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rOwnerStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                O: {rOwnerStat}
                              </span>
                            )}
                            {!isRowTenantVacant && (
                              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border shadow-sm shrink-0 ${rTenantStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rTenantStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                T: {rTenantStat}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* MAIN DETAILS (Unit Breakdown & Ledger) - Shows on Mobile if list is hidden */}
           <div className={`flex-1 flex-col overflow-hidden bg-[#f4f7f9] relative ${!isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              {/* ✨ FIX: Empty State Check - Ipapakita kapag walang naka-select na unit */}
              {!selectedUnit ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                    <Search size={28} className="text-slate-300 sm:w-8 sm:h-8" />
                  </div>
                  <p className="text-slate-700 font-black text-lg sm:text-xl tracking-tight">No unit selected</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Choose a unit from the sidebar to view billing details.</p>
                </div>
              ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                
                {/* ✨ FIX: NEW UNIT DETAILS CARD (Stacked on Mobile, Columns on Desktop) */}
                <div className="bg-white rounded-[1.5rem] sm:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-800 overflow-hidden mb-4 sm:mb-6">
                  
                  {/* Top Header - Property Name & Back Button */}
                  <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-5 flex items-center justify-between gap-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <button 
                        onClick={() => setIsMobileListVisible(true)}
                        className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors active:scale-95 shrink-0"
                      >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                      </button>
                      <h3 className="font-extrabold text-[#0a1e3f] text-base sm:text-xl tracking-tight leading-tight whitespace-normal break-words">
                        {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                      </h3>
                    </div>
                    {isOwnerVacant && isTenantVacant && (
                      <span className="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-slate-200 uppercase tracking-wide shadow-sm shrink-0">
                        Vacant
                      </span>
                    )}
                  </div>

                  {/* Split Breakdown - Flex Col on Mobile / Grid 2 Columns on Desktop */}
                  <div className={`grid grid-cols-1 ${!isTenantVacant ? 'lg:grid-cols-2 lg:divide-x lg:divide-slate-800' : ''}`}>
                    
                    {/* OWNER COLUMN */}
                    <div className="p-4 sm:p-6 md:p-8 relative flex flex-col">
                       <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-400 flex justify-between items-start gap-3">
                           <div className="min-w-0">
                               <h4 className="font-black text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Owner</h4>
                               <p className="font-bold text-[#0a1e3f] text-[13px] sm:text-base truncate">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                           </div>
                           {!isOwnerVacant && renderStatusBadge(ownerStatus)}
                       </div>

                       <h5 className="font-black text-[#0a1e3f] text-[10px] sm:text-[11px] uppercase tracking-widest mb-3 sm:mb-4 opacity-50 truncate">
                          {isOwnerVacant && isTenantVacant ? 'Base Unit Charges' : 'Assigned to Owner'}
                       </h5>

                       <div className="space-y-3 sm:space-y-3.5 flex-1">
                          {isAssigned ? (
                            <>
                              {activeConfig.owner.dues && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Assoc. dues</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.parking && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Parking</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.water && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Water</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.electricity && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Electricity</span><span className="font-bold text-[#0a1e3f] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.penalty && ownerPenalty > 0 && !isOwnerVacant && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-500 font-bold truncate">Late Penalty</span><span className="font-black text-red-600 shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {ownerTotalDue === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic">No assigned balances.</p>}
                            </>
                          ) : (
                            <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">Pending SOA assignment.</p>
                          )}
                       </div>
                       
                       <div className="mt-5 sm:mt-6 pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-50/80 -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 lg:rounded-bl-3xl">
                           <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Subtotal</span>
                           <span className="font-black text-[#0a1e3f] text-sm sm:text-lg shrink-0">
                             {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                           </span>
                       </div>
                    </div>

                    {/* TENANT COLUMN */}
                    {!isTenantVacant && (
                       <div className="p-4 sm:p-6 md:p-8 bg-slate-50/30 relative flex flex-col border-t lg:border-t-0 border-slate-800 lg:rounded-br-3xl">
                           <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-400 flex justify-between items-start gap-3">
                               <div className="min-w-0">
                                   <h4 className="font-black text-[#1d82f5] text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Tenant</h4>
                                   <p className="font-bold text-slate-800 text-[13px] sm:text-base truncate">{selectedUnit?.tenant_name}</p>
                               </div>
                               {renderStatusBadge(tenantStatus)}
                           </div>

                           <h5 className="font-black text-[#1d82f5] text-[10px] sm:text-[11px] uppercase tracking-widest mb-3 sm:mb-4 opacity-60 truncate">
                              Assigned to Tenant
                           </h5>

                           <div className="space-y-3 sm:space-y-3.5 flex-1">
                              {isAssigned ? (
                                <>
                                  {activeConfig.tenant.dues && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Assoc. dues</span><span className="font-bold text-slate-800 shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.parking && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Parking</span><span className="font-bold text-slate-800 shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.water && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Water</span><span className="font-bold text-slate-800 shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.electricity && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-slate-500 font-medium truncate">Electricity</span><span className="font-bold text-slate-800 shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.penalty && tenantPenalty > 0 && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-400 font-bold truncate">Late Penalty</span><span className="font-black text-red-500 shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {tenantTotalDue === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic">No assigned balances.</p>}
                                </>
                              ) : (
                                <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">Pending SOA assignment.</p>
                              )}
                           </div>

                           <div className="mt-5 sm:mt-6 pt-4 border-t border-blue-200 flex justify-between items-center bg-blue-50/40 -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 lg:rounded-br-3xl">
                               <span className="text-[10px] sm:text-[11px] font-black text-[#1d82f5]/70 uppercase tracking-widest shrink-0">Subtotal</span>
                               <span className="font-black text-[#1d82f5] text-sm sm:text-lg shrink-0">
                                 {isAssigned ? `₱${tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                               </span>
                           </div>
                       </div>
                    )}
                  </div>
                </div>

                {/* Total Hero Card */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 sm:mb-8 bg-gradient-to-r from-[#0a1e3f] to-[#163666] p-4 sm:p-6 rounded-[1.25rem] sm:rounded-3xl shadow-lg shadow-blue-900/10 w-full overflow-hidden">
                  <div className="min-w-0">
                    <span className="font-bold text-blue-200 text-[11px] sm:text-xs uppercase tracking-widest truncate block">Total Amount Due</span>
                    {!isTenantVacant && <div className="text-[9px] sm:text-[10px] font-medium text-blue-300 mt-1 opacity-80 truncate block">Combined Property Balance</div>}
                  </div>
                  <span className="font-black text-white text-2xl sm:text-3xl md:text-4xl tracking-tight break-all sm:break-normal shrink-0">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 w-full mb-6">
                  {isAssigned && ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant && (
                    <button 
                      onClick={() => { setPaymentModalParty('owner'); setIsPaymentModalOpen(true); }}
                      className="w-full justify-center sm:w-auto bg-gradient-to-b from-[#359b46] to-[#2a7a37] text-white px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-bold shadow-[0_4px_10px_rgba(53,155,70,0.2)] hover:shadow-[0_6px_15px_rgba(53,155,70,0.3)] transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                    >
                      <CreditCard className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Owner Pay</span>
                    </button>
                  )}
                  {isAssigned && !isTenantVacant && tenantTotalDue > 0 && tenantStatus !== 'Paid' && (
                    <button 
                      onClick={() => { setPaymentModalParty('tenant'); setIsPaymentModalOpen(true); }}
                      className="w-full justify-center sm:w-auto bg-gradient-to-b from-[#1d82f5] to-[#1565c0] text-white px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-bold shadow-[0_4px_10px_rgba(29,130,245,0.2)] hover:shadow-[0_6px_15px_rgba(29,130,245,0.3)] transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                    >
                      <CreditCard className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Tenant Pay</span>
                    </button>
                  )}

                  <button 
                    onClick={openComputationModal}
                    className="w-full justify-center sm:w-auto bg-white border border-[#1d82f5]/30 hover:border-[#1d82f5]/60 hover:bg-blue-50 text-[#1d82f5] px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Calculator className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Config</span>
                  </button>
                  
                  <button 
                    onClick={openSOAModal}
                    className="w-full justify-center sm:w-auto bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-2 sm:px-5 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Send className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Assign SOA</span>
                  </button>
                </div>

                {/* COMBINED LEDGER TABLE */}
                <div className="bg-white rounded-[1.5rem] sm:rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 p-4 sm:p-5 md:p-8 overflow-hidden mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-6 gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
                        <CalendarClock size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[#0a1e3f] text-base sm:text-lg tracking-tight truncate">Ledger & Projections</h4>
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
                  
                  <div className="overflow-x-auto border border-slate-200/80 rounded-2xl relative shadow-inner">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">PERIOD</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">DUE DATE</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">DUES</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">PARKING</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">UTILITIES</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap text-red-500 border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">
                            PENALTY
                          </th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] uppercase tracking-wider">STATUS {isTenantVacant ? '' : '(O/T)'}</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 text-right whitespace-nowrap font-black text-[#0a1e3f] text-[10px] sm:text-[11px] uppercase tracking-wider">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {ledgerData.map((row, idx) => {
                          const isOverdue = row.status === 'Overdue';
                          const activeRow = row.isCurrentMonth;
                          
                          return (
                            <tr key={idx} className={`transition-colors ${activeRow ? "bg-emerald-50/30 hover:bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-bold uppercase text-[10px] sm:text-[11px] tracking-wide ${activeRow ? 'text-[#359b46]' : 'text-slate-700'}`}>
                                {row.monthName} {row.year} {activeRow && <span className="ml-1 text-lg leading-none align-middle">•</span>}
                              </td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 text-slate-500 font-medium text-xs sm:text-sm">{row.dueDate}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-xs sm:text-sm">{rawDues > 0 ? `₱${rawDues.toLocaleString()}` : "—"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-xs sm:text-sm">{rawParking > 0 ? `₱${rawParking.toLocaleString()}` : "—"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-medium text-xs sm:text-sm">{(!isTenantVacant && (rawWater + rawElectricity) > 0) ? `₱${(rawWater + rawElectricity).toLocaleString()}` : "—"}</td>
                              
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-bold text-xs sm:text-sm ${isOverdue ? 'text-red-500 bg-red-50/50' : 'text-slate-400'}`}>
                                {isOverdue && (ownerPenalty + tenantPenalty) > 0 ? `₱${(ownerPenalty + tenantPenalty).toLocaleString()}` : "—"}
                              </td>
                              
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-slate-100 font-bold text-[10px] sm:text-[11px] tracking-wider uppercase">
                                {row.isCurrentMonth ? (
                                  isOwnerVacant && isTenantVacant ? (
                                     <span className="text-slate-400">VACANT</span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {!isOwnerVacant && <span>O: <span className={ownerStatus === 'Paid' ? 'text-emerald-500' : ownerStatus === 'Overdue' ? 'text-red-500' : 'text-amber-500'}>{ownerStatus}</span></span>}
                                      {!isTenantVacant && <span>T: <span className={tenantStatus === 'Paid' ? 'text-emerald-500' : tenantStatus === 'Overdue' ? 'text-red-500' : 'text-amber-500'}>{tenantStatus}</span></span>}
                                    </div>
                                  )
                                ) : (
                                  <span className={row.status === 'Paid' ? 'text-emerald-500' : 'text-slate-400'}>{row.status}</span>
                                )}
                              </td>

                              <td className="px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-black text-[#0a1e3f] text-[13px] sm:text-sm">
                                ₱{(isOverdue ? totalDue : (ownerBase + tenantBase)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
              )} {/* ✨ FIX: Dito isasara yung !selectedUnit ternary operator */}
            </div>
          </>
        )}
      </div>

      {/* COMPUTATION MODAL (Global) */}
      {isComputationModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto custom-scrollbar transform transition-all border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-[#1d82f5] flex items-center justify-center border border-blue-100 shrink-0">
                  <Calculator size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] tracking-tight truncate">Billing Configuration</h2>
              </div>
              <button onClick={() => setIsComputationModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0">
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 sm:p-8">
              <form onSubmit={handleSaveComputation} className="space-y-5 sm:space-y-6">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pb-5 border-b border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Collection Start Day</label>
                    <input type="number" min="1" max="31" placeholder="e.g. 1" value={compCollectionDay} onChange={(e) => setCompCollectionDay(e.target.value)} className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 font-medium">Day of the month (1-31)</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Grace Period (Days)</label>
                    <input type="number" min="0" placeholder="e.g. 15" value={compGracePeriod} onChange={(e) => setCompGracePeriod(e.target.value)} className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 font-medium">Days before penalty hits</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Assoc. Dues (sqm)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={compDuesRate} onChange={(e) => setCompDuesRate(e.target.value)} className="w-full pl-8 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Parking Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={compParking} onChange={(e) => setCompParking(e.target.value)} className="w-full pl-8 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Water Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={compWater} onChange={(e) => setCompWater(e.target.value)} className="w-full pl-8 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2 truncate">Elec. Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={compElec} onChange={(e) => setCompElec(e.target.value)} className="w-full pl-8 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <label className="block text-[11px] font-bold text-red-500 uppercase tracking-wider mb-2 truncate">Late Penalty Deduction</label>
                  <div className="flex gap-2">
                    <select value={compPenaltyType} onChange={(e) => setCompPenaltyType(e.target.value)} className="w-[100px] shrink-0 px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-2 focus:ring-red-400/20 focus:border-red-400 text-[12px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={compPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={compPenaltyValue} onChange={(e) => setCompPenaltyValue(e.target.value)} className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-2 focus:ring-red-400/20 focus:border-red-400 text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm" />
                  </div>
                </div>

                {/* Bank Transfer Details Section */}
                <div className="border border-blue-100 bg-blue-50/30 p-4 sm:p-5 rounded-2xl mt-5 sm:mt-6">
                  <label className="block text-[13px] sm:text-sm font-black text-[#0a1e3f] mb-1.5 sm:mb-2 tracking-tight truncate">Bank Transfer Details</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-4 sm:mb-5 font-medium leading-relaxed">
                    Set up your organization's bank details here. These will be securely displayed to owners and tenants when they select "Bank Transfer" during payment.
                  </p>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 truncate">Bank Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. BDO Unibank" 
                        value={compBankName} 
                        onChange={(e) => setCompBankName(e.target.value)} 
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[12px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm bg-white" 
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 truncate">Account Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. HOA Admin" 
                          value={compBankAccountName} 
                          onChange={(e) => setCompBankAccountName(e.target.value)} 
                          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[12px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 truncate">Account Number</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 0012-3456" 
                          value={compBankAccountNumber} 
                          onChange={(e) => setCompBankAccountNumber(e.target.value)} 
                          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] text-[12px] sm:text-sm font-bold text-slate-700 transition-all shadow-sm bg-white" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 sm:mt-8 flex gap-2 sm:gap-3 pt-5 sm:pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setIsComputationModalOpen(false)} className="w-[100px] shrink-0 py-3 sm:py-3.5 text-[12px] sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-95">Cancel</button>
                  <button type="submit" className="flex-1 min-w-0 bg-gradient-to-b from-[#1d82f5] to-[#1565c0] hover:shadow-[0_4px_15px_rgba(29,130,245,0.3)] text-white py-3 sm:py-3.5 rounded-xl text-[12px] sm:text-sm font-bold shadow-[0_2px_8px_rgba(29,130,245,0.2)] transition-all active:scale-95 truncate px-2">Save Global Settings</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SOA MODAL (Per Unit Setup with Two Columns) */}
      {isSOAModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto custom-scrollbar transform transition-all border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white/90 backdrop-blur-md">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 text-[#1d82f5] flex items-center justify-center border border-blue-100 shrink-0">
                  <Send size={16} className="translate-x-[-1px] translate-y-[1px] sm:w-[18px] sm:h-[18px]" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] tracking-tight truncate">Assign Balances <span className="text-slate-400 font-medium ml-1 hidden sm:inline">· Unit {selectedUnit?.unit_number}</span></h2>
              </div>
              <button onClick={() => setIsSOAModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSendingSOA || isSavingDefault}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-8">
              <p className="text-[11px] sm:text-[13px] text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100">
                {isTenantVacant ? "Assign balances to the owner for this unit. Settings will be saved automatically when setting defaults." : "Checking a box for one party will automatically lock it out for the other party. To swap assignments, uncheck the item first."}
              </p>
              
              <div className={`grid grid-cols-1 ${!isTenantVacant ? 'sm:grid-cols-2 sm:divide-x sm:divide-slate-200' : ''} border border-slate-200 rounded-[1.25rem] sm:rounded-2xl overflow-hidden mb-6 sm:mb-8 shadow-sm`}>
                
                {/* OWNER COLUMN */}
                <div className="p-4 sm:p-5 bg-white relative flex flex-col">
                  <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-100">
                    <h3 className="font-black text-[#0a1e3f] text-[11px] sm:text-xs uppercase tracking-widest truncate">Owner</h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-1 font-medium">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4 flex-1">
                    {rawDues > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.dues && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.dues && !isTenantVacant} checked={soaConfig.owner.dues} onChange={(e) => handleToggleSoa('owner', 'dues', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Assoc. Dues</span>
                        </div>
                        <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {rawParking > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.parking && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.parking && !isTenantVacant} checked={soaConfig.owner.parking} onChange={(e) => handleToggleSoa('owner', 'parking', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Parking</span>
                        </div>
                        <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawWater > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.water} checked={soaConfig.owner.water} onChange={(e) => handleToggleSoa('owner', 'water', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Water</span>
                        </div>
                        <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawElectricity > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.electricity} checked={soaConfig.owner.electricity} onChange={(e) => handleToggleSoa('owner', 'electricity', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Electricity</span>
                        </div>
                        <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {ownerPenalty > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.penalty && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.penalty && !isTenantVacant} checked={soaConfig.owner.penalty} onChange={(e) => handleToggleSoa('owner', 'penalty', e.target.checked)} className="rounded text-red-500 focus:ring-red-500 w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-red-600 transition-colors truncate">Late Penalty</span>
                        </div>
                        <span className="font-black text-red-600 text-[12px] sm:text-[13px] shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                  </div>
                  
                  <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/80 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 sm:py-4 sm:rounded-bl-2xl">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Owner Total</span>
                    <span className="font-black text-[#0a1e3f] text-sm sm:text-base shrink-0">
                      ₱{((soaConfig.owner.dues ? rawDues : 0) + (soaConfig.owner.parking ? rawParking : 0) + (soaConfig.owner.water ? rawWater : 0) + (soaConfig.owner.electricity ? rawElectricity : 0) + (soaConfig.owner.penalty ? ownerPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                {/* TENANT COLUMN (Hidden if Vacant) */}
                {!isTenantVacant && (
                  <div className="p-4 sm:p-5 relative bg-slate-50/30 flex flex-col border-t sm:border-t-0 border-slate-200">
                    <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-200/60">
                      <h3 className="font-black text-[#1d82f5] text-[11px] sm:text-xs uppercase tracking-widest truncate">Tenant</h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-1 font-medium">{selectedUnit?.tenant_name}</p>
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4 flex-1">
                      {rawDues > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.dues ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.dues} checked={soaConfig.tenant.dues} onChange={(e) => handleToggleSoa('tenant', 'dues', e.target.checked)} className="rounded text-[#1d82f5] focus:ring-[#1d82f5] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Assoc. Dues</span>
                          </div>
                          <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {rawParking > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.parking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.parking} checked={soaConfig.tenant.parking} onChange={(e) => handleToggleSoa('tenant', 'parking', e.target.checked)} className="rounded text-[#1d82f5] focus:ring-[#1d82f5] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Parking</span>
                          </div>
                          <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawWater > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.water} checked={soaConfig.tenant.water} onChange={(e) => handleToggleSoa('tenant', 'water', e.target.checked)} className="rounded text-[#1d82f5] focus:ring-[#1d82f5] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Water</span>
                          </div>
                          <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawElectricity > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.electricity} checked={soaConfig.tenant.electricity} onChange={(e) => handleToggleSoa('tenant', 'electricity', e.target.checked)} className="rounded text-[#1d82f5] focus:ring-[#1d82f5] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate">Electricity</span>
                          </div>
                          <span className="font-black text-slate-600 text-[12px] sm:text-[13px] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {tenantPenalty > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.penalty ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.penalty} checked={soaConfig.tenant.penalty} onChange={(e) => handleToggleSoa('tenant', 'penalty', e.target.checked)} className="rounded text-red-500 focus:ring-red-500 w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-red-600 transition-colors truncate">Late Penalty</span>
                          </div>
                          <span className="font-black text-red-600 text-[12px] sm:text-[13px] shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                    </div>

                    <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-blue-100/50 flex justify-between items-center bg-blue-50/40 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 sm:py-4 sm:rounded-br-2xl">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#1d82f5] uppercase tracking-widest shrink-0">Tenant Total</span>
                      <span className="font-black text-[#1d82f5] text-sm sm:text-base shrink-0">
                        ₱{((soaConfig.tenant.dues ? rawDues : 0) + (soaConfig.tenant.parking ? rawParking : 0) + (!isTenantVacant && soaConfig.tenant.water ? rawWater : 0) + (!isTenantVacant && soaConfig.tenant.electricity ? rawElectricity : 0) + (soaConfig.tenant.penalty ? tenantPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setIsSOAModalOpen(false)} 
                  disabled={isSendingSOA || isSavingDefault}
                  className="w-full sm:w-[120px] shrink-0 py-3 sm:py-3.5 text-[12px] sm:text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <div className="flex gap-2.5 sm:gap-3 w-full">
                  <button 
                    onClick={handleSaveDefaultSOA}
                    disabled={isSendingSOA || isSavingDefault}
                    className="flex-1 min-w-0 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3 sm:py-3.5 rounded-xl text-[11px] sm:text-[13px] font-bold shadow-sm transition-colors flex justify-center items-center gap-1.5 sm:gap-2 active:scale-95 truncate px-2"
                  >
                    {isSavingDefault ? "Saving..." : "Save Config Only"}
                  </button>
                  <button 
                    onClick={handleSendSOA}
                    disabled={isSendingSOA || isSavingDefault || (ownerTotalDue === 0 && tenantTotalDue === 0)}
                    className="flex-1 min-w-0 bg-gradient-to-b from-[#1d82f5] to-[#1565c0] hover:shadow-[0_4px_15px_rgba(29,130,245,0.3)] disabled:from-blue-300 disabled:to-blue-300 disabled:shadow-none text-white py-3 sm:py-3.5 rounded-xl text-[11px] sm:text-[13px] font-bold shadow-[0_2px_8px_rgba(29,130,245,0.2)] transition-all flex justify-center items-center gap-1.5 sm:gap-2 active:scale-95 truncate px-2"
                  >
                    {isSendingSOA ? "Sending..." : "Send SOA"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (Specific to Owner or Tenant) */}
      {isPaymentModalOpen && paymentModalParty && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-slate-100" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base sm:text-lg font-black text-[#0a1e3f] capitalize tracking-tight truncate pr-2">{paymentModalParty} Payment Verif.</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSimulating || isFetchingPayment}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8">
              <p className="text-[12px] sm:text-[13px] text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed">
                Please verify the payment details submitted by the <span className="font-black text-[#1d82f5] uppercase tracking-wide">{paymentModalParty}</span> for {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}.
              </p>

              <div className="bg-slate-50 rounded-[1.25rem] sm:rounded-2xl p-4 sm:p-5 border border-slate-200/60 mb-6 sm:mb-8 shadow-inner">
                <div className="flex justify-between items-center mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-slate-200/80 gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Amount Due</span>
                  <span className="font-black text-[#0a1e3f] text-lg sm:text-xl tracking-tight shrink-0">
                    ₱{(paymentModalParty === 'owner' ? ownerTotalDue : tenantTotalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
                
                {isFetchingPayment ? (
                  <div className="py-3 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Fetching submitted details...
                  </div>
                ) : fetchedPayment ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Method Used</span>
                      <span className="text-[10px] sm:text-[11px] font-black text-[#1d82f5] bg-blue-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-blue-100 shadow-sm shrink-0">
                        {fetchedPayment?.payment_method || 'Unknown'}
                      </span>
                    </div>
                    
                    {fetchedPayment?.payment_method !== 'Cash' && (
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Reference No.</span>
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-700 font-mono bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0 truncate max-w-[150px] sm:max-w-[200px]">
                          {fetchedPayment?.reference_number || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 sm:py-4 text-center text-[12px] sm:text-[13px] font-bold text-slate-400">
                    No payment details submitted yet.
                  </div>
                )}
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isSimulating || isFetchingPayment}
                className="w-full bg-gradient-to-b from-[#359b46] to-[#2a7a37] hover:shadow-[0_4px_15px_rgba(53,155,70,0.3)] disabled:from-[#86c48f] disabled:to-[#86c48f] disabled:shadow-none text-white font-bold py-3.5 sm:py-4 rounded-xl transition-all shadow-[0_2px_8px_rgba(53,155,70,0.2)] flex justify-center items-center gap-2 active:scale-95 text-[13px] sm:text-sm"
              >
                {isSimulating ? "Processing..." : <><CheckCircle size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Mark as Paid in Database</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}