"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, HeaderNotification } from "@/components/Header";
import { Sidebar, NavView } from "@/components/Sidebar";
import { VerticalTimeline, TimelineDateItem } from "@/components/VerticalTimeline";
import { SharedBacklog, BacklogTask } from "@/components/SharedBacklog";
import { TaskModal, ProjectOption, UserOption } from "@/components/TaskModal";
import { TaskDetailsDrawer } from "@/components/TaskDetailsDrawer";
import { WorkloadDashboard } from "@/components/workload/WorkloadDashboard";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { MyWorkDashboard } from "@/components/my-work/MyWorkDashboard";
import { AdminUsersManagement } from "@/components/admin/AdminUsersManagement";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { ArchiveView } from "@/components/archive/ArchiveView";
import { TaskStatus } from "@prisma/client";
import {
  Loader2,
  History,
} from "lucide-react";

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

export default function WorkspacePage({
  initialView,
}: {
  initialView?: NavView;
} = {}) {
  const router = useRouter();

  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Navigation & View State
  const [currentView, setCurrentView] = useState<NavView>(() => {
    if (initialView) return initialView;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (
        view &&
        [
          "overview",
          "timeline",
          "backlog",
          "archive",
          "my-work",
          "workload",
          "reports",
          "activity-log",
          "users",
          "settings",
        ].includes(view)
      ) {
        return view as NavView;
      }
    }
    return "timeline";
  });
  const [currentDate, setCurrentDate] = useState<Date>(
    () => new Date("2026-11-05T00:00:00Z")
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [workloadRefreshKey, setWorkloadRefreshKey] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Projects & Users State
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Backlog & Modals State
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [isBacklogOpen, setIsBacklogOpen] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<BacklogTask | null>(null);

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

  // Initial Load: Authenticate and Fetch Workspace Data
  useEffect(() => {
    let active = true;

    async function initializeWorkspace() {
      try {
        const [userRes, metricsRes, notifRes, projRes, usersRes, tasksRes] =
          await Promise.all([
            fetch("/api/auth/me"),
            fetch("/api/overview"),
            fetch("/api/notifications"),
            fetch("/api/projects"),
            fetch("/api/users"),
            fetch("/api/tasks"),
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

          if (metricsRes.ok) {
            const m = await metricsRes.json();
            if (m.metrics) setMetrics(m.metrics);
          }

          if (notifRes.ok) {
            const n = await notifRes.json();
            setNotifications(n.notifications || []);
            setUnreadCount(n.unreadCount || 0);
          }

          if (projRes.ok) {
            const p = await projRes.json();
            setProjects(p.projects || []);
          }

          if (usersRes.ok) {
            const u = await usersRes.json();
            setUsers(u.users || []);
          }

          if (tasksRes.ok) {
            const t = await tasksRes.json();
            setTasks(t.tasks || []);
          }
        }
      } catch {
        if (active) {
          router.push("/login");
          setIsAuthLoading(false);
        }
      }
    }

    initializeWorkspace();
    return () => {
      active = false;
    };
  }, [router]);

  // Load Timeline when date or mode changes
  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    async function loadTimeline() {
      setIsTimelineLoading(true);
      try {
        const dateParam = currentDate.toISOString().split("T")[0];
        const res = await fetch(
          `/api/timeline?date=${dateParam}&mode=${timelineMode}&days=14`
        );
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
  }, [currentUser, currentDate, timelineMode]);

  // Refresh Notifications
  const refreshNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error("Failed to refresh notifications:", e);
    }
  };

  // Synchronization Callback when task is created or updated
  const handleTaskSaved = async () => {
    try {
      const dateParam = currentDate.toISOString().split("T")[0];
      const [tasksRes, timelineRes, metricsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch(`/api/timeline?date=${dateParam}&mode=${timelineMode}&days=14`),
        fetch("/api/overview"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimelineDates(data.dates || []);
      }
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        if (data.metrics) setMetrics(data.metrics);
      }
      setWorkloadRefreshKey((k) => k + 1);
      refreshNotifications();
    } catch (e) {
      console.error("Failed to refresh workspace data:", e);
    }
  };

  // Quick Status Transition from Backlog Card
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await handleTaskSaved();
      }
    } catch (e) {
      console.error("Failed to update task status:", e);
    }
  };

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
    setIsCreateModalOpen(true);
  };

  const handleEditTask = (task: BacklogTask) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsDrawerOpen(true);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F7F4]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-orange-600" />
          <span className="text-xs font-semibold text-stone-600">
            იტვირთება სამუშაო სივრცე...
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="h-screen h-[100dvh] flex flex-col bg-[#F8F7F4] overflow-hidden">
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
        onSelectTask={handleSelectTask}
        onRefreshNotifications={refreshNotifications}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
      />

      {/* Main Workspace: Sidebar + Workspace Panels */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => {
            setCurrentView(view);
            if (view === "backlog") {
              setIsBacklogOpen(true);
            }
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("view", view);
              window.history.pushState({}, "", url.toString());
            }
          }}
          isAdmin={currentUser.role === "ADMIN"}
          metrics={metrics}
          isMobileOpen={isMobileSidebarOpen}
          onMobileClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* View Content Area */}
        <main className="flex-1 flex overflow-hidden min-h-0">
          {currentView === "overview" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <OverviewDashboard
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                projects={projects}
                users={users}
                onOpenNewTask={handleOpenNewTask}
              />
            </div>
          ) : currentView === "archive" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <ArchiveView
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                projects={projects}
                users={users}
                onTaskReopened={handleTaskSaved}
              />
            </div>
          ) : currentView === "timeline" || currentView === "backlog" ? (
            <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full">
              {/* Center Panel: Vertical Timeline (~65-68% when Backlog is open, 100% when collapsed) */}
              <div
                className={`h-full flex flex-col transition-all duration-200 overflow-hidden min-h-0 ${
                  isBacklogOpen ? "w-full lg:w-[65%] xl:w-[68%]" : "w-full"
                }`}
              >
                <VerticalTimeline
                  dates={timelineDates}
                  onSelectTask={handleSelectTask}
                  selectedTaskId={selectedTaskId}
                  mode={timelineMode}
                  onModeChange={setTimelineMode}
                  isLoading={isTimelineLoading}
                  onToggleBacklog={() => setIsBacklogOpen(true)}
                  isBacklogOpen={isBacklogOpen}
                  currentDate={currentDate}
                  onDateChange={setCurrentDate}
                  onPrev={() => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() - 7);
                    setCurrentDate(d);
                  }}
                  onNext={() => {
                    const d = new Date(currentDate);
                    d.setDate(d.getDate() + 7);
                    setCurrentDate(d);
                  }}
                  onToday={() => setCurrentDate(new Date())}
                />
              </div>

              {/* Right Panel: Shared Backlog (~32-35% on Desktop, hidden when collapsed) */}
              {isBacklogOpen && (
                <div className="hidden lg:flex lg:w-[35%] xl:w-[32%] h-full flex-col shrink-0 overflow-hidden animate-in slide-in-from-right-3 duration-200">
                  <SharedBacklog
                    tasks={tasks}
                    onSelectTask={handleSelectTask}
                    selectedTaskId={selectedTaskId}
                    onOpenNewTask={handleOpenNewTask}
                    onEditTask={handleEditTask}
                    onStatusChange={handleStatusChange}
                    onClose={() => setIsBacklogOpen(false)}
                    projects={projects}
                    users={users}
                    isAdmin={currentUser.role === "ADMIN"}
                  />
                </div>
              )}
            </div>
          ) : currentView === "my-work" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <MyWorkDashboard
                currentUserId={currentUser.id}
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
              />
            </div>
          ) : currentView === "workload" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <WorkloadDashboard
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                projects={projects}
                users={users}
                refreshKey={workloadRefreshKey}
              />
            </div>
          ) : currentView === "activity-log" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white min-h-0">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 mb-4">
                <History size={28} />
              </div>
              <h3 className="text-sm font-bold text-stone-900">ლოგი / ისტორია</h3>
              <p className="text-xs text-stone-500 max-w-xs mt-1">
                სრული აუდიტის ჟურნალის ეკრანი დაინერგება შემდგომ ეტაპზე.
              </p>
            </div>
          ) : currentView === "users" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <AdminUsersManagement currentAdminId={currentUser.id} />
            </div>
          ) : currentView === "settings" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <CalendarSettings />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <OverviewDashboard
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                projects={projects}
                users={users}
                onOpenNewTask={handleOpenNewTask}
              />
            </div>
          )}
        </main>
      </div>

      {/* Task Creation Modal */}
      {isCreateModalOpen && (
        <TaskModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleTaskSaved}
          mode="create"
          currentUser={currentUser}
          projects={projects}
          users={users}
        />
      )}

      {/* Task Details Drawer */}
      {isDrawerOpen && selectedTaskId && (
        <TaskDetailsDrawer
          taskId={selectedTaskId}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedTaskId(null);
          }}
          onTaskUpdated={handleTaskSaved}
          currentUser={currentUser}
          users={users}
        />
      )}

      {/* Task Quick Edit Modal */}
      {isEditModalOpen && (
        <TaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          onSuccess={handleTaskSaved}
          mode="edit"
          initialTask={editingTask}
          currentUser={currentUser}
          projects={projects}
          users={users}
        />
      )}
    </div>
  );
}
