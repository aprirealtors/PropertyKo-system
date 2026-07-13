"use client";

import React, { useState, useEffect } from 'react';
import { Camera, Clock, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from "@/utils/supabase/client";

export default function RepairTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // User Context States
  const [profile, setProfile] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>(""); // ✨ NEW: For Realtime filter

  // Form States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repairIssue, setRepairIssue] = useState("");
  const [repairTime, setRepairTime] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      setUserEmail(authData.user.email || ""); // ✨ Save email for listener

      // 1. Get Tenant Profile
      const { data: profileData } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (profileData) {
        setProfile(profileData);

        // 2. Get Tenant Unit Context
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profileData.admin_email)
          .ilike('tenant_name', profileData.name)
          .single();

        if (unitData) {
          setUnit(unitData);
        }

        // 3. Get Tickets Specific to this Tenant
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('*')
          .eq('admin_email', profileData.admin_email)
          .order('created_at', { ascending: false });

        if (ticketsData) {
          // Strictly filter by the exact user who created the ticket
          const tenantTickets = ticketsData.filter((t: any) => 
            t.reporter_email === authData.user.email || 
            (String(t.description).includes(profileData.name) && String(t.description).includes('(Tenant)'))
          );
          setTickets(tenantTickets);
        }
      }
    }
    setIsLoading(false);
  };

  // ✨ NEW: LIVE TICKETS REAL-TIME SYNC FOR TENANT
  useEffect(() => {
    if (!userEmail) return;

    const ticketsChannel = supabase
      .channel('tenant-live-repair-tickets')
      .on(
        'postgres_changes',
        {
          event: '*', // Makikinig sa Insert, Update, at Delete
          schema: 'public',
          table: 'tickets',
          filter: `reporter_email=eq.${userEmail}` // Limitahan sa tickets niya lang
        },
        (payload) => {
          console.log("Tenant Realtime Ticket Update:", payload);
          
          if (payload.eventType === 'INSERT') {
            setTickets((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setTickets((current) => 
              current.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)
            );
          } else if (payload.eventType === 'DELETE') {
            setTickets((current) => current.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  }, [userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMsg(false);

    try {
      // Get the exact reporter email securely
      const { data: authData } = await supabase.auth.getUser();
      const currentEmail = authData.user?.email || "";

      // 1. Upload Image to Supabase Storage
      let photoUrl = "";
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { data: imgData, error: uploadError } = await supabase.storage
          .from('tickets')
          .upload(`tenant-uploads/${fileName}`, selectedImage);

        if (uploadError) throw new Error(`Image Upload Error: ${uploadError.message}`);

        if (imgData) {
          const { data: publicUrlData } = supabase.storage.from('tickets').getPublicUrl(imgData.path);
          photoUrl = publicUrlData.publicUrl;
        }
      }

      // Format details automatically
      const unitLoc = unit ? `${unit.property_name} - ${unit.unit_number}` : (profile?.access_level || "Tenant Unit");
      const fullDesc = `Best time to visit: ${repairTime}. Reported by ${profile?.name || 'Tenant'} (Tenant).`;

      // 3. Save to Tickets Table WITH reporter_email
      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert([{
          admin_email: profile?.admin_email,
          reporter_email: currentEmail, 
          title: repairIssue,
          location: unitLoc,
          description: fullDesc,
          status: 'Open',
          photo_url: photoUrl
        }])
        .select()
        .single();

      if (error) throw error;

      // 4. TRIGGER NOTIFICATION FOR THE MANAGER
      await supabase
        .from('notifications')
        .insert([{
          admin_email: profile?.admin_email,
          recipient: 'MANAGER',
          type: 'TICKET',
          title: 'New Repair Request',
          message: `${profile?.name || 'A tenant'} (Tenant) reported an issue: ${repairIssue}`,
          reference_id: newTicket.id,
          is_read: false
        }]);

      // Reset form on success
      setRepairIssue("");
      setRepairTime("");
      setSelectedImage(null);
      setSuccessMsg(true);
      
      // ✨ FIX: Tinanggal na ang `await fetchData();` dito dahil automatically na 
      // isasali ng Realtime Listener yung bagong ticket sa screen ni Tenant!

      // Auto-hide success message after 4 seconds
      setTimeout(() => setSuccessMsg(false), 4000);

    } catch (err: any) {
      console.error("Submit error:", err);
      alert(`Failed to submit request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format UI badges based on database status
  const getStatusDisplay = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') {
      return { label: 'Pending', color: 'bg-slate-100 text-slate-600 border border-slate-200' };
    }
    if (s === 'in_progress' || s === 'in progress' || s === 'assigned to maintenance') {
      return { label: 'In Progress', color: 'bg-amber-50 text-amber-700 border border-amber-100' };
    }
    if (s === 'on_hold' || s === 'on hold') {
      return { label: 'On Hold', color: 'bg-purple-50 text-purple-700 border border-purple-100' };
    }
    if (s === 'completed' || s === 'resolved' || s === 'success') {
      return { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
    }
    if (s === 'failed') {
      return { label: 'Failed', color: 'bg-red-50 text-red-600 border border-red-100' };
    }
    return { label: status, color: 'bg-slate-100 text-slate-600 border border-slate-200' };
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Maintenance & Repairs</h2>
        <p className="text-slate-500 text-sm">Submit a request and track status updates in real-time.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Repair Form (Sticky on desktop) */}
        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
            
            {/* Success Overlay */}
            {successMsg && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Request Sent!</h3>
                <p className="text-sm text-slate-500 mt-1">Management has been notified.</p>
              </div>
            )}

            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Wrench size={18} className="text-blue-600" /> New Request
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                type="text" 
                required
                value={repairIssue}
                onChange={(e) => setRepairIssue(e.target.value)}
                placeholder="What needs fixing?" 
                disabled={isSubmitting}
                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              />
              
              {/* Image Upload Input */}
              <label className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center gap-2 text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all cursor-pointer bg-slate-50 hover:bg-blue-50/50">
                <Camera size={20} />
                <span className={`font-medium text-sm ${selectedImage ? 'text-blue-600 font-bold' : ''}`}>
                  {selectedImage ? selectedImage.name : "Attach photo"}
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])}
                  className="hidden"
                  disabled={isSubmitting}
                />
              </label>

              <div className="relative">
                <Clock className="absolute left-4 top-4 text-slate-400" size={20} />
                <input 
                  type="text" 
                  required
                  value={repairTime}
                  onChange={(e) => setRepairTime(e.target.value)}
                  placeholder="Preferred visit time" 
                  disabled={isSubmitting}
                  className="w-full pl-12 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#1e88e5] disabled:bg-blue-300 text-white rounded-2xl py-4 font-bold hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20"
              >
                {isSubmitting ? "Sending..." : "Send Request"}
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: Request List */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">My Requests</h3>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
              <AlertCircle size={12} /> {tickets.length} total
            </div>
          </div>
          
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-sm">Loading your requests...</div>
            ) : tickets.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <p className="text-slate-500 font-medium">You have no repair requests.</p>
              </div>
            ) : (
              tickets.map((ticket, idx) => {
                const { label, color } = getStatusDisplay(ticket.status);
                // Format the date properly
                const dateStr = `Reported ${new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                return (
                  <RequestItem 
                    key={idx} 
                    title={ticket.title} 
                    date={dateStr} 
                    status={label} 
                    statusColor={color} 
                    photo={ticket.photo_url}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component modified to optionally display thumbnail if a photo is attached
function RequestItem({ title, date, status, statusColor, photo }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4">
        {photo ? (
          <div className="w-12 h-12 rounded-2xl bg-slate-100 shrink-0 overflow-hidden relative">
            <img src={photo} alt="Issue" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-2xl text-slate-500 shrink-0">
            <Wrench size={20} />
          </div>
        )}
        
        <div>
          <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mt-0.5">{date}</p>
        </div>
      </div>
      <div className={`${statusColor} px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wide w-fit`}>
        {status}
      </div>
    </div>
  );
}