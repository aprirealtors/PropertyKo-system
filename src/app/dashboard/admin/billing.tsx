"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Calculator, CalendarClock, Download, Send, CreditCard, CheckCircle } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database & UI States
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [allSoaConfigs, setAllSoaConfigs] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  
  // Global Computation Settings (Added Bank Details)
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

  // SOA Assignment States - Default to all unchecked
  const [soaConfig, setSoaConfig] = useState({
    owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
    tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
  });

  // Computation Form States (Added Bank Form States)
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

  // Fetch Submitted Payment Details when Modal Opens
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
      setSelectedUnit(sortedData[0]); 
      
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
  const isAssigned = !!currentSoa; // Flag to conditionally render numbers in UI if SOA table assigned
  const ownerStatus = currentSoa?.owner_status || 'Pending';
  const tenantStatus = currentSoa?.tenant_status || 'Pending';
  
  const rawDues = globalComp.duesRate * unitArea;
  const rawWater = globalComp.water;
  const rawElectricity = globalComp.electricity;
  const rawParking = globalComp.parking;

  // We revert the fallback to the original calculation so `totalDue` evaluates the actual price of the unit instead of ₱0.00
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
    
    // Set new bank defaults
    setCompBankName(globalComp.bankName);
    setCompBankAccountName(globalComp.bankAccountName);
    setCompBankAccountNumber(globalComp.bankAccountNumber);
    
    setIsComputationModalOpen(true);
  };

  const openSOAModal = () => {
    // If the unit has been assigned previously, load those specific settings.
    // Otherwise, force ALL checkboxes in the modal to be blank/unchecked so you can assign manually.
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
    if (status === 'Paid') return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] border border-emerald-100 uppercase tracking-wide">Paid</span>;
    if (status === 'Overdue') return <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full text-[11px] border border-red-100 uppercase tracking-wide">Overdue</span>;
    if (status === 'Sent') return <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[11px] border border-blue-100 uppercase tracking-wide">Sent</span>;
    return <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-[11px] border border-amber-100 uppercase tracking-wide">Pending</span>;
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Billing & payments</h2>
          <p className="text-slate-500 text-sm mt-1">SOA, collection and owner remittance</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units, SOA..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading billing data...</div>
      ) : allUnits.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium">No units found.</p>
          <p className="text-xs text-slate-400 mt-2">Add units to your property to manage billing.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 sm:p-8">
                
                <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-[#0a1e3f] text-xl">
                      {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      Owner: <span className="font-bold text-slate-700">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</span>
                      {!isTenantVacant && (
                        <>
                          {' | '} 
                          Tenant: <span className="font-bold text-slate-700">{selectedUnit.tenant_name}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!isOwnerVacant && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Owner:</span>
                        {renderStatusBadge(ownerStatus)}
                      </div>
                    )}
                    {!isTenantVacant && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tenant:</span>
                        {renderStatusBadge(tenantStatus)}
                      </div>
                    )}
                    {isOwnerVacant && isTenantVacant && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
                        <span className="text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full text-[11px] border border-slate-200 uppercase tracking-wide">Vacant</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Split Breakdown */}
                <div className={`grid grid-cols-1 ${!isTenantVacant ? 'md:grid-cols-2' : ''} gap-6 mb-8`}>
                  
                  {/* Assigned to Owner */}
                  <div className="border border-slate-200 rounded-2xl p-5 bg-white relative">
                    <div className="mb-4 pb-3 border-b border-slate-100">
                      <h4 className="font-bold text-[#0a1e3f] text-sm uppercase tracking-wide">
                        {isOwnerVacant && isTenantVacant ? 'Base Unit Charges' : 'Assigned to Owner'}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {isAssigned ? (
                        <>
                          {activeConfig.owner.dues && (
                            <div className="flex justify-between text-sm"><span className="text-slate-600">Assoc. dues</span><span className="font-bold text-[#0a1e3f]">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                          )}
                          {activeConfig.owner.parking && (
                            <div className="flex justify-between text-sm"><span className="text-slate-600">Parking</span><span className="font-bold text-[#0a1e3f]">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                          )}
                          {activeConfig.owner.water && (
                            <div className="flex justify-between text-sm"><span className="text-slate-600">Water</span><span className="font-bold text-[#0a1e3f]">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                          )}
                          {activeConfig.owner.electricity && (
                            <div className="flex justify-between text-sm"><span className="text-slate-600">Electricity</span><span className="font-bold text-[#0a1e3f]">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                          )}
                          {activeConfig.owner.penalty && ownerPenalty > 0 && !isOwnerVacant && (
                            <div className="flex justify-between text-sm"><span className="text-red-500 font-semibold">Late Penalty</span><span className="font-bold text-red-600">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                          )}
                          {ownerTotalDue === 0 && <p className="text-xs text-slate-400 italic">No assigned balances.</p>}
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                      )}
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Subtotal</span>
                      <span className="font-black text-[#0a1e3f] text-base">
                        {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Assigned to Tenant (Hidden if Vacant) */}
                  {!isTenantVacant && (
                    <div className="border rounded-2xl p-5 relative bg-slate-50 border-slate-200">
                      <div className="mb-4 pb-3 border-b border-slate-100">
                        <h4 className="font-bold text-[#1d82f5] text-sm uppercase tracking-wide">Assigned to Tenant</h4>
                      </div>
                      <div className="space-y-3 opacity-80">
                        {isAssigned ? (
                          <>
                            {activeConfig.tenant.dues && (
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Assoc. dues</span><span className="font-bold text-slate-700">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {activeConfig.tenant.parking && (
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Parking</span><span className="font-bold text-slate-700">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {activeConfig.tenant.water && !isTenantVacant && (
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Water</span><span className="font-bold text-slate-700">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {activeConfig.tenant.electricity && !isTenantVacant && (
                              <div className="flex justify-between text-sm"><span className="text-slate-600">Electricity</span><span className="font-bold text-slate-700">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {activeConfig.tenant.penalty && tenantPenalty > 0 && (
                              <div className="flex justify-between text-sm"><span className="text-red-400 font-semibold">Late Penalty</span><span className="font-bold text-red-400">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            )}
                            {tenantTotalDue === 0 && <p className="text-xs text-slate-400 italic">No assigned balances.</p>}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                        )}
                      </div>
                      <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1d82f5] uppercase">Subtotal</span>
                        <span className="font-black text-[#1d82f5] text-base">
                          {isAssigned ? `₱${tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="font-extrabold text-[#0a1e3f] text-lg">Total Due {!isTenantVacant && <span className="text-sm font-medium text-slate-500 ml-2">(Combined)</span>}</span>
                  <span className="font-black text-[#359b46] text-2xl">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                {/* 
                  UPDATED GRID/FLEX CONTAINER FOR BUTTONS 
                  grid-cols-2 creates the 2x2 on mobile.
                  md:flex md:flex-row sets it in a single line on desktop devices.
                */}
                <div className="grid grid-cols-2 md:flex md:flex-row gap-3 mb-2 w-full">
                  
                  {/* Contextual Payment Buttons based on who owes money */}
                  {isAssigned && ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant && (
                    <button 
                      onClick={() => { setPaymentModalParty('owner'); setIsPaymentModalOpen(true); }}
                      className="w-full justify-center md:w-auto bg-[#359b46] hover:bg-[#2c813a] text-white px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                      <CreditCard className="shrink-0" size={16} /> <span className="truncate">Owner Payment</span>
                    </button>
                  )}
                  {isAssigned && !isTenantVacant && tenantTotalDue > 0 && tenantStatus !== 'Paid' && (
                    <button 
                      onClick={() => { setPaymentModalParty('tenant'); setIsPaymentModalOpen(true); }}
                      className="w-full justify-center md:w-auto bg-[#1d82f5] hover:bg-blue-600 text-white px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                    >
                      <CreditCard className="shrink-0" size={16} /> <span className="truncate">Tenant Payment</span>
                    </button>
                  )}

                  <button 
                    onClick={openComputationModal}
                    className="w-full justify-center md:w-auto bg-white border border-[#1d82f5] hover:bg-slate-50 text-slate-700 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Calculator className="shrink-0" size={16} /> <span className="truncate">Billing Configuration</span>
                  </button>
                  
                  <button 
                    onClick={openSOAModal}
                    className="w-full justify-center md:w-auto bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                  >
                    <Send className="shrink-0" size={16} /> <span className="truncate">Assign & Send</span>
                  </button>
                </div>

              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6 max-h-[85vh] flex flex-col">
                <h3 className="font-bold text-[#0a1e3f] text-base mb-4 shrink-0">All Units</h3>
                <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400 text-[10px] uppercase tracking-wider font-bold sticky top-0 bg-white border-b border-slate-100 z-10">
                      <tr><th className="pb-2">UNIT DETAILS</th><th className="pb-2 text-right">STATUS</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allUnits.map((unit) => {
                        const isSelected = selectedUnit?.id === unit.id;
                        const isRowOwnerVacant = !unit.owner_name || unit.owner_name === '—';
                        const isRowTenantVacant = unit.status === 'Vacant' || !unit.tenant_name || unit.tenant_name === '—';
                        
                        const rowSoa = allSoaConfigs[unit.id];
                        const rOwnerStat = rowSoa?.owner_status || 'Pending';
                        const rTenantStat = rowSoa?.tenant_status || 'Pending';
                        
                        return (
                          <tr 
                            key={unit.id} 
                            onClick={() => setSelectedUnit(unit)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0f9f1]' : 'hover:bg-slate-50'}`}
                          >
                            <td className={`py-3 ${isSelected ? 'font-bold text-[#359b46]' : 'font-medium text-slate-700'} rounded-l-lg pl-2`}>
                              {unit.property_name} {unit.unit_number}
                              <div className="text-[10px] text-slate-500 font-normal truncate max-w-[200px] mt-0.5">
                                Owner: {isRowOwnerVacant ? 'Vacant' : unit.owner_name} 
                                {!isRowTenantVacant && ` | Tenant: ${unit.tenant_name}`}
                              </div>
                            </td>
                            <td className="py-3 text-right pr-2 rounded-r-lg flex flex-col items-end justify-center gap-0.5">
                              {isRowOwnerVacant && isRowTenantVacant ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  VACANT
                                </span>
                              ) : (
                                <>
                                  {!isRowOwnerVacant && (
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${rOwnerStat === 'Paid' ? 'text-emerald-600' : rOwnerStat === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`}>
                                      O: {rOwnerStat}
                                    </span>
                                  )}
                                  {!isRowTenantVacant && (
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${rTenantStat === 'Paid' ? 'text-emerald-600' : rTenantStat === 'Overdue' ? 'text-red-600' : 'text-amber-600'}`}>
                                      T: {rTenantStat}
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* COMBINED LEDGER TABLE (Full Width) */}
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="text-[#359b46]" size={20} />
                <h4 className="font-bold text-[#0a1e3f] text-lg">Combined Ledger & Projection ({new Date().getFullYear()})</h4>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-slate-500 hidden sm:block font-medium">
                  Due: Day {globalComp.collectionDay} <span className="mx-2">|</span> Penalty: Day {globalComp.collectionDay + globalComp.gracePeriod}
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 text-sm font-bold text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors border border-blue-100 shadow-sm"
                >
                  <Download size={16} /> Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[500px] custom-scrollbar relative">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PERIOD</th>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUE DATE</th>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUES</th>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PARKING</th>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">UTILITIES</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-red-50 text-red-700 border-r border-red-100">
                      PENALTY
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">STATUS {isTenantVacant ? '' : '(O/T)'}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap font-black">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                  {ledgerData.map((row, idx) => {
                    const isOverdue = row.status === 'Overdue';
                    const activeRow = row.isCurrentMonth;
                    
                    return (
                      <tr key={idx} className={activeRow ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 font-bold text-slate-800 uppercase text-[11px]">
                          {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1">*</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 text-slate-500">{row.dueDate}</td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{rawDues > 0 ? `₱${rawDues.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{rawParking > 0 ? `₱${rawParking.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{(!isTenantVacant && (rawWater + rawElectricity) > 0) ? `₱${(rawWater + rawElectricity).toLocaleString()}` : "—"}</td>
                        
                        <td className={`px-4 py-3 whitespace-nowrap border-r border-slate-200 ${isOverdue ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                          {isOverdue && (ownerPenalty + tenantPenalty) > 0 ? `₱${(ownerPenalty + tenantPenalty).toLocaleString()}` : "—"}
                        </td>
                        
                        <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 font-medium text-[11px]">
                          {row.isCurrentMonth ? (
                            isOwnerVacant && isTenantVacant ? (
                               <span className="text-slate-500 font-bold">VACANT</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {!isOwnerVacant && <span>O: <span className={ownerStatus === 'Paid' ? 'text-emerald-600 font-bold' : ownerStatus === 'Overdue' ? 'text-red-600 font-bold' : 'text-amber-600'}>{ownerStatus}</span></span>}
                                {!isTenantVacant && <span>T: <span className={tenantStatus === 'Paid' ? 'text-emerald-600 font-bold' : tenantStatus === 'Overdue' ? 'text-red-600 font-bold' : 'text-amber-600'}>{tenantStatus}</span></span>}
                              </div>
                            )
                          ) : (
                            <span className={row.status === 'Paid' ? 'text-emerald-600 font-bold' : 'text-slate-400'}>{row.status}</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-[#0a1e3f]">
                          ₱{(isOverdue ? totalDue : (ownerBase + tenantBase)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* COMPUTATION MODAL (Global) */}
      {isComputationModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Calculator className="text-[#1d82f5]" size={20} />
                <h2 className="text-lg font-bold text-[#0a1e3f]">Billing Configuration</h2>
              </div>
              <button onClick={() => setIsComputationModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleSaveComputation} className="space-y-5">
                
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Collection Start Day</label>
                    <div className="relative">
                      <input type="number" min="1" max="31" placeholder="e.g. 1" value={compCollectionDay} onChange={(e) => setCompCollectionDay(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Day of the month (1-31)</p>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-slate-700 mb-1.5">Grace Period (Days)</label>
                    <div className="relative">
                      <input type="number" min="0" placeholder="e.g. 15" value={compGracePeriod} onChange={(e) => setCompGracePeriod(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Days before penalty hits</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Assoc. Dues (sqm)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="e.g. 85" value={compDuesRate} onChange={(e) => setCompDuesRate(e.target.value)} className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Parking Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="e.g. 1500" value={compParking} onChange={(e) => setCompParking(e.target.value)} className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Water Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="e.g. 500" value={compWater} onChange={(e) => setCompWater(e.target.value)} className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Electricity Baseline</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="e.g. 1500" value={compElec} onChange={(e) => setCompElec(e.target.value)} className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-bold text-red-600 mb-2">Late Penalty Deduction</label>
                  <div className="flex gap-2">
                    <select value={compPenaltyType} onChange={(e) => setCompPenaltyType(e.target.value)} className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-white">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={compPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={compPenaltyValue} onChange={(e) => setCompPenaltyValue(e.target.value)} className="w-2/3 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm" />
                  </div>
                </div>

                {/* NEW: Bank Transfer Details Section */}
                <div className="border-t border-slate-100 pt-5 mt-5">
                  <label className="block text-sm font-bold text-[#0a1e3f] mb-3">Bank Transfer Details</label>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Set up your organization's bank details here. These will be securely displayed to owners and tenants when they select "Bank Transfer" during payment.
                  </p>
                  
                  <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Bank Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. BDO Unibank" 
                        value={compBankName} 
                        onChange={(e) => setCompBankName(e.target.value)} 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm bg-white" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Account Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. HOA Administration" 
                          value={compBankAccountName} 
                          onChange={(e) => setCompBankAccountName(e.target.value)} 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Account Number</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 0012-3456-7890" 
                          value={compBankAccountNumber} 
                          onChange={(e) => setCompBankAccountNumber(e.target.value)} 
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm bg-white" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsComputationModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 bg-[#1d82f5] hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow-sm transition-colors">Save Globally</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SOA MODAL (Per Unit Setup with Two Columns) */}
      {isSOAModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Send className="text-[#1d82f5]" size={20} />
                <h2 className="text-lg font-bold text-[#0a1e3f]">Assign Specific Balances - {selectedUnit?.unit_number}</h2>
              </div>
              <button onClick={() => setIsSOAModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSendingSOA || isSavingDefault}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-[12px] text-slate-500 mb-6">
                {isTenantVacant ? "Assign balances to the owner for this unit. Settings will be saved automatically when setting defaults." : "Checking a box for one party will automatically lock it out for the other party. To swap assignments, uncheck the item first."}
              </p>
              
              <div className={`grid grid-cols-1 ${!isTenantVacant ? 'sm:grid-cols-2' : ''} gap-6 mb-8`}>
                
                {/* OWNER COLUMN */}
                <div className="border border-slate-200 rounded-2xl p-5 bg-white relative">
                  <div className="mb-4 pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-[#0a1e3f] text-sm uppercase tracking-wide">Owner</h3>
                    <p className="text-xs text-slate-500 truncate">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {rawDues > 0 && (
                      <label className={`flex items-center justify-between ${soaConfig.tenant.dues && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={soaConfig.tenant.dues && !isTenantVacant} checked={soaConfig.owner.dues} onChange={(e) => handleToggleSoa('owner', 'dues', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                          <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Assoc. Dues</span>
                        </div>
                        <span className="font-semibold text-slate-600 text-[13px]">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {rawParking > 0 && (
                      <label className={`flex items-center justify-between ${soaConfig.tenant.parking && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={soaConfig.tenant.parking && !isTenantVacant} checked={soaConfig.owner.parking} onChange={(e) => handleToggleSoa('owner', 'parking', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                          <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Parking</span>
                        </div>
                        <span className="font-semibold text-slate-600 text-[13px]">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawWater > 0 && (
                      <label className={`flex items-center justify-between ${soaConfig.tenant.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={soaConfig.tenant.water} checked={soaConfig.owner.water} onChange={(e) => handleToggleSoa('owner', 'water', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                          <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Water</span>
                        </div>
                        <span className="font-semibold text-slate-600 text-[13px]">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawElectricity > 0 && (
                      <label className={`flex items-center justify-between ${soaConfig.tenant.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={soaConfig.tenant.electricity} checked={soaConfig.owner.electricity} onChange={(e) => handleToggleSoa('owner', 'electricity', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                          <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Electricity</span>
                        </div>
                        <span className="font-semibold text-slate-600 text-[13px]">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {ownerPenalty > 0 && (
                      <label className={`flex items-center justify-between ${soaConfig.tenant.penalty && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled={soaConfig.tenant.penalty && !isTenantVacant} checked={soaConfig.owner.penalty} onChange={(e) => handleToggleSoa('owner', 'penalty', e.target.checked)} className="rounded text-red-500 focus:ring-red-500 disabled:bg-slate-200" />
                          <span className="text-[13px] text-red-600 font-medium">Late Penalty</span>
                        </div>
                        <span className="font-semibold text-red-600 text-[13px]">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                  </div>
                  
                  <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">Owner Total</span>
                    <span className="font-black text-[#0a1e3f] text-base">
                      ₱{((soaConfig.owner.dues ? rawDues : 0) + (soaConfig.owner.parking ? rawParking : 0) + (soaConfig.owner.water ? rawWater : 0) + (soaConfig.owner.electricity ? rawElectricity : 0) + (soaConfig.owner.penalty ? ownerPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                {/* TENANT COLUMN (Hidden if Vacant) */}
                {!isTenantVacant && (
                  <div className="border rounded-2xl p-5 relative bg-white border-[#1d82f5]/30 shadow-[0_0_15px_rgba(29,130,245,0.05)]">
                    <div className="mb-4 pb-3 border-b border-slate-100">
                      <h3 className="font-bold text-[#1d82f5] text-sm uppercase tracking-wide">Tenant</h3>
                      <p className="text-xs text-slate-500 truncate">{selectedUnit?.tenant_name}</p>
                    </div>
                    
                    <div className="space-y-3">
                      {rawDues > 0 && (
                        <label className={`flex items-center justify-between ${soaConfig.owner.dues ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" disabled={soaConfig.owner.dues} checked={soaConfig.tenant.dues} onChange={(e) => handleToggleSoa('tenant', 'dues', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                            <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Assoc. Dues</span>
                          </div>
                          <span className="font-semibold text-slate-600 text-[13px]">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {rawParking > 0 && (
                        <label className={`flex items-center justify-between ${soaConfig.owner.parking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" disabled={soaConfig.owner.parking} checked={soaConfig.tenant.parking} onChange={(e) => handleToggleSoa('tenant', 'parking', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                            <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Parking</span>
                          </div>
                          <span className="font-semibold text-slate-600 text-[13px]">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawWater > 0 && (
                        <label className={`flex items-center justify-between ${soaConfig.owner.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" disabled={soaConfig.owner.water} checked={soaConfig.tenant.water} onChange={(e) => handleToggleSoa('tenant', 'water', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                            <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Water</span>
                          </div>
                          <span className="font-semibold text-slate-600 text-[13px]">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawElectricity > 0 && (
                        <label className={`flex items-center justify-between ${soaConfig.owner.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" disabled={soaConfig.owner.electricity} checked={soaConfig.tenant.electricity} onChange={(e) => handleToggleSoa('tenant', 'electricity', e.target.checked)} className="rounded text-[#359b46] focus:ring-[#359b46] disabled:bg-slate-200" />
                            <span className="text-[13px] text-slate-700 group-hover:text-slate-900">Electricity</span>
                          </div>
                          <span className="font-semibold text-slate-600 text-[13px]">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {tenantPenalty > 0 && (
                        <label className={`flex items-center justify-between ${soaConfig.owner.penalty ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" disabled={soaConfig.owner.penalty} checked={soaConfig.tenant.penalty} onChange={(e) => handleToggleSoa('tenant', 'penalty', e.target.checked)} className="rounded text-red-500 focus:ring-red-500 disabled:bg-slate-200" />
                            <span className="text-[13px] text-red-600 font-medium">Late Penalty</span>
                          </div>
                          <span className="font-semibold text-red-600 text-[13px]">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-[#1d82f5] uppercase">Tenant Total</span>
                      <span className="font-black text-[#1d82f5] text-base">
                        ₱{((soaConfig.tenant.dues ? rawDues : 0) + (soaConfig.tenant.parking ? rawParking : 0) + (!isTenantVacant && soaConfig.tenant.water ? rawWater : 0) + (!isTenantVacant && soaConfig.tenant.electricity ? rawElectricity : 0) + (soaConfig.tenant.penalty ? tenantPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => setIsSOAModalOpen(false)} 
                  disabled={isSendingSOA || isSavingDefault}
                  className="px-6 py-3.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={handleSaveDefaultSOA}
                    disabled={isSendingSOA || isSavingDefault}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-3.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex justify-center items-center gap-2"
                  >
                    {isSavingDefault ? "Saving Config..." : "Save as default"}
                  </button>
                  <button 
                    onClick={handleSendSOA}
                    disabled={isSendingSOA || isSavingDefault || (ownerTotalDue === 0 && tenantTotalDue === 0)}
                    className="flex-1 bg-[#1d82f5] hover:bg-blue-600 disabled:bg-blue-300 text-white py-3.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex justify-center items-center gap-2"
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
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-50">
              <h2 className="text-xl font-extrabold text-[#0a1e3f] capitalize">{paymentModalParty} Payment Verification</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSimulating || isFetchingPayment}>
                <X size={20} />
              </button>
            </div>
            
            <div className="px-6 py-6">
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Please verify the payment details submitted by the <span className="font-bold text-[#1d82f5] uppercase">{paymentModalParty}</span> for {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}.
              </p>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Amount Due</span>
                  <span className="font-black text-[#0a1e3f] text-lg">
                    ₱{(paymentModalParty === 'owner' ? ownerTotalDue : tenantTotalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
                
                {isFetchingPayment ? (
                  <div className="py-4 text-center text-xs font-medium text-slate-400 animate-pulse">
                    Fetching submitted details...
                  </div>
                ) : fetchedPayment ? (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Method Used</span>
                      <span className="text-sm font-bold text-[#1d82f5] bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                        {fetchedPayment?.payment_method || 'Unknown'}
                      </span>
                    </div>
                    
                    {fetchedPayment?.payment_method !== 'Cash' && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reference No.</span>
                        <span className="text-sm font-bold text-slate-700 font-mono bg-white px-3 py-1 rounded-lg border border-slate-200">
                          {fetchedPayment?.reference_number || 'N/A'}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-4 text-center text-xs font-medium text-slate-400">
                    No payment details submitted yet.
                  </div>
                )}
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isSimulating || isFetchingPayment}
                className="w-full bg-[#359b46] hover:bg-[#2e8a3d] disabled:bg-[#86c48f] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
              >
                {isSimulating ? "Processing..." : <><CheckCircle size={18} /> Mark as Paid</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}