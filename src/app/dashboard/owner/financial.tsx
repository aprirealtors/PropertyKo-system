"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { CalendarClock, Download, X, Receipt } from "lucide-react";

export default function FinancialTab({ userData, units }: any) {
  const [selectedUnit, setSelectedUnit] = useState<any>(units?.[0] || null);
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

  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'QR Ph' | 'GCash'>('QR Ph');
  const [isSimulating, setIsSimulating] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userData?.admin_email) {
      fetchBillingConfig();
    }
    // Initialize statuses from units
    if (units) {
      const statuses: Record<string, string> = {};
      units.forEach((u: any) => {
        statuses[u.id] = u.payment_status || 'Pending';
      });
      setLocalStatuses(statuses);
      if (!selectedUnit && units.length > 0) {
        setSelectedUnit(units[0]);
      }
    }
  }, [userData?.admin_email, units]);

  const fetchBillingConfig = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days')
      .eq('admin_email', userData.admin_email)
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
    setIsLoading(false);
  };

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const currentStatus = selectedUnit ? localStatuses[selectedUnit.id] : '';
  const isVacant = selectedUnit?.status === 'Vacant';
  const unitArea = getUnitAreaValue(selectedUnit?.unit_area);
  
  // Computations
  const dues = globalComp.duesRate * unitArea;
  const water = globalComp.water;
  const electricity = globalComp.electricity;
  const parking = globalComp.parking;
  
  // Owner is billed dues + parking even if vacant
  const baseTotal = isVacant ? (dues + parking) : (dues + water + electricity + parking);

  let lateFee = 0;
  if (currentStatus === 'Overdue') {
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
      if (i < currentMonthIndex) {
        stat = "Paid"; 
      } else if (i === currentMonthIndex) {
        stat = currentStatus; 
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
      const rowDues = dues > 0 ? dues : 0;
      const rowParking = parking > 0 ? parking : 0;
      const rowUtils = (!isVacant && (water + electricity) > 0) ? (water + electricity) : 0;
      const rowPenalty = isOverdue ? lateFee : 0;
      const rowTotal = isOverdue ? totalDue : baseTotal;

      return [
        `"${row.monthName} ${row.year}"`,
        `"${row.dueDate}"`,
        rowDues,
        rowParking,
        rowUtils,
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
    link.setAttribute("download", `${selectedUnit.property_name.replace(/\s+/g, '_')}_Unit_${selectedUnit.unit_number}_SOA_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setTimeout(async () => {
      setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', selectedUnit.id);
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
    }, 1500);
  };

  if (!units || units.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center w-full">
        <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Receipt size={32} />
        </div>
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
        
        {/* Main Ledger Area */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-end mb-6 pb-6 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-[#0a1e3f] text-xl">
                  {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Tenant: <span className={`font-bold ${isVacant ? 'text-slate-400' : 'text-slate-700'}`}>
                    {isVacant ? 'Vacant' : selectedUnit?.tenant_name || '—'}
                  </span>
                </p>
              </div>
              <div>
                {currentStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1.5 rounded-full text-xs border border-red-100">Overdue</span>}
                {currentStatus === 'Pending' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-full text-xs border border-amber-100">Pending</span>}
                {currentStatus === 'Sent' && <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-full text-xs border border-blue-100">Sent</span>}
                {currentStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full text-xs border border-emerald-100">Settled</span>}
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                <span className="text-slate-600">Association dues <span className="text-xs text-slate-400 ml-1">({unitArea} sqm)</span></span>
                <span className="font-bold text-[#0a1e3f]">{dues > 0 ? `₱${dues.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
              </div>
              <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                <span className="text-slate-600">Parking</span>
                <span className="font-bold text-[#0a1e3f]">{parking > 0 ? `₱${parking.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
              </div>
              <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                <span className="text-slate-600">Water {isVacant && <span className="text-xs text-slate-400 ml-1">(Vacant)</span>}</span>
                <span className="font-bold text-[#0a1e3f]">{!isVacant && water > 0 ? `₱${water.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
              </div>
              <div className="flex justify-between pb-4 border-b border-dashed border-slate-200">
                <span className="text-slate-600">Electricity {isVacant && <span className="text-xs text-slate-400 ml-1">(Vacant)</span>}</span>
                <span className="font-bold text-[#0a1e3f]">{!isVacant && electricity > 0 ? `₱${electricity.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</span>
              </div>
              {lateFee > 0 && (
                <div className="flex justify-between pb-4 border-b border-slate-200">
                  <span className="text-red-500 font-semibold">Late payment penalty</span>
                  <span className="font-bold text-red-600">₱{lateFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-extrabold text-[#0a1e3f] text-lg">Total due {isVacant && <span className="text-sm font-medium text-slate-500 ml-2">(Owner account)</span>}</span>
              <span className="font-black text-[#359b46] text-2xl">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            
            <div className="flex gap-3 mb-8">
              <button 
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={currentStatus === 'Paid'}
                className="w-full sm:w-auto bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors"
              >
                {currentStatus === 'Paid' ? 'Payment Settled' : 'Pay Online (GCash / QR Ph)'}
              </button>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="text-[#359b46]" size={18} />
                  <h4 className="font-bold text-[#0a1e3f] text-sm">Ledger ({new Date().getFullYear()})</h4>
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 text-[13px] font-bold text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 shadow-sm"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[400px] custom-scrollbar relative">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PERIOD</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUE DATE</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">DUES</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PARKING</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">UTILITIES</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">PENALTY</th>
                      <th className="px-4 py-3 whitespace-nowrap border-r border-slate-200">STATUS</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap font-black">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 bg-white">
                    {ledgerData.map((row, idx) => {
                      const isPaid = row.status === 'Paid';
                      const isOverdue = row.status === 'Overdue';
                      const activeRow = row.isCurrentMonth;
                      
                      return (
                        <tr key={idx} className={activeRow ? "bg-blue-50/40" : "hover:bg-slate-50"}>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 font-bold text-slate-800 uppercase text-[10px]">
                            {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1">*</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200 text-slate-500">{row.dueDate}</td>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{dues > 0 ? `₱${dues.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{parking > 0 ? `₱${parking.toLocaleString()}` : "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">{(!isVacant && (water + electricity) > 0) ? `₱${(water + electricity).toLocaleString()}` : "—"}</td>
                          <td className={`px-4 py-3 whitespace-nowrap border-r border-slate-200 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                            {isOverdue && lateFee > 0 ? `₱${lateFee.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap border-r border-slate-200">
                            {row.status === 'Paid' && <span className="text-emerald-600 font-bold">Paid</span>}
                            {row.status === 'Overdue' && <span className="text-red-600 font-bold">Overdue</span>}
                            {row.status === 'Pending' && <span className="text-amber-600 font-bold">Pending</span>}
                            {row.status === 'Sent' && <span className="text-blue-600 font-bold">Sent</span>}
                            {row.status === 'Upcoming' && <span className="text-slate-400">Upcoming</span>}
                          </td>
                          <td className={`px-4 py-3 text-right whitespace-nowrap font-bold ${isPaid ? 'bg-[#22c55e] text-white' : 'text-[#0a1e3f]'}`}>
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

        {/* Sidebar Unit List */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-6 max-h-[85vh] flex flex-col">
            <h3 className="font-bold text-[#0a1e3f] text-base mb-4 shrink-0">Your Properties</h3>
            <div className="overflow-y-auto custom-scrollbar flex-1 -mr-2 pr-2">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400 text-[10px] uppercase tracking-wider font-bold sticky top-0 bg-white border-b border-slate-100 z-10">
                  <tr><th className="pb-2">UNIT</th><th className="pb-2 text-right">STATUS</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {units.map((unit: any) => {
                    const status = localStatuses[unit.id];
                    const isSelected = selectedUnit?.id === unit.id;
                    
                    return (
                      <tr 
                        key={unit.id} 
                        onClick={() => setSelectedUnit(unit)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0f9f1]' : 'hover:bg-slate-50'}`}
                      >
                        <td className={`py-3 ${isSelected ? 'font-bold text-[#359b46]' : 'font-medium text-slate-700'} rounded-l-lg pl-2`}>
                          {unit.property_name} {unit.unit_number}
                        </td>
                        <td className="py-3 text-right pr-2 rounded-r-lg">
                          {status === 'Paid' && <span className="text-emerald-600 font-bold text-[11px]">Paid</span>}
                          {status === 'Overdue' && <span className="text-red-600 font-bold text-[11px]">Overdue</span>}
                          {status === 'Pending' && <span className="text-amber-600 font-bold text-[11px]">Pending</span>}
                          {status === 'Sent' && <span className="text-blue-600 font-bold text-[11px]">Sent</span>}
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

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-2 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#0a1e3f]">Pay dues</h2>
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

              <button 
                onClick={handleSimulatePayment}
                disabled={isSimulating}
                className="w-full bg-[#1d82f5] hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
              >
                {isSimulating ? "Processing Payment..." : "I've paid, submit receipt →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}