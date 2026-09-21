"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { 
  Activity, Search, Trash2, PlusCircle, 
  RefreshCw, Clock, Database, User,
  ChevronLeft, ChevronRight, Filter
} from "lucide-react";

export default function HistoryLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [orgMap, setOrgMap] = useState<Record<string, string>>({}); 
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination & Filtering States
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [actionFilter, setActionFilter] = useState("ALL"); // ALL, INSERT, UPDATE, DELETE

  useEffect(() => {
    fetchLogs();
  }, [page, limit, actionFilter]); // Re-fetch when page, limit, or filter changes

  const fetchLogs = async () => {
    setIsLoading(true);
    
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 1. Fetch the logs with exact count for pagination
    let query = supabase
      .from('system_audit_logs')
      .select('*', { count: 'exact' });

    if (actionFilter !== "ALL") {
      query = query.eq('action', actionFilter);
    }

    const { data: logData, error: logError, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (logError) {
      console.error("Error fetching logs:", logError);
    } else if (logData) {
      setLogs(logData);
      if (count !== null) setTotalLogs(count);

      // 2. Get all unique organization identifiers (admin_emails)
      const orgIds = [...new Set(logData.map(log => log.organization_id).filter(Boolean))];

      if (orgIds.length > 0) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('admin_email, org_name') 
          .in('admin_email', orgIds);  

        if (!orgError && orgData) {
          const map: Record<string, string> = {};
          orgData.forEach(org => {
            map[org.admin_email] = org.org_name; 
          });
          setOrgMap(map);
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
    
    // Try to find a specific identifier if record_name is unknown
    const identifyRecord = (data: any) => {
      if (!data) return null;
      return data.org_name || data.name || data.email || data.title || data.id;
    };

    let recordName = log.record_name && log.record_name !== 'Unknown Record' 
      ? log.record_name 
      : identifyRecord(log.new_data) || identifyRecord(log.old_data) || 'a record';

    if (log.action === 'INSERT') return `Created ${singularTable}: ${recordName}`;
    
    if (log.action === 'DELETE') return `Deleted ${singularTable}: ${recordName}`;
    
    if (log.action === 'UPDATE') {
      let changedText = "";
      
      // Compare old and new data to find exactly what was updated
      if (log.old_data && log.new_data) {
        const changedKeys = Object.keys(log.new_data).filter(
          key => log.old_data[key] !== log.new_data[key] && key !== 'updated_at'
        );
        
        if (changedKeys.length > 0) {
          // Clean up keys for display (e.g. org_name -> Org Name)
          const readableKeys = changedKeys.map(k => k.replace(/_/g, ' '));
          changedText = ` (Modified: ${readableKeys.join(', ')})`;
        }
      }
      
      return `Updated ${singularTable}: ${recordName}${changedText}`;
    }
    
    return `System event on ${table}`;
  };

  const getOrgDisplayName = (orgId: string | null) => {
    if (!orgId) return 'Global Workspace'; 
    return orgMap[orgId] || orgId; 
  };

  // Client-side search within the currently fetched page
  const filteredLogs = logs.filter(log => 
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.actor_email && log.actor_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.record_name && log.record_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (log.organization_id && orgMap[log.organization_id]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(totalLogs / limit) || 1;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-[#0a1e3f] mb-1 tracking-tight">History Audit Log</h2>
          <p className="text-slate-500 text-sm font-medium">Auto-generated history of all database modifications.</p>
        </div>
        
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search on this page..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1d82f5]/20 focus:border-[#1d82f5] transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <Filter size={16} className="text-slate-400 ml-2 mr-1" />
          {["ALL", "INSERT", "UPDATE", "DELETE"].map((filterType) => (
            <button
              key={filterType}
              onClick={() => { setActionFilter(filterType); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                actionFilter === filterType 
                  ? 'bg-[#0a1e3f] text-white shadow-md' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {filterType === "ALL" ? "All Events" : filterType}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pr-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500">Show:</span>
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg focus:ring-[#1d82f5] focus:border-[#1d82f5] p-1.5 font-semibold"
          >
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows</option>
            <option value={500}>500 rows</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="p-20 text-center text-slate-400 flex flex-col items-center justify-center">
            <Activity className="animate-pulse mb-3 text-[#1d82f5]" size={32} />
            <p className="text-sm font-medium">Loading database events...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-20 text-center text-slate-400">
            <p className="text-sm font-medium">No database events found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[400px]">
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

        {/* Pagination Controls */}
        {!isLoading && (
          <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalLogs)} of {totalLogs} entries
            </span>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>
              
              <span className="text-xs font-bold text-[#0a1e3f]">
                Page {page} of {totalPages}
              </span>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}