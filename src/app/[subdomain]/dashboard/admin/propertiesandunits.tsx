"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { Search, ArrowUp, X, Building, MapPin, Tag, User, Users, Briefcase, Maximize, CalendarDays, FileText, Edit, Trash2, CheckCircle2, AlertTriangle, FolderOpen } from "lucide-react";

// ✨ Sub-component for handling the Clickable Owner Dropdown (Themified)
const OwnerCell = ({ ownerName, abbreviation }: { ownerName: string, abbreviation?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!ownerName || ownerName === '—') return <span className="text-slate-400 italic font-medium">—</span>;

  // Parse comma-separated names
  const owners = ownerName.split(',').map(n => n.trim()).filter(Boolean);
  const primaryDisplay = abbreviation || owners[0];
  const hasMore = owners.length > 1;

  if (!hasMore && !abbreviation) return <span className="font-bold text-[var(--color-secondary)] truncate block">{primaryDisplay}</span>;

  return (
    <div className="relative" onMouseLeave={() => setIsOpen(false)}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="flex items-center gap-1.5 text-[var(--color-primary)] hover:opacity-80 font-extrabold text-left transition-all active:scale-95 bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 px-2 py-0.5 -ml-2 rounded-[var(--radius-sm)] border border-transparent hover:border-[var(--color-primary)]/30 max-w-full"
      >
        <span className="inline-block truncate">{primaryDisplay}</span>
        {hasMore && (
          <span className="shrink-0 bg-[var(--color-primary)]/20 text-[var(--color-primary)] text-[9px] font-black px-1.5 py-0.5 rounded-md border border-[var(--color-primary)]/30 shadow-sm">
            +{owners.length - 1}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[calc(100vw-32px)] sm:w-72 max-w-sm bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-4 z-[60] animate-in fade-in zoom-in-95 duration-200 whitespace-normal">
          <div className="text-[9px] font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center gap-2">
            <Users size={12} className="text-[var(--color-primary)]/70" /> All Registered Owners
          </div>
          <ul className="space-y-2">
            {owners.map((o, i) => (
              <li key={i} className="text-xs text-[var(--color-secondary)] font-bold flex items-start gap-2.5 break-words bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-slate-400 shrink-0 font-black">{i + 1}.</span> 
                <span className="leading-relaxed break-words mt-0.5">{o}</span>
              </li>
            ))}
          </ul>
          {abbreviation && (
            <div className="mt-4 pt-4 border-t border-slate-100/80">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-2">
                <Briefcase size={12} className="text-slate-400" /> Full Legal Name
              </span>
              <span className="text-xs font-bold text-slate-600 leading-relaxed break-words block bg-slate-50 p-2.5 rounded-xl border border-slate-100">{ownerName}</span>
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

  // Confirmation Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState<'add' | 'edit' | 'import' | null>(null);
  
  // Delete Modal States
  const [unitToDelete, setUnitToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const openDeleteModal = (unit: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUnitToDelete(unit);
  };

  const executeDeleteUnit = async () => {
    if (!unitToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitToDelete.id);

      if (error) throw error;

      await fetchUnits();
      setUnitToDelete(null);
      if (isModalOpen && editingUnitId === unitToDelete.id) {
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err: any) {
      console.error("Error deleting unit:", err);
      alert(`Failed to delete unit: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
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
    if (!dateStr) return null;
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

  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";
  const maxUnits = Number(orgData?.units_count) || 0;
  const activeUnits = units.length;
  const remainingUnits = Math.max(0, maxUnits - activeUnits); 

  return (
    <div className="flex flex-col w-full h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] relative overflow-hidden font-[family-name:var(--font-corporate)] selection:bg-[var(--color-primary)]/10 animate-in fade-in duration-500">
      
      {/* HEADER SECTION - Themified */}
      <div className="shrink-0 mb-4 px-2 sm:px-0 mt-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 p-4 sm:p-5 rounded-[1.5rem] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">
          
          <div className="w-full md:w-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-secondary)] tracking-tight flex items-center gap-3">
              <div className="p-2 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] border border-[var(--color-primary)]/20 shadow-sm">
                <FolderOpen className="text-[var(--color-primary)]" size={24} strokeWidth={2.5} />
              </div>
              Properties & Units
            </h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium flex items-center gap-2">
              Vacancy Board & Inventory <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> 
              <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-[var(--color-border)] shadow-inner">
                {isOrgLoading ? "..." : maxUnits} Units Limit
              </span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-start md:justify-end w-full md:w-auto gap-3 sm:gap-4 border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors z-10 pointer-events-none" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                placeholder="Search unit, tenant, owner..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-base text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-white backdrop-blur-sm shadow-[var(--shadow-sm)] transition-all"
              />
            </div>

            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
              <span className="text-xs font-black text-[var(--color-secondary)] uppercase tracking-wider">Admin</span>
              <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-secondary)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ACTION CONTROLS ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 shrink-0 px-2 sm:px-0">
        <div className="flex items-center gap-3">
          <h3 className="font-black text-[var(--color-secondary)] text-base tracking-tight">Property Summary Board</h3>
          <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
            {isLoadingUnits || isOrgLoading ? "..." : remainingUnits} Remaining Seats
          </span>
        </div>
        <div className="flex flex-row gap-3 w-full sm:w-auto">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none justify-center bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-black transition-all shadow-[var(--shadow-sm)] flex items-center gap-2 active:scale-95"
          >
            <ArrowUp size={16} strokeWidth={2.5} /> Import CSV
          </button>
          
          <button 
            onClick={openAddModal}
            disabled={remainingUnits === 0 && !isLoadingUnits}
            className={`flex-1 sm:flex-none justify-center px-5 py-2.5 rounded-[var(--radius-md)] text-sm font-black transition-all active:scale-95 flex items-center gap-2 ${
              remainingUnits === 0 && !isLoadingUnits 
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none" 
                : "bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] shadow-[var(--shadow-md)] border border-transparent"
            }`}
          >
            <Building size={16} strokeWidth={2.5} /> Add Unit
          </button>
        </div>
      </div>

      {/* GRID WRAPPER */}
      <div className="flex-1 w-full min-h-0 bg-slate-50/70 rounded-t-[2rem] border-t border-[var(--color-border)] overflow-hidden flex flex-col mt-2 shadow-inner">
        <div className="flex-1 overflow-x-hidden overflow-y-auto pb-24 p-4 sm:p-6 lg:p-8 custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            
            {isLoadingUnits ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[1.5rem] border border-[var(--color-border)] shadow-sm p-5 h-[280px] animate-pulse flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-2 bg-slate-100 rounded-br-lg"></div>
                  <div className="flex justify-between items-start mb-4 mt-2">
                    <div>
                      <div className="w-20 h-3 bg-slate-100 rounded mb-2"></div>
                      <div className="w-16 h-7 bg-slate-200 rounded"></div>
                    </div>
                    <div className="w-14 h-6 bg-slate-100 rounded-lg"></div>
                  </div>
                  <div className="space-y-5 flex-1 mt-4">
                    <div className="flex justify-between border-b border-slate-100 pb-4">
                      <div className="w-16 h-4 bg-slate-100 rounded"></div>
                      <div className="w-16 h-4 bg-slate-100 rounded"></div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="w-5 h-5 bg-slate-100 rounded-full shrink-0"></div>
                      <div className="w-24 h-4 bg-slate-200 rounded"></div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <div className="w-5 h-5 bg-slate-100 rounded-full shrink-0"></div>
                      <div className="w-32 h-4 bg-slate-100 rounded"></div>
                    </div>
                  </div>
                </div>
              ))
            ) : units.length === 0 ? (
              
              <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-[var(--color-border)] border-dashed shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center border border-slate-100 mb-4 shadow-inner">
                  <FolderOpen size={36} className="text-slate-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-black text-[var(--color-secondary)] mb-2">No property folders yet</h3>
                <p className="text-slate-400 text-sm font-medium mb-6 text-center max-w-sm px-4">Create your first unit or import a CSV file to populate your dashboard.</p>
                <button onClick={openAddModal} className="bg-white border border-[var(--color-border)] text-slate-600 hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] hover:shadow-sm px-6 py-3 rounded-[var(--radius-md)] font-bold text-sm transition-all active:scale-95 flex items-center gap-2">
                  <Building size={18} /> Create First Unit
                </button>
              </div>

            ) : filteredUnits.length === 0 ? (
              
              <div className="col-span-full py-24 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-[var(--color-border)] border-dashed shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-[1.5rem] flex items-center justify-center border border-slate-100 mb-4 shadow-inner">
                  <Search size={36} className="text-slate-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-black text-[var(--color-secondary)] mb-2">No exact matches found</h3>
                <p className="text-slate-400 text-sm font-medium text-center">Try adjusting your search query: <span className="font-bold text-slate-600">"{searchQuery}"</span></p>
              </div>

            ) : (
              
              filteredUnits.map((unit) => (
                <div key={unit.id} className="bg-white rounded-[1.5rem] border border-[var(--color-border)] shadow-[var(--shadow-sm)] hover:shadow-lg hover:border-[var(--color-primary)]/30 transition-all duration-300 flex flex-col relative group overflow-hidden">
                  
                  {/* Decorative Folder Tab Accent - Themified */}
                  <div className={`absolute -top-[1px] -left-[1px] h-[8px] w-[35%] rounded-tl-[1.5rem] rounded-br-xl transition-colors z-10 border-t border-l ${unit.status === 'Vacant' ? 'bg-slate-300 border-slate-300' : 'bg-[var(--color-primary)] border-[var(--color-primary)]'}`}></div>

                  {/* Header Area */}
                  <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-start pt-6">
                    <div className="min-w-0 pr-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 truncate" title={unit.property_name}>{unit.property_name}</div>
                      <div className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] truncate" title={String(unit.unit_number)}>{unit.unit_number}</div>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-[var(--shadow-sm)] ${unit.status === 'Vacant' ? 'bg-slate-50 text-slate-500 border-[var(--color-border)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30'}`}>
                      {unit.status}
                    </span>
                  </div>

                  {/* Body Area */}
                  <div className="px-5 py-4 flex-1 flex flex-col gap-4 text-sm bg-slate-50/40">
                    
                    <div className="flex justify-between items-center pb-3 border-b border-[var(--color-border)]/50">
                      <span className="text-slate-600 font-bold flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-[var(--color-border)] shadow-[var(--shadow-sm)] text-xs">
                        <Tag size={13} className="text-slate-400"/> {unit.unit_type}
                      </span>
                      <span className="text-slate-600 font-bold flex items-center gap-1.5 text-xs">
                        <Maximize size={13} className="text-slate-400"/> {unit.unit_area || <span className="text-slate-300 italic font-medium">—</span>}
                      </span>
                    </div>

                    {/* Owner Block */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] rounded-lg flex items-center justify-center shrink-0 border border-[var(--color-secondary)]/20 shadow-sm">
                        <User size={15} strokeWidth={2.5}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5">Owner</div>
                        <OwnerCell ownerName={unit.owner_name} abbreviation={unit.owner_abbreviation} />
                        {unit.business_name && (
                          <div className="text-xs font-semibold text-slate-500 truncate mt-1.5 flex items-center gap-1.5" title={unit.business_name}>
                            <Briefcase size={12} className="text-slate-400 shrink-0"/> {unit.business_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tenant Block */}
                    <div className="flex items-start gap-3 mt-1">
                      <div className="w-8 h-8 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg flex items-center justify-center shrink-0 border border-[var(--color-primary)]/20 shadow-sm">
                        <Users size={15} strokeWidth={2.5}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-0.5">Tenant</div>
                        <div className="text-sm font-bold text-slate-700 truncate block">
                          {unit.tenant_name === '—' ? <span className="text-slate-300 italic font-medium">—</span> : unit.tenant_name}
                        </div>
                      </div>
                    </div>

                    {unit.remarks && (
                      <div className="mt-2 pt-3 border-t border-[var(--color-border)]/50 flex items-start gap-2 text-xs text-slate-500 bg-white p-2.5 rounded-xl border border-[var(--color-border)] shadow-sm">
                        <FileText size={14} className="text-slate-400 shrink-0 mt-0.5"/>
                        <span className="italic leading-relaxed break-words whitespace-pre-wrap block" title={unit.remarks}>{unit.remarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Area */}
                  <div className="px-5 py-3.5 bg-white border-t border-[var(--color-border)] flex items-center justify-between">
                    <div className="flex gap-5">
                      <div className="flex flex-col" title="Turnover Date">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays size={12} className="text-slate-300"/> Turnover</span>
                        <span className="text-xs font-bold text-slate-600 mt-1">{formatDate(unit.turnover_date) || <span className="text-slate-300 italic">—</span>}</span>
                      </div>
                      <div className="w-px h-7 bg-slate-200 self-center"></div>
                      <div className="flex flex-col" title="Acceptance Date">
                        <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays size={12} className="text-slate-300"/> Acceptance</span>
                        <span className="text-xs font-bold text-slate-600 mt-1">{formatDate(unit.acceptance_date) || <span className="text-slate-300 italic">—</span>}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(unit)}
                      className="p-2.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-xl transition-all border border-slate-100 hover:border-[var(--color-primary)]/30 shadow-sm active:scale-95 bg-slate-50 shrink-0"
                      title="Edit Unit"
                    >
                      <Edit size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PREMIUM ADD / EDIT UNIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/5 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight relative z-10 flex items-center gap-2">
                {editingUnitId ? <Edit size={24} className="text-[var(--color-primary)]" /> : <Building size={24} className="text-[var(--color-primary)]" />}
                {editingUnitId ? "Edit Unit Details" : "Add New Unit"}
              </h2>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="relative z-10 w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0" disabled={isSubmitting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 sm:p-8 custom-scrollbar bg-slate-50/50 flex-1">
              <form onSubmit={handleSaveUnit} className="space-y-5 sm:space-y-6 pb-6">
                {errorMsg && <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-200/60 shadow-sm flex items-center gap-3"><AlertTriangle size={18} /> {errorMsg}</div>}

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 mb-2"><MapPin size={14} className="text-[var(--color-primary)]" /> Property Name</label>
                  <input type="text" required placeholder="e.g. The Grove, Avida Towers" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Building size={14} className="text-[var(--color-primary)]" /> Unit Number</label>
                    <input type="text" required placeholder="e.g. 12B" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Tag size={14} className="text-[var(--color-primary)]" /> Unit Type</label>
                    <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting}>
                      <option value="Studio">Studio</option>
                      <option value="1BR">1BR</option>
                      <option value="2BR">2BR</option>
                      <option value="3BR">3BR</option>
                      <option value="Commercial">Commercial</option>
                      <option value="SOHO">SOHO</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><Maximize size={14} className="text-[var(--color-primary)]" /> Unit Area</label>
                    <input type="text" required placeholder="e.g. 50.06 sqm" value={unitArea} onChange={(e) => setUnitArea(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      <span className="flex items-center gap-2"><User size={14} className="text-[var(--color-primary)]" /> Owner Name(s)</span>
                    </label>
                    <input type="text" placeholder="e.g. John Doe, Maria Reyes" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                    <p className="text-[10px] font-semibold text-slate-400 mt-2 px-1">Separate multiple names with a comma.</p>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      <Briefcase size={14} className="text-slate-400" /> Owner Abbreviation
                    </label>
                    <input type="text" placeholder="e.g. CTMRISP (Optional)" value={ownerAbbreviation} onChange={(e) => setOwnerAbbreviation(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    <Building size={14} className="text-[var(--color-primary)]" /> Business Name (Optional)
                  </label>
                  <input type="text" placeholder="e.g. Acme Corp" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] transition-all bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                </div>

                {editingUnitId && (
                  <div className="bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/20 rounded-2xl p-5 shadow-inner">
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[var(--color-secondary)] mb-2">
                      <Users size={14} className="text-[var(--color-secondary)]" /> Assigned Tenant
                    </label>
                    <input 
                      type="text" 
                      value={tenantName || "Vacant"} 
                      disabled 
                      className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 bg-white/60 text-sm font-extrabold text-[var(--color-secondary)] cursor-not-allowed shadow-sm" 
                    />
                    <p className="text-[10px] text-slate-500 font-bold mt-2 px-1 tracking-wide">
                      Tenants are managed automatically through the Leases tab.
                    </p>
                  </div>
                )}

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><CalendarDays size={14} className="text-slate-400" /> Turnover Date (Opt)</label>
                    <input type="date" value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold transition-all text-[var(--color-text)] bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><CalendarDays size={14} className="text-slate-400" /> Acceptance Date (Opt)</label>
                    <input type="date" value={acceptanceDate} onChange={(e) => setAcceptanceDate(e.target.value)} className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-bold transition-all text-[var(--color-text)] bg-slate-50 focus:bg-white" disabled={isSubmitting} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-[var(--color-border)]">
                  <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2"><FileText size={14} className="text-slate-400" /> Remarks (Optional)</label>
                  <textarea 
                    rows={2} 
                    placeholder="Enter any additional notes or tags..." 
                    value={remarks} 
                    onChange={(e) => setRemarks(e.target.value)} 
                    className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-sm font-medium text-[var(--color-text)] transition-all resize-none bg-slate-50 focus:bg-white" 
                    disabled={isSubmitting} 
                  />
                </div>

              </form>
            </div>
            
            <div className="px-4 sm:px-8 py-3.5 sm:py-5 border-t border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 flex items-center justify-between gap-2.5 relative z-20">
              {editingUnitId ? (
                <button 
                  type="button" 
                  onClick={() => openDeleteModal({ id: editingUnitId, property_name: propertyName, unit_number: unitNumber })} 
                  disabled={isSubmitting} 
                  className="h-11 sm:h-12 px-3 sm:px-4 text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 border border-red-200/60 rounded-[var(--radius-md)] transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
                  title="Delete Unit"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                  <span className="hidden sm:inline">Delete Unit</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial justify-end">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={isSubmitting} 
                  className="h-11 sm:h-12 flex-1 sm:flex-none px-4 sm:px-6 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-[var(--shadow-sm)] rounded-[var(--radius-md)] transition-all active:scale-95 flex items-center justify-center"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleSaveUnit} 
                  disabled={isSubmitting} 
                  className="h-11 sm:h-12 flex-1 sm:flex-none bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-5 sm:px-8 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-wider transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center min-w-[110px] sm:min-w-[140px] border border-transparent"
                >
                  {isSubmitting ? <span className="animate-pulse">Saving...</span> : editingUnitId ? "Save Changes" : "Add Unit"}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* CSV IMPORT PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-[90vw] overflow-hidden transform transition-all h-[85vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-500 border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)] shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] tracking-tight">Review Import Data</h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Review your CSV entries. Delete any row you do not want to upload.</p>
              </div>
              <button onClick={() => !isImporting && setIsPreviewModalOpen(false)} className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-[var(--color-primary)] transition-colors active:scale-95 shrink-0" disabled={isImporting}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="overflow-auto custom-scrollbar flex-1 bg-slate-50/50 p-6">
              <div className="bg-white border border-slate-200/80 rounded-[1.5rem] overflow-hidden shadow-[var(--shadow-sm)]">
                <table className="w-full text-left text-xs relative">
                  <thead className="bg-slate-50/90 backdrop-blur-md text-slate-400 font-black uppercase tracking-widest sticky top-0 shadow-sm z-10 border-b border-[var(--color-border)]">
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
                  <tbody className="divide-y divide-slate-100 text-[var(--color-text)] font-medium">
                    {csvPreviewData.length === 0 ? (
                      <tr><td colSpan={13} className="px-5 py-12 text-center text-slate-400 font-bold">No rows remaining.</td></tr>
                    ) : (
                      csvPreviewData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[var(--color-primary)]/5 transition-colors">
                          <td className="px-5 py-3 font-black text-[var(--color-secondary)] whitespace-nowrap">{row.property_name}</td>
                          <td className="px-5 py-3 font-bold whitespace-nowrap">{row.unit_number}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.unit_type}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.unit_area || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap font-bold text-[var(--color-secondary)]">{row.owner_name}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.owner_abbreviation || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{row.business_name || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap font-bold text-[var(--color-secondary)]">{row.tenant_name}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{formatDate(row.turnover_date) || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">{formatDate(row.acceptance_date) || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap max-w-[150px] truncate" title={row.remarks}>{row.remarks || '—'}</td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[9px] font-black uppercase tracking-wider border shadow-[var(--shadow-sm)] ${row.status === 'Vacant' ? 'bg-white text-slate-500 border-[var(--color-border)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/30'}`}>
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

            <div className="px-6 sm:px-8 py-5 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between bg-[var(--color-bg)] shrink-0 gap-4">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Ready to import: <span className="text-[var(--color-primary)] text-base ml-1 mr-1 bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-sm">{csvPreviewData.length}</span> units
                {units.length + csvPreviewData.length > maxUnits && (
                  <span className="text-red-500 flex items-center gap-1.5 mt-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 normal-case tracking-normal font-bold">
                    <AlertTriangle size={14} /> Exceeds remaining plan limits! Delete some rows.
                  </span>
                )}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button type="button" onClick={() => setIsPreviewModalOpen(false)} disabled={isImporting} className="flex-1 sm:flex-none px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-[var(--color-secondary)] bg-white border border-slate-200 hover:border-slate-300 hover:shadow-[var(--shadow-sm)] rounded-[var(--radius-md)] transition-all active:scale-95">Cancel</button>
                <button 
                  onClick={confirmCsvImport} 
                  disabled={isImporting || csvPreviewData.length === 0 || (units.length + csvPreviewData.length > maxUnits)} 
                  className="flex-1 sm:flex-none bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] px-8 py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-wider transition-all shadow-[var(--shadow-md)] border border-transparent active:scale-95 flex items-center justify-center min-w-[180px]"
                >
                  {isImporting ? <span className="animate-pulse">Importing...</span> : "Confirm & Import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARE YOU SURE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg)] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in zoom-in-95 duration-300 border border-[var(--color-border)]">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5 border-2 border-amber-100 shadow-inner">
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-secondary)] tracking-tight mb-2">Confirm Action</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              {confirmType === 'add' && "Are you sure you want to add this new unit to your property database?"}
              {confirmType === 'edit' && "Are you sure you want to save these changes to the unit?"}
              {confirmType === 'import' && `Are you sure you want to import ${csvPreviewData.length} units? Please make sure the data is correct.`}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting || isImporting}
                className="flex-1 px-4 py-3.5 text-xs uppercase tracking-widest font-black text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-[var(--color-secondary)] rounded-[var(--radius-md)] transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmType === 'add' || confirmType === 'edit') executeSaveUnit();
                  if (confirmType === 'import') executeCsvImport();
                }}
                disabled={isSubmitting || isImporting}
                className="flex-1 bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-4 py-3.5 rounded-[var(--radius-md)] text-xs uppercase tracking-widest font-black transition-all shadow-[var(--shadow-md)] flex items-center justify-center active:scale-95 border border-transparent"
              >
                {isSubmitting || isImporting ? <span className="animate-pulse">Processing...</span> : "Yes, I'm sure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {unitToDelete && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg)] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in zoom-in-95 duration-300 border border-[var(--color-border)]">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-[1.2rem] flex items-center justify-center mx-auto mb-5 border-2 border-red-100 shadow-inner">
              <Trash2 size={32} strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-secondary)] tracking-tight mb-2">Delete Unit?</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-bold text-[var(--color-secondary)]">{unitToDelete.property_name} - Unit {unitToDelete.unit_number}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setUnitToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3.5 text-xs uppercase tracking-widest font-black text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-[var(--color-secondary)] rounded-[var(--radius-md)] transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteUnit}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3.5 rounded-[var(--radius-md)] text-xs uppercase tracking-widest font-black transition-all shadow-lg flex items-center justify-center active:scale-95 border border-transparent"
              >
                {isDeleting ? <span className="animate-pulse">Deleting...</span> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-[var(--color-bg)] rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-8 animate-in fade-in zoom-in-95 duration-300 border border-[var(--color-border)]">
            <div className="w-20 h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-white shadow-sm">
              <CheckCircle2 size={40} strokeWidth={3} />
            </div>
            <h2 className="text-2xl font-black text-[var(--color-secondary)] tracking-tight mb-2">Success!</h2>
            <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
              Your unit details have been successfully saved.
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] px-4 py-3.5 rounded-[var(--radius-md)] text-xs uppercase tracking-widest font-black transition-all shadow-[var(--shadow-md)] active:scale-95 border border-transparent"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}