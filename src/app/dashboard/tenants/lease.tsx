"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from "@/utils/supabase/client";
import { FileText, Calendar, Home, CreditCard, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LeaseTab() {
  const [unit, setUnit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaseData();
  }, []);

  const fetchLeaseData = async () => {
    setIsLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Fetch Tenant Profile
      const { data: profile } = await supabase
        .from('team_members')
        .select('*')
        .eq('email', authData.user.email)
        .single();

      if (profile) {
        // 2. Fetch the assigned Unit
        const { data: unitData } = await supabase
          .from('units')
          .select('*')
          .eq('admin_email', profile.admin_email)
          .ilike('tenant_name', profile.name)
          .single();

        if (unitData) {
          setUnit(unitData);
        }
      }
    } catch (error) {
      console.error("Error fetching lease data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe variable fallbacks while loading
  const propertyName = unit?.property_name || "Unassigned Property";
  const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : "No Unit";
  const monthlyRent = unit?.monthly_rent || 0;
  
  // Format Lease End Date
  const leaseEndDate = unit?.lease_end 
    ? new Date(unit.lease_end).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) 
    : "Not specified";

  // Calculate dynamic display values
  const securityDeposit = monthlyRent * 2; // Assuming standard 2-months deposit
  const renewalRate = monthlyRent * 1.05; // Assuming a 5% increase for the renewal offer
  
  // Calculate a generic offer expiry (30 days before lease ends)
  const offerExpiry = unit?.lease_end 
    ? new Date(new Date(unit.lease_end).getTime() - (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : "TBD";

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto pb-10 text-center py-20 text-slate-500">
        Loading lease details...
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="max-w-5xl mx-auto pb-10">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center flex flex-col items-center">
          <AlertCircle size={48} className="text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Lease Found</h2>
          <p className="text-slate-500 text-sm">We couldn't find an active lease assigned to your profile. Please contact your property manager.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">My Lease</h2>
        <p className="text-slate-500 text-sm">View your contract details and renewal options.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Lease Details */}
        <div className="lg:col-span-7">
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-lg mb-6 text-slate-800">Contract Summary</h3>
            <div className="space-y-6">
              <LeaseDetail icon={<Home size={20}/>} label="Unit Address" value={`${propertyName} · ${unitNumber}`} />
              <LeaseDetail icon={<CreditCard size={20}/>} label="Monthly rent" value={`₱${monthlyRent.toLocaleString()}`} />
              <LeaseDetail icon={<Calendar size={20}/>} label="Lease ends" value={leaseEndDate} />
              <LeaseDetail icon={<FileText size={20}/>} label="Security Deposit" value={`₱${securityDeposit.toLocaleString()}`} />
              
              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Full Contract Document</span>
                <button className="text-[#1e88e5] font-bold hover:underline flex items-center gap-1 transition-all">
                  View PDF <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Renewal Offer (High Emphasis) */}
        <div className="lg:col-span-5">
          <section className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20 sticky top-24">
            <div className="flex items-center gap-2 text-blue-200 mb-4">
              <ShieldCheck size={20} />
              <span className="text-sm font-bold uppercase tracking-wider">Renewal Ready</span>
            </div>
            <h3 className="font-bold text-2xl mb-4">Renew your lease</h3>
            <p className="text-blue-100 mb-8 leading-relaxed">
              Continue your stay at {propertyName} for another year. New rate is <strong>₱{renewalRate.toLocaleString()}/mo</strong>. Everything stays the same, just e-sign to lock in your spot.
            </p>
            
            <button className="w-full bg-white text-blue-700 rounded-2xl py-4 font-bold text-lg hover:bg-slate-50 transition-all active:scale-[0.98] shadow-lg mb-4">
              Review & e-sign
            </button>
            <p className="text-center text-blue-200 text-[11px]">
              Offer valid until {offerExpiry}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function LeaseDetail({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-slate-500">
        <div className="p-2 bg-slate-50 rounded-xl text-slate-400">{icon}</div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span className="text-slate-800 font-bold text-sm">{value}</span>
    </div>
  );
}