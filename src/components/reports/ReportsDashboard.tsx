"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Folder,
  Users,
  ShieldCheck,
  Pause,
  Ban,
  Download,
  Code2,
  PenTool,
  CheckSquare,
  Timer,
  BarChart3,
  History,
} from "lucide-react";
import { TaskType, Priority, TaskStatus, Department } from "@prisma/client";
import { BacklogTask } from "@/components/SharedBacklog";
import { isTaskOverdue } from "@/lib/dateUtils";
import { isTbilisiToday, getTbilisiTodayDate, formatTbilisiDateTime } from "@/lib/date";

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
type ReportTab = "overview" | "team_projects" | "qa";

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
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [timeframe, setTimeframe] = useState<Timeframe>("30D");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
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

    for (let i = -6; i <= 2; i++) {
      const d = new Date(currentY, currentM + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      monthsSet.add(`${y}-${m}`);
    }

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

  const cutoffDate = useMemo(() => {
    if (timeframe === "ALL") return null;
    const d = new Date();
    if (timeframe === "7D") d.setDate(d.getDate() - 7);
    else if (timeframe === "30D") d.setDate(d.getDate() - 30);
    else if (timeframe === "90D") d.setDate(d.getDate() - 90);
    return d;
  }, [timeframe]);

  // Separate Regular Tasks from QA Pages
  const filteredTasks = useMemo(() => {
    const now = new Date();

    return tasks.filter((task) => {
      if (task.status === TaskStatus.CANCELLED) return false;
      // Exclude QA pages from regular task metrics (they have dedicated QA analytics)
      if (task.department === Department.QA || task.type === TaskType.QA) return false;

      if (selectedProject !== "ALL" && task.projectId !== selectedProject) {
        return false;
      }

      if (
        selectedUser !== "ALL" &&
        !(task.assignments || []).some((a) => a.user?.id === selectedUser)
      ) {
        return false;
      }

      if (monthBounds) {
        const { start: monthStart, end: monthEnd } = monthBounds;
        const taskStart = task.startDate
          ? new Date(task.startDate)
          : task.createdAt
          ? new Date(task.createdAt)
          : null;

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
          } else if (taskStart < monthStart || taskStart > monthEnd) {
            return false;
          }
        } else if (effectiveEnd && effectiveEnd < monthStart) {
          return false;
        }
      } else if (cutoffDate) {
        const taskDate = task.startDate
          ? new Date(task.startDate)
          : task.deadline
          ? new Date(task.deadline)
          : task.createdAt
          ? new Date(task.createdAt)
          : null;
        if (taskDate && taskDate < cutoffDate && task.status === TaskStatus.DONE) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, cutoffDate, selectedProject, selectedUser, monthBounds]);

  // QA Pages & Test Runs in the selected period
  const qaAnalytics = useMemo(() => {
    const qaPages = tasks.filter((t) => {
      if (t.status === TaskStatus.CANCELLED) return false;
      const isQa = t.department === Department.QA || t.type === TaskType.QA;
      if (!isQa) return false;
      if (selectedProject !== "ALL" && t.projectId !== selectedProject) return false;
      return true;
    });

    const totalBlocks = qaPages.reduce((acc, p) => acc + (p.subtasks?.length || 0), 0);
    const activeTestingCount = qaPages.filter((p) => p.status === TaskStatus.IN_PROGRESS).length;

    interface QaRunItem {
      id: string;
      taskId: string;
      taskNumber: number;
      taskTitle: string;
      projectName: string;
      actorId: string;
      actorName: string;
      createdAt: string;
      verdict: string;
      passedCount: number;
      failedCount: number;
      totalCount: number;
    }

    const runs: QaRunItem[] = [];
    for (const p of qaPages) {
      for (const ev of p.auditEvents || []) {
        if (ev.action !== "TEST_RUN_RECORDED") continue;
        if (selectedUser !== "ALL" && ev.actor.id !== selectedUser) continue;

        const evDate = new Date(ev.createdAt);
        if (monthBounds) {
          if (evDate < monthBounds.start || evDate > monthBounds.end) continue;
        } else if (cutoffDate && evDate < cutoffDate) {
          continue;
        }

        const nv = ev.newValues || {};
        runs.push({
          id: ev.id,
          taskId: p.id,
          taskNumber: p.taskNumber,
          taskTitle: p.title,
          projectName: p.project?.name || "",
          actorId: ev.actor.id,
          actorName: ev.actor.name,
          createdAt: ev.createdAt,
          verdict: String(nv.status || "PASSED"),
          passedCount: Number(nv.passedCount || 0),
          failedCount: Number(nv.failedCount || 0),
          totalCount: Number(nv.totalCount || 0),
        });
      }
    }

    runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const passedRuns = runs.filter((r) => r.verdict === "PASSED").length;
    const failedRuns = runs.filter((r) => r.verdict === "FAILED").length;
    const passRate = runs.length > 0 ? Math.round((passedRuns / runs.length) * 100) : 100;

    // Group runs by tester
    const testerMap = new Map<
      string,
      { id: string; name: string; total: number; passed: number; failed: number }
    >();
    for (const r of runs) {
      const existing = testerMap.get(r.actorId) || {
        id: r.actorId,
        name: r.actorName,
        total: 0,
        passed: 0,
        failed: 0,
      };
      existing.total += 1;
      if (r.verdict === "PASSED") existing.passed += 1;
      else existing.failed += 1;
      testerMap.set(r.actorId, existing);
    }

    return {
      qaPagesCount: qaPages.length,
      totalBlocks,
      activeTestingCount,
      runs,
      totalRuns: runs.length,
      passedRuns,
      failedRuns,
      passRate,
      runsByTester: Array.from(testerMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [tasks, selectedProject, selectedUser, monthBounds, cutoffDate]);

  // Core Regular Task Metrics
  const metrics = useMemo(() => {
    const total = filteredTasks.length;

    const completedTasksList = filteredTasks.filter((t) => {
      if (t.status !== TaskStatus.DONE) return false;
      if (monthBounds) {
        if (!t.completedAt) return true;
        const cDate = new Date(t.completedAt);
        return cDate >= monthBounds.start && cDate <= monthBounds.end;
      }
      return true;
    });
    const completed = completedTasksList.length;

    // Average cycle time in days for completed tasks
    const cycleDaysArr = completedTasksList
      .map((t) => {
        if (!t.completedAt) return null;
        const startStr = t.startDate || t.createdAt;
        if (!startStr) return null;
        const diffMs = new Date(t.completedAt).getTime() - new Date(startStr).getTime();
        if (diffMs < 0) return 0;
        return diffMs / (1000 * 60 * 60 * 24);
      })
      .filter((v): v is number => v !== null);

    const avgCycleDays =
      cycleDaysArr.length > 0
        ? (cycleDaysArr.reduce((a, b) => a + b, 0) / cycleDaysArr.length).toFixed(1)
        : null;

    const inProgress = filteredTasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PAUSED
    ).length;
    const activeOnly = filteredTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const paused = filteredTasks.filter((t) => t.status === TaskStatus.PAUSED).length;
    const blocked = filteredTasks.filter((t) => t.status === TaskStatus.BLOCKED).length;
    const todo = filteredTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    ).length;

    const completedToday = filteredTasks.filter(
      (t) => t.status === TaskStatus.DONE && t.completedAt && isTbilisiToday(t.completedAt)
    ).length;

    const todayStart = getTbilisiTodayDate();
    const sevenDaysLater = new Date(todayStart);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    sevenDaysLater.setHours(23, 59, 59, 999);

    const dueSoonTasks = filteredTasks.filter((t) => {
      if (t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED || !t.deadline) {
        return false;
      }
      const d = new Date(t.deadline);
      return d >= todayStart && d <= sevenDaysLater;
    });

    const overdueTasks = filteredTasks.filter((t) => isTaskOverdue(t.deadline, t.status));
    const overdue = overdueTasks.length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedTasksWithDeadline = filteredTasks.filter(
      (t) => t.status === TaskStatus.DONE && Boolean(t.deadline)
    );

    const onTimeCompleted = completedTasksWithDeadline.filter((t) => {
      if (!t.completedAt || !t.deadline) return true;
      return new Date(t.completedAt) <= new Date(t.deadline);
    }).length;

    const lateCompleted = completedTasksWithDeadline.length - onTimeCompleted;
    const totalEvaluatedDeadlines = completedTasksWithDeadline.length + overdue;

    const onTimeRate =
      totalEvaluatedDeadlines > 0
        ? Math.round((onTimeCompleted / totalEvaluatedDeadlines) * 100)
        : 100;

    return {
      total,
      completed,
      completedToday,
      avgCycleDays,
      inProgress,
      activeOnly,
      paused,
      blocked,
      todo,
      dueSoon: dueSoonTasks.length,
      dueSoonTasks,
      overdue,
      overdueTasks,
      completedWithDeadline: completedTasksWithDeadline.length,
      onTimeCompleted,
      lateCompleted,
      completionRate,
      onTimeRate,
    };
  }, [filteredTasks, monthBounds]);

  // Department Breakdown (Development vs Content)
  const departmentStats = useMemo(() => {
    const computeDept = (dept: Department, label: string) => {
      const dTasks = filteredTasks.filter(
        (t) => (t.department || Department.DEVELOPMENT) === dept
      );
      const total = dTasks.length;
      const completed = dTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const inProgress = dTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
      const overdue = dTasks.filter((t) => isTaskOverdue(t.deadline, t.status)).length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { dept, label, total, completed, inProgress, overdue, pct };
    };
    return [
      computeDept(Department.DEVELOPMENT, "დეველოპმენტი"),
      computeDept(Department.CONTENT, "კონტენტი"),
    ];
  }, [filteredTasks]);

  // Project Breakdown
  const projectStats = useMemo(() => {
    return projects.map((p) => {
      const pTasks = filteredTasks.filter((t) => t.projectId === p.id);
      const total = pTasks.length;
      const completed = pTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const inProgress = pTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
      const overdue = pTasks.filter((t) => isTaskOverdue(t.deadline, t.status)).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      const qaCount = tasks.filter(
        (t) =>
          t.projectId === p.id &&
          t.status !== TaskStatus.CANCELLED &&
          (t.department === Department.QA || t.type === TaskType.QA)
      ).length;

      return {
        id: p.id,
        name: p.name,
        color: p.color || "#ea580c",
        total,
        completed,
        inProgress,
        overdue,
        progress,
        qaCount,
      };
    });
  }, [projects, filteredTasks, tasks]);

  // Team Member Productivity (Tasks + On-time % + QA runs)
  const userStats = useMemo(() => {
    return users
      .map((u) => {
        const uTasks = filteredTasks.filter((t) =>
          (t.assignments || []).some((a) => a.user?.id === u.id)
        );
        const total = uTasks.length;
        const completed = uTasks.filter((t) => t.status === TaskStatus.DONE).length;
        const inProgress = uTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
        const overdue = uTasks.filter((t) => isTaskOverdue(t.deadline, t.status)).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        const withDeadline = uTasks.filter(
          (t) => t.status === TaskStatus.DONE && Boolean(t.deadline)
        );
        const onTime = withDeadline.filter(
          (t) => !t.completedAt || !t.deadline || new Date(t.completedAt) <= new Date(t.deadline)
        ).length;
        const evalCount = withDeadline.length + overdue;
        const onTimePct = evalCount > 0 ? Math.round((onTime / evalCount) * 100) : 100;

        const userQaRuns = qaAnalytics.runs.filter((r) => r.actorId === u.id);

        return {
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          total,
          completed,
          inProgress,
          overdue,
          progress,
          onTimePct,
          qaRunsCount: userQaRuns.length,
        };
      })
      .sort((a, b) => b.total - a.total || b.qaRunsCount - a.qaRunsCount);
  }, [users, filteredTasks, qaAnalytics.runs]);

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

  // Export CSV (UTF-8 BOM for clean Georgian characters in Excel)
  const handleExportCsv = () => {
    const escapeCell = (val: string | number | null | undefined) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "ID",
      "სათაური",
      "პროექტი",
      "გუნდი",
      "ტიპი",
      "პრიორიტეტი",
      "სტატუსი",
      "პასუხისმგებელი",
      "დედლაინი",
      "შესრულების %",
      "ვადაგადაცილებული",
    ];

    const rows = filteredTasks.map((t) => [
      `#${t.taskNumber}`,
      t.title,
      t.project?.name || "",
      t.department || "DEVELOPMENT",
      t.type,
      t.priority,
      t.status,
      (t.assignments || []).map((a) => a.user?.name).filter(Boolean).join(", "),
      t.deadline ? formatGeorgianDate(t.deadline) : "უდედლაინო",
      `${t.progress}%`,
      isTaskOverdue(t.deadline, t.status) ? "დიახ" : "არა",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `team-workspace-report-${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-y-auto p-4 sm:p-8 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-stone-200">
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
            გუნდის პროდუქტიულობის, ვადების დაცვის, პროექტების პროგრესისა და QA ტესტირების დეტალური ანალიზი
          </p>
        </div>

        {/* Filters + Export */}
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

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
          >
            <option value="ALL">ყველა თვე</option>
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
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="ALL">ყველა პროექტი</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* User Dropdown */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none cursor-pointer shadow-2xs"
          >
            <option value="ALL">ყველა თანამშრომელი</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title="ექსპორტი CSV ფორმატში (Excel)"
          >
            <Download size={13} className="text-orange-600" />
            <span>CSV ექსპორტი</span>
          </button>
        </div>
      </div>

      {/* Report Section Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-stone-900 text-white border-stone-900 shadow-xs"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          <BarChart3 size={14} />
          <span>მიმოხილვა და KPI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("team_projects")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === "team_projects"
              ? "bg-stone-900 text-white border-stone-900 shadow-xs"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          <Users size={14} />
          <span>გუნდი და პროექტები</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qa")}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            activeTab === "qa"
              ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          <CheckSquare size={14} />
          <span>ხარისხის კონტროლი (QA) • {qaAnalytics.totalRuns}</span>
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          {/* KPI Cards Grid (5 cards including Cycle Time) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
              <div className="text-[11px] text-stone-500 mt-1">
                <span className="font-bold text-emerald-600">{metrics.completed}</span> დასრულდა /{" "}
                {metrics.total} სულ
              </div>
            </div>

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
                    {metrics.overdue} გადაცილებული
                  </span>
                ) : metrics.lateCompleted > 0 ? (
                  <span className="text-amber-600 font-semibold">
                    {metrics.lateCompleted} დაგვიანებით
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">გრაფიკშია</span>
                )}
              </div>
            </div>

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
              <div className="text-[11px] text-stone-500 mt-1">
                {metrics.todo} შესასრულებელი
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
                <span>საშუალო ციკლი</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Timer size={16} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900">
                {metrics.avgCycleDays !== null ? `${metrics.avgCycleDays} დღე` : "—"}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                საშუალო დრო დახურვამდე
              </div>
            </div>

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
                    {metrics.blocked} დაბლოკილი
                  </span>
                ) : metrics.overdue > 0 ? (
                  <span className="text-rose-600 font-semibold">საჭიროებს ყურადღებას</span>
                ) : (
                  <span className="text-emerald-600 font-semibold">გადაცილება არ არის</span>
                )}
              </div>
            </div>
          </div>

          {/* Operational Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  აქტიური
                </div>
                <div className="text-lg font-black text-stone-900 mt-0.5">{metrics.activeOnly}</div>
              </div>
              <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
            </div>

            <div className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  დღეს დასრულდა
                </div>
                <div className="text-lg font-black text-emerald-700 mt-0.5">
                  {metrics.completedToday}
                </div>
              </div>
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            </div>

            <div
              className={`p-3 rounded-xl border shadow-2xs flex items-center justify-between gap-2 ${
                metrics.overdue > 0
                  ? "bg-rose-50/30 border-rose-200"
                  : "bg-white border-stone-200/90"
              }`}
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                  გადაცილებული
                </div>
                <div
                  className={`text-lg font-black mt-0.5 ${
                    metrics.overdue > 0 ? "text-rose-600" : "text-stone-900"
                  }`}
                >
                  {metrics.overdue}
                </div>
              </div>
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
            </div>

            <div className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  უახლოესი ვადა (7 დღე)
                </div>
                <div className="text-lg font-black text-blue-900 mt-0.5">{metrics.dueSoon}</div>
              </div>
              <Clock size={15} className="text-blue-600 shrink-0" />
            </div>

            <div className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  შეჩერებული
                </div>
                <div className="text-lg font-black text-amber-700 mt-0.5">{metrics.paused}</div>
              </div>
              <Pause size={15} className="text-amber-600 shrink-0" />
            </div>

            <div className="p-3 bg-white rounded-xl border border-stone-200/90 shadow-2xs flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-900">
                  დაბლოკილი
                </div>
                <div className="text-lg font-black text-rose-700 mt-0.5">{metrics.blocked}</div>
              </div>
              <Ban size={15} className="text-rose-600 shrink-0" />
            </div>
          </div>

          {/* Department Comparison (Development vs Content) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departmentStats.map((d) => (
              <div
                key={d.dept}
                className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-stone-900 text-sm">
                    {d.dept === Department.DEVELOPMENT ? (
                      <Code2 size={16} className="text-blue-600" />
                    ) : (
                      <PenTool size={16} className="text-purple-600" />
                    )}
                    <span>{d.label}</span>
                  </div>
                  <span className="text-sm font-black text-stone-900">{d.pct}%</span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      d.dept === Department.DEVELOPMENT ? "bg-blue-600" : "bg-purple-600"
                    }`}
                    style={{ width: `${d.pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium">
                  <span>სულ: {d.total}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-blue-700 font-bold">{d.inProgress} მიმდინარე</span>
                    <span className="text-emerald-700 font-bold">{d.completed} დასრულებული</span>
                    {d.overdue > 0 && (
                      <span className="text-rose-600 font-bold">{d.overdue} გადაცილებული</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Types & Priorities Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <h3 className="text-sm font-black text-stone-900 tracking-tight mb-3">
                ტასკების ტიპების განაწილება
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 mb-1">
                    <span>Features (ფუნქციები)</span>
                    <span>
                      {typeStats.features.count} ({typeStats.features.pct}%)
                    </span>
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
                    <span>
                      {typeStats.bugs.count} ({typeStats.bugs.pct}%)
                    </span>
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
                    <span>
                      {typeStats.hotfixes.count} ({typeStats.hotfixes.pct}%)
                    </span>
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

          {/* Attention List: Overdue + Due Soon */}
          {(metrics.overdue > 0 || metrics.dueSoon > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.overdue > 0 && (
                <div className="p-5 bg-white rounded-2xl border border-rose-200 shadow-2xs">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={16} className="text-rose-600" />
                    <h3 className="text-sm font-black text-stone-900 tracking-tight">
                      ვადაგადაცილებული ტასკები ({metrics.overdue})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {metrics.overdueTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask && onSelectTask(t.id)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 hover:bg-rose-50 border border-rose-100 transition-colors cursor-pointer text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-stone-400 font-bold shrink-0">
                            #{t.taskNumber}
                          </span>
                          <span className="font-bold text-stone-900 truncate">{t.title}</span>
                        </div>
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md shrink-0">
                          {formatGeorgianDate(t.deadline)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {metrics.dueSoon > 0 && (
                <div className="p-5 bg-white rounded-2xl border border-amber-200 shadow-2xs">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock size={16} className="text-amber-600" />
                    <h3 className="text-sm font-black text-stone-900 tracking-tight">
                      უახლოესი დედლაინები — 7 დღე ({metrics.dueSoon})
                    </h3>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {metrics.dueSoonTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask && onSelectTask(t.id)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/40 hover:bg-amber-50 border border-amber-100 transition-colors cursor-pointer text-xs gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-stone-400 font-bold shrink-0">
                            #{t.taskNumber}
                          </span>
                          <span className="font-bold text-stone-900 truncate">{t.title}</span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md shrink-0">
                          {formatGeorgianDate(t.deadline)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "team_projects" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects Progress */}
          <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                <Folder size={16} className="text-orange-600" />
                <span>პროექტების დეტალური მიმდინარეობა</span>
              </h3>
              <span className="text-xs text-stone-400 font-semibold">
                {projectStats.length} პროექტი
              </span>
            </div>

            <div className="space-y-3.5">
              {projectStats.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 bg-stone-50/70 rounded-xl border border-stone-200/60"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-stone-900 truncate">{p.name}</span>
                    <span className="text-xs font-extrabold text-stone-700">{p.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all duration-300"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 flex-wrap gap-2">
                    <span>
                      სულ: <strong className="text-stone-800">{p.total}</strong> ტასკი •{" "}
                      <strong className="text-emerald-700">{p.qaCount}</strong> QA გვერდი
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-700 font-bold">{p.inProgress} მიმდინარე</span>
                      <span className="text-emerald-700 font-bold">{p.completed} შესრულდა</span>
                      {p.overdue > 0 && (
                        <span className="text-rose-600 font-bold">
                          • {p.overdue} გადაცილებული
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {projectStats.length === 0 && (
                <div className="py-8 text-center text-xs text-stone-400">პროექტები არ არის</div>
              )}
            </div>
          </div>

          {/* Team Member Productivity */}
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

            <div className="space-y-3">
              {userStats.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(selectedUser === u.id ? "ALL" : u.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    selectedUser === u.id
                      ? "bg-orange-50/60 border-orange-300"
                      : "bg-stone-50/70 border-stone-200/60 hover:bg-stone-100/70"
                  }`}
                  title="დააკლიკეთ ამ თანამშრომელზე ფილტრაციისთვის"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-stone-200 border border-white flex items-center justify-center text-xs font-extrabold text-stone-700 shrink-0 shadow-2xs">
                      {u.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 truncate">{u.name}</div>
                      <div className="text-[10px] text-stone-500 flex items-center gap-1.5 flex-wrap">
                        <span>{u.inProgress} მიმდინარე</span>
                        <span>•</span>
                        <span>{u.completed} დასრულებული</span>
                        <span>•</span>
                        <span>ვადები: {u.onTimePct}%</span>
                        {u.qaRunsCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">
                              {u.qaRunsCount} QA ტესტი
                            </span>
                          </>
                        )}
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
                      <div className="text-xs font-extrabold text-stone-900">{u.progress}%</div>
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
      )}

      {activeTab === "qa" && (
        <div className="space-y-6">
          {/* QA Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="text-xs font-semibold text-stone-500 mb-1">QA გვერდები / ბლოკები</div>
              <div className="text-2xl font-black text-stone-900">{qaAnalytics.qaPagesCount}</div>
              <div className="text-[11px] text-stone-500 mt-1">
                {qaAnalytics.totalBlocks} შესამოწმებელი ბლოკი
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="text-xs font-semibold text-stone-500 mb-1">ჩატარებული ტესტები</div>
              <div className="text-2xl font-black text-blue-700">{qaAnalytics.totalRuns}</div>
              <div className="text-[11px] text-stone-500 mt-1">
                {qaAnalytics.activeTestingCount} მიმდინარეობს ამ წუთას
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="text-xs font-semibold text-stone-500 mb-1">წარმატების მაჩვენებელი</div>
              <div className="text-2xl font-black text-emerald-700">{qaAnalytics.passRate}%</div>
              <div className="text-[11px] text-stone-500 mt-1">
                <span className="text-emerald-700 font-bold">{qaAnalytics.passedRuns} გაიარა</span> •{" "}
                <span className="text-rose-600 font-bold">{qaAnalytics.failedRuns} ჩავარდა</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <div className="text-xs font-semibold text-stone-500 mb-1">აქტიური ტესტერები</div>
              <div className="text-2xl font-black text-stone-900">
                {qaAnalytics.runsByTester.length}
              </div>
              <div className="text-[11px] text-stone-500 mt-1">მონაწილე პერიოდში</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Runs by Tester */}
            <div className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <h3 className="text-sm font-black text-stone-900 mb-3 flex items-center gap-2">
                <Users size={15} className="text-emerald-600" />
                <span>ტესტერების აქტივობა</span>
              </h3>
              <div className="space-y-2.5">
                {qaAnalytics.runsByTester.length === 0 ? (
                  <div className="py-6 text-center text-xs text-stone-400">
                    ამ პერიოდში ტესტები არ ჩატარებულა
                  </div>
                ) : (
                  qaAnalytics.runsByTester.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-stone-900 truncate">{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0 font-bold text-[11px]">
                        <span className="text-emerald-700">✓ {t.passed}</span>
                        <span className="text-rose-600">✕ {t.failed}</span>
                        <span className="px-2 py-0.5 rounded bg-stone-200/80 text-stone-800">
                          სულ {t.total}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent QA Runs Log */}
            <div className="lg:col-span-2 p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs">
              <h3 className="text-sm font-black text-stone-900 mb-3 flex items-center gap-2">
                <History size={15} className="text-blue-600" />
                <span>ბოლო ჩატარებული ტესტების რეესტრი</span>
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {qaAnalytics.runs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    ჩატარებული ტესტები არ მოიძებნა
                  </div>
                ) : (
                  qaAnalytics.runs.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => onSelectTask && onSelectTask(r.taskId)}
                      className="p-3 rounded-xl bg-stone-50/70 hover:bg-stone-100/70 border border-stone-200/70 flex flex-wrap items-center justify-between gap-2 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                            r.verdict === "PASSED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {r.verdict === "PASSED" ? "✓ გაიარა" : "✕ ჩავარდა"}
                        </span>
                        <span className="font-bold text-stone-900 truncate">{r.taskTitle}</span>
                        {r.projectName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-600 shrink-0">
                            {r.projectName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 shrink-0">
                        <span className="font-bold text-stone-800">{r.actorName}</span>
                        <span>•</span>
                        <span>
                          {r.passedCount}/{r.totalCount} ბლოკი
                        </span>
                        <span>•</span>
                        <span>{formatTbilisiDateTime(r.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
