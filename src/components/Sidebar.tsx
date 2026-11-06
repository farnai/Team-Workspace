"use client";

import React, { useState } from "react";
import {
  Home,
  Calendar,
  Layers,
  Archive,
  UserCheck,
  BarChart2,
  PieChart,
  History,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

export type NavView =
  | "overview"
  | "timeline"
  | "backlog"
  | "archive"
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
    completedThisMonth?: number;
    monthName?: string;
  };
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({
  currentView,
  onSelectView,
  isAdmin,
  metrics,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("team_workspace_sidebar_collapsed") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("team_workspace_sidebar_collapsed", String(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });
  };

  const navItems: {
    id: NavView;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    { id: "overview", label: "საწყისი", icon: <Home size={18} /> },
    { id: "timeline", label: "თაიმლაინი", icon: <Calendar size={18} /> },
    { id: "backlog", label: "ბექლოგი", icon: <Layers size={18} /> },
    { id: "archive", label: "არქივი", icon: <Archive size={18} /> },
    { id: "my-work", label: "ჩემი სამუშაოები", icon: <UserCheck size={18} /> },
    { id: "workload", label: "დატვირთვა", icon: <BarChart2 size={18} /> },
    { id: "reports", label: "რეპორტები", icon: <PieChart size={18} /> },
    { id: "activity-log", label: "ლოგი / ისტორია", icon: <History size={18} /> },
    { id: "users", label: "მომხმარებლები", icon: <Users size={18} />, adminOnly: true },
    { id: "settings", label: "პარამეტრები", icon: <Settings size={18} />, adminOnly: true },
  ];

  const handleItemClick = (id: NavView) => {
    onSelectView(id);
    if (onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-2xs"
        />
      )}

      {/* Main Sidebar Component */}
      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-40 md:z-auto
          h-full flex flex-col justify-between shrink-0 select-none
          bg-stone-50/70 border-r border-stone-200/80 overflow-y-auto min-h-0
          transition-all duration-200 ease-in-out
          ${
            isMobileOpen
              ? "translate-x-0 w-64 p-4 shadow-xl"
              : "-translate-x-full md:translate-x-0"
          }
          ${
            isCollapsed
              ? "md:w-16 md:p-2.5"
              : "md:w-56 md:p-4"
          }
        `}
      >
        <div className="space-y-3">
          {/* Top Collapse Toggle Bar */}
          <div
            className={`hidden md:flex items-center ${
              isCollapsed ? "justify-center" : "justify-between px-1"
            } pb-1`}
          >
            {!isCollapsed && (
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                ნავიგაცია
              </span>
            )}
            <button
              id="sidebar-toggle-btn"
              data-testid="sidebar-toggle-btn"
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
              title={isCollapsed ? "მენიუს გაშლა (Expand)" : "მენიუს აკეცვა (Collapse)"}
              aria-label={isCollapsed ? "მენიუს გაშლა" : "მენიუს აკეცვა"}
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isCollapsed
                      ? "justify-center px-2 py-2.5"
                      : "gap-3 px-3.5 py-2.5"
                  } ${
                    isActive
                      ? "bg-orange-50 text-orange-600 shadow-2xs font-bold"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70"
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      isActive ? "text-orange-600" : "text-stone-400"
                    }`}
                  >
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Monthly Summary Card */}
        {!isCollapsed ? (
          <div className="bg-white/90 backdrop-blur-xs border border-stone-200/90 rounded-2xl p-4 shadow-2xs mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-800 tracking-tight mb-3">
              <span>თვის შეჯამება</span>
              <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                {metrics.monthName || "ნოემბერი"}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>აქტიური ტასკები</span>
                </div>
                <span className="font-bold text-stone-900">
                  {metrics.activeCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>გადაცილებული</span>
                </div>
                <span className="font-bold text-rose-600">
                  {metrics.overdueCount}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-600">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>დასრულებული (ამ თვეში)</span>
                </div>
                <span className="font-bold text-stone-900">
                  {metrics.completedThisMonth ?? metrics.completedLast7Days}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2 border-t border-stone-200/80 mt-2">
            <div
              className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-bold cursor-pointer"
              title={`თვის აქტიური ტასკები: ${metrics.activeCount}`}
            >
              {metrics.activeCount}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
