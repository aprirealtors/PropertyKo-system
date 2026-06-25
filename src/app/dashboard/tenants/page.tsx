'use client';

import React, { useState, useEffect } from 'react';
import { Zap, PenTool, FileText, Receipt, Mail, Home, Wrench, LogOut, ChevronRight } from 'lucide-react';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client"; 

// Import your tab components
import PayTab from './pay';
import RepairTab from './repair';
import LeaseTab from './lease';

export default function TenantDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Database States
  const [tenantName, setTenantName] = useState("Tenant");
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real tenant data on load
  useEffect(() => {
    fetchTenantData();
  }, [router]);

  const fetchTenantData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (!authData.user) {
      router.push('/');
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
        setTenantName(profile.name);

        // 2. Fetch the Unit assigned to this tenant
        // We use ilike to make the name matching case-insensitive
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();
          
        if (unitData) {
          setUnit(unitData);
        }

        // 3. Fetch recent transactions (assuming you have a transactions or payments table)
        // If this table doesn't exist yet, it will just safely return an empty array.
        const { data: txData } = await supabase
          .from('transactions') 
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .order('created_at', { ascending: false })
          .limit(5);

        if (txData) {
          setTransactions(txData);
        }
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmLogout = async () => {
    await supabase.auth.signOut(); 
    setShowLogoutModal(false);
    router.push("/"); 
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* TOP HEADER */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg p-1">
            <Image src="/logos.png" alt="Logo" width={100} height={25} />
          </div>
        </div>
        <div className="flex items-center gap-4 text-white">
          <span className="hidden sm:block px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-white/20 bg-white/10">Tenant</span>
          <button onClick={() => setShowLogoutModal(true)} className="flex items-center gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 bg-[#0b1727] p-4 hidden md:flex flex-col">
          <nav className="space-y-1">
            <NavButton active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={20} />} label="Home" />
            <NavButton active={activeTab === 'pay'} onClick={() => setActiveTab('pay')} icon={<Receipt size={20} />} label="Billing & payments" />
            <NavButton active={activeTab === 'repair'} onClick={() => setActiveTab('repair')} icon={<Wrench size={20} />} label="Maintenance" />
            <NavButton active={activeTab === 'lease'} onClick={() => setActiveTab('lease')} icon={<FileText size={20} />} label="My lease" />
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24">
           <div className="max-w-5xl mx-auto">
             {activeTab === 'home' && (
               <HomeView 
                 setActiveTab={setActiveTab} 
                 tenantName={tenantName} 
                 unit={unit} 
                 transactions={transactions} 
                 isLoading={isLoading} 
               />
             )}
             {activeTab === 'pay' && <PayTab />}
             {activeTab === 'repair' && <RepairTab />}
             {activeTab === 'lease' && <LeaseTab />}
           </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center pt-2 pb-5 z-50">
        <MobileNavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Home size={22} />} label="Home" />
        <MobileNavItem active={activeTab === 'pay'} onClick={() => setActiveTab('pay')} icon={<Receipt size={22} />} label="Pay" />
        <MobileNavItem active={activeTab === 'repair'} onClick={() => setActiveTab('repair')} icon={<Wrench size={22} />} label="Repairs" />
        <MobileNavItem active={activeTab === 'lease'} onClick={() => setActiveTab('lease')} icon={<FileText size={22} />} label="Lease" />
      </nav>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1e3f]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            <h3 className="text-xl font-bold text-[#0a1e3f] mb-2">Sign out</h3>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutModal(false)} 
                className="flex-1 py-2.5 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout} 
                className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-sm"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-component for Home View
function HomeView({ setActiveTab, tenantName, unit, transactions, isLoading }: any) {
  
  // Calculate display values based on database response
  const rentAmount = unit?.monthly_rent || 0;
  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  
  // Basic mock due date logic (e.g. rent is usually due on the 1st of the next month)
  const getDaysUntilDue = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffTime = Math.abs(nextMonth.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <p className="text-slate-500 text-sm md:text-base">Welcome back,</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{isLoading ? "Loading..." : tenantName}</h1>
      </header>
      
      {/* Amount Due Card connected to live unit data */}
      <section className="bg-[#1e88e5] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/20">
        <p className="text-xs font-semibold opacity-90 uppercase tracking-widest mb-1 md:mb-2">Amount Due</p>
        <h2 className="text-4xl md:text-5xl font-extrabold mb-3 md:mb-4 tracking-tighter">
          ₱{isLoading ? "0" : rentAmount.toLocaleString()}
        </h2>
        <p className="text-xs md:text-sm opacity-90 mb-6">
          {propertyName} · {unitNumber} {rentAmount > 0 && `· Due in ${getDaysUntilDue()} days`}
        </p>
        <button 
          onClick={() => setActiveTab('pay')} 
          disabled={rentAmount === 0}
          className="w-full bg-white text-blue-600 hover:bg-slate-50 disabled:opacity-80 disabled:cursor-not-allowed transition-colors rounded-xl py-3 font-bold flex items-center justify-center gap-2 text-sm md:text-base"
        >
          {rentAmount > 0 ? "Pay now" : "All caught up"} <ChevronRight size={18} />
        </button>
      </section>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 md:gap-4">
         <ActionCard onClick={() => setActiveTab('repair')} icon={<PenTool size={20} className="md:text-[24px] text-blue-600" />} title="Report Issue" subtitle="Snap a Photo" />
         <ActionCard onClick={() => setActiveTab('lease')} icon={<FileText size={20} className="md:text-[24px] text-blue-600" />} title="My Lease" subtitle="View Contracts" />
         <ActionCard onClick={() => setActiveTab('pay')} icon={<Receipt size={20} className="md:text-[24px] text-blue-600" />} title="History" subtitle="View Receipts" />
         <ActionCard onClick={() => setActiveTab('home')} icon={<Mail size={20} className="md:text-[24px] text-blue-600" />} title="Support" subtitle="Message PM" />
      </div>

      {/* RECENT TRANSACTIONS SECTION */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">Recent Transactions</h3>
          <button onClick={() => setActiveTab('pay')} className="text-sm font-semibold text-[#1e88e5] hover:underline">View all</button>
        </div>
        
        {/* Dynamic List */}
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">No recent transactions</p>
            </div>
          ) : (
            transactions.map((tx: any, idx: number) => (
              <TransactionItem 
                key={idx} 
                title={tx.description || "Rent Payment"} 
                date={new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} 
                amount={`₱${(tx.amount || 0).toLocaleString()}`} 
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// --- Reusable Sub-Components ---
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`
        relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 font-medium text-sm
        ${active 
          ? 'bg-[#359b46] text-white shadow-lg shadow-green-900/20' 
          : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
        }
      `}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'scale-100'}`}>
        {icon}
      </div>
      <span>{label}</span>
      
      {/* Indicator line */}
      {active && (
        <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full hidden md:block" />
      )}
    </button>
  );
}

function TransactionItem({ title, date, amount }: any) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
      <div>
        <p className="font-bold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-500">{date}</p>
      </div>
      <span className="font-bold text-slate-900">{amount}</span>
    </div>
  );
}

function ActionCard({ onClick, icon, title, subtitle }: any) {
  return (
    <button onClick={onClick} className="bg-white flex flex-col items-center text-center p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98]">
      <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-3">{icon}</div>
      <h3 className="font-bold text-sm text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full gap-1 ${active ? 'text-[#1e88e5]' : 'text-slate-400 hover:text-slate-600'}`}>
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}