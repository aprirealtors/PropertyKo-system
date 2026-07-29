"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  ArrowLeft, CreditCard, Building2, Search, Download, 
  Home, Menu, X, Bell, Eye, Users, Folder, Calendar 
} from "lucide-react";

// Helper to make the day look nice (1st, 2nd, 3rd, 15th, etc.)
const getOrdinalSuffix = (i: number) => {
  const j = i % 10, k = i % 100;
  if (j == 1 && k != 11) return i + "st";
  if (j == 2 && k != 12) return i + "nd";
  if (j == 3 && k != 13) return i + "rd";
  return i + "th";
};

// Helper function to calculate the actual upcoming date based on the declared billing day
const calculateNextBillingDate = (billingDay: number | undefined | null) => {
  if (!billingDay) return "Not Set";

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Create candidate date for the current month
  let targetDate = new Date(currentYear, currentMonth, billingDay);

  // If today is past the billing day, target the same day next month
  if (today.getDate() > billingDay) {
    targetDate = new Date(currentYear, currentMonth + 1, billingDay);
  }

  return targetDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper for dynamic status badge colors
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'late': return 'bg-red-100 text-red-700 border-red-200';
    case 'pending': default: return 'bg-amber-100 text-amber-700 border-amber-200';
  }
};

export default function SuperAdminBilling() {
  const router = useRouter();
  
  // Data States
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // UI & Modal States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching organizations for billing:", error);
    } else {
      setOrganizations(data || []);
    }
    setIsLoading(false);
  };

  // Filter Orgs based on Search
  const filteredOrgs = organizations.filter(org => 
    org.org_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    org.admin_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers for the new modal buttons
  const handleSendReminder = () => {
    alert(`Reminder sent to ${selectedOrg?.admin_email}`);
  };

  const handleViewPayment = () => {
    alert(`Viewing payment history for ${selectedOrg?.org_name}`);
  };

  // Derived Variables for Modal
  const billingStatus = selectedOrg?.billing_status || 'Pending';
  const nextBillingDateFormatted = calculateNextBillingDate(selectedOrg?.billing_day);

  return (
    <div className="min-h-screen bg-[#f4f7fb] flex flex-col font-sans">
      
      {/* PREMIUM STICKY HEADER */}
      <header className="sticky top-0 z-40 w-full bg-[#0a1e3f]/95 backdrop-blur-md border-b border-white/10 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          {/* Logo Area */}
          <div className="flex items-center gap-4">
            <div 
              className="bg-white p-2.5 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.1)] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform" 
              onClick={() => router.push('/dashboard/superadmin')}
            >
              <div className="relative w-32 h-8 sm:w-36 sm:h-9">
                <Image
                  src="/logos.png"
                  alt="PropertyKo Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="hidden lg:block h-8 w-px bg-white/20 mx-2"></div>
            <h1 className="hidden lg:block text-lg font-bold tracking-wide text-slate-100">Billing Console</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-5">
            <button 
              onClick={() => router.push('/dashboard/superadmin')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-lg transition-all font-semibold text-sm shadow-inner"
            >
              Back to Dashboard
            </button>
            
            <div className="flex items-center gap-3 pl-4 border-l border-white/20">
              <div className="bg-gradient-to-r from-emerald-600 to-[#359b46] px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-sm">
                Finance Root
              </div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#0a1e3f] border-b border-white/10 shadow-xl py-4 px-4 flex flex-col gap-3 z-50">
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false);
                router.push('/dashboard/superadmin');
              }}
              className="flex items-center gap-3 w-full bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl transition-colors font-semibold text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 mt-4 gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0a1e3f] mb-2 tracking-tight">Billing & Revenue</h2>
            <p className="text-slate-500 text-sm sm:text-base font-medium">Manage organization folders and their individual billing.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Search & Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="font-extrabold text-xl text-[#0a1e3f] flex items-center gap-2">
            <Folder size={22} className="text-[#1d82f5]" /> 
            Client Folders
          </h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search folders..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/50 focus:border-[#1d82f5] bg-white shadow-sm transition-all"
            />
          </div>
        </div>

        {/* FOLDER GRID LAYOUT */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-3xl h-[320px] border border-slate-200 shadow-sm animate-pulse p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4 mt-2">
                  <div className="h-6 w-8 bg-slate-100 rounded-md"></div>
                  <div className="h-5 w-16 bg-slate-100 rounded-full"></div>
                </div>
                <div className="h-24 w-full bg-slate-100 rounded-2xl mb-4"></div>
                <div className="h-4 w-3/4 bg-slate-100 rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-slate-100 rounded mb-auto"></div>
                <div className="h-10 w-full bg-slate-100 rounded-xl mt-4"></div>
              </div>
            ))}
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 py-20 text-center flex flex-col items-center">
            <div className="bg-slate-50 p-5 rounded-full mb-4">
              <Folder size={48} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">No Folders Found</h3>
            <p className="text-slate-500">We couldn't find any organizations matching "{searchTerm}".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOrgs.map((org, index) => (
              <div 
                key={index} 
                className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 p-6 flex flex-col hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group relative"
              >
                {/* Decorative Top Folder Tab */}
                <div className="absolute top-0 left-8 w-14 h-1.5 bg-gradient-to-r from-[#1d82f5] to-blue-500 rounded-b-md opacity-80"></div>
                
                {/* Top Row: Folder Icon & Status */}
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="text-slate-300 group-hover:text-blue-200 transition-colors">
                    <Folder size={24} strokeWidth={2.5} className="fill-slate-50 group-hover:fill-blue-50 transition-colors" />
                  </div>
                  <StatusBadge text="Active" color="green" />
                </div>
                
                {/* LOGO PLACEHOLDER: BIG RECTANGLE WITH OBJECT-CONTAIN */}
                <div className="w-full h-24 mb-4 bg-slate-50/80 border border-slate-100 shadow-inner rounded-2xl flex items-center justify-center overflow-hidden shrink-0 group-hover:border-blue-100 transition-colors p-3">
                  {org.logo_url ? (
                    <img 
                      src={org.logo_url} 
                      alt={`${org.org_name} logo`} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xl font-black text-slate-400 tracking-widest uppercase">
                      {org.org_name ? org.org_name.substring(0, 3) : "ORG"}
                    </span>
                  )}
                </div>
                
                <h3 className="font-extrabold text-[#0a1e3f] text-lg truncate mb-1" title={org.org_name}>
                  {org.org_name}
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate mb-2" title={org.admin_email}>
                  {org.admin_email}
                </p>

                {/* Billing Date Indicator - Displays the Actual Next Date */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-5 bg-slate-50 w-fit px-2 py-1 rounded-md">
                  <Calendar size={12} className="text-[#1d82f5]" />
                  <span>Due: {org.billing_day ? calculateNextBillingDate(org.billing_day) : 'Not Set'}</span>
                </div>
                
                {/* Footer action button */}
                <div className="mt-auto pt-5 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      setSelectedOrg(org);
                      setIsBillingModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-[#1d82f5] text-slate-600 hover:text-white border border-slate-200 hover:border-[#1d82f5] px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm"
                  >
                    <Building2 size={16} />
                    View Billing Info
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ORGANIZATION BILLING INFO MODAL */}
      {isBillingModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-[#0a1e3f]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex items-center gap-4 w-full pr-4">
                
                {/* MODAL LOGO: RECTANGULAR & OBJECT-CONTAIN */}
                <div className="w-28 h-16 flex items-center justify-center bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 shrink-0 p-2">
                  {selectedOrg.logo_url ? (
                    <img 
                      src={selectedOrg.logo_url} 
                      alt={`${selectedOrg.org_name} logo`} 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Folder size={24} className="fill-blue-50 text-slate-300" />
                  )}
                </div>

                <div className="flex-1">
                  <h2 className="text-xl font-extrabold text-[#0a1e3f] leading-tight break-words">
                    {selectedOrg.org_name}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium mt-0.5 break-words">
                    {selectedOrg.admin_email}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBillingModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors p-1.5 rounded-full shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              
              {/* Billing Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
                    <Home size={14} className="text-[#1d82f5]" />
                    Units
                  </div>
                  <p className="text-2xl font-black text-[#0a1e3f]">{selectedOrg.units_count || 0}</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">
                    <Users size={14} className="text-[#1d82f5]" />
                    Seats
                  </div>
                  <p className="text-2xl font-black text-[#0a1e3f]">{selectedOrg.users_count || 1}</p>
                </div>
              </div>

              {/* Total Monthly Bill Highlight */}
              <div className="w-full px-5 py-5 rounded-2xl border border-emerald-200 bg-emerald-50 mb-8 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Monthly Billing</p>
                  <p className="text-sm text-emerald-600 font-semibold mb-2">@ ₱99 per unit</p>
                  
                  {/* Applied Actual Billing Date in Modal */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/50 w-fit px-2.5 py-1 rounded-md">
                    <Calendar size={12} />
                    <span>Due on {nextBillingDateFormatted}</span>
                  </div>
                </div>
                <div className="text-left sm:text-right flex flex-col justify-center items-end">
                  {/* Status Badge in Modal */}
                  <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider mb-2 ${getStatusColor(billingStatus)}`}>
                    {billingStatus}
                  </span>
                  <p className="text-3xl font-black text-[#0a1e3f]">
                    ₱{((selectedOrg.units_count || 0) * 99).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Total Due (MRR)</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSendReminder}
                  className="w-full flex items-center justify-center gap-2 bg-[#0a1e3f] hover:bg-[#15305c] text-white px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <Bell size={18} />
                  Send Payment Reminder
                </button>
                <button 
                  onClick={handleViewPayment}
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 hover:border-[#1d82f5] px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-[0.98]"
                >
                  <Eye size={18} className="text-slate-400" />
                  View Payment History
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Reusable Subcomponent for Status Badge
function StatusBadge({ text, color }: { text: string, color: 'green' | 'red' | 'orange' | 'blue' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    red: 'bg-red-50 text-red-700 border-red-200/60',
    orange: 'bg-amber-50 text-amber-700 border-amber-200/60',
    blue: 'bg-blue-50 text-[#1d82f5] border-blue-200/60',
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border shadow-sm ${colors[color]}`}>
      {text}
    </span>
  );
}