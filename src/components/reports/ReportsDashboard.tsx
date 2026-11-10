"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Folder,
  Users,
  ShieldCheck,
} from "lucide-react";
import { TaskType, Priority, TaskStatus } from "@prisma/client";
import { BacklogTask } from "@/components/SharedBacklog";
import { isTaskOverdue } from "@/lib/dateUtils";

interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

interface UserOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface ReportsDashboardProps {
  tasks: BacklogTask[];
  projects: ProjectOption[];
  users: UserOption[];
  onSelectTask?: (taskId: string) => void;
}

type Timeframe = "7D" | "30D" | "90D" | "ALL";

const GEORGIAN_MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

function formatGeorgianDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${GEORGIAN_MONTHS[d.getMonth()]}`;
}

export function ReportsDashboard({
  tasks,
  projects,
  users,
  onSelectTask,
}: ReportsDashboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  // Default to current month for monthly report
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // Dynamically generate available month options from current date and tasks
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth();

    // Include current month, past 6 months, and next 2 months
    for (let i = -6; i <= 2; i++) {
      const d = new Date(currentY, currentM + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      monthsSet.add(`${y}-${m}`);
    }

    // Include any months from actual tasks
    tasks.forEach((t) => {
      [t.createdAt, t.startDate, t.deadline, t.completedAt].forEach((dateStr) => {
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            monthsSet.add(`${y}-${m}`);
          }
        }
      });
    });

    const currentKey = `${currentY}-${String(currentM + 1).padStart(2, "0")}`;
    const sorted = Array.from(monthsSet).sort().reverse();

    return sorted.map((key) => {
      const [yStr, mStr] = key.split("-");
      const year = parseInt(yStr, 10);
      const monthIdx = parseInt(mStr, 10) - 1;
      const monthName = GEORGIAN_MONTHS[monthIdx] || "";
      const isCurrent = key === currentKey;
      return {
        key,
        label: `${monthName} ${year}${isCurrent ? " (მიმდინარე თვე)" : ""}`,
      };
    });
  }, [tasks]);

  // Calculate month interval bounds for selectedMonth
  const monthBounds = useMemo(() => {
    if (selectedMonth === "ALL") return null;
    const [yStr, mStr] = selectedMonth.split("-");
    const year = parseInt(yStr, 10);
    const monthIndex = parseInt(mStr, 10) - 1;
    const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [selectedMonth]);

  // Filter tasks based on project, timeframe, and monthly interval intersection
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();

    if (timeframe === "7D") {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (timeframe === "30D") {
      cutoffDate.setDate(now.getDate() - 30);
    } else if (timeframe === "90D") {
      cutoffDate.setDate(now.getDate() - 90);
    }

    return tasks.filter((task) => {
      // Exclude cancelled tasks from normal progress reports
      if (task.status === TaskStatus.CANCELLED) return false;

      // Project filter
      if (selectedProject !== "ALL" && task.projectId !== selectedProject) {
        return false;
      }

      // Monthly Interval Intersection Logic
      if (monthBounds) {
        const { start: monthStart, end: monthEnd } = monthBounds;

        const taskStart = task.startDate
          ? new Date(task.startDate)
          : task.createdAt
          ? new Date(task.createdAt)
          : null;

        // If completed, task active lifespan ends at completedAt.
        // If still incomplete, task work is ongoing today (now) or extends into future deadline!
        const effectiveEnd =
          task.status === TaskStatus.DONE
            ? task.completedAt
              ? new Date(task.completedAt)
              : task.deadline
              ? new Date(task.deadline)
              : now
            : task.deadline && new Date(task.deadline) > now
            ? new Date(task.deadline)
            : now;

        if (taskStart && effectiveEnd) {
          if (taskStart > monthEnd || effectiveEnd < monthStart) return false;
        } else if (taskStart) {
          if (task.status !== TaskStatus.DONE) {
            if (taskStart > monthEnd) return false;
          } else {
            if (taskStart < monthStart || taskStart > monthEnd) return false;
          }
        } else if (effectiveEnd) {
          if (effectiveEnd < monthStart) return false;
        }
      } else if (timeframe !== "ALL") {
        // Timeframe filter based on cutoffDate
        const taskDate = task.startDate
          ? new Date(task.startDate)
          : task.deadline
          ? new Date(task.deadline)
          : null;
        if (taskDate && taskDate < cutoffDate) {
          if (task.status === TaskStatus.DONE) return false;
        }
      }

      return true;
    });
  }, [tasks, timeframe, selectedProject, monthBounds]);

  // Aggregate Metrics (scoped to monthly interval if selected)
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const now = new Date();

    // Completed: in monthly view, only tasks completed in this month
    const completed = filteredTasks.filter((t) => {
      if (t.status !== TaskStatus.DONE) return false;
      if (monthBounds) {
        if (!t.completedAt) return true;
        const cDate = new Date(t.completedAt);
        return cDate >= monthBounds.start && cDate <= monthBounds.end;
      }
      return true;
    }).length;

    const inProgress = filteredTasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PAUSED
    ).length;
    const blocked = filteredTasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
    const todo = filteredTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    ).length;

    // Overdue tasks: non-completed tasks whose deadline has arrived/passed
    const overdueTasks = filteredTasks.filter((t) => isTaskOverdue(t.deadline, t.status));
    const overdue = overdueTasks.length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // On-Time Delivery calculation:
    // Evaluate all tasks that had a deadline due by now or were completed
    const completedTasksWithDeadline = filteredTasks.filter(
      (t) => t.status === TaskStatus.DONE && Boolean(t.deadline)
    );

    const onTimeCompleted = completedTasksWithDeadline.filter((t) => {
      if (!t.completedAt || !t.deadline) return true;
      return new Date(t.completedAt) <= new Date(t.deadline);
    }).length;

    const lateCompleted = completedTasksWithDeadline.length - onTimeCompleted;

    // Evaluated deadline commitments:
    // Completed tasks with deadline + active overdue tasks
    const totalEvaluatedDeadlines = completedTasksWithDeadline.length + overdue;

    // On-time delivery rate: percentage of evaluated deadline commitments met on time
    // If no commitments were due, defaults to 100%
    const onTimeRate =
      totalEvaluatedDeadlines > 0
        ? Math.round((onTimeCompleted / totalEvaluatedDeadlines) * 100)
        : 100;

    return {
      total,
      completed,
      inProgress,
      blocked,
      todo,
      overdue,
      completedWithDeadline: completedTasksWithDeadline.length,
      onTimeCompleted,
      lateCompleted,
      completionRate,
      onTimeRate,
    };
  }, [filteredTasks, monthBounds]);

  // Project Breakdown
  const projectStats = useMemo(() => {
    const now = new Date();
    return projects.map((p) => {
      const pTasks = filteredTasks.filter((t) => t.projectId === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const inProgress = pTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
      const overdue = pTasks.filter(
        (t) =>
          Boolean(t.deadline) &&
          new Date(t.deadline!) < now &&
          t.status !== TaskStatus.DONE &&
          t.status !== TaskStatus.CANCELLED
      ).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        color: p.color || "#ea580c",
        total,
        completed,
        inProgress,
        overdue,
        progress,
      };
    });
  }, [projects, filteredTasks]);

  // Team Member Productivity
  const userStats = useMemo(() => {
    const now = new Date();
    return users.map((u) => {
      const uTasks = filteredTasks.filter((t) =>
        t.assignments.some((a) => a.user.id === u.id)
      );
      const total = uTasks.length;
      const completed = uTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const inProgress = uTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
      const overdue = uTasks.filter(
        (t) =>
          Boolean(t.deadline) &&
          new Date(t.deadline!) < now &&
          t.status !== TaskStatus.DONE &&
          t.status !== TaskStatus.CANCELLED
      ).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        total,
        completed,
        inProgress,
        overdue,
        progress,
      };
    });
  }, [users, filteredTasks]);

  // Type Breakdown
  const typeStats = useMemo(() => {
    const total = filteredTasks.length || 1;
    const features = filteredTasks.filter((t) => t.type === TaskType.FEATURE).length;
    const bugs = filteredTasks.filter((t) => t.type === TaskType.BUG).length;
    const hotfixes = filteredTasks.filter((t) => t.type === TaskType.HOTFIX).length;

    return {
      features: { count: features, pct: Math.round((features / total) * 100) },
      bugs: { count: bugs, pct: Math.round((bugs / total) * 100) },
      hotfixes: { count: hotfixes, pct: Math.round((hotfixes / total) * 100) },
    };
  }, [filteredTasks]);

  // Priority Breakdown
  const priorityStats = useMemo(() => {
    const total = filteredTasks.length || 1;
    const critical = filteredTasks.filter((t) => t.priority === Priority.CRITICAL).length;
    const high = filteredTasks.filter((t) => t.priority === Priority.HIGH).length;
    const medium = filteredTasks.filter((t) => t.priority === Priority.MEDIUM).length;
    const low = filteredTasks.filter((t) => t.priority === Priority.LOW).length;

    return {
      critical: { count: critical, pct: Math.round((critical / total) * 100) },
      high: { count: high, pct: Math.round((high / total) * 100) },
      medium: { count: medium, pct: Math.round((medium / total) * 100) },
      low: { count: low, pct: Math.round((low / total) * 100) },
    };
  }, [filteredTasks]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-y-auto p-4 sm:p-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              რეპორტები და ანალიტიკა
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              ანგარიშები
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            გუნდის პროდუქტიულობის, შესრულების ტემპისა და პროექტების პროგრესის ანალიზი
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Pills */}
          <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-2xs">
            {(
              [
                { id: "7D", label: "7 დღე" },
                { id: "30D", label: "30 დღე" },
                { id: "90D", label: "კვარტალი" },
                { id: "ALL", label: "ყველა" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeframe === t.id
                    ? "bg-stone-900 text-white shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Month Selector with Interval Intersection */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
            title="თვიური ფილტრაცია (ინტერვალის გადაკვეთა)"
          >
            <option value="ALL">ყველა თვე (სრული ისტორია)</option>
            {availableMonths.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Project Dropdown */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer shadow-2xs"
          >
            <option value="ALL">ყველა პროექტი</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-6">
        {/* Card 1: Completion Rate */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>შესრულების დონე</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900">
            {metrics.completionRate}%
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
            <span className="font-bold text-emerald-600">{metrics.completed}</span> დასრულდა /{" "}
            {metrics.total} სულ
          </div>
        </div>

        {/* Card 2: On-Time Delivery */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>ვადების დაცვა</span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                metrics.onTimeRate >= 80
                  ? "bg-emerald-50 text-emerald-600"
                  : metrics.onTimeRate >= 50
                  ? "bg-amber-50 text-amber-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              <ShieldCheck size={16} />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-black ${
              metrics.onTimeRate >= 80
                ? "text-stone-900"
                : metrics.onTimeRate >= 50
                ? "text-amber-600"
                : "text-rose-600"
            }`}
          >
            {metrics.onTimeRate}%
          </div>
          <div className="text-[11px] mt-1">
            {metrics.overdue > 0 ? (
              <span className="text-rose-600 font-semibold">
                {metrics.overdue} გადაცილებული დავალება
              </span>
            ) : metrics.lateCompleted > 0 ? (
              <span className="text-amber-600 font-semibold">
                {metrics.lateCompleted} დაგვიანებით შესრულებული
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold">
                დედლაინის გადაცილების გარეშე
              </span>
            )}
          </div>
        </div>

        {/* Card 3: In Progress & Active */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>აქტიური სამუშაო</span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900">
            {metrics.inProgress}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
            <span>{metrics.todo} შესასრულებელი</span>
          </div>
        </div>

        {/* Card 4: Overdue & Blocked */}
        <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>შეფერხებული ვადები</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600">
            {metrics.overdue}
          </div>
          <div className="text-[11px] mt-1">
            {metrics.blocked > 0 ? (
              <span className="text-amber-600 font-semibold">
                {metrics.blocked} დაბლოკილი ტასკი
              </span>
            ) : metrics.overdue > 0 ? (
              <span className="text-rose-600 font-semibold">საჭიროებს ყურადღებას</span>
            ) : (
              <span className="text-emerald-600 font-semibold">ყველა დავალება გრაფიკშია</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Projects vs Team Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        {/* Left: Projects Progress */}
        <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
              <Folder size={16} className="text-orange-600" />
              <span>პროექტების პროგრესი</span>
            </h3>
            <span className="text-xs text-stone-400 font-semibold">
              {projectStats.length} პროექტი
            </span>
          </div>

          <div className="space-y-4">
            {projectStats.map((p) => (
              <div key={p.id} className="p-3 bg-stone-50/70 rounded-xl border border-stone-200/60">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-stone-900 truncate">
                    {p.name}
                  </span>
                  <span className="text-xs font-extrabold text-stone-700">
                    {p.progress}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-500">
                  <span>სულ: {p.total} ტასკი</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 font-bold">{p.completed} შესრულდა</span>
                    {p.overdue > 0 && (
                      <span className="text-rose-600 font-bold">• {p.overdue} ვადაგადაცილებული</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {projectStats.length === 0 && (
              <div className="py-8 text-center text-xs text-stone-400">
                პროექტები არ არის
              </div>
            )}
          </div>
        </div>

        {/* Right: Team Productivity */}
        <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
              <Users size={16} className="text-blue-600" />
              <span>გუნდის წევრების პროდუქტიულობა</span>
            </h3>
            <span className="text-xs text-stone-400 font-semibold">
              {userStats.length} წევრი
            </span>
          </div>

          <div className="space-y-3.5">
            {userStats.map((u) => (
              <div
                key={u.id}
                className="p-3 bg-stone-50/70 rounded-xl border border-stone-200/60 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-stone-200 border border-white flex items-center justify-center text-xs font-extrabold text-stone-700 shrink-0 shadow-2xs">
                    {u.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 truncate">
                      {u.name}
                    </div>
                    <div className="text-[10px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                      <span>{u.inProgress} მიმდინარე</span>
                      <span>•</span>
                      <span>{u.completed} დასრულებული</span>
                      {u.overdue > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 font-bold">{u.overdue} გადაცილებული</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-extrabold text-stone-900">
                      {u.progress}%
                    </div>
                    <div className="text-[9px] text-stone-400">შესრულება</div>
                  </div>
                  <div className="w-12 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${u.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {userStats.length === 0 && (
              <div className="py-8 text-center text-xs text-stone-400">
                თანამშრომლები არ არიან
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Types & Priorities Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
        {/* Types Breakdown */}
        <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <h3 className="text-sm font-black text-stone-900 tracking-tight mb-3">
            ტასკების ტიპების განაწილება
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 mb-1">
                <span>Features (ფუნქციები)</span>
                <span>{typeStats.features.count} ({typeStats.features.pct}%)</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${typeStats.features.pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 mb-1">
                <span>Bugs (ხარვეზები)</span>
                <span>{typeStats.bugs.count} ({typeStats.bugs.pct}%)</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${typeStats.bugs.pct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-stone-700 mb-1">
                <span>Hotfixes (კრიტიკული შესწორებები)</span>
                <span>{typeStats.hotfixes.count} ({typeStats.hotfixes.pct}%)</span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${typeStats.hotfixes.pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
          <h3 className="text-sm font-black text-stone-900 tracking-tight mb-3">
            პრიორიტეტების განაწილება
          </h3>
          <div className="space-y-2.5">
            {[
              { label: "კრიტიკული (Critical)", ...priorityStats.critical, color: "bg-rose-500" },
              { label: "მაღალი (High)", ...priorityStats.high, color: "bg-amber-500" },
              { label: "საშუალო (Medium)", ...priorityStats.medium, color: "bg-blue-500" },
              { label: "დაბალი (Low)", ...priorityStats.low, color: "bg-stone-400" },
            ].map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.color}`} />
                  <span className="font-semibold text-stone-700">{p.label}</span>
                </div>
                <div className="font-mono font-bold text-stone-900">
                  {p.count} <span className="text-stone-400 font-normal">({p.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue / Blocked Tasks Section */}
      {metrics.overdue > 0 && (
        <div className="p-5 bg-white rounded-2xl border border-rose-200 shadow-2xs mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-rose-600" />
            <h3 className="text-sm font-black text-stone-900 tracking-tight">
              ყურადღების ქვეშ მყოფი ტასკები ({metrics.overdue} გადაცილებული)
            </h3>
          </div>
          <div className="space-y-2">
            {filteredTasks
              .filter((t) => isTaskOverdue(t.deadline, t.status))
              .map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTask && onSelectTask(t.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 hover:bg-rose-50 border border-rose-100 transition-colors cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-stone-400 font-bold shrink-0">
                      #{t.taskNumber}
                    </span>
                    <span className="font-bold text-stone-900 truncate">
                      {t.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-stone-500">
                      ვადა: {formatGeorgianDate(t.deadline)}
                    </span>
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                      ვადაგადაცილებული
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
