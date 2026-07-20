"use client";

import React, { useState, useEffect } from 'react';
import { 
  Zap, PenTool, FileText, Receipt, Mail, Home, Wrench, LogOut, 
  ChevronRight, Bell, CheckCheck, Trash2, User, X, MessageSquare 
} from 'lucide-react';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client"; 

// Import your tab components
import PayTab from './pay';
import RepairTab from './repair';
import LeaseTab from './lease';
import ConversationTab from './conversation'; 

export default function TenantDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('home');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // Database States
  const [userData, setUserData] = useState<any>(null); 
  const [userEmail, setUserEmail] = useState<string>(""); 
  const [tenantName, setTenantName] = useState("Tenant");
  const [unit, setUnit] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // NOTIFICATION STATES
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // State to hold Highlight ID for Repairs
  const [highlightTicketId, setHighlightTicketId] = useState<string | null>(null);

  // White Label & User Modal States
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);

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
      setUserEmail(authData.user.email || "");

      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (profile) {
        setUserData(profile);
        setTenantName(profile.name);

        // Fetch the parent admin's organization to get the white-label logo
        if (profile.admin_email) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('logo_url')
            .eq('admin_email', profile.admin_email)
            .single();

          if (orgData?.logo_url) {
            setOrgLogo(orgData.logo_url);
          }
        }

        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();
          
        if (unitData) setUnit(unitData);

        const { data: txData } = await supabase
          .from('transactions') 
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .order('created_at', { ascending: false })
          .limit(5);

        if (txData) setTransactions(txData);

        const { data: notifData } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient', authData.user.email) 
          .eq('is_hidden', false) 
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (notifData) {
          setNotifications(notifData);
          setUnreadCount(notifData.filter(n => !n.is_read).length);
        }
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userEmail) return;

    const realtimeChannel = supabase
      .channel('tenant-live-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient=eq.${userEmail}` 
        },
        (payload) => {
          setNotifications((current) => [payload.new, ...current]);
          setUnreadCount((count) => count + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [userEmail]);

  const confirmLogout = async () => {
    await supabase.auth.signOut(); 
    setShowLogoutModal(false);
    router.push("/"); 
  };

  const markAllAsRead = async () => {
    if (!userEmail) return;
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('recipient', userEmail).eq('is_read', false);
  };

  const clearAllNotifications = async () => {
    if (!userEmail) return;
    setNotifications([]);
    setUnreadCount(0);
    setIsNotifOpen(false);
    await supabase.from('notifications').update({ is_hidden: true }).eq('recipient', userEmail);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
    }
    setIsNotifOpen(false);

    const type = notif.type?.toUpperCase() || '';
    if (type === 'BILLING' || type === 'SOA') {
      setActiveTab("pay");
    } else if (type === 'MAINTENANCE' || type === 'TICKET') {
      if (notif.reference_id) {
        setHighlightTicketId(`${notif.reference_id}_${Date.now()}`); 
      }
      setActiveTab("repair");
    } else if (type === 'MESSAGE' || type === 'CHAT') {
      setActiveTab("conversation");
    } else {
      setActiveTab("home");
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "TE";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const initials = getInitials(tenantName);

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-[#0b1727] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 relative z-40 border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-3">
          
          {/* ✨ FIX: User Icon Removed completely from header as requested! */}
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7 flex items-center justify-center">
              <Image src={orgLogo || "/logos.png"} alt="Organization Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white relative">
          
          <div
            onClick={() => setIsNotifOpen(!isNotifOpen)} 
            className="relative flex items-center justify-center cursor-pointer p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-300 hover:text-white transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-[#0b1727] animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute top-14 right-0 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col text-slate-800">
                <div className="p-3 flex justify-between items-center bg-slate-50 border-b border-slate-200">
                  <h3 className="font-bold text-[#0a1e3f] text-sm">Notifications</h3>
                  <div className="flex gap-2 relative z-10">
                    <button onClick={markAllAsRead} className="text-xs text-slate-500 hover:text-[#1e88e5] flex items-center gap-1 transition-colors">
                      <CheckCheck size={14} /> Read All
                    </button>
                    <button onClick={clearAllNotifications} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                      <Trash2 size={14} /> Clear
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto relative z-10">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      No new notifications
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/50' : 'opacity-70'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-sm text-[#0a1e3f] truncate pr-2">
                            {notif.title}
                          </span>
                          {!notif.is_read && <span className="w-2 h-2 rounded-full bg-[#1e88e5] shrink-0 mt-1"></span>}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${notif.type === 'BILLING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {notif.type}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          <span className="hidden sm:block px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold text-[#1e88e5] border border-blue-500/30 bg-blue-500/10">Tenant</span>
          
          <button 
            onClick={() => setShowLogoutModal(true)} 
            className="flex items-center gap-1.5 sm:gap-2 text-slate-300 hover:text-white font-medium transition-colors text-xs px-2 sm:px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* LAYOUT WRAPPER */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* PREMIUM DESKTOP SIDEBAR */}
        <aside className="w-64 bg-[#0b1727] px-4 py-6 hidden md:flex flex-col border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.15)] z-20">
          
          <div className="mb-4">
            <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Overview</h3>
          </div>
          
          <nav className="space-y-1.5 flex-1">
            <NavButton active={activeTab === 'home'} onClick={() => {setActiveTab('home'); setHighlightTicketId(null);}} icon={<Home size={18} strokeWidth={activeTab === 'home' ? 2.5 : 2} />} label="Home" />
            <NavButton active={activeTab === 'conversation'} onClick={() => {setActiveTab('conversation'); setHighlightTicketId(null);}} icon={<MessageSquare size={18} strokeWidth={activeTab === 'conversation' ? 2.5 : 2} />} label="Messages" />
            <NavButton active={activeTab === 'repair'} onClick={() => setActiveTab('repair')} icon={<Wrench size={18} strokeWidth={activeTab === 'repair' ? 2.5 : 2} />} label="Repairs" />

            <div className="mt-8 mb-4 pt-4 border-t border-white/5">
              <h3 className="px-3 text-[10px] font-black text-slate-400 tracking-[0.25em] uppercase">Finance & Lease</h3>
            </div>

            <NavButton active={activeTab === 'pay'} onClick={() => {setActiveTab('pay'); setHighlightTicketId(null);}} icon={<Receipt size={18} strokeWidth={activeTab === 'pay' ? 2.5 : 2} />} label="Billing & Payments" />
            <NavButton active={activeTab === 'lease'} onClick={() => {setActiveTab('lease'); setHighlightTicketId(null);}} icon={<FileText size={18} strokeWidth={activeTab === 'lease' ? 2.5 : 2} />} label="My Lease" />
          </nav>

          {/* Premium Bottom User Tag (Desktop Only) */}
          <div className="mt-auto pt-4 border-t border-white/5">
             <div 
               onClick={() => setIsWorkspaceModalOpen(true)}
               className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10"
               title="View Profile Details"
             >
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-[#1e88e5] flex items-center justify-center font-bold text-xs border border-blue-500/30 shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate">{tenantName}</p>
                  <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest mt-0.5">Tenant Account</p>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
             </div>
          </div>
        </aside>

        {/* ✨ FIX: Standardized Mobile Padding for main wrapper */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-[100px] md:pb-8 relative">
           <div className="max-w-5xl mx-auto">
             {activeTab === 'home' && (
               <HomeView 
                 setActiveTab={setActiveTab} 
                 tenantName={tenantName} 
                 initials={initials}
                 openProfileModal={() => setIsWorkspaceModalOpen(true)}
                 unit={unit} 
                 transactions={transactions} 
                 isLoading={isLoading} 
               />
             )}
             {activeTab === 'pay' && <PayTab />}
             {activeTab === 'repair' && <RepairTab highlightTicketId={highlightTicketId} />}
             {activeTab === 'conversation' && <ConversationTab userData={userData} unit={unit} />}
             {activeTab === 'lease' && <LeaseTab />}
           </div>
        </main>
      </div>

      {/* ✨ UPGRADED PREMIUM MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/50 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1 py-2">
          {/* ✨ FIX: active condition now ensures they turn off when isWorkspaceModalOpen is true */}
          <MobileNavItem active={activeTab === 'home' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('home'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<Home size={22} />} label="Home" />
          <MobileNavItem active={activeTab === 'pay' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('pay'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<Receipt size={22} />} label="Pay" />
          <MobileNavItem active={activeTab === 'repair' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('repair'); setIsWorkspaceModalOpen(false);}} icon={<Wrench size={22} />} label="Repairs" />
          <MobileNavItem active={activeTab === 'conversation' && !isWorkspaceModalOpen} onClick={() => {setActiveTab('conversation'); setHighlightTicketId(null); setIsWorkspaceModalOpen(false);}} icon={<MessageSquare size={22} />} label="Chat" />
          
          {/* ✨ NEW: Account button replacing the User Header Icon for Mobile */}
          <MobileNavItem active={isWorkspaceModalOpen} onClick={() => setIsWorkspaceModalOpen(true)} icon={<User size={22} />} label="Account" />
        </div>
      </nav>

      {/* STATIC WORKSPACE PROFILE MODAL (READ-ONLY) */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Tenant Profile</h2>
              <button 
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto bg-slate-50/50 p-6 space-y-6">
              <div className="bg-gradient-to-r from-[#0b1727] to-[#1e293b] rounded-2xl p-6 text-white flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center font-black text-2xl border border-white/20">
                  {initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">{tenantName}</h3>
                  <p className="text-xs text-blue-200 mt-0.5">Active Resident</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-50">
                  Account Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Full Name</label>
                    <p className="text-sm font-semibold text-slate-800">{tenantName}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Email Address</label>
                    <p className="text-sm font-semibold text-slate-800 break-all">{userEmail || "Not available"}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Assigned Property</label>
                    <p className="text-sm font-semibold text-slate-800 break-all">
                      {unit?.property_name ? `${unit.property_name} - Unit ${unit.unit_number}` : "Not Assigned"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Access Role</label>
                    <span className="inline-block text-[10px] font-semibold text-[#1e88e5] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded mt-1">
                      Tenant
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1727]/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </div>
            <h3 className="text-xl font-bold text-[#0b1727] mb-2">Sign out</h3>
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

      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
      `}} />
    </div>
  );
}

function HomeView({ setActiveTab, tenantName, initials, openProfileModal, unit, transactions, isLoading }: any) {
  const rentAmount = unit?.monthly_rent || 0;
  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  
  const getDaysUntilDue = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffTime = Math.abs(nextMonth.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ✨ FIX: Removed redundant profile bubble in the content header to match owner side */}
      <header className="flex justify-between items-end mb-4 md:mb-6">
        <div>
          <p className="text-slate-500 text-sm md:text-base">Welcome back,</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{isLoading ? "Loading..." : tenantName}</h1>
        </div>
      </header>
      
      <section className="bg-[#1e88e5] rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-blue-500/20 transition-all hover:shadow-2xl">
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
          className="w-full bg-white text-blue-600 hover:bg-slate-50 disabled:opacity-80 disabled:cursor-not-allowed transition-all active:scale-[0.98] rounded-xl py-3 font-bold flex items-center justify-center gap-2 text-sm md:text-base"
        >
          {rentAmount > 0 ? "Pay now" : "All caught up"} <ChevronRight size={18} />
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
         <ActionCard onClick={() => setActiveTab('repair')} icon={<PenTool size={20} className="md:text-[24px] text-blue-600" />} title="Report Issue" subtitle="Snap a Photo" />
         <ActionCard onClick={() => setActiveTab('lease')} icon={<FileText size={20} className="md:text-[24px] text-blue-600" />} title="My Lease" subtitle="View Contracts" />
         <ActionCard onClick={() => setActiveTab('pay')} icon={<Receipt size={20} className="md:text-[24px] text-blue-600" />} title="History" subtitle="View Receipts" />
         <ActionCard onClick={() => setActiveTab('conversation')} icon={<Mail size={20} className="md:text-[24px] text-blue-600" />} title="Support" subtitle="Message PM" />
      </div>

      <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">Recent Transactions</h3>
          <button onClick={() => setActiveTab('pay')} className="text-sm font-semibold text-[#1e88e5] hover:underline">View all</button>
        </div>
        
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

// Premium Desktop Nav Button
function NavButton({ active, onClick, icon, label }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
        active 
          ? 'bg-white/10 text-white shadow-sm border border-white/5' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'text-[#1e88e5] scale-110' : 'text-slate-500 group-hover:text-slate-300 group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className="tracking-wide">{label}</span>
      {active && <div className="absolute left-0 -ml-4 w-1.5 h-6 bg-[#1e88e5] rounded-r-full shadow-[0_0_10px_#1e88e5]" />}
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
    <button onClick={onClick} className="bg-white flex flex-col items-center text-center p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] h-full">
      <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-3 shrink-0">{icon}</div>
      <h3 className="font-bold text-sm text-slate-800 shrink-0">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 flex-1">{subtitle}</p>
    </button>
  );
}

// Premium Mobile Nav Button (Pill Indicator, Flex-1 for even sizing)
function MobileNavItem({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all duration-300 ${active ? 'text-[#1e88e5]' : 'text-slate-400 hover:text-slate-600'}`}>
      {active && <span className="absolute inset-0 bg-blue-500/10 rounded-xl animate-in zoom-in duration-200" />}
      <div className={`relative z-50 transition-transform duration-300 ${active ? 'scale-110 -translate-y-0.5' : ''}`}>
        {icon}
      </div>
      <span className="text-[9px] font-bold mt-0.5 relative z-10">{label}</span>
    </button>
  );
}