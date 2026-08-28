"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Users,
  ShieldCheck,
  Wrench,
  BarChart2,
  CheckCircle2,
  Home,
  ArrowUp,
  Sparkles,
  Clock,
  Layers,
  Menu,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPage() {
  // 1️⃣ STATES
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [frontMockup, setFrontMockup] = useState<"desktop" | "phone">("phone");
  const [activeSection, setActiveSection] = useState<string>("");

  // 2️⃣ EFFECTS
  // Loader Effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to Top Effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Active Section Tracking (for nav highlight)
  useEffect(() => {
    const sectionIds = ["features", "solutions", "about"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // 3️⃣ CUSTOM FUNCTIONS
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    setIsMenuOpen(false);

    // Reflect the section in the URL without triggering a native jump
    window.history.pushState(null, "", `#${id}`);

    // Give the mobile dropdown a beat to start closing so its layout change
    // doesn't cancel the smooth-scroll animation before it starts
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // 4️⃣ EARLY RETURNS
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
        <div className="w-10 h-10 border-4 border-[#359b46]/20 border-t-[#359b46] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#f8fafc] flex flex-col font-sans text-slate-900 selection:bg-[#359b46]/20 selection:text-[#0a1e3f] overflow-x-hidden relative scroll-smooth">
      {/* 🌟 PREMIUM OVAL NAVIGATION BAR */}
      <div className="fixed top-4 inset-x-0 z-50 px-4 sm:px-6">
        <nav className="max-w-6xl mx-auto flex justify-between items-center gap-4 bg-white/90 backdrop-blur-md border border-slate-200/70 rounded-full shadow-[0_8px_30px_-8px_rgba(10,30,63,0.15)] px-4 sm:px-6 py-2.5">
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              scrollToTop();
              setActiveSection("");
              window.history.pushState(null, "", window.location.pathname);
            }}
            className="relative w-32 h-8 sm:w-40 sm:h-9 shrink-0"
          >
            <Image
              src="/heading.png"
              alt="PropertyKo Logo"
              fill
              className="object-contain object-left"
              priority
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-8 font-semibold text-slate-600 text-sm">
            <Link
              href="#features"
              onClick={(e) => handleNavClick(e, "features")}
              className={`transition-colors ${activeSection === "features" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
            >
              <motion.span whileTap={{ scale: 0.9 }} className="inline-block">
                Features
              </motion.span>
            </Link>
            <Link
              href="#solutions"
              onClick={(e) => handleNavClick(e, "solutions")}
              className={`transition-colors ${activeSection === "solutions" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
            >
              <motion.span whileTap={{ scale: 0.9 }} className="inline-block">
                Solutions
              </motion.span>
            </Link>
            <Link
              href="#about"
              onClick={(e) => handleNavClick(e, "about")}
              className={`transition-colors ${activeSection === "about" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
            >
              <motion.span whileTap={{ scale: 0.9 }} className="inline-block">
                About
              </motion.span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              href="/login"
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-5 sm:px-6 py-2 rounded-full font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95"
            >
              Login
            </Link>

            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-[#0a1e3f] active:scale-95 transition-all"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown Menu — only rendered while open, so it never reserves layout space when closed */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="lg:hidden max-w-6xl mx-auto mt-2 overflow-hidden"
            >
              <div className="bg-white/95 backdrop-blur-md border border-slate-200/70 rounded-2xl shadow-[0_8px_30px_-8px_rgba(10,30,63,0.15)] px-6 py-4 flex flex-col gap-1 font-semibold text-slate-600 text-sm">
                <Link
                  href="#features"
                  onClick={(e) => handleNavClick(e, "features")}
                  className={`py-2.5 transition-colors ${activeSection === "features" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
                >
                  Features
                </Link>
                <Link
                  href="#solutions"
                  onClick={(e) => handleNavClick(e, "solutions")}
                  className={`py-2.5 transition-colors ${activeSection === "solutions" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
                >
                  Solutions
                </Link>
                <Link
                  href="#about"
                  onClick={(e) => handleNavClick(e, "about")}
                  className={`py-2.5 transition-colors ${activeSection === "about" ? "text-[#359b46]" : "hover:text-[#359b46]"}`}
                >
                  About
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🌟 HERO SECTION */}
      <main id="top" className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-12 lg:pt-32 lg:pb-24 w-full overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          {/* Hero Text Content */}
          <div className="w-full lg:w-1/2 flex flex-col items-center text-center lg:items-start lg:text-left z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#359b46]/10 border border-[#359b46]/20 text-[10px] sm:text-xs font-bold tracking-widest text-[#359b46] uppercase mb-6"
            >
              <ShieldCheck size={14} strokeWidth={2.5} />
              ALL-IN-ONE PROPERTY MANAGEMENT
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight mb-6 text-[#0a1e3f] leading-[1.1]"
            >
              Smarter management.
              <br />
              <span className="text-[#359b46]">Better living.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-base sm:text-lg text-slate-500 font-medium max-w-lg mb-10 leading-relaxed"
            >
              PropertyKo helps you streamline operations, manage tenants and properties, and track everything in one powerful platform.
            </motion.p>

            {/* Checkmarks */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 w-full"
            >
              {["Easy to use", "Secure & Reliable", "Built for Teams"].map((text, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm"
                >
                  <CheckCircle2 size={16} className="text-[#359b46]" />
                  {text}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Hero Mockups Container (Desktop & Mobile combo) */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="w-full lg:w-1/2 relative mt-12 lg:mt-0 min-h-[400px] sm:min-h-[500px]"
          >
            {/* Background Blob for aesthetics */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-[#359b46]/5 to-[#0a1e3f]/5 rounded-full blur-3xl -z-10"></div>

            {/* Desktop Mockup */}
            <button
              type="button"
              onClick={() => setFrontMockup("desktop")}
              aria-label="Bring desktop preview to front"
              className={`absolute right-0 top-0 w-[92%] md:w-[88%] bg-white rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] border overflow-hidden text-left cursor-pointer transition-all duration-300 ${
                frontMockup === "desktop"
                  ? "z-30 border-[#359b46]/40 scale-[1.02]"
                  : "z-10 border-slate-200 opacity-90 hover:opacity-100"
              }`}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#359b46]"></span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/desktop.png"
                alt="PropertyKo Desktop Workspace"
                className="w-full h-auto block"
              />
            </button>

            {/* Phone Mockup */}
            <button
              type="button"
              onClick={() => setFrontMockup("phone")}
              aria-label="Bring phone preview to front"
              className={`absolute left-0 bottom-[-20px] sm:bottom-10 w-[45%] max-w-[220px] aspect-[9/19] bg-white rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border-[6px] overflow-hidden cursor-pointer transition-all duration-300 ${
                frontMockup === "phone"
                  ? "z-30 border-[#359b46]/40 ring-1 ring-[#359b46]/30 scale-[1.03]"
                  : "z-20 border-white ring-1 ring-slate-200 opacity-90 hover:opacity-100"
              }`}
            >
              <Image
                src="/phone.png"
                alt="PropertyKo Mobile App"
                fill
                className="object-cover"
                priority
              />
            </button>
          </motion.div>
        </div>
      </main>

      {/* 🌟 FEATURES GRID SECTION */}
      <section
        id="features"
        className="scroll-mt-28 bg-white py-24 border-t border-slate-200/60 w-full overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[50%] left-1/2 -translate-x-1/2 w-[200%] h-[100%] bg-[#f8fafc] rounded-b-[100%]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#359b46]/10 text-xs font-bold tracking-widest text-[#359b46] uppercase mb-4">
              POWERFUL FEATURES
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0a1e3f] mb-4 tracking-tight">
              Everything you need to manage properties
            </h2>
            <p className="text-slate-500 font-medium text-sm sm:text-base">
              Built to simplify your workflow and scale with your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              delay={0}
              icon={<Home className="text-[#359b46]" size={24} strokeWidth={2.5} />}
              title="Property Management"
              description="Easily manage buildings, units, and property details in one place."
            />
            <FeatureCard
              delay={0.1}
              icon={<Users className="text-[#359b46]" size={24} strokeWidth={2.5} />}
              title="Tenant Management"
              description="Keep tenant information, leases, and communication organized."
            />
            <FeatureCard
              delay={0.2}
              icon={<Wrench className="text-[#359b46]" size={24} strokeWidth={2.5} />}
              title="Maintenance Tracking"
              description="Track requests, schedule tasks, and ensure timely resolution."
            />
            <FeatureCard
              delay={0.3}
              icon={<BarChart2 className="text-[#359b46]" size={24} strokeWidth={2.5} />}
              title="Reports & Analytics"
              description="Get real-time insights and make smarter business decisions."
            />
          </div>
        </div>
      </section>

      {/* 🌟 SOLUTIONS SECTION */}
      <section
        id="solutions"
        className="scroll-mt-28 bg-[#f8fafc] py-24 border-t border-slate-200/60 w-full relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#359b46]/10 text-xs font-bold tracking-widest text-[#359b46] uppercase mb-4">
              SOLUTIONS
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0a1e3f] mb-4 tracking-tight">
              One platform, built for every portfolio
            </h2>
            <p className="text-slate-500 font-medium text-sm sm:text-base max-w-2xl mx-auto">
              Whether you manage a single building or a nationwide portfolio, PropertyKo adapts to how your team actually works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SolutionCard
              delay={0}
              icon={<Home className="text-[#359b46]" size={26} strokeWidth={2.5} />}
              title="Residential Landlords"
              description="Run day-to-day operations for apartments, condos, and rental homes without the spreadsheet chaos."
              points={["Automated rent collection", "Digital lease e-signing", "Tenant screening & applications"]}
            />
            <SolutionCard
              delay={0.1}
              icon={<Building2 className="text-[#359b46]" size={26} strokeWidth={2.5} />}
              title="Commercial Property Managers"
              description="Handle multi-tenant commercial buildings with lease complexity and CAM charges built in."
              points={["CAM & pass-through billing", "Lease clause tracking", "Vendor & contractor workflows"]}
            />
            <SolutionCard
              delay={0.2}
              icon={<ShieldCheck className="text-[#359b46]" size={26} strokeWidth={2.5} />}
              title="HOA & Community Associations"
              description="Give boards and residents a transparent, shared view of dues, rules, and requests."
              points={["Dues & assessment tracking", "Resident portal & voting", "Compliance document storage"]}
            />
            <SolutionCard
              delay={0.3}
              icon={<Layers className="text-[#359b46]" size={26} strokeWidth={2.5} />}
              title="Enterprise Portfolios"
              description="Scale across regions and teams with role-based access and consolidated reporting."
              points={["Multi-entity reporting", "Custom roles & permissions", "API & integrations"]}
            />
          </div>
        </div>
      </section>

      {/* 🌟 ABOUT SECTION */}
      <section id="about" className="scroll-mt-28 bg-white py-24 border-t border-slate-200/60 w-full relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row gap-14 items-center">
            {/* About Text */}
            <div className="w-full lg:w-1/2">
              <div className="inline-block px-4 py-1.5 rounded-full bg-[#359b46]/10 text-xs font-bold tracking-widest text-[#359b46] uppercase mb-4">
                ABOUT PROPERTYKO
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0a1e3f] mb-6 tracking-tight leading-tight">
                Built by property people, for property people
              </h2>
              <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed mb-4">
                PropertyKo started with a simple observation: property teams were juggling spreadsheets, group chats,
                and paper files just to keep operations running. We set out to bring it all into one workspace
                built with local property managers to fit how the industry actually works.
              </p>
              <p className="text-slate-500 font-medium text-sm sm:text-base leading-relaxed">
                Today, PropertyKo powers landlords, community associations, and enterprise portfolio teams who want
                fewer tools, faster answers, and happier tenants.
              </p>
            </div>

            {/* Stats Grid */}
            <div className="w-full lg:w-1/2 grid grid-cols-2 gap-4 sm:gap-6">
              <AboutStat
                icon={<Building2 className="text-[#359b46]" size={22} strokeWidth={2.5} />}
                value="500+"
                label="Properties managed"
              />
              <AboutStat
                icon={<Users className="text-[#359b46]" size={22} strokeWidth={2.5} />}
                value="50K+"
                label="Units & tenants tracked"
              />
              <AboutStat
                icon={<Clock className="text-[#359b46]" size={22} strokeWidth={2.5} />}
                value="99.9%"
                label="Platform uptime"
              />
              <AboutStat
                icon={<Sparkles className="text-[#359b46]" size={22} strokeWidth={2.5} />}
                value="24/7"
                label="Customer support"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 🌟 CTA BANNER */}
      <section className="w-full px-4 sm:px-6 py-16">
        <div className="max-w-6xl mx-auto bg-[#0a1e3f] rounded-3xl px-6 sm:px-12 py-14 sm:py-16 text-center relative overflow-hidden">
          <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[140%] aspect-square bg-[#359b46]/10 rounded-full blur-3xl pointer-events-none"></div>
          <h2 className="relative text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-4 tracking-tight">
            Ready to simplify your property operations?
          </h2>
          <p className="relative text-slate-300 font-medium text-sm sm:text-base max-w-xl mx-auto mb-8">
            Join the teams already running their portfolios on PropertyKo.
          </p>
          <div className="relative flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="bg-[#359b46] hover:bg-[#2c813a] text-white px-6 py-3.5 rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg active:scale-95 flex items-center gap-2 group"
            >
              Go to Workspace
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* 🌟 FOOTER */}
      <footer className="bg-[#0a1e3f] border-t border-white/10 text-slate-400 py-8 text-center text-xs sm:text-sm font-medium w-full shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center gap-2">
          <p>
            © {new Date().getFullYear()} PropertyKo. All rights reserved. Developed by{" "}
            <a
              href="https://byteheads.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-[#359b46] font-bold tracking-wide transition-colors"
            >
              Byteheads Corporation.
            </a>
          </p>
          <p className="text-slate-500">
  Curated by{" "}
  <a
    href="https://aprigroup.ph/"
    target="_blank"
    rel="noopener noreferrer"
    className="text-white hover:text-[#359b46] font-bold tracking-wide transition-colors"
  >
    APRI Management
  </a>
</p>
          <p className="text-slate-500">Property Management Consulting by AURA International</p>
        </div>
      </footer>

      {/* ✨ SCROLL TO TOP BUTTON */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[90] p-3 sm:p-4 rounded-full bg-[#359b46] hover:bg-[#2c813a] text-white shadow-[0_8px_30px_rgba(53,155,70,0.3)] transition-all duration-500 hover:-translate-y-2 active:scale-95 ${
          showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        }`}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} strokeWidth={2.5} />
      </button>
    </div>
  );
}

// 🌟 CLEAN FEATURE CARD COMPONENT
function FeatureCard({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: delay }}
      className="bg-white p-8 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
    >
      <div className="w-12 h-12 bg-[#359b46]/10 rounded-xl flex items-center justify-center mb-6">{icon}</div>
      <h3 className="text-lg font-black text-[#0a1e3f] mb-3 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
    </motion.div>
  );
}

// 🌟 SOLUTIONS CARD COMPONENT
function SolutionCard({
  icon,
  title,
  description,
  points,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  points: string[];
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: delay }}
      className="bg-white p-8 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full"
    >
      <div className="w-14 h-14 bg-[#359b46]/10 rounded-2xl flex items-center justify-center mb-6">{icon}</div>
      <h3 className="text-lg sm:text-xl font-black text-[#0a1e3f] mb-3 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">{description}</p>
      <ul className="mt-auto space-y-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">
            <CheckCircle2 size={16} className="text-[#359b46] shrink-0" />
            {point}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

// 🌟 ABOUT STAT COMPONENT
function AboutStat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="bg-[#f8fafc] p-6 rounded-2xl border border-slate-100 flex flex-col gap-3"
    >
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-black text-[#0a1e3f] tracking-tight">{value}</div>
        <div className="text-xs sm:text-sm text-slate-500 font-semibold">{label}</div>
      </div>
    </motion.div>
  );
}
