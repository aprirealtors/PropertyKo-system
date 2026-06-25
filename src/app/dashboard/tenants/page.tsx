'use client';
import React, { useState } from 'react';
import { Zap, PenTool, FileText, Receipt, Mail, Home, Wrench, LogOut, ChevronRight } from 'lucide-react';
import Image from "next/image";

// Import your tab components
import PayTab from './pay';
import RepairTab from './repair';
import LeaseTab from './lease';

export default function TenantDashboard() {
  const [activeTab, setActiveTab] = useState('home');

return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* TOP HEADER - Layout from image_20b3a3.png */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-lg p-1">
            <Image src="/logos.png" alt="Logo" width={100} height={25} />
          </div>
        </div>
        <div className="flex items-center gap-4 text-white">
          <span className="text-sm">Tenant</span>
          <button className="flex items-center gap-2 text-sm hover:text-slate-300">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR - Layout from image_20b3a3.png */}
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
             {activeTab === 'home' && <HomeView setActiveTab={setActiveTab} />}
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
    </div>
  );
}

function HomeView({ setActiveTab }: any) {
  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <p className="text-slate-500 text-sm md:text-base">Welcome back,</p>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Ms. Lara Cruz</h1>
      </header>
      
      {/* Amount Due Card - Responsive padding */}
      <section className="bg-[#1e88e5] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/20">
        <p className="text-xs font-semibold opacity-90 uppercase tracking-widest mb-1 md:mb-2">Amount Due</p>
        <h2 className="text-4xl md:text-5xl font-extrabold mb-3 md:mb-4 tracking-tighter">₱28,500</h2>
        <p className="text-xs md:text-sm opacity-90 mb-6">The Grove · Unit 3A · Due in 3 days</p>
        <button onClick={() => setActiveTab('pay')} className="w-full bg-white text-blue-600 hover:bg-slate-50 transition-colors rounded-xl py-3 font-bold flex items-center justify-center gap-2 text-sm md:text-base">
          Pay now <ChevronRight size={18} />
        </button>
      </section>

      {/* Grid - ginamit ang gap-3 para sa mobile, gap-4 para sa desktop */}
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
          <button className="text-sm font-semibold text-[#1e88e5] hover:underline">View all</button>
        </div>
        
        {/* Placeholder para sa listahan */}
        <div className="space-y-4">
          <TransactionItem title="Rent Payment - June" date="Jun 05, 2026" amount="₱28,500" />
          <TransactionItem title="Water Bill" date="May 28, 2026" amount="₱850" />
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

// Sub-component para sa bawat row ng transaction
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