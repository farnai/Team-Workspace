"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  LogOut,
  Shield,
  Menu,
} from "lucide-react";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

export interface HeaderNotification {
  id: string;
  taskId?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
}

interface HeaderProps {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER";
    avatarUrl?: string | null;
  } | null;
  onOpenNewTask: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
  onLogout: () => void;
  notifications: HeaderNotification[];
  unreadCount: number;
  onSelectTask?: (taskId: string) => void;
  onRefreshNotifications?: () => void;
  onToggleMobileSidebar?: () => void;
}

export function Header({
  currentUser,
  onOpenNewTask,
  searchQuery,
  onSearchChange,
  currentDate,
  onDateChange,
  onLogout,
  notifications,
  unreadCount,
  onSelectTask,
  onRefreshNotifications,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleNotificationClick = async (n: HeaderNotification) => {
    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
        if (onRefreshNotifications) onRefreshNotifications();
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }
    if (n.taskId && onSelectTask) {
      onSelectTask(n.taskId);
      setShowNotifications(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications", { method: "POST" });
      if (onRefreshNotifications) onRefreshNotifications();
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    onDateChange(d);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    onDateChange(d);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  return (
    <header className="h-16 border-b border-stone-200/80 bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0">
      {/* Left: Brand Logo & Mobile Menu Toggle */}
      <div className="flex items-center gap-3 sm:gap-8">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 -ml-1 text-stone-600 hover:text-stone-900 rounded-lg md:hidden cursor-pointer"
            title="მენიუს გახსნა"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleToday}>
          {/* Dual leaf terracotta brand icon */}
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" opacity="0.3" />
              <path d="M7 14c0-3.87 3.13-7 7-7 1.66 0 3.18.58 4.39 1.55l-9.84 9.84C7.58 17.18 7 15.66 7 14zm10-4c0 3.87-3.13 7-7 7-1.66 0-3.18-.58-4.39-1.55l9.84-9.84C16.42 6.82 17 8.34 17 10z" />
            </svg>
          </div>
          <span className="text-[17px] font-bold tracking-tight text-stone-900">
            Team Workspace
          </span>
        </div>

        {/* Date Navigator: < დღეს • 4 ნოე, 2026 > */}
        <div className="flex items-center gap-1.5 bg-stone-100/80 hover:bg-stone-100 px-2 py-1 rounded-full text-xs font-medium text-stone-700 transition-colors">
          <button
            onClick={handlePrevDay}
            className="p-1 hover:bg-white rounded-full transition-colors text-stone-500 hover:text-stone-900"
            title="წინა დღე"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-0.5 hover:text-orange-600 transition-colors flex items-center gap-1"
          >
            <span className="font-semibold text-stone-900">დღეს</span>
            <span className="text-stone-400">•</span>
            <span>
              {formatGeorgianDateShort(currentDate)}, {currentDate.getFullYear()}
            </span>
          </button>
          <button
            onClick={handleNextDay}
            className="p-1 hover:bg-white rounded-full transition-colors text-stone-500 hover:text-stone-900"
            title="შემდეგი დღე"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 max-w-md mx-8 relative">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ძებნა (ტასკი, ადამიანი, ID...)"
            className="w-full pl-9 pr-14 py-2 bg-stone-50/80 border border-stone-200/90 rounded-full text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
          <kbd className="absolute right-3 px-1.5 py-0.5 text-[10px] font-semibold text-stone-400 bg-white border border-stone-200 rounded shadow-2xs">
            Ctrl K
          </kbd>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* + ახალი ტასკი Button */}
        <button
          onClick={onOpenNewTask}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-full shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>ახალი ტასკი</span>
        </button>

        {/* Notifications Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-600 transition-colors relative cursor-pointer"
            title="შეტყობინებები"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-600 ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-200/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">შეტყობინებები</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-[10px] bg-orange-100 text-orange-700 font-semibold rounded-full">
                      {unreadCount} ახალი
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-medium transition-colors"
                  >
                    ყველას წაკითხვა
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-stone-100/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-400">
                    შეტყობინებები არ არის
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`px-4 py-3 hover:bg-stone-50 transition-colors cursor-pointer ${
                        !n.isRead ? "bg-orange-50/40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-stone-900">{n.title}</span>
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-600 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">{n.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        {currentUser ? (
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-orange-100 ring-2 ring-stone-200/80 flex items-center justify-center text-orange-700 font-bold text-xs">
                {currentUser.avatarUrl ? (
                  <Image
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-stone-900 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-stone-400 font-medium">
                  {currentUser.role === "ADMIN" ? "Admin" : "User"}
                </div>
              </div>
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-200/80 py-2 z-50">
                <div className="px-4 py-2 border-b border-stone-100">
                  <div className="text-xs font-bold text-stone-900">{currentUser.name}</div>
                  <div className="text-[11px] text-stone-400 truncate">{currentUser.email}</div>
                  <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] font-medium">
                    <Shield size={10} />
                    {currentUser.role}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>გამოსვლა</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <a
            href="/login"
            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-xs font-semibold text-stone-800 transition-colors"
          >
            შესვლა
          </a>
        )}
      </div>
    </header>
  );
}
