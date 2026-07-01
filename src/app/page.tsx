"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Star, Settings, Grid, Wrench, Diamond, Square, Eye, EyeOff } from "lucide-react";

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

      // ✨ FIX: Handle error gracefully instead of throwing it, so we don't trigger the red dev overlay
      if (authError) {
        setErrorMsg("Incorrect email or password. Please try again.");
        setLoading(false);
        return; // Stop the function here
      }

      // Extract the role from the user's metadata
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

      console.log("Logged in successfully!", {
        user: authData.user?.email,
        role: userRole || "Admin/Owner",
        organization: orgData?.org_name || "Platform Staff"
      });

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
      // Route to the newly created tenants folder
      else if (userRole === "tenant") {
        router.push("/dashboard/tenants"); 
      }
      // Default fallback for Organization Admins
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
    <>
      {/* Top Navigation Bar */}
      <nav className="w-full bg-white px-6 py-3 flex items-center justify-between shadow-sm border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative w-50 h-15">
            <Image 
              src="/logos.png" 
              alt="PropertyKo Logo" 
              fill 
              className="object-contain object-left" 
              priority
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-slate-50 overflow-hidden">
        <div className="max-w-5xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-100">
          
          {/* Left Panel - Information */}
          <div className="bg-[#0a1e3f] text-white p-6 md:p-10 w-full md:w-5/12 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#359b46] blur-3xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex justify-center mb-6">
                <div className="inline-block bg-white p-2.5 rounded-xl shadow-lg">
                  <div className="relative w-48 h-12">
                    <Image
                      src="/logos.png"
                      alt="PropertyKo Logo"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              </div>
              
              <h3 className="text-xl md:text-2xl font-semibold mb-6 leading-snug text-white">
                One platform, six doors in each person sees only what they need.
              </h3>

              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <Star className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Super admin</span> - runs the platform & client orgs</div>
                </li>
                <li className="flex items-start gap-3">
                  <Settings className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Admin</span> - owns company account & subscription</div>
                </li>
                <li className="flex items-start gap-3">
                  <Grid className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Property manager</span> - properties, leases & collections</div>
                </li>
                <li className="flex items-start gap-3">
                  <Wrench className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Staff</span> - caretaker & maintenance tasks</div>
                </li>
                <li className="flex items-start gap-3">
                  <Diamond className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Owner</span> - landlord portal</div>
                </li>
                <li className="flex items-start gap-3">
                  <Square className="text-[#359b46] shrink-0 mt-0.5" size={18} />
                  <div><span className="font-bold text-white">Tenant</span> - pay rent, request repairs, view lease</div>
                </li>
              </ul>
            </div>

            <div className="mt-8 text-xs text-slate-400 font-medium relative z-10">
              PropertyKo.com - Role-Based Access Control (RBAC)
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="bg-white p-6 md:p-10 w-full md:w-7/12 flex items-center">
            <div className="max-w-md w-full mx-auto">
              <h2 className="text-3xl font-bold text-[#0a1e3f] mb-1">Sign in</h2>
              <p className="text-slate-500 text-sm mb-6">Welcome back to your PropertyKo workspace.</p>

              {/* Error Message Display */}
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] focus:border-transparent text-sm transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#359b46] focus:border-transparent text-sm transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#359b46] hover:bg-[#2c813a] disabled:bg-[#86c48f] text-white font-medium py-2.5 rounded-lg transition-colors text-sm shadow-sm flex justify-center items-center"
                  >
                    {loading ? "Verifying..." : "Sign in to account"}
                  </button>
                </div>
              </form>

              {/* Clean Divider */}
              <div className="relative flex items-center py-5">
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              {/* Quick-Access Helper Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <RoleButton icon={<Star size={16} />} title="Super admin" subtitle="platform owner" onClick={() => { setEmail("superadmin@propertyko.com"); setPassword("password123"); }} />
                <RoleButton icon={<Settings size={16} />} title="Admin" subtitle="company account" placeholder="Enter custom org email above" />
                <RoleButton icon={<Grid size={16} />} title="Property manager" subtitle="day-to-day ops" placeholder="Enter custom manager email above" />
                <RoleButton icon={<Wrench size={16} />} title="Staff" subtitle="caretaker tasks" placeholder="Enter custom staff email above" />
                <RoleButton icon={<Diamond size={16} />} title="Owner" subtitle="landlord portal" placeholder="Enter custom owner email above" />
                <RoleButton icon={<Square size={16} />} title="Tenant" subtitle="resident app" placeholder="Enter custom tenant email above" />
              </div>

            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// Reusable component for the role buttons
function RoleButton({ icon, title, subtitle, onClick, placeholder }: { icon: React.ReactNode; title: string; subtitle: string; onClick?: () => void; placeholder?: string }) {
  return (
    <button 
      type="button" 
      onClick={onClick} 
      title={placeholder}
      className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-[#359b46] hover:bg-[#f0f9f1] transition-all text-left group shadow-sm hover:shadow-md w-full"
    >
      <div className="text-[#359b46] bg-[#f0f9f1] p-1.5 rounded-lg group-hover:bg-white transition-colors shrink-0">
        {icon}
      </div>
      <div className="truncate">
        <div className="text-sm font-bold text-[#0a1e3f] truncate">{title}</div>
        <div className="text-[11px] text-slate-500 font-medium truncate">{onClick ? subtitle : placeholder || subtitle}</div>
      </div>
    </button>
  );
}