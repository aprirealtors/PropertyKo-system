"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { MapPin, Clock, AlertCircle } from "lucide-react";

export default function ViewTicketTab({ orgData }: any) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]); // New state to read task assignments
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // New state to map staff names
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchTicketsAndLiveStatuses();
    }
  }, [orgData]);

  const fetchTicketsAndLiveStatuses = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch team members to resolve clean worker names
      const { data: membersData } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('admin_email', orgData.admin_email);
      if (membersData) setTeamMembers(membersData);

      // 2. Fetch live data from maintenance_tasks to cross-reference status and assignments
      const { data: tasksData } = await supabase
        .from('maintenance_tasks')
        .select('title, location, status, assigned_to, cost')
        .eq('admin_email', orgData.admin_email);
      if (tasksData) setLiveTasks(tasksData);

      // 3. Reads from the 'tickets' inbox table where owners submit their issues (Preserves images!)
      const { data: ticketsData, error } = await supabase
        .from('tickets') 
        .select('*')
        .eq('admin_email', orgData.admin_email)
        .order('created_at', { ascending: false });

      if (error) console.error("Error fetching tickets:", error);
      else setTickets(ticketsData || []);

    } catch (err) {
      console.error("Error loading tickets context view:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper utility to translate live table statuses into UI layout designs
  const getStatusDisplay = (statusValue: string) => {
    const s = String(statusValue || '').toLowerCase().trim();
    if (s === 'pending' || s === 'open') {
      return { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-100' };
    }
    if (s === 'in_progress' || s === 'in progress' || s === 'working' || s === 'assigned to maintenance') {
      return { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-100' };
    }
    if (s === 'completed' || s === 'resolved' || s === 'closed') {
      return { label: 'Resolved', color: 'bg-emerald-50 text-[#359b46] border-emerald-100' };
    }
    return { label: statusValue, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Assigned Tickets</h2>
          <p className="text-slate-500 text-sm mt-1">View and manage owner and tenant maintenance requests</p>
        </div>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm">
          <span className="text-sm font-bold text-slate-700">Total Open: </span>
          <span className="text-sm font-extrabold text-[#359b46]">
            {tickets.filter(t => {
              const match = liveTasks.find(lt => lt.title === t.title && lt.location === t.location);
              const s = String(match ? match.status : t.status).toLowerCase();
              return s === 'pending' || s === 'open';
            }).length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center text-slate-500">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
          <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-[#0a1e3f] text-lg">No tickets found</h3>
          <p className="text-slate-500 text-sm mt-1">There are no active repair requests right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map(ticket => {
            // Find live tracking entry from maintenance_tasks table
            const liveMatch = liveTasks.find(task => 
              task.title === ticket.title && 
              task.location === ticket.location
            );

            // Compute dynamic live context settings
            const currentLiveStatus = liveMatch ? liveMatch.status : ticket.status;
            const { label, color } = getStatusDisplay(currentLiveStatus);

            // Resolve clean name of staff worker instead of showing raw email
            let staffName = "Unassigned";
            if (liveMatch?.assigned_to) {
              const profile = teamMembers.find(m => m.email === liveMatch.assigned_to);
              staffName = profile?.name ? profile.name : liveMatch.assigned_to.split('@');
            }

            return (
              <div key={ticket.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                
                {/* Image Header */}
                {ticket.photo_url ? (
                  <div className="relative w-full h-48 bg-slate-100 border-b border-slate-100">
                    <img src={ticket.photo_url} alt="Repair issue" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="relative w-full h-24 bg-slate-50 border-b border-slate-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Photo Provided</span>
                  </div>
                )}

                {/* Card Content */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-bold text-[#0a1e3f] text-base line-clamp-2 leading-tight">{ticket.title}</h3>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${color}`}>
                      {label}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-5 flex-1 line-clamp-3">
                    {ticket.description}
                  </p>

                  {/* Footer details */}
                  <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <MapPin size={14} className="text-slate-400" /> 
                      <span className="truncate">{ticket.location}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="text-xs text-slate-400 font-medium">
                        Reported: {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {/* Dynamic Cost Tag display if registered */}
                        {liveMatch?.cost !== undefined && liveMatch.cost > 0 && (
                          <span className="text-xs font-extrabold text-[#0a1e3f] bg-slate-100 px-2 py-0.5 rounded">
                            ₱{liveMatch.cost.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[11px] font-medium text-slate-500 border border-slate-200 bg-slate-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          👤 {staffName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}