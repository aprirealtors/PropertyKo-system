"use client";

import React, { useState, useEffect } from "react";
import { Clock, CheckCircle, MapPin, Wrench, ChevronRight, Activity, AlertCircle, Calendar } from "lucide-react";

// ✨ SKELETON LOADER COMPONENT (Perfectly matches the Home UI)
export function HomeSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-8 max-w-7xl mx-auto px-1 sm:px-0">
      
      {/* Skeleton Header */}
      <div className="flex justify-between items-center mb-5 md:mb-8 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-6 h-6 bg-slate-200 rounded-md animate-pulse"></div>
            <div className="w-32 h-4 bg-slate-200 rounded animate-pulse"></div>
          </div>
          <div className="w-64 sm:w-80 h-10 sm:h-12 bg-slate-200 rounded-xl animate-pulse mb-3"></div>
          <div className="w-48 h-4 bg-slate-100 rounded animate-pulse"></div>
        </div>
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[var(--radius-lg)] bg-slate-200 animate-pulse shrink-0 ring-4 ring-white shadow-sm border border-slate-100"></div>
      </div>

      {/* Skeleton Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] h-[150px] animate-pulse flex flex-col justify-center">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl mb-4"></div>
            <div className="w-16 h-10 bg-slate-200 rounded-lg mb-2"></div>
            <div className="w-24 h-3 bg-slate-100 rounded mt-1"></div>
          </div>
        ))}
      </div>

      {/* Skeleton Up Next */}
      <section className="bg-white rounded-[1.5rem] p-5 md:p-8 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-6 pb-5">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-2 h-7 bg-slate-200 rounded-full animate-pulse"></div>
            <div className="w-40 h-7 bg-slate-200 rounded-lg animate-pulse"></div>
          </div>
          <div className="w-28 h-9 bg-slate-100 rounded-[var(--radius-md)] animate-pulse hidden sm:block"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-[var(--radius-lg)] p-5 sm:p-6 flex flex-col h-[180px] bg-slate-50 animate-pulse">
              <div className="w-3/4 h-5 bg-slate-200 rounded mb-3"></div>
              <div className="w-1/2 h-4 bg-slate-200 rounded mb-5"></div>
              <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="w-20 h-6 bg-slate-200 rounded"></div>
                <div className="w-8 h-8 rounded-full bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ✨ MAIN COMPONENT
// Note: Dinagdag ko ang `isLoading` prop dito.
export default function HomeTab({ profile, metrics, openProfileModal, tasks = [], setActiveTab, isLoading = false }: any) {
  const [greeting, setGreeting] = useState("Welcome back");
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    setCurrentDate(new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    }));
  }, []);

  // Kapag isLoading ay true, ibabato niya agad ang Skeleton Layout
  if (isLoading) {
    return <HomeSkeleton />;
  }

  const upNextTasks = tasks
    .filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
    .sort((a: any, b: any) => (a.priority === 'Urgent' ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-8 max-w-7xl mx-auto px-1 sm:px-0">
      
      {/* 🌟 ULTRA-PREMIUM HEADER SECTION */}
      <div className="flex justify-between items-center mb-5 md:mb-8 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] mb-1.5 sm:mb-2">
            <div className="p-1 bg-[var(--color-primary)]/10 rounded-md text-[var(--color-primary)] shrink-0">
              <Calendar size={12} strokeWidth={3} />
            </div>
            <span>{currentDate}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-[2.5rem] font-black tracking-tight leading-tight truncate text-[var(--color-secondary)] pb-1">
            <span className="text-slate-700">{greeting}</span>, {profile.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 mt-0.5 md:mt-1 text-xs sm:text-sm font-medium truncate leading-relaxed max-w-lg">
            Here's your maintenance overview for today.
          </p>
        </div>
        
        <div 
          onClick={openProfileModal}
          className="w-14 h-14 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[var(--radius-lg)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-black text-xl md:text-2xl border border-[var(--color-primary)]/20 shadow-sm cursor-pointer hover:shadow-md hover:scale-105 hover:-rotate-3 active:scale-95 transition-all duration-300 shrink-0 ring-4 ring-white"
          title="View Profile Details"
        >
          {profile.initials}
        </div>
      </div>

      {/* 📊 METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        
        {/* Active Assigned */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] flex flex-col justify-center transition-all duration-400 hover:shadow-md hover:-translate-y-1 hover:border-[var(--color-primary)]/40 group relative overflow-hidden h-full">
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[var(--color-primary)]/5 transition-transform duration-700 group-hover:scale-[1.2] group-hover:text-[var(--color-primary)]/10">
            <Activity size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-[var(--color-primary)]/5 text-[var(--color-primary)]/70 rounded-2xl group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] transition-all duration-300 shadow-[var(--shadow-sm)]">
              <Activity size={24} />
            </div>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-4xl md:text-5xl font-black text-[var(--color-secondary)] tracking-tight group-hover:text-[var(--color-primary)] transition-colors duration-300">{metrics.assigned}</p>
            <h3 className="text-slate-400 text-xs md:text-sm font-bold mt-1 uppercase tracking-wider">Active Assigned</h3>
          </div>
        </div>

        {/* Urgent Tasks (Semantic Red) */}
        <div className="bg-gradient-to-br from-white to-red-50/30 rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] relative overflow-hidden flex flex-col justify-center transition-all duration-400 hover:shadow-md hover:-translate-y-1 hover:border-red-200 group h-full">
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-red-50 transition-transform duration-700 group-hover:scale-[1.2] group-hover:-rotate-12 group-hover:text-red-100/80">
            <AlertCircle size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-sm">
              <AlertCircle size={24} />
            </div>
            {metrics.dueToday > 0 && (
              <span className="flex h-3.5 w-3.5 relative mt-1 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
              </span>
            )}
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-4xl md:text-5xl font-black text-red-600 tracking-tight">{metrics.dueToday}</p>
            <h3 className="text-red-400 text-xs md:text-sm font-bold mt-1 uppercase tracking-wider">Urgent Tasks</h3>
          </div>
        </div>

        {/* Done Tasks */}
        <div className="bg-[var(--color-primary)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-md)] relative overflow-hidden flex flex-col justify-center text-white transition-all duration-400 hover:shadow-lg hover:-translate-y-1 hover:opacity-90 group h-full">
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-white/10 transition-transform duration-700 group-hover:scale-[1.2] group-hover:rotate-6">
            <CheckCircle size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-4xl md:text-5xl font-black text-[var(--color-primary-text)] tracking-tight drop-shadow-sm">{metrics.doneThisWeek}</p>
            <h3 className="text-[var(--color-primary-text)] opacity-80 text-xs md:text-sm font-bold mt-1 uppercase tracking-wider">Done Tasks</h3>
          </div>
        </div>
      </div>

      {/* 🚀 UP NEXT SECTION */}
      <section className="bg-white rounded-[1.5rem] p-5 md:p-8 shadow-[var(--shadow-sm)] border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6 border-b border-[var(--color-border)]/50 pb-5">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-2 h-7 bg-[var(--color-primary)] rounded-full shadow-sm"></div>
            <h3 className="font-black text-lg sm:text-xl md:text-2xl text-[var(--color-secondary)] tracking-tight">Up Next For You</h3>
          </div>
          <button onClick={() => setActiveTab && setActiveTab('tasks')} className="text-xs font-bold bg-[var(--color-primary)] text-[var(--color-text)] hover:text-[var(--color-primary-text)] hover:bg-[var(--color-primary)] px-4 py-2.5 rounded-[var(--radius-md)] transition-all hidden sm:flex items-center gap-1.5 group shadow-[var(--shadow-sm)] active:scale-95 border border-[var(--color-primary)]/20 hover:border-transparent">
            View All Tasks <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" strokeWidth={3} />
          </button>
        </div>

        <div>
          {upNextTasks.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-[var(--color-border)] rounded-[1.5rem] bg-slate-50/50 flex flex-col items-center justify-center transition-all hover:bg-slate-50 hover:border-[var(--color-primary)]/30">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-primary)]/10 rounded-[var(--radius-md)] flex items-center justify-center mb-5 shadow-inner text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                <CheckCircle size={36} className="sm:w-10 sm:h-10" />
              </div>
              <h4 className="text-lg md:text-xl text-[var(--color-secondary)] font-black tracking-tight">You're all caught up!</h4>
              <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium max-w-sm mx-auto leading-relaxed">Awesome work. You have no pending maintenance tasks on your plate right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
              {upNextTasks.map((task: any) => (
                <div 
                  key={task.id} 
                  onClick={() => setActiveTab && setActiveTab('tasks')}
                  className={`group relative overflow-hidden rounded-[var(--radius-lg)] p-5 sm:p-6 flex flex-col h-full cursor-pointer transition-all duration-400 hover:-translate-y-1.5 active:scale-[0.98] ${
                    task.priority === 'Urgent' 
                      ? 'bg-white border border-red-200 hover:border-red-400 hover:shadow-md' 
                      : 'bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 hover:shadow-md'
                  }`}
                >
                  {/* Subtle Background Gradient on Hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${task.priority === 'Urgent' ? 'bg-red-500' : 'bg-[var(--color-primary)]'}`} />

                  {/* Priority Indicator Stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${task.priority === 'Urgent' ? 'bg-red-500' : 'bg-transparent group-hover:bg-[var(--color-primary)]'}`}></div>

                  <div className="pl-2 flex flex-col flex-1 relative z-10">
                    <div className="flex justify-between items-start mb-2.5 gap-3">
                      <h4 className={`font-black text-sm md:text-base leading-snug line-clamp-2 transition-colors ${task.priority === 'Urgent' ? 'text-red-950' : 'text-[var(--color-secondary)] group-hover:text-[var(--color-primary)]'}`}>
                        {task.title}
                      </h4>
                      {task.priority === 'Urgent' && (
                        <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-black px-2.5 py-1 rounded-[var(--radius-sm)] uppercase tracking-wider shrink-0 shadow-sm animate-pulse flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500"></span> Urgent
                        </span>
                      )}
                    </div>
                    <p className={`text-slate-500 font-semibold text-[11px] sm:text-xs mt-1 mb-5 flex items-center gap-1.5 truncate transition-colors ${task.priority !== 'Urgent' ? 'group-hover:text-slate-600' : ''}`}>
                      <MapPin size={14} className={`shrink-0 transition-colors ${task.priority === 'Urgent' ? 'text-red-400' : 'text-slate-400 group-hover:text-[var(--color-primary)]'}`} />
                      <span className="truncate">{task.location}</span>
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-[var(--color-border)] flex items-center justify-between pl-2 relative z-10">
                    <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-[var(--radius-sm)] border shadow-[var(--shadow-sm)] transition-colors ${
                      task.status === 'in_progress' 
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' 
                        : 'bg-slate-50 text-slate-500 border-[var(--color-border)] group-hover:bg-white group-hover:border-slate-300 group-hover:text-[var(--color-text)]'
                    }`}>
                      {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                    
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[var(--color-primary)]/5 flex items-center justify-center text-[var(--color-primary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-text)] transition-all duration-300 shadow-sm shrink-0 border border-transparent">
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Mobile View All Button */}
        {upNextTasks.length > 0 && (
          <button 
            onClick={() => setActiveTab && setActiveTab('tasks')} 
            className="w-full mt-6 sm:hidden bg-white text-[var(--color-secondary)] py-4 rounded-[var(--radius-md)] font-extrabold text-sm border border-[var(--color-border)] hover:bg-[var(--color-bg)] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[var(--shadow-sm)]"
          >
            View all your tasks <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        )}
      </section>

    </div>
  );
}