"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Wrench, MapPin, User, HardHat } from "lucide-react";

export default function MaintenanceTab({ orgData, isLoading: isOrgLoading }: any) {
  // Database States
  const [tickets, setTickets] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [reporter, setReporter] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  // Fetch actual tickets and team members
  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTickets();
      fetchTeamMembers();
    }
  }, [orgData?.admin_email]);

  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching tickets:", error.message, error.details, error.hint);
    } else {
      setTickets(data || []);
    }
    setIsLoadingTickets(false);
  };

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('name, email')
      .eq('admin_email', orgData.admin_email); // Assuming team_members are tied to the admin

    if (!error && data) {
      setTeamMembers(data);
    }
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    if (!assignedTo) {
      setErrorMsg("Please assign this ticket to a maintenance staff member.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('maintenance_tasks')
        .insert([
          { 
            admin_email: orgData.admin_email,
            title: title.trim(),
            location: location.trim(),
            description: `Reported by ${reporter.trim() || 'Tenant'}`, 
            status: 'pending', // Synced with staff dashboard
            assigned_to: assignedTo, // The email of the assigned staff
            cost: 0
          }
        ]);

      if (error) throw new Error(`Database Error: ${error.message}`);

      // Refresh board and close modal
      await fetchTickets();
      setIsModalOpen(false);
      
      // Reset form
      setTitle("");
      setLocation("");
      setReporter("");
      setAssignedTo("");

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter tickets into columns (Using synced statuses)
  const openTickets = tickets.filter(t => t.status === 'pending');
  const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
  const resolvedTickets = tickets.filter(t => t.status === 'completed');

  const initials = orgData?.org_name 
    ? orgData.org_name.substring(0, 2).toUpperCase() 
    : "AD";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Maintenance & repairs</h2>
          <p className="text-slate-500 text-sm mt-1">Tickets, vendors and SLA turnaround</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Admin</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-[#0a1e3f] text-lg">Repair tickets</h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          + New ticket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Open */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">Open</h4>
            <span className="bg-amber-100 text-amber-700 px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : openTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : openTickets.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">
                No open tickets
              </div>
            ) : (
              openTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} statusColor="yellow" statusLabel="New" />
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">In progress</h4>
            <span className="bg-blue-100 text-[#1d82f5] px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : inProgressTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : inProgressTickets.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">
                No tickets in progress
              </div>
            ) : (
              inProgressTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} statusColor="blue" statusLabel="Working" />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Resolved */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-slate-700 text-sm">Resolved</h4>
            <span className="bg-emerald-100 text-emerald-700 px-2 rounded-full text-xs font-bold">{isLoadingTickets ? "-" : resolvedTickets.length}</span>
          </div>
          <div className="space-y-4">
            {isLoadingTickets ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : resolvedTickets.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 text-center text-xs text-slate-400 bg-slate-50/50">
                No resolved tickets
              </div>
            ) : (
              resolvedTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} statusColor="green" statusLabel="Closed" showCost />
              ))
            )}
          </div>
        </div>
      </div>

      {/* NEW TICKET MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Create New Ticket</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleAddTicket} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Wrench size={16} className="text-[#359b46]" /> Issue Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aircon leaking"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><MapPin size={16} className="text-[#359b46]" /> Location / Unit</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grove 12B"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><User size={16} className="text-[#359b46]" /> Reported By</label>
                  <input
                    type="text"
                    placeholder="e.g. Juan Reyes (Tenant)"
                    value={reporter}
                    onChange={(e) => setReporter(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm"
                    disabled={isSubmitting}
                  />
                </div>

                {/* NEW ASSIGNMENT DROPDOWN */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><HardHat size={16} className="text-[#359b46]" /> Assign To</label>
                  <select
                    required
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] text-sm bg-white"
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>Select maintenance staff...</option>
                    {teamMembers.map((member) => (
                      <option key={member.email} value={member.email}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold">
                    {isSubmitting ? "Saving..." : "Create Ticket"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, statusColor, statusLabel, showCost }: any) {
  const colors: any = {
    yellow: 'bg-amber-50 text-amber-700 border border-amber-100',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    blue: 'bg-blue-50 text-[#1d82f5] border border-blue-100',
  };

  // Extract assignee name from email if needed, or just show email username
  const assigneeName = ticket.assigned_to ? ticket.assigned_to.split('@') : 'Unassigned';

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer">
      <h5 className="font-bold text-[#0a1e3f] text-sm mb-1">{ticket.title}</h5>
      <p className="text-xs text-slate-500 mb-2">{ticket.location} • {ticket.description}</p>
      
      <div className="flex justify-between items-center mt-4">
        <div className="flex gap-2 items-center">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${colors[statusColor]}`}>{statusLabel}</span>
          <span className="text-[11px] font-medium text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">
            👤 {assigneeName}
          </span>
        </div>
        {showCost && ticket.cost !== undefined && <span className="text-xs text-slate-500 font-bold">₱{ticket.cost}</span>}
      </div>
    </div>
  );
}