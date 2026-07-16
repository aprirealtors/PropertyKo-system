"use client";

import React from "react";
import { MessageSquare } from "lucide-react";

export default function MessagesTab() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-blue-50 text-[#1d82f5] rounded-full flex items-center justify-center mb-6">
        <MessageSquare size={40} />
      </div>
      <h2 className="text-2xl font-bold text-[#0a1e3f] mb-2">Messages Coming Soon</h2>
      <p className="text-slate-500 max-w-sm leading-relaxed">
        We are building a dedicated channel for you to easily communicate with property managers and tenants regarding repair schedules. Stay tuned!
      </p>
    </div>
  );
}