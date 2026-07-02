"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowUp, X, Building, MapPin, Tag, Banknote, User, Users, Briefcase, Maximize, CalendarDays, FileText } from "lucide-react";

export default function PropertiesAndUnitsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  const [units, setUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // ✨ NEW: Import loading state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [propertyName, setPropertyName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitType, setUnitType] = useState("Studio");
  const [ownerName, setOwnerName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  
  const [notForLease, setNotForLease] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [unitArea, setUnitArea] = useState("");
  const [turnoverDate, setTurnoverDate] = useState("");
  const [acceptanceDate, setAcceptanceDate] = useState("");
  const [remarks, setRemarks] = useState("");

  // ✨ NEW: Reference for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchUnits();
    }
  }, [orgData?.admin_email]);

  const fetchUnits = async () => {
    setIsLoadingUnits(true);
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching units:", error);
    } else {
      setUnits(data || []);
    }
    setIsLoadingUnits(false);
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const maxUnits = Number(orgData?.units_count) || 0;
    if (units.length >= maxUnits) {
      setErrorMsg(`Your plan is limited to ${maxUnits} units. Please upgrade your plan to add more.`);
      setIsSubmitting(false);
      return;
    }

    const isOccupied = tenantName.trim() !== "" || notForLease;
    const rentValue = monthlyRent.trim() !== "" ? parseFloat(monthlyRent) : 0;

    try {
      const { error } = await supabase
        .from('units')
        .insert([
          { 
            admin_email: orgData.admin_email,
            property_name: propertyName, 
            unit_number: unitNumber, 
            unit_type: unitType, 
            owner_name: ownerName.trim() || '—',
            tenant_name: notForLease ? '—' : (tenantName.trim() || '—'),
            monthly_rent: rentValue,
            status: isOccupied ? 'Occupied' : 'Vacant',
            business_name: businessName.trim() || null,
            unit_area: unitArea.trim(), 
            turnover_date: turnoverDate || null,
            acceptance_date: acceptanceDate || null,
            remarks: remarks.trim() || null
          }
        ]);

      if (error) throw new Error(`Database Error: ${error.message}`);

      await fetchUnits();
      setIsModalOpen(false);
      
      // Reset all form states
      setPropertyName("");
      setUnitNumber("");
      setUnitType("Studio");
      setOwnerName("");
      setTenantName("");
      setMonthlyRent("");
      setNotForLease(false);
      setBusinessName("");
      setUnitArea("");
      setTurnoverDate("");
      setAcceptanceDate("");
      setRemarks("");

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✨ NEW: Safe Date Parsing helper for CSV imports
  const parseDateSafe = (dateStr: string) => {
    if (!dateStr || dateStr.trim() === '') return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  };

  // ✨ NEW: CSV Import Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        
        // 1. Basic CSV Parsing (Handles quotes and commas securely)
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim().toUpperCase().replace(/^"|"$/g, ''));
        
        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
          // Regex to split by commas but ignore commas inside quotes
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          parsedData.push(obj);
        }

        // 2. Limit Check before mass insert
        const maxUnits = Number(orgData?.units_count) || 0;
        if (units.length + parsedData.length > maxUnits) {
          throw new Error(`Cannot import ${parsedData.length} units. You only have ${Math.max(0, maxUnits - units.length)} seats remaining. Please upgrade your plan.`);
        }

        // 3. Map CSV objects to Database Columns
        const newUnits = parsedData.map(row => {
          const tenant = row['TENANT'] || '—';
          const providedStatus = row['STATUS'];
          const isOccupied = tenant !== '—' || providedStatus === 'Occupied';

          return {
            admin_email: orgData.admin_email,
            property_name: row['PROPERTY'] || 'Unknown Property',
            unit_number: row['UNIT'] || 'N/A',
            unit_type: row['TYPE'] || 'Studio',
            unit_area: row['AREA'] || null,
            owner_name: row['OWNER'] || '—',
            business_name: row['BUSINESS NAME'] || null,
            tenant_name: tenant,
            monthly_rent: parseFloat(row['MONTHLY RENT']) || 0,
            turnover_date: parseDateSafe(row['TURNOVER']),
            acceptance_date: parseDateSafe(row['ACCEPTANCE']),
            remarks: row['REMARKS'] || null,
            status: providedStatus || (isOccupied ? 'Occupied' : 'Vacant')
          };
        });

        // 4. Batch Insert into Supabase
        const { error } = await supabase.from('units').insert(newUnits);
        
        if (error) throw new Error(error.message);

        // Success! Reload the board
        alert(`Successfully imported ${newUnits.length} units!`);
        await fetchUnits();

      } catch (err: any) {
        console.error("Import error:", err);
        alert(`Import Failed: ${err.message}`);
      } finally {
        setIsImporting(false);
        // Reset input so the user can upload the same file again if they fixed an error
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    
    reader.readAsText(file);
  };

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  const maxUnits = Number(orgData?.units_count) || 0;
  const activeUnits = units.length;
  const remainingUnits = Math.max(0, maxUnits - activeUnits); 

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Properties & units</h2>
          <p className="text-slate-500 text-sm mt-1">Vacancy board across the portfolio</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search tenants, units, SOA..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] focus:border-transparent bg-white shadow-sm" />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Manager</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#0a1e3f] text-sm">Property Summary Board · {isOrgLoading ? "..." : maxUnits} units</h3>
           <span className="bg-[#B7C9E2] text-slate-700 border border-[#A5B8D4] text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">Vacancy Board · {isLoadingUnits || isOrgLoading ? "..." : remainingUnits} units</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {/* ✨ NEW: Hidden file input and connected import button */}
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <ArrowUp size={14} /> {isImporting ? "Importing..." : "Import units"}
            </button>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              disabled={remainingUnits === 0 && !isLoadingUnits}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${remainingUnits === 0 && !isLoadingUnits ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#359b46] hover:bg-[#2c813a] text-white"}`}
            >
              + Add unit
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 text-[11px] uppercase font-bold border-b border-slate-100 tracking-wider">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">PROPERTY</th>
                  <th className="px-6 py-4 whitespace-nowrap">UNIT</th>
                  <th className="px-6 py-4 whitespace-nowrap">TYPE</th>
                  <th className="px-6 py-4 whitespace-nowrap">AREA</th>
                  <th className="px-6 py-4 whitespace-nowrap">OWNER</th>
                  <th className="px-6 py-4 whitespace-nowrap">BUSINESS NAME</th>
                  <th className="px-6 py-4 whitespace-nowrap">TENANT</th>
                  <th className="px-6 py-4 whitespace-nowrap">MONTHLY RENT</th>
                  <th className="px-6 py-4 whitespace-nowrap">TURNOVER</th>
                  <th className="px-6 py-4 whitespace-nowrap">ACCEPTANCE</th>
                  <th className="px-6 py-4 whitespace-nowrap">REMARKS</th>
                  <th className="px-6 py-4 whitespace-nowrap">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {isLoadingUnits ? (
                  <tr><td colSpan={12} className="px-6 py-8 text-center text-slate-400">Loading units...</td></tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-16 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Building size={32} className="text-slate-300" />
                        <p>No units added yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{unit.property_name}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_number}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_type}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_area || '—'}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.owner_name || '—'}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.business_name || '—'}</td>
                      <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">{unit.tenant_name}</td>
                      <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">₱{unit.monthly_rent.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.turnover_date ? new Date(unit.turnover_date).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.acceptance_date ? new Date(unit.acceptance_date).toLocaleDateString() : '—'}</td>
                      <td className="px-6 py-4 text-slate-600 max-w-[150px] truncate" title={unit.remarks}>{unit.remarks || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${unit.status === 'Vacant' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {unit.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">Add New Unit</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar">
              <form onSubmit={handleAddUnit} className="space-y-5">
                {errorMsg && <div className="mb-5 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{errorMsg}</div>}

                {/* Property Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><MapPin size={16} className="text-[#359b46]" /> Property Name</label>
                  <input type="text" required placeholder="e.g. The Grove, Avida Towers" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                </div>

                {/* Unit Details Row */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Building size={16} className="text-[#359b46]" /> Unit Number</label>
                    <input type="text" required placeholder="e.g. 12B" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Tag size={16} className="text-[#359b46]" /> Unit Type</label>
                    <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all bg-white" disabled={isSubmitting}>
                      <option value="Studio">Studio</option>
                      <option value="1BR">1BR</option>
                      <option value="2BR">2BR</option>
                      <option value="3BR">3BR</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Maximize size={16} className="text-[#359b46]" /> Unit Area</label>
                    <input type="text" required placeholder="e.g. 50.06 sqm" value={unitArea} onChange={(e) => setUnitArea(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Ownership Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><User size={16} className="text-[#359b46]" /> Owner Name</label>
                    <input type="text" placeholder="e.g. Juan Reyes" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Briefcase size={16} className="text-slate-400" /> Business Name (Optional)</label>
                    <input type="text" placeholder="e.g. Reyes Holdings Inc." value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Tenant & Rent Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Users size={16} className="text-slate-400" /> Tenant Name (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Leave blank if vacant" 
                      value={tenantName} 
                      onChange={(e) => setTenantName(e.target.value)} 
                      disabled={isSubmitting || notForLease} 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all disabled:bg-slate-100 disabled:text-slate-400" 
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><Banknote size={16} className="text-slate-400" /> Monthly Rent (Optional)</label>
                    <input type="number" min="0" placeholder="e.g. 25000 (if leased)" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Checkbox for Not For Lease */}
                <div className="flex items-center gap-2 px-1">
                  <input 
                    type="checkbox" 
                    id="notForLease" 
                    checked={notForLease} 
                    onChange={(e) => {
                      setNotForLease(e.target.checked);
                      if (e.target.checked) setTenantName("");
                    }}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-[#359b46] rounded border-slate-300 focus:ring-[#359b46] cursor-pointer"
                  />
                  <label htmlFor="notForLease" className="text-sm font-medium text-slate-600 cursor-pointer">
                    Owner occupying / Not for lease (Sets status to Occupied)
                  </label>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><CalendarDays size={16} className="text-slate-400" /> Turnover Date (Optional)</label>
                    <input type="date" value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all text-slate-700" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><CalendarDays size={16} className="text-slate-400" /> Acceptance Date (Optional)</label>
                    <input type="date" value={acceptanceDate} onChange={(e) => setAcceptanceDate(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all text-slate-700" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5"><FileText size={16} className="text-slate-400" /> Remarks (Optional)</label>
                  <textarea 
                    rows={2} 
                    placeholder="Enter any additional notes..." 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all resize-none" 
                    disabled={isSubmitting} 
                  />
                </div>

                <div className="mt-8 flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm">
                    {isSubmitting ? "Saving..." : "Add Unit"}
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