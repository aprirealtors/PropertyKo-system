"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { Search, X, Calculator, CalendarClock, Download, Send, CreditCard, CheckCircle, Clock, ChevronLeft, Upload, Loader2, AlertCircle, Settings, Printer, Globe, Users } from "lucide-react";

export default function BillingTab({ orgData, isLoading: isOrgLoading, actionIntent }: any) {
  // App Mount State for Portal
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

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
  const [isUnitSuccessModalOpen, setIsUnitSuccessModalOpen] = useState(false); 
  const [isGlobalConfigModalOpen, setIsGlobalConfigModalOpen] = useState(false); 
  const [isGlobalSuccessModalOpen, setIsGlobalSuccessModalOpen] = useState(false);
  const [isSOAModalOpen, setIsSOAModalOpen] = useState(false);
  const [isSendAllModalOpen, setIsSendAllModalOpen] = useState(false);
  const [isSendAllSuccessModalOpen, setIsSendAllSuccessModalOpen] = useState(false);
  const [sendAllNotifCount, setSendAllNotifCount] = useState(0);

  // ✨ Payment Method Config States
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isPaymentMethodSuccessModalOpen, setIsPaymentMethodSuccessModalOpen] = useState(false);
  const [isPaymentMethodConfirmModalOpen, setIsPaymentMethodConfirmModalOpen] = useState(false);
  const [isSavingPaymentMethods, setIsSavingPaymentMethods] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(
    orgData?.available_payment_methods || ['Digital Wallet', 'Bank Transfer', 'Check', 'Cash']
  );
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [waiveSuccess, setWaiveSuccess] = useState<{party: 'owner' | 'tenant'} | null>(null);
  const [pendingWaive, setPendingWaive] = useState<'owner' | 'tenant' | null>(null);
  
  // Global Config Memory State
  const [lastGlobalConfig, setLastGlobalConfig] = useState<any>(null); 

  // Print SOA States
  const currentYearNum = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth();
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printMonth, setPrintMonth] = useState<number | 'all'>(currentMonthNum);
  const [printYear, setPrintYear] = useState<number>(Math.max(2026, currentYearNum));
  const [printLayout, setPrintLayout] = useState<'full' | 'half'>('full');

  // Year logic
  const availableYears = Array.from({length: Math.max(1, currentYearNum - 2026 + 1)}, (_, i) => 2026 + i);

  // Overdue Confirmation Modal States
  const [isOverdueModalOpen, setIsOverdueModalOpen] = useState(false);
  const [overdueConfig, setOverdueConfig] = useState({ owner: false, tenant: false });

  const [isSimulating, setIsSimulating] = useState(false);
  const [isSendingSOA, setIsSendingSOA] = useState(false);
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isMarkingOverdue, setIsMarkingOverdue] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false); 
  const [isWaiving, setIsWaiving] = useState(false);
  const [waivingParty, setWaivingParty] = useState<'owner' | 'tenant' | null>(null);
  const [isSavingUnitConfig, setIsSavingUnitConfig] = useState(false);
  const [isSavingGlobalConfig, setIsSavingGlobalConfig] = useState(false);
  const [unitConfigError, setUnitConfigError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Payment Fetch States
  const [fetchedPayment, setFetchedPayment] = useState<any>(null);
  const [isFetchingPayment, setIsFetchingPayment] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState("");

  // NOTIFICATION CLEANUP STATE
  const [sourceNotificationId, setSourceNotificationId] = useState<string | null>(null);

  // SOA Assignment States
  const [soaConfig, setSoaConfig] = useState({
    owner: { dues: false, parking: false, water: false, electricity: false, penalty: false },
    tenant: { dues: false, parking: false, water: false, electricity: false, penalty: false }
  });

  // Unit/Global Config Form Shared States
  const [unitCompDuesRate, setUnitCompDuesRate] = useState("");
  const [unitCompWater, setUnitCompWater] = useState("");
  
  // Water Billing Mode States
  const [unitCompWaterMode, setUnitCompWaterMode] = useState<'fixed' | 'consumption'>('fixed');
  const [unitCompWaterPrev, setUnitCompWaterPrev] = useState("");
  const [unitCompWaterCurr, setUnitCompWaterCurr] = useState("");
  const [unitCompWaterRate, setUnitCompWaterRate] = useState("");

  const [unitCompElec, setUnitCompElec] = useState("");
  const [unitCompParking, setUnitCompParking] = useState("");
  const [unitCompParkingArea, setUnitCompParkingArea] = useState("");
  const [unitCompPenaltyType, setUnitCompPenaltyType] = useState("percent");
  const [unitCompPenaltyValue, setUnitCompPenaltyValue] = useState("");
  const [unitCompCollectionDay, setUnitCompCollectionDay] = useState(""); 
  const [unitCompGracePeriod, setUnitCompGracePeriod] = useState(""); 
  const [unitCompBankName, setUnitCompBankName] = useState("");
  const [unitCompBankAccountName, setUnitCompBankAccountName] = useState("");
  const [unitCompBankAccountNumber, setUnitCompBankAccountNumber] = useState("");
  const [unitCompQrUrl, setUnitCompQrUrl] = useState("");
  
  // SOA Contact/Address Info States
  const [unitCompAddress, setUnitCompAddress] = useState("");
  const [unitCompEmail, setUnitCompEmail] = useState("");
  const [unitCompShortName, setUnitCompShortName] = useState("");
  const [unitCompContactNumber, setUnitCompContactNumber] = useState("");
  const [unitCompCustomReminder, setUnitCompCustomReminder] = useState("");
  
  // QR Code Upload States
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const monthsList = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  const availableMonths = monthsList.map((m, i) => ({ name: m, index: i })).filter(m => {
    if (printYear === currentYearNum && m.index > currentMonthNum) return false;
    return true;
  });

  // Date formatted as MM/DD/YYYY
  const currentDateStr = `${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(new Date().getDate()).padStart(2, '0')}/${new Date().getFullYear()}`;

  // RESTORE GLOBAL CONFIG FROM LOCAL STORAGE ON MOUNT
  useEffect(() => {
    if (orgData?.admin_email) {
      const savedGlobalConfig = localStorage.getItem(`globalConfig_${orgData.admin_email}`);
      if (savedGlobalConfig) {
        try {
          setLastGlobalConfig(JSON.parse(savedGlobalConfig));
        } catch (e) {
          console.error("Error parsing saved global config", e);
        }
      }
      fetchAllUnits();
    }
  }, [orgData?.admin_email]);

  const processedIntentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!actionIntent || allUnits.length === 0) return;
    
    if (processedIntentRef.current === actionIntent) return;

    if (actionIntent.startsWith("verify_payment_")) {
      const parts = actionIntent.split('_'); 
      const party = parts[2] as 'owner' | 'tenant';
      const unitId = parts[3];
      const notifId = parts[4] || null; 

      const targetUnit = allUnits.find(u => String(u.id) === String(unitId));
      
      if (targetUnit) {
        processedIntentRef.current = actionIntent; 
        
        setSelectedUnit(targetUnit);
        setIsMobileListVisible(false);
        if (notifId) setSourceNotificationId(notifId); 
        
        setTimeout(() => {
          setPaymentModalParty(party);
          setIsPaymentModalOpen(true);
        }, 500);
      }
    } 
    else if (actionIntent.startsWith("select_unit_")) {
      const parts = actionIntent.split('_'); 
      const unitId = parts[2];

      const targetUnit = allUnits.find(u => String(u.id) === String(unitId));
      if (targetUnit) {
        processedIntentRef.current = actionIntent;
        setSelectedUnit(targetUnit);
        setIsMobileListVisible(false);
      }
    }
  }, [actionIntent, allUnits]);

  useEffect(() => {
    if (printYear === currentYearNum && printMonth !== 'all' && printMonth > currentMonthNum) {
      setPrintMonth(currentMonthNum);
    }
  }, [printYear, currentMonthNum, currentYearNum, printMonth]);

  useEffect(() => {
    if (isPaymentModalOpen && paymentModalParty && selectedUnit) {
      const fetchPayment = async () => {
        setIsFetchingPayment(true);
        const { data, error } = await supabase
          .from('soa')
          .select('owner_payment_method, owner_reference_number, owner_status, tenant_payment_method, tenant_reference_number, tenant_status')
          .eq('unit_id', selectedUnit.id)
          .single();
        
        if (data && !error) {
          const method = paymentModalParty === 'owner' ? data.owner_payment_method : data.tenant_payment_method;
          const ref = paymentModalParty === 'owner' ? data.owner_reference_number : data.tenant_reference_number;
          const status = paymentModalParty === 'owner' ? data.owner_status : data.tenant_status;
          
          if (method) {
            setFetchedPayment({
              payment_method: method,
              reference_number: ref,
              status: status, 
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
      
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && !actionIntent) {
        setSelectedUnit(sortedData[0]); 
      } else if (!actionIntent) {
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

  const isSoaAlreadySent = isAssigned && (
    (!isOwnerVacant && !!hasOwnerAssign && ownerStatus !== 'Paid') ||
    (!isTenantVacant && !!hasTenantAssign && tenantStatus !== 'Paid')
  );

  const isOwnerOverdueEligible = !isOwnerVacant && !!(soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity);
  const isTenantOverdueEligible = !isTenantVacant && !!(soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity);
  const isOverdueIssued =
    (isOwnerOverdueEligible || isTenantOverdueEligible) &&
    (!isOwnerOverdueEligible || !!soaConfig.owner.penalty) &&
    (!isTenantOverdueEligible || !!soaConfig.tenant.penalty);
  
  const activeDuesRate = selectedUnit?.dues_rate || 0;
  
  const activeWaterMode = selectedUnit?.water_billing_mode || 'fixed';
  const activeWaterPrev = Number(selectedUnit?.water_previous_reading) || 0;
  const activeWaterCurr = Number(selectedUnit?.water_current_reading) || 0;
  const activeWaterRate = Number(selectedUnit?.water_rate) || 0;
  
  const waterConsumption = Math.max(0, activeWaterCurr - activeWaterPrev);
  const rawWater = activeWaterMode === 'fixed' 
    ? Number(selectedUnit?.water || 0) 
    : (waterConsumption * activeWaterRate);

  const activeElectricity = selectedUnit?.electricity || 0;
  const activeParkingRate = selectedUnit?.parking || 0;
  const activeParkingArea = selectedUnit?.parking_area || 0;
  
  const colDay = selectedUnit?.collection_day || 1;
  const grace = selectedUnit?.grace_period_days || 15;
  const pType = selectedUnit?.penalty_type || 'percent';
  const pVal = selectedUnit?.penalty_value || 0;

  const rawDues = activeDuesRate * unitArea;
  const rawElectricity = activeElectricity;
  const rawParking = activeParkingRate * activeParkingArea;

  const isUnitConfigMissing = !(rawDues > 0 || rawParking > 0 || rawWater > 0 || rawElectricity > 0);

  const activeConfig = currentSoa ? {
  owner: { dues: currentSoa.owner_dues, parking: currentSoa.owner_parking, water: currentSoa.owner_water, electricity: currentSoa.owner_electricity, penalty: currentSoa.owner_penalty },
  tenant: { dues: currentSoa.tenant_dues, parking: currentSoa.tenant_parking, water: currentSoa.tenant_water, electricity: currentSoa.tenant_electricity, penalty: currentSoa.tenant_penalty }
} : {
  owner: { dues: true, parking: true, water: true, electricity: true, penalty: false },
  tenant: { dues: false, parking: false, water: !isTenantVacant, electricity: !isTenantVacant, penalty: !isTenantVacant && tenantStatus === 'Overdue' }
};

  const ownerBase = 
    (activeConfig.owner.dues ? rawDues : 0) + 
    (activeConfig.owner.parking ? rawParking : 0) + 
    (activeConfig.owner.water ? rawWater : 0) + 
    (activeConfig.owner.electricity ? rawElectricity : 0);

  const tenantBase = 
    (activeConfig.tenant.dues ? rawDues : 0) + 
    (!isTenantVacant && activeConfig.tenant.parking ? rawParking : 0) + 
    (!isTenantVacant && activeConfig.tenant.water ? rawWater : 0) + 
    (!isTenantVacant && activeConfig.tenant.electricity ? rawElectricity : 0);

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

  // Advance Payment Logic
  const ownerAdvance = currentSoa?.owner_advance || 0;
  const tenantAdvance = currentSoa?.tenant_advance || 0;

  const appliedOwnerAdvance = Math.min(ownerAdvance, ownerTotalDue);
  const appliedTenantAdvance = Math.min(tenantAdvance, tenantTotalDue);

  const ownerCollectible = ownerTotalDue - appliedOwnerAdvance;
  const tenantCollectible = tenantTotalDue - appliedTenantAdvance;
  const totalCollectible = ownerCollectible + tenantCollectible;

  // ---------------- PRINT / PDF COMPUTATION ----------------
  // Each printed line is built with the SAME rules as ownerBase / tenantBase,
  // so the rows on the PDF always add up to the total.
  const printDuesAmt =
    (activeConfig.owner.dues ? rawDues : 0) +
    (activeConfig.tenant.dues ? rawDues : 0);

  const printParkingAmt =
    (activeConfig.owner.parking ? rawParking : 0) +
    (!isTenantVacant && activeConfig.tenant.parking ? rawParking : 0);

  const printWaterAmt =
    (activeConfig.owner.water ? rawWater : 0) +
    (!isTenantVacant && activeConfig.tenant.water ? rawWater : 0);

  const printElectricityAmt =
    (activeConfig.owner.electricity ? rawElectricity : 0) +
    (!isTenantVacant && activeConfig.tenant.electricity ? rawElectricity : 0);

  const baseTotalForPrint = ownerBase + tenantBase;
  const penaltyTotalForPrint = ownerPenalty + tenantPenalty;
  // TOTAL COLLECTIBLE = full bill (charges + penalties). It does NOT change
  // when someone pays or when an advance gets consumed.
  const combinedTotalForPrint = baseTotalForPrint + penaltyTotalForPrint;

  const globalContact = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(`globalContact_${orgData?.admin_email}`) || "{}") : {};
  const unitContact = typeof window !== 'undefined' && selectedUnit ? JSON.parse(localStorage.getItem(`unitContact_${selectedUnit.id}`) || "{}") : {};

  const printAddress = unitContact.property_address || globalContact.property_address || "110 PANAY AVENUE. QUEZON CITY";
  const printEmail = unitContact.contact_email || globalContact.contact_email || "futurepointplazasuites@propertyko.com";
  const printShortName = unitContact.contact_short_name || globalContact.contact_short_name || "FPPS PM";
  const printContactNumber = unitContact.contact_number || globalContact.contact_number || "09569277024";
  const printCustomReminder = unitContact.custom_reminder !== undefined ? unitContact.custom_reminder : (globalContact.custom_reminder !== undefined ? globalContact.custom_reminder : "");

  const openGlobalConfigModal = () => {
    const sourceData = lastGlobalConfig || (allUnits.length > 0 ? allUnits[0] : null);

    if (sourceData) {
      setUnitCompDuesRate(sourceData.dues_rate != null ? String(sourceData.dues_rate) : "");
      
      setUnitCompWaterMode(sourceData.water_billing_mode || 'fixed');
      setUnitCompWater(sourceData.water != null ? String(sourceData.water) : "");
      setUnitCompWaterPrev(sourceData.water_previous_reading != null ? String(sourceData.water_previous_reading) : "");
      setUnitCompWaterCurr(sourceData.water_current_reading != null ? String(sourceData.water_current_reading) : "");
      setUnitCompWaterRate(sourceData.water_rate != null ? String(sourceData.water_rate) : "");
      
      setUnitCompElec(sourceData.electricity != null ? String(sourceData.electricity) : "");
      setUnitCompParking(sourceData.parking != null ? String(sourceData.parking) : "");
      setUnitCompParkingArea(sourceData.parking_area != null ? String(sourceData.parking_area) : "");
      setUnitCompPenaltyType(sourceData.penalty_type || "percent");
      setUnitCompPenaltyValue(sourceData.penalty_value != null ? String(sourceData.penalty_value) : "");
      setUnitCompCollectionDay(sourceData.collection_day != null ? String(sourceData.collection_day) : "");
      setUnitCompGracePeriod(sourceData.grace_period_days != null ? String(sourceData.grace_period_days) : "");
      setUnitCompBankName(sourceData.bank_name || "");
      setUnitCompBankAccountName(sourceData.bank_account_name || "");
      setUnitCompBankAccountNumber(sourceData.bank_account_number || "");
      setUnitCompQrUrl(sourceData.qr_code_url || "");
    } else {
      setUnitCompDuesRate("");
      setUnitCompWaterMode("fixed");
      setUnitCompWater("");
      setUnitCompWaterPrev("");
      setUnitCompWaterCurr("");
      setUnitCompWaterRate("");
      setUnitCompElec("");
      setUnitCompParking("");
      setUnitCompParkingArea("");
      setUnitCompPenaltyType("percent");
      setUnitCompPenaltyValue("");
      setUnitCompCollectionDay("");
      setUnitCompGracePeriod("");
      setUnitCompBankName("");
      setUnitCompBankAccountName("");
      setUnitCompBankAccountNumber("");
      setUnitCompQrUrl("");
    }
    
    setUnitCompAddress(globalContact.property_address || "110 PANAY AVENUE. QUEZON CITY");
    setUnitCompEmail(globalContact.contact_email || "futurepointplazasuites@propertyko.com");
    setUnitCompShortName(globalContact.contact_short_name || "FPPS PM");
    setUnitCompContactNumber(globalContact.contact_number || "09569277024");
    setUnitCompCustomReminder(globalContact.custom_reminder !== undefined ? globalContact.custom_reminder : "");

    setUnitConfigError(null);
    setFieldErrors({});
    setIsGlobalConfigModalOpen(true);
  };

  const openUnitConfigModal = () => {
    if (!selectedUnit) return;
    setUnitCompDuesRate(selectedUnit.dues_rate != null ? String(selectedUnit.dues_rate) : "");
    
    setUnitCompWaterMode(selectedUnit.water_billing_mode || 'fixed');
    setUnitCompWater(selectedUnit.water != null ? String(selectedUnit.water) : "");
    setUnitCompWaterPrev(selectedUnit.water_previous_reading != null ? String(selectedUnit.water_previous_reading) : "");
    setUnitCompWaterCurr(selectedUnit.water_current_reading != null ? String(selectedUnit.water_current_reading) : "");
    setUnitCompWaterRate(selectedUnit.water_rate != null ? String(selectedUnit.water_rate) : "");

    setUnitCompElec(selectedUnit.electricity != null ? String(selectedUnit.electricity) : "");
    setUnitCompParking(selectedUnit.parking != null ? String(selectedUnit.parking) : "");
    setUnitCompParkingArea(selectedUnit.parking_area != null ? String(selectedUnit.parking_area) : "");
    setUnitCompPenaltyType(selectedUnit.penalty_type || "percent");
    setUnitCompPenaltyValue(selectedUnit.penalty_value != null ? String(selectedUnit.penalty_value) : "");
    setUnitCompCollectionDay(selectedUnit.collection_day != null ? String(selectedUnit.collection_day) : "");
    setUnitCompGracePeriod(selectedUnit.grace_period_days != null ? String(selectedUnit.grace_period_days) : "");
    setUnitCompBankName(selectedUnit.bank_name || "");
    setUnitCompBankAccountName(selectedUnit.bank_account_name || "");
    setUnitCompBankAccountNumber(selectedUnit.bank_account_number || "");
    setUnitCompQrUrl(selectedUnit.qr_code_url || "");
    
    setUnitCompAddress(unitContact.property_address || globalContact.property_address || "110 PANAY AVENUE. QUEZON CITY");
    setUnitCompEmail(unitContact.contact_email || globalContact.contact_email || "futurepointplazasuites@propertyko.com");
    setUnitCompShortName(unitContact.contact_short_name || globalContact.contact_short_name || "FPPS PM");
    setUnitCompContactNumber(unitContact.contact_number || globalContact.contact_number || "09569277024");
    setUnitCompCustomReminder(unitContact.custom_reminder !== undefined ? unitContact.custom_reminder : (globalContact.custom_reminder !== undefined ? globalContact.custom_reminder : ""));
    
    setUnitConfigError(null);
    setFieldErrors({});
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

  const saveSoaToDatabase = async (statusOverride?: string, resetPenalties?: boolean) => {
    const existing = allSoaConfigs[selectedUnit.id];
    
    const payload: any = {
      unit_id: selectedUnit.id,
      owner_dues: soaConfig.owner.dues,
      owner_parking: soaConfig.owner.parking,
      owner_water: soaConfig.owner.water,
      owner_electricity: soaConfig.owner.electricity,
      owner_penalty: resetPenalties ? false : soaConfig.owner.penalty,
      tenant_dues: soaConfig.tenant.dues,
      tenant_parking: soaConfig.tenant.parking,
      tenant_water: soaConfig.tenant.water,
      tenant_electricity: soaConfig.tenant.electricity,
      tenant_penalty: resetPenalties ? false : soaConfig.tenant.penalty,
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

  const handleSendSOA = async () => {
    if (isSoaAlreadySent) return;
    setIsSendingSOA(true);
    try {
      const isNewCycle = isAssigned;
      await saveSoaToDatabase('Pending', isNewCycle);

      const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity || (!isNewCycle && soaConfig.owner.penalty);
      const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity || (!isNewCycle && soaConfig.tenant.penalty);

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

      const finalOwnerTotal = ownerBase + (isNewCycle ? 0 : ownerPenalty);
      const finalTenantTotal = tenantBase + (isNewCycle ? 0 : tenantPenalty);

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

  const handleSendAllSOA = async () => {
    setIsSendingAll(true);
    try {
      const { data: members } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('admin_email', orgData.admin_email);

      const notificationsToInsert: any[] = [];
      const soaUpdates: any[] = [];

      allUnits.forEach(unit => {
        const soa = allSoaConfigs[unit.id];
        if (!soa) return;

        const oHasBill = soa.owner_dues || soa.owner_parking || soa.owner_water || soa.owner_electricity || soa.owner_penalty;
        const tHasBill = soa.tenant_dues || soa.tenant_parking || soa.tenant_water || soa.tenant_electricity || soa.tenant_penalty;
        
        const isUnitOwnerVacant = !unit.owner_name || unit.owner_name === '—';
        const isUnitTenantVacant = unit.status === 'Vacant' || !unit.tenant_name || unit.tenant_name === '—';

        if (!oHasBill && !tHasBill) return;

        soaUpdates.push({
          ...soa, 
          owner_status: (!isUnitOwnerVacant && oHasBill) ? 'Pending' : soa.owner_status,
          tenant_status: (!isUnitTenantVacant && tHasBill) ? 'Pending' : soa.tenant_status
        });

        if (oHasBill && !isUnitOwnerVacant && members) {
          const match = members.find(m => m.name?.trim().toLowerCase() === unit.owner_name?.trim().toLowerCase());
          if (match) {
            notificationsToInsert.push({
              admin_email: orgData.admin_email, recipient: match.email, type: 'BILLING', title: 'New Statement of Account',
              message: `Your billing statement for ${unit.property_name} Unit ${unit.unit_number} is available.`,
              reference_id: unit.id, is_read: false
            });
          }
        }

        if (tHasBill && !isUnitTenantVacant && members) {
          const match = members.find(m => m.name?.trim().toLowerCase() === unit.tenant_name?.trim().toLowerCase());
          if (match) {
            notificationsToInsert.push({
              admin_email: orgData.admin_email, recipient: match.email, type: 'BILLING', title: 'New Statement of Account',
              message: `Your billing statement for ${unit.property_name} Unit ${unit.unit_number} is available.`,
              reference_id: unit.id, is_read: false
            });
          }
        }
      });

      if (soaUpdates.length > 0) {
        const { error } = await supabase.from('soa').upsert(soaUpdates, { onConflict: 'unit_id' });
        if (error) throw error;
        
        const newConfigs = { ...allSoaConfigs };
        soaUpdates.forEach(update => {
          if (newConfigs[update.unit_id]) {
            newConfigs[update.unit_id] = { ...newConfigs[update.unit_id], ...update };
          }
        });
        setAllSoaConfigs(newConfigs);
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }
      
      setIsSendAllModalOpen(false);
      setSendAllNotifCount(notificationsToInsert.length);
      setIsSendAllSuccessModalOpen(true);
      
    } catch (err) {
      console.error("Failed bulk send:", err);
      alert("Error sending bulk SOAs. Please try again.");
    } finally {
      setIsSendingAll(false);
    }
  };

  const handleConfirmOverdue = async () => {
    setIsMarkingOverdue(true);
    try {
      const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity;
      const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity;

      const existing = allSoaConfigs[selectedUnit.id];

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

      payload.owner_status = (effectiveOwnerPenalty && ownerHasBill && !isOwnerVacant) ? 'Overdue' : (existing?.owner_status || 'Pending');
      payload.tenant_status = (effectiveTenantPenalty && tenantHasBill && !isTenantVacant) ? 'Overdue' : (existing?.tenant_status || 'Pending');

      const { error } = await supabase.from('soa').upsert(payload, { onConflict: 'unit_id' });
      
      if (error) {
        console.error("Supabase Detailed Error:", JSON.stringify(error));
        throw error;
      }

      setAllSoaConfigs(prev => ({ ...prev, [selectedUnit.id]: { ...existing, ...payload } }));
      setSoaConfig(prev => ({
        owner: { ...prev.owner, penalty: effectiveOwnerPenalty },
        tenant: { ...prev.tenant, penalty: effectiveTenantPenalty }
      }));

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
      setIsMarkingOverdue(false);
    }
  };

  const handleWaivePenalty = async (party: 'owner' | 'tenant') => {
    const currentStatus = party === 'owner' ? ownerStatus : tenantStatus;

    if (currentStatus === 'Paid') {
      setIsWaiving(true);
      setWaivingParty(party);
      try {
        const updateField = { 
          [`${party}_penalty`]: false,
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
      } catch (err: any) {
        console.error("Error waiving penalty", err);
        alert(`Failed to waive penalty: ${err.message || 'Check your database permissions'}`);
      } finally {
        setIsWaiving(false);
        setWaivingParty(null);
      }
    } else {
      // ✨ GO STRAIGHT TO PAYMENT VERIFICATION
      setIsPenaltyModalOpen(false);
      setPendingWaive(party);
      setPaymentModalParty(party);
      setIsPaymentModalOpen(true);
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
      clearErr('qr');

    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Error uploading QR image: " + error.message);
    } finally {
      setIsUploadingQr(false);
      if (qrInputRef.current) qrInputRef.current.value = '';
    }
  };

  const clearErr = (key: string) =>
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));

  const validateConfigForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (String(unitCompCollectionDay).trim() === "") errors.collectionDay = "Please enter the collection start day.";
    if (String(unitCompGracePeriod).trim() === "") errors.gracePeriod = "Please enter the grace period.";
    if (String(unitCompDuesRate).trim() === "") errors.duesRate = "Please enter the association dues rate.";
    if (String(unitCompPenaltyValue).trim() === "") errors.penaltyValue = "Please enter the late penalty deduction.";
    if (unitCompBankName.trim() === "") errors.bankName = "Please enter the bank name.";
    if (unitCompBankAccountName.trim() === "") errors.bankAccountName = "Please enter the account name.";
    if (unitCompBankAccountNumber.trim() === "") errors.bankAccountNumber = "Please enter the account number.";
    if (!unitCompQrUrl) errors.qr = "Please upload the digital wallet QR.";

    setFieldErrors(errors);
    setUnitConfigError(null);

    if (Object.keys(errors).length > 0) {
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return false;
    }
    return true;
  };

  const toAmountOrZero = (value: string) => {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : Number(parsed.toFixed(2));
  };

  const handleTogglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods(prev => 
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const handleSavePaymentMethods = async () => {
    if (selectedPaymentMethods.length === 0) {
      alert("Please select at least one payment method.");
      return;
    }
    setIsSavingPaymentMethods(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ available_payment_methods: selectedPaymentMethods })
        .eq('admin_email', orgData.admin_email);
        
      if (error) throw error;
      
      setIsPaymentMethodModalOpen(false);
      setIsPaymentMethodSuccessModalOpen(true);
    } catch (err: any) {
      console.error("Error saving payment methods", err);
      alert("Failed to save payment methods: " + err.message);
    } finally {
      setIsSavingPaymentMethods(false);
    }
  };

  const handleSaveGlobalConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateConfigForm()) return;

    setIsSavingGlobalConfig(true);

    const dbPayload = {
      dues_rate: unitCompDuesRate !== "" ? Number(parseFloat(unitCompDuesRate).toFixed(2)) : null,
      water_billing_mode: unitCompWaterMode,
      water: toAmountOrZero(unitCompWater),
      water_previous_reading: toAmountOrZero(unitCompWaterPrev),
      water_current_reading: toAmountOrZero(unitCompWaterCurr),
      water_rate: toAmountOrZero(unitCompWaterRate),
      electricity: toAmountOrZero(unitCompElec),
      parking: toAmountOrZero(unitCompParking),
      parking_area: toAmountOrZero(unitCompParkingArea),
      penalty_type: unitCompPenaltyType,
      penalty_value: unitCompPenaltyValue !== "" ? Number(parseFloat(unitCompPenaltyValue).toFixed(2)) : null,
      collection_day: unitCompCollectionDay !== "" ? parseInt(unitCompCollectionDay) : null,
      grace_period_days: unitCompGracePeriod !== "" ? parseInt(unitCompGracePeriod) : null,
      bank_name: unitCompBankName,
      bank_account_name: unitCompBankAccountName,
      bank_account_number: unitCompBankAccountNumber,
      qr_code_url: unitCompQrUrl
    };

    const localContactPayload = {
      property_address: unitCompAddress,
      contact_email: unitCompEmail,
      contact_short_name: unitCompShortName,
      contact_number: unitCompContactNumber,
      custom_reminder: unitCompCustomReminder
    };

    try {
      const { error } = await supabase
        .from('units')
        .update(dbPayload)
        .eq('admin_email', orgData.admin_email);

      if (error) throw error;

      setAllUnits(prev => prev.map(u => ({ ...u, ...dbPayload })));
      if (selectedUnit) {
        setSelectedUnit((prev: any) => ({ ...prev, ...dbPayload }));
      }
      
      localStorage.setItem(`globalConfig_${orgData.admin_email}`, JSON.stringify(dbPayload));
      localStorage.setItem(`globalContact_${orgData.admin_email}`, JSON.stringify(localContactPayload));
      
      setLastGlobalConfig(dbPayload);
      
      setIsGlobalConfigModalOpen(false);
      setIsGlobalSuccessModalOpen(true); 
    } catch (err: any) {
      console.error("Failed to update global unit computation:", err);
      alert(err.message || "Failed to update global configuration");
    } finally {
      setIsSavingGlobalConfig(false);
    }
  };

  const handleSaveUnitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    if (!validateConfigForm()) return;

    setIsSavingUnitConfig(true);

    const dbPayload = {
      dues_rate: unitCompDuesRate !== "" ? Number(parseFloat(unitCompDuesRate).toFixed(2)) : null,
      water_billing_mode: unitCompWaterMode,
      water: toAmountOrZero(unitCompWater),
      water_previous_reading: toAmountOrZero(unitCompWaterPrev),
      water_current_reading: toAmountOrZero(unitCompWaterCurr),
      water_rate: toAmountOrZero(unitCompWaterRate),
      electricity: toAmountOrZero(unitCompElec),
      parking: toAmountOrZero(unitCompParking),
      parking_area: toAmountOrZero(unitCompParkingArea),
      penalty_type: unitCompPenaltyType,
      penalty_value: unitCompPenaltyValue !== "" ? Number(parseFloat(unitCompPenaltyValue).toFixed(2)) : null,
      collection_day: unitCompCollectionDay !== "" ? parseInt(unitCompCollectionDay) : null,
      grace_period_days: unitCompGracePeriod !== "" ? parseInt(unitCompGracePeriod) : null,
      bank_name: unitCompBankName,
      bank_account_name: unitCompBankAccountName,
      bank_account_number: unitCompBankAccountNumber,
      qr_code_url: unitCompQrUrl
    };
    
    const localContactPayload = {
      property_address: unitCompAddress,
      contact_email: unitCompEmail,
      contact_short_name: unitCompShortName,
      contact_number: unitCompContactNumber,
      custom_reminder: unitCompCustomReminder
    };

    try {
      const { error } = await supabase
        .from('units')
        .update(dbPayload)
        .eq('id', selectedUnit.id);

      if (error) throw error;
      
      localStorage.setItem(`unitContact_${selectedUnit.id}`, JSON.stringify(localContactPayload));

      setAllUnits(prev => prev.map(u => u.id === selectedUnit.id ? { ...u, ...dbPayload } : u));
      setSelectedUnit((prev: any) => ({ ...prev, ...dbPayload }));
      
      setIsUnitConfigModalOpen(false);
      setIsUnitSuccessModalOpen(true); 
    } catch (err: any) {
      console.error("Failed to update unit computation:", err);
      alert(err.message || "Failed to update unit configuration");
    } finally {
      setIsSavingUnitConfig(false);
    }
  };

  const generateLedgerMonths = () => {
    const months = [];
    const localCurrentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(localCurrentYear, i, 1);
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
      
      const dueDate = `${monthName} ${colDay}, ${localCurrentYear}`;
      
      months.push({
        monthName: monthName,
        year: localCurrentYear,
        dueDate: dueDate,
        status: stat,
        isCurrentMonth: i === currentMonthIndex
      });
    }
    return months;
  };

  const generatePrintLedgerMonths = () => {
    const months = [];
    const localCurrentYear = new Date().getFullYear();
    const currentMonthIndex = new Date().getMonth(); 

    for (let i = 0; i < 12; i++) {
      const date = new Date(printYear, i, 1);
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      let stat = "Upcoming";
      if (printYear < localCurrentYear || (printYear === localCurrentYear && i < currentMonthIndex)) {
        stat = "Paid"; 
      } else if (printYear === localCurrentYear && i === currentMonthIndex) {
        if ((hasOwnerAssign && ownerStatus === 'Overdue') || (hasTenantAssign && tenantStatus === 'Overdue')) stat = 'Overdue';
        else if ((hasOwnerAssign && ownerStatus === 'Pending') || (hasTenantAssign && tenantStatus === 'Pending')) stat = 'Pending';
        else if ((hasOwnerAssign && ownerStatus === 'Sent') || (hasTenantAssign && tenantStatus === 'Sent')) stat = 'Sent';
        else if (!hasOwnerAssign && !hasTenantAssign) stat = 'Unassigned';
        else stat = 'Paid';
      }
      
      const dueDate = `${monthName} ${colDay}, ${printYear}`;
      
      months.push({
        monthIndex: i,
        monthName: monthName,
        year: printYear,
        dueDate: dueDate,
        status: stat,
        isCurrentMonth: printYear === localCurrentYear && i === currentMonthIndex,
      });
    }
    return months;
  };

  const ledgerData = generateLedgerMonths();
  const printLedgerData = generatePrintLedgerMonths();

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

    // ✨ Track if we are waiving a penalty during this payment
    const partyToVerify = paymentModalParty;
    const wasWaived = pendingWaive === partyToVerify;
    
    try {
      const isOwner = paymentModalParty === 'owner';
      const collectibleAmount = isOwner ? ownerCollectible : tenantCollectible;
      const currentAdvance = isOwner ? ownerAdvance : tenantAdvance;
      const appliedAdvance = isOwner ? appliedOwnerAdvance : appliedTenantAdvance;
      
      const actualPaid = parseFloat(amountPaidInput) || 0;
      
      // Calculate new advance (Remaining advance after deduction + any new overpayment)
      let newAdvance = currentAdvance - appliedAdvance;
      if (actualPaid > collectibleAmount) {
        newAdvance += (actualPaid - collectibleAmount);
      }

      const updateField: any = isOwner 
        ? { owner_status: 'Paid', owner_advance: newAdvance } 
        : { tenant_status: 'Paid', tenant_advance: newAdvance };
      
      if (pendingWaive === paymentModalParty) {
        updateField[`${paymentModalParty}_penalty`] = false;
      } else {
        if (isOwner && ownerPenalty > 0) updateField.owner_penalty = true;
        if (!isOwner && tenantPenalty > 0) updateField.tenant_penalty = true;
      }
      
      const { error } = await supabase
        .from('soa')
        .update(updateField)
        .eq('unit_id', selectedUnit.id);
        
      if (error) throw error;

      if (sourceNotificationId) {
        await supabase
          .from('notifications')
          .update({ is_hidden: true, is_read: true })
          .eq('id', sourceNotificationId);
      }

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
      setSourceNotificationId(null);
      setPendingWaive(null);
      setAmountPaidInput("");
      
      // ✨ Show the success modal AFTER successful payment
      if (wasWaived) {
        setWaiveSuccess({ party: partyToVerify });
      }
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

  const printOwnerName = selectedUnit?.owner_name && selectedUnit.owner_name !== '—' ? selectedUnit.owner_name : 'Occupant';
  const printTenantName = selectedUnit?.tenant_name && selectedUnit.tenant_name !== '—' && selectedUnit.tenant_name !== 'Vacant' ? selectedUnit.tenant_name : null;
  const printResidentDisplay = printTenantName ? `${printOwnerName} (${printTenantName})` : printOwnerName;

  return (
    <>
    <style dangerouslySetInnerHTML={{__html: `
      @media print {
        @page {
          size: A4 portrait;
          margin: ${printLayout === 'half' ? '0' : '10mm'};
        }
        body {
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body > :not(#printable-soa) {
          display: none !important;
        }
        #printable-soa {
          display: flex !important;
          width: 100% !important;
        }
      }
    `}} />

    <div className="absolute inset-0 flex flex-col bg-[var(--color-bg)] font-[family-name:var(--font-corporate)] overflow-hidden print:hidden">
      
      {/* TOP HEADER SECTION */}
      <div className="shrink-0 px-3 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-2 sm:pb-3 mt-1 sm:mt-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 p-4 sm:p-5 md:px-6 md:py-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm backdrop-blur-xl transition-all">
          
          <div className="w-full md:w-auto flex items-center justify-between sm:justify-start min-w-0">
            <div className="flex flex-col min-w-0 pr-2">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2.5 sm:gap-3 truncate">
                <div className="p-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                  <CreditCard className="text-[var(--color-text)]" size={24} strokeWidth={2.5} />
                </div>
                <span className="truncate">Billing &amp; Finance</span>
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium flex items-center gap-2 flex-wrap truncate">
                SOA, Collection &amp; Owner Remittance
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2 sm:hidden shrink-0">
              <div className="w-10 h-10 p-2 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-xs border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                {initials}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col min-[480px]:flex-row items-center justify-start md:justify-end w-full md:w-auto gap-2 sm:gap-3 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0 shrink-0">

            {/* ✨ Made search bar smaller to prevent title truncation */}
            <div className="relative w-full sm:w-32 md:w-40 lg:w-48 xl:w-56 group shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors z-10 pointer-events-none sm:w-4 sm:h-4" size={16} strokeWidth={2.5} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..." 
                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs sm:text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15 focus:border-[var(--color-primary)] bg-white/80 backdrop-blur-sm shadow-[var(--shadow-sm)] transition-all hover:bg-white" 
              />
            </div>

            <div className="hidden sm:flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-primary)]/20 shadow-sm shrink-0">
              <span className="text-xs font-black text-[var(--color-text)] uppercase tracking-wider hidden lg:block">Admin</span>
              <div className="w-10 h-10 md:w-12 md:h-10 p-4 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center font-black text-sm border border-[var(--color-primary)]/20 shadow-sm">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-[1451px]:flex-row overflow-hidden w-full relative px-2 sm:px-4 md:px-6 pb-4 sm:pb-6 gap-3 sm:gap-4 md:gap-5">
        {isLoading ? (
          <div className="flex-1 flex flex-col min-[1451px]:flex-row gap-3 sm:gap-4 md:gap-5">
            <div className={`w-full min-[1451px]:w-[420px] shrink-0 bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] flex-col h-full shadow-sm overflow-hidden animate-pulse ${isMobileListVisible ? 'flex' : 'hidden min-[1451px]:flex'}`}>
              <div className="p-4 sm:p-5 border-b border-[var(--color-border)] bg-slate-50 flex justify-between items-center h-[52px] sm:h-[60px]">
                <div className="w-24 h-4 bg-slate-200 rounded"></div>
                <div className="w-12 h-4 bg-slate-200 rounded"></div>
              </div>
              <div className="flex-1 p-3 space-y-2">
                {[1,2,3,4,5,6,7].map(i => (
                  <BillingSkeletonCard key={i} />
                ))}
              </div>
            </div>

            <div className={`flex-1 flex-col bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-sm animate-pulse ${!isMobileListVisible ? 'flex' : 'hidden min-[1451px]:flex'}`}>
              <div className="h-[72px] sm:h-[84px] bg-slate-50 border-b border-[var(--color-border)] p-4 sm:p-6 flex items-center justify-between">
                <div className="w-1/3 h-6 bg-slate-200 rounded-lg"></div>
                <div className="w-20 h-8 bg-slate-200 rounded-md"></div>
              </div>
              <div className="p-4 sm:p-6 flex-1 space-y-4 sm:space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-2xl bg-white overflow-hidden">
                  <div className="p-4 sm:p-6 md:p-7 flex flex-col h-[280px]">
                    <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100 flex justify-between items-start">
                      <div className="space-y-2 w-1/2">
                        <div className="w-1/2 h-3 bg-slate-200 rounded"></div>
                        <div className="w-3/4 h-5 bg-slate-200 rounded"></div>
                      </div>
                      <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-center"><div className="w-1/3 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                      <div className="flex justify-between items-center"><div className="w-1/4 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                      <div className="flex justify-between items-center"><div className="w-1/3 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                    </div>
                    <div className="mt-auto pt-3.5 sm:pt-4 border-t border-slate-100 flex justify-between items-center">
                      <div className="w-1/3 h-3 bg-slate-200 rounded"></div>
                      <div className="w-1/4 h-5 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  
                  <div className="p-4 sm:p-6 md:p-7 flex-col h-[280px] hidden md:flex">
                    <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-slate-100 flex justify-between items-start">
                      <div className="space-y-2 w-1/2">
                        <div className="w-1/2 h-3 bg-slate-200 rounded"></div>
                        <div className="w-3/4 h-5 bg-slate-200 rounded"></div>
                      </div>
                      <div className="w-16 h-6 bg-slate-100 rounded-full"></div>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-center"><div className="w-1/3 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                      <div className="flex justify-between items-center"><div className="w-1/4 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                      <div className="flex justify-between items-center"><div className="w-1/3 h-3 bg-slate-100 rounded"></div><div className="w-1/4 h-3 bg-slate-200 rounded"></div></div>
                    </div>
                    <div className="mt-auto pt-3.5 sm:pt-4 border-t border-slate-100 flex justify-between items-center">
                      <div className="w-1/3 h-3 bg-slate-200 rounded"></div>
                      <div className="w-1/4 h-5 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                </div>
                
                <div className="h-[120px] bg-slate-100 rounded-[1.5rem]"></div>
                <div className="h-[200px] bg-slate-50 border border-[var(--color-border)] rounded-[1.5rem]"></div>
              </div>
            </div>
          </div>
        ) : allUnits.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
            <div className="bg-white rounded-[2rem] shadow-[var(--shadow-md)] border border-[var(--color-border)] p-8 sm:p-12 text-center max-w-md w-full">
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
            <div className={`w-full min-[1451px]:w-[420px] shrink-0 bg-white border border-[var(--color-border)] rounded-[var(--radius-xl)] flex-col h-full shadow-sm overflow-hidden transition-all ${isMobileListVisible ? 'flex' : 'hidden min-[1451px]:flex'}`}>
              <div className="p-4 sm:p-5 border-b border-[var(--color-border)] shrink-0 bg-white flex justify-between items-center z-10 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-[var(--color-text)] text-xs sm:text-[13px] md:text-sm uppercase tracking-wider">Property Units</h3>
                </div>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-sm shrink-0">{filteredUnits.length} Total</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 sm:p-3 space-y-1.5 bg-slate-50/50">
                {filteredUnits.length === 0 ? (
                  <div className="text-center py-12 px-4">
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
                        className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200 group border ${isSelected ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 shadow-sm ring-1 ring-[var(--color-primary)]/20' : 'bg-white border-slate-100 hover:border-[var(--color-border)] hover:shadow-sm'}`}
                      >
                        <div className="flex-1 min-w-0 pr-1">
                          <h4 className={`text-xs sm:text-[13px] md:text-sm truncate tracking-tight ${isSelected ? 'font-black text-[var(--color-text)]' : 'font-bold text-slate-700 group-hover:text-[var(--color-text)]'}`}>
                            {unit.property_name} {unit.unit_number}
                          </h4>
                          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate mt-1">
                            <span className="font-bold text-slate-400">O:</span> {isRowOwnerVacant ? 'Vacant' : unit.owner_name} 
                            {!isRowTenantVacant && <span className="ml-2"><span className="font-bold text-slate-400">T:</span> {unit.tenant_name}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                          {isRowOwnerVacant && isRowTenantVacant ? (
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-[var(--radius-sm)] border border-slate-200">
                              VACANT
                            </span>
                          ) : (
                            <>
                              {!isRowOwnerVacant && hasRowOwnerAssign && (
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] border shadow-sm shrink-0 ${rOwnerStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rOwnerStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  O: {rOwnerStat}
                                </span>
                              )}
                              {!isRowTenantVacant && hasRowTenantAssign && (
                                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-sm)] border shadow-sm shrink-0 ${rTenantStat === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : rTenantStat === 'Overdue' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  T: {rTenantStat}
                                </span>
                              )}
                              {(!isRowOwnerVacant || !isRowTenantVacant) && !hasRowOwnerAssign && !hasRowTenantAssign && (
                                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-[var(--radius-sm)] border border-slate-100">
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

              {/* BULK ACTIONS FOOTER */}
              <div className="shrink-0 border-t border-[var(--color-border)] bg-white p-3 sm:p-4 space-y-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Applies to all units
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={openGlobalConfigModal}
                    className="h-11 flex items-center justify-center gap-2 bg-white px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs font-bold text-slate-700 hover:border-[var(--color-primary)] transition-all shadow-sm active:scale-95"
                    title="Apply settings to all units"
                  >
                    <Globe size={16} className="shrink-0" /> <span className="truncate">Global Config</span>
                  </button>

                  <button
                    onClick={() => setIsPaymentMethodModalOpen(true)}
                    className="h-11 flex items-center justify-center gap-2 bg-white px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] text-xs font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm active:scale-95"
                    title="Configure accepted payment methods"
                  >
                    <CreditCard size={16} className="shrink-0" /> <span className="truncate">Payment Methods</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsSendAllModalOpen(true)}
                  disabled={isSendingAll || allUnits.length === 0}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] px-4 rounded-[var(--radius-md)] border border-transparent text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send SOA to all units"
                >
                  {isSendingAll ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                  <span className="truncate">Send All SOA</span>
                </button>
              </div>
            </div>

            {/* MAIN DETAILS VIEW */}
           <div className={`flex-1 flex-col overflow-hidden bg-[var(--color-bg)] rounded-[var(--radius-xl)] relative border border-[var(--color-border)] shadow-sm ${!isMobileListVisible ? 'flex' : 'hidden min-[1451px]:flex'}`}>
              {!selectedUnit ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 border border-[var(--color-border)] shadow-sm">
                    <Search size={28} className="text-slate-300 sm:w-8 sm:h-8" />
                  </div>
                  <p className="text-slate-600 font-black text-lg sm:text-xl tracking-tight">No unit selected</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 font-medium">Choose a unit from the sidebar to view billing details.</p>
                </div>
              ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-3 lg:p-4 space-y-4 sm:space-y-6">
                
                <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-[var(--color-border)] overflow-hidden mb-4 sm:mb-6">
                  
                  <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-7 pb-4 sm:pb-5 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/30">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <button 
                        onClick={() => setIsMobileListVisible(true)}
                        className="min-[1451px]:hidden flex items-center gap-1 p-1.5 text-slate-500 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-[var(--radius-sm)] transition-colors active:scale-95 shrink-0"
                      >
                        <ChevronLeft size={22} strokeWidth={2.5} /> <span className="text-[10px] font-black uppercase tracking-widest hidden min-[360px]:block">Units</span>
                      </button>
                      <h3 className="font-extrabold text-[var(--color-text)] text-base sm:text-xl md:text-2xl tracking-tight leading-tight whitespace-normal break-words">
                        {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnerVacant && isTenantVacant && (
                        <span className="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-[var(--radius-sm)] text-[10px] sm:text-[11px] border border-slate-200 uppercase tracking-wide shadow-sm shrink-0 hidden min-[480px]:inline-flex">
                          Vacant
                        </span>
                      )}
                      
                      <button 
                        onClick={openUnitConfigModal}
                        className="text-[var(--color-text)] bg-[var(--color-primary)] hover:opacity-90 px-3 py-1.5 rounded-[var(--radius-md)] transition-all active:scale-95 flex items-center gap-1.5 border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 shadow-sm"
                        title="Configure Unit Billing Rates"
                      >
                        <Settings size={15} strokeWidth={2.5} className="shrink-0" />
                        <span className="text-xs font-bold tracking-wider hidden sm:inline">Unit Config</span>
                      </button>
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${!isTenantVacant ? 'md:grid-cols-2 md:divide-x md:divide-[var(--color-border)]' : ''}`}>
                    
                    <div className="p-4 sm:p-6 md:p-7 relative flex flex-col">
                       <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[var(--color-border)] flex justify-between items-start gap-3">
                           <div className="min-w-0 pr-2">
                               <h4 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-1">Owner Statement</h4>
                               <p className="font-extrabold text-[var(--color-text)] text-sm sm:text-base md:text-lg truncate">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                           </div>
                           {!isOwnerVacant && hasOwnerAssign && renderStatusBadge(ownerStatus)}
                       </div>

                       <h5 className="font-black text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-widest mb-3.5 truncate">
                          {isOwnerVacant && isTenantVacant ? 'Base Unit Charges' : 'Assigned Breakdown'}
                       </h5>

                       <div className="space-y-3 flex-1 tabular-nums">
                          {isAssigned && hasOwnerAssign ? (
                            <>
                              {activeConfig.owner.dues && (
                                <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Unit Dues</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.parking && (
                                <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Parking</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.water && (
                                <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Water</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {activeConfig.owner.electricity && (
                                <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Electricity</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {ownerPenalty > 0 && !isOwnerVacant && (
                                <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-red-500 font-bold truncate">Late Penalty</span><span className="font-black text-red-600 shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                              )}
                              {ownerTotalDue === 0 && <p className="text-xs text-slate-400 italic">No assigned balances.</p>}
                            </>
                          ) : (
                            <p className="text-xs text-slate-400 italic font-medium">No assigned balances.</p>
                          )}
                       </div>
                       
                       <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-slate-50/80 -mx-4 sm:-mx-6 md:-mx-7 -mb-4 sm:-mb-6 md:-mb-7 px-4 sm:px-6 md:px-7 py-3.5 sm:py-4 md:rounded-bl-[1.5rem] tabular-nums">
                           <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest shrink-0">Owner Subtotal:</span>
                           <span className="font-black text-[var(--color-text)] text-sm sm:text-lg shrink-0">
                             {isAssigned ? `₱${ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                           </span>
                       </div>
                    </div>

                    {!isTenantVacant && (
                       <div className="p-4 sm:p-6 md:p-7 relative flex flex-col border-t md:border-t-0 border-[var(--color-border)] md:rounded-br-[1.5rem]">
                           <div className="mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[var(--color-border)] flex justify-between items-start gap-3">
                               <div className="min-w-0 pr-2">
                                   <h4 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest mb-1">Tenant Statement</h4>
                                   <p className="font-extrabold text-[var(--color-text)] text-sm sm:text-base md:text-lg truncate">{selectedUnit?.tenant_name}</p>
                               </div>
                               {hasTenantAssign && renderStatusBadge(tenantStatus)}
                           </div>

                           <h5 className="font-black text-slate-400 text-[10px] sm:text-[11px] uppercase tracking-widest mb-3.5 truncate">
                              Assigned Breakdown
                           </h5>

                           <div className="space-y-3 flex-1 tabular-nums">
                              {isAssigned && hasTenantAssign ? (
                                <>
                                  {activeConfig.tenant.dues && (
                                    <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Unit Dues</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.parking && (
                                    <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Parking</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.water && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Water</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {activeConfig.tenant.electricity && !isTenantVacant && (
                                    <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-slate-600 font-medium truncate">Electricity</span><span className="font-bold text-[var(--color-text)] shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {tenantPenalty > 0 && (
                                    <div className="flex justify-between items-center gap-3 text-xs sm:text-sm"><span className="text-red-400 font-bold truncate">Late Penalty</span><span className="font-black text-red-500 shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                                  )}
                                  {tenantTotalDue === 0 && <p className="text-xs text-slate-400 italic">No assigned balances.</p>}
                                </>
                              ) : (
                                <p className="text-xs text-slate-400 italic font-medium">No assigned balances.</p>
                              )}
                           </div>

                           <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-slate-50/80 -mx-4 sm:-mx-6 md:-mx-7 -mb-4 sm:-mb-6 md:-mb-7 px-4 sm:px-6 md:px-7 py-3.5 sm:py-4 md:rounded-bl-[1.5rem] tabular-nums">
                               <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest shrink-0">Tenant Subtotal:</span>
                               <span className="font-black text-[var(--color-text)] text-sm sm:text-lg shrink-0">
                                 {isAssigned ? `₱${tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                               </span>
                           </div>
                       </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 sm:mb-6 bg-[var(--color-secondary)] p-5 sm:p-6 md:p-7 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] w-full overflow-hidden tabular-nums relative">
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-white/90 text-xs uppercase tracking-widest block">Total Amount Due</span>
                    {!isTenantVacant && <div className="text-[10px] font-medium text-white/70 mt-1 truncate block">Combined Property Balance</div>}
                  </div>

                  {!isTenantVacant && isAssigned && (
                    <div className="hidden lg:flex items-center gap-6 px-6 border-x border-white/10 text-white text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/60 font-bold block">Owner Portion</span>
                        <span className="font-black text-sm text-white">₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase tracking-wider text-white/60 font-bold block">Tenant Portion</span>
                        <span className="font-black text-sm text-white">₱{tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  )}

                  <span className="font-black text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl tracking-tight break-all sm:break-normal shrink-0">₱{totalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
                
                <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:flex md:flex-row gap-2.5 sm:gap-3 w-full mb-6 flex-wrap">
                  
                  {isAssigned && ((ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant) || (tenantTotalDue > 0 && tenantStatus !== 'Paid' && !isTenantVacant)) && (
                    <button 
                      onClick={() => setIsPaymentSelectionModalOpen(true)}
                      className="w-full md:w-auto md:flex-none justify-center bg-[var(--color-primary)] text-[var(--color-primary-text)] px-4 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-xs font-bold shadow-md hover:opacity-90 transition-all active:scale-95 flex items-center gap-2 border border-transparent"
                    >
                      <CreditCard className="shrink-0 w-4 h-4" /> <span className="truncate">Verify Payment</span>
                    </button>
                  )}

                  {(ownerPenalty > 0 || tenantPenalty > 0) && (
                    <button 
                      onClick={() => setIsPenaltyModalOpen(true)}
                      className="w-full md:w-auto md:flex-none justify-center bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-600 px-4 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                    >
                      <AlertCircle className="shrink-0 w-4 h-4" /> <span className="truncate">Penalties</span>
                    </button>
                  )}

                  <button 
                    onClick={openSOAModal}
                    disabled={isUnitConfigMissing}
                    title={isUnitConfigMissing ? "Set up the Unit Config first" : undefined}
                    className="w-full md:w-auto md:flex-none justify-center bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/90 text-[var(--color-text)] px-4 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:border-[var(--color-border)]"
                  >
                    <Send className="shrink-0 w-4 h-4 text-[var(--color-text)]" /> <span className="truncate">Assign SOA</span>
                  </button>

                  <button 
                    onClick={() => setIsPrintModalOpen(true)}
                    className="w-full md:w-auto md:flex-none justify-center bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/90 text-slate-800 px-4 py-2.5 sm:py-3 rounded-[var(--radius-md)] text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Printer className="shrink-0 w-4 h-4" /> <span className="truncate">Print / Save PDF</span>
                  </button>
                </div>

                <div className="bg-white rounded-[var(--radius-xl)] shadow-sm border border-[var(--color-border)] p-2 sm:p-3 md:p-5 overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-5 gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-primary)]/20 shadow-sm shrink-0">
                        <CalendarClock size={18} className="sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-[var(--color-text)] text-base sm:text-xl tracking-tight truncate">Ledger &amp; Projections</h4>
                        <div className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
                          Due: Day {colDay} <span className="mx-1.5 text-slate-300">|</span> Penalty: Day {colDay + grace}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleExportCSV}
                      className="w-full sm:w-auto justify-center flex items-center gap-2 text-sm font-bold text-[var(--color-text)] bg-[var(--color-primary)] hover:opacity-90 px-4 py-2.5 rounded-[var(--radius-md)] transition-all active:scale-95 border border-[var(--color-border)] shadow-sm shrink-0"
                    >
                      <Download size={15} /> Export CSV
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto border border-[var(--color-border)] rounded-[var(--radius-xl)] relative shadow-inner">
                    <table className="w-full text-center text-xs sm:text-sm min-w-[750px] sm:min-w-[850px] tabular-nums">
                      <thead className="bg-[var(--color-primary)] border-b border-[var(--color-border)] sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">PERIOD</th>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">DUE DATE</th>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">DUES</th>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">PARKING</th>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">UTILITIES</th>
                          <th className="px-4 py-3 sm:py-4.5 whitespace-nowrap bg-red-50 text-red-600 border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider">
                            PENALTY
                          </th>
                          <th className="px-4 py-3 sm:py-3.5 whitespace-nowrap border-r border-slate-200/50 text-[14px] font-black uppercase tracking-wider text-[var(--color-text)]">STATUS {isTenantVacant ? '' : '(O/T)'}</th>
                          <th className="px-4 py-3 sm:py-3.5 text-center whitespace-nowrap font-black text-[var(--color-text)] text-[14px] uppercase tracking-wider">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[var(--color-text)] bg-white">
                        {ledgerData.map((row, idx) => {
                          const activeRow = row.isCurrentMonth;
                          const hasPenalty = row.isCurrentMonth && (ownerPenalty > 0 || tenantPenalty > 0);
                          
                          return (
                            <tr key={idx} className={`transition-colors ${activeRow ? "bg-[var(--color-primary)]/5 hover:bg-[var(--color-primary)]/10" : "hover:bg-slate-50"}`}>
                              <td className={`px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-black uppercase text-[8px] sm:text-xs tracking-wide ${activeRow ? 'text-[var(--color-text)]' : 'text-slate-600'}`}>
                                {row.monthName} {row.year} {activeRow && <span className="ml-1 text-[8px] font-black text-emerald-600 tracking-widest opacity-80">(NOW)</span>}
                              </td>
                              <td className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 text-slate-500 font-medium text-xs">{row.dueDate}</td>
                              <td className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-medium text-xs">{rawDues > 0 ? `₱${rawDues.toLocaleString()}` : "—"}</td>
                              <td className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-medium text-xs">{rawParking > 0 ? `₱${rawParking.toLocaleString()}` : "—"}</td>
                              <td className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-medium text-xs">{(!isTenantVacant && (rawWater + rawElectricity) > 0) ? `₱${(rawWater + rawElectricity).toLocaleString()}` : "—"}</td>
                              
                              <td className={`px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-bold text-xs ${hasPenalty ? 'text-red-500 bg-red-50/50' : 'text-slate-400'}`}>
                                {hasPenalty ? (
                                  <div className="flex flex-col gap-0.5 text-[10px]">
                                    {ownerPenalty > 0 && <span>O: ₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>}
                                    {tenantPenalty > 0 && <span>T: ₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>}
                                  </div>
                                ) : "—"}
                              </td>
                              
                              <td className="px-4 py-3 sm:py-4.5 whitespace-nowrap border-r border-slate-100 font-bold text-[10px] tracking-wider uppercase">
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

                              <td className={`px-4 py-3 text-right whitespace-nowrap font-black text-xs sm:text-sm ${row.status === 'Paid' ? 'text-[var(--color-text)]' : 'text-slate-500'}`}>
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
      
      {/* ✨ PAYMENT METHODS CONFIG MODAL */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                  <CreditCard size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">Accepted Payment Methods</h2>
              </div>
              <button onClick={() => setIsPaymentMethodModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSavingPaymentMethods}>
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4 bg-slate-50/50">
              <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4">
                Select the payment methods you want to make available for owners and tenants when they submit their payments.
              </p>

              <div className="grid grid-cols-1 gap-3">
                {['Digital Wallet', 'Bank Transfer', 'Check', 'Cash'].map((method) => {
                  const isSelected = selectedPaymentMethods.includes(method);
                  return (
                    <label 
                      key={method} 
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <span className={`font-bold text-sm ${isSelected ? 'text-emerald-800' : 'text-slate-600'}`}>{method}</span>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleTogglePaymentMethod(method)}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-[var(--color-border)] bg-white flex gap-3 justify-end">
              <button
                onClick={() => setIsPaymentMethodModalOpen(false)}
                disabled={isSavingPaymentMethods}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-[var(--radius-md)] transition-colors shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsPaymentMethodConfirmModalOpen(true)}
                disabled={isSavingPaymentMethods || selectedPaymentMethods.length === 0}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-colors shadow-[var(--shadow-md)] flex items-center justify-center gap-2 active:scale-95 border border-transparent"
              >
                {isSavingPaymentMethods ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Save Methods
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ PAYMENT METHODS CONFIRMATION MODAL */}
      {isPaymentMethodConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                  <AlertCircle size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">Confirm Update</h2>
              </div>
              <button onClick={() => setIsPaymentMethodConfirmModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSavingPaymentMethods}>
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4 bg-white">
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Are you sure you want to update the available payment methods?
              </p>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium">
                This will instantly change the payment options available to all owners and tenants when they submit their next payment.
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-[var(--color-border)] bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setIsPaymentMethodConfirmModalOpen(false)}
                disabled={isSavingPaymentMethods}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-[var(--radius-md)] transition-colors shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSavePaymentMethods();
                  setIsPaymentMethodConfirmModalOpen(false);
                }}
                disabled={isSavingPaymentMethods}
                className="px-5 py-2.5 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-colors shadow-[var(--shadow-md)] flex items-center justify-center gap-2 active:scale-95 border border-transparent"
              >
                {isSavingPaymentMethods ? <Loader2 size={16} className="animate-spin" /> : "Confirm Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✨ SUCCESS MODAL FOR PAYMENT METHODS */}
      {isPaymentMethodSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 sm:mb-3 tracking-tight">Payment Methods Updated</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              Your residents will now only see the selected payment options when settling their accounts.
            </p>
            <button 
              onClick={() => setIsPaymentMethodSuccessModalOpen(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* SEND ALL SOA CONFIRMATION MODAL */}
      {isSendAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100 shrink-0">
                  <Send size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">Send All SOAs</h2>
              </div>
              <button onClick={() => setIsSendAllModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isSendingAll}>
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4">
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Are you sure you want to bulk send the Statement of Account (SOA) to all units?
              </p>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium">
                This action will notify all assigned owners and tenants with outstanding bills for the current billing cycle. Unassigned or empty units will be safely skipped.
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-[var(--color-border)] bg-slate-50/50 flex gap-3 justify-end">
              <button
                onClick={() => setIsSendAllModalOpen(false)}
                disabled={isSendingAll}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-[var(--radius-md)] transition-colors shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSendAllSOA();
                }}
                disabled={isSendingAll}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-[var(--radius-md)] text-xs font-bold transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95"
              >
                {isSendingAll ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Confirm Send All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW SUCCESS MODAL FOR SEND ALL SOA */}
      {isSendAllSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 sm:mb-3 tracking-tight">SOAs Sent Successfully</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              Successfully processed all eligible SOAs and sent <strong className="text-slate-800">{sendAllNotifCount} notifications</strong>.
            </p>
            <button 
              onClick={() => setIsSendAllSuccessModalOpen(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* PRINT SOA DATE SELECTOR MODAL */}
      {isPrintModalOpen && selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight truncate pr-2">Print Settings</h2>
              <button onClick={() => setIsPrintModalOpen(false)} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0">
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-6 bg-slate-50/50">
              <div>
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-3">1. Select Layout</p>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPrintLayout('full')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${printLayout === 'full' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="w-8 h-12 border-2 border-slate-300 rounded mb-2 flex flex-col p-1 gap-1">
                      <div className="w-full h-1 bg-slate-300 rounded-sm"></div>
                      <div className="w-full h-1 bg-slate-200 rounded-sm"></div>
                      <div className="w-full h-1 bg-slate-200 rounded-sm"></div>
                      <div className="w-full h-2 bg-slate-300 rounded-sm mt-auto"></div>
                    </div>
                    <span className={`text-[11px] font-bold ${printLayout === 'full' ? 'text-[var(--color-text)]' : 'text-slate-500'}`}>Whole Paper</span>
                  </button>
                  <button 
                    onClick={() => setPrintLayout('half')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${printLayout === 'half' ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="w-8 h-12 border-2 border-slate-300 rounded mb-2 flex flex-col p-1 gap-1 relative overflow-hidden">
                      <div className="w-full h-1 bg-slate-300 rounded-sm"></div>
                      <div className="w-full h-1 bg-slate-200 rounded-sm"></div>
                      <div className="absolute top-[48%] left-0 right-0 border-t border-dashed border-slate-400"></div>
                    </div>
                    <span className={`text-[11px] font-bold ${printLayout === 'half' ? 'text-[var(--color-text)]' : 'text-slate-500'}`}>Half Paper</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">2. Select Period</p>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Month</label>
                  <select 
                    value={printMonth} 
                    onChange={(e) => setPrintMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} 
                    className="w-full px-3.5 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] shadow-sm bg-white cursor-pointer"
                  >
                    <option value="all">Whole Year</option>
                    {availableMonths.map(m => (
                      <option key={m.index} value={m.index}>{m.name}</option>
                    ))}
                  </select>
                </div>
                
                {availableYears.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Year</label>
                    <select 
                      value={printYear} 
                      onChange={(e) => setPrintYear(Number(e.target.value))} 
                      className="w-full px-3.5 py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold text-[var(--color-text)] shadow-sm bg-white cursor-pointer"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t border-[var(--color-border)] mt-6">
                <button 
                  onClick={() => setIsPrintModalOpen(false)}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setTimeout(() => window.print(), 100);
                  }}
                  className="flex-[2] bg-[var(--color-primary)] hover:opacity-90 text-[var(--color-primary-text)] border border-transparent font-black uppercase tracking-widest py-3 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] flex justify-center items-center gap-2 active:scale-95 text-xs"
                >
                  <Printer size={16} /> Generate PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL CONFIGURATION MODAL */}
      {isGlobalConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-t-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg md:max-w-xl lg:max-w-2xl overflow-hidden transform transition-all flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-white shrink-0 border-b border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-text)]/5 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-border)] shrink-0 shadow-sm">
                  <Globe size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight truncate">Global Billing Config</h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">Applies to all units across {orgData?.org_name || "the property"}</p>
                </div>
              </div>
              <button onClick={() => setIsGlobalConfigModalOpen(false)} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1">
              <div className="mb-4 sm:mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm rounded-[var(--radius-md)]">
                <strong>Warning:</strong> Saving this form will instantly overwrite these billing settings for <strong>every single unit</strong> in your property. Individual unit configs can still be modified later.
              </div>
              <form onSubmit={handleSaveGlobalConfig} className="space-y-4 sm:space-y-5 pb-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 sm:pb-5 border-b border-slate-200/60">
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.collectionDay ? '!text-red-500' : ''}`}>Collection Start <span className="text-red-500">*</span></label>
                    <input type="number" min="1" max="31" placeholder="Day (1-31)" value={unitCompCollectionDay} onChange={(e) => { setUnitCompCollectionDay(e.target.value); clearErr('collectionDay'); }} className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.collectionDay ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
<FieldError message={fieldErrors.collectionDay} />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.gracePeriod ? '!text-red-500' : ''}`}>Grace Period <span className="text-red-500">*</span></label>
                    <input type="number" min="0" placeholder="Days" value={unitCompGracePeriod} onChange={(e) => { setUnitCompGracePeriod(e.target.value); clearErr('gracePeriod'); }} className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.gracePeriod ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
<FieldError message={fieldErrors.gracePeriod} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.duesRate ? '!text-red-500' : ''}`}>Assoc. Dues (sqm) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompDuesRate} onChange={(e) => { setUnitCompDuesRate(e.target.value); clearErr('duesRate'); }} className={`w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.duesRate ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
                    </div>
<FieldError message={fieldErrors.duesRate} />
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Parking Rate</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompParking} onChange={(e) => setUnitCompParking(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Parking SQM</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompParkingArea} onChange={(e) => setUnitCompParkingArea(e.target.value)} className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2 border border-slate-200 p-4 rounded-[var(--radius-md)] bg-slate-50/50">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Water Billing Mode</label>
                      <select value={unitCompWaterMode} onChange={(e) => setUnitCompWaterMode(e.target.value as 'fixed' | 'consumption')} className="px-2 py-1 text-xs font-bold border rounded bg-white focus:outline-[var(--color-primary)]">
                        <option value="fixed">Fixed Amount</option>
                        <option value="consumption">Metered (Consumption)</option>
                      </select>
                    </div>

                    {unitCompWaterMode === 'fixed' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Fixed Amount</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                          <input type="number" step="0.01" value={unitCompWater} onChange={(e) => setUnitCompWater(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Previous (m³)</label>
                          <input type="number" value={unitCompWaterPrev} onChange={(e) => setUnitCompWaterPrev(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Current (m³)</label>
                          <input type="number" value={unitCompWaterCurr} onChange={(e) => setUnitCompWaterCurr(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Rate (₱/m³)</label>
                          <input type="number" step="0.01" value={unitCompWaterRate} onChange={(e) => setUnitCompWaterRate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Electricity</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompElec} onChange={(e) => setUnitCompElec(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-4 sm:pt-5">
                  <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Late Penalty Deduction <span className="text-red-500">*</span></label>
                  <div className="flex flex-col min-[480px]:flex-row gap-2.5 sm:gap-3">
                    <select value={unitCompPenaltyType} onChange={(e) => setUnitCompPenaltyType(e.target.value)} className="w-full min-[480px]:w-[130px] shrink-0 px-3 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-xs font-bold text-slate-700 transition-all shadow-sm bg-white">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={unitCompPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={unitCompPenaltyValue} onChange={(e) => { setUnitCompPenaltyValue(e.target.value); clearErr('penaltyValue'); }} className={`w-full flex-1 px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-sm ${fieldErrors.penaltyValue ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
                  </div>
<FieldError message={fieldErrors.penaltyValue} />
                </div>
                
                {/* Contact & Address Details Section */}
                <div className="border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm">
                  <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate">Property & Contact Info</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Set up the property address and contact details shown on the SOA.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Property Address <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="e.g. 110 PANAY AVENUE. QUEZON CITY" 
                        value={unitCompAddress} 
                        onChange={(e) => setUnitCompAddress(e.target.value)} 
                        className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Contact Email <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. email@propertyko.com" 
                          value={unitCompEmail} 
                          onChange={(e) => setUnitCompEmail(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Short Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. FPPS PM" 
                          value={unitCompShortName} 
                          onChange={(e) => setUnitCompShortName(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Contact Number <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. 09569277024" 
                          value={unitCompContactNumber} 
                          onChange={(e) => setUnitCompContactNumber(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Custom Reminder (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. We do not accept cash payments." 
                        value={unitCompCustomReminder} 
                        onChange={(e) => setUnitCompCustomReminder(e.target.value)} 
                        className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Transfer Details Section */}
                <div className="border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm">
                  <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate">Bank Transfer Details</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Set up this global bank details here. Securely displayed to all owners and tenants.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankName ? '!text-red-500' : ''}`}>Bank Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="e.g. BDO Unibank" 
                        value={unitCompBankName} 
                        onChange={(e) => { setUnitCompBankName(e.target.value); clearErr('bankName'); }} 
                        className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankName ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                      />
<FieldError message={fieldErrors.bankName} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankAccountName ? '!text-red-500' : ''}`}>Account Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. HOA Admin" 
                          value={unitCompBankAccountName} 
                          onChange={(e) => { setUnitCompBankAccountName(e.target.value); clearErr('bankAccountName'); }} 
                          className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankAccountName ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                        />
<FieldError message={fieldErrors.bankAccountName} />
                      </div>
                      <div>
                        <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankAccountNumber ? '!text-red-500' : ''}`}>Account Number <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. 0012-3456" 
                          value={unitCompBankAccountNumber} 
                          onChange={(e) => { setUnitCompBankAccountNumber(e.target.value); clearErr('bankAccountNumber'); }} 
                          className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankAccountNumber ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                        />
<FieldError message={fieldErrors.bankAccountNumber} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Upload Section */}
                <div className={`border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm ${fieldErrors.qr ? '!border-red-400 !bg-red-50' : ''}`}>
                  <label className={`block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate ${fieldErrors.qr ? '!text-red-500' : ''}`}>Digital Wallet QR <span className="text-red-500">*</span></label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Upload GCash, Maya, or QR Ph barcode to apply to all units.
                  </p>
                  
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 border border-[var(--color-border)] rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative p-1.5 shadow-inner">
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
                        className="w-full bg-slate-50 border border-slate-200 hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text)] text-slate-600 font-bold text-[10px] sm:text-xs py-2.5 sm:py-3 rounded-[var(--radius-sm)] transition-all shadow-sm flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isUploadingQr ? (
                          <><Loader2 size={14} className="animate-spin text-slate-500" /> Uploading...</>
                        ) : (
                          <><Upload size={14} className="text-[var(--color-text)]" /> {unitCompQrUrl ? 'Replace QR' : 'Upload QR'}</>
                        )}
                      </button>
                    </div>
                  </div>
                  <FieldError message={fieldErrors.qr} />
                </div>

              </form>
            </div>
            
            <div className="mt-auto px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[var(--color-border)] flex gap-2.5 sm:gap-3 bg-white z-20 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsGlobalConfigModalOpen(false)} 
                disabled={isSavingGlobalConfig}
                className="flex-1 sm:flex-none sm:w-[130px] shrink-0 py-3 sm:py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveGlobalConfig}
                disabled={isSavingGlobalConfig}
                className="flex-[2] sm:flex-1 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] border border-transparent py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center gap-2 truncate px-2"
              >
                {isSavingGlobalConfig ? <Loader2 size={14} className="animate-spin" /> : "Save to All Units"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNIT-SPECIFIC CONFIGURATION MODAL */}
      {isUnitConfigModalOpen && selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-t-[1.5rem] sm:rounded-[var(--radius-xl)] shadow-2xl w-full max-w-lg md:max-w-xl lg:max-w-2xl overflow-hidden transform transition-all flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 sm:px-6 py-4 sm:py-5 flex justify-between items-center relative overflow-hidden bg-white shrink-0 border-b border-[var(--color-border)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl -translate-y-10 translate-x-10 pointer-events-none"></div>
              <div className="relative z-10 min-w-0 flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-text)]/5 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-border)] shrink-0 shadow-sm">
                  <Settings size={18} className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight truncate">Unit Billing Config</h2>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">{selectedUnit.property_name} · Unit {selectedUnit.unit_number}</p>
                </div>
              </div>
              <button onClick={() => setIsUnitConfigModalOpen(false)} className="relative z-10 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0">
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/40 flex-1">
              <form onSubmit={handleSaveUnitConfig} className="space-y-4 sm:space-y-5 pb-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 sm:pb-5 border-b border-slate-200/60">
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.collectionDay ? '!text-red-500' : ''}`}>Collection Start <span className="text-red-500">*</span></label>
                    <input type="number" min="1" max="31" placeholder="Day (1-31)" value={unitCompCollectionDay} onChange={(e) => { setUnitCompCollectionDay(e.target.value); clearErr('collectionDay'); }} className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.collectionDay ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
<FieldError message={fieldErrors.collectionDay} />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.gracePeriod ? '!text-red-500' : ''}`}>Grace Period <span className="text-red-500">*</span></label>
                    <input type="number" min="0" placeholder="Days" value={unitCompGracePeriod} onChange={(e) => { setUnitCompGracePeriod(e.target.value); clearErr('gracePeriod'); }} className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.gracePeriod ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
<FieldError message={fieldErrors.gracePeriod} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate ${fieldErrors.duesRate ? '!text-red-500' : ''}`}>Assoc. Dues (sqm) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompDuesRate} onChange={(e) => { setUnitCompDuesRate(e.target.value); clearErr('duesRate'); }} className={`w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm ${fieldErrors.duesRate ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
                    </div>
<FieldError message={fieldErrors.duesRate} />
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Parking Rate</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                        <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompParking} onChange={(e) => setUnitCompParking(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Parking SQM</label>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompParkingArea} onChange={(e) => setUnitCompParkingArea(e.target.value)} className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-1 md:col-span-2 border border-slate-200 p-4 rounded-[var(--radius-md)] bg-slate-50/50">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Water Billing Mode</label>
                      <select value={unitCompWaterMode} onChange={(e) => setUnitCompWaterMode(e.target.value as 'fixed' | 'consumption')} className="px-2 py-1 text-xs font-bold border rounded bg-white focus:outline-[var(--color-primary)]">
                        <option value="fixed">Fixed Amount</option>
                        <option value="consumption">Metered (Consumption)</option>
                      </select>
                    </div>

                    {unitCompWaterMode === 'fixed' ? (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Fixed Amount</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                          <input type="number" step="0.01" value={unitCompWater} onChange={(e) => setUnitCompWater(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Previous (m³)</label>
                          <input type="number" value={unitCompWaterPrev} onChange={(e) => setUnitCompWaterPrev(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Current (m³)</label>
                          <input type="number" value={unitCompWaterCurr} onChange={(e) => setUnitCompWaterCurr(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 truncate">Rate (₱/m³)</label>
                          <input type="number" step="0.01" value={unitCompWaterRate} onChange={(e) => setUnitCompWaterRate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Electricity</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs sm:text-sm">₱</span>
                      <input type="number" step="0.01" min="0" placeholder="0.00" value={unitCompElec} onChange={(e) => setUnitCompElec(e.target.value)} className="w-full pl-8 pr-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs sm:text-sm font-bold text-[var(--color-text)] transition-all shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-4 sm:pt-5">
                  <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5 ml-1 truncate">Late Penalty Deduction <span className="text-red-500">*</span></label>
                  <div className="flex flex-col min-[480px]:flex-row gap-2.5 sm:gap-3">
                    <select value={unitCompPenaltyType} onChange={(e) => setUnitCompPenaltyType(e.target.value)} className="w-full min-[480px]:w-[130px] shrink-0 px-3 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-xs font-bold text-slate-700 transition-all shadow-sm bg-white">
                      <option value="fixed">Fixed (₱)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                    <input type="number" step="0.01" min="0" placeholder={unitCompPenaltyType === 'percent' ? "e.g. 3" : "e.g. 500"} value={unitCompPenaltyValue} onChange={(e) => { setUnitCompPenaltyValue(e.target.value); clearErr('penaltyValue'); }} className={`w-full flex-1 px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:bg-red-50 focus:ring-4 focus:ring-red-400/15 focus:border-red-400 text-xs sm:text-sm font-bold text-slate-700 transition-all shadow-sm ${fieldErrors.penaltyValue ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} />
                  </div>
<FieldError message={fieldErrors.penaltyValue} />
                </div>
                
                {/* Contact & Address Details Section */}
                <div className="border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm">
                  <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate">Property & Contact Info</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Set up the property address and contact details shown on the SOA.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Property Address <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="e.g. 110 PANAY AVENUE. QUEZON CITY" 
                        value={unitCompAddress} 
                        onChange={(e) => setUnitCompAddress(e.target.value)} 
                        className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Contact Email <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. email@propertyko.com" 
                          value={unitCompEmail} 
                          onChange={(e) => setUnitCompEmail(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Short Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. FPPS PM" 
                          value={unitCompShortName} 
                          onChange={(e) => setUnitCompShortName(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Contact Number <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. 09569277024" 
                          value={unitCompContactNumber} 
                          onChange={(e) => setUnitCompContactNumber(e.target.value)} 
                          className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate">Custom Reminder (Optional)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. We do not accept cash payments." 
                        value={unitCompCustomReminder} 
                        onChange={(e) => setUnitCompCustomReminder(e.target.value)} 
                        className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white" 
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Transfer Details Section */}
                <div className="border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm">
                  <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate">Bank Transfer Details</label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Set up this unit's bank details here. Securely displayed to owners and tenants.
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankName ? '!text-red-500' : ''}`}>Bank Name <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        placeholder="e.g. BDO Unibank" 
                        value={unitCompBankName} 
                        onChange={(e) => { setUnitCompBankName(e.target.value); clearErr('bankName'); }} 
                        className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankName ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                      />
<FieldError message={fieldErrors.bankName} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankAccountName ? '!text-red-500' : ''}`}>Account Name <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. HOA Admin" 
                          value={unitCompBankAccountName} 
                          onChange={(e) => { setUnitCompBankAccountName(e.target.value); clearErr('bankAccountName'); }} 
                          className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankAccountName ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                        />
<FieldError message={fieldErrors.bankAccountName} />
                      </div>
                      <div>
                        <label className={`block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1 truncate ${fieldErrors.bankAccountNumber ? '!text-red-500' : ''}`}>Account Number <span className="text-red-500">*</span></label>
                        <input 
                          type="text" 
                          placeholder="e.g. 0012-3456" 
                          value={unitCompBankAccountNumber} 
                          onChange={(e) => { setUnitCompBankAccountNumber(e.target.value); clearErr('bankAccountNumber'); }} 
                          className={`w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-[var(--color-border)] focus:outline-none focus:bg-slate-50 focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all shadow-sm bg-white ${fieldErrors.bankAccountNumber ? '!border-red-400 !bg-red-50 focus:!ring-red-400/15' : ''}`} 
                        />
<FieldError message={fieldErrors.bankAccountNumber} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Upload Section */}
                <div className={`border border-[var(--color-primary)]/20 bg-white p-4 sm:p-5 rounded-xl sm:rounded-[1.25rem] mt-4 sm:mt-5 shadow-sm ${fieldErrors.qr ? '!border-red-400 !bg-red-50' : ''}`}>
                  <label className={`block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1 tracking-tight truncate ${fieldErrors.qr ? '!text-red-500' : ''}`}>Digital Wallet QR <span className="text-red-500">*</span></label>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mb-3 sm:mb-4 font-medium leading-relaxed">
                    Upload GCash, Maya, or QR Ph barcode.
                  </p>
                  
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 border border-[var(--color-border)] rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative p-1.5 shadow-inner">
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
                        className="w-full bg-slate-50 border border-slate-200 hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text)] text-slate-600 font-bold text-[10px] sm:text-xs py-2.5 sm:py-3 rounded-[var(--radius-sm)] transition-all shadow-sm flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
                      >
                        {isUploadingQr ? (
                          <><Loader2 size={14} className="animate-spin text-slate-500" /> Uploading...</>
                        ) : (
                          <><Upload size={14} className="text-[var(--color-text)]" /> {unitCompQrUrl ? 'Replace QR' : 'Upload QR'}</>
                        )}
                      </button>
                    </div>
                  </div>
                  <FieldError message={fieldErrors.qr} />
                </div>

              </form>
            </div>
            
            <div className="mt-auto px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[var(--color-border)] flex gap-2.5 sm:gap-3 bg-white z-20 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsUnitConfigModalOpen(false)} 
                disabled={isSavingUnitConfig}
                className="flex-1 sm:flex-none sm:w-[130px] shrink-0 py-3 sm:py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-[var(--radius-md)] transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveUnitConfig}
                disabled={isSavingUnitConfig}
                className="flex-[2] sm:flex-1 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] border border-transparent py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest transition-all shadow-[var(--shadow-md)] active:scale-95 flex items-center justify-center gap-2 truncate px-2"
              >
                {isSavingUnitConfig ? <Loader2 size={14} className="animate-spin" /> : "Save Config"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PENALTY MODAL */}
      {isPenaltyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100 shrink-0">
                  <AlertCircle size={16} />
                </div>
                <h2 className="text-base sm:text-lg font-black text-[var(--color-secondary)] tracking-tight">Manage Penalties</h2>
              </div>
              <button onClick={() => setIsPenaltyModalOpen(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" disabled={isWaiving}>
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <div className="px-4 sm:px-6 py-5 sm:py-8 space-y-4">
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                You can waive the penalty for this billing period. The base balance will remain due until a payment is verified.
              </p>
              
              {ownerPenalty > 0 && (
                <div className="bg-red-50 border border-red-100 p-4 sm:p-5 rounded-xl flex flex-col gap-3 sm:gap-4 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800 text-xs sm:text-sm">Owner Penalty</span>
                    <span className="font-black text-red-600 text-lg sm:text-xl">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <button 
                    onClick={() => handleWaivePenalty('owner')}
                    disabled={isWaiving}
                    className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-2.5 sm:py-3 rounded-[var(--radius-sm)] text-xs transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isWaiving && waivingParty === 'owner' ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : (ownerStatus === 'Paid' ? "Waive Penalty" : "Verify Payment First, Then Waive Penalty")}
                  </button>
                </div>
              )}

              {tenantPenalty > 0 && (
                <div className="bg-red-50 border border-red-100 p-4 sm:p-5 rounded-xl flex flex-col gap-3 sm:gap-4 shadow-inner">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800 text-xs sm:text-sm">Tenant Penalty</span>
                    <span className="font-black text-red-600 text-lg sm:text-xl">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <button 
                    onClick={() => handleWaivePenalty('tenant')}
                    disabled={isWaiving}
                    className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold py-2.5 sm:py-3 rounded-[var(--radius-sm)] text-xs transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isWaiving && waivingParty === 'tenant' ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : (tenantStatus === 'Paid' ? "Waive Penalty" : "Verify Payment First, Then Waive Penalty")}
                  </button>
                </div>
              )}

              {!(ownerPenalty > 0) && !(tenantPenalty > 0) && (
                <div className="text-center py-5 sm:py-6 text-xs sm:text-sm font-bold text-slate-400 bg-slate-50 rounded-[var(--radius-md)] border border-slate-100">
                  No active penalties to waive.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SOA MODAL */}
      {isSOAModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] shadow-2xl w-full max-w-2xl md:max-w-3xl lg:max-w-4xl h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col transform transition-all border border-[var(--color-border)] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--color-border)] flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--color-text)]/5 text-[var(--color-text)] flex items-center justify-center border border-[var(--color-border)] shrink-0">
                  <Send size={16} className="translate-x-[1px] translate-y-[-1px] sm:w-[18px] sm:h-[18px]" />
                </div>
                <h2 className="text-base sm:text-lg md:text-xl font-black text-[var(--color-text)] tracking-tight truncate">Assign Balances <span className="text-[var(--color-text)] ml-1 hidden sm:inline">· Unit {selectedUnit?.unit_number}</span></h2>
              </div>
              <button onClick={() => setIsSOAModalOpen(false)} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSendingSOA || isSavingDefault}>
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 bg-slate-50/50">
              <p className="text-xs md:text-sm text-slate-500 mb-4 sm:mb-6 font-medium leading-relaxed bg-white p-3.5 sm:p-4 rounded-[var(--radius-lg)] border border-slate-200 shadow-sm">
                {isTenantVacant ? "Assign balances to the owner for this unit. Settings will be saved automatically when setting defaults." : "Checking a box for one party will automatically lock it out for the other party. To swap assignments, uncheck the item first."}
              </p>
              
              <div className={`grid grid-cols-1 ${!isTenantVacant ? 'md:grid-cols-2 md:divide-x md:divide-slate-200' : ''} border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden mb-6 shadow-sm bg-white`}>
                
                {/* OWNER COLUMN */}
                <div className="p-4 sm:p-5 md:p-6 bg-white relative flex flex-col">
                  <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-100">
                    <h3 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest truncate">Owner</h3>
                    <p className="text-xs sm:text-sm text-slate-600 truncate mt-1 font-bold">{isOwnerVacant ? 'Vacant' : selectedUnit?.owner_name}</p>
                  </div>
                  
                  <div className="space-y-3.5 flex-1 tabular-nums">
                    {rawDues > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.dues && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.dues && !isTenantVacant} checked={soaConfig.owner.dues} onChange={(e) => handleToggleSoa('owner', 'dues', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Assoc. Dues</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {rawParking > 0 && (
                      <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.parking && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled={soaConfig.tenant.parking && !isTenantVacant} checked={soaConfig.owner.parking} onChange={(e) => handleToggleSoa('owner', 'parking', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Parking</span>
                        </div>
                        <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                    {rawWater > 0 && (
  <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.water && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <input type="checkbox" disabled={soaConfig.tenant.water && !isTenantVacant} checked={soaConfig.owner.water} onChange={(e) => handleToggleSoa('owner', 'water', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
      <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Water</span>
    </div>
    <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
  </label>
)}
{rawElectricity > 0 && (
  <label className={`flex items-center justify-between gap-2 ${soaConfig.tenant.electricity && !isTenantVacant ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
      <input type="checkbox" disabled={soaConfig.tenant.electricity && !isTenantVacant} checked={soaConfig.owner.electricity} onChange={(e) => handleToggleSoa('owner', 'electricity', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
      <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Electricity</span>
    </div>
    <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
  </label>
)}

                    {soaConfig.owner.penalty && !isOwnerVacant && (
                      <label className="flex items-center justify-between gap-2 cursor-not-allowed opacity-70">
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <input type="checkbox" disabled checked className="rounded text-red-500 bg-red-100 border-red-200 w-4 h-4 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-red-600 truncate">Late Penalty</span>
                        </div>
                        <span className="font-black text-red-600 text-xs sm:text-sm shrink-0">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </label>
                    )}
                  </div>
                  
                  <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-slate-50 -mx-4 sm:-mx-5 md:-mx-6 -mb-4 sm:-mb-5 md:-mb-6 px-4 sm:px-5 md:px-6 py-3.5 sm:py-4 md:rounded-bl-2xl">
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest shrink-0">Owner Total</span>
                    <span className="font-black text-[var(--color-text)] text-sm sm:text-base shrink-0">
                      ₱{((soaConfig.owner.dues ? rawDues : 0) + (soaConfig.owner.parking ? rawParking : 0) + (soaConfig.owner.water ? rawWater : 0) + (soaConfig.owner.electricity ? rawElectricity : 0) + (soaConfig.owner.penalty ? ownerPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                {/* TENANT COLUMN */}
                {!isTenantVacant && (
                  <div className="p-4 sm:p-5 md:p-6 relative bg-white flex flex-col border-t md:border-t-0 border-slate-100">
                    <div className="mb-4 sm:mb-5 pb-3 border-b border-slate-100">
                      <h3 className="font-black text-[var(--color-text)] text-[10px] sm:text-[11px] uppercase tracking-widest truncate">Tenant</h3>
                      <p className="text-xs sm:text-sm text-slate-600 truncate mt-1 font-bold">{selectedUnit?.tenant_name}</p>
                    </div>
                    
                    <div className="space-y-3.5 flex-1 tabular-nums">
                      {rawDues > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.dues ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.dues} checked={soaConfig.tenant.dues} onChange={(e) => handleToggleSoa('tenant', 'dues', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Assoc. Dues</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawDues.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {rawParking > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.parking ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.parking} checked={soaConfig.tenant.parking} onChange={(e) => handleToggleSoa('tenant', 'parking', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Parking</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawParking.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawWater > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.water ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.water} checked={soaConfig.tenant.water} onChange={(e) => handleToggleSoa('tenant', 'water', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Water</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawWater.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {!isTenantVacant && rawElectricity > 0 && (
                        <label className={`flex items-center justify-between gap-2 ${soaConfig.owner.electricity ? 'cursor-not-allowed opacity-50' : 'cursor-pointer group'}`}>
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled={soaConfig.owner.electricity} checked={soaConfig.tenant.electricity} onChange={(e) => handleToggleSoa('tenant', 'electricity', e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] w-4 h-4 disabled:bg-slate-200 transition-all border-slate-300 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-[var(--color-text)] transition-colors truncate">Electricity</span>
                          </div>
                          <span className="font-black text-[var(--color-text)] text-xs sm:text-sm shrink-0">₱{rawElectricity.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                      {soaConfig.tenant.penalty && (
                        <label className="flex items-center justify-between gap-2 cursor-not-allowed opacity-70">
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                            <input type="checkbox" disabled checked className="rounded text-red-500 bg-red-100 border-red-200 w-4 h-4 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-red-600 truncate">Late Penalty</span>
                          </div>
                          <span className="font-black text-red-600 text-xs sm:text-sm shrink-0">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </label>
                      )}
                    </div>
                    
                    <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[var(--color-border)] flex justify-between items-center bg-slate-50 -mx-4 sm:-mx-5 md:-mx-6 -mb-4 sm:-mb-5 md:-mb-6 px-4 sm:px-5 md:px-6 py-3.5 sm:py-4 md:rounded-bl-2xl">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Tenant Subtotal</span>
                      <span className="font-black text-[var(--color-text)] text-sm sm:text-base shrink-0">
                        ₱{((soaConfig.tenant.dues ? rawDues : 0) + (soaConfig.tenant.parking ? rawParking : 0) + (!isTenantVacant && soaConfig.tenant.water ? rawWater : 0) + (!isTenantVacant && soaConfig.tenant.electricity ? rawElectricity : 0) + (soaConfig.tenant.penalty ? tenantPenalty : 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-4 sm:px-6 py-4 border-t border-[var(--color-border)] bg-white flex flex-col sm:flex-row gap-2.5 sm:gap-3 z-20">
              <button 
                onClick={() => setIsSOAModalOpen(false)} 
                disabled={isSendingSOA || isSavingDefault}
                className="w-full sm:w-[130px] shrink-0 py-3 sm:py-3.5 text-xs font-black uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
              >
                Cancel
              </button>
              <div className="flex gap-2.5 sm:gap-3 w-full flex-col min-[480px]:flex-row">
                <button 
                  onClick={() => handleSendSOA()}
                  disabled={
                    isSendingSOA || 
                    isSavingDefault || 
                    isSoaAlreadySent || 
                    !(
                      soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity || soaConfig.owner.penalty ||
                      soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity || soaConfig.tenant.penalty
                    )
                   }
                  className="flex-1 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest shadow-md border border-transparent transition-all flex justify-center items-center gap-1.5 active:scale-95 truncate px-2"
                >
                  {isSendingSOA ? "Processing..." : isSoaAlreadySent ? "SOA was already sent" : "Send SOA"}
                </button>
                <button 
                  onClick={() => {
                    setIsSOAModalOpen(false);
                    const ownerHasBill = soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity;
                    const tenantHasBill = soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity;
                    setOverdueConfig({
                      owner: !!ownerHasBill && !isOwnerVacant && !soaConfig.owner.penalty,
                      tenant: !!tenantHasBill && !isTenantVacant && !soaConfig.tenant.penalty
                    });
                    setIsOverdueModalOpen(true);
                  }}
                  disabled={isSendingSOA || isSavingDefault || isOverdueIssued}
                  className={`flex-1 bg-red-500 hover:bg-red-600 disabled:cursor-not-allowed text-white py-3 sm:py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest shadow-md border border-transparent transition-all flex justify-center items-center gap-1.5 active:scale-95 truncate px-2 ${isOverdueIssued ? 'opacity-60' : ''}`}
                >
                  {isOverdueIssued ? "Overdue Issued" : "Mark Overdue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERDUE PENALTY ASSIGNMENT MODAL */}
      {isOverdueModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-red-50">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center border border-red-200 shrink-0 shadow-sm">
                  <AlertCircle size={16} strokeWidth={2.5} className="sm:w-[18px] sm:h-[18px]"/>
                </div>
                <h2 className="text-base sm:text-lg font-black text-red-600 tracking-tight">Mark as Overdue</h2>
              </div>
              <button 
                onClick={() => {
                  setIsOverdueModalOpen(false);
                  setIsSOAModalOpen(true);
                }} 
                className="text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors p-2 active:scale-95 shrink-0" 
                disabled={isMarkingOverdue}
              >
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-5">
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                Select which parties should receive the late penalty charge for this billing cycle.
              </p>

              <div className="space-y-3 sm:space-y-4">
                {/* Owner Penalty Assignment */}
                {(!isOwnerVacant && (soaConfig.owner.dues || soaConfig.owner.parking || soaConfig.owner.water || soaConfig.owner.electricity)) ? (
                  soaConfig.owner.penalty ? (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-slate-400 text-center uppercase tracking-wider">
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
                        <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-red-600 transition-colors">Apply Late Penalty to Owner</span>
                        <span className="text-xs text-slate-500 mt-0.5">Penalty amount: ₱{hypotheticalOwnerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </label>
                  )
                ) : (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-slate-400 text-center uppercase tracking-wider">
                    Owner has no active bill
                  </div>
                )}

                {/* Tenant Penalty Assignment */}
                {(!isTenantVacant && (soaConfig.tenant.dues || soaConfig.tenant.parking || soaConfig.tenant.water || soaConfig.tenant.electricity)) ? (
                  soaConfig.tenant.penalty ? (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-slate-400 text-center uppercase tracking-wider">
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
                        <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-red-600 transition-colors">Apply Late Penalty to Tenant</span>
                        <span className="text-xs text-slate-500 mt-0.5">Penalty amount: ₱{hypotheticalTenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </label>
                  )
                ) : (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-xs font-bold text-slate-400 text-center uppercase tracking-wider">
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
                  disabled={isMarkingOverdue}
                  className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
                >
                  Back
                </button>
                <button 
                  onClick={handleConfirmOverdue}
                  disabled={isMarkingOverdue || (!overdueConfig.owner && !overdueConfig.tenant)}
                  className="flex-[2] bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-3.5 rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest shadow-md border border-transparent transition-all flex justify-center items-center gap-2 active:scale-95"
                >
                  {isMarkingOverdue ? <Loader2 size={16} className="animate-spin" /> : "Confirm Overdue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SELECTION MODAL */}
      {isPaymentSelectionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] tracking-wider truncate pr-2">Payment Verification</h2>
              <button onClick={() => setIsPaymentSelectionModalOpen(false)} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0">
                <X size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 space-y-4 bg-slate-50/50">
              <p className="text-xs sm:text-sm text-slate-500 mb-4 font-medium leading-relaxed">
                Select which payment you want to verify:
              </p>
              
              {isAssigned && ownerTotalDue > 0 && ownerStatus !== 'Paid' && !isOwnerVacant && (
                <button 
                  onClick={() => {
                    setIsPaymentSelectionModalOpen(false);
                    setPaymentModalParty('owner');
                    setIsPaymentModalOpen(true);
                  }}
                  className="w-full bg-white border border-[var(--color-border)] hover:border-emerald-300 hover:bg-emerald-50 text-[var(--color-text)] p-4 sm:p-5 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] flex justify-between items-center group active:scale-95"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-xs sm:text-sm group-hover:text-emerald-700 tracking-wider">Owner Payment</span>
                    <span className="text-xs text-slate-500 mt-0.5">Amount Due: ₱{ownerTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
                  className="w-full bg-white border border-[var(--color-border)] hover:border-emerald-300 hover:bg-emerald-50 text-[var(--color-text)] p-4 sm:p-5 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-sm)] flex justify-between items-center group active:scale-95"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-xs sm:text-sm group-hover:text-emerald-700 tracking-wider">Tenant Payment</span>
                    <span className="text-xs text-slate-500 mt-0.5">Amount Due: ₱{tenantTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <ChevronLeft className="rotate-180 text-slate-400 group-hover:text-emerald-500" size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (Admin Verifying) */}
      {isPaymentModalOpen && paymentModalParty && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-[var(--color-border)] animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 sm:p-5 md:p-6 pb-4 sm:pb-5 flex justify-between items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/50">
              <h2 className="text-base sm:text-lg font-black text-[var(--color-text)] capitalize tracking-wider truncate pr-2">{paymentModalParty} Payment</h2>
              <button onClick={() => {
                if (!isSimulating) {
                   setIsPaymentModalOpen(false);
                   setPendingWaive(null);
                }
              }} className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors active:scale-95 shrink-0" disabled={isSimulating || isFetchingPayment}>
                <X size={20} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="px-5 sm:px-6 py-6 sm:py-8 bg-slate-50/50">
              <p className="text-xs sm:text-sm text-slate-500 mb-5 sm:mb-6 font-medium leading-relaxed">
                Please verify the payment details submitted by the <span className="font-black text-[var(--color-text)] uppercase tracking-wide">{paymentModalParty}</span> for {selectedUnit?.property_name} · Unit {selectedUnit?.unit_number}.
              </p>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[var(--color-border)] mb-6 sm:mb-8 shadow-sm">
                
                <div className="flex justify-between items-center mb-2 gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Total Bill</span>
                  <span className="font-bold text-slate-500 text-sm tracking-tight shrink-0">
                    ₱{(paymentModalParty === 'owner' ? ownerTotalDue : tenantTotalDue).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>
                {(paymentModalParty === 'owner' ? ownerAdvance : tenantAdvance) > 0 && (
                  <div className="flex justify-between items-center mb-2 gap-3">
                    <span className="text-[10px] sm:text-[11px] font-black text-emerald-500 uppercase tracking-widest shrink-0">Less: Advance Payment</span>
                    <span className="font-bold text-emerald-600 text-sm tracking-tight shrink-0">
                      - ₱{(paymentModalParty === 'owner' ? appliedOwnerAdvance : appliedTenantAdvance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-[var(--color-border)] gap-3">
                  <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest shrink-0">Collectible Amount</span>
                  <span className="font-black text-[var(--color-text)] text-xl sm:text-2xl tracking-tight shrink-0">
                    ₱{(paymentModalParty === 'owner' ? ownerCollectible : tenantCollectible).toLocaleString(undefined, {minimumFractionDigits: 2})}
                  </span>
                </div>

                <div className="mb-4 sm:mb-5">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Actual Amount Paid (₱)</label>
                  <input 
                    type="number" 
                    placeholder="Enter amount paid..." 
                    value={amountPaidInput} 
                    onChange={(e) => setAmountPaidInput(e.target.value)} 
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-[var(--radius-md)] border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] text-sm font-bold shadow-sm" 
                  />
                  {(parseFloat(amountPaidInput) || 0) > (paymentModalParty === 'owner' ? ownerCollectible : tenantCollectible) && (
                    <p className="text-xs text-emerald-600 font-bold mt-2 ml-1">
                      + ₱{((parseFloat(amountPaidInput) || 0) - (paymentModalParty === 'owner' ? ownerCollectible : tenantCollectible)).toLocaleString(undefined, {minimumFractionDigits: 2})} will be saved as Advance Payment for next month.
                    </p>
                  )}
                </div>
                
                {isFetchingPayment ? (
                  <div className="py-3 sm:py-4 text-center text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                    Fetching submitted details...
                  </div>
                ) : fetchedPayment ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Method Used</span>
                      <span className="text-[10px] sm:text-[11px] font-black text-[var(--color-text)] bg-[var(--color-primary)]/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-primary)]/20 shadow-sm shrink-0">
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
                  <div className="py-3 sm:py-4 text-center text-xs sm:text-sm font-bold text-slate-400">
                    No payment details submitted yet.
                  </div>
                )}
              </div>

              <button 
                onClick={handleConfirmPayment}
                disabled={isSimulating || isFetchingPayment || !fetchedPayment || fetchedPayment?.status === 'Paid'}
                className="w-full bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 disabled:shadow-none text-[var(--color-primary-text)] border border-transparent font-black uppercase tracking-widest py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] flex justify-center items-center gap-2 active:scale-95 text-xs sm:text-sm"
              >
                {isSimulating ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : fetchedPayment?.status === 'Paid' ? (
                  <><CheckCircle size={16} strokeWidth={2.5} className="sm:w-[18px] sm:h-[18px]" /> Payment Already Settled</>
                ) : (
                  <><CheckCircle size={16} strokeWidth={2.5} className="sm:w-[18px] sm:h-[18px]" /> Mark as Paid</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL FOR WAIVING PENALTY */}
      {waiveSuccess && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-secondary)] mb-2 sm:mb-3 tracking-tight">Payment Verified &<br/>Penalty Waived</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              The base payment has been verified and the late penalty for the <strong className="text-[var(--color-text)] capitalize">{waiveSuccess.party}</strong> has been successfully removed.
            </p>
            <button 
              onClick={() => setWaiveSuccess(null)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
      
      {/* SUCCESS MODAL FOR UNIT CONFIG SAVING */}
      {isUnitSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 sm:mb-3 tracking-tight">Unit Config Saved</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              The billing settings for <strong className="text-slate-800">Unit {selectedUnit?.unit_number}</strong> have been successfully updated.
            </p>
            <button 
              onClick={() => setIsUnitSuccessModalOpen(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
      
      {/* SUCCESS MODAL FOR GLOBAL CONFIG SAVING */}
      {isGlobalSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[var(--color-bg)] rounded-[var(--radius-xl)] shadow-2xl w-full max-w-sm overflow-hidden transform transition-all text-center p-6 sm:p-8 border border-[var(--color-border)] animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 sm:mb-6 shadow-sm border border-[var(--color-primary)]/20">
              <CheckCircle size={32} strokeWidth={2.5} className="sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)] mb-2 sm:mb-3 tracking-tight">Global Config Saved</h2>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mb-6 sm:mb-8 leading-relaxed px-2">
              The billing settings have been successfully securely applied to <strong>all units</strong> in your property.
            </p>
            <button 
              onClick={() => setIsGlobalSuccessModalOpen(false)}
              className="w-full bg-[var(--color-primary)] hover:opacity-90 border border-transparent text-[var(--color-primary-text)] font-black uppercase tracking-widest text-xs py-3.5 sm:py-4 rounded-[var(--radius-md)] transition-all shadow-[var(--shadow-md)] active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>

    {/* HIDDEN PDF / PRINTABLE SOA TEMPLATE */}
    {isMounted && typeof document !== 'undefined' && createPortal(
      <div id="printable-soa" className={`hidden print:flex flex-col font-sans bg-white text-black w-full relative box-border ${printLayout === 'half' ? 'h-[148.5mm] pt-[10mm] px-[15mm] pb-[10mm] border-b-2 border-dashed border-slate-400 overflow-hidden' : 'h-[275mm] pt-6 px-6 pb-6 overflow-hidden'}`}>
        {selectedUnit && (
          <div className="w-full flex-1 flex flex-col h-full relative">
            
            {/* Header section adjusts based on layout */}
            {printLayout === 'full' ? (
              <div className="text-center mb-6 flex flex-col items-center shrink-0">
                {orgData?.logo_url ? (
                  <div className="relative w-64 h-20 mb-2">
                    <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-center" priority />
                  </div>
                ) : (
                  <h1 className="text-2xl font-black uppercase tracking-wide">{orgData?.org_name || "FUTURE POINT PLAZA SUITES"}</h1>
                )}
                <p className="text-[12px] font-medium mt-1 uppercase">{printAddress}</p>
                <h2 className="text-xl font-normal mt-4">STATEMENT OF ACCOUNT</h2>
              </div>
            ) : (
              <div className="flex justify-between items-center mb-3 border-b pb-2 shrink-0">
                <div className="flex flex-col items-start gap-0.5">
                  {orgData?.logo_url ? (
                    <div className="relative w-32 h-10">
                      <Image src={orgData.logo_url} alt="Organization Logo" fill className="object-contain object-left" priority />
                    </div>
                  ) : (
                    <h1 className="text-sm font-black uppercase tracking-wide">{orgData?.org_name || "FUTURE POINT PLAZA SUITES"}</h1>
                  )}
                  <p className="text-[9px] font-medium uppercase text-slate-600">{printAddress}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-base font-black tracking-widest m-0 leading-none">STATEMENT OF ACCOUNT</h2>
                </div>
              </div>
            )}

            <div className={`shrink-0 ${printLayout === 'half' ? 'mb-1' : 'mb-2'}`}>
               <p className={`font-bold italic uppercase tracking-wide ${printLayout === 'half' ? 'text-[10px]' : 'text-[14px]'}`}>BILLING PERIOD - {printMonth === 'all' ? `ENTIRE YEAR ${printYear}` : `${monthsList[printMonth as number]} ${printYear}`}</p>
            </div>

            {/* Box 1: Owner / Unit */}
            <div className={`border border-black rounded-[12px] overflow-hidden flex justify-between items-center shrink-0 ${printLayout === 'half' ? 'mb-2' : 'mb-4'}`}>
              <div className={`flex-1 ${printLayout === 'half' ? 'px-3 py-1' : 'p-4'}`}>
                <p className={`uppercase ${printLayout === 'half' ? 'text-[9px] mb-0' : 'text-[12px]'}`}>UNIT OWNER / RESIDENT:</p>
                <p className={`uppercase font-bold ${printLayout === 'half' ? 'text-[11px] mt-0' : 'text-[12px] mt-0.5'}`}>{printResidentDisplay}</p>
              </div>
              <div className={`${printLayout === 'half' ? 'px-3 py-1 w-[120px]' : 'p-4 w-[150px]'} border-l border-black shrink-0 h-full`}>
                <p className={`uppercase ${printLayout === 'half' ? 'text-[9px] mb-0' : 'text-[12px]'}`}>UNIT NO.</p>
                <p className={`uppercase font-bold ${printLayout === 'half' ? 'text-[11px] mt-0' : 'text-[12px] mt-0.5'}`}>{selectedUnit?.unit_number}</p>
              </div>
            </div>

            {/* Box 2: Table Section */}
            <div className={`border border-black rounded-[12px] overflow-hidden shrink-0 flex flex-col ${printLayout === 'half' ? 'mb-2' : 'mb-4'}`}>
              <div className={`flex justify-between items-center border-b border-black ${printLayout === 'half' ? 'p-1.5 px-3 text-[9px]' : 'p-3 text-[12px]'}`}>
                <p>Period Cover: {printMonth === 'all' ? `Year ${printYear}` : `${monthsList[printMonth as number]} ${printYear}`}</p>
                <p>Due Date: {printMonth === 'all' ? `—` : `${monthsList[printMonth as number].substring(0,3)}. ${colDay}, ${printYear}`}</p>
              </div>
              
              <div className={`${printLayout === 'half' ? 'p-2 px-3 pb-2' : 'p-4 pb-3'}`}>
                <table className={`w-full text-left ${printLayout === 'half' ? 'text-[9px]' : 'text-[12px]'}`}>
                  <thead>
                    <tr>
                      <th className="pb-1.5 font-bold w-[15%]">Date</th>
                      <th className="pb-1.5 font-bold w-[25%]">Particulars</th>
                      {/* Added pl-6 to shift right */}
                      <th className="pb-1.5 font-bold w-[15%] pl-6">Unit Area</th>
                      <th className="pb-1.5 font-bold w-[25%] pl-6">Rate</th>
                      {/* Added whitespace-nowrap here */}
                      <th className="pb-1.5 font-bold w-[20%] text-right whitespace-nowrap">Amount Collectible</th>
                    </tr>
                  </thead>
                  <tbody className="leading-tight">
                    {/* Only lines that are actually assigned (same rules as ownerBase / tenantBase) */}
                    {printDuesAmt > 0 && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0">Unit Dues</td>
                        <td className="py-0 pl-6 whitespace-nowrap">{selectedUnit?.unit_area || '0 sqm'}</td>
                        <td className="py-0 pl-6 whitespace-nowrap">₱{selectedUnit?.dues_rate || 0}/sqm/month</td>
                        <td className="py-0 text-right">₱{printDuesAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}
                    {printParkingAmt > 0 && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0">Parking</td>
                        <td className="py-0 pl-6 whitespace-nowrap">{selectedUnit?.parking_area || 0} sqm</td>
                        <td className="py-0 pl-6 whitespace-nowrap">₱{selectedUnit?.parking || 0}/sqm/month</td>
                        <td className="py-0 text-right">₱{printParkingAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}
                    
                    {printWaterAmt > 0 && activeWaterMode === 'fixed' && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0">Water</td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 text-right">₱{printWaterAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}

                    {printWaterAmt > 0 && activeWaterMode === 'consumption' && (
                      <tr>
                        <td className="py-0 align-top">{currentDateStr}</td>
                        <td className="py-0 align-top">
                          <span>Water (Metered)</span>
                          <div className={`text-black whitespace-nowrap ${printLayout === 'half' ? 'text-[8px] mt-0' : 'text-[10px] mt-0.5'}`}>
                            Current: {activeWaterCurr} m³ &nbsp;&nbsp;|&nbsp;&nbsp; Prev: {activeWaterPrev} m³ &nbsp;&nbsp;|&nbsp;&nbsp; Cons: {waterConsumption} m³
                          </div>
                        </td>
                        <td className="py-0 align-top pl-6"></td>
                        <td className="py-0 align-top pl-6">₱{activeWaterRate}/m³</td>
                        <td className="py-0 text-right align-top">₱{printWaterAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}
                    
                    {printElectricityAmt > 0 && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0">Electricity</td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 text-right">₱{printElectricityAmt.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}

                    {ownerPenalty > 0 && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0 text-red-600 print:text-black">Late Penalty (Owner)</td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 text-right">₱{ownerPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}
                    {tenantPenalty > 0 && (
                      <tr>
                        <td className="py-0">{currentDateStr}</td>
                        <td className="py-0 text-red-600 print:text-black">Late Penalty (Tenant)</td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 pl-6"></td>
                        <td className="py-0 text-right">₱{tenantPenalty.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      </tr>
                    )}
                    
                    {/* Remaining Balance: penalties are already listed above, so this only
                        carries previous unpaid balance (not tracked yet -> 0.00) */}
                    <tr>
                      <td className={`${printLayout === 'half' ? 'pt-2' : 'pt-4'} pb-0 font-bold`} colSpan={5}>Remaining Balance:</td>
                    </tr>
                    <tr>
                      <td className={`${printLayout === 'half' ? 'py-0 text-[8px]' : 'py-0 text-[10px]'}`} colSpan={2}>- {printMonth === 'all' ? `Year ${printYear}` : `${monthsList[printMonth as number]} ${printYear}`}</td>
                      <td colSpan={2}></td>
                      <td className="py-0 text-right">₱{(0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                    
                    {/* ADVANCE PAYMENT — always visible, shows who has it (like Late Penalty) */}
                    <tr>
                      <td className={`${printLayout === 'half' ? 'pt-2' : 'pt-2'} pb-0 font-bold`} colSpan={5}>Advance Payment:</td>
                    </tr>
                    <tr>
                      <td className={`${printLayout === 'half' ? 'py-0 text-[8px]' : 'py-0 text-[12px]'}`} colSpan={2}>
                        - Paid by Owner
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-0 text-right">
                        ₱{Number(ownerAdvance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                    {!isTenantVacant && (
                      <tr>
                        <td className={`${printLayout === 'half' ? 'py-0 text-[8px]' : 'py-0 text-[12px]'}`} colSpan={2}>
                          - Paid by Tenant
                        </td>
                        <td colSpan={2}></td>
                        <td className="py-0 text-right">
                          ₱{Number(tenantAdvance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Box 3: Total Collectible Block (fixed total: charges + penalties, never changes after payment) */}
            <div className={`border border-black rounded-[12px] overflow-hidden flex flex-col shrink-0 ${printLayout === 'half' ? 'mb-2' : 'mb-6'}`}>
              <div className={`flex justify-between items-center bg-white ${printLayout === 'half' ? 'p-1.5 px-3' : 'p-3'}`}>
                <span className={`font-black ${printLayout === 'half' ? 'text-[12px]' : 'text-[15px]'}`}>TOTAL COLLECTIBLE</span>
                <span className={`font-black ${printLayout === 'half' ? 'text-[12px]' : 'text-[15px]'}`}>₱{combinedTotalForPrint.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>

            {/* Payment Details & Reminders (Adapts based on layout to fit 1 page) */}
            {printLayout === 'full' ? (
              <div className="flex-1 flex flex-col mt-4">
                <div className="mb-4 shrink-0">
                  <h3 className="font-bold uppercase text-[12px] mb-2">PAYMENT DETAILS</h3>
                  <div className="flex gap-2 text-[12px] mb-0.5">
                    <span>Bank Name:</span>
                    <span className="font-bold ml-1">{selectedUnit?.bank_name || "Future World Realty & Developer Inc."}</span>
                  </div>
                  <div className="flex gap-2 text-[12px] mb-0.5">
                    <span>Bank Account Name:</span>
                    <span className="font-bold ml-1">{selectedUnit?.bank_account_name || "FUTURE WORLD REALTY & DEVELOPER INC."}</span>
                  </div>
                  <div className="flex gap-2 text-[12px]">
                    <span>Bank Account No.:</span>
                    <span className="font-bold ml-1">{selectedUnit?.bank_account_number || "010948011048 (BDO)"}</span>
                  </div>
                </div>

                <div className="mb-4 flex-1 overflow-hidden">
                  <h3 className="font-bold uppercase text-[12px] mb-2">REMINDERS:</h3>
                  <ul className="list-disc pl-5 text-[12px] space-y-1">
                    <li>All payments should be made by check to <span className="font-bold">{selectedUnit?.bank_account_name || "FUTURE WORLD REALTY & DEVELOPER INC."}</span></li>
                    <li>Please settle your account at your earliest convenience.</li>
                    {printCustomReminder && <li>{printCustomReminder}</li>}
                  </ul>
                </div>

                <div className="bg-[#2b2b2b] text-white p-3 flex justify-between items-center w-[calc(100%+3rem)] -mx-6 -mb-6 mt-auto shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <span className="font-bold text-[12px] pl-6">CONTACT US</span>
                  <span className="text-[12px] pr-6 truncate">
                    {printEmail} | {printShortName} | {printContactNumber}
                  </span>
                </div>
              </div>
            ) : (
              /* HALF LAYOUT COMPACT FOOTER */
              <div className="flex-1 flex flex-col justify-end mt-1 relative">
                <div className="grid grid-cols-[1fr_1fr] gap-4 mb-2 shrink-0">
                  <div>
                    <h3 className="font-bold uppercase text-[9px] mb-1">PAYMENT DETAILS</h3>
                    <div className="text-[9px] leading-tight space-y-0.5">
                      <p>Bank Name: <span className="font-bold">{selectedUnit?.bank_name || "Future World Realty & Developer Inc."}</span></p>
                      <p>Bank Account Name: <span className="font-bold">{selectedUnit?.bank_account_name || "FUTURE WORLD REALTY & DEVELOPER INC."}</span></p>
                      <p>Bank Account No.: <span className="font-bold">{selectedUnit?.bank_account_number || "010948011048 (BDO)"}</span></p>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold uppercase text-[9px] mb-1">REMINDERS:</h3>
                    <ul className="list-disc pl-4 text-[8px] space-y-0.5 leading-tight">
                      <li>All payments should be made by check to <span className="font-bold">{selectedUnit?.bank_account_name || "FUTURE WORLD REALTY & DEVELOPER INC."}</span></li>
                      <li>Please settle your account at your earliest convenience.</li>
                      {printCustomReminder && <li>{printCustomReminder}</li>}
                    </ul>
                  </div>
                </div>
                <div className="bg-[#2b2b2b] text-white p-2 mt-auto flex items-center justify-between w-[calc(100%+30mm)] -mx-[15mm] -mb-[10mm] shrink-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <span className="font-bold text-[9px] pl-[15mm]">CONTACT US</span>
                  <span className="text-[9px] pr-[15mm] truncate">
                    {printEmail} | {printShortName} | {printContactNumber}
                  </span>
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>,
      document.body
    )}
    </>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p data-field-error className="flex items-center gap-1.5 mt-1.5 ml-1 text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-1">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="leading-snug">{message}</span>
    </p>
  );
}

function BillingSkeletonCard() {
  return (
    <div className="bg-white border-slate-200 rounded-[var(--radius-md)] p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm border animate-pulse group cursor-pointer h-[72px] shrink-0">
      <div className="flex-1 min-w-0 pr-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        <div className="flex items-center gap-2">
          <div className="h-3 bg-slate-100 rounded w-8"></div>
          <div className="h-3 bg-slate-100 rounded w-16"></div>
          <div className="h-3 bg-slate-100 rounded w-8 ml-1"></div>
          <div className="h-3 bg-slate-100 rounded w-16"></div>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 gap-1.5">
        <div className="h-4 bg-slate-200 rounded w-16"></div>
        <div className="h-4 bg-slate-200 rounded w-16"></div>
      </div>
    </div>
  );
}
