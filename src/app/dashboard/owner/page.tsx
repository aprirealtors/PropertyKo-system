"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { 
  Bell, CheckCircle2, ChevronRight, Camera, 
  Wrench, X, AlertTriangle, Briefcase
} from "lucide-react";

export default function OwnerDashboard() {
  const router = useRouter();
  
  // User & Data States
  const [userData, setUserData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); 
  const [teamMembers, setTeamMembers] = useState<any[]>([]); 
  
  // Dynamic Financial/Property States
  const [payoutThisMonth, setPayoutThisMonth] = useState(0);
  const [myUnitsList, setMyUnitsList] = useState<any[]>([]); 
  const [unitsCount, setUnitsCount] = useState(0);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [collectedGross, setCollectedGross] = useState(0);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  
  // Repair Modal States
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedUnitForRepair, setSelectedUnitForRepair] = useState(""); // ✨ NEW: State to track which unit is selected

  // Success & Logout Modal States
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    fetchOwnerData();
  }, []);

  const fetchOwnerData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData?.user) {
      // Fetch the owner's profile
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();
        
      if (data) {
        setUserData(data);
        
        // --- FETCH TEAM MEMBERS ---
        const { data: membersData } = await supabase
          .from('team_members')
          .select('name, email')
          .eq('admin_email', data.admin_email);
        if (membersData) {
          setTeamMembers(membersData);
        }
        
        // --- FETCH UNITS ---
        const { data: unitsData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', data.admin_email);

        if (unitsData) {
          const myUnits = unitsData.filter((unit: any) => {
            const unitFullName = `${unit.property_name} - ${unit.unit_number}`;
            const inAccessLevel = data.access_level?.includes(unitFullName);
            const isNamedOwner = unit.owner_name?.toLowerCase().trim() === data.name?.toLowerCase().trim();
            return inAccessLevel || isNamedOwner;
          });

          setMyUnitsList(myUnits); 
          setUnitsCount(myUnits.length);
          setOccupiedCount(myUnits.filter((u: any) => u.status === 'Occupied').length);
          
          const gross = myUnits.reduce((acc: number, curr: any) => acc + (curr.monthly_rent || 0), 0);
          setCollectedGross(gross);
          setPayoutThisMonth(gross); 
        }

        // --- FETCH LIVE TASKS ---
        const { data: tasksData } = await supabase
          .from('maintenance_tasks')
          .select('title, location, status, admin_email, assigned_to, cost')
          .eq('admin_email', data.admin_email);
        if (tasksData) {
          setLiveTasks(tasksData);
        }

        // --- FETCH TICKETS INBOX ---
        const { data: ticketsData } = await supabase
          .from('tickets') 
          .select('*')
          .eq('admin_email', data.admin_email)
          .order('created_at', { ascending: false });

        if (ticketsData) {
          const ownerTickets = ticketsData.filter((t: any) => {
             const loc = String(t.location || "").toLowerCase().trim();
             const access = String(data.access_level || "").toLowerCase().trim();
             return loc === "owner's unit" || (access !== "" && (loc.includes(access) || access.includes(loc)));
          });
          setMyTickets(ownerTickets);
        }
      }
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // ✨ NEW: Helper to open the modal and pre-select the unit if they only have 1
  const openRepairModal = () => {
    if (myUnitsList.length === 1) {
      setSelectedUnitForRepair(`${myUnitsList[0].property_name} - ${myUnitsList[0].unit_number}`);
    } else {
      setSelectedUnitForRepair("");
    }
    setIsRepairModalOpen(true);
  };

  const handleReportRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Upload Image
      let photoUrl = "";
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(`owner-uploads/${fileName}`, selectedImage);
          
        if (uploadError) {
          throw new Error(`Image Upload Error: ${uploadError.message}`);
        }
          
        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      // 2. Insert into the TICKETS table
      const { error } = await supabase
        .from('tickets') 
        .insert([{
          admin_email: userData?.admin_email,
          title: repairIssue,
          // ✨ FIX: Apply the selected unit if they chose one, fallback to standard access level
          location: selectedUnitForRepair || userData?.access_level || "Owner's Unit",
          description: `Best time to visit: ${repairTime}. Reported by Owner.`,
          status: 'Open', 
          photo_url: photoUrl
        }]);

      if (error) throw error;

      setIsRepairModalOpen(false);
      setRepairIssue("");
      setRepairTime("");
      setSelectedImage(null);
      setSelectedUnitForRepair("");
      
      await fetchOwnerData();
      setIsSuccessModalOpen(true);

    } catch (err: any) {
      console.error("Error submitting repair:", err);
      alert(`Failed to submit request:\n\n${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Formatter Utility
  const getStatusBadge = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') {
      return { label: 'Open', styles: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') {
      return { label: 'In Progress', styles: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
    if (s === 'completed' || s === 'resolved' || s === 'closed') {
      return { label: 'Resolved', styles: 'bg-emerald-50 text-[#359b46] border-emerald-100' };
    }
    return { label: statusValue, styles: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  // Helper to get full name and 2-letter initials
  const fullName = userData?.name || "Owner";
  const getInitials = (name: string) => {
    if (!name || name === "Owner") return "OW";
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const initials = getInitials(userData?.name);

  const unitsDisplayString = myUnitsList.map(u => u.unit_number).join(", ");
  const uniqueBusinessNames = Array.from(new Set(myUnitsList.map(u => u.business_name).filter(b => b && b !== "—")));
  const businessNameDisplay = uniqueBusinessNames.join(" | ");

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* Top Navigation */}
      <header className="w-full bg-[#0a1e3f] text-white h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="inline-block bg-white p-1.5 rounded-lg shadow-sm">
            <div className="relative w-24 sm:w-28 h-6 sm:h-7">
              <Image src="/logos.png" alt="PropertyKo Logo" fill className="object-contain object-center" priority />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-5 text-sm">
          {/* Notification Icon */}
          <button className="text-slate-300 hover:text-white transition-colors relative">
            <Bell size={18} />
            {myTickets.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0a1e3f]"></span>
              </span>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white border border-[#359b46] bg-[#2c813a]">
            Owner Portal
          </div>
          
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="text-slate-300 hover:text-white font-medium transition-colors text-xs px-3 py-1.5 border border-transparent hover:border-slate-600 rounded-full"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Greeting & Action Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a1e3f] flex items-center gap-2">
              Good day, {isLoading ? "..." : fullName} 👋
              <div className="ml-2 w-8 h-8 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-lg border border-emerald-100 hidden sm:flex">
                {initials}
              </div>
            </h1>
            
            {businessNameDisplay && (
              <div className="flex items-center gap-1.5 mt-1.5 mb-0.5">
                <Briefcase size={14} className="text-[#359b46]"/>
                <span className="text-[#359b46] font-bold text-sm">{businessNameDisplay}</span>
              </div>
            )}
            
            <p className="text-slate-500 text-sm mt-1">Here's how your units are doing this month.</p>
          </div>
          <button 
            onClick={openRepairModal} // ✨ FIX: Use new helper function here
            className="bg-white border border-slate-200 hover:border-[#359b46] text-slate-700 hover:text-[#359b46] px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <Wrench size={16} /> Report a repair
          </button>
        </div>

        {/* Big Payout Card */}
        <div className="bg-[#359b46] rounded-2xl p-6 sm:p-8 text-white shadow-md mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <p className="text-emerald-100 text-xs font-bold tracking-wider uppercase mb-2">Your Payout This Month</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
                ₱{isLoading ? "0" : payoutThisMonth.toLocaleString()}
              </h2>
              {payoutThisMonth > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium border border-white/10">
                  <CheckCircle2 size={14} className="text-white" /> Remitted to your account
                </div>
              )}
            </div>
            <button className="text-sm font-medium hover:underline flex items-center gap-1 text-emerald-50">
              See breakdown <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 3 Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">My units</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">{isLoading ? "-" : unitsCount}</h3>
            <p className="text-xs text-slate-400 truncate" title={unitsDisplayString}>
              {unitsDisplayString || "No assigned units"}
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">Occupied</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">{isLoading ? "-" : `${occupiedCount} of ${unitsCount}`}</h3>
            {occupiedCount > 0 && (
              <span className="inline-block bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">
                1 renewal due
              </span>
            )}
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-xs font-medium mb-1">Collected for you</p>
            <h3 className="text-2xl font-extrabold text-[#0a1e3f] mb-2">₱{isLoading ? "0" : collectedGross.toLocaleString()}</h3>
            <p className="text-xs text-slate-400">gross, before fees</p>
          </div>
        </div>

        {/* MY TICKETS SECTION */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[#0a1e3f] text-lg">My tickets</h3>
            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full flex items-center justify-center text-xs font-bold">
              {myTickets.length}
            </span>
          </div>
          
          {myTickets.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400 border-t border-slate-100">
              You have no active repair tickets.
            </div>
          ) : (
            myTickets.map((ticket, idx) => {
              // Cross-reference live metrics from maintenance_tasks table
              const match = liveTasks.find(task => 
                task.title === ticket.title && 
                task.location === ticket.location
              );
              
              const currentLiveStatus = match ? match.status : ticket.status;
              const badge = getStatusBadge(currentLiveStatus);

              let staffName = "Unassigned";
              if (match?.assigned_to) {
                const memberMatch = teamMembers.find(m => m.email === match.assigned_to);
                staffName = memberMatch?.name ? memberMatch.name : match.assigned_to.split('@');
              }

              return (
                <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 py-3 border-t border-slate-100">
                  <div className="space-y-1">
                    <h4 className="font-bold text-[#0a1e3f] text-sm">{ticket.title}</h4>
                    <p className="text-slate-500 text-xs mt-1">{ticket.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400 font-medium">
                      <span>Reported: <strong className="text-slate-600 font-semibold">{new Date(ticket.created_at).toLocaleDateString()}</strong></span>
                      <span>•</span>
                      <span>Assigned Staff: <strong className="text-slate-600 font-semibold">👤 {staffName}</strong></span>
                      {match?.cost !== undefined && match.cost > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-slate-600 font-bold">Cost: ₱{match.cost.toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full border ${badge.styles}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Statements Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-[#0a1e3f] text-base">Your statements</h3>
            <span className="text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600">tap to view</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 text-[10px] uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-3 whitespace-nowrap">PERIOD</th>
                  <th className="px-6 py-3 whitespace-nowrap">GROSS RENT</th>
                  <th className="px-6 py-3 whitespace-nowrap">NET PAYOUT</th>
                  <th className="px-6 py-3 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {statements.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-medium">
                      No recent statements available.
                    </td>
                  </tr>
                ) : (
                  statements.map((stmt, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-medium">{stmt.period}</td>
                      <td className="px-6 py-4">₱{stmt.gross.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-[#0a1e3f]">₱{stmt.net.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="bg-emerald-50 text-[#359b46] border border-emerald-100 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {stmt.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="text-center text-xs text-slate-400 font-medium pb-8">
          No spreadsheets, no waiting for reports. Owners just see money in and what needs a yes.
        </div>
      </main>

      {/* REPORT REPAIR MODAL */}
      {isRepairModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h2 className="text-lg font-bold text-[#0a1e3f]">Report a repair</h2>
              <button onClick={() => !isSubmitting && setIsRepairModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <form onSubmit={handleReportRepair} className="space-y-4">
                
                {/* ✨ FIX: Conditional Dropdown for Owners with Multiple Units */}
                {myUnitsList.length > 1 && (
                  <div>
                    <select
                      required
                      value={selectedUnitForRepair}
                      onChange={(e) => setSelectedUnitForRepair(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 bg-white"
                      disabled={isSubmitting}
                    >
                      <option value="" disabled>Select which unit needs repair...</option>
                      {myUnitsList.map((u) => (
                        <option key={u.id} value={`${u.property_name} - ${u.unit_number}`}>
                          {u.property_name} {u.unit_number}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <input 
                    type="text" 
                    required 
                    placeholder="What needs fixing? (e.g. leaking faucet)" 
                    value={repairIssue} 
                    onChange={(e) => setRepairIssue(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 placeholder:text-slate-400" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div>
                  <label className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                    <Camera size={20} className="text-slate-400 shrink-0" />
                    <span className={`text-sm ${selectedImage ? 'text-[#0a1e3f] font-medium' : 'text-slate-500'}`}>
                      {selectedImage ? selectedImage.name : "Add a photo"}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                      className="hidden"
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <div>
                  <input 
                    type="text" 
                    required 
                    placeholder="Best time for the caretaker to visit" 
                    value={repairTime} 
                    onChange={(e) => setRepairTime(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm text-slate-700 placeholder:text-slate-400" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm"
                  >
                    {isSubmitting ? "Sending..." : "Send request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 z-">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8">
            <div className="w-16 h-16 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Request Submitted</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Your repair request has been successfully sent to the property manager.
            </p>
            <button 
              onClick={() => setIsSuccessModalOpen(false)} 
              className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Confirm Logout</h2>
            <p className="text-slate-500 text-sm mb-6">Are you sure you want to log out of your portal?</p>
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