"use client";

import React, { useState, useEffect } from "react";
import { Clock, CheckCircle, MapPin, Wrench, ChevronRight, Activity, AlertCircle, Calendar } from "lucide-react";

export default function HomeTab({ profile, metrics, openProfileModal, tasks = [], setActiveTab }: any) {
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

  // Kukunin natin yung top 3 active tasks at i-paprioritize ang Urgent
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
            <div className="p-1 bg-blue-50 rounded-md text-blue-500 shrink-0">
              <Calendar size={12} strokeWidth={3} />
            </div>
            <span>{currentDate}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-[2.5rem] font-black tracking-tight leading-tight truncate text-transparent bg-clip-text bg-gradient-to-r from-[#0a1e3f] to-[#1e3a8a] pb-1">
            {greeting}, {profile.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 mt-0.5 md:mt-1 text-xs sm:text-sm font-medium truncate leading-relaxed max-w-lg">
            Here's your maintenance overview for today.
          </p>
        </div>
        
        <div 
          onClick={openProfileModal}
          className="w-14 h-14 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-emerald-100/50 text-[#359b46] flex items-center justify-center font-black text-xl md:text-2xl border border-emerald-200 shadow-[0_8px_16px_rgba(53,155,70,0.12)] cursor-pointer hover:shadow-[0_12px_24px_rgba(53,155,70,0.2)] hover:scale-105 hover:-rotate-3 active:scale-95 transition-all duration-300 shrink-0 ring-4 ring-white"
          title="View Profile Details"
        >
          {profile.initials}
        </div>
      </div>

      {/* 📊 METRICS CARDS - Polished Gradients & Shadows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        
        {/* Active Assigned */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-3xl p-6 border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-center transition-all duration-400 hover:shadow-[0_8px_30px_rgba(37,99,235,0.08)] hover:-translate-y-1 hover:border-blue-200 group relative overflow-hidden h-full">
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-slate-100 transition-transform duration-700 group-hover:scale-[1.2] group-hover:text-blue-50/80">
            <Activity size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-slate-100 text-slate-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm">
              <Activity size={24} />
            </div>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-4xl md:text-5xl font-black text-[#0a1e3f] tracking-tight group-hover:text-blue-600 transition-colors duration-300">{metrics.assigned}</p>
            <h3 className="text-slate-400 text-xs md:text-sm font-bold mt-1 uppercase tracking-wider">Active Assigned</h3>
          </div>
        </div>

        {/* Urgent Tasks */}
        <div className="bg-gradient-to-br from-white to-red-50/30 rounded-3xl p-6 border border-red-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden flex flex-col justify-center transition-all duration-400 hover:shadow-[0_8px_30px_rgba(220,38,38,0.12)] hover:-translate-y-1 hover:border-red-200 group h-full">
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
        <div className="bg-gradient-to-br from-[#359b46] to-[#277534] rounded-3xl p-6 border border-[#277534] shadow-[0_8px_20px_rgba(53,155,70,0.2)] relative overflow-hidden flex flex-col justify-center text-white transition-all duration-400 hover:shadow-[0_12px_30px_rgba(53,155,70,0.3)] hover:-translate-y-1 hover:from-[#3ca64e] hover:to-[#2b823a] group h-full">
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-white/5 transition-transform duration-700 group-hover:scale-[1.2] group-hover:rotate-6">
            <CheckCircle size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-md border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="relative z-10 mt-2">
            <p className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-sm">{metrics.doneThisWeek}</p>
            <h3 className="text-emerald-100 text-xs md:text-sm font-bold mt-1 uppercase tracking-wider">Done Tasks</h3>
          </div>
        </div>
      </div>

      {/* 🚀 UP NEXT SECTION */}
      <section className="bg-white rounded-[2rem] p-5 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-slate-100">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100/80 pb-5">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-2 h-7 bg-gradient-to-b from-[#359b46] to-emerald-300 rounded-full shadow-sm"></div>
            <h3 className="font-black text-lg sm:text-xl md:text-2xl text-[#0a1e3f] tracking-tight">Up Next For You</h3>
          </div>
          <button onClick={() => setActiveTab && setActiveTab('tasks')} className="text-xs font-bold text-[#359b46] hover:text-white hover:bg-[#359b46] px-4 py-2.5 rounded-xl transition-all hidden sm:flex items-center gap-1.5 group shadow-sm active:scale-95 border border-[#359b46]/20 hover:border-transparent">
            View all tasks <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" strokeWidth={3} />
          </button>
        </div>

        <div>
          {upNextTasks.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50 flex flex-col items-center justify-center transition-all hover:bg-slate-50 hover:border-slate-300">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center mb-5 shadow-inner text-[#359b46] border border-emerald-100/50">
                <CheckCircle size={36} className="sm:w-10 sm:h-10" />
              </div>
              <h4 className="text-lg md:text-xl text-[#0a1e3f] font-black tracking-tight">You're all caught up!</h4>
              <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium max-w-sm mx-auto leading-relaxed">Awesome work. You have no pending maintenance tasks on your plate right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-stretch">
              {upNextTasks.map((task: any) => (
                <div 
                  key={task.id} 
                  onClick={() => setActiveTab && setActiveTab('tasks')}
                  className={`group relative overflow-hidden rounded-[1.5rem] p-5 sm:p-6 flex flex-col h-full cursor-pointer transition-all duration-400 hover:-translate-y-1.5 active:scale-[0.98] ${
                    task.priority === 'Urgent' 
                      ? 'bg-white ring-1 ring-red-200 hover:ring-red-400 hover:shadow-[0_12px_30px_rgba(220,38,38,0.1)]' 
                      : 'bg-white ring-1 ring-slate-200/80 hover:ring-blue-400 hover:shadow-[0_12px_30px_rgba(37,99,235,0.08)]'
                  }`}
                >
                  {/* Subtle Background Gradient on Hover */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${task.priority === 'Urgent' ? 'bg-gradient-to-br from-white to-red-50/50' : 'bg-gradient-to-br from-white to-blue-50/30'}`} />

                  {/* Priority Indicator Dot/Stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${task.priority === 'Urgent' ? 'bg-gradient-to-b from-red-400 to-red-600' : 'bg-transparent group-hover:bg-gradient-to-b group-hover:from-blue-400 group-hover:to-blue-600 transition-colors'}`}></div>

                  <div className="pl-2 flex flex-col flex-1 relative z-10">
                    <div className="flex justify-between items-start mb-2.5 gap-3">
                      <h4 className={`font-black text-sm md:text-base leading-snug line-clamp-2 ${task.priority === 'Urgent' ? 'text-red-950' : 'text-[#0a1e3f] group-hover:text-blue-800 transition-colors'}`}>
                        {task.title}
                      </h4>
                      {task.priority === 'Urgent' && (
                        <span className="bg-red-50 text-red-600 ring-1 ring-red-200 text-[9px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider shrink-0 shadow-sm animate-pulse flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-500"></span> Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 font-semibold text-[11px] sm:text-xs mt-1 mb-5 flex items-center gap-1.5 truncate group-hover:text-slate-600 transition-colors">
                      <MapPin size={14} className={task.priority === 'Urgent' ? 'text-red-400' : 'text-slate-400 group-hover:text-[#359b46] transition-colors shrink-0'} />
                      <span className="truncate">{task.location}</span>
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between pl-2 relative z-10">
                    <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg ring-1 shadow-sm transition-colors ${
                      task.status === 'in_progress' 
                        ? 'bg-blue-50 text-blue-700 ring-blue-200/60 group-hover:bg-blue-100' 
                        : 'bg-slate-50 text-slate-500 ring-slate-200 group-hover:bg-white group-hover:ring-slate-300 group-hover:text-slate-700'
                    }`}>
                      {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                    
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
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
            className="w-full mt-6 sm:hidden bg-slate-50 text-[#0a1e3f] py-4 rounded-xl font-extrabold text-sm border border-slate-200 hover:bg-slate-100 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
          >
            View all your tasks <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        )}
      </section>

    </div>
  );
}