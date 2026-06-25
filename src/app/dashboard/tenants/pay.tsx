"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { Receipt, CreditCard, Download, ShieldCheck, AlertCircle } from 'lucide-react';

export default function PayTab() {
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        // 2. Fetch the Unit assigned to this tenant for Rent amount
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();
          
        if (unitData) {
          setUnit(unitData);
        }

        // 3. Fetch transaction history
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

  // Calculations
  const rentAmount = unit?.monthly_rent || 0;
  const utilitiesAmount = 0; // Update this if you add a utilities column to your units table later
  const totalDue = rentAmount + utilitiesAmount;

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Billing & Payments</h2>
          <p className="text-slate-500 text-sm">Manage your rent and view transaction records.</p>
        </div>
        <button className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
          <Download size={16} /> Download Statement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Payment Action */}
        <div className="lg:col-span-4">
          <section className="bg-[#0b1727] rounded-3xl p-8 text-white shadow-xl">
            <p className="text-xs font-semibold opacity-70 uppercase tracking-widest mb-1">Total Amount Due</p>
            <h2 className="text-4xl font-extrabold mb-6 tracking-tighter text-[#359b46]">
              ₱{isLoading ? "..." : totalDue.toLocaleString()}
            </h2>
            
            <div className="space-y-3 mb-8">
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Rent</span>
                <span className="font-bold">₱{isLoading ? "0" : rentAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-b border-slate-700 pb-2">
                <span className="opacity-70">Utilities</span>
                <span className="font-bold">₱{utilitiesAmount.toLocaleString()}</span>
              </div>
            </div>
            
            <button 
              disabled={totalDue === 0 || isLoading}
              className="w-full bg-[#359b46] hover:bg-[#2e8a3d] disabled:bg-[#359b46]/50 disabled:cursor-not-allowed transition-all rounded-2xl py-4 font-bold text-lg shadow-lg flex items-center justify-center gap-2"
            >
              <CreditCard size={20} /> {totalDue > 0 ? "Pay Now" : "All Paid"}
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
              <span className="text-[10px] font-bold bg-slate-200 px-2 py-1 rounded-md text-slate-600">ALL TIME</span>
            </div>
            
            <div className="divide-y divide-slate-50">
              {isLoading ? (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center text-slate-400">
                  <AlertCircle size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No payment history found.</p>
                </div>
              ) : (
                transactions.map((tx, idx) => (
                  <HistoryItem 
                    key={idx}
                    title={tx.description || "Rent Payment"} 
                    method={tx.payment_method || "Online"} 
                    date={new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                    amount={`₱${(tx.amount || 0).toLocaleString()}`} 
                    status={tx.status || "Paid"} 
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
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
          <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          <p className="text-[11px] text-slate-400 font-medium">{method} • {date}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-slate-800 text-sm">{amount}</p>
        <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1 uppercase tracking-wide">
          {status}
        </p>
      </div>
    </div>
  );
}