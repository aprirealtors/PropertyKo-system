import React from 'react';
import { FileText, Calendar, Home, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LeaseTab() {
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">My Lease</h2>
        <p className="text-slate-500 text-sm">View your contract details and renewal options.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Lease Details */}
        <div className="lg:col-span-7">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg mb-6 text-slate-800">Contract Summary</h3>
            <div className="space-y-6">
              <LeaseDetail icon={<Home size={20}/>} label="Unit Address" value="The Grove · Unit 3A" />
              <LeaseDetail icon={<CreditCard size={20}/>} label="Monthly rent" value="₱28,500" />
              <LeaseDetail icon={<Calendar size={20}/>} label="Lease ends" value="30 Sep 2026" />
              <LeaseDetail icon={<FileText size={20}/>} label="Security Deposit" value="₱57,000" />
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Full Contract Document</span>
                <button className="text-[#1e88e5] font-bold hover:underline flex items-center gap-1 transition-all">
                  View PDF <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Renewal Offer (High Emphasis) */}
        <div className="lg:col-span-5">
          <section className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20 sticky top-24">
            <div className="flex items-center gap-2 text-blue-200 mb-4">
              <ShieldCheck size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">Renewal Ready</span>
            </div>
            <h3 className="font-bold text-2xl mb-4">Renew your lease</h3>
            <p className="text-blue-100 mb-8 leading-relaxed">
              Continue your stay at The Grove for another year. New rate is <strong>₱29,400/mo</strong>. Everything stays the same, just e-sign to lock in your spot.
            </p>
            
            <button className="w-full bg-white text-blue-700 rounded-2xl py-4 font-bold text-lg hover:bg-slate-50 transition-all active:scale-[0.98] shadow-lg mb-4">
              Review & e-sign
            </button>
            <p className="text-center text-blue-200 text-[11px]">
              Offer valid until August 30, 2026
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function LeaseDetail({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="p-2 bg-slate-50 rounded-xl text-slate-400">{icon}</div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-slate-800 font-bold text-sm">{value}</span>
    </div>
  );
}