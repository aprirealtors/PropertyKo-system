"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Eye, EyeOff, ShieldCheck, ArrowRight, Mail, Lock, Building2, Users, LayoutDashboard } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. SIGN IN VIA SUPABASE AUTH
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (authError) {
        setErrorMsg("Incorrect email or password. Please try again.");
        setLoading(false);
        return; 
      }

      const userRole = authData.user?.user_metadata?.role;

      // 2. FETCH MATCHING ORG DATA FROM DATABASE
      const { data: orgData, error: dbError } = await supabase
        .from('organizations')
        .select('*')
        .eq('admin_email', email)
        .single();

      if (dbError) {
        console.log("Not a registered organization admin, checking alternate roles...");
      }

      // 3. DYNAMIC ROUTING BASED ON ROLE
      if (email === "superadmin@propertyko.com") {
        router.push("/dashboard/superadmin");
      } 
      else if (userRole === "staff") {
        router.push("/dashboard/maintenance");
      } 
      else if (userRole === "property_manager") {
        router.push("/dashboard/manager"); 
      } 
      else if (userRole === "owner") {
        router.push("/dashboard/owner"); 
      }
      else if (userRole === "tenant") {
        router.push("/dashboard/tenants"); 
      }
      else {
        router.push("/dashboard/admin"); 
      }

    } catch (error: any) {
      console.error(error);
      setErrorMsg("An error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans text-slate-900 selection:bg-[#359b46]/20 selection:text-[#0a1e3f]">
      
      {/* =========================================
          LEFT PANEL - BRANDING (Hidden on Mobile)
          ========================================= */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-900">
        {/* High-end architectural background with overlay */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 mix-blend-luminosity scale-105"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/30" />


        {/* Center Value Proposition */}
        <div className="relative z-10 max-w-lg py-8 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-semibold tracking-wide text-[#86c48f] uppercase mb-6 backdrop-blur-md">
            <ShieldCheck size={14} />
            Enterprise RBAC
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.15] mb-6 tracking-tight">
            One platform. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#359b46] to-[#86c48f]">
              Six distinct experiences.
            </span>
          </h1>
          
          <p className="text-slate-300 text-lg leading-relaxed mb-10">
            Intelligently adapting to your workflow. Super Admins, Admins, Managers, Maintenance, Owners, and Tenants see exactly what they need securely and efficiently.
          </p>

          {/* Minimalist Feature Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Building2 className="text-[#359b46] w-6 h-6" />
              <h3 className="text-white font-semibold text-sm">Unified Management</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Centralize all your properties and operations in one workspace.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Users className="text-[#359b46] w-6 h-6" />
              <h3 className="text-white font-semibold text-sm">Owner and Tenant Portals</h3>
              <p className="text-slate-400 text-xs leading-relaxed">Seamlessly connect with residents for payments and requests.</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs font-medium text-slate-500">
          <p>© {new Date().getFullYear()} PropertyKo Inc.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>

      {/* =========================================
          RIGHT PANEL - LOGIN FORM (Full width on Mobile)
          ========================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-6 sm:px-12 sm:py-8 lg:px-24 lg:py-12 bg-white relative overflow-hidden">
        
        

        <div className="w-full max-w-[420px] mt-16 lg:mt-0">
          {/* Header */}
          <div className="mb-10 text-center lg:text-left">

            {/* Logo */}
    <div className="flex justify-center mb-6">
      <div className="relative w-90 sm:w-94 h-36 sm:h-37">
        <Image
          src="/logoss.jpeg"
          fill
          alt="PropertyKo"
          className="object-contain"
          priority
        />
      </div>
    </div>

            <div className="w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-6 mx-auto lg:mx-0 shadow-sm">
              <LayoutDashboard className="text-[#359b46] w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Welcome back
            </h2>
            <p className="text-slate-500 text-sm">
              Enter your credentials to access your workspace.
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldCheck className="w-5 h-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 block">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#359b46] focus:ring-1 focus:ring-[#359b46] transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700 block">Password</label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#359b46] focus:ring-1 focus:ring-[#359b46] transition-all placeholder:text-slate-400 shadow-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[#0a1e3f] hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl transition-all text-sm shadow-md hover:shadow-lg flex justify-center items-center gap-2 group"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Secure Note */}
          <p className="mt-8 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-[#359b46]" />
            Secure, role-based access control enabled.
          </p>

          {/* Mobile Footer (Hidden on Desktop) */}
          <div className="lg:hidden mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-4 text-xs text-slate-500">
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-900 transition-colors">Terms of Service</a>
            </div>
            <p>© {new Date().getFullYear()} PropertyKo Inc.</p>
          </div>

        </div>
      </div>

    </div>
  );
}