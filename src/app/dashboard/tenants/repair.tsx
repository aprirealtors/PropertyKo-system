import React from 'react';
import { Camera, Clock, Wrench, AlertCircle } from 'lucide-react';

export default function RepairTab() {
  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Maintenance & Repairs</h2>
        <p className="text-slate-500 text-sm">Submit a request and track status updates in real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Repair Form (Sticky on desktop) */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Wrench size={18} className="text-blue-600" /> New Request
            </h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="What needs fixing?" 
                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
              
              <textarea 
                placeholder="Additional details (optional)" 
                rows={3}
                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              />
              
              <button className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all">
                <Camera size={20} />
                <span className="font-medium">Attach photo</span>
              </button>

              <div className="relative">
                <Clock className="absolute left-4 top-4 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Preferred visit time" 
                  className="w-full pl-12 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <button className="w-full bg-[#1e88e5] text-white rounded-2xl py-4 font-bold hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20">
                Send Request
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Request List */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">My Requests</h3>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              <AlertCircle size={12} /> 4 total
            </div>
          </div>
          
          <div className="space-y-3">
            <RequestItem title="Aircon not cooling" date="Reported Jun 8" status="Resolved" statusColor="bg-emerald-50 text-emerald-700" />
            <RequestItem title="Bathroom light out" date="Reported Jun 11" status="In progress" statusColor="bg-amber-50 text-amber-700" />
            <RequestItem title="Leaking kitchen faucet" date="Reported Jun 15" status="In progress" statusColor="bg-amber-50 text-amber-700" />
            <RequestItem title="Bedroom door handle" date="Reported Jun 20" status="Pending" statusColor="bg-slate-100 text-slate-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestItem({ title, date, status, statusColor }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-slate-50 rounded-2xl text-slate-500">
          <Wrench size={20} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{date}</p>
        </div>
      </div>
      <div className={`${statusColor} px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wide`}>
        {status}
      </div>
    </div>
  );
}