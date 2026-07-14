"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Calculator, CalendarClock } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database & UI States
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  
  // Global Computation Settings (Added parking)
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0,
    water: 0,
    electricity: 0,
    parking: 0,
    penaltyType: 'percent',
    penaltyValue: 3,
    collectionDay: 1,
    gracePeriod: 15
  });

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isComputationModalOpen, setIsComputationModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'QR Ph' | 'GCash'>('QR Ph');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Computation Form States
  const [compDuesRate, setCompDuesRate] = useState("");
  const [compWater, setCompWater] = useState("");
  const [compElec, setCompElec] = useState("");
  const [compParking, setCompParking] = useState("");
  const [compPenaltyType, setCompPenaltyType] = useState("percent");
  const [compPenaltyValue, setCompPenaltyValue] = useState("");
  const [compCollectionDay, setCompCollectionDay] = useState(""); 
  const [compGracePeriod, setCompGracePeriod] = useState(""); 

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchBillingConfig();
      fetchAllUnits();
    }
  }, [orgData?.admin_email]);

  const fetchBillingConfig = async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days')
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
        gracePeriod: data.grace_period_days || 15
      });
    }
  };

  const fetchAllUnits = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email); 

    if (error) {
      console.error("Error fetching units:", error);
    } else if (data && data.length > 0) {
      
      const sortedData = data.sort((a, b) => {
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
        if (u.status === 'Vacant') {
          statuses[u.id] = 'N/A';
        } else {
          statuses[u.id] = u.payment_status || 'Pending';
        }
      });
      setLocalStatuses(statuses);
    }
    setIsLoading(false);
  };

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const currentStatus = selectedUnit ? localStatuses[selectedUnit.id] : '';
  const isVacant = selectedUnit?.status === 'Vacant';
  const rent = selectedUnit?.monthly_rent || 0;
  const unitArea = getUnitAreaValue(selectedUnit?.unit_area);
  
  // Live Computations using the GLOBAL settings
  const dues = globalComp.duesRate * unitArea;
  const water = globalComp.water;
  const electricity = globalComp.electricity;
  const parking = globalComp.parking;
  const baseTotal = isVacant ? 0 : (rent + dues + water + electricity + parking);

  let lateFee = 0;
  if (currentStatus === 'Overdue') {
    if (globalComp.penaltyType === 'percent') {
      lateFee = baseTotal * (globalComp.penaltyValue / 100);
    } else {
      lateFee = globalComp.penaltyValue;
    }
  }

  const totalDue = baseTotal + lateFee;

  const openComputationModal = () => {
    setCompDuesRate(globalComp.duesRate ? String(globalComp.duesRate) : "");
    setCompWater(globalComp.water ? String(globalComp.water) : "");
    setCompElec(globalComp.electricity ? String(globalComp.electricity) : "");
    setCompParking(globalComp.parking ? String(globalComp.parking) : "");
    setCompPenaltyType(globalComp.penaltyType);
    setCompPenaltyValue(globalComp.penaltyValue ? String(globalComp.penaltyValue) : "");
    setCompCollectionDay(String(globalComp.collectionDay));
    setCompGracePeriod(String(globalComp.gracePeriod));
    setIsComputationModalOpen(true);
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
      grace_period_days: parseInt(compGracePeriod) || 15
    };

    try {
      // 1. Added .select() to force Supabase to return the row if successful
      const { data, error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('admin_email', orgData.admin_email)
        .select();

      if (error) throw error;

      // 2. Catch the silent failure caused by RLS
      if (!data || data.length === 0) {
        throw new Error("Update blocked by RLS. Your current user does not have permission to update this organization.");
      }

      setGlobalComp({
        duesRate: payload.dues_rate,
        water: payload.default_water,
        electricity: payload.default_electricity,
        parking: payload.default_parking,
        penaltyType: payload.penalty_type,
        penaltyValue: payload.penalty_value,
        collectionDay: payload.collection_day,
        gracePeriod: payload.grace_period_days
      });

      setIsComputationModalOpen(false);
    } catch (err: any) {
      console.error("Failed to update global computation:", err);
      alert(`${err.message}`);
    }
  };

  const generateLedgerMonths = () => {
    const months = [];
    const date = new Date();
    date.setMonth(date.getMonth() - 1); 
    
    for (let i = 0; i < 6; i++) {
      const monthName = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      
      let stat = "Upcoming";
      if (isVacant) stat = "N/A";
      else if (i === 0) stat = "Paid"; 
      else if (i === 1) stat = currentStatus; 
      
      const dueDate = `${monthName} ${globalComp.collectionDay}, ${year}`;
      
      months.push({
        monthName: monthName,
        year: year,
        dueDate: dueDate,
        status: stat
      });
      date.setMonth(date.getMonth() + 1);
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setTimeout(async () => {
      setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', selectedUnit.id);
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
    }, 1000);
  };

  const handleMarkAsPaid = async () => {
    if (selectedUnit) {
      setIsMarkingPaid(true);
      setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', selectedUnit.id);
      setIsMarkingPaid(false);
    }
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";

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
            <span className="text-sm font-semibold text-[#359b46]">Manager</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="font-extrabold text-[#0a1e3f] text-xl">
                    {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Tenant: <span className={`font-bold ${isVacant ? 'text-slate-400' : 'text-slate-700'}`}>
                      {isVacant ? 'Vacant' : selectedUnit?.tenant_name}
                    </span>
                  </p>
                </div>
                <div>
                  {currentStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1.5 rounded-full text-xs border border-red-100">Overdue</span>}
                  {currentStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-full text-xs border border-amber-100">Pending</span>}
                  {currentStatus === 'Sent' && <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-full text-xs border border-blue-100">Sent</span>}
                  {currentStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-xs border border-emerald-100">Settled</span>}
                  {currentStatus === 'N/A' && <span className="bg-slate-100 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs border border-slate-200">Not Applicable</span>}
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200"><span className="text-slate-600">Monthly rent</span><span className="font-bold text-[#0a1e3f]">₱{rent.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                  <span className="text-slate-600">Association dues <span className="text-xs text-slate-400 ml-1">({unitArea} sqm)</span></span>
                  <span className="font-bold text-[#0a1e3f]">{dues > 0 ? `₱${dues.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
                </div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                  <span className="text-slate-600">Parking</span>
                  <span className="font-bold text-[#0a1e3f]">{parking > 0 ? `₱${parking.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
                </div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                  <span className="text-slate-600">Water</span>
                  <span className="font-bold text-[#0a1e3f]">{water > 0 ? `₱${water.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
                </div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                  <span className="text-slate-600">Electricity (sub-meter)</span>
                  <span className="font-bold text-[#0a1e3f]">{electricity > 0 ? `₱${electricity.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
                </div>
                {lateFee > 0 && (
                  <div className="flex justify-between pb-4 border-b border-slate-200">
                    <span className="text-red-500 font-semibold flex items-center gap-1">Late payment penalty</span>
                    <span className="font-bold text-red-600">₱{lateFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="font-extrabold text-[#0a1e3f] text-lg">Total due</span>
                <span className="font-black text-[#359b46] text-2xl">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-8">
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={currentStatus === 'Paid' || isVacant}
                  className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  {currentStatus === 'Paid' ? 'Payment Settled' : 'Collect via GCash / QR Ph'}
                </button>

                <button 
                  onClick={openComputationModal}
                  className="bg-white border border-[#1d82f5] hover:bg-blue-50 text-[#1d82f5] px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                  <Calculator size={16} /> Computation
                </button>
                
                {currentStatus !== 'Paid' && !isVacant && (
                  <button 
                    onClick={handleMarkAsPaid}
                    disabled={isMarkingPaid}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                  >
                    {isMarkingPaid ? 'Saving...' : 'Mark as Paid'}
                  </button>
                )}

                {!isVacant && (
                  <button className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">
                    Send reminder
                  </button>
                )}
              </div>

              <div className="mt-8 border-t border-slate-100 pt-8">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="text-[#359b46]" size={18} />
                    <h4 className="font-bold text-[#0a1e3f] text-sm">Billing Ledger & Projection</h4>
                  </div>
                  <div className="text-xs text-slate-500">
                    Due: Day {globalComp.collectionDay} | Penalty: Day {globalComp.collectionDay + globalComp.gracePeriod}
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PERIOD</th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUE DATE</th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">BASE RENT</th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUES</th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PARKING</th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">UTILITIES</th>
                        <th className="px-4 py-3 whitespace-nowrap bg-red-600 text-white border-r border-red-700">
                          PENALTY ({globalComp.penaltyType === 'percent' ? `${globalComp.penaltyValue}%` : `₱${globalComp.penaltyValue}`})
                        </th>
                        <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">STATUS</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap font-black">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                      {ledgerData.map((row, idx) => {
                        const isPaid = row.status === 'Paid';
                        const isOverdue = row.status === 'Overdue';
                        const activeRow = idx === 1 && !isVacant; 
                        
                        return (
                          <tr key={idx} className={activeRow ? "bg-blue-50/30" : "hover:bg-slate-50"}>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 font-bold text-slate-800 uppercase text-[10px]">
                              {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1">*</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 text-slate-500">{row.dueDate}</td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">₱{rent.toLocaleString()}</td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{dues > 0 ? `₱${dues.toLocaleString()}` : "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{parking > 0 ? `₱${parking.toLocaleString()}` : "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{(water + electricity) > 0 ? `₱${(water + electricity).toLocaleString()}` : "—"}</td>
                            
                            <td className={`px-4 py-3 whitespace-nowrap border-r border-slate-200 ${isOverdue && !isVacant ? 'text-red-600 font-bold bg-red-50' : ''}`}>
                              {isOverdue && !isVacant && lateFee > 0 ? `₱${lateFee.toLocaleString()}` : "—"}
                            </td>
                            
                            <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">
                              {row.status === 'Paid' && <span className="text-emerald-600 font-bold">Paid</span>}
                              {row.status === 'Overdue' && <span className="text-red-600 font-bold">Overdue</span>}
                              {row.status === 'Pending' && <span className="text-amber-600 font-bold">Pending</span>}
                              {row.status === 'Sent' && <span className="text-blue-600 font-bold">Sent</span>}
                              {row.status === 'Upcoming' && <span className="text-slate-400">Upcoming</span>}
                              {row.status === 'N/A' && <span className="text-slate-300">—</span>}
                            </td>

                            <td className={`px-4 py-3 text-right whitespace-nowrap font-bold ${isPaid && !isVacant ? 'bg-[#22c55e] text-white' : 'text-[#0a1e3f]'}`}>
                              ₱{(isOverdue ? totalDue : baseTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}
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

          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6 max-h-[85vh] flex flex-col">
              <h3 className="font-bold text-[#0a1e3f] text-base mb-4 shrink-0">All Units</h3>
              <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2">
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400 text-[10px] uppercase tracking-wider font-bold sticky top-0 bg-white border-b border-slate-100 z-10">
                    <tr><th className="pb-2">UNIT</th><th className="pb-2 text-right">STATUS</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUnits.map((unit) => {
                      const status = localStatuses[unit.id];
                      const isSelected = selectedUnit?.id === unit.id;
                      const isRowVacant = unit.status === 'Vacant';
                      
                      return (
                        <tr 
                          key={unit.id} 
                          onClick={() => setSelectedUnit(unit)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0f9f1]' : 'hover:bg-slate-50'}`}
                        >
                          <td className={`py-3 ${isSelected ? 'font-bold text-[#359b46]' : 'font-medium text-slate-700'} rounded-l-lg pl-2`}>
                            {unit.property_name} {unit.unit_number}
                            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[150px]">
                              {!isRowVacant && unit.tenant_name && unit.tenant_name !== '—' ? unit.tenant_name : 'Vacant'}
                            </div>
                          </td>
                          <td className="py-3 text-right pr-2 rounded-r-lg">
                            {status === 'Paid' && <span className="text-emerald-600 font-bold text-[11px]">Paid</span>}
                            {status === 'Overdue' && <span className="text-red-600 font-bold text-[11px]">Overdue</span>}
                            {status === 'Pending' && <span className="text-amber-600 font-bold text-[11px]">Pending</span>}
                            {status === 'Sent' && <span className="text-blue-600 font-bold text-[11px]">Sent</span>}
                            {status === 'N/A' && <span className="text-slate-400 font-medium text-[11px]">Vacant</span>}
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
      )}

      {/* COMPUTATION MODAL (Global) */}
      {isComputationModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Calculator className="text-[#1d82f5]" size={20} />
                <h2 className="text-lg font-bold text-[#0a1e3f]">Global Billing Config</h2>
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
                  <label className="block text-sm font-bold text-red-600 mb-2">Late Penalty Configuration</label>
                  <div className="flex gap-2">
                    <select value={compPenaltyType} onChange={(e) => setCompPenaltyType(e.target.value)} className="w-1/3 px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm bg-white">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={compPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={compPenaltyValue} onChange={(e) => setCompPenaltyValue(e.target.value)} className="w-2/3 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm" />
                  </div>
                </div>

                <div className="mt-6 flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsComputationModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 bg-[#1d82f5] hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-bold shadow-sm transition-colors">Save Globally</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-2 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#0a1e3f]">Pay rent</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSimulating}>
                <X size={20} />
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <p className="text-slate-500 mb-6">
                {selectedUnit?.property_name} · {selectedUnit?.unit_number} - total <span className="font-bold text-[#0a1e3f]">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </p>

              <div className="flex gap-3 mb-6">
                <button 
                  onClick={() => setPaymentMethod('QR Ph')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    paymentMethod === 'QR Ph' 
                      ? 'bg-blue-50 text-[#1d82f5] border-blue-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  QR Ph
                </button>
                <button 
                  onClick={() => setPaymentMethod('GCash')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                    paymentMethod === 'GCash' 
                      ? 'bg-blue-50 text-[#1d82f5] border-blue-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  GCash
                </button>
              </div>

              <div className="flex justify-center mb-6">
                <div className="border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center justify-center">
                  <div className="w-48 h-48 bg-white relative overflow-hidden rounded-xl">
                    <Image 
                      src={paymentMethod === 'QR Ph' ? '/qr-ph.png' : '/qr-gcash.png'} 
                      alt={`Scan to pay with ${paymentMethod}`}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>

              {paymentMethod === 'QR Ph' && (
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">GCash</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">Maya</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">BPI</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">UnionBank</span>
                </div>
              )}

              <div className="bg-blue-50/70 p-4 rounded-xl text-[13px] text-[#1e3a63] mb-6">
                {paymentMethod === 'QR Ph' 
                  ? "One QR Ph code - scan with whatever wallet or bank app you already use."
                  : "Scan this code directly using the GCash app to complete your payment."}
              </div>

              <button 
                onClick={handleSimulatePayment}
                disabled={isSimulating}
                className="w-full bg-[#1d82f5] hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
              >
                {isSimulating ? "Processing..." : "Simulate payment confirmed →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}