"use client";

import React, { useEffect, useState } from 'react';
import { History, Search, Download, Filter, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client 
// Ensure you have these environment variables set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define a TypeScript interface for your mapped transaction data
interface Transaction {
  id: string;
  org: string;
  amount: string;
  date: string;
  status: string;
  method: string;
}

export default function PaymentHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchLedgerData() {
      try {
        setLoading(true);
        // Fetching from the 'organizations' table based on your database schema
        const { data, error } = await supabase
          .from('organizations')
          .select('id, org_name, created_at, plan, billing_status');

        if (error) {
          console.error("Error fetching organizations:", error);
          return;
        }

        if (data) {
          // Mapping the organization data to fit your Ledger UI structure
          const mappedData = data.map((org: any) => ({
            id: org.id ? `ORG-${String(org.id).substring(0, 4).toUpperCase()}` : "TXN-0000",
            org: org.org_name || "Unknown Organization",
            // Using 'plan' as a placeholder for 'amount' since it's an organizations table
            amount: org.plan === 'Enterprise' ? 'Enterprise' : '₱99/unit', 
            date: org.created_at 
              ? new Date(org.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
              : "N/A",
            status: org.billing_status || "Pending",
            // Defaulting method as it doesn't exist in the current organizations table
            method: "Bank Transfer", 
          }));

          setTransactions(mappedData);
        }
      } catch (err) {
        console.error("Unexpected error during fetch:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLedgerData();
  }, []);

  // Simple client-side search filter
  const filteredTransactions = transactions.filter(txn => 
    txn.org.toLowerCase().includes(searchTerm.toLowerCase()) || 
    txn.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight flex items-center gap-3">
            <History className="text-blue-500" size={32} />
            Global Ledger
          </h2>
          <p className="text-slate-500 text-sm sm:text-base font-medium">View all historical payments remitted by tenant organizations.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Filter size={16} />
            Filter
          </button>
          <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID or Org..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm transition-all shadow-sm bg-white"
            />
          </div>
          <div className="text-sm font-semibold text-slate-500">
            Showing <span className="text-slate-800">{filteredTransactions.length}</span> records
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Loading ledger data...</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-white text-slate-400 text-[11px] uppercase font-black border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Organization</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Amount (Plan)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((txn, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#1d82f5] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50">{txn.id}</span>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-slate-800">{txn.org}</td>
                      <td className="px-6 py-4 font-medium text-slate-500">{txn.date}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-600 border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                          {txn.method}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-widest ${
                          txn.status.toLowerCase() === 'paid' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                        } border`}>
                          <CheckCircle2 size={12} strokeWidth={3} />
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-base">{txn.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}