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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-6">
      
      {/* 🌟 PREMIUM HEADER SECTION */}
      <div className="flex justify-between items-start md:items-end mb-2 md:mb-6">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs sm:text-sm mb-1.5 font-medium">
            <Calendar size={14} className="text-blue-500" />
            <span>{currentDate}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-[#0a1e3f] tracking-tight leading-tight">
            {greeting}, {profile.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-slate-500 mt-2 text-sm md:text-base font-medium">Here's your maintenance overview for today.</p>
        </div>
        <div 
          onClick={openProfileModal}
          className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-50 text-[#359b46] flex items-center justify-center font-black text-lg md:text-xl border-2 border-emerald-100 shadow-sm cursor-pointer hover:bg-emerald-100 hover:scale-105 hover:rotate-3 active:scale-95 transition-all duration-300 shrink-0"
          title="View Profile Details"
        >
          {profile.initials}
        </div>
      </div>

      {/* 📊 METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        
        {/* Active Assigned */}
        <div className="bg-gradient-to-br from-white to-blue-50/50 rounded-3xl p-6 border border-blue-100/60 shadow-sm flex flex-col justify-center transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-100/50 text-blue-600 rounded-2xl group-hover:bg-blue-100 transition-colors">
              <Activity size={24} />
            </div>
          </div>
          <div>
            <p className="text-4xl font-black text-[#0a1e3f] tracking-tight">{metrics.assigned}</p>
            <h3 className="text-slate-500 text-sm font-bold mt-1">Active Assigned</h3>
          </div>
        </div>

        {/* Urgent Tasks */}
        <div className="bg-gradient-to-br from-red-50 to-white rounded-3xl p-6 border border-red-100/80 shadow-sm relative overflow-hidden flex flex-col justify-center transition-all duration-300 hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1 group">
          <div className="absolute -right-6 -top-6 text-red-500/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <AlertCircle size={140} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-red-100 text-red-600 rounded-2xl group-hover:animate-pulse shadow-inner shadow-red-200/50">
              <AlertCircle size={24} />
            </div>
            {metrics.dueToday > 0 && (
              <span className="flex h-3 w-3 relative mt-1 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>
          <div className="relative z-10">
            <p className="text-4xl font-black text-red-700 tracking-tight">{metrics.dueToday}</p>
            <h3 className="text-red-700/80 text-sm font-bold mt-1">Urgent Tasks</h3>
          </div>
        </div>

        {/* Done This Week */}
        <div className="bg-gradient-to-br from-[#359b46] to-[#277534] rounded-3xl p-6 border border-[#277534] shadow-md relative overflow-hidden flex flex-col justify-center text-white transition-all duration-300 hover:shadow-xl hover:shadow-emerald-900/20 hover:-translate-y-1 group">
          <div className="absolute -right-4 -bottom-4 text-white/10 transition-transform duration-500 group-hover:scale-110">
            <CheckCircle size={120} />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-sm border border-white/10">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-4xl font-black text-white tracking-tight">{metrics.doneThisWeek}</p>
            <h3 className="text-emerald-100 text-sm font-bold mt-1">Done this week</h3>
          </div>
        </div>
      </div>

      {/* 🚀 UP NEXT SECTION */}
      <section className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-[#359b46] rounded-full"></div>
            <h3 className="font-extrabold text-lg md:text-xl text-[#0a1e3f]">Up Next For You</h3>
          </div>
          <button onClick={() => setActiveTab && setActiveTab('tasks')} className="text-sm font-bold text-[#359b46] hover:text-[#277534] hover:bg-emerald-50 px-4 py-2 rounded-xl transition-all hidden sm:flex items-center gap-1 group">
            View all tasks <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div>
          {upNextTasks.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 shadow-inner text-[#359b46]">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-lg text-[#0a1e3f] font-extrabold">You're all caught up!</h4>
              <p className="text-sm text-slate-500 mt-2 font-medium max-w-xs mx-auto">Awesome work. You have no pending maintenance tasks on your plate right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {upNextTasks.map((task: any) => (
                <div 
                  key={task.id} 
                  onClick={() => setActiveTab && setActiveTab('tasks')}
                  className={`group relative overflow-hidden rounded-2xl p-5 border flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] ${
                    task.priority === 'Urgent' 
                      ? 'bg-gradient-to-br from-white to-red-50/30 border-red-200 hover:border-red-300' 
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {/* Priority Indicator Stripe on left */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.priority === 'Urgent' ? 'bg-red-500' : 'bg-transparent group-hover:bg-blue-400 transition-colors'}`}></div>

                  <div className="pl-1">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h4 className={`font-extrabold text-sm md:text-base leading-tight line-clamp-2 ${task.priority === 'Urgent' ? 'text-red-950' : 'text-[#0a1e3f] group-hover:text-blue-700 transition-colors'}`}>
                        {task.title}
                      </h4>
                      {task.priority === 'Urgent' && (
                        <span className="bg-red-100 text-red-700 border border-red-200/60 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 shadow-sm animate-pulse">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 font-semibold text-xs mt-1.5 flex items-center gap-1.5 truncate">
                      <MapPin size={12} className={task.priority === 'Urgent' ? 'text-red-400' : 'text-[#359b46]'} />
                      {task.location}
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between pl-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${
                      task.status === 'in_progress' 
                        ? 'bg-blue-50 text-blue-700 border-blue-200/60' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                    
                    {/* Hover Arrow Icon */}
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Mobile View All Button */}
        <button 
          onClick={() => setActiveTab && setActiveTab('tasks')} 
          className="w-full mt-6 sm:hidden bg-slate-50 text-[#0a1e3f] py-4 rounded-2xl font-extrabold text-sm border border-slate-200 active:bg-slate-100 flex items-center justify-center gap-2"
        >
          View all your tasks <ChevronRight size={16} />
        </button>
      </section>

    </div>
  );
}