"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  X, CreditCard, CheckCircle, Home, AlertTriangle, 
  LogOut, LayoutDashboard, History, User, ChevronRight, Folder,
  ChevronUp, ChevronDown, BarChart3, Users, Building2
} from "lucide-react";

// Import your tab components
import PaymentHistory from './paymenthistory';
import SuperAdminBilling from './billing';
import OrganizationDirectory from './organization';

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('home');

  // Database Data State
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);

  // Layout Modal States
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoadingOrgs(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching organizations:", error);
    } else {
      setOrganizations(data || []);
    }
    setIsLoadingOrgs(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Derived Metrics for HomeView
  const totalUnits = organizations.reduce((sum, org) => sum + (org.units_count || 0), 0);
  const totalMRR = totalUnits * 99;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f4f7fb] text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[#0a1e3f] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center">
            <div className="relative w-28 h-6 sm:w-32 sm:h-7">
              <Image
                src="/logos.png"
                alt="PropertyKo Logo"
                fill
                className="object-contain object-center"
                priority
              />
            </div>
          </div>
          <div className="hidden lg:block h-6 w-px bg-white/20 mx-2"></div>
          <h1 className="hidden lg:block text-sm font-bold tracking-wide text-slate-100">Super Admin Console</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          <div className="bg-gradient-to-r from-blue-600 to-[#1d82f5] px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white shadow-sm border border-blue-400/30">
            Super Admin
          </div>
          <button 
            onClick={() => setIsLogoutModalOpen(true)} 
            className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-white/10 hover:bg-white/5 rounded-full"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PREMIUM DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0a1e3f] px-4 py-6 hidden md:flex flex-col border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.05)] z-10">
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-blue-300/70 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <NavButton 
              active={activeTab === 'home'} 
              onClick={() => setActiveTab('home')} 
              icon={<Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} 
              label="Dashboard" 
            />

            <NavButton 
              active={activeTab === 'organizations'} 
              onClick={() => setActiveTab('organizations')} 
              icon={<Folder size={18} strokeWidth={activeTab === 'organizations' ? 2.5 : 2} />} 
              label="Organizations" 
            />
            
            <div className="mt-8 mb-4 pt-4 border-t border-white/10">
              <h3 className="px-3 text-[10px] font-black text-blue-300/70 tracking-[0.25em] uppercase">Finance & Billing</h3>
            </div>

            <NavButton 
              active={activeTab === 'billing'} 
              onClick={() => setActiveTab('billing')} 
              icon={<CreditCard size={18} strokeWidth={activeTab === 'billing' ? 2.5 : 2} />} 
              label="Organization Billing" 
            />

            <NavButton 
              active={activeTab === 'paymenthistory'} 
              onClick={() => setActiveTab('paymenthistory')} 
              icon={<History size={18} strokeWidth={activeTab === 'paymenthistory' ? 2.5 : 2} />} 
              label="Payment History" 
            />
          </nav>

          {/* Premium Bottom User Tag */}
          <div className="mt-auto pt-4 border-t border-white/10">
             <div 
               onClick={() => setIsAccountModalOpen(true)}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-[#1e88e5] flex items-center justify-center font-bold text-xs border border-blue-500/30 shrink-0">
                  SA
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">System Admin</p>
                  <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">Root Account</p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 relative transition-all overflow-y-auto p-4 md:p-8 pb-[100px] md:pb-8 custom-scrollbar">
           <div className="mx-auto w-full max-w-7xl transition-all duration-300">
             {activeTab === 'home' && (
               <HomeView 
                 organizations={organizations}
                 totalUnits={totalUnits}
                 totalMRR={totalMRR}
               />
             )}
             {activeTab === 'organizations' && (
               <OrganizationDirectory 
                 organizations={organizations}
                 isLoadingOrgs={isLoadingOrgs}
                 fetchOrganizations={fetchOrganizations}
               />
             )}
             {/* UPDATED: Passing the callback to change tabs */}
             {activeTab === 'billing' && (
               <SuperAdminBilling 
                 onNavigateToHistory={() => setActiveTab('paymenthistory')} 
               />
             )}
             {activeTab === 'paymenthistory' && <PaymentHistory />}
           </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/50 pb-safe z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1 py-2">
          <MobileNavItem 
            active={activeTab === 'home' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('home'); setIsAccountModalOpen(false);}} 
            icon={<LayoutDashboard size={22} />} 
            label="Dashboard" 
          />
          <MobileNavItem 
            active={activeTab === 'organizations' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('organizations'); setIsAccountModalOpen(false);}} 
            icon={<Folder size={22} />} 
            label="Orgs" 
          />
          <MobileNavItem 
            active={activeTab === 'billing' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('billing'); setIsAccountModalOpen(false);}} 
            icon={<CreditCard size={22} />} 
            label="Billing" 
          />
          <MobileNavItem 
            active={activeTab === 'paymenthistory' && !isAccountModalOpen} 
            onClick={() => {setActiveTab('paymenthistory'); setIsAccountModalOpen(false);}} 
            icon={<History size={22} />} 
            label="History" 
          />
          <MobileNavItem 
            active={isAccountModalOpen} 
            onClick={() => setIsAccountModalOpen(true)} 
            icon={<User size={22} />} 
            label="Account" 
          />
        </div>
      </nav>

      {/* ACCOUNT MODAL */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 sm:duration-500">
            <div className="px-5 py-4 sm:px-6 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-[#0a1e3f] tracking-tight">Super Admin Profile</h2>
              <button 
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-slate-50/50 p-5 sm:p-6 space-y-5 custom-scrollbar pb-8 sm:pb-6">
              <div className="bg-gradient-to-r from-[#0a1e3f] to-[#15305c] rounded-2xl p-6 text-white flex flex-row items-center gap-5 shadow-lg relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl border border-white/20 shadow-inner z-10">SA</div>
                <div className="flex-1 z-10">
                  <h3 className="font-extrabold text-lg">System Administrator</h3>
                  <p className="text-xs font-bold text-blue-200 mt-1 tracking-widest uppercase">Root Access</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] pb-2 border-b border-slate-50">Account Details</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email Address</label>
                    <p className="text-sm font-semibold text-slate-600 bg-slate-50 py-2 rounded-xl border border-slate-100 px-3">superadmin@propertyko.com</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Platform Privilege</label>
                    <span className="inline-flex text-[10px] font-black text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded tracking-widest uppercase">Super Admin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight">Sign Out</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">Are you sure you want to log out?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
                >Cancel</button>
                <button
                  onClick={handleLogout}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-md shadow-red-500/20"
                >Confirm Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .custom-scrollbar::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// COMPONENTS
// -------------------------------------------------------------------------------------------------

function HomeView({ organizations, totalUnits, totalMRR }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm sm:text-base font-medium">Monitor ecosystem health and manage client tenants.</p>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="ACTIVE ORGS" 
          value={organizations?.length?.toString() || "0"} 
          subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronUp size={14} strokeWidth={3} /> Active accounts</span>} 
          icon={Building2}
        />
        <StatCard 
          title="UNITS MANAGED" 
          value={(totalUnits || 0).toLocaleString()} 
          subtext={<span className="text-[#359b46] font-medium">System-wide ecosystem</span>} 
          icon={Home}
        />
        <StatCard 
          title="PLATFORM MRR" 
          value={`₱${(totalMRR || 0).toLocaleString()}`} 
          subtext={<span className="text-[#359b46] font-medium">@ ₱99 / unit</span>} 
          icon={BarChart3}
        />
        <StatCard 
          title="GLOBAL CHURN" 
          value="0.0%" 
          subtext={<span className="flex items-center text-[#359b46] gap-1 font-medium"><ChevronDown size={14} strokeWidth={3} /> Exceptionally healthy</span>} 
          icon={Users}
        />
      </div>

      {/* Bottom Cards: Platform Health & Feature Flags */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6 sm:p-8">
          <h3 className="font-extrabold text-lg text-[#0a1e3f] mb-6 flex items-center gap-2">
            <CheckCircle className="text-emerald-500" size={20} />
            Platform Health
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Payment gateway (GCash)</span>
              <StatusBadge text="Operational" color="green" />
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-sm font-semibold text-slate-700">QR Ph settlement</span>
              <StatusBadge text="Operational" color="green" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6 sm:p-8">
          <h3 className="font-extrabold text-lg text-[#0a1e3f] mb-6 flex items-center gap-2">
            <LayoutDashboard className="text-[#1d82f5]" size={20} />
            Global Feature Flags
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Auto-accept tenants</span>
              <span className="text-xs font-bold text-slate-500">Enabled Globally</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <span className="text-sm font-semibold text-slate-700">Asset monetization beta</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">3 Orgs Testing</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-slate-700">Owner e-statements</span>
              <span className="text-xs font-bold text-slate-500">Enabled Globally</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}

function StatCard({ title, value, subtext, icon: Icon }: { title: string, value: string, subtext: React.ReactNode, icon: any }) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 flex flex-col justify-between h-40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
      <div className="absolute -right-4 -bottom-4 text-slate-50 opacity-60 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        {Icon && <Icon size={120} strokeWidth={1} />}
      </div>
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-3">
          <div className="text-xs font-black text-slate-400 tracking-widest uppercase">{title}</div>
          {Icon && <Icon size={18} className="text-slate-300" />}
        </div>
        <div className="text-3xl sm:text-4xl font-black text-[#0a1e3f] mb-2 tracking-tight">{value}</div>
        <div className="text-xs font-semibold">{subtext}</div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, badge }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
        active ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`transition-transform duration-300 ${active ? 'text-[#1e88e5] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
          {icon}
        </div>
        <span className="tracking-wide">{label}</span>
      </div>
      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#1e88e5] rounded-r-full shadow-[0_0_10px_#1e88e5]" />}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label, badge }: any) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center flex-1 h-14 transition-colors">
      {active && <span className="absolute inset-1.5 bg-blue-500/10 rounded-xl animate-in zoom-in duration-200 shadow-sm" />}
      <div className={`relative z-10 flex flex-col items-center justify-center transition-all duration-300 ease-out w-full ${active ? 'text-[#1e88e5] -translate-y-1 scale-[1.05]' : 'text-slate-400 hover:text-slate-600'}`}>
        <div className="relative">{icon}</div>
        <span className="text-[9px] font-black mt-0.5 uppercase tracking-tight">{label}</span>
      </div>
    </button>
  );
}

function StatusBadge({ text, color }: { text: string, color: 'green' | 'red' | 'orange' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    red: 'bg-red-50 text-red-700 border-red-200/60',
    orange: 'bg-amber-50 text-amber-700 border-amber-200/60',
    blue: 'bg-blue-50 text-[#1d82f5] border-blue-200/60',
  };
  return <span className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-widest border shadow-sm ${colors[color]}`}>{text}</span>;
}