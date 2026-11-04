"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, HeaderNotification } from "@/components/Header";
import { Sidebar, NavView } from "@/components/Sidebar";
import { VerticalTimeline, TimelineDateItem } from "@/components/VerticalTimeline";
import { Loader2, Layers, Calendar, BarChart2, UserCheck, History, Users, Settings } from "lucide-react";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  avatarUrl?: string | null;
}

interface OverviewMetrics {
  activeCount: number;
  overdueCount: number;
  completedLast7Days: number;
}

export default function WorkspacePage() {
  const router = useRouter();

  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Navigation & View State
  const [currentView, setCurrentView] = useState<NavView>("timeline");
  const [currentDate, setCurrentDate] = useState<Date>(new Date("2026-11-04T00:00:00Z"));
  const [searchQuery, setSearchQuery] = useState("");

  // Notifications & Metrics
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    activeCount: 0,
    overdueCount: 0,
    completedLast7Days: 0,
  });

  // Timeline Data State
  const [timelineDates, setTimelineDates] = useState<TimelineDateItem[]>([]);
  const [timelineMode, setTimelineMode] = useState<"schedule" | "activity">("schedule");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadWorkspaceData() {
      try {
        const [userRes, metricsRes, notifRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/overview"),
          fetch("/api/notifications"),
        ]);

        if (!userRes.ok) {
          router.push("/login");
          return;
        }

        const userData = await userRes.json();
        if (!userData.user) {
          router.push("/login");
          return;
        }

        if (active) {
          setCurrentUser(userData.user);
          setIsAuthLoading(false);
        }

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          if (active && metricsData.metrics) {
            setMetrics(metricsData.metrics);
          }
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (active) {
            setNotifications(notifData.notifications || []);
            setUnreadCount(notifData.unreadCount || 0);
          }
        }
      } catch {
        if (active) {
          router.push("/login");
          setIsAuthLoading(false);
        }
      }
    }

    loadWorkspaceData();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!currentUser || currentView !== "timeline") return;

    let active = true;
    async function loadTimeline() {
      setIsTimelineLoading(true);
      try {
        const dateParam = currentDate.toISOString().split("T")[0];
        const res = await fetch(`/api/timeline?date=${dateParam}&mode=${timelineMode}&days=14`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setTimelineDates(data.dates || []);
          }
        }
      } catch (e) {
        console.error("Failed to load timeline:", e);
      } finally {
        if (active) {
          setIsTimelineLoading(false);
        }
      }
    }

    loadTimeline();
    return () => {
      active = false;
    };
  }, [currentUser, currentView, currentDate, timelineMode]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      router.push("/login");
      router.refresh();
    }
  };

  const handleOpenNewTask = () => {
    setCurrentView("backlog");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F7F4]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-orange-600" />
          <span className="text-xs font-semibold text-stone-600">იტვირთება სამუშაო სივრცე...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4]">
      {/* Global Application Header */}
      <Header
        currentUser={currentUser}
        onOpenNewTask={handleOpenNewTask}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        onLogout={handleLogout}
        notifications={notifications}
        unreadCount={unreadCount}
      />

      {/* Main Workspace: Sidebar + Center Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          isAdmin={currentUser.role === "ADMIN"}
          metrics={metrics}
        />

        {/* View Content Area */}
        <main className="flex-1 flex overflow-hidden">
          {currentView === "timeline" ? (
            <VerticalTimeline
              dates={timelineDates}
              onSelectTask={setSelectedTaskId}
              selectedTaskId={selectedTaskId}
              mode={timelineMode}
              onModeChange={setTimelineMode}
              isLoading={isTimelineLoading}
            />
          ) : currentView === "backlog" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600 mb-4">
                <Layers size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                საერთო ბექლოგი (Shared Backlog)
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mt-1.5 leading-relaxed">
                ბექლოგის სრული UI კომპონენტი, ფილტრები და სწრაფი შექმნის ფორმა რეალიზდება მომდევნო ეტაპზე (Step 3).
              </p>
              <button
                onClick={() => setCurrentView("timeline")}
                className="mt-5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-full transition-colors cursor-pointer"
              >
                თაიმლაინზე დაბრუნება
              </button>
            </div>
          ) : currentView === "my-work" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <UserCheck size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">ჩემი სამუშაოები</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                პერსონალური სამუშაო დაფა დაინერგება შემდგომ ეტაპზე.
              </p>
            </div>
          ) : currentView === "workload" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <BarChart2 size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">გუნდის დატვირთვა</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                დატვირთვისა და სიმძლავრის ეკრანი დაინერგება Step 7-ში.
              </p>
            </div>
          ) : currentView === "activity-log" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <History size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">ლოგი / ისტორია</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                სრული აუდიტის ჟურნალის ეკრანი დაინერგება შემდგომ ეტაპზე.
              </p>
            </div>
          ) : currentView === "users" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <Users size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">მომხმარებლები (ადმინი)</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                მომხმარებლების მართვის ადმინ-პანელი.
              </p>
            </div>
          ) : currentView === "settings" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <Settings size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">სისტემის პარამეტრები</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                სამუშაო კალენდრისა და უქმეების მართვა.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <Calendar size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">საწყისი მიმოხილვა</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                მიმოხილვის დაფა დაინერგება Step 8-ში.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
