"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowUp, X, Building, MapPin, Tag, User, Users, Briefcase, Maximize, CalendarDays, FileText, Edit, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

// ✨ Sub-component for handling the Clickable Owner Dropdown in the table
const OwnerCell = ({ ownerName, abbreviation }: { ownerName: string, abbreviation?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!ownerName || ownerName === '—') return <span>—</span>;

  // Parse comma-separated names
  const owners = ownerName.split(',').map(n => n.trim()).filter(Boolean);
  const primaryDisplay = abbreviation || owners[0];
  const hasMore = owners.length > 1;

  // If there's only 1 owner and no abbreviation, just show plain text (no blue link).
  if (!hasMore && !abbreviation) return <span className="font-medium text-slate-700">{primaryDisplay}</span>;

  return (
    <div className="relative" onMouseLeave={() => setIsOpen(false)}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="flex items-center gap-1.5 text-[#1d82f5] hover:text-blue-700 font-bold text-left transition-colors"
      >
        {/* Removed truncate and max-w classes so the primary name is always fully visible */}
        <span className="inline-block">{primaryDisplay}</span>
        {hasMore && (
          <span className="bg-blue-50 text-[#1d82f5] text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-blue-100">
            +{owners.length - 1}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 shadow-xl rounded-xl p-4 z-[60] animate-in fade-in zoom-in-95 duration-200 whitespace-normal">
          <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">All Registered Owners</div>
          <ul className="space-y-1.5">
            {owners.map((o, i) => (
              <li key={i} className="text-xs text-slate-700 font-semibold flex items-start gap-2 break-words">
                <span className="text-slate-300 shrink-0">{i + 1}.</span> 
                <span className="leading-relaxed break-words">{o}</span>
              </li>
            ))}
          </ul>
          {abbreviation && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Legal Name</span>
              <span className="text-xs font-medium text-slate-600 leading-relaxed break-words block">{ownerName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function PropertiesAndUnitsTab({ orgData, isLoading: isOrgLoading }: any) {
  
  const [units, setUnits] = useState<any[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✨ Confirmation Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState<'add' | 'edit' | 'import' | null>(null);
  
  // Form Fields
  const [propertyName, setPropertyName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitType, setUnitType] = useState("Studio");
  const [ownerName, setOwnerName] = useState("");
  const [ownerAbbreviation, setOwnerAbbreviation] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [unitArea, setUnitArea] = useState("");
  const [turnoverDate, setTurnoverDate] = useState("");
  const [acceptanceDate, setAcceptanceDate] = useState("");
  const [remarks, setRemarks] = useState("");

  // Import Preview & Success States
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
      .eq('admin_email', orgData.admin_email);

    if (error) {
      console.error("Error fetching units:", error);
      setUnits([]);
    } else {
      const sortedData = (data || []).sort((a, b) => {
        const propA = a.property_name || "";
        const propB = b.property_name || "";
        const propCompare = propA.localeCompare(propB);
        
        if (propCompare !== 0) return propCompare; 
        
        const unitA = String(a.unit_number || "").trim();
        const unitB = String(b.unit_number || "").trim();

        const aStartsLetter = /^[a-zA-Z]/.test(unitA);
        const bStartsLetter = /^[a-zA-Z]/.test(unitB);

        if (aStartsLetter && !bStartsLetter) return -1;
        if (!aStartsLetter && bStartsLetter) return 1;

        return unitA.localeCompare(unitB, undefined, { numeric: true, sensitivity: 'base' });
      });

      setUnits(sortedData);
    }
    setIsLoadingUnits(false);
  };

  const resetForm = () => {
    setEditingUnitId(null);
    setPropertyName("");
    setUnitNumber("");
    setUnitType("Studio");
    setOwnerName("");
    setOwnerAbbreviation("");
    setTenantName("");
    setBusinessName("");
    setUnitArea("");
    setTurnoverDate("");
    setAcceptanceDate("");
    setRemarks("");
    setErrorMsg(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (unit: any) => {
    resetForm();
    setEditingUnitId(unit.id);
    setPropertyName(unit.property_name || "");
    setUnitNumber(unit.unit_number || "");
    setUnitType(unit.unit_type || "Studio");
    setUnitArea(unit.unit_area || "");
    setOwnerName(unit.owner_name === '—' ? "" : (unit.owner_name || ""));
    setOwnerAbbreviation(unit.owner_abbreviation || "");
    setBusinessName(unit.business_name || "");
    setTenantName(unit.tenant_name === '—' || unit.tenant_name === 'Vacant' ? "" : (unit.tenant_name || ""));
    setTurnoverDate(unit.turnover_date || "");
    setAcceptanceDate(unit.acceptance_date || "");
    setRemarks(unit.remarks || "");
    setIsModalOpen(true);
  };

  // ✨ INTERCEPT SAVE: Show confirmation instead of directly saving
  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const maxUnits = Number(orgData?.units_count) || 0;
    if (!editingUnitId && units.length >= maxUnits) {
      setErrorMsg(`Your plan is limited to ${maxUnits} units. Please upgrade your plan to add more.`);
      return;
    }

    // Show the confirmation modal based on Add or Edit
    setConfirmType(editingUnitId ? 'edit' : 'add');
    setShowConfirmModal(true);
  };

  // ✨ ACTUAL DB SAVE LOGIC: Called from the Confirmation Modal
  const executeSaveUnit = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const payload: any = {
      admin_email: orgData.admin_email,
      property_name: propertyName, 
      unit_number: unitNumber, 
      unit_type: unitType, 
      owner_name: ownerName.trim() || '—',
      owner_abbreviation: ownerAbbreviation.trim() || null,
      business_name: businessName.trim() || null,
      unit_area: unitArea.trim(), 
      turnover_date: turnoverDate || null,
      acceptance_date: acceptanceDate || null,
      remarks: remarks.trim() || null
    };

    if (!editingUnitId) {
      payload.tenant_name = '—';
      payload.status = 'Vacant';
    }

    try {
      if (editingUnitId) {
        const { error } = await supabase.from('units').update(payload).eq('id', editingUnitId);
        if (error) throw new Error(`Update Error: ${error.message}`);
      } else {
        const { error } = await supabase.from('units').insert([payload]);
        if (error) throw new Error(`Insert Error: ${error.message}`);
      }

      await fetchUnits();
      setIsModalOpen(false);
      resetForm();

      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 3000);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseDateSafe = (dateStr: string) => {
    if (!dateStr || dateStr.trim() === '') return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null; 
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; 
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return `${parseInt(month)}/${parseInt(day)}/${year}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("CSV file seems empty or missing data rows.");
        
        const headers = lines[0].split(',').map(h => h.trim().toUpperCase().replace(/^"|"$/g, ''));
        
        const parsedData = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          parsedData.push(obj);
        }

        const mappedUnits = parsedData.map(row => {
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
            owner_abbreviation: row['OWNER ABBREVIATION'] || null,
            business_name: row['BUSINESS NAME'] || null,
            tenant_name: tenant,
            turnover_date: parseDateSafe(row['TURNOVER']),
            acceptance_date: parseDateSafe(row['ACCEPTANCE']),
            remarks: row['REMARKS'] || null,
            status: providedStatus || (isOccupied ? 'Occupied' : 'Vacant')
          };
        });

        setCsvPreviewData(mappedUnits);
        setIsPreviewModalOpen(true);

      } catch (err: any) {
        console.error("Import parsing error:", err);
        alert(`Failed to read CSV: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""; 
      }
    };
    
    reader.readAsText(file, 'windows-1252');
  };

  const removePreviewRow = (indexToRemove: number) => {
    setCsvPreviewData(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // ✨ INTERCEPT CSV IMPORT: Show confirmation instead of directly saving
  const confirmCsvImport = async () => {
    if (csvPreviewData.length === 0) return;

    const maxUnits = Number(orgData?.units_count) || 0;
    if (units.length + csvPreviewData.length > maxUnits) {
      alert(`Cannot import ${csvPreviewData.length} units. You only have ${Math.max(0, maxUnits - units.length)} seats remaining. Please delete some rows or upgrade your plan.`);
      return;
    }

    setConfirmType('import');
    setShowConfirmModal(true);
  };

  // ✨ ACTUAL DB IMPORT LOGIC: Called from the Confirmation Modal
  const executeCsvImport = async () => {
    setIsImporting(true);
    setShowConfirmModal(false);

    try {
      const { error } = await supabase.from('units').insert(csvPreviewData);
      if (error) throw error;

      await fetchUnits();
      setIsPreviewModalOpen(false);
      setCsvPreviewData([]);
      
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 3000); 

    } catch (err: any) {
      console.error("Database import error:", err);
      alert(`Import Failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Search Filtering Logic
  const filteredUnits = units.filter(unit => {
    const searchLower = searchQuery.toLowerCase();
    return (
      (unit.property_name && unit.property_name.toLowerCase().includes(searchLower)) ||
      (unit.unit_number && String(unit.unit_number).toLowerCase().includes(searchLower)) ||
      (unit.tenant_name && unit.tenant_name.toLowerCase().includes(searchLower)) ||
      (unit.owner_name && unit.owner_name.toLowerCase().includes(searchLower)) ||
      (unit.business_name && unit.business_name.toLowerCase().includes(searchLower)) ||
      (unit.remarks && unit.remarks.toLowerCase().includes(searchLower))
    );
  });

  const initials = orgData?.org_name ? orgData.org_name.substring(0, 2).toUpperCase() : "AD";
  const maxUnits = Number(orgData?.units_count) || 0;
  const activeUnits = units.length;
  const remainingUnits = Math.max(0, maxUnits - activeUnits); 

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-extrabold text-[#0a1e3f] tracking-tight">Properties & units</h2>
          <p className="text-slate-500 text-sm mt-1">Vacancy board across the portfolio</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search tenants, units..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#359b46] focus:border-transparent bg-white shadow-sm" 
            />
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm font-semibold text-[#359b46]">Manager</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-sm border border-emerald-100">{initials}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[#0a1e3f] text-sm">Property Summary Board · {isOrgLoading ? "..." : maxUnits} units</h3>
           <span className="bg-[#B7C9E2] text-slate-700 border border-[#A5B8D4] text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">Vacancy Board · {isLoadingUnits || isOrgLoading ? "..." : remainingUnits} units</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
            >
              <ArrowUp size={14} /> Import CSV
            </button>
            
            <button 
              onClick={openAddModal}
              disabled={remainingUnits === 0 && !isLoadingUnits}
              className={`flex-1 sm:flex-none justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${remainingUnits === 0 && !isLoadingUnits ? "bg-slate-200 text-slate-400 cursor-not-allowed" : "bg-[#359b46] hover:bg-[#2c813a] text-white"}`}
            >
              + Add unit
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-auto max-h-[60vh] custom-scrollbar">
            <table className="w-full text-left text-sm relative">
              <thead className="bg-white text-slate-500 text-[11px] uppercase font-bold tracking-wider sticky top-0 z-10 shadow-sm border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">PROPERTY</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">UNIT</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">TYPE</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">AREA</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">OWNER(S)</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">BUSINESS NAME</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">TENANT</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">TURNOVER</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">ACCEPTANCE</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">REMARKS</th>
                  <th className="px-6 py-4 whitespace-nowrap bg-white">STATUS</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right bg-white">ACTIONS</th>
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
                ) : filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-6 py-16 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Search size={32} className="text-slate-300" />
                        <p>No units match your search "{searchQuery}".</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{unit.property_name}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_number}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_type}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.unit_area || '—'}</td>
                      
                      {/* Interactive Owner Cell */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OwnerCell ownerName={unit.owner_name} abbreviation={unit.owner_abbreviation} />
                      </td>

                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{unit.business_name || '—'}</td>
                      <td className="px-6 py-4 font-medium text-slate-800 whitespace-nowrap">{unit.tenant_name}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatDate(unit.turnover_date)}</td>
                      <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatDate(unit.acceptance_date)}</td>
                      <td className="px-6 py-4 text-slate-600 max-w-[150px] truncate" title={unit.remarks}>{unit.remarks || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${unit.status === 'Vacant' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => openEditModal(unit)}
                          className="p-1.5 text-slate-400 hover:text-[#1e88e5] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Unit"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSV IMPORT PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-[#0a1e3f]">Review Import Data</h2>
                <p className="text-sm text-slate-500 mt-1">Review your CSV entries. Delete any row you do not want to upload.</p>
              </div>
              <button onClick={() => !isImporting && setIsPreviewModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200" disabled={isImporting}>
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-auto custom-scrollbar flex-1 bg-white">
              <table className="w-full text-left text-xs relative">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Property</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Unit</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Type</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Area</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Owner(s)</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Abbr.</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Business Name</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Tenant</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Turnover</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Acceptance</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Remarks</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-50">Status</th>
                    <th className="px-4 py-3 whitespace-nowrap text-right bg-slate-50">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {csvPreviewData.length === 0 ? (
                    <tr><td colSpan={13} className="px-4 py-8 text-center text-slate-400">No rows remaining.</td></tr>
                  ) : (
                    csvPreviewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{row.property_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.unit_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.unit_type}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.unit_area || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.owner_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.owner_abbreviation || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.business_name || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.tenant_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.turnover_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.acceptance_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap max-w-[150px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{row.status}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => removePreviewRow(idx)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete Row">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="text-sm font-bold text-slate-600">
                Ready to import: <span className="text-[#0a1e3f] text-base">{csvPreviewData.length}</span> units
                {units.length + csvPreviewData.length > maxUnits && (
                  <span className="text-red-500 block text-xs mt-0.5">Exceeds remaining plan limits! Delete some rows.</span>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsPreviewModalOpen(false)} disabled={isImporting} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button 
                  onClick={confirmCsvImport} 
                  disabled={isImporting || csvPreviewData.length === 0 || (units.length + csvPreviewData.length > maxUnits)} 
                  className="bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
                >
                  Confirm & Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT UNIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-[#0a1e3f]">{editingUnitId ? "Edit Unit Details" : "Add New Unit"}</h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200" disabled={isSubmitting}>
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 custom-scrollbar">
              <form onSubmit={handleSaveUnit} className="space-y-6">
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
                      <option value="SOHO">SOHO</option>
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
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <User size={16} className="text-[#359b46]" /> Owner Name(s)
                    </label>
                    <input type="text" placeholder="e.g. John Doe, Maria Reyes" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                    <p className="text-[10px] text-slate-400 mt-1">Separate multiple names with a comma.</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Briefcase size={16} className="text-slate-400" /> Owner Abbreviation (Optional)
                    </label>
                    <input type="text" placeholder="e.g. CTMRISP" value={ownerAbbreviation} onChange={(e) => setOwnerAbbreviation(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Business Name */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                    <Building size={16} className="text-[#359b46]" /> Business Name (Optional)
                  </label>
                  <input type="text" placeholder="e.g. Acme Corp" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46]/50 focus:border-[#359b46] text-sm transition-all" disabled={isSubmitting} />
                </div>

                {/* Tenant Row (Read Only) - ONLY SHOWS ON EDIT */}
                {editingUnitId && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1.5">
                      <Users size={16} className="text-[#1d82f5]" /> Tenant Name
                    </label>
                    <input 
                      type="text" 
                      value={tenantName || "Vacant"} 
                      disabled 
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white/50 text-sm font-semibold text-slate-600 cursor-not-allowed" 
                    />
                    <p className="text-[10px] text-slate-500 font-medium mt-1.5 ml-1">
                      * Tenants are managed automatically through the <strong>Leases</strong> tab.
                    </p>
                  </div>
                )}

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
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
                    {editingUnitId ? "Save Changes" : "Add Unit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ ARE YOU SURE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Confirm Action</h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {confirmType === 'add' && "Are you sure you want to add this new unit to your property database?"}
              {confirmType === 'edit' && "Are you sure you want to save these changes to the unit?"}
              {confirmType === 'import' && `Are you sure you want to import ${csvPreviewData.length} units? Please make sure the data is correct.`}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting || isImporting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmType === 'add' || confirmType === 'edit') executeSaveUnit();
                  if (confirmType === 'import') executeCsvImport();
                }}
                disabled={isSubmitting || isImporting}
                className="flex-1 bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center"
              >
                {isSubmitting || isImporting ? "Processing..." : "Yes, I'm sure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-50 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="text-xl font-bold text-[#0a1e3f] mb-2">Success!</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Your unit details have been successfully saved to the database.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}