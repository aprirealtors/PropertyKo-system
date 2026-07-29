"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowUp, X, Building, MapPin, Tag, User, Users, Briefcase, Maximize, CalendarDays, FileText, Edit, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

// ✨ Sub-component for handling the Clickable Owner Dropdown in the table
const OwnerCell = ({ ownerName, abbreviation }: { ownerName: string, abbreviation?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!ownerName || ownerName === '—') return <span className="text-slate-400 italic font-medium">—</span>;

  // Parse comma-separated names
  const owners = ownerName.split(',').map(n => n.trim()).filter(Boolean);
  const primaryDisplay = abbreviation || owners[0];
  const hasMore = owners.length > 1;

  if (!hasMore && !abbreviation) return <span className="font-bold text-[#0a1e3f]">{primaryDisplay}</span>;

  return (
    <div className="relative" onMouseLeave={() => setIsOpen(false)}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="flex items-center gap-1.5 text-[#1d82f5] hover:text-blue-700 font-extrabold text-left transition-all active:scale-95 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-blue-100"
      >
        <span className="inline-block">{primaryDisplay}</span>
        {hasMore && (
          <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded-md border border-blue-200 shadow-sm">
            +{owners.length - 1}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-5 z-[60] animate-in fade-in zoom-in-95 duration-200 whitespace-normal">
          <div className="text-[9px] font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
            <Users size={12} className="text-blue-400" /> All Registered Owners
          </div>
          <ul className="space-y-2">
            {owners.map((o, i) => (
              <li key={i} className="text-xs text-[#0a1e3f] font-bold flex items-start gap-2.5 break-words bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 shrink-0 font-black">{i + 1}.</span> 
                <span className="leading-relaxed break-words mt-0.5">{o}</span>
              </li>
            ))}
          </ul>
          {abbreviation && (
            <div className="mt-4 pt-4 border-t border-slate-100/80">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-2">
                <Briefcase size={12} className="text-emerald-500" /> Full Legal Name
              </span>
              <span className="text-xs font-bold text-slate-600 leading-relaxed break-words block bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">{ownerName}</span>
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

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const maxUnits = Number(orgData?.units_count) || 0;
    if (!editingUnitId && units.length >= maxUnits) {
      setErrorMsg(`Your plan is limited to ${maxUnits} units. Please upgrade your plan to add more.`);
      return;
    }

    setConfirmType(editingUnitId ? 'edit' : 'add');
    setShowConfirmModal(true);
  };

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
    if (!dateStr) return <span className="text-slate-300 italic">—</span>;
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return <span className="font-medium">{`${parseInt(month)}/${parseInt(day)}/${year}`}</span>;
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
    // ✨ LOCKED LAYOUT WINDOW SHELL: Nakasagad sa dulo para iwas double scroll
    <div className="flex flex-col w-full h-[calc(100vh-100px)] md:h-[calc(100vh-112px)] -mb-10 relative overflow-hidden font-sans selection:bg-[#359b46]/10 animate-in fade-in duration-500">
      
      {/* 🌟 PREMIUM HEADER - Static Shrink Block (Fixed Header Zone) */}
      <div className="shrink-0 mb-6 px-1 sm:px-0 mt-1">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[2rem] border border-slate-200/60 shadow-sm backdrop-blur-xl">
          
          {/* Left Side: Title & Overview */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] tracking-tight flex items-center gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200/50 shadow-sm">
                <Building className="text-[#1d82f5]" size={24} strokeWidth={2.5} />
              </div>
              Properties & Units
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2">
              Vacancy board and inventory <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shadow-inner">
                {isOrgLoading ? "..." : maxUnits} units limit
              </span>
            </p>
          </div>
          
          {/* Right Side: Search & Admin Badge */}
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-2 sm:mt-0">
            
            {/* Search Bar */}
            <div className="relative w-full sm:w-64 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1d82f5] transition-colors" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search unit, tenant, owner..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/80 text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-[#1d82f5] bg-white/80 backdrop-blur-sm shadow-sm transition-all hover:bg-white"
              />
            </div>

            {/* Premium Admin Profile Badge */}
            <div className="hidden sm:flex items-center gap-3 bg-white pl-4 pr-1.5 py-1.5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-default group">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Workspace</span>
                <span className="text-xs font-extrabold text-[#0a1e3f] leading-none">Admin</span>
              </div>
              <div className="w-9 h-9 rounded-[12px] bg-[#359b46] hover:bg-[#2c813a] text-white flex items-center justify-center font-black text-xs shadow-inner group-hover:scale-105 transition-transform duration-300">
                {initials}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 🌟 ACTION CONTROLS ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0 px-1 sm:px-0">
        <div className="flex items-center gap-3">
          <h3 className="font-black text-[#0a1e3f] text-base tracking-tight">Property Summary Board</h3>
          <span className="bg-blue-50 text-[#1d82f5] border border-blue-200/60 text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
            {isLoadingUnits || isOrgLoading ? "..." : remainingUnits} remaining seats
          </span>
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
            className="flex-1 sm:flex-none justify-center bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <ArrowUp size={16} strokeWidth={2.5} /> Import CSV
          </button>
          
          {/* ✨ FIX: Binalik sa Emerald Green ang Button with Glowing Premium Shadow */}
          <button 
            onClick={openAddModal}
            disabled={remainingUnits === 0 && !isLoadingUnits}
            className={`flex-1 sm:flex-none justify-center px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${
              remainingUnits === 0 && !isLoadingUnits 
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none" 
                : "bg-[#359b46] hover:bg-[#2c813a] text-white shadow-[0_4px_15px_rgba(53,155,70,0.25)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)]"
            }`}
          >
            + Add New Unit
          </button>
        </div>
      </div>

      {/* 🌟 PREMIUM TABLE WRAPPER (Scrollable Body) */}
      {/* ✨ FIX: Tinanggal ang mb-12/mb-16 para sumagad sa bottom. Pinalitan ng rounded-t-[2rem] at inalis ang border-b para seamless ang dikit sa ilalim. */}
      <div className="flex-1 w-full min-h-0 bg-white rounded-t-[2rem] shadow-sm border border-slate-200/80 border-b-0 overflow-hidden flex flex-col mt-2">
        
        {/* ✨ FIX: Explicit overflow-x-auto at overflow-y-auto. Nagdagdag ng pb-24 para kapag sinagad mo ang scroll pababa, may malaking space at hindi nakadikit sa edge ang huling row. */}
        <div className="flex-1 overflow-x-auto overflow-y-auto pb-24">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 text-[10px] uppercase font-black tracking-widest sticky top-0 z-20 shadow-sm border-b border-slate-200/80">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Property</th>
                <th className="px-6 py-4 whitespace-nowrap">Unit</th>
                <th className="px-6 py-4 whitespace-nowrap">Type</th>
                <th className="px-6 py-4 whitespace-nowrap">Area</th>
                <th className="px-6 py-4 whitespace-nowrap">Owner(s)</th>
                <th className="px-6 py-4 whitespace-nowrap">Business Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Tenant</th>
                <th className="px-6 py-4 whitespace-nowrap">Turnover</th>
                <th className="px-6 py-4 whitespace-nowrap">Acceptance</th>
                <th className="px-6 py-4 whitespace-nowrap">Remarks</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-slate-700">
              {isLoadingUnits ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-12"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                    <td className="px-6 py-5"><div className="h-5 bg-slate-200 rounded-lg w-32"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                    <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-10"></div></td>
                    <td className="px-6 py-5"><div className="h-5 bg-slate-200 rounded-lg w-16"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-slate-100 rounded-md w-8 ml-auto"></div></td>
                  </tr>
                ))
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-2">
                        <Building size={32} className="text-slate-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">No units in inventory</p>
                      <p className="text-slate-400 text-xs">Start adding units or import a CSV file to begin.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 mb-2">
                        <Search size={32} className="text-slate-300" strokeWidth={1.5} />
                      </div>
                      <p className="text-slate-500 font-bold text-sm">No exact matches found</p>
                      <p className="text-slate-400 text-xs">Try adjusting your search query: <span className="font-semibold text-slate-500">"{searchQuery}"</span></p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-black text-[#0a1e3f] whitespace-nowrap group-hover:text-[#1d82f5] transition-colors">{unit.property_name}</td>
                    <td className="px-6 py-4 font-bold text-slate-700 whitespace-nowrap">{unit.unit_number}</td>
                    <td className="px-6 py-4 font-semibold text-slate-500 whitespace-nowrap">{unit.unit_type}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{unit.unit_area || <span className="text-slate-300 italic">—</span>}</td>
                    
                    {/* Interactive Owner Cell */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <OwnerCell ownerName={unit.owner_name} abbreviation={unit.owner_abbreviation} />
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">{unit.business_name || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-6 py-4 font-black text-slate-700 whitespace-nowrap">{unit.tenant_name === '—' ? <span className="text-slate-300 italic">—</span> : unit.tenant_name}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{formatDate(unit.turnover_date)}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{formatDate(unit.acceptance_date)}</td>
                    <td className="px-6 py-4 text-slate-500 max-w-[150px] truncate" title={unit.remarks}>{unit.remarks || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm ${unit.status === 'Vacant' ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'}`}>
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => openEditModal(unit)}
                        className="p-2 text-slate-400 hover:text-[#1d82f5] hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100 shadow-sm active:scale-95"
                        title="Edit Unit"
                      >
                        <Edit size={16} strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🌟 PREMIUM ADD / EDIT UNIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight relative z-10 flex items-center gap-2">
                {editingUnitId ? <Edit size={24} className="text-[#359b46]" /> : <Building size={24} className="text-[#359b46]" />}
                {editingUnitId ? "Edit Unit Details" : "Add New Unit"}
              </h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/50">
              <form onSubmit={handleSaveUnit} className="space-y-6 sm:space-y-7">
                {errorMsg && <div className="mb-5 p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-200/60 shadow-sm flex items-center gap-3"><AlertTriangle size={18} /> {errorMsg}</div>}

                {/* Property Name */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-2"><MapPin size={14} className="text-[#359b46]" /> Property Name</label>
                  <input type="text" required placeholder="e.g. The Grove, Avida Towers" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                </div>

                {/* Unit Details Row */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Building size={14} className="text-[#359b46]" /> Unit Number</label>
                    <input type="text" required placeholder="e.g. 12B" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Tag size={14} className="text-[#359b46]" /> Unit Type</label>
                    <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting}>
                      <option value="Studio">Studio</option>
                      <option value="1BR">1BR</option>
                      <option value="2BR">2BR</option>
                      <option value="3BR">3BR</option>
                      <option value="Commercial">Commercial</option>
                      <option value="SOHO">SOHO</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Maximize size={14} className="text-[#359b46]" /> Unit Area</label>
                    <input type="text" required placeholder="e.g. 50.06 sqm" value={unitArea} onChange={(e) => setUnitArea(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Ownership Row */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      <span className="flex items-center gap-2"><User size={14} className="text-[#1d82f5]" /> Owner Name(s)</span>
                    </label>
                    <input type="text" placeholder="e.g. John Doe, Maria Reyes" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1d82f5] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                    <p className="text-[10px] font-semibold text-slate-400 mt-2 px-1">Separate multiple names with a comma.</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      <Briefcase size={14} className="text-slate-400" /> Owner Abbreviation
                    </label>
                    <input type="text" placeholder="e.g. CTMRISP (Optional)" value={ownerAbbreviation} onChange={(e) => setOwnerAbbreviation(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-[#1d82f5] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Business Name */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <Building size={14} className="text-[#359b46]" /> Business Name (Optional)
                  </label>
                  <input type="text" placeholder="e.g. Acme Corp" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold text-slate-700 transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                </div>

                {/* Tenant Row (Read Only) - ONLY SHOWS ON EDIT */}
                {editingUnitId && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl p-5 shadow-inner">
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-blue-600 mb-2">
                      <Users size={14} className="text-blue-500" /> Assigned Tenant
                    </label>
                    <input 
                      type="text" 
                      value={tenantName || "Vacant"} 
                      disabled 
                      className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-white/60 text-sm font-extrabold text-[#0a1e3f] cursor-not-allowed shadow-sm" 
                    />
                    <p className="text-[10px] text-blue-500/80 font-bold mt-2 px-1 tracking-wide">
                      Tenants are managed automatically through the Leases tab.
                    </p>
                  </div>
                )}

                {/* Dates Row */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><CalendarDays size={14} className="text-slate-400" /> Turnover Date (Opt)</label>
                    <input type="date" value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold transition-all text-slate-700 bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><CalendarDays size={14} className="text-slate-400" /> Acceptance Date (Opt)</label>
                    <input type="date" value={acceptanceDate} onChange={(e) => setAcceptanceDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-bold transition-all text-slate-700 bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                {/* Remarks */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><FileText size={14} className="text-slate-400" /> Remarks (Optional)</label>
                  <textarea 
                    rows={2} 
                    placeholder="Enter any additional notes or tags..." 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#359b46]/10 focus:border-[#359b46] text-sm font-medium text-slate-700 transition-all resize-none bg-slate-50 focus:bg-white" 
                    disabled={isSubmitting} 
                  />
                </div>

                {/* Modal Actions */}
                <div className="mt-8 flex gap-3 justify-end pt-5 border-t border-slate-200/80 sticky bottom-0 bg-slate-50/90 backdrop-blur-md pb-4 sm:pb-0 z-20">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl transition-all active:scale-95">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="bg-[#359b46] hover:bg-[#2c813a] text-white px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center min-w-[140px]">
                    {isSubmitting ? <span className="animate-pulse">Saving...</span> : editingUnitId ? "Save Changes" : "Add Unit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✨ CSV IMPORT PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-[90vw] overflow-hidden transform transition-all h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#0a1e3f] tracking-tight">Review Import Data</h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Review your CSV entries. Delete any row you do not want to upload.</p>
              </div>
              <button onClick={() => !isImporting && setIsPreviewModalOpen(false)} className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isImporting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-auto custom-scrollbar flex-1 bg-slate-50/50 p-6">
              <div className="bg-white border border-slate-200/80 rounded-[1.5rem] overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs relative">
                  <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 font-black uppercase tracking-widest sticky top-0 shadow-sm z-10 border-b border-slate-200/80">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">Property</th>
                      <th className="px-5 py-4 whitespace-nowrap">Unit</th>
                      <th className="px-5 py-4 whitespace-nowrap">Type</th>
                      <th className="px-5 py-4 whitespace-nowrap">Area</th>
                      <th className="px-5 py-4 whitespace-nowrap">Owner(s)</th>
                      <th className="px-5 py-4 whitespace-nowrap">Abbr.</th>
                      <th className="px-5 py-4 whitespace-nowrap">Business Name</th>
                      <th className="px-5 py-4 whitespace-nowrap">Tenant</th>
                      <th className="px-5 py-4 whitespace-nowrap">Turnover</th>
                      <th className="px-5 py-4 whitespace-nowrap">Acceptance</th>
                      <th className="px-5 py-4 whitespace-nowrap">Remarks</th>
                      <th className="px-5 py-4 whitespace-nowrap">Status</th>
                      <th className="px-5 py-4 whitespace-nowrap text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {csvPreviewData.length === 0 ? (
                      <tr><td colSpan={13} className="px-5 py-12 text-center text-slate-400 font-bold">No rows remaining.</td></tr>
                    ) : (
                      csvPreviewData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-5 py-3 font-black text-[#0a1e3f] whitespace-nowrap">{row.property_name}</td>
                          <td className="px-5 py-3 font-bold whitespace-nowrap">{row.unit_number}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.unit_type}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.unit_area || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap font-bold text-slate-800">{row.owner_name}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.owner_abbreviation || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.business_name || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap font-bold text-slate-800">{row.tenant_name}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{formatDate(row.turnover_date)}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{formatDate(row.acceptance_date)}</td>
                          <td className="px-5 py-3 whitespace-nowrap max-w-[150px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${row.status === 'Vacant' ? 'bg-white text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <button onClick={() => removePreviewRow(idx)} className="text-red-400 hover:text-red-600 bg-white hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-100 transition-all active:scale-95" title="Delete Row">
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 sm:px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white shrink-0 gap-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Ready to import: <span className="text-[#359b46] text-base ml-1 mr-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shadow-sm">{csvPreviewData.length}</span> units
                {units.length + csvPreviewData.length > maxUnits && (
                  <span className="text-red-500 flex items-center gap-1.5 mt-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 normal-case tracking-normal font-bold">
                    <AlertTriangle size={14} /> Exceeds remaining plan limits! Delete some rows.
                  </span>
                )}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button type="button" onClick={() => setIsPreviewModalOpen(false)} disabled={isImporting} className="flex-1 sm:flex-none px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[#0a1e3f] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl transition-all active:scale-95">Cancel</button>
                <button 
                  onClick={confirmCsvImport} 
                  disabled={isImporting || csvPreviewData.length === 0 || (units.length + csvPreviewData.length > maxUnits)} 
                  className="flex-1 sm:flex-none bg-[#359b46] hover:bg-[#2c813a] disabled:bg-slate-300 disabled:shadow-none text-white px-8 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] hover:shadow-[0_6px_20px_rgba(53,155,70,0.4)] active:scale-95 flex items-center justify-center min-w-[180px]"
                >
                  {isImporting ? <span className="animate-pulse">Importing...</span> : "Confirm & Import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ ARE YOU SURE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5 border-2 border-amber-100 shadow-inner">
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] tracking-tight mb-2">Confirm Action</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              {confirmType === 'add' && "Are you sure you want to add this new unit to your property database?"}
              {confirmType === 'edit' && "Are you sure you want to save these changes to the unit?"}
              {confirmType === 'import' && `Are you sure you want to import ${csvPreviewData.length} units? Please make sure the data is correct.`}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting || isImporting}
                className="flex-1 px-4 py-3.5 text-xs uppercase tracking-widest font-black text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-[#0a1e3f] rounded-xl transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmType === 'add' || confirmType === 'edit') executeSaveUnit();
                  if (confirmType === 'import') executeCsvImport();
                }}
                disabled={isSubmitting || isImporting}
                className="flex-1 bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-3.5 rounded-xl text-xs uppercase tracking-widest font-black transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] flex items-center justify-center active:scale-95"
              >
                {isSubmitting || isImporting ? <span className="animate-pulse">Processing...</span> : "Yes, I'm sure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[#0a1e3f]/60 backdrop-blur-md z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in fade-in zoom-in-95 duration-300 border border-slate-200">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-green-100 text-[#359b46] rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-white shadow-[0_0_20px_rgba(53,155,70,0.2)]">
              <CheckCircle2 size={40} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-[#0a1e3f] tracking-tight mb-2">Success!</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              Your unit details have been successfully saved to the database.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[#359b46] hover:bg-[#2c813a] text-white px-4 py-3.5 rounded-xl text-xs uppercase tracking-widest font-black transition-all shadow-[0_4px_15px_rgba(53,155,70,0.3)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}