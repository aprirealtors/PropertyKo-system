import React from 'react';
import { Receipt, CreditCard, Download, ShieldCheck } from 'lucide-react';

export default function PayTab() {
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-500 text-sm">Manage your rent and view transaction records.</p>
        </div>
        <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
          <Download size={16} /> Download Statement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Payment Action */}
        <div className="lg:col-span-4">
          <section className="bg-[#0b1727] rounded-3xl p-8 text-white shadow-xl">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-widest mb-1">Total Amount Due</p>
            <h2 className="text-4xl font-extrabold mb-6 tracking-tighter text-[#359b46]">₱28,500</h2>
            
            <div className="space-y-3 mb-8">
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Rent</span>
                <span className="font-bold">₱25,000</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Utilities</span>
                <span className="font-bold">₱3,500</span>
              </div>
            </div>
            
            <button className="w-full bg-[#359b46] hover:bg-[#2e8a3d] transition-all rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2">
              <CreditCard size={20} /> Pay Now
            </button>
            <p className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-4 uppercase tracking-wider">
              <ShieldCheck size={12} /> Secure Payment via PayMaya
            </p>
          </section>
        </div>

        {/* RIGHT COLUMN: History */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Transaction History</h3>
              <span className="text-[10px] font-bold bg-slate-200 px-2 py-1 rounded-md text-slate-600">JUNE 2026</span>
            </div>
            
            <div className="divide-y divide-slate-50">
              <HistoryItem month="Rent Payment - June" method="GCash" date="Jun 02, 2026" amount="₱28,500" status="Paid" />
              <HistoryItem month="Water Bill" method="QR Ph" date="May 28, 2026" amount="₱850" status="Paid" />
              <HistoryItem month="Rent Payment - May" method="GCash" date="May 02, 2026" amount="₱28,500" status="Paid" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ month, method, date, amount, status }: any) {
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-slate-100 rounded-xl text-slate-600">
          <Receipt size={18} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{month}</h4>
          <p className="text-[11px] text-slate-400 font-medium">{method} • {date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-800 text-sm">{amount}</p>
        <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">{status}</p>
      </div>
    </div>
  );
}