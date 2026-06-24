"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  LayoutDashboard, Box, Home, Wrench, CreditCard, BarChart3, Settings, 
  ChevronDown, AlertTriangle, Menu, X 
} from "lucide-react";

// Import all split components
import DashboardTab from "./dashboard";
import PropertiesAndUnitsTab from "./propertiesandunits";
import LeasingAndTenantsTab from "./leasingandtenants";
import MaintenanceTab from "./maintenance";
import BillingTab from "./billing";
import KPIReportsTab from "./kpireports";
import TeamTab from "./teamandsubscription";

export default function AdminDashboard() {
  const router = useRouter();
  
  // Navigation & Modal States
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Database States for the logged-in Organization
  const [orgData, setOrgData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the logged-in user and their specific organization data
  useEffect(() => {
    const fetchOrgData = async () => {
      setIsLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        
        if (authData?.user?.email) {
          const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('admin_email', authData.user.email)
            .single();
            
          if (data) {
            setOrgData(data);
          }
        }
      } catch (err) {
        console.error("Error fetching org data:", err);
      }
      setIsLoading(false);
    };

    fetchOrgData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // Helper function to handle tab switching and closing mobile menu
  const handleTabChange = (tabName: string) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false); // Close menu on mobile after clicking
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Global Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Hamburger Button (Mobile Only) */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="sm:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors mr-1"
          >
            <Menu size={20} />
          </button>

          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7">
              <Image
                src="/logos.png"
                alt="PropertyKo Logo"
                fill
                className="object-contain object-center"
                priority
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="hidden sm:block px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-[#2a4d7a] bg-[#1e3a63]">
            Admin Portal
          </div>
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Mobile Sidebar Overlay Backdrop (NO BLUR) */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-[#0a1e3f]/50 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Left Sidebar - Now responsive! */}
        <aside 
          className={`absolute sm:static inset-y-0 left-0 z-50 w-64 bg-[#0a1e3f] text-slate-300 flex flex-col shrink-0 overflow-y-auto border-t border-white/5 transition-transform duration-300 ease-in-out ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
          }`}
        >
          {/* Mobile Header for Sidebar */}
          <div className="sm:hidden flex items-center justify-between p-4 border-b border-white/10">
            <span className="font-bold text-white text-sm">Menu</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* DYNAMIC Workspace Info */}
          <div className="p-4 sm:mt-2">
            <div className="bg-[#122955] rounded-xl p-3 border border-[#1e3a63] shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Workspace</div>
              <div className="font-bold text-white text-sm flex items-center gap-2 truncate" title={orgData?.org_name}>
                {isLoading ? "Loading..." : orgData?.org_name || "Setup Required"} 
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-normal text-emerald-100 bg-[#359b46] px-1.5 py-0.5 rounded shadow-sm">
                  {isLoading ? "..." : orgData?.plan || "Trial"}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                  {isLoading ? "-" : orgData?.users_count || 1} managers
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-2 space-y-1 mb-6">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" isActive={activeTab === "Dashboard"} onClick={() => handleTabChange("Dashboard")} />
            <NavItem icon={<Box size={18} />} label="Properties & units" isActive={activeTab === "Properties"} onClick={() => handleTabChange("Properties")} />
            <NavItem icon={<Home size={18} />} label="Leasing & tenants" isActive={activeTab === "Leasing"} onClick={() => handleTabChange("Leasing")} />
            <NavItem icon={<Wrench size={18} />} label="Maintenance & repairs" isActive={activeTab === "Maintenance"} onClick={() => handleTabChange("Maintenance")} />
            <NavItem icon={<CreditCard size={18} />} label="Billing & payments" isActive={activeTab === "Billing"} onClick={() => handleTabChange("Billing")} />
            <NavItem icon={<BarChart3 size={18} />} label="KPI reports" isActive={activeTab === "KPI"} onClick={() => handleTabChange("KPI")} />
            <NavItem icon={<Settings size={18} />} label="Team & subscription" isActive={activeTab === "Team"} onClick={() => handleTabChange("Team")} />
          </nav>
        </aside>

        {/* Dynamic Main Content Area */}
        <main className="flex-1 bg-[#f8fafc] overflow-y-auto p-4 sm:p-6 lg:p-10 w-full">
          {/* onNavigate prop added to DashboardTab below */}
          {activeTab === "Dashboard" && <DashboardTab orgData={orgData} isLoading={isLoading} onNavigate={handleTabChange} />}
          {activeTab === "Properties" && <PropertiesAndUnitsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Leasing" && <LeasingAndTenantsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Maintenance" && <MaintenanceTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Billing" && <BillingTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "KPI" && <KPIReportsTab orgData={orgData} isLoading={isLoading} />}
          {activeTab === "Team" && <TeamTab orgData={orgData} isLoading={isLoading} />}
        </main>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Confirm Logout</h2>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your workspace?</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setIsLogoutModalOpen(false)} 
                className="flex-1 px-4 py-3 sm:py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 sm:py-2.5 rounded-lg text-sm font-semibold transition-all ${
        isActive 
          ? "bg-[#359b46] text-white shadow-sm" // Green active state
          : "text-slate-400 hover:bg-[#122955] hover:text-slate-200"
      }`}
    >
      <span className={isActive ? "text-white" : "text-slate-400"}>{icon}</span>
      {label}
    </button>
  );
}