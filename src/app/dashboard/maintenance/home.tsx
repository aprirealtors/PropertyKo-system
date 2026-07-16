"use client";

import React from "react";
import { Clock, CheckCircle, MapPin, Wrench, ChevronRight } from "lucide-react";

export default function HomeTab({ profile, metrics, openProfileModal, tasks = [], setActiveTab }: any) {
  
  // Kukunin natin yung top 3 active tasks at i-paprioritize ang Urgent
  const upNextTasks = tasks
    .filter((t: any) => t.status === 'pending' || t.status === 'in_progress')
    .sort((a: any, b: any) => (a.priority === 'Urgent' ? -1 : 1))
    .slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-end mb-4 md:mb-8">
        <div>
          <p className="text-slate-500 text-sm md:text-base">Welcome back,</p>
          <h2 className="text-2xl md:text-[28px] font-extrabold text-[#0a1e3f] tracking-tight leading-tight">
            {profile.name} 👋
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-[15px]">Here's a quick look at your tasks for today.</p>
        </div>
        <div 
          onClick={openProfileModal}
          className="w-12 h-12 rounded-full bg-emerald-50 text-[#359b46] flex items-center justify-center font-bold text-lg border border-emerald-100 shadow-sm cursor-pointer hover:bg-emerald-100 transition-colors shrink-0"
          title="View Profile Details"
        >
          {profile.initials}
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
          <h3 className="text-slate-500 text-sm font-medium mb-2">Total Active Assigned</h3>
          <p className="text-4xl font-black text-[#0a1e3f]">{metrics.assigned}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-6 border border-red-100 shadow-sm relative overflow-hidden flex flex-col justify-center transition-all hover:shadow-md">
          <div className="absolute top-0 right-0 p-3 opacity-10 text-red-500"><Clock size={64}/></div>
          <h3 className="text-red-700 text-sm font-bold mb-2">Urgent Tasks</h3>
          <p className="text-4xl font-black text-red-700 relative z-10">{metrics.dueToday}</p>
        </div>
        <div className="bg-[#359b46] rounded-2xl p-6 shadow-md relative overflow-hidden flex flex-col justify-center text-white transition-all hover:shadow-lg">
          <div className="absolute top-0 right-0 p-3 opacity-20 text-white"><CheckCircle size={64}/></div>
          <h3 className="text-emerald-100 text-sm font-bold mb-2">Done this week</h3>
          <p className="text-4xl font-black relative z-10">{metrics.doneThisWeek}</p>
        </div>
      </div>

      {/* UP NEXT SECTION */}
      <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">Up Next</h3>
          <button onClick={() => setActiveTab && setActiveTab('tasks')} className="text-sm font-semibold text-[#359b46] hover:underline hidden sm:block">
            View all tasks
          </button>
        </div>

        <div className="space-y-4">
          {upNextTasks.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <CheckCircle className="mx-auto mb-2 text-emerald-400" size={32} />
              <p className="text-sm text-slate-600 font-bold">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">You have no pending tasks right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upNextTasks.map((task: any) => (
                <div 
                  key={task.id} 
                  onClick={() => setActiveTab && setActiveTab('tasks')}
                  className={`rounded-2xl p-4 border flex flex-col gap-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${
                    task.priority === 'Urgent' ? 'bg-red-50/30 border-red-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h4 className={`font-bold text-sm leading-tight line-clamp-1 ${task.priority === 'Urgent' ? 'text-red-900' : 'text-[#0a1e3f]'}`}>
                        {task.title}
                      </h4>
                      {task.priority === 'Urgent' && (
                        <span className="bg-red-100 text-red-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 animate-pulse">
                          Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 font-medium text-xs mt-1 truncate">
                      <MapPin size={12} className="inline mr-1 -mt-0.5 text-[#359b46]" />
                      {task.location}
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-3 border-t border-slate-200/60 flex items-center justify-between">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                    <Wrench size={14} className="text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Mobile View All Button */}
        <button 
          onClick={() => setActiveTab && setActiveTab('tasks')} 
          className="w-full mt-4 sm:hidden bg-emerald-50 text-[#359b46] py-3 rounded-xl font-bold text-sm border border-emerald-100 active:bg-emerald-100"
        >
          View all tasks
        </button>
      </section>

    </div>
  );
}