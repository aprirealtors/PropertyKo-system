"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Calculator, CalendarClock, Download, Send, CreditCard, CheckCircle, Clock, ChevronLeft, Upload, Loader2, AlertCircle, Settings } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading }: any) {
  
  // Database & UI States
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [allSoaConfigs, setAllSoaConfigs] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);

  // Modal States
  const [isPaymentSelectionModalOpen, setIsPaymentSelectionModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); 
  const [paymentModalParty, setPaymentModalParty] = useState<'owner' | 'tenant' | null>(null);
  const [isUnitConfigModalOpen, setIsUnitConfigModalOpen] = useState(false);
  const [isSOAModalOpen, setIsSOAModalOpen] = useState(false);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [waiveSuccess, setWaiveSuccess] = useState<{party: 'owner' | 'tenant'} | null>(null);
  
  // Overdue Confirmation Modal States
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [overdueConfig, setOverdueConfig] = useState({ owner: false, tenant: false });

  const [isSimulating, setIsSimulating] = useState(false);
  const [isSendingSOA, setIsSendingSOA] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false); 
  const [isWaiving, setIsWaiving] = useState(false);
  const [isSavingUnitConfig, setIsSavingUnitConfig] = useState(false);

  // Payment Fetch States
  const [fetchedPayment, setFetchedPayment] = useState<any>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);

  // SOA Assignment States
  const [soaConfig, setSoaConfig] = useState({
    owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
    tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
  });

  // Unit-Specific Config Form States
  const [unitCompDuesRate, setUnitCompDuesRate] = useState("");
  const [unitCompWater, setUnitCompWater] = useState("");
  const [unitCompElec, setUnitCompElec] = useState("");
  const [unitCompParking, setUnitCompParking] = useState("");
  const [unitCompPenaltyType, setUnitCompPenaltyType] = useState("percent");
  const [unitCompPenaltyValue, setUnitCompPenaltyValue] = useState("");
  const [unitCompCollectionDay, setUnitCompCollectionDay] = useState(""); 
  const [unitCompGracePeriod, setUnitCompGracePeriod] = useState(""); 
  const [unitCompBankName, setUnitCompBankName] = useState("");
  const [unitCompBankAccountName, setUnitCompBankAccountName] = useState("");
  const [unitCompBankAccountNumber, setUnitCompBankAccountNumber] = useState("");
  const [unitCompQrUrl, setUnitCompQrUrl] = useState("");
  
  // QR Code Upload States
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (orgData?.admin_email) {
      fetchAllUnits();
    }
  }, [orgData?.admin_email]);

  useEffect(() => {
    if (isPaymentModalOpen && paymentModalParty && selectedUnit) {
      const fetchPayment = async () => {
        setIsFetchingPayment(true);
        const { data, error } = await supabase
          .from('soa')
          .select('owner_payment_method, owner_reference_number, tenant_payment_method, tenant_reference_number')
          .eq('unit_id', selectedUnit.id)
          .single();
        
        if (data && !error) {
          const method = paymentModalParty === 'owner' ? data.owner_payment_method : data.tenant_payment_method;
          const ref = paymentModalParty === 'owner' ? data.owner_reference_number : data.tenant_reference_number;
          
          if (method) {
            setFetchedPayment({
              payment_method: method,
              reference_number: ref,
            });
          } else {
            setFetchedPayment(null);
          }
        } else {
          setFetchedPayment(null);
        }
        setIsFetchingPayment(false);
      };
      fetchPayment();
    } else {
      setFetchedPayment(null);
    }
  }, [isPaymentModalOpen, paymentModalParty, selectedUnit]);

  const fetchAllUnits = async () => {
    setIsLoading(true);
    
    const { data: unitsData, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .eq('admin_email', orgData.admin_email); 

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      setIsLoading(false);
      return;
    }

    if (unitsData && unitsData.length > 0) {
      const sortedData = unitsData.sort((a, b) => {
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

      setAllUnits(sortedData);
      
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSelectedUnit(sortedData[0]); 
      } else {
        setSelectedUnit(null);
      }
      
      const statuses: Record<string, string> = {};
      sortedData.forEach((u) => {
        statuses[u.id] = u.payment_status || 'Pending';
      });
      setLocalStatuses(statuses);

      const unitIds = sortedData.map(u => u.id);
      const { data: soaData, error: soaError } = await supabase
        .from('soa')
        .select('*')
        .in('unit_id', unitIds);

      if (!soaError && soaData) {
        const soaMap: Record<string, any> = {};
        soaData.forEach(row => {
          soaMap[row.unit_id] = row;
        });
        setAllSoaConfigs(soaMap);
      }
    }
    setIsLoading(false);
  };

  const getUnitAreaValue = (areaStr: string) => {
    const parsed = parseFloat(String(areaStr || "0").replace(/[^\d.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  const filteredUnits = allUnits.filter(u => {
    if (!searchQuery) return true;
    const lowerQ = searchQuery.toLowerCase();
    return (
      (u.unit_number && u.unit_number.toLowerCase().includes(lowerQ)) ||
      (u.property_name && u.property_name.toLowerCase().includes(lowerQ)) ||
      (u.owner_name && u.owner_name.toLowerCase().includes(lowerQ)) ||
      (u.tenant_name && u.tenant_name.toLowerCase().includes(lowerQ))
    );
  });

  const isOwnerVacant = !selectedUnit?.owner_name || selectedUnit?.owner_name === '—';
  const isTenantVacant = selectedUnit?.status === 'Vacant' || !selectedUnit?.tenant_name || selectedUnit?.tenant_name === '—';
  const unitArea = getUnitAreaValue(selectedUnit?.unit_area);
  
  const currentSoa = selectedUnit ? allSoaConfigs[selectedUnit.id] : null;
  const isAssigned = !!currentSoa; 
  const ownerStatus = currentSoa?.owner_status || 'Pending';
  const tenantStatus = currentSoa?.tenant_status || 'Pending';

  const hasOwnerAssign = isAssigned && (currentSoa.owner_dues || currentSoa.owner_parking || currentSoa.owner_water || currentSoa.owner_electricity || currentSoa.owner_penalty);
  const hasTenantAssign = isAssigned && (currentSoa.tenant_dues || currentSoa.tenant_parking || currentSoa.tenant_water || currentSoa.tenant_electricity || currentSoa.tenant_penalty);
  
  // ==========================================
  // UNIT-SPECIFIC BILLING CALCULATION
  // ==========================================
  const activeDuesRate = selectedUnit?.dues_rate || 0;
  const activeWater = selectedUnit?.water || 0;
  const activeElectricity = selectedUnit?.electricity || 0;
  const activeParking = selectedUnit?.parking || 0;
  
  const colDay = selectedUnit?.collection_day || 1;
  const grace = selectedUnit?.grace_period_days || 15;
  const pType = selectedUnit?.penalty_type || 'percent';
  const pVal = selectedUnit?.penalty_value || 0;

  const rawDues = activeDuesRate * unitArea;
  const rawWater = activeWater;
  const rawElectricity = activeElectricity;
  const rawParking = activeParking;

  const activeConfig = currentSoa ? {
    owner: { dues: currentSoa.owner_dues, parking: currentSoa.owner_parking, water: currentSoa.owner_water, electricity: currentSoa.owner_electricity, penalty: currentSoa.owner_penalty },
    tenant: { dues: currentSoa.tenant_dues, parking: currentSoa.tenant_parking, water: currentSoa.tenant_water, electricity: currentSoa.tenant_electricity, penalty: currentSoa.tenant_penalty }
  } : {
    owner: { dues: true, parking: true, water: isTenantVacant, electricity: isTenantVacant, penalty: false },
    tenant: { dues: false, parking: false, water: !isTenantVacant, electricity: !isTenantVacant, penalty: !isTenantVacant && tenantStatus === 'Overdue' }
  };

  const ownerBase = 
    (activeConfig.owner.dues ? rawDues : 0) + 
    (activeConfig.owner.parking ? rawParking : 0) + 
    (activeConfig.owner.water ? rawWater : 0) + 
    (activeConfig.owner.electricity ? rawElectricity : 0);

  const tenantBase = 
    (activeConfig.tenant.dues ? rawDues : 0) + 
    (activeConfig.tenant.parking ? rawParking : 0) + 
    (!isTenantVacant && activeConfig.tenant.water ? rawWater : 0) + 
    (!isTenantVacant && activeConfig.tenant.electricity ? rawElectricity : 0);

  // Define hypothetical penalties used in the Overdue Modal
  const hypotheticalOwnerPenalty = pType === 'percent' ? ownerBase * (pVal / 100) : pVal;
  const hypotheticalTenantPenalty = pType === 'percent' ? tenantBase * (pVal / 100) : pVal;

  let ownerPenalty = 0;
  if ((ownerStatus === 'Overdue' || currentSoa?.owner_penalty) && !isOwnerVacant) {
    ownerPenalty = hypotheticalOwnerPenalty;
  }

  let tenantPenalty = 0;
  if ((tenantStatus === 'Overdue' || currentSoa?.tenant_penalty) && !isTenantVacant) {
    tenantPenalty = hypotheticalTenantPenalty;
  }

  const ownerTotalDue = ownerBase + ownerPenalty;
  const tenantTotalDue = tenantBase + tenantPenalty;
  const totalDue = ownerTotalDue + tenantTotalDue;

  const openUnitConfigModal = () => {
    if (!selectedUnit) return;
    setUnitCompDuesRate(selectedUnit.dues_rate != null ? String(selectedUnit.dues_rate) : "");
    setUnitCompWater(selectedUnit.water != null ? String(selectedUnit.water) : "");
    setUnitCompElec(selectedUnit.electricity != null ? String(selectedUnit.electricity) : "");
    setUnitCompParking(selectedUnit.parking != null ? String(selectedUnit.parking) : "");
    setUnitCompPenaltyType(selectedUnit.penalty_type || "percent");
    setUnitCompPenaltyValue(selectedUnit.penalty_value != null ? String(selectedUnit.penalty_value) : "");
    setUnitCompCollectionDay(selectedUnit.collection_day != null ? String(selectedUnit.collection_day) : "");
    setUnitCompGracePeriod(selectedUnit.grace_period_days != null ? String(selectedUnit.grace_period_days) : "");
    setUnitCompBankName(selectedUnit.bank_name || "");
    setUnitCompBankAccountName(selectedUnit.bank_account_name || "");
    setUnitCompBankAccountNumber(selectedUnit.bank_account_number || "");
    setUnitCompQrUrl(selectedUnit.qr_code_url || "");
    setIsUnitConfigModalOpen(true);
  };

  const openSOAModal = () => {
    if (isAssigned) {
      setSoaConfig(activeConfig);
    } else {
      setSoaConfig({
        owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
        tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
      });
    }
    setIsSOAModalOpen(true);
  };

  const handleToggleSoa = (party: 'owner' | 'tenant', item: keyof typeof soaConfig.owner, value: boolean) => {
    setSoaConfig(prev => {
      const otherParty = party === 'owner' ? 'tenant' : 'owner';
      const newConfig = {
        ...prev,
        [party]: { ...prev[party], [item]: value }
      };

      if (value) {
        newConfig[otherParty] = { ...newConfig[otherParty], [item]: false };
      }
      return newConfig;
    });
  };

  const saveSoaToDatabase = async (statusOverride?: string) => {
    const existing = allSoaConfigs[selectedUnit.id];
    
    const payload: any = {
      unit_id: selectedUnit.id,
      owner_dues: soaConfig.owner.dues,
      owner_parking: soaConfig.owner.parking,
      owner_water: soaConfig.owner.water,
      owner_electricity: soaConfig.owner.electricity,
      owner_penalty: soaConfig.owner.penalty,
      tenant_dues: soaConfig.tenant.dues,
      tenant_parking: soaConfig.tenant.parking,
      tenant_water: soaConfig.tenant.water,
      tenant_electricity: soaConfig.tenant.electricity,
      tenant_penalty: soaConfig.tenant.penalty,
    };

    if (statusOverride) {
      payload.owner_status = !isOwnerVacant ? statusOverride : (existing?.owner_status || 'Pending');
      payload.tenant_status = !isTenantVacant ? statusOverride : (existing?.tenant_status || 'Pending');
    } else {
      payload.owner_status = existing?.owner_status || 'Pending';
      payload.tenant_status = existing?.tenant_status || 'Pending';
    }

    if (existing?.id) {
      payload.id = existing.id;
    }

    const { error } = await supabase
      .from('soa')
      .upsert(payload, { onConflict: 'unit_id' });

    if (error) {
      console.error("Supabase Database Error:", error);
      throw error;
    }
    
    setAllSoaConfigs(prev => ({ ...prev, [selectedUnit.id]: { ...existing, ...payload } }));
  };

  const handleSaveDefaultSOA = async () => {
    setIsSavingDefault(true);
    try {
      await saveSoaToDatabase();
      setIsSOAModalOpen(false);
    } catch (err) {
      console.error("Failed to save default SOA:", err);
      alert("There was an error saving the default SOA configuration.");
    } finally {
      setIsSavingDefault(false);
    }
  };

  // Regular SEND without penalty logic overrides
  const handleSendSOA = async () => {
    setIsSendingSOA(true);
    try {
      await saveSoaToDatabase('Pending');

      const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity || soaConfig.owner.penalty;
      const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity || soaConfig.tenant.penalty;

      const notificationsToInsert = [];
      let ownerEmail = null;
      let tenantEmail = null;

      const { data: members } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('admin_email', orgData.admin_email);

      if (members && members.length > 0) {
        if (ownerHasBill && !isOwnerVacant) {
          const ownerMatch = members.find(m => m.name?.trim().toLowerCase() === selectedUnit?.owner_name?.trim().toLowerCase());
          if (ownerMatch) ownerEmail = ownerMatch.email;
        }
        
        if (tenantHasBill && !isTenantVacant) {
          const tenantMatch = members.find(m => m.name?.trim().toLowerCase() === selectedUnit?.tenant_name?.trim().toLowerCase());
          if (tenantMatch) tenantEmail = tenantMatch.email;
        }
      }

      const finalOwnerTotal = ownerBase + ownerPenalty;
      const finalTenantTotal = tenantBase + tenantPenalty;

      if (ownerHasBill && ownerEmail) {
        notificationsToInsert.push({
          admin_email: orgData.admin_email,
          recipient: ownerEmail,
          type: 'BILLING',
          title: 'New Statement of Account',
          message: `Your billing statement for ${selectedUnit.property_name} Unit ${selectedUnit.unit_number} is now available. Total Due: ₱${finalOwnerTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
          reference_id: selectedUnit.id,
          is_read: false
        });
      }

      if (tenantHasBill && tenantEmail) {
        notificationsToInsert.push({
          admin_email: orgData.admin_email,
          recipient: tenantEmail,
          type: 'BILLING',
          title: 'New Statement of Account',
          message: `Your billing statement for ${selectedUnit.property_name} Unit ${selectedUnit.unit_number} is now available. Total Due: ₱${finalTenantTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
          reference_id: selectedUnit.id,
          is_read: false
        });
      }

      if (notificationsToInsert.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(notificationsToInsert);
        if (notifError) console.error("Error sending SOA notifications:", notifError);
      }

      setIsSOAModalOpen(false);
    } catch (err) {
      console.error("Failed to send SOA:", err);
      alert("There was an error saving the SOA configuration.");
    } finally {
      setIsSendingSOA(false);
    }
  };

  // Dedicated Confirmed Overdue Submission based on Overdue Checkboxes
  const handleConfirmOverdue = async () => {
    setIsSendingSOA(true);
    try {
      const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity;
      const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity;

      const existing = allSoaConfigs[selectedUnit.id];

      // Maintain existing penalties and ONLY append new ones checked in the modal
      const effectiveOwnerPenalty = soaConfig.owner.penalty || overdueConfig.owner;
      const effectiveTenantPenalty = soaConfig.tenant.penalty || overdueConfig.tenant;

      const payload: any = {
        unit_id: selectedUnit.id,
        owner_dues: soaConfig.owner.dues,
        owner_parking: soaConfig.owner.parking,
        owner_water: soaConfig.owner.water,
        owner_electricity: soaConfig.owner.electricity,
        owner_penalty: effectiveOwnerPenalty, 
        tenant_dues: soaConfig.tenant.dues,
        tenant_parking: soaConfig.tenant.parking,
        tenant_water: soaConfig.tenant.water,
        tenant_electricity: soaConfig.tenant.electricity,
        tenant_penalty: effectiveTenantPenalty, 
      };

      if (existing?.id) payload.id = existing.id;

      // Ensure statuses update securely
      payload.owner_status = (effectiveOwnerPenalty && ownerHasBill && !isOwnerVacant) ? 'Overdue' : (existing?.owner_status || 'Pending');
      payload.tenant_status = (effectiveTenantPenalty && tenantHasBill && !isTenantVacant) ? 'Overdue' : (existing?.tenant_status || 'Pending');

      const { error } = await supabase.from('soa').upsert(payload, { onConflict: 'unit_id' });
      
      if (error) {
        console.error("Supabase Detailed Error:", JSON.stringify(error));
        throw error;
      }

      // Update local state and UI immediately
      setAllSoaConfigs(prev => ({ ...prev, [selectedUnit.id]: { ...existing, ...payload } }));
      setSoaConfig(prev => ({
        owner: { ...prev.owner, penalty: effectiveOwnerPenalty },
        tenant: { ...prev.tenant, penalty: effectiveTenantPenalty }
      }));

      // Find emails and send notifications
      const notificationsToInsert = [];
      let ownerEmail = null;
      let tenantEmail = null;

      const { data: members } = await supabase.from('team_members').select('name, email').eq('admin_email', orgData.admin_email);

      if (members && members.length > 0) {
        if (ownerHasBill && !isOwnerVacant) {
          const ownerMatch = members.find(m => m.name?.trim().toLowerCase() === selectedUnit?.owner_name?.trim().toLowerCase());
          if (ownerMatch) ownerEmail = ownerMatch.email;
        }
        if (tenantHasBill && !isTenantVacant) {
          const tenantMatch = members.find(m => m.name?.trim().toLowerCase() === selectedUnit?.tenant_name?.trim().toLowerCase());
          if (tenantMatch) tenantEmail = tenantMatch.email;
        }
      }

      const finalOwnerTotal = ownerBase + (effectiveOwnerPenalty ? hypotheticalOwnerPenalty : 0);
      const finalTenantTotal = tenantBase + (effectiveTenantPenalty ? hypotheticalTenantPenalty : 0);

      // ✨ CRITICAL FIX: Only send email to the party if their box was *just now* checked (overdueConfig is true)
      if (ownerHasBill && ownerEmail && overdueConfig.owner) {
        notificationsToInsert.push({
          admin_email: orgData.admin_email,
          recipient: ownerEmail,
          type: 'BILLING',
          title: '⚠️ OVERDUE: Statement of Account',
          message: `URGENT: Your billing statement for ${selectedUnit.property_name} Unit ${selectedUnit.unit_number} is OVERDUE. Total Due including penalties: ₱${finalOwnerTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
          reference_id: selectedUnit.id,
          is_read: false
        });
      }

      // ✨ CRITICAL FIX: Only send email to the party if their box was *just now* checked (overdueConfig is true)
      if (tenantHasBill && tenantEmail && overdueConfig.tenant) {
        notificationsToInsert.push({
          admin_email: orgData.admin_email,
          recipient: tenantEmail,
          type: 'BILLING',
          title: '⚠️ OVERDUE: Statement of Account',
          message: `URGENT: Your billing statement for ${selectedUnit.property_name} Unit ${selectedUnit.unit_number} is OVERDUE. Total Due including penalties: ₱${finalTenantTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
          reference_id: selectedUnit.id,
          is_read: false
        });
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }

      setIsOverdueModalOpen(false);

    } catch (err: any) {
      console.error("OVERDUE ERROR:", err);
      alert(`Failed to apply overdue status: ${err.message || 'Please check console'}`);
    } finally {
      setIsSendingSOA(false);
    }
  };

  const handleWaivePenalty = async (party: 'owner' | 'tenant') => {
    setIsWaiving(true);
    try {
      const updateField = { 
        [`${party}_penalty`]: false,
        [`${party}_status`]: 'Pending'
      };
      
      const { error } = await supabase
        .from('soa')
        .update(updateField)
        .eq('unit_id', selectedUnit.id);
        
      if (error) throw error;
      
      setAllSoaConfigs(prev => ({
        ...prev,
        [selectedUnit.id]: { ...prev[selectedUnit.id], ...updateField }
      }));
      
      setIsPenaltyModalOpen(false);
      setWaiveSuccess({ party });

    } catch (err: any) {
      console.error("Error waiving penalty", err);
      alert(`Failed to waive penalty: ${err.message || 'Check your database permissions'}`);
    } finally {
      setIsWaiving(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file for the QR code.");
      return;
    }

    setIsUploadingQr(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-${orgData.admin_email}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setUnitCompQrUrl(publicUrlData.publicUrl);

    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Error uploading QR image: " + error.message);
    } finally {
      setIsUploadingQr(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const handleSaveUnitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    setIsSavingUnitConfig(true);

    const payload = {
      dues_rate: unitCompDuesRate !== "" ? parseFloat(unitCompDuesRate) : null,
      water: unitCompWater !== "" ? parseFloat(unitCompWater) : null,
      electricity: unitCompElec !== "" ? parseFloat(unitCompElec) : null,
      parking: unitCompParking !== "" ? parseFloat(unitCompParking) : null,
      penalty_type: unitCompPenaltyType,
      penalty_value: unitCompPenaltyValue !== "" ? parseFloat(unitCompPenaltyValue) : null,
      collection_day: unitCompCollectionDay !== "" ? parseInt(unitCompCollectionDay) : null,
      grace_period_days: unitCompGracePeriod !== "" ? parseInt(unitCompGracePeriod) : null,
      bank_name: unitCompBankName,
      bank_account_name: unitCompBankAccountName,
      bank_account_number: unitCompBankAccountNumber,
      qr_code_url: unitCompQrUrl
    };

    try {
      const { error } = await supabase
        .from('units')
        .update(payload)
        .eq('id', selectedUnit.id);

      if (error) throw error;

      // Update Local State
      setAllUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, ...payload } : u));
      setSelectedUnit((prev: any) => ({ ...prev, ...payload }));
      
      setIsUnitConfigModalOpen(false);
    } catch (err: any) {
      console.error("Failed to update unit computation:", err);
      alert(err.message || "Failed to update unit configuration");
    } finally {
      setIsSavingUnitConfig(false);
    }
  };

  const generateLedgerMonths = () => {
    const months = [];
    const currentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      let stat = "Upcoming";
      if (i < currentMonthIndex) {
        stat = "Paid"; 
      } else if (i === currentMonthIndex) {
        if ((hasOwnerAssign && ownerStatus === 'Overdue') || (hasTenantAssign && tenantStatus === 'Overdue')) stat = 'Overdue';
        else if ((hasOwnerAssign && ownerStatus === 'Pending') || (hasTenantAssign && tenantStatus === 'Pending')) stat = 'Pending';
        else if ((hasOwnerAssign && ownerStatus === 'Sent') || (hasTenantAssign && tenantStatus === 'Sent')) stat = 'Sent';
        else if (!hasOwnerAssign && !hasTenantAssign) stat = 'Unassigned';
        else stat = 'Paid';
      }
      
      const dueDate = `${monthName} ${colDay}, ${currentYear}`;
      
      months.push({
        monthName: monthName,
        year: currentYear,
        dueDate: dueDate,
        status: stat,
        isCurrentMonth: i === currentMonthIndex
      });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();

  const handleExportCSV = () => {
    if (!selectedUnit || ledgerData.length === 0) return;

    const headers = ["PERIOD", "DUE DATE", "DUES", "PARKING", "UTILITIES", "PENALTY", "STATUS", "TOTAL"];
    
    const rows = ledgerData.map(row => {
      const rowPenalty = row.isCurrentMonth ? (ownerPenalty + tenantPenalty) : 0;
      const rowTotal = row.isCurrentMonth ? totalDue : (ownerBase + tenantBase);
      const utilsTotal = rawWater + rawElectricity;

      return [
        `"${row.monthName} ${row.year}"`,
        `"${row.dueDate}"`,
        Number(rawDues).toFixed(2),
        Number(rawParking).toFixed(2),
        Number(utilsTotal).toFixed(2),
        Number(rowPenalty).toFixed(2),
        `"${row.status}"`,
        Number(rowTotal).toFixed(2)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const safePropertyName = (selectedUnit.property_name || "Property").replace(/\s+/g, '_');
    const safeUnitNumber = String(selectedUnit.unit_number || "Unit").replace(/\s+/g, '');
    const currentYear = new Date().getFullYear();
    const fileName = `${safePropertyName}_Unit_${safeUnitNumber}_Ledger_${currentYear}.csv`;

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmPayment = async () => {
    if (!paymentModalParty || !selectedUnit) return;
    setIsSimulating(true);
    
    try {
      const updateField: any = paymentModalParty === 'owner' ? { owner_status: 'Paid' } : { tenant_status: 'Paid' };
      
      if (paymentModalParty === 'owner' && ownerPenalty > 0) {
        updateField.owner_penalty = true;
      }
      
      if (paymentModalParty === 'tenant' && tenantPenalty > 0) {
        updateField.tenant_penalty = true;
      }
      
      const { error } = await supabase
        .from('soa')
        .update(updateField)
        .eq('unit_id', selectedUnit.id);
        
      if (error) throw error;

      const { data: members } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('admin_email', orgData.admin_email);

      let targetEmail = null;
      if (members && members.length > 0) {
        const targetName = paymentModalParty === 'owner' ? selectedUnit.owner_name : selectedUnit.tenant_name;
        
        const match = members.find(m => m.name?.trim().toLowerCase() === targetName?.trim().toLowerCase());
        if (match) targetEmail = match.email;
      }

      if (targetEmail) {
        const { error: notifError } = await supabase.from('notifications').insert([{
          admin_email: orgData.admin_email,
          recipient: targetEmail,
          type: 'BILLING',
          title: 'Payment Verified',
          message: `Your payment for ${selectedUnit.property_name} Unit ${selectedUnit.unit_number} has been verified and settled. Thank you!`,
          reference_id: selectedUnit.id,
          is_read: false
        }]);
        
        if (notifError) console.error("Error sending payment success notification:", notifError);
      }

      setAllSoaConfigs(prev => ({
        ...prev,
        [selectedUnit.id]: { ...prev[selectedUnit.id], ...updateField }
      }));
    } catch (err: any) {
      console.error("Error updating payment status", err);
      alert(`Failed to confirm payment: ${err.message || 'Check your database permissions'}`);
    } finally {
      setIsSimulating(false);
      setPaymentModalParty(null);
      setIsPaymentModalOpen(false); 
      setFetchedPayment(null);
    }
  };

  const initials = orgData?.org_name 
  ? orgData.org_name.split(' ').map((word: string) => word.charAt(0)).join('').substring(0, 4).toUpperCase() 
  : "AD";

  const renderStatusBadge = (status: string) => {
    if (status === 'Paid') return <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-emerald-100 uppercase tracking-wide shadow-sm shrink-0">Paid</span>;
    if (status === 'Overdue') return <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-red-100 uppercase tracking-wide shadow-sm shrink-0">Overdue</span>;
    if (status === 'Sent') return <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-blue-100 uppercase tracking-wide shadow-sm shrink-0">Sent</span>;
    return <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md sm:rounded-full text-[10px] sm:text-[11px] border border-amber-100 uppercase tracking-wide shadow-sm shrink-0">Pending</span>;
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden">
      
      {/* TOP HEADER */}
      <div className="shrink-0 bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 p-4 sm:p-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm backdrop-blur-xl">
          <div className="w-full sm:w-auto flex justify-between items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2.5 sm:gap-3">
                {/* ✨ ADDED PREMIUM ICON WRAPPER */}
                <div className="p-1.5 sm:p-2 bg-white rounded-xl border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0">
                  <CreditCard className="text-[var(--color-text)]" size={22} strokeWidth={2.5} />
                </div>
                Billing & Payments
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium truncate">SOA, Collection & Owner Remittance</p>
            </div>
            <div className="sm:hidden w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs border border-[var(--color-primary)]/20 shadow-sm shrink-0">{initials}</div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto mt-1 sm:mt-0">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search units, tenants, owners..." 
                className="w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-[13px] sm:text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] bg-slate-50 transition-all shadow-inner text-[var(--color-text)]" 
              />
            </div>
            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 bg-[var(--color-primary)]/10 rounded-xl border border-[var(--color-primary)]/20 shadow-sm">
              <span className="text-xs font-black text-[var(--color-text)] uppercase tracking-wider">Admin</span>
              <div className="w-12 h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)]">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto w-full relative">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold text-xs uppercase tracking-wider gap-3">
            <Clock size={24} className="animate-spin text-[var(--color-text)]" /> Loading billing data...
          </div>
        ) : allUnits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white rounded-[2rem] shadow-[var(--shadow-md)] border border-[var(--color-border)] p-10 sm:p-12 text-center max-w-md w-full">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/5 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-[var(--color-primary)]/10 shadow-inner">
                <CreditCard size={28} className="text-[var(--color-primary)]/50 sm:w-8 sm:h-8" />
              </div>
              <p className="text-[var(--color-text)] font-black text-lg sm:text-xl tracking-tight">No units found</p>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Add units to your property to manage billing.</p>
            </div>
          </div>
        ) : (
          <>
            {/* SIDEBAR */}
            <div className={`w-full md:w-[320px] lg:w-[360px] shrink-0 bg-white border-r border-[var(--color-border)] flex-col h-full shadow-sm ${isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              <div className="p-3 sm:p-5 border-b border-[var(--color-border)] shrink-0 bg-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] uppercase tracking-wider">Property Units</h3>
                </div>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 px-2 sm:px-2.5 py-1 rounded-lg shadow-sm">{filteredUnits.length} Total</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3 space-y-1 bg-[var(--color-bg)]/30">
                {filteredUnits.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-xs font-bold text-slate-400">No units match your search.</p>
                  </div>
                ) : (
                  filteredUnits.map((unit) => {
                    const isSelected = selectedUnit?.id === unit.id;
                    const isRowOwnerVacant = !unit.owner_name || unit.owner_name === '—';
                    const isRowTenantVacant = unit.status === 'Vacant' || !unit.tenant_name || unit.tenant_name === '—';
                    const rowSoa = allSoaConfigs[unit.id];
                    const rOwnerStat = rowSoa?.owner_status || 'Pending';
                    const rTenantStat = rowSoa?.tenant_status || 'Pending';
                    
                    const hasRowOwnerAssign = rowSoa && (rowSoa.owner_dues || rowSoa.owner_parking || rowSoa.owner_water || rowSoa.owner_electricity || rowSoa.owner_penalty);
                    const hasRowTenantAssign = rowSoa && (rowSoa.tenant_dues || rowSoa.tenant_parking || rowSoa.tenant_water || rowSoa.tenant_electricity || rowSoa.tenant_penalty);
                    
                    return (
                      <div 
                        key={unit.id} 
                        onClick={() => {
                          setSelectedUnit(unit);
                          setIsMobileListVisible(false);
                        }}
                        className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 group border ${isSelected ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 shadow-[var(--shadow-sm)]' : 'bg-white border-transparent hover:border-[var(--color-border)] hover:shadow-sm'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-[13px] sm:text-[14px] truncate tracking-tight ${isSelected ? 'font-black text-[var(--color-text)]' : 'font-black text-[var(--color-text)]'}`}>
                            {unit.property_name} {unit.unit_number}
                          </h4>
                          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-1">
                            <span className="font-bold text-slate-400">O:</span> {isRowOwnerVacant ? 'Vacant' : unit.owner_name} 
                            {!isRowTenantVacant && <span className="ml-1.5"><span className="font-bold text-slate-400">T:</span> {unit.tenant_name}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                          {isRowOwnerVacant && isRowTenantVacant ? (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-slate-200">
                              VACANT
                            </span>
                          ) : (
                            <>
                              {!isRowOwnerVacant && hasRowOwnerAssign && (
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-sm)] border shadow-sm shrink-0 ${rOwnerStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rOwnerStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  O: {rOwnerStat}
                                </span>
                              )}
                              {!isRowTenantVacant && hasRowTenantAssign && (
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-[var(--radius-sm)] border shadow-sm shrink-0 ${rTenantStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rTenantStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  T: {rTenantStat}
                                </span>
                              )}
                              {(!isRowOwnerVacant || !isRowTenantVacant) && !hasRowOwnerAssign && !hasRowTenantAssign && (
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-slate-100">
                                  Unassigned
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* MAIN DETAILS */}
           <div className={`flex-1 flex-col overflow-hidden bg-[var(--color-bg)] relative ${!isMobileListVisible ? 'flex' : 'hidden md:flex'}`}>
              {!selectedUnit ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-[var(--color-border)] shadow-[var(--shadow-sm)]">
                    <Search size={28} className="text-slate-300 sm:w-8 sm:h-8" />
                  </div>
                  <p className="text-[var(--color-secondary)] font-black text-lg sm:text-xl tracking-tight">No unit selected</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Choose a unit from the sidebar to view billing details.</p>
                </div>
              ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                
                <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] overflow-hidden mb-4 sm:mb-6">
                  
                  {/* HEADER WITH NEW BUTTON LOCATION */}
                  <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-5 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <button 
                        onClick={() => setIsMobileListVisible(true)}
                        className="md:hidden p-1.5 text-slate-400 hover:opacity-75 rounded-[var(--radius-sm)] transition-colors active:scale-95 shrink-0"
                      >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                      </button>
                      <h3 className="font-extrabold text-[var(--color-text)] text-base sm:text-xl tracking-tight leading-tight whitespace-normal break-words">
                        {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                      </h3>
                    </div>
                    
                    {/* TOP RIGHT ALIGNED ACTIONS (Vacant Badge + Unit Config) */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnerVacant && isTenantVacant && (
                        <span className="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] sm:text-[11px] border border-slate-200 uppercase tracking-wide shadow-sm shrink-0 hidden sm:inline-flex">
                          Vacant
                        </span>
                      )}
                      
                      <button 
                        onClick={openUnitConfigModal}
                        className="text-[var(--color-text)] bg-[var(--color-primary)] hover:opacity-90 px-2 sm:px-3 py-1.5 rounded-[var(--radius-md)] transition-colors active:scale-95 flex items-center gap-1.5 border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 shadow-sm"
                        title="Configure Unit Billing Rates"
                      >
                        <Settings size={14} strokeWidth={2.5} className="shrink-0" />
                        <span className="text-[11px] sm:text-[12px] font-bold tracking-wider hidden sm:inline">Unit Config</span>
                      </button>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${!isTenantVacant ? 'lg:grid-cols-2 lg:divide-x lg:divide-[var(--color-border)]' : ''}`}>
                    
                    <div className="p-4 sm:p-6 md:p-8 relative flex flex-col">
                       <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[var(--color-border)] flex justify-between items-start gap-3">
                           <div className="min-w-0">
                               <h4 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Owner</h4>
                               <p className="font-bold text-[var(--color-text)] text-[13px] sm:text-base truncate">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                           </div>
                           {!isOwnerVacant && hasOwnerAssign && renderStatusBadge(ownerStatus)}
                       </div>

                       <h5 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-3 sm:mb-4 truncate">
                          {isOwnerVacant && isTenantVacant ? 'Base Unit Charges' : 'Assigned to Owner'}
                       </h5>

                       <div className="space-y-3 sm:space-y-3.5 flex-1">
                          {isAssigned && hasOwnerAssign ? (
                            <>
                              {activeConfig.owner.dues && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Assoc. dues</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.parking && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Parking</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.water && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Water</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.electricity && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Electricity</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {ownerPenalty > 0 && !isOwnerVacant && (
                                <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-500 font-bold truncate">Late Penalty</span><span className="font-black text-red-600 shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {ownerTotalDue === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic">No assigned balances.</p>}
                            </>
                          ) : (
                            <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">No assigned balances.</p>
                          )}
                       </div>
                       
                       <div className="mt-5 sm:mt-6 pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-slate-50/80 -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 lg:rounded-bl-[2rem]">
                           <span className="text-[10px] sm:text-[11px] font-black text-[var(--color-text)] uppercase tracking-widest shrink-0">Subtotal:</span>
                           <span className="font-black text-[var(--color-text)] text-sm sm:text-lg shrink-0">
                             {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                           </span>
                       </div>
                    </div>

                    {!isTenantVacant && (
                       <div className="p-4 sm:p-6 md:p-8 relative flex flex-col border-t lg:border-t-0 border-[var(--color-border)] lg:rounded-br-[2rem]">
                           <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[var(--color-primary)]/20 flex justify-between items-start gap-3">
                               <div className="min-w-0">
                                   <h4 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-0.5 sm:mb-1">Tenant</h4>
                                   <p className="font-bold text-[var(--color-text)] text-[13px] sm:text-base truncate">{selectedUnit?.tenant_name}</p>
                               </div>
                               {hasTenantAssign && renderStatusBadge(tenantStatus)}
                           </div>

                           <h5 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-3 sm:mb-4 truncate">
                              Assigned to Tenant
                           </h5>

                           <div className="space-y-3 sm:space-y-3.5 flex-1">
                              {isAssigned && hasTenantAssign ? (
                                <>
                                  {activeConfig.tenant.dues && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Assoc. dues</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.parking && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Parking</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.water && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Water</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.electricity && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-[var(--color-text)] font-medium truncate">Electricity</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {tenantPenalty > 0 && (
                                    <div className="flex justify-between items-center gap-3 text-[12px] sm:text-sm"><span className="text-red-400 font-bold truncate">Late Penalty</span><span className="font-black text-red-500 shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {tenantTotalDue === 0 && <p className="text-[12px] sm:text-[13px] text-slate-400 italic">No assigned balances.</p>}
                                </>
                              ) : (
                                <p className="text-[12px] sm:text-[13px] text-slate-400 italic font-medium">No assigned balances.</p>
                              )}
                           </div>

                           <div className="mt-5 sm:mt-6 pt-4 border-t border-[var(--color-primary)]/20 flex justify-between items-center -mx-4 sm:-mx-6 md:-mx-8 -mb-4 sm:-mb-6 md:-mb-8 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 lg:rounded-br-[2rem]">
                               <span className="text-[10px] sm:text-[11px] font-black text-[var(--color-text)] uppercase tracking-widest shrink-0">Tenant Total:</span>
                               <span className="font-black text-[var(--color-text)] text-sm sm:text-lg shrink-0">
                                 {isAssigned ? `₱${tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                               </span>
                           </div>
                       </div>
                    )}
                  </div>
                </div>

                {/* Total Hero Card */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 sm:mb-8 bg-[var(--color-secondary)] p-4 sm:p-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] w-full overflow-hidden">
                  <div className="min-w-0">
                    <span className="font-black text-white/90 text-[11px] sm:text-xs uppercase tracking-widest truncate block">Total Amount Due</span>
                    {!isTenantVacant && <div className="text-[9px] sm:text-[10px] font-medium text-white/90 mt-1 truncate block">Combined Property Balance</div>}
                  </div>
                  <span className="font-black text-white text-2xl sm:text-3xl md:text-4xl tracking-tight break-all sm:break-normal shrink-0">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                {/* Action Buttons Row */}
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2.5 w-full mb-6 flex-wrap">
                  
                  {isAssigned && ((ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant) || (tenantTotalDue > 0 && tenantStatus !== 'Paid' && !isTenantVacant)) && (
                    <button 
                      onClick={() => setIsPaymentSelectionModalOpen(true)}
                      className="w-full justify-center sm:w-auto bg-[var(--color-primary)] text-[var(--color-primary-text)] px-2 sm:px-5 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-[11px] sm:text-sm font-bold shadow-[var(--shadow-md)] hover:opacity-90 transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2 border border-transparent"
                    >
                      <CreditCard className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Payment Verification</span>
                    </button>
                  )}

                  {(ownerPenalty > 0 || tenantPenalty > 0) && (
                    <button 
                      onClick={() => setIsPenaltyModalOpen(true)}
                      className="w-full justify-center sm:w-auto bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 px-2 sm:px-5 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-[11px] sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                    >
                      <AlertCircle className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="truncate">Penalties</span>
                    </button>
                  )}

                  <button 
                    onClick={openSOAModal}
                    className="w-full justify-center sm:w-auto bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/90 text-[var(--color-text)] px-2 sm:px-5 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-[11px] sm:text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
                  >
                    <Send className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-text)]" /> <span className="truncate">Assign SOA</span>
                  </button>
                </div>

                {/* COMBINED LEDGER TABLE */}
                <div className="bg-white rounded-[var(--radius-xl)] shadow-[var(--shadow-sm)] border border-[var(--color-border)] p-4 sm:p-5 md:p-8 overflow-hidden mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 sm:mb-6 gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-[var(--shadow-sm)] shrink-0">
                        <CalendarClock size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[var(--color-text)] text-base sm:text-lg tracking-tight truncate">Ledger & Projections</h4>
                        <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                          Due: Day {colDay} <span className="mx-1.5 text-slate-300">|</span> Penalty: Day {colDay + grace}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportCSV}
                      className="w-full sm:w-auto justify-center flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--color-text)] bg-[var(--color-primary)] hover:opacity-90 px-4 sm:px-5 py-2.5 rounded-[var(--radius-md)] transition-all active:scale-95 border border-[var(--color-primary)]/20 shadow-sm shrink-0"
                    >
                      <Download size={16} className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-[var(--color-border)] rounded-[var(--radius-xl)] relative shadow-inner">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-[var(--color-primary)] text-[var(--color-text)] font-extrabold border-b border-[var(--color-border)] sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">PERIOD</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">DUE DATE</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">DUES</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">PARKING</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">UTILITIES</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap bg-red-600 text-white border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                            PENALTY
                          </th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">STATUS {isTenantVacant ? '' : '(O/T)'}</th>
                          <th className="px-4 sm:px-5 py-3 sm:py-3.5 text-center whitespace-nowrap font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-wider">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text)] bg-white">
                        {ledgerData.map((row, idx) => {
                          const activeRow = row.isCurrentMonth;
                          const hasPenalty = row.isCurrentMonth && (ownerPenalty > 0 || tenantPenalty > 0);
                          
                          return (
                            <tr key={idx} className={`transition-colors ${activeRow ? "bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10" : "hover:bg-slate-50"}`}>
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-black uppercase text-[10px] sm:text-[11px] tracking-wide ${activeRow ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]'}`}>
                                {row.monthName} {row.year} {activeRow && <span className="ml-1.5 text-[9px] font-black text-emerald-600 tracking-widest opacity-80">(NOW)</span>}
                              </td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 text-slate-500 font-medium text-xs sm:text-sm">{row.dueDate}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-medium text-xs sm:text-sm">{rawDues > 0 ? `₱${rawDues.toLocaleString()}` : "—"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-medium text-xs sm:text-sm">{rawParking > 0 ? `₱${rawParking.toLocaleString()}` : "—"}</td>
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-medium text-xs sm:text-sm">{(!isTenantVacant && (rawWater + rawElectricity) > 0) ? `₱${(rawWater + rawElectricity).toLocaleString()}` : "—"}</td>
                              
                              <td className={`px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-bold text-xs sm:text-sm ${hasPenalty ? 'text-red-500 bg-red-50/50' : 'text-slate-400'}`}>
                                {hasPenalty ? (
                                  <div className="flex flex-col gap-0.5 text-[10px] sm:text-[11px]">
                                    {ownerPenalty > 0 && <span>O: ₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>}
                                    {tenantPenalty > 0 && <span>T: ₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>}
                                  </div>
                                ) : "—"}
                              </td>
                              
                              <td className="px-4 sm:px-5 py-3 sm:py-4 whitespace-nowrap border-r border-[var(--color-border)]/50 font-bold text-[10px] sm:text-[11px] tracking-wider uppercase">
                                {row.isCurrentMonth ? (
                                  isOwnerVacant && isTenantVacant ? (
                                      <span className="text-slate-400">VACANT</span>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      {!isOwnerVacant && hasOwnerAssign && <span>O: <span className={ownerStatus === 'Paid' ? 'text-emerald-600' : ownerStatus === 'Overdue' ? 'text-red-500' : 'text-amber-500'}>{ownerStatus}</span></span>}
                                      {!isTenantVacant && hasTenantAssign && <span>T: <span className={tenantStatus === 'Paid' ? 'text-emerald-600' : tenantStatus === 'Overdue' ? 'text-red-500' : 'text-amber-500'}>{tenantStatus}</span></span>}
                                      {(!isOwnerVacant || !isTenantVacant) && !hasOwnerAssign && !hasTenantAssign && <span className="text-slate-400">UNASSIGNED</span>}
                                    </div>
                                  )
                                ) : (
                                  <span className={row.status === 'Paid' ? 'text-emerald-600' : 'text-slate-400'}>{row.status}</span>
                                )}
                              </td>

                              <td className={`px-4 sm:px-5 py-3 sm:py-4 text-right whitespace-nowrap font-black text-[12px] sm:text-sm ${row.status === 'Paid' ? 'text-[var(--color-text)]' : 'text-slate-400'}`}>
                                ₱{(row.isCurrentMonth ? totalDue : (ownerBase + tenantBase)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 🌟 UNIT-SPECIFIC CONFIGURATION MODAL (Merged from Global) */}
      {isUnitConfigModalOpen && selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius--xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all flex flex-col max-h-[85vh] sm:max-h-[90vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-[var(--color-bg)] shrink-0 border-b border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-text)]/10 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-text)]/20 shrink-0 shadow-sm">
                  <Settings size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] tracking-tight truncate">Unit Billing Config</h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">{selectedUnit.property_name} · Unit {selectedUnit.unit_number}</p>
                </div>
              </div>
              <button onClick={() => setIsUnitConfigModalOpen(false)} className="relative z-10 w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-full text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors active:scale-95 shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1">
              <form onSubmit={handleSaveUnitConfig} className="space-y-4 sm:space-y-5">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 pb-5 border-b border-slate-100/80">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Collection Start Day</label>
                    <input type="number" min="1" max="31" placeholder="e.g. 1" value={unitCompCollectionDay} onChange={(e) => setUnitCompCollectionDay(e.target.value)} className="w-full px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 font-medium ml-1">Day of the month (1-31)</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Grace Period (Days)</label>
                    <input type="number" min="0" placeholder="e.g. 15" value={unitCompGracePeriod} onChange={(e) => setUnitCompGracePeriod(e.target.value)} className="w-full px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 font-medium ml-1">Days before penalty hits</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Assoc. Dues (sqm)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompDuesRate} onChange={(e) => setUnitCompDuesRate(e.target.value)} className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Parking</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompParking} onChange={(e) => setUnitCompParking(e.target.value)} className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Water</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompWater} onChange={(e) => setUnitCompWater(e.target.value)} className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Elec.</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[13px] sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompElec} onChange={(e) => setUnitCompElec(e.target.value)} className="w-full pl-8 pr-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[13px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)]" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-5">
                  <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-2 ml-1 truncate">Late Penalty Deduction</label>
                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                    <select value={unitCompPenaltyType} onChange={(e) => setUnitCompPenaltyType(e.target.value)} className="w-full sm:w-[110px] shrink-0 px-3 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-[12px] sm:text-[13px] font-bold text-slate-700 transition-all shadow-[var(--shadow-sm)] bg-white">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={unitCompPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={unitCompPenaltyValue} onChange={(e) => setUnitCompPenaltyValue(e.target.value)} className="w-full flex-1 px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-[13px] sm:text-sm font-bold text-slate-700 transition-all shadow-[var(--shadow-sm)]" />
                  </div>
                </div>

                {/* Bank Transfer Details Section */}
                <div className="border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl mt-5 sm:mt-6 shadow-sm">
                  <label className="block text-[13px] sm:text-sm font-black text-[var(--color-secondary)] mb-1 sm:mb-1.5 tracking-tight truncate">Bank Transfer Details</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-4 sm:mb-5 font-medium leading-relaxed">
                    Set up this unit's bank details here. These will be securely displayed to owners and tenants when they select "Bank Transfer" during payment.
                  </p>
                  
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 truncate">Bank Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. BDO Unibank" 
                        value={unitCompBankName} 
                        onChange={(e) => setUnitCompBankName(e.target.value)} 
                        className="w-full px-3 sm:px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[12px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)] bg-white" 
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 truncate">Account Name</label>
                        <input 
                          type="text" 
                          placeholder="e.g. HOA Admin / Owner Name" 
                          value={unitCompBankAccountName} 
                          onChange={(e) => setUnitCompBankAccountName(e.target.value)} 
                          className="w-full px-3 sm:px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[12px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)] bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1 truncate">Account Number</label>
                        <input 
                          type="text" 
                          placeholder="e.g. 0012-3456" 
                          value={unitCompBankAccountNumber} 
                          onChange={(e) => setUnitCompBankAccountNumber(e.target.value)} 
                          className="w-full px-3 sm:px-4 py-3 sm:py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-[12px] sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-[var(--shadow-sm)] bg-white" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Upload Section */}
                <div className="border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-4 sm:p-5 rounded-[1.25rem] sm:rounded-2xl mt-5 sm:mt-6 shadow-sm">
                  <label className="block text-[13px] sm:text-sm font-black text-[var(--color-secondary)] mb-1 sm:mb-1.5 tracking-tight truncate">Digital Wallet QR Code</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-4 font-medium leading-relaxed">
                    Upload your GCash, Maya, or QR Ph barcode. This will be displayed when they select "Digital Wallet" during payment.
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border border-[var(--color-border)] rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative p-2 shadow-inner">
                      {unitCompQrUrl ? (
                        <img src={unitCompQrUrl} alt="Uploaded QR" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center">No QR</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={qrInputRef} 
                        onChange={handleQrUpload} 
                        className="hidden" 
                      />
                      <button 
                        type="button" 
                        onClick={() => qrInputRef.current?.click()} 
                        disabled={isUploadingQr} 
                        className="w-full bg-white border border-[var(--color-primary)]/40 hover:border-[var(--color-primary)] text-[var(--color-text)] font-bold text-[11px] sm:text-xs py-2.5 sm:py-3 rounded-[var(--radius-sm)] transition-all shadow-sm flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-50"
                      >
                        {isUploadingQr ? (
                          <><Loader2 size={16} className="animate-spin text-[var(--color-text)]" /> Uploading...</>
                        ) : (
                          <><Upload size={16} className="text-[var(--color-text)]" /> {unitCompQrUrl ? 'Replace QR Image' : 'Upload QR Image'}</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-4 border-t border-[var(--color-border)] sticky bottom-0 bg-[var(--color-bg)]/90 backdrop-blur-md pb-2 sm:pb-0 z-20">
                  <button 
                    type="button" 
                    onClick={() => setIsUnitConfigModalOpen(false)} 
                    disabled={isSavingUnitConfig}
                    className="w-full sm:w-[130px] shrink-0 py-3.5 sm:py-4 text-[12px] sm:text-[13px] font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 hover:opacity-90 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-[var(--shadow-sm)]"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingUnitConfig}
                    className="w-full flex-1 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] border border-transparent py-3.5 sm:py-4 rounded-[var(--radius-md)] text-[12px] sm:text-[13px] font-black uppercase tracking-widest transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center gap-2 truncate px-2"
                  >
                    {isSavingUnitConfig ? <Loader2 size={16} className="animate-spin" /> : "Save Config for Unit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PENALTY MODAL (Manage Penalties) */}
      {isPenaltyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shrink-0">
                  <AlertCircle size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] tracking-tight">Manage Penalties</h2>
              </div>
              <button onClick={() => setIsPenaltyModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isWaiving}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4">
              <p className="text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed">
                You can waive the penalty for this billing period. The base balance will remain due until a payment is verified.
              </p>
              
              {ownerPenalty > 0 && (
                <div className="bg-red-50 border border-red-100 p-4 sm:p-5 rounded-xl flex flex-col gap-4 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800 text-[13px] sm:text-sm">Owner Penalty</span>
                    <span className="font-black text-red-600 text-lg sm:text-xl">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <button 
                    onClick={() => handleWaivePenalty('owner')}
                    disabled={isWaiving}
                    className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-lg text-xs transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isWaiving ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : (ownerStatus === 'Paid' ? "Waive Penalty" : "Waive Penalty & Verify Payment")}
                  </button>
                </div>
              )}

              {tenantPenalty > 0 && (
                <div className="bg-red-50 border border-red-100 p-4 sm:p-5 rounded-xl flex flex-col gap-4 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800 text-[13px] sm:text-sm">Tenant Penalty</span>
                    <span className="font-black text-red-600 text-lg sm:text-xl">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <button 
                    onClick={() => handleWaivePenalty('tenant')}
                    disabled={isWaiving}
                    className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-3 rounded-lg text-xs transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isWaiving ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : (tenantStatus === 'Paid' ? "Waive Penalty" : "Waive Penalty & Verify Payment")}
                  </button>
                </div>
              )}

              {!(ownerPenalty > 0) && !(tenantPenalty > 0) && (
                <div className="text-center py-6 text-[13px] sm:text-sm font-bold text-slate-400 bg-slate-50 rounded-[var(--radius-md)] border border-slate-100">
                  No active penalties to waive.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SOA MODAL */}
      {isSOAModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto custom-scrollbar transform transition-all border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)]/90 backdrop-blur-md">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-text)]/10 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-text)]/20 shrink-0">
                  <Send size={16} className="translate-x-[-1px] translate-y-[1px] sm:w-[18px] sm:h-[18px]" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight truncate">Assign Balances <span className="text-[var(--color-text)] font-black ml-1 hidden sm:inline">· Unit {selectedUnit?.unit_number}</span></h2>
              </div>
              <button onClick={() => setIsSOAModalOpen(false)} className="text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSendingSOA || isSavingDefault}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-8">
              <p className="text-[11px] sm:text-[13px] text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed bg-[var(--color-primary)]/5 p-3 sm:p-4 rounded-[var(--radius-lg)] border border-[var(--color-primary)]/10">
                {isTenantVacant ? "Assign balances to the owner for this unit. Settings will be saved automatically when setting defaults." : "Checking a box for one party will automatically lock it out for the other party. To swap assignments, uncheck the item first."}
              </p>
              
              <div className={`grid grid-cols-1 ${!isTenantVacant ? 'sm:grid-cols-2 sm:divide-x sm:divide-[var(--color-border)]' : ''} border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden mb-6 sm:mb-8 shadow-[var(--shadow-sm)]`}>
                
                {/* OWNER COLUMN */}
                <div className="p-4 sm:p-5 bg-white relative flex flex-col">
                  <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-200">
                    <h3 className="font-black text-[var(--color-text)] text-[11px] sm:text-xs uppercase tracking-widest truncate">Owner</h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-1 font-medium">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                  </div>
                  
                  <div className="space-y-3 sm:space-y-4 flex-1">
                    {rawDues > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.dues && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.dues && !isTenantVacant} checked={soaConfig.owner.dues} onChange={(e) => handleToggleSoa('owner', 'dues', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Assoc. Dues</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {rawParking > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.parking && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.parking && !isTenantVacant} checked={soaConfig.owner.parking} onChange={(e) => handleToggleSoa('owner', 'parking', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Parking</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawWater > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.water} checked={soaConfig.owner.water} onChange={(e) => handleToggleSoa('owner', 'water', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Water</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {!isTenantVacant && rawElectricity > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.electricity} checked={soaConfig.owner.electricity} onChange={(e) => handleToggleSoa('owner', 'electricity', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Electricity</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}

                    {/* ✨ NEW: DISPLAY LATE PENALTY IF ASSIGNED IN DB */}
                    {soaConfig.owner.penalty && !isOwnerVacant && (
                      <label className="flex items-center justify-between gap-2 cursor-not-allowed opacity-70">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled checked className="rounded text-red-500 bg-red-100 border-red-200 w-4 h-4 shrink-0" />
                          <span className="text-[12px] sm:text-[13px] font-bold text-red-600 truncate">Late Penalty</span>
                        </div>
                        <span className="font-black text-red-600 text-[12px] sm:text-[13px] shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}

                  </div>
                  
                  <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-[var(--color-bg)]/80 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 sm:py-4 sm:rounded-bl-2xl">
                    <span className="text-[9px] sm:text-[10px] font-black text-[var(--color-text)] uppercase tracking-widest shrink-0">Owner Total</span>
                    <span className="font-black text-[var(--color-text)] text-sm sm:text-base shrink-0">
                      ₱{((soaConfig.owner.dues ? rawDues : 0) + (soaConfig.owner.parking ? rawParking : 0) + (soaConfig.owner.water ? rawWater : 0) + (soaConfig.owner.electricity ? rawElectricity : 0) + (soaConfig.owner.penalty ? ownerPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                {/* TENANT COLUMN (Hidden if Vacant) */}
                {!isTenantVacant && (
                  <div className="p-4 sm:p-5 relative bg-white flex flex-col border-t sm:border-t-0 border-[var(--color-border)]">
                    <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-200">
                      <h3 className="font-black text-[var(--color-text)] text-[11px] sm:text-xs uppercase tracking-widest truncate">Tenant</h3>
                      <p className="text-[11px] sm:text-xs text-[var(--color-text)] truncate mt-1 font-medium">{selectedUnit?.tenant_name}</p>
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4 flex-1">
                      {rawDues > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.dues ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.dues} checked={soaConfig.tenant.dues} onChange={(e) => handleToggleSoa('tenant', 'dues', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Assoc. Dues</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {rawParking > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.parking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.parking} checked={soaConfig.tenant.parking} onChange={(e) => handleToggleSoa('tenant', 'parking', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Parking</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawWater > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.water} checked={soaConfig.tenant.water} onChange={(e) => handleToggleSoa('tenant', 'water', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Water</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawElectricity > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.electricity} checked={soaConfig.tenant.electricity} onChange={(e) => handleToggleSoa('tenant', 'electricity', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-[var(--color-border)] shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-700 group-hover:text-[var(--color-secondary)] transition-colors truncate">Electricity</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-[12px] sm:text-[13px] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}

                      {/* ✨ NEW: DISPLAY LATE PENALTY IF ASSIGNED IN DB */}
                      {soaConfig.tenant.penalty && (
                        <label className="flex items-center justify-between gap-2 cursor-not-allowed opacity-70">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled checked className="rounded text-red-500 bg-red-100 border-red-200 w-4 h-4 shrink-0" />
                            <span className="text-[12px] sm:text-[13px] font-bold text-red-600 truncate">Late Penalty</span>
                          </div>
                          <span className="font-black text-red-600 text-[12px] sm:text-[13px] shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}

                    </div>

                    <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-[var(--color-primary)]/20 flex justify-between items-center -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-3 sm:py-4 sm:rounded-br-2xl">
                      <span className="text-[9px] sm:text-[10px] font-black text-[var(--color-text)] uppercase tracking-widest shrink-0">Tenant Total</span>
                      <span className="font-black text-[var(--color-text)] text-sm sm:text-base shrink-0">
                        ₱{((soaConfig.tenant.dues ? rawDues : 0) + (soaConfig.tenant.parking ? rawParking : 0) + (!isTenantVacant && soaConfig.tenant.water ? rawWater : 0) + (!isTenantVacant && soaConfig.tenant.electricity ? rawElectricity : 0) + (soaConfig.tenant.penalty ? tenantPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-[var(--color-border)] mt-6">
                <button 
                  onClick={() => setIsSOAModalOpen(false)} 
                  disabled={isSendingSOA || isSavingDefault}
                  className="w-full sm:w-[120px] shrink-0 py-3 sm:py-3.5 text-[12px] sm:text-sm font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-[var(--radius-md)] transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <div className="flex gap-2.5 sm:gap-3 w-full">
                  <button 
                    onClick={() => handleSendSOA()}
                    disabled={isSendingSOA || isSavingDefault}
                    className="flex-1 min-w-0 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-[11px] sm:text-[13px] font-black shadow-[var(--shadow-md)] border border-transparent transition-all flex justify-center items-center gap-1.5 sm:gap-2 active:scale-95 truncate px-2"
                  >
                    {isSendingSOA ? "Processing..." : "Send Statement"}
                  </button>
                  <button 
                    onClick={() => {
                      setIsSOAModalOpen(false);
                      
                      // Pre-fill the overdue config based on whether they actually have a base bill assigned
                      const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity;
                      const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity;
                      
                      setOverdueConfig({
                        owner: !!ownerHasBill && !isOwnerVacant && !soaConfig.owner.penalty,
                        tenant: !!tenantHasBill && !isTenantVacant && !soaConfig.tenant.penalty
                      });

                      setIsOverdueModalOpen(true);
                    }}
                    disabled={isSendingSOA || isSavingDefault}
                    className="flex-1 min-w-0 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:shadow-none text-white py-3 sm:py-3.5 rounded-[var(--radius-md)] text-[11px] sm:text-[13px] font-black shadow-[var(--shadow-md)] border border-transparent transition-all flex justify-center items-center gap-1.5 sm:gap-2 active:scale-95 truncate px-2"
                  >
                    {isSendingSOA ? "Processing..." : "Mark Overdue"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✨ NEW: DEDICATED OVERDUE PENALTY ASSIGNMENT MODAL */}
      {isOverdueModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-md)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-red-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center border border-red-200 shrink-0 shadow-sm">
                  <AlertCircle size={16} strokeWidth={2.5} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-red-600 tracking-tight">Mark as Overdue</h2>
              </div>
              <button 
                onClick={() => {
                  setIsOverdueModalOpen(false);
                  setIsSOAModalOpen(true); // Return to previous modal
                }} 
                className="text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" 
                disabled={isSendingSOA}
              >
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-5">
              <p className="text-[12px] sm:text-[13px] text-slate-500 font-medium leading-relaxed">
                Select which parties should receive the late penalty charge for this billing cycle.
              </p>

              <div className="space-y-4">
                {/* Owner Penalty Assignment */}
                {(!isOwnerVacant && (soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity)) ? (
                  soaConfig.owner.penalty ? (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
                      Owner penalty already applied
                    </div>
                  ) : (
                    <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm cursor-pointer hover:border-red-300 transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={overdueConfig.owner} 
                        onChange={(e) => setOverdueConfig(prev => ({...prev, owner: e.target.checked}))}
                        className="mt-1 rounded text-red-500 focus:ring-red-500 w-4 h-4 border-slate-300 transition-all shrink-0" 
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-[13px] sm:text-sm font-bold text-slate-700 group-hover:text-red-600 transition-colors">Apply Late Penalty to Owner</span>
                        <span className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Penalty amount: ₱{hypotheticalOwnerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </label>
                  )
                ) : (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
                    Owner has no active bill
                  </div>
                )}

                {/* Tenant Penalty Assignment */}
                {(!isTenantVacant && (soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity)) ? (
                  soaConfig.tenant.penalty ? (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
                      Tenant penalty already applied
                    </div>
                  ) : (
                    <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-sm cursor-pointer hover:border-red-300 transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={overdueConfig.tenant} 
                        onChange={(e) => setOverdueConfig(prev => ({...prev, tenant: e.target.checked}))}
                        className="mt-1 rounded text-red-500 focus:ring-red-500 w-4 h-4 border-slate-300 transition-all shrink-0" 
                      />
                      <div className="flex flex-col flex-1">
                        <span className="text-[13px] sm:text-sm font-bold text-slate-700 group-hover:text-red-600 transition-colors">Apply Late Penalty to Tenant</span>
                        <span className="text-[11px] sm:text-xs text-slate-500 mt-0.5">Penalty amount: ₱{hypotheticalTenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </label>
                  )
                ) : (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
                    Tenant has no active bill
                  </div>
                )}
              </div>

              <div className="flex gap-2.5 sm:gap-3 pt-4 border-t border-[var(--color-border)]">
                <button 
                  onClick={() => {
                    setIsOverdueModalOpen(false);
                    setIsSOAModalOpen(true);
                  }}
                  disabled={isSendingSOA}
                  className="flex-1 py-3.5 text-[12px] sm:text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-[var(--radius-md)] border border-slate-200 transition-colors active:scale-95 shadow-sm"
                >
                  Back
                </button>
                <button 
                  onClick={handleConfirmOverdue}
                  disabled={isSendingSOA || (!overdueConfig.owner && !overdueConfig.tenant)}
                  className="flex-[2] bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3.5 rounded-[var(--radius-md)] text-[12px] sm:text-[13px] font-bold shadow-md border border-transparent transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  {isSendingSOA ? <Loader2 size={16} className="animate-spin" /> : "Confirm Overdue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SELECTION MODAL */}
      {isPaymentSelectionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-md)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight truncate pr-2">Payment Verification</h2>
              <button onClick={() => setIsPaymentSelectionModalOpen(false)} className="text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-full transition-colors p-2 active:scale-95 shrink-0">
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4">
              <p className="text-[12px] sm:text-[13px] text-slate-500 mb-4 font-medium leading-relaxed">
                Select which payment you want to verify:
              </p>
              
              {isAssigned && ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant && (
                <button 
                  onClick={() => {
                    setIsPaymentSelectionModalOpen(false);
                    setPaymentModalParty('owner');
                    setIsPaymentModalOpen(true);
                  }}
                  className="w-full bg-white border border-[var(--color-border)] hover:border-emerald-300 hover:bg-emerald-50 text-[var(--color-text)] p-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] flex justify-between items-center group active:scale-95"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-[13px] sm:text-sm group-hover:text-emerald-700">Owner Payment</span>
                    <span className="text-[11px] sm:text-xs text-slate-500">Amount Due: ₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <ChevronLeft className="rotate-180 text-slate-400 group-hover:text-emerald-500" size={20} />
                </button>
              )}

              {isAssigned && !isTenantVacant && tenantTotalDue > 0 && tenantStatus !== 'Paid' && (
                <button 
                  onClick={() => {
                    setIsPaymentSelectionModalOpen(false);
                    setPaymentModalParty('tenant');
                    setIsPaymentModalOpen(true);
                  }}
                  className="w-full bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary)]/5 text-[var(--color-text)] p-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] flex justify-between items-center group active:scale-95"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-[13px] sm:text-sm group-hover:text-[var(--color-primary)]">Tenant Payment</span>
                    <span className="text-[11px] sm:text-xs text-slate-500">Amount Due: ₱{tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <ChevronLeft className="rotate-180 text-slate-400 group-hover:text-[var(--color-primary)]" size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (Admin Verifying) */}
      {isPaymentModalOpen && paymentModalParty && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--color-bg)] rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] capitalize tracking-tight truncate pr-2">{paymentModalParty} Payment Verification</h2>
              <button onClick={() => !isSimulating && setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSimulating || isFetchingPayment}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8">
              <p className="text-[12px] sm:text-[13px] text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed">
                Please verify the payment details submitted by the <span className="font-black text-[var(--color-primary)] uppercase tracking-wide">{paymentModalParty}</span> for {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}.
              </p>

              <div className="bg-white rounded-[1.25rem] sm:rounded-2xl p-4 sm:p-5 border border-[var(--color-border)] mb-6 sm:mb-8 shadow-[var(--shadow-sm)]">
                <div className="flex justify-between items-center mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-[var(--color-border)] gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Amount Due</span>
                  <span className="font-black text-[var(--color-secondary)] text-lg sm:text-xl tracking-tight shrink-0">
                    ₱{(paymentModalParty === 'owner' ? ownerTotalDue : tenantTotalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
                
                {isFetchingPayment ? (
                  <div className="py-3 sm:py-4 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Fetching submitted details...
                  </div>
                ) : fetchedPayment ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Method Used</span>
                      <span className="text-[10px] sm:text-[11px] font-black text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                        {fetchedPayment?.payment_method || 'Unknown'}
                      </span>
                    </div>
                    
                    {fetchedPayment?.payment_method !== 'Cash' && (
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Reference No.</span>
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-700 font-mono bg-slate-50 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] border border-slate-200 shadow-[var(--shadow-sm)] shrink-0 truncate max-w-[150px] sm:max-w-[200px]">
                          {fetchedPayment?.reference_number || 'N/A'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-3 sm:py-4 text-center text-[12px] sm:text-[13px] font-bold text-slate-400">
                    No payment details submitted yet.
                  </div>
                )}
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isSimulating || isFetchingPayment || !fetchedPayment}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] border border-transparent font-bold py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] flex justify-center items-center gap-2 active:scale-95 text-[13px] sm:text-sm"
              >
                {isSimulating ? "Processing..." : <><CheckCircle size={18} className="w-4 h-4 sm:w-5 sm:h-5" /> Mark as Paid</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 PREMIUM SUCCESS MODAL FOR WAIVING PENALTY */}
      {waiveSuccess && (
        <div className="fixed inset-0 bg-[var(--color-secondary)]/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">Penalty Waived</h2>
            <p className="text-slate-500 text-[13px] sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              The late penalty for the <strong className="text-[var(--color-text)] capitalize">{waiveSuccess.party}</strong> has been successfully removed. You may now proceed to verify the base payment.
            </p>
            <button 
              onClick={() => {
                const party = waiveSuccess.party;
                setWaiveSuccess(null);
                setPaymentModalParty(party);
                setIsPaymentModalOpen(true);
              }}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-[11px] sm:text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Continue to Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}