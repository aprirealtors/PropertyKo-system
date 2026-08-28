"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Activity, Search, Trash2, PlusCircle, 
  RefreshCw, Clock, Database, User
} from "lucide-react";

export default function HistoryLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({}); 
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    
    // 1. Fetch the logs
    const { data: logData, error: logError } = await supabase
      .from('system_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (logError) {
      console.error("Error fetching logs:", logError);
    } else if (logData) {
      setLogs(logData);

      // 2. Get all unique organization identifiers (admin_emails)
      const orgIds = [...new Set(logData.map(log => log.organization_id).filter(Boolean))];

      if (orgIds.length > 0) {
        // ✨ FIX: Using exact column names from your database screenshot: admin_email and org_name
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('admin_email, org_name') 
          .in('admin_email', orgIds);  

        if (!orgError && orgData) {
          const map: Record<string, string> = {};
          orgData.forEach(org => {
            // ✨ FIX: Mapping admin_email to org_name
            map[org.admin_email] = org.org_name; 
          });
          setOrgMap(map);
        } else if (orgError) {
          console.error("Failed to map org names:", orgError);
        }
      }
    }
    
    setIsLoading(false);
  };

  const getActionDetails = (action: string) => {
    switch (action) {
      case 'DELETE': return { icon: <Trash2 size={16} className="text-red-500" />, color: 'text-red-600', bg: 'bg-red-50' };
      case 'INSERT': return { icon: <PlusCircle size={16} className="text-emerald-500" />, color: 'text-emerald-600', bg: 'bg-emerald-50' };
      case 'UPDATE': return { icon: <RefreshCw size={16} className="text-blue-500" />, color: 'text-blue-600', bg: 'bg-blue-50' };
      default: return { icon: <Database size={16} className="text-slate-500" />, color: 'text-slate-600', bg: 'bg-slate-50' };
    }
  };

  const formatDescription = (log: any) => {
    const table = log.table_name.toLowerCase();
    const singularTable = table.endsWith('s') ? table.slice(0, -1) : table;
    const recordName = log.record_name && log.record_name !== 'Unknown Record' ? log.record_name : 'a record';

    if (log.action === 'INSERT') return `Created ${singularTable}: ${recordName}`;
    if (log.action === 'DELETE') return `Deleted ${singularTable}: ${recordName}`;
    if (log.action === 'UPDATE') return `Updated ${singularTable}: ${recordName}`;
    
    return `System event on ${table}`;
  };

  const getOrgDisplayName = (orgId: string | null) => {
    if (!orgId) return 'Global Workspace'; 
    // Fallback to displaying the email if the name wasn't found in the map
    return orgMap[orgId] || orgId; 
  };

  const filteredLogs = logs.filter(log => 
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.actor_email && log.actor_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.record_name && log.record_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.organization_id && orgMap[log.organization_id]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#0a1e3f] mb-1 tracking-tight">Database Audit Log</h2>
          <p className="text-slate-500 text-sm font-medium">Auto-generated history of all database modifications.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search users, orgs, or tables..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
            <Activity className="animate-pulse mb-3 text-[#1d82f5]" size={32} />
            <p className="text-sm font-medium">Scanning database triggers...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-medium">No database events found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="px-6 py-4 rounded-tl-3xl">Timestamp</th>
                  <th className="px-6 py-4">User & Organization</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Target Table</th>
                  <th className="px-6 py-4">Specific Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => {
                  const style = getActionDetails(log.action);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-slate-500 font-medium text-xs gap-1.5">
                          <Clock size={14} />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                            <User size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-[#0a1e3f] text-xs">
                              {log.actor_email || 'System Action'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              {getOrgDisplayName(log.organization_id)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${style.bg} ${style.color} font-bold text-xs tracking-wider`}>
                          {style.icon}
                          {log.action}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-600 uppercase text-xs tracking-wider">{log.table_name}</span>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-[#0a1e3f] font-bold text-sm">
                          {formatDescription(log)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}