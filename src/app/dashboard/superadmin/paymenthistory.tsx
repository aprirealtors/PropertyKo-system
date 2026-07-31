"use client";

import React, { useEffect, useState } from 'react';
import { History, Search, Download, CheckCircle2, Loader2, Building, CalendarClock, CreditCard, ShieldCheck, X } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx'; // Imported the library for true .xlsx export

// Initialize Supabase client 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface OrgData {
  id: string;
  admin_email: string;
  org_name: string;
  created_at: string;
  plan: string;
  billing_status: string;
  units_count: number;
  payment_method?: string;
  payment_reference?: string;
}

export default function PaymentHistory() {
  const [organizations, setOrganizations] = useState<OrgData[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Payment Verification Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Dedicated Fetch States
  const [fetchedPayment, setFetchedPayment] = useState<any>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // UseEffect to fetch reference details dynamically when modal opens
  useEffect(() => {
    if (isPaymentModalOpen && selectedOrg) {
      const fetchPayment = async () => {
        setIsFetchingPayment(true);
        const { data, error } = await supabase
          .from('organizations')
          .select('payment_method, payment_reference, billing_status')
          .eq('id', selectedOrg.id)
          .single();
          
        if (data && !error && (data.payment_method || data.payment_reference)) {
          setFetchedPayment({
            payment_method: data.payment_method,
            reference_number: data.payment_reference,
          });
        } else {
          setFetchedPayment(null);
        }
        setIsFetchingPayment(false);
      };
      fetchPayment();
    } else {
      setFetchedPayment(null);
    }
  }, [isPaymentModalOpen, selectedOrg]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setOrganizations(data);
        if (!selectedOrg) setSelectedOrg(data[0]);
      }
    } catch (err) {
      console.error("Error fetching organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerification = () => {
    if (!selectedOrg) return;
    setIsPaymentModalOpen(true);
  };

  // Filter organizations based on search
  const filteredOrgs = organizations.filter(org => 
    (org.org_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (org.id || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to generate the 12-month ledger for the selected organization
  const generateLedgerMonths = (org: OrgData | null) => {
    if (!org) return [];
    
    const months = [];
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    
    const monthlyRate = org.plan?.toLowerCase().includes('enterprise') 
      ? 'Custom' 
      : (org.units_count || 1) * 99;

    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      let stat = "Upcoming";
      let paidDate = "—";
      let method = "—";

      if (i < currentMonthIndex) {
        stat = "Paid"; 
        paidDate = `${monthName} 05, ${currentYear}`;
        method = "Digital Wallet";
      } else if (i === currentMonthIndex) {
        stat = org.billing_status || 'Pending';
        method = org.payment_method || "—";
        if (stat === 'Paid') {
          paidDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        }
      } 
      
      const dueDate = `${monthName} 01, ${currentYear}`;
      
      months.push({ 
        monthName, 
        year: currentYear, 
        dueDate, 
        paidDate,
        method,
        status: stat, 
        amount: monthlyRate === 'Custom' ? 'Enterprise' : `₱${monthlyRate.toLocaleString()}`,
        isCurrentMonth: i === currentMonthIndex 
      });
    }
    return months;
  };

  // Modern Export to True .xlsx
  const handleExportExcel = () => {
    if (!organizations || organizations.length === 0) return;

    // Create a new Workbook
    const wb = XLSX.utils.book_new();
    const sheetNames = new Set();

    organizations.forEach((org, index) => {
      // Clean sheet name: Excel allows max 31 characters and no special chars like \ / ? * [ ]
      let baseName = (org.org_name || `Org_${index + 1}`).replace(/[\\/?*[\]:]/g, "").substring(0, 28);
      let sheetName = baseName;
      let counter = 1;
      
      // Ensure completely unique sheet names
      while(sheetNames.has(sheetName)) {
         sheetName = `${baseName}_${counter}`;
         counter++;
      }
      sheetNames.add(sheetName);

      const orgLedger = generateLedgerMonths(org);

      // Map our array to exactly match the columns we want in the Excel sheet
      const excelData = orgLedger.map(row => ({
        "PERIOD": `${row.monthName} ${row.year}`,
        "DUE DATE": row.dueDate,
        "DATE PAID": row.paidDate,
        "METHOD": row.method,
        "STATUS": row.status,
        "AMOUNT": row.amount
      }));

      // Create a worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Trigger download of genuine .xlsx file
    XLSX.writeFile(wb, `Global_Ledger_${new Date().getFullYear()}.xlsx`);
  };

  const handleConfirmPayment = async () => {
    if (!selectedOrg) return;
    setIsSimulating(true);
    
    try {
      // Set to Paid
      const { error } = await supabase
        .from('organizations')
        .update({ billing_status: 'Paid' })
        .eq('id', selectedOrg.id);

      if (error) throw error;

      // Update local state immediately
      const updatedOrg = { ...selectedOrg, billing_status: 'Paid' };
      setSelectedOrg(updatedOrg);
      setOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? updatedOrg : o));
      
      setIsPaymentModalOpen(false);
      setFetchedPayment(null);

    } catch (err) {
      console.error("Error updating payment status", err);
      alert("There was an error updating the status.");
    } finally {
      setIsSimulating(false);
    }
  };

  const ledgerData = generateLedgerMonths(selectedOrg);
  const currentMonthlyAmount = selectedOrg?.plan?.toLowerCase().includes('enterprise') 
    ? 'Enterprise' 
    : `₱${((selectedOrg?.units_count || 1) * 99).toLocaleString()}`;

  return (
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-blue-500/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 shadow-sm">
                <History className="text-[#1d82f5]" size={24} strokeWidth={2.5} />
              </div>
              Global Ledger
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Track subscriptions, 12-month payment history, and confirm remittances.
            </p>
          </div>
          
          <div className="flex items-center w-full sm:w-auto gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 mt-2 sm:mt-0">
            <button 
              onClick={handleExportExcel}
              disabled={organizations.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-[#1d82f5] bg-blue-50 hover:bg-blue-100 px-5 py-3 rounded-xl transition-all border border-blue-200/60 shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Download size={16} strokeWidth={2.5} /> Export All Orgs (XLSX)
            </button>
          </div>
        </div>
      </div>

      {/* ✨ MASTER-DETAIL KANBAN LAYOUT */}
      <div className="flex-1 w-full max-w-full min-h-0 flex flex-col lg:flex-row gap-6 px-1 sm:px-0 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0">
        
        {loading ? (
          /* SKELETON LOADER */
          <div className="w-full flex justify-center items-center h-full text-slate-400 flex-col gap-4">
            <Loader2 className="animate-spin" size={40} />
            <p className="font-bold tracking-widest uppercase text-xs">Loading ledger data...</p>
          </div>
        ) : !selectedOrg ? (
          /* EMPTY STATE */
          <div className="w-full flex-1 bg-white rounded-[2rem] border border-slate-200/60 shadow-sm p-10 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
              <Building size={36} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] mb-3 tracking-tight">No Organizations Found</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
              There are no registered organizations to display in the ledger yet.
            </p>
          </div>
        ) : (
          <>
            {/* LEFT COLUMN: SELECTED ORG DETAILS & 12-MONTH LEDGER */}
            <div className="w-full lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col lg:pr-2 pb-6 lg:pb-0 order-2 lg:order-1 mt-6 lg:mt-0">
              <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm relative overflow-hidden flex flex-col lg:h-full">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-20 translate-x-20 pointer-events-none z-0"></div>

                <div className="relative z-10 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 sm:p-6 md:p-8">
                  
                  {/* Org Header & Stats */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 pb-6 border-b border-slate-100 gap-4 shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#1d82f5] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          ID: {selectedOrg.id.substring(0,8).toUpperCase()}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {selectedOrg.units_count || 1} Units
                        </span>
                      </div>
                      <h3 className="font-black text-2xl text-[#0a1e3f] tracking-tight">{selectedOrg.org_name}</h3>
                      <p className="text-slate-500 text-sm mt-1 font-medium flex items-center gap-1.5">
                        <CalendarClock size={14} /> Registered: {new Date(selectedOrg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Current Status:</span>
                        {selectedOrg.billing_status === 'Paid' ? (
                          <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-widest border border-emerald-200 shadow-sm flex items-center gap-1.5"><CheckCircle2 size={14} /> Settled</span>
                        ) : selectedOrg.billing_status === 'Late' || selectedOrg.billing_status === 'Overdue' ? (
                          <span className="bg-red-50 text-red-700 font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-widest border border-red-200 shadow-sm flex items-center gap-1.5"><X size={14} /> Overdue</span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-lg text-xs uppercase tracking-widest border border-amber-200 shadow-sm flex items-center gap-1.5"><CalendarClock size={14} /> Pending</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subscription Summary Box */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 bg-[#0a1e3f] p-5 rounded-2xl shadow-inner text-white gap-4 sm:gap-0 shrink-0">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-300 text-[10px] sm:text-xs uppercase tracking-widest mb-1">Monthly Plan Breakdown</span>
                      <span className="font-medium text-blue-200 text-sm">{selectedOrg.plan || 'Per Asset (₱99/unit)'}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <span className="font-black text-[#1d82f5] text-3xl tracking-tight drop-shadow-md">
                        {currentMonthlyAmount}
                      </span>
                      
                      {selectedOrg.billing_status !== 'Paid' && (
                        <button 
                          onClick={handleOpenVerification}
                          className="bg-[#1d82f5] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <ShieldCheck size={16} /> Verify & Confirm
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 12-MONTH LEDGER TABLE */}
                  <div className="mt-auto border-t border-slate-100 pt-6 w-full shrink-0">
                    <div className="flex items-center gap-2.5 mb-4">
                      <h4 className="font-black text-[#0a1e3f] text-base tracking-tight">12-Month Payment Ledger <span className="text-slate-400 font-bold">({new Date().getFullYear()})</span></h4>
                    </div>
                    
                    <div className="border border-slate-200/90 rounded-[1.25rem] max-h-[350px] overflow-auto relative w-full shadow-sm custom-scrollbar">
                      <table className="w-full text-left text-xs relative">
                        <thead className="bg-slate-50 font-extrabold uppercase tracking-widest border-b border-slate-200 sticky top-0 z-20 shadow-sm text-[10px] text-slate-500">
                          <tr>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-slate-200">Period</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-slate-200">Due Date</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-slate-200 text-[#1d82f5]">Date Paid</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-slate-200">Method</th>
                            <th className="px-5 py-4 whitespace-nowrap border-r border-slate-200">Status</th>
                            <th className="px-5 py-4 text-right whitespace-nowrap text-[#0a1e3f]">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white font-medium">
                          {ledgerData.map((row, idx) => {
                            const isPaid = row.status === 'Paid';
                            const isOverdue = row.status === 'Overdue' || row.status === 'Late';
                            const activeRow = row.isCurrentMonth;
                            
                            return (
                              <tr key={idx} className={`${activeRow ? "bg-blue-50/30" : "hover:bg-slate-50"} transition-colors`}>
                                <td className="px-5 py-4 whitespace-nowrap border-r border-slate-100 font-black text-[#0a1e3f] uppercase tracking-wider text-[11px]">
                                  {row.monthName} {row.year} {activeRow && <span className="text-[#1d82f5] ml-1 text-lg leading-none align-middle">*</span>}
                                </td>
                                <td className="px-5 py-4 whitespace-nowrap border-r border-slate-100 text-slate-500 font-semibold">{row.dueDate}</td>
                                
                                <td className={`px-5 py-4 whitespace-nowrap border-r border-slate-100 font-bold ${isPaid ? 'text-[#1d82f5]' : 'text-slate-400'}`}>
                                  {row.paidDate}
                                </td>
                                
                                <td className="px-5 py-4 whitespace-nowrap border-r border-slate-100 text-slate-500">{row.method}</td>
                                
                                <td className="px-5 py-4 whitespace-nowrap border-r border-slate-100 font-medium text-[10px] tracking-wider uppercase">
                                  {isPaid && <span className="text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center w-max gap-1"><CheckCircle2 size={12}/> Paid</span>}
                                  {isOverdue && <span className="text-red-600 font-bold bg-red-50 px-2.5 py-1 rounded-md border border-red-100 flex items-center w-max gap-1"><X size={12}/> Overdue</span>}
                                  {row.status === 'Pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100">Pending</span>}
                                  {row.status === 'Upcoming' && <span className="text-slate-400 font-bold">Upcoming</span>}
                                </td>

                                <td className={`px-5 py-4 text-right whitespace-nowrap font-black text-sm ${isPaid ? 'text-[#359b46]' : 'text-[#0a1e3f]'}`}>
                                  {row.amount}
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
            </div>

            {/* RIGHT COLUMN: LIST OF ORGANIZATIONS */}
            <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col lg:h-full order-1 lg:order-2">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/80 p-5 flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden w-full">
                
                <h3 className="font-black text-[#0a1e3f] text-base mb-4 shrink-0 uppercase tracking-widest px-2 flex items-center gap-2">
                  <Building size={16} className="text-[#1d82f5] shrink-0"/> Organizations <span className="text-slate-400 font-medium text-sm ml-auto bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{filteredOrgs.length}</span>
                </h3>

                <div className="relative mb-4 shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search orgs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1d82f5] text-sm bg-slate-50/50"
                  />
                </div>
                
                {/* Scrollable List */}
                <div className="max-h-[350px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto custom-scrollbar pr-2 w-full">
                  <div className="space-y-3 pb-4 w-full">
                    {filteredOrgs.map((org) => {
                      const isSelected = selectedOrg?.id === org.id;
                      const stat = org.billing_status || 'Pending';
                      
                      return (
                        <div 
                          key={org.id} 
                          onClick={() => setSelectedOrg(org)}
                          className={`w-full cursor-pointer p-4 rounded-2xl transition-all border ${
                            isSelected 
                              ? 'bg-[#1d82f5] border-[#1d82f5] shadow-[0_4px_15px_rgba(29,130,245,0.3)]' 
                              : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1.5 gap-2 overflow-hidden w-full">
                            <span className={`flex-1 min-w-0 block truncate font-black tracking-tight ${isSelected ? 'text-white' : 'text-[#0a1e3f]'}`}>
                              {org.org_name}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-end mt-3">
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                ID: {org.id.substring(0,6)}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-white' : 'text-slate-600'}`}>
                                {org.units_count || 1} Units
                              </span>
                            </div>
                            
                            <div className="shrink-0 flex items-center justify-end">
                              {stat === 'Paid' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>Paid</span>}
                              {(stat === 'Overdue' || stat === 'Late') && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-red-50 text-red-600 border border-red-100'}`}>Overdue</span>}
                              {stat === 'Pending' && <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>Pending</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {filteredOrgs.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-sm font-medium">No results found.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 🌟 VERIFY PAYMENT MODAL */}
      {isPaymentModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col border border-slate-200/80 animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-6 flex justify-between items-center relative overflow-hidden border-b border-slate-50">
              <h2 className="text-xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-2">
                <ShieldCheck className="text-[#1d82f5]" size={20} strokeWidth={2.5} />
                Verify Payment
              </h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSimulating || isFetchingPayment}>
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 bg-slate-50/40">
              <p className="text-[12px] sm:text-[13px] text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed">
                Confirm receipt of remittance for <strong className="font-black text-[#1d82f5] uppercase tracking-wide">{selectedOrg.org_name}</strong> for the current billing cycle.
              </p>
              
              <div className="bg-slate-50 rounded-[1.25rem] sm:rounded-2xl p-4 sm:p-5 border border-slate-200/60 mb-6 sm:mb-8 shadow-inner">
                <div className="flex justify-between items-center mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-slate-200/80 gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Total Amount</span>
                  <span className="font-black text-[#0a1e3f] text-lg sm:text-xl tracking-tight shrink-0">
                    {currentMonthlyAmount}
                  </span>
                </div>
                
                {isFetchingPayment ? (
                  <div className="py-3 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Fetching submitted details...
                  </div>
                ) : fetchedPayment ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Method Used</span>
                      <span className="text-[10px] sm:text-[11px] font-black text-[#1d82f5] bg-blue-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-blue-100 shadow-sm shrink-0">
                        {fetchedPayment.payment_method || 'Digital Wallet'}
                      </span>
                    </div>
                    
                    {fetchedPayment.payment_method !== 'Cash' && (
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Reference No.</span>
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-700 font-mono bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0 truncate max-w-[150px] sm:max-w-[200px]">
                          {fetchedPayment.reference_number || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 sm:py-4 text-center text-[12px] sm:text-[13px] font-bold text-slate-400">
                    No payment reference submitted yet.
                  </div>
                )}
              </div>

              <button 
                onClick={handleConfirmPayment} 
                disabled={isSimulating || isFetchingPayment || !fetchedPayment} 
                className="w-full bg-gradient-to-b from-[#1d82f5] to-[#1565c0] hover:shadow-[0_4px_15px_rgba(29,130,245,0.3)] disabled:from-[#92c4fc] disabled:to-[#92c4fc] disabled:shadow-none text-white font-bold uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-xl transition-all shadow-[0_2px_8px_rgba(29,130,245,0.2)] active:scale-95 flex justify-center items-center gap-2"
              >
                {isSimulating ? "Verifying..." : "Mark as Paid"} <CheckCircle2 size={16} strokeWidth={2.5} className={isSimulating ? "hidden" : "block"} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar {
          scrollbar-width: none; 
          -ms-overflow-style: none; 
        }
        .custom-scrollbar::-webkit-scrollbar { 
          display: none; 
        }
      `}} />
    </div>
  );
}