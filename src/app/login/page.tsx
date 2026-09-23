"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Mail,
  Lock,
  Building2,
  Users,
  UserCheck,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  // State to track if user is on a subdomain
  const [isSubdomain, setIsSubdomain] = useState(false);

  // Detect Subdomain on mount
  useEffect(() => {
    const hostname = window.location.hostname;
    const isMain = hostname === "propertyko.com" || hostname === "www.propertyko.com" || hostname === "localhost";
    
    if (!isMain) {
      setIsSubdomain(true);
    }
  }, []);

  // floating error toast
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => {
        setErrorMsg(null);
      }, 7000); 
      
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // INITIAL SESSION CHECK
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      setTimeout(async () => {
        if (session?.user) {
          const userRole = session.user.user_metadata?.role;
          const userEmail = session.user.email;
          
          const { data: orgData } = await supabase
            .from("organizations")
            .select("subdomain, org_name")
            .eq("admin_email", userEmail)
            .single();
            
          const hostname = window.location.hostname;
          const isMainDomain = hostname === "propertyko.com" || hostname === "www.propertyko.com" || hostname === "localhost";
          const isLocal = hostname.includes("localhost");
          const protocol = isLocal ? "http://" : "https://";
          const baseDomain = isLocal ? "localhost:3000" : "propertyko.com";

          // CROSS-TENANT SECURITY CHECK
          let currentSubdomain = null;
          if (!isMainDomain) {
            currentSubdomain = hostname.replace(`.${baseDomain.split(':')[0]}`, "");
          }

          // 🚨 IF SUPERADMIN HAS SESSION BUT IS ON SUBDOMAIN -> BOOT TO MAIN DOMAIN
          if (userEmail === "superadmin@propertyko.com" && currentSubdomain) {
            window.location.href = `${protocol}${baseDomain}/dashboard/superadmin`;
            return;
          }

          // IF REGULAR USER ON WRONG SUBDOMAIN -> BOOT TO THEIR CORRECT SUBDOMAIN
          if (
            currentSubdomain && 
            orgData?.subdomain && 
            currentSubdomain !== orgData.subdomain 
          ) {
            window.location.href = `${protocol}${orgData.subdomain}.${baseDomain}/dashboard/admin`;
            return;
          }

          if (userEmail === "superadmin@propertyko.com") {
            router.push("/dashboard/superadmin");
          } else {
            let routePath = "/dashboard/admin";
            if (userRole === "staff") routePath = "/dashboard/maintenance";
            else if (userRole === "property_manager") routePath = "/dashboard/manager";
            else if (userRole === "owner") routePath = "/dashboard/owner";
            else if (userRole === "tenant") routePath = "/dashboard/tenants";

            if (isMainDomain && orgData?.subdomain) {
              window.location.href = `${protocol}${orgData.subdomain}.${baseDomain}${routePath}`;
            } else {
              router.push(routePath);
            }
          }
        } else {
          setIsPageLoading(false);
        }
      }, 2000);
    };
    
    checkSession();
  }, [router]);

  // HANDLE LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. SIGN IN VIA SUPABASE AUTH
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        setErrorMsg("Incorrect email or password. Please try again.");
        setLoading(false);
        return;
      }

      const userRole = authData.user?.user_metadata?.role;
      const userEmail = authData.user?.email;

      // 2. FETCH MATCHING ORG DATA FROM DATABASE
      const { data: orgData, error: dbError } = await supabase
        .from("organizations")
        .select("*")
        .eq("admin_email", userEmail)
        .single();

      if (dbError) {
        console.log("Not a registered organization admin, checking alternate roles...");
      }

      // 3. CROSS-TENANT SECURITY CHECK
      const hostname = window.location.hostname;
      const isMainDomain = hostname === "propertyko.com" || hostname === "www.propertyko.com" || hostname === "localhost";
      const isLocal = hostname.includes("localhost");
      const protocol = isLocal ? "http://" : "https://";
      const baseDomain = isLocal ? "localhost:3000" : "propertyko.com";

      let currentSubdomain = null;
      if (!isMainDomain) {
        currentSubdomain = hostname.replace(`.${baseDomain.split(':')[0]}`, "");
      }

      // 🚨 BLOCK SUPER ADMIN FROM SUBDOMAIN LOGINS
      if (userEmail === "superadmin@propertyko.com" && currentSubdomain) {
        await supabase.auth.signOut();
        setErrorMsg(`Super Admins cannot log in from a workspace. Please visit ${baseDomain} to access your dashboard.`);
        setLoading(false);
        return;
      }

      // BLOCK USERS TRYING TO LOGIN TO THE WRONG ORGANIZATION'S SUBDOMAIN
      if (
        currentSubdomain && 
        orgData?.subdomain && 
        currentSubdomain !== orgData.subdomain 
      ) {
        await supabase.auth.signOut();
        setErrorMsg(`Unauthorized access. This email is registered to the "${orgData.org_name}" workspace. Please visit ${orgData.subdomain}.${baseDomain} to log in.`);
        setLoading(false);
        return;
      }

      // 4. DYNAMIC ROUTING BASED ON ROLE & DOMAIN
      if (userEmail === "superadmin@propertyko.com") {
        router.push("/dashboard/superadmin");
      } else {
        let routePath = "/dashboard/admin";
        if (userRole === "staff") routePath = "/dashboard/maintenance";
        else if (userRole === "property_manager") routePath = "/dashboard/manager";
        else if (userRole === "owner") routePath = "/dashboard/owner";
        else if (userRole === "tenant") routePath = "/dashboard/tenants";

        if (isMainDomain && orgData?.subdomain) {
          window.location.href = `${protocol}${orgData.subdomain}.${baseDomain}${routePath}`;
        } else {
          router.push(routePath);
        }
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg("An error occurred during login. Please try again.");
      setLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white font-sans fixed inset-0 z-[100] animate-in fade-in duration-300">
        <div className="relative w-48 sm:w-56 h-20 sm:h-24 mb-8 animate-in zoom-in-95 duration-700 ease-out">
          <Image
            src="/logo.jpeg"
            fill
            alt="PropertyKo Loading"
            className="object-contain"
            priority
          />
        </div>
        <div className="w-10 h-10 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-white font-sans text-slate-900 selection:bg-[#359b46]/20 selection:text-[#0a1e3f]">
      {/* =========================================
          LEFT PANEL - BRANDING (Hidden on Mobile)
          ========================================= */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-900">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-40 mix-blend-luminosity scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?q=80&w=2075&auto=format&fit=crop')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/30" />

        {/* Hide Desktop Back Button if on Subdomain */}
        <div className="relative z-10 h-10">
          {!isSubdomain && (
            <Link 
              href="/"
              title="Back to home"
              className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white transition-all group rounded-full hover:bg-white/10 backdrop-blur-sm border border-transparent hover:border-white/20 active:scale-95 shadow-sm"
            >
              <ArrowRight size={18} strokeWidth={2.5} className="rotate-180 transition-transform" />
            </Link>
          )}
        </div>

        <div className="relative z-10 max-w-lg py-8 mb-10">
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
            Intelligently adapting to your workflow. Super Admins, Admins,
            Managers, Maintenance, Owners, and Tenants see exactly what they
            need securely and efficiently.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <Building2 className="text-[#359b46] w-6 h-6" />
              <h3 className="text-white font-semibold text-sm">
                Unified Management
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Centralize all your properties and operations in one workspace.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Users className="text-[#359b46] w-6 h-6" />
              <h3 className="text-white font-semibold text-sm">
                Owner and Tenant Portals
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Seamlessly connect with residents for payments and requests.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs font-medium text-slate-500">
          <p>© {new Date().getFullYear()} PropertyKo </p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>

      {/* =========================================
          RIGHT PANEL - LOGIN FORM
          ========================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center px-6 py-6 sm:px-12 sm:py-8 lg:px-24 lg:py-12 bg-[var(--color-bg,#ffffff)] relative overflow-hidden">
        
        {/* Hide Mobile Back Button if on Subdomain */}
        {!isSubdomain && (
          <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20 lg:hidden">
            <Link 
              href="/"
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all group rounded-full hover:bg-slate-100 backdrop-blur-sm border border-transparent hover:border-slate-200 active:scale-95 shadow-sm"
            >
              <ArrowRight size={16} strokeWidth={2.5} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
          </div>
        )}

        <div className="w-full max-w-[420px] mt-12 lg:mt-0 relative z-10">
          <div className="mb-5 text-center lg:text-left">
            <div className="flex justify-center mb-6">
              <div className="relative w-90 sm:w-94 h-36 sm:h-37">
                <Image
                  src="/propertyko-logo.png"
                  fill
                  alt="PropertyKo-logo"
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <div className="flex items-center justify-center lg:justify-start mb-3 lg:ml-16">
              <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                <UserCheck className="text-[var(--color-text)] w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--color-text)" }}>
                Welcome back
              </h2>
            </div>
            <p className="text-sm opacity-70" style={{ color: "var(--color-text)" }}>
              Enter your credentials to access your workspace.
            </p>
          </div>

          {errorMsg && (
            <div className="absolute top-6 sm:top-10 left-1/2 -translate-x-1/2 w-[90%] max-w-[380px] z-50 p-4 bg-red-50 text-red-700 text-sm font-bold rounded-2xl border border-red-200 shadow-[0_8px_30px_rgba(239,68,68,0.15)] flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <ShieldCheck className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold opacity-90 block" style={{ color: "var(--color-text)" }}>
                Email Address:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-50" style={{ color: "var(--color-text)" }}>
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all shadow-[var(--shadow-inner)] placeholder-opacity-40"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold opacity-90 block" style={{ color: "var(--color-text)" }}>
                  Password:
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none opacity-50" style={{ color: "var(--color-text)" }}>
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 rounded-[var(--radius-lg)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all shadow-[var(--shadow-inner)] placeholder-opacity-40"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center opacity-50 hover:opacity-100 transition-opacity focus:outline-none"
                  style={{ color: "var(--color-text)" }}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-primary-text)] font-semibold py-3.5 rounded-[var(--radius-lg)] transition-all text-sm shadow-[var(--shadow-md)] hover:shadow-[var(--shadow-lg)] flex justify-center items-center gap-2 group border border-transparent"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Authenticating...
                </span>
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs opacity-60 flex items-center justify-center gap-1.5" style={{ color: "var(--color-text)" }}>
            <ShieldCheck size={14} style={{ color: "var(--color-text)" }} />
            Secure, role-based access control enabled.
          </p>

          <div className="lg:hidden pt-4 flex flex-col items-center gap-4 text-xs opacity-60" style={{ color: "var(--color-text)" }}>
            <div className="flex gap-4">
              <a href="#" className="hover:opacity-100 transition-opacity">
                Privacy Policy
              </a>
              <a href="#" className="hover:opacity-100 transition-opacity">
                Terms of Service
              </a>
            </div>
            <p>© {new Date().getFullYear()} PropertyKo </p>
          </div>
        </div>
      </div>
    </div>
  );
}