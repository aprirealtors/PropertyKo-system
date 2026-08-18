"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  Building2, 
  Users, 
  ShieldCheck, 
  LayoutDashboard, 
  Wrench,
  Cloud, // Added for digital transition
  MonitorSmartphone, // Added for digital transition
  Zap // Added for digital transition
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] w-full bg-[#f8fafc] flex flex-col font-sans text-slate-900 selection:bg-[#359b46]/20 selection:text-[#0a1e3f] overflow-x-hidden relative">
      
      {/* 🌟 PREMIUM NAVIGATION BAR */}
      <nav className="w-full px-4 sm:px-6 py-4 flex justify-between items-center bg-white/90 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="relative w-36 h-8 sm:w-48 sm:h-10">
          <Image 
            src="/heading.png" 
            alt="PropertyKo Logo" 
            fill 
            className="object-contain" 
            priority
          />
        </div>
        <Link
          href="/login"
          className="bg-[#0a1e3f] hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2 group"
        >
          Login
        </Link>
      </nav>

      {/* 🌟 HERO SECTION */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-32 flex flex-col items-center text-center w-full">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#359b46]/10 border border-[#359b46]/20 text-[10px] sm:text-xs font-black tracking-widest text-[#359b46] uppercase mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-sm">
          <ShieldCheck size={14} strokeWidth={2.5} />
          Enterprise Property Management
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight mb-6 text-[#0a1e3f] leading-[1.1] animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          Manage your properties <br className="hidden md:block" />
          with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#359b46] to-[#86c48f]">absolute confidence.</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-500 font-medium max-w-2xl mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          PropertyKo is the unified platform for seamless real estate operations. Intelligently adapting to your role-whether you are an admin, manager, owner, or tenant.
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <Link
            href="/login"
            className="bg-gradient-to-r from-[#359b46] to-[#277534] hover:from-[#2c813a] hover:to-[#1e5c28] text-white px-8 py-4 rounded-2xl font-black text-sm sm:text-base transition-all shadow-lg shadow-emerald-900/20 active:scale-95 flex items-center gap-2 group border border-[#359b46]"
          >
            Go to Workspace Login
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
          </Link>
        </div>
      </main>

      {/* 🌟 PREMIUM FEATURES SECTION */}
      <section className="bg-white py-20 border-t border-slate-200/60 flex-1 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0a1e3f] mb-4 tracking-tight">One platform. Six distinct experiences.</h2>
            <p className="text-slate-500 font-medium text-sm sm:text-base">Tailored dashboards for everyone involved in your property ecosystem.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<LayoutDashboard className="text-[#359b46]" size={28} strokeWidth={2} />}
              title="Admin & Managers"
              description="Centralize operations, track leases, and manage finances from a powerful command center."
            />
            <FeatureCard 
              icon={<Users className="text-[#359b46]" size={28} strokeWidth={2} />}
              title="Tenant Portal"
              description="Give residents an easy way to pay rent, submit requests, and communicate instantly."
            />
            <FeatureCard 
              icon={<Building2 className="text-[#359b46]" size={28} strokeWidth={2} />}
              title="Owner Dashboard"
              description="Provide property owners with transparent reporting and portfolio performance metrics."
            />
            <FeatureCard 
              icon={<Wrench className="text-[#359b46]" size={28} strokeWidth={2} />}
              title="Maintenance Staff"
              description="Streamline work orders and track repairs efficiently through dedicated staff tools."
            />
          </div>
        </div>
      </section>

      {/* 🌟 WHY CHOOSE US SECTION (Traditional to Digital Focus) */}
      <section className="bg-[#f8fafc] py-20 border-t border-slate-200/60 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="w-full lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0a1e3f]/5 border border-[#0a1e3f]/10 text-[10px] sm:text-xs font-black tracking-widest text-[#0a1e3f] uppercase mb-6 shadow-sm">
                Traditional to Digital
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0a1e3f] mb-6 tracking-tight leading-[1.1]">
                Bring your property management <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#359b46] to-[#86c48f]">into the digital age.</span>
              </h2>
              <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed mb-10">
                Tired of endless spreadsheets, physical ledgers, and lost paper receipts? PropertyKo transforms traditional, manual real estate operations into a seamless, web-based digital experience.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[1rem] bg-white shadow-sm border border-slate-200/60 flex items-center justify-center shrink-0">
                    <Cloud className="text-[#359b46]" size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#0a1e3f] text-base sm:text-lg mb-1 tracking-tight">Move to the Cloud</h4>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">Transition from vulnerable physical files and offline spreadsheets to a secure, centralized online database.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[1rem] bg-white shadow-sm border border-slate-200/60 flex items-center justify-center shrink-0">
                    <MonitorSmartphone className="text-[#359b46]" size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#0a1e3f] text-base sm:text-lg mb-1 tracking-tight">Manage Anywhere</h4>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">Your entire property business is now just a website away. Access your data securely from any desktop or mobile device.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-[1rem] bg-white shadow-sm border border-slate-200/60 flex items-center justify-center shrink-0">
                    <Zap className="text-[#359b46]" size={22} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-black text-[#0a1e3f] text-base sm:text-lg mb-1 tracking-tight">Instant & Automated</h4>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">Replace slow manual calculations and traditional bank visits with automated online billing and digital reporting.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Visual Stats Card */}
            <div className="w-full lg:w-1/2 relative">
               <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 p-8 sm:p-10 relative overflow-hidden group hover:shadow-[0_8px_30px_rgb(53,155,70,0.1)] transition-all duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#359b46]/10 to-transparent rounded-bl-full transition-transform duration-500 group-hover:scale-110" />
                  <div className="relative z-10">
                    <h3 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] mb-3 tracking-tight">The Digital Advantage</h3>
                    <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed">Modernize your business overnight. Moving online reduces administrative overhead and eliminates the friction of traditional property management.</p>
                    
                    <div className="grid grid-cols-2 gap-5">
                       <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 text-center hover:bg-white hover:shadow-md transition-all duration-300">
                         <div className="text-4xl sm:text-5xl font-black text-[#359b46] mb-2">100%</div>
                         <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Paperless Setup</div>
                       </div>
                       <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 text-center hover:bg-white hover:shadow-md transition-all duration-300">
                         <div className="text-4xl sm:text-5xl font-black text-[#359b46] mb-2">24/7</div>
                         <div className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Web Access</div>
                       </div>
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* 🌟 FOOTER */}
      <footer className="bg-[#0a1e3f] border-t border-white/10 text-slate-400 py-8 text-center text-xs sm:text-sm font-medium w-full shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-3">
          <p>
            © {new Date().getFullYear()} PropertyKo Inc. All rights reserved. Developed by{" "}
            <a 
              href="https://byteheads.dev/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:text-[#359b46] font-bold tracking-wide transition-colors"
            >
              Byteheads Corporation.
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// 🌟 PREMIUM FEATURE CARD COMPONENT
function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
      {/* Background Icon Watermark */}
      <div className="absolute -right-6 -bottom-6 text-slate-50 opacity-50 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 pointer-events-none">
        <div className="w-40 h-40 flex items-center justify-center scale-[2]">
          {icon}
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-6 shadow-inner group-hover:bg-[#359b46]/10 group-hover:border-[#359b46]/20 transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-[17px] sm:text-lg font-black text-[#0a1e3f] mb-3 tracking-tight group-hover:text-[#359b46] transition-colors">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}