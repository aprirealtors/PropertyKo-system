"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { CalendarClock, Download, X, Receipt, ShieldCheck, AlertCircle, CheckCircle, CreditCard } from "lucide-react";

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
    <div className="flex flex-col w-full">
      <div className="flex-none pb-6 shrink-0">
        <h2 className="text-2xl font-bold text-slate-800">Financial Statements</h2>
        <p className="text-slate-500 text-sm mt-1">Review your Statement of Account (SOA) and pay your dues securely.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-[#0a1e3f] text-xl">{selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}</h3>
                <p className="text-slate-500 text-sm mt-1">Tenant: <span className={`font-bold ${isVacant ? 'text-slate-400' : 'text-slate-700'}`}>{isVacant ? 'Vacant' : selectedUnit?.tenant_name || '—'}</span></p>
              </div>
              <div>
                {!isAssigned && <span className="bg-slate-50 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs border border-slate-200">Unassigned</span>}
                {isAssigned && ownerStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1.5 rounded-full text-xs border border-red-100">Overdue</span>}
                {isAssigned && ownerStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-full text-xs border border-amber-100">Pending</span>}
                {isAssigned && ownerStatus === 'Sent' && <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-full text-xs border border-blue-100">Sent</span>}
                {isAssigned && ownerStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-xs border border-emerald-100">Settled</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Assigned to You (Owner) */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-white">
                <div className="mb-4 pb-3 border-b border-slate-100"><h4 className="font-bold text-[#0a1e3f] text-sm uppercase tracking-wide">Assigned to You</h4></div>
                <div className="space-y-3">
                  {isAssigned ? (
                    <>
                      {soaConfig.owner.dues && (
                        <div className="flex justify-between">
                          <span className="text-slate-600 text-sm">Association dues <span className="text-xs text-slate-400 ml-1">({unitArea} sqm)</span></span>
                          <span className="font-bold text-[#0a1e3f] text-sm">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      )}
                      {soaConfig.owner.parking && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Parking</span><span className="font-bold text-[#0a1e3f] text-sm">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.owner.water && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Water</span><span className="font-bold text-[#0a1e3f] text-sm">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.owner.electricity && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Electricity (sub-meter)</span><span className="font-bold text-[#0a1e3f] text-sm">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.owner.penalty && ownerPenalty > 0 && (
                        <div className="flex justify-between"><span className="text-red-500 font-semibold text-sm">Late payment penalty</span><span className="font-bold text-red-600 text-sm">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {ownerTotalDue === 0 && <p className="text-xs text-slate-400 italic">No balances assigned to you this period.</p>}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                  )}
                </div>
              </div>

              {/* Assigned to Tenant */}
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                <div className="mb-4 pb-3 border-b border-slate-100"><h4 className="font-bold text-[#1d82f5] text-sm uppercase tracking-wide">Assigned to Tenant</h4></div>
                <div className="space-y-3 opacity-80">
                  {isAssigned ? (
                    <>
                      {soaConfig.tenant.dues && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Association dues</span><span className="font-bold text-slate-700 text-sm">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.tenant.parking && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Parking</span><span className="font-bold text-slate-700 text-sm">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.tenant.water && !isVacant && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Water</span><span className="font-bold text-slate-700 text-sm">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.tenant.electricity && !isVacant && (
                        <div className="flex justify-between"><span className="text-slate-600 text-sm">Electricity</span><span className="font-bold text-slate-700 text-sm">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      )}
                      {soaConfig.tenant.penalty && existingSoa?.tenant_status === 'Overdue' && (
                         <div className="flex justify-between"><span className="text-red-400 font-semibold text-sm">Late Penalty</span><span className="font-bold text-red-400 text-sm">Pending</span></div>
                      )}
                      {tenantBase === 0 && <p className="text-xs text-slate-400 italic">No balances assigned to tenant this period.</p>}
                    </>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Pending SOA assignment.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-extrabold text-[#0a1e3f] text-lg">Total due <span className="text-sm font-medium text-slate-500 ml-2">(Your Account)</span></span>
              <span className="font-black text-[#359b46] text-2xl">
                {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
              </span>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={!isAssigned || isPaid || ownerTotalDue === 0 || isLoading}
                className="w-full sm:w-auto bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                {!isAssigned ? 'Pending Assignment' : isPaid ? 'Payment Settled' : ownerTotalDue === 0 ? 'No Payment Needed' : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6 max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-[#0a1e3f] text-base mb-4 shrink-0">Your Properties</h3>
            <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-[10px] uppercase tracking-wider font-bold sticky top-0 bg-white border-b border-slate-100 z-10">
                  <tr><th className="pb-2">UNIT</th><th className="pb-2 text-right">STATUS</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedUnits.map((unit: any) => {
                    const status = localStatuses[unit.id];
                    const isSelected = selectedUnit?.id === unit.id;
                    return (
                      <tr key={unit.id} onClick={() => setSelectedUnit(unit)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0f9f1]' : 'hover:bg-slate-50'}`}>
                        <td className={`py-3 ${isSelected ? 'font-bold text-[#359b46]' : 'font-medium text-slate-700'} rounded-l-lg pl-2`}>{unit.property_name} {unit.unit_number}</td>
                        <td className="py-3 text-right pr-2 rounded-r-lg">
                          {status === 'Paid' && <span className="text-emerald-600 font-bold text-[11px]">Paid</span>}
                          {status === 'Overdue' && <span className="text-red-600 font-bold text-[11px]">Overdue</span>}
                          {status === 'Pending' && <span className="text-amber-600 font-bold text-[11px]">Pending</span>}
                          {status === 'Sent' && <span className="text-blue-600 font-bold text-[11px]">Sent</span>}
                          {(!status || status === 'Pending' && !allSoaConfigs[unit.id]) && <span className="text-slate-500 font-bold text-[11px]">Unassigned</span>}
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
                <th className="px-4 py-3 whitespace-nowrap bg-red-50 text-red-700 border-r border-red-100">PENALTY</th>
                <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">STATUS</th>
                <th className="px-4 py-3 text-right whitespace-nowrap font-black">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {ledgerData.map((row, idx) => {
                const isRowPaid = row.status === 'Paid';
                const isRowOverdue = row.status === 'Overdue';
                const activeRow = row.isCurrentMonth;
                return (
                  <tr key={idx} className={activeRow ? "bg-blue-50/40" : "hover:bg-slate-50 transition-colors"}>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100 font-bold text-[#0a1e3f] uppercase text-[11px]">
                      {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1">*</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100 text-slate-500">{row.dueDate}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{ownerDues > 0 ? `₱${ownerDues.toLocaleString()}` : "0"}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{ownerParking > 0 ? `₱${ownerParking.toLocaleString()}` : "0"}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{(ownerWater + ownerElectricity) > 0 ? `₱${(ownerWater + ownerElectricity).toLocaleString()}` : "0"}</td>
                    <td className={`px-4 py-3.5 whitespace-nowrap border-r border-slate-100 ${isRowOverdue ? 'text-red-600 font-bold bg-red-50/50' : ''}`}>
                      {isRowOverdue && ownerPenalty > 0 ? `₱${ownerPenalty.toLocaleString()}` : "0"}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100 font-medium text-[11px]">
                      {row.status === 'Paid' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Paid</span>}
                      {row.status === 'Overdue' && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full uppercase">Overdue</span>}
                      {row.status === 'Pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full uppercase">Pending</span>}
                      {row.status === 'Sent' && <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full uppercase">Sent</span>}
                      {row.status === 'Unassigned' && <span className="text-slate-500 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase">Unassigned</span>}
                      {row.status === 'Upcoming' && <span className="text-slate-400 font-bold uppercase">Upcoming</span>}
                    </td>
                    <td className={`px-4 py-3.5 text-right whitespace-nowrap font-bold ${isRowPaid ? 'text-emerald-600' : 'text-[#0a1e3f]'}`}>
                      ₱{(isRowOverdue ? ownerTotalDue : ownerBase).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-filter backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-2 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#0a1e3f]">Submit Payment</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSimulating}>
                <X size={20} />
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <p className="text-slate-500 mb-6">{selectedUnit?.property_name} · Unit {selectedUnit?.unit_number} - total <span className="font-bold text-[#0a1e3f]">₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button 
                      key={method}
                      onClick={() => setPaymentMethod(method)} 
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${paymentMethod === method ? 'bg-blue-50 text-[#1d82f5] border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Instructions Based on Payment Method */}
              <div className="mb-6 p-4 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-600">
                {paymentMethod === 'Digital Wallet' && (
                  <div className="flex flex-col items-center">
                    <p className="mb-3 font-medium text-center">Scan QR code using GCash or QR Ph</p>
                    <div className="w-32 h-32 bg-white relative overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                      <Image src="/qr-ph.png" alt="Scan to pay" fill className="object-contain p-2" />
                    </div>
                  </div>
                )}
                {paymentMethod === 'Bank Transfer' && (
                  <div className="space-y-1">
                    <p className="font-bold text-[#0a1e3f] mb-2">Bank Details:</p>
                    {globalComp.bankName || globalComp.bankAccountNumber ? (
                      <>
                        <p>Bank: <span className="font-medium">{globalComp.bankName}</span></p>
                        <p>Account Name: <span className="font-medium">{globalComp.bankAccountName}</span></p>
                        <p>Account Number: <span className="font-medium">{globalComp.bankAccountNumber}</span></p>
                      </>
                    ) : (
                      <p className="text-xs italic text-slate-500">Bank details will be displayed here once configured by the administration.</p>
                    )}
                  </div>
                )}
                {paymentMethod === 'Check' && (
                  <div className="space-y-1">
                    <p>Make checks payable to: <span className="font-bold text-[#0a1e3f]">{globalComp.bankAccountName || 'HOA Administration'}</span></p>
                    <p className="text-xs mt-2 italic">Please drop off post-dated checks at the admin office within 3 business days.</p>
                  </div>
                )}
                {paymentMethod === 'Cash' && (
                  <p>Please pay in exact amounts at the Administration Office. Retain your physical receipt.</p>
                )}
              </div>

              {/* Reference Number Input */}
              {paymentMethod !== 'Cash' && (
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Reference / Transaction Number</label>
                  <input 
                    type="text" 
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. 1002934823"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1d82f5] focus:ring-1 focus:ring-[#1d82f5]"
                  />
                </div>
              )}

              <button 
                onClick={handleSimulatePayment} 
                disabled={isSimulating || (paymentMethod !== 'Cash' && referenceNumber.length < 3)} 
                className="w-full bg-[#1d82f5] hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
              >
                {isSimulating ? "Processing Payment..." : "I've paid, submit receipt →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Success Modal */}
      {showCashSuccessModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-filter backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#0a1e3f] mb-3">Request Submitted</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Payment method recorded as Cash. Please proceed to the Administration Office to complete your payment.
            </p>
            <button 
              onClick={() => setShowCashSuccessModal(false)}
              className="w-full bg-[#359b46] hover:bg-[#2e8a3d] text-white font-bold py-3.5 rounded-xl transition-all shadow-sm"
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