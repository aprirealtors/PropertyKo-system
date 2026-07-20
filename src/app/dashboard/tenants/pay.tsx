"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabase } from "@/utils/supabase/client";
import { Receipt, CreditCard, Download, ShieldCheck, AlertCircle, X, CalendarClock } from 'lucide-react';

export default function PayTab() {
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Global Computation Settings
  const [globalComp, setGlobalComp] = useState({
    duesRate: 0,
    water: 0,
    electricity: 0,
    parking: 0,
    penaltyType: 'percent',
    penaltyValue: 0,
    collectionDay: 1,
    gracePeriod: 15
  });

  // Modal & Payment States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'QR Ph' | 'GCash'>('QR Ph');
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      setIsLoading(false);
      return;
    }
    
    try {
      // 1. Pull user profile
      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (profile) {
        // 2. Fetch Organization Billing Config
        const { data: orgData } = await supabase
          .from('organizations')
          .select('dues_rate, default_water, default_electricity, default_parking, penalty_type, penalty_value, collection_day, grace_period_days')
          .eq('admin_email', profile.admin_email)
          .single();

        if (orgData) {
          setGlobalComp({
            duesRate: orgData.dues_rate || 0,
            water: orgData.default_water || 0,
            electricity: orgData.default_electricity || 0,
            parking: orgData.default_parking || 0,
            penaltyType: orgData.penalty_type || 'percent',
            penaltyValue: orgData.penalty_value || 0,
            collectionDay: orgData.collection_day || 1,
            gracePeriod: orgData.grace_period_days || 15
          });
        }

        // 3. Fetch the Unit assigned to this tenant
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();
          
        if (unitData) {
          setUnit(unitData);
        }

        // 4. Fetch transaction history
        const { data: txData } = await supabase
          .from('transactions') 
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .order('created_at', { ascending: false });

        if (txData) {
          setTransactions(txData);
        }
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations (Mirroring Manager/Owner Logic)
  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const currentStatus = unit?.payment_status || 'Pending';
  const isPaid = currentStatus === 'Paid';
  const unitArea = getUnitAreaValue(unit?.unit_area);
  
  const rent = unit?.monthly_rent || 0;
  const dues = globalComp.duesRate * unitArea;
  const parking = globalComp.parking;
  const water = globalComp.water;
  const electricity = globalComp.electricity;

  const baseTotal = rent + dues + parking + water + electricity;

  let lateFee = 0;
  if (currentStatus === 'Overdue') {
    if (globalComp.penaltyType === 'percent') {
      lateFee = baseTotal * (globalComp.penaltyValue / 100);
    } else {
      lateFee = globalComp.penaltyValue;
    }
  }

  const totalDue = baseTotal + lateFee;

  // Generate 12 months for the Ledger
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
    if (!unit || ledgerData.length === 0) return;

    const headers = ["PERIOD", "DUE DATE", "RENT", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    
    const rows = ledgerData.map(row => {
      const isOverdue = row.status === 'Overdue';
      const rowRent = rent > 0 ? rent : 0;
      const rowDues = dues > 0 ? dues : 0;
      const rowParking = parking > 0 ? parking : 0;
      const rowUtils = (water + electricity) > 0 ? (water + electricity) : 0;
      const rowPenalty = isOverdue ? lateFee : 0;
      const rowTotal = isOverdue ? totalDue : baseTotal;

      return [
        `"${row.monthName} ${row.year}"`,
        `"${row.dueDate}"`,
        rowRent,
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
    link.setAttribute("download", `${unit.property_name.replace(/\s+/g, '_')}_Unit_${unit.unit_number}_Statement_${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setTimeout(async () => {
      // 1. Update Unit Status
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', unit.id);
      
      // 2. Insert Transaction Record
      const newTx = {
        admin_email: unit.admin_email,
        tenant_name: unit.tenant_name,
        amount: totalDue,
        description: `Statement Payment for ${unit.property_name} - ${unit.unit_number}`,
        payment_method: paymentMethod,
        status: 'Paid'
      };

      const { data: txData } = await supabase.from('transactions').insert([newTx]).select().single();
      
      // 3. Update UI
      setUnit((prev: any) => ({ ...prev, payment_status: 'Paid' }));
      if (txData) {
        setTransactions((prev: any) => [txData, ...prev]);
      }

      setIsSimulating(false);
      setIsPaymentModalOpen(false);
    }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-500 text-sm">Manage your statement of account and view transaction records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Payment Action & History */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-[#0b1727] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            {/* Status Badge */}
            <div className="absolute top-6 right-6">
              {currentStatus === 'Overdue' && <span className="bg-red-500/20 text-red-400 font-bold px-3 py-1 rounded-full text-xs border border-red-500/30">Overdue</span>}
              {currentStatus === 'Pending' && <span className="bg-amber-500/20 text-amber-400 font-bold px-3 py-1 rounded-full text-xs border border-amber-500/30">Pending</span>}
              {currentStatus === 'Sent' && <span className="bg-blue-500/20 text-blue-400 font-bold px-3 py-1 rounded-full text-xs border border-blue-500/30">Issued</span>}
              {currentStatus === 'Paid' && <span className="bg-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-full text-xs border border-emerald-500/30">Settled</span>}
            </div>

            <p className="text-xs font-semibold opacity-70 uppercase tracking-widest mb-1 mt-2">Total Amount Due</p>
            <h2 className={`text-4xl font-extrabold mb-6 tracking-tighter ${isPaid ? 'text-emerald-400' : 'text-[#359b46]'}`}>
              ₱{isLoading ? "..." : (isPaid ? 0 : totalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
            </h2>
            
            <div className="space-y-3 mb-8">
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Monthly Rent</span>
                <span className="font-bold">₱{isLoading ? "0" : rent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Assoc. Dues ({unitArea} sqm)</span>
                <span className="font-bold">{dues > 0 ? `₱${dues.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Parking</span>
                <span className="font-bold">{parking > 0 ? `₱${parking.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Water</span>
                <span className="font-bold">{water > 0 ? `₱${water.toLocaleString()}` : "—"}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Electricity</span>
                <span className="font-bold">{electricity > 0 ? `₱${electricity.toLocaleString()}` : "—"}</span>
              </div>
              {lateFee > 0 && !isPaid && (
                <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                  <span className="text-red-400 font-semibold">Late Penalty</span>
                  <span className="font-bold text-red-400">₱{lateFee.toLocaleString()}</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={isPaid || totalDue === 0 || isLoading}
              className="w-full bg-[#359b46] hover:bg-[#2e8a3d] disabled:bg-[#359b46]/20 disabled:text-white/50 disabled:cursor-not-allowed transition-all rounded-2xl py-4 font-bold text-[15px] shadow-lg flex items-center justify-center gap-2"
            >
              <CreditCard size={20} /> {isPaid ? "Payment Settled" : "Pay Online Now"}
            </button>
            <p className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-4 uppercase tracking-wider">
              <ShieldCheck size={12} /> Secure Payment via GCash / QR Ph
            </p>
          </section>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-[#0a1e3f]">Transaction History</h3>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
              {isLoading ? (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center text-slate-400 h-full">
                  <AlertCircle size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No payment history found.</p>
                </div>
              ) : (
                transactions.map((tx, idx) => (
                  <HistoryItem 
                    key={idx}
                    title={tx.description || "Statement Payment"} 
                    method={tx.payment_method || "Online Transfer"} 
                    date={new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                    amount={`₱${(tx.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`} 
                    status={tx.status || "Paid"} 
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: The Ledger */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-[#0a1e3f] flex items-center gap-2">
                  <CalendarClock className="text-[#359b46]" size={18} />
                  Billing Ledger ({new Date().getFullYear()})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Due: Day {globalComp.collectionDay} | Penalty: Day {globalComp.collectionDay + globalComp.gracePeriod}
                </p>
              </div>
              <button 
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-[13px] font-bold text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100 shadow-sm"
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
            
            <div className="overflow-x-auto relative">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 shadow-sm">
                  <tr>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">PERIOD</th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">DUE DATE</th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">RENT</th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">DUES</th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">PARKING</th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">UTILITIES</th>
                    <th className="px-4 py-4 whitespace-nowrap bg-red-50 text-red-700 border-r border-red-100">
                      PENALTY ({globalComp.penaltyType === 'percent' ? `${globalComp.penaltyValue}%` : `₱${globalComp.penaltyValue}`})
                    </th>
                    <th className="px-4 py-4 whitespace-nowrap border-r border-slate-200">STATUS</th>
                    <th className="px-4 py-4 text-right whitespace-nowrap font-black">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {ledgerData.map((row, idx) => {
                    const isRowPaid = row.status === 'Paid';
                    const isRowOverdue = row.status === 'Overdue';
                    const activeRow = row.isCurrentMonth;
                    
                    return (
                      <tr key={idx} className={activeRow ? "bg-blue-50/40" : "hover:bg-slate-50 transition-colors"}>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100 font-bold text-[#0a1e3f] uppercase text-[10px]">
                          {row.monthName} {row.year} {activeRow && <span className="text-[#359b46] ml-1">*</span>}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100 text-slate-500">{row.dueDate}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{rent > 0 ? `₱${rent.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{dues > 0 ? `₱${dues.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{parking > 0 ? `₱${parking.toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">{(water + electricity) > 0 ? `₱${(water + electricity).toLocaleString()}` : "—"}</td>
                        
                        <td className={`px-4 py-3.5 whitespace-nowrap border-r border-slate-100 ${isRowOverdue ? 'text-red-600 font-bold bg-red-50/50' : ''}`}>
                          {isRowOverdue && lateFee > 0 ? `₱${lateFee.toLocaleString()}` : "—"}
                        </td>
                        
                        <td className="px-4 py-3.5 whitespace-nowrap border-r border-slate-100">
                          {row.status === 'Paid' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] uppercase">Paid</span>}
                          {row.status === 'Overdue' && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full text-[10px] uppercase">Overdue</span>}
                          {row.status === 'Pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-[10px] uppercase">Pending</span>}
                          {row.status === 'Sent' && <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full text-[10px] uppercase">Sent</span>}
                          {row.status === 'Upcoming' && <span className="text-slate-400 text-[10px] uppercase font-bold">Upcoming</span>}
                        </td>

                        <td className={`px-4 py-3.5 text-right whitespace-nowrap font-bold ${isRowPaid ? 'text-emerald-600' : 'text-[#0a1e3f]'}`}>
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

      {/* PAYMENT MODAL (Same experience as Manager/Owner) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 pb-2 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[#0a1e3f]">Pay your bill</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSimulating}>
                <X size={20} />
              </button>
            </div>
            
            <div className="px-6 pb-6">
              <p className="text-slate-500 mb-6">
                {unit?.property_name} · Unit {unit?.unit_number} - total <span className="font-bold text-[#0a1e3f]">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
                {isSimulating ? "Processing Payment..." : "I've paid, submit receipt →"}
              </button>
            </div>
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
        <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
          <Receipt size={18} />
        </div>
        <div>
          <h4 className="font-bold text-[#0a1e3f] text-sm truncate max-w-[180px] sm:max-w-[220px]">{title}</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{method} • {date}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[#0a1e3f] text-sm">{amount}</p>
        <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wide">
          {status}
        </p>
      </div>
    </div>
  );
}