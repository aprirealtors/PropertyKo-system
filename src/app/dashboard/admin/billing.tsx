"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, QrCode } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database & UI States
  const [leasedUnits, setLeasedUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'QR Ph' | 'GCash'>('QR Ph');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Fetch actual occupied units from the database
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchLeasedUnits();
    }
  }, [orgData?.admin_email]);

  const fetchLeasedUnits = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .neq('status', 'Vacant') // Only get units that have tenants
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching units:", error);
    } else if (data && data.length > 0) {
      setLeasedUnits(data);
      setSelectedUnit(data); // Auto-select the first unit
      
      // Assign SOA statuses (Check Database first, fallback to mock for demo)
      const statuses: Record<string, string> = {};
      data.forEach((u, index) => {
        if (u.payment_status) {
          statuses[u.id] = u.payment_status; // Use real DB status
        } else {
          // If no status in DB yet, show demo data
          if (index === 0) statuses[u.id] = 'Overdue';
          else if (index % 2 !== 0) statuses[u.id] = 'Sent';
          else statuses[u.id] = 'Paid';
        }
      });
      setLocalStatuses(statuses);
    }
    setIsLoading(false);
  };

  // Generate initials for the avatar
  const initials = orgData?.org_name 
    ? orgData.org_name.substring(0, 2).toUpperCase() 
    : "AD";

  // Calculate SOA values dynamically based on the unit's rent
  const rent = selectedUnit?.monthly_rent || 0;
  const dues = rent * 0.10; // Mock association dues (10%)
  const water = 640;
  const electricity = 3180;
  const currentStatus = selectedUnit ? localStatuses[selectedUnit.id] : '';
  const lateFee = currentStatus === 'Overdue' ? 500 : 0;
  const totalDue = rent + dues + water + electricity + lateFee;

  // PERMANENT DB SAVE: Simulate Payment
  const handleSimulatePayment = () => {
    setIsSimulating(true);
    setTimeout(async () => {
      // 1. Update UI Instantly
      setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
      
      // 2. Save to Database forever
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', selectedUnit.id);
      
      setIsSimulating(false);
      setIsPaymentModalOpen(false);
    }, 1000);
  };

  // PERMANENT DB SAVE: Manual override for marking as paid
  const handleMarkAsPaid = async () => {
    if (selectedUnit) {
      setIsMarkingPaid(true);
      
      // 1. Update UI Instantly
      setLocalStatuses(prev => ({ ...prev, [selectedUnit.id]: 'Paid' }));
      
      // 2. Save to Database forever
      await supabase.from('units').update({ payment_status: 'Paid' }).eq('id', selectedUnit.id);
      
      setIsMarkingPaid(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
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
      ) : leasedUnits.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-500 font-medium">No active leases found.</p>
          <p className="text-xs text-slate-400 mt-2">Add tenants to your units to generate SOAs.</p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-end mb-4">
            <h3 className="font-bold text-[#0a1e3f] text-lg">
              Statement of account - {selectedUnit?.property_name} · {selectedUnit?.unit_number}
            </h3>
            {currentStatus === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full text-xs border border-red-100">Overdue 9 days</span>}
            {currentStatus === 'Sent' && <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full text-xs border border-amber-100">Awaiting Payment</span>}
            {currentStatus === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full text-xs border border-emerald-100">Settled</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main SOA Details */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="space-y-4 mb-6">
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200"><span className="text-slate-600">Monthly rent</span><span className="font-bold text-[#0a1e3f]">₱{rent.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200"><span className="text-slate-600">Association dues</span><span className="font-bold text-[#0a1e3f]">₱{dues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200"><span className="text-slate-600">Water</span><span className="font-bold text-[#0a1e3f]">₱{water.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                <div className="flex justify-between pb-4 border-b border-dashed border-slate-200"><span className="text-slate-600">Electricity (sub-meter)</span><span className="font-bold text-[#0a1e3f]">₱{electricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                {lateFee > 0 && (
                  <div className="flex justify-between pb-4 border-b border-slate-200"><span className="text-slate-600">Late payment fee</span><span className="font-bold text-[#0a1e3f]">₱{lateFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                )}
              </div>
              <div className="flex justify-between items-center mb-8">
                <span className="font-extrabold text-[#0a1e3f] text-lg">Total due</span>
                <span className="font-extrabold text-[#0a1e3f] text-xl">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              
              <div className="flex flex-wrap gap-3 mb-4">
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={currentStatus === 'Paid'}
                  className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                >
                  {currentStatus === 'Paid' ? 'Payment Settled' : 'Collect via GCash / QR Ph'}
                </button>
                
                {currentStatus !== 'Paid' && (
                  <button 
                    onClick={handleMarkAsPaid}
                    disabled={isMarkingPaid}
                    className="bg-white border border-[#359b46] hover:bg-[#f0f9f1] text-[#359b46] disabled:opacity-50 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                  >
                    {isMarkingPaid ? 'Saving...' : 'Mark as Paid'}
                  </button>
                )}

                <button className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-colors">
                  Send reminder
                </button>
              </div>
              <p className="text-[13px] text-slate-500">Itemized rent + dues + utilities on one multi-payee SOA - what foreign tools don't do.</p>
            </div>

            {/* Sidebar: All SOAs */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                <h3 className="font-bold text-[#0a1e3f] text-base mb-4">All SOAs</h3>
                <table className="w-full text-left text-sm">
                  <thead className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                    <tr><th className="pb-2">UNIT</th><th className="pb-2">TOTAL</th><th className="pb-2 text-right">STATUS</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leasedUnits.map((unit) => {
                      const status = localStatuses[unit.id];
                      const isSelected = selectedUnit?.id === unit.id;
                      
                      return (
                        <tr 
                          key={unit.id} 
                          onClick={() => setSelectedUnit(unit)}
                          className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0f9f1]' : 'hover:bg-slate-50'}`}
                        >
                          <td className={`py-3 ${isSelected ? 'font-bold text-[#359b46]' : 'text-slate-600'} rounded-l-lg pl-2`}>
                            {unit.unit_number}
                          </td>
                          <td className="py-3 text-slate-900 font-medium">
                            ₱{(unit.monthly_rent + (unit.monthly_rent * 0.1) + 640 + 3180 + (status === 'Overdue' ? 500 : 0)).toLocaleString()}
                          </td>
                          <td className="py-3 text-right pr-2 rounded-r-lg">
                            {status === 'Paid' && <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md text-[10px] border border-emerald-100">Paid</span>}
                            {status === 'Overdue' && <span className="bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-md text-[10px] border border-red-100">Overdue</span>}
                            {status === 'Sent' && <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded-md text-[10px] border border-amber-100">Sent</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="bg-emerald-50/50 p-4 rounded-xl text-[13px] text-slate-600 border border-emerald-100/50 leading-relaxed font-medium">
                Aggregator webhook (PayMongo / Xendit) auto-marks SOA paid the instant GCash settles.
              </div>
            </div>
          </div>
        </>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
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

              {/* Tabs */}
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

              {/* Custom Image QR Code Area */}
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

              {/* Badges */}
              {paymentMethod === 'QR Ph' && (
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">GCash</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">Maya</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">BPI</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">UnionBank</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">any QR Ph app</span>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-50/70 p-4 rounded-xl text-[13px] text-[#1e3a63] mb-6">
                {paymentMethod === 'QR Ph' 
                  ? "One QR Ph code - scan with whatever wallet or bank app you already use."
                  : "Scan this code directly using the GCash app to complete your payment."}
              </div>

              {/* Simulate Button */}
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