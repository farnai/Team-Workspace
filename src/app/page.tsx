"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header, HeaderNotification } from "@/components/Header";
import { Sidebar, NavView } from "@/components/Sidebar";
import { VerticalTimeline, TimelineDateItem } from "@/components/VerticalTimeline";
import type { BacklogTask } from "@/components/SharedBacklog";
import { TaskModal, ProjectOption, UserOption } from "@/components/TaskModal";
import { TaskDetailsDrawer } from "@/components/TaskDetailsDrawer";
import { WorkloadDashboard } from "@/components/workload/WorkloadDashboard";
import { OverviewDashboard } from "@/components/overview/OverviewDashboard";
import { MyWorkDashboard } from "@/components/my-work/MyWorkDashboard";
import { AdminUsersManagement } from "@/components/admin/AdminUsersManagement";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { ArchiveView } from "@/components/archive/ArchiveView";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ReportsDashboard } from "@/components/reports/ReportsDashboard";
import { ActivityLogDashboard } from "@/components/audit/ActivityLogDashboard";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { TaskStatus } from "@prisma/client";
import { format } from "date-fns";
import { getTbilisiTodayDate } from "@/lib/dateUtils";
import {
  Loader2,
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
  completedThisMonth?: number;
  monthName?: string;
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
          "projects",
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
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (typeof window !== "undefined") {
      return getTbilisiTodayDate();
    }
    return new Date("2026-11-05T00:00:00Z");
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [workloadRefreshKey, setWorkloadRefreshKey] = useState(0);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Projects & Users State
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Backlog & Modals State
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTaskDefaultProjectId, setCreateTaskDefaultProjectId] = useState<string | undefined>(undefined);
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
        // Step 1: Verify authentication first before fetching sensitive workspace data
        const userRes = await fetch("/api/auth/me");

        if (!userRes.ok) {
          document.cookie = "tw_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push("/login?error=unauthorized");
          return;
        }

        const userData = await userRes.json().catch(() => ({}));
        if (!userData.user) {
          document.cookie = "tw_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push("/login?error=unauthorized");
          return;
        }

        // Step 2: Fetch workspace data only after user identity is established
        const [metricsRes, notifRes, projRes, usersRes, tasksRes] =
          await Promise.all([
            fetch("/api/overview"),
            fetch("/api/notifications"),
            fetch("/api/projects"),
            fetch("/api/users"),
            fetch("/api/tasks"),
          ]);

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
        const dateParam = format(currentDate, "yyyy-MM-dd");
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

  // Browser History (Back / Forward) Navigation Listener
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const view = url.searchParams.get("view");
      const validViews: NavView[] = [
        "overview",
        "projects",
        "timeline",
        "backlog",
        "archive",
        "my-work",
        "workload",
        "reports",
        "activity-log",
        "users",
        "settings",
      ];
      if (view && validViews.includes(view as NavView)) {
        setCurrentView(view as NavView);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Global Ctrl+K / Cmd+K Search Hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const input = document.getElementById("global-search-input") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Refresh Projects
  const refreshProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error("Failed to refresh projects:", e);
    }
  };

  // Synchronization Callback when task is created or updated
  const handleTaskSaved = async () => {
    try {
      const dateParam = format(currentDate, "yyyy-MM-dd");
      const [tasksRes, timelineRes, metricsRes, projRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch(`/api/timeline?date=${dateParam}&mode=${timelineMode}&days=14`),
        fetch("/api/overview"),
        fetch("/api/projects"),
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
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data.projects || []);
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
      } else {
        const d = await res.json().catch(() => ({}));
        if (d?.error) {
          alert(d.error);
        }
      }
    } catch (e) {
      console.error("Failed to update task status:", e);
    }
  };

  // Delete Task Handler
  const handleTaskDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedTaskId === taskId) {
          setIsDrawerOpen(false);
          setSelectedTaskId(null);
        }
        await handleTaskSaved();
      }
    } catch (e) {
      console.error("Failed to delete task:", e);
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

  const handleOpenNewTask = (defaultProjectId?: unknown) => {
    const validProjectId = typeof defaultProjectId === "string" ? defaultProjectId : undefined;
    setCreateTaskDefaultProjectId(validProjectId);
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
                refreshKey={workloadRefreshKey}
                onOpenNewTask={handleOpenNewTask}
              />
            </div>
          ) : currentView === "projects" ? (
            <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full bg-[#F8F7F4]">
              <ProjectsView
                projects={projects}
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                onSelectTask={handleSelectTask}
                onOpenNewTask={handleOpenNewTask}
                onProjectsUpdated={refreshProjects}
                onNavigateToBacklog={(projectId) => {
                  setCurrentView("backlog");
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.set("view", "backlog");
                    if (projectId) url.searchParams.set("project", projectId);
                    window.history.pushState({}, "", url.toString());
                  }
                }}
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
          ) : currentView === "timeline" ? (
            <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full">
              {/* Dedicated Vertical Timeline (Full Width, Focused) */}
              <div className="w-full h-full flex flex-col overflow-hidden min-h-0">
                <VerticalTimeline
                  dates={timelineDates}
                  onSelectTask={handleSelectTask}
                  selectedTaskId={selectedTaskId}
                  mode={timelineMode}
                  onModeChange={setTimelineMode}
                  isLoading={isTimelineLoading}
                  onToggleBacklog={() => {
                    setCurrentView("backlog");
                    if (typeof window !== "undefined") {
                      const url = new URL(window.location.href);
                      url.searchParams.set("view", "backlog");
                      window.history.pushState({}, "", url.toString());
                    }
                  }}
                  isBacklogOpen={false}
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
                  onToday={() => setCurrentDate(getTbilisiTodayDate())}
                />
              </div>
            </div>
          ) : currentView === "backlog" ? (
            <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full">
              {/* Dedicated Kanban Board for Backlog */}
              <KanbanBoard
                tasks={tasks}
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                onOpenNewTask={handleOpenNewTask}
                onEditTask={handleEditTask}
                onStatusChange={handleStatusChange}
                onDeleteTask={handleTaskDelete}
                projects={projects}
                users={users}
                isAdmin={currentUser.role === "ADMIN"}
                externalSearchQuery={searchQuery}
                onNavigateToTimeline={() => {
                  setCurrentView("timeline");
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.set("view", "timeline");
                    window.history.pushState({}, "", url.toString());
                  }
                }}
              />
            </div>
          ) : currentView === "reports" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              {/* Dedicated Analytics & Reports Dashboard */}
              <ReportsDashboard
                tasks={tasks}
                projects={projects}
                users={users}
                onSelectTask={handleSelectTask}
              />
            </div>
          ) : currentView === "my-work" ? (
            <div className="flex-1 overflow-y-auto min-h-0 bg-stone-50/50">
              <MyWorkDashboard
                currentUserId={currentUser.id}
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                refreshKey={workloadRefreshKey}
              />
            </div>
          ) : currentView === "workload" ? (
            <div id="workload-scroll-container" className="flex-1 overflow-y-auto min-h-0 bg-[#F8F7F4]">
              <WorkloadDashboard
                onSelectTask={handleSelectTask}
                selectedTaskId={selectedTaskId}
                projects={projects}
                users={users}
                refreshKey={workloadRefreshKey}
              />
            </div>
          ) : currentView === "activity-log" ? (
            <div className="flex-1 flex overflow-hidden min-h-0 w-full h-full">
              <ActivityLogDashboard
                onSelectTask={handleSelectTask}
                users={users}
                currentUser={currentUser}
              />
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
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateTaskDefaultProjectId(undefined);
          }}
          onSuccess={handleTaskSaved}
          mode="create"
          currentUser={currentUser}
          projects={projects}
          users={users}
          defaultProjectId={createTaskDefaultProjectId}
          onProjectsUpdated={refreshProjects}
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
          projects={projects}
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
          onProjectsUpdated={refreshProjects}
        />
      )}
    </div>
  );
}
