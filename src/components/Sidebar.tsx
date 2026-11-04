"use client";

import React from "react";
import {
  Home,
  Calendar,
  Layers,
  UserCheck,
  BarChart2,
  PieChart,
  History,
  Users,
  Settings,
} from "lucide-react";

export type NavView =
  | "overview"
  | "timeline"
  | "backlog"
  | "my-work"
  | "workload"
  | "reports"
  | "activity-log"
  | "users"
  | "settings";

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  isAdmin: boolean;
  metrics: {
    activeCount: number;
    overdueCount: number;
    completedLast7Days: number;
  };
}

export function Sidebar({
  currentView,
  onSelectView,
  isAdmin,
  metrics,
}: SidebarProps) {
  const navItems: { id: NavView; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: "overview", label: "საწყისი", icon: <Home size={18} /> },
    { id: "timeline", label: "თაიმლაინი", icon: <Calendar size={18} /> },
    { id: "backlog", label: "ბექლოგი", icon: <Layers size={18} /> },
    { id: "my-work", label: "ჩემი სამუშაოები", icon: <UserCheck size={18} /> },
    { id: "workload", label: "დატვირთვა", icon: <BarChart2 size={18} /> },
    { id: "reports", label: "რეპორტები", icon: <PieChart size={18} /> },
    { id: "activity-log", label: "ლოგი / ისტორია", icon: <History size={18} /> },
    { id: "users", label: "მომხმარებლები", icon: <Users size={18} />, adminOnly: true },
    { id: "settings", label: "პარამეტრები", icon: <Settings size={18} />, adminOnly: true },
  ];

  return (
    <aside className="w-56 bg-stone-50/60 border-r border-stone-200/80 p-4 flex flex-col justify-between shrink-0 select-none">
      {/* Top Navigation Links */}
      <nav className="space-y-1">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-orange-50 text-orange-600 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70"
              }`}
            >
              <span className={isActive ? "text-orange-600" : "text-stone-400"}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Summary Card (ძირითადი შეჯამება) */}
      <div className="bg-white/80 backdrop-blur-xs border border-stone-200/90 rounded-2xl p-4 shadow-2xs">
        <div className="text-[11px] font-bold text-stone-800 tracking-tight mb-3">
          ძირითადი შეჯამება
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stone-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>აქტიური ტასკები</span>
            </div>
            <span className="font-bold text-stone-900">{metrics.activeCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stone-600">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>გადაცილებული</span>
            </div>
            <span className="font-bold text-rose-600">{metrics.overdueCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stone-600">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              <span>დასრულებული (7 დღე)</span>
            </div>
            <span className="font-bold text-stone-900">{metrics.completedLast7Days}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
