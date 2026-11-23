"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  ShieldCheck,
  ListCheck,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
  History,
  X,
} from "lucide-react";
import { TaskStatus, Priority, Department, TaskType } from "@prisma/client";
import { BacklogTask } from "@/components/SharedBacklog";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { formatTbilisiDateTime, getTbilisiTodayString } from "@/lib/date";

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

interface QualityControlViewProps {
  tasks: BacklogTask[];
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  onOpenNewTask: () => void;
  onEditTask?: (task: BacklogTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onTaskUpdated?: () => Promise<void> | void;
  projects: ProjectOption[];
  users: UserOption[];
  isAdmin: boolean;
  currentUser?: { id: string; name: string };
  externalSearchQuery?: string;
  onNavigateToTimeline?: () => void;
}

type StatusFilter = "ALL" | "PLANNED" | "IN_PROGRESS" | "DONE" | "PAUSED_OR_BLOCKED";

export function QualityControlView({
  tasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTask,
  onEditTask,
  onStatusChange,
  onDeleteTask,
  onTaskUpdated,
  projects,
  users,
  isAdmin,
  currentUser,
  externalSearchQuery,
  onNavigateToTimeline,
}: QualityControlViewProps) {
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");

  // Expanded Checklists & History State
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

  // Start Testing Confirmation Modal State
  const [startConfirmTask, setStartConfirmTask] = useState<BacklogTask | null>(null);
  const [isStartingTest, setIsStartingTest] = useState(false);

  // Local optimistic subtasks state for immediate checklist check/uncheck
  const [subtaskTogglingId, setSubtaskTogglingId] = useState<string | null>(null);
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [finishingTaskId, setFinishingTaskId] = useState<string | null>(null);

  const toggleChecklist = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedChecklists((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleHistory = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedHistory((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const formatNumericTbilisiDate = (dateInput: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tbilisi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(dateInput));
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    return `${m}.${d}.${y}`;
  };

  const todayTbilisiStr = getTbilisiTodayString();
  const [ty, tm, td] = todayTbilisiStr.split("-");
  const todayFormatted = `${tm}.${td}.${ty}`;

  const handleConfirmStartTest = async () => {
    if (!startConfirmTask || isStartingTest) return;
    const startedTaskId = startConfirmTask.id;
    setIsStartingTest(true);
    try {
      const res = await fetch(`/api/tasks/${startedTaskId}/qa-start`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "ტესტის დაწყება ვერ მოხერხდა");
      }
      setStartConfirmTask(null);
      setExpandedChecklists((prev) => ({ ...prev, [startedTaskId]: true }));
      if (onTaskUpdated) {
        await onTaskUpdated();
      }
    } catch (err) {
      console.error("Failed to start QA test:", err);
    } finally {
      setIsStartingTest(false);
    }
  };

  // Filter ONLY QA Tasks (Department QA or Type QA)
  const qaTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === TaskStatus.CANCELLED) return false;
      return t.department === Department.QA || t.type === TaskType.QA;
    });
  }, [tasks]);

  // Apply Search, Project, User, and Status Filters
  const filteredQATasks = useMemo(() => {
    return qaTasks.filter((t) => {
      // Search Query
      const effectiveSearch = (externalSearchQuery || searchQuery).toLowerCase().trim();
      if (effectiveSearch) {
        const matchesTitle = t.title.toLowerCase().includes(effectiveSearch);
        const matchesNumber = String(t.taskNumber).includes(effectiveSearch);
        const matchesDesc = t.description?.toLowerCase().includes(effectiveSearch);
        const matchesSubtasks = (t.subtasks || []).some((st) =>
          st.title?.toLowerCase().includes(effectiveSearch)
        );
        if (!matchesTitle && !matchesNumber && !matchesDesc && !matchesSubtasks) {
          return false;
        }
      }

      // Project Filter
      if (selectedProject !== "ALL" && t.projectId !== selectedProject) {
        return false;
      }

      // User / Tester Filter
      if (selectedUser !== "ALL") {
        const hasUser = (t.assignments || []).some((a) => a.user?.id === selectedUser);
        if (!hasUser) return false;
      }

      // Status Filter
      if (selectedStatus === "PLANNED") {
        if (t.status !== TaskStatus.BACKLOG && t.status !== TaskStatus.PLANNED) return false;
      } else if (selectedStatus === "IN_PROGRESS") {
        if (t.status !== TaskStatus.IN_PROGRESS) return false;
      } else if (selectedStatus === "DONE") {
        if (t.status !== TaskStatus.DONE) return false;
      } else if (selectedStatus === "PAUSED_OR_BLOCKED") {
        if (t.status !== TaskStatus.PAUSED && t.status !== TaskStatus.BLOCKED) return false;
      }

      return true;
    });
  }, [qaTasks, searchQuery, externalSearchQuery, selectedProject, selectedUser, selectedStatus]);

  // Overall Statistics for KPI Cards
  const stats = useMemo(() => {
    const total = qaTasks.length;
    const planned = qaTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    ).length;
    const inProgress = qaTasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.PAUSED
    ).length;
    const passedPages = qaTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const failedPages = qaTasks.filter((t) => t.status === TaskStatus.BLOCKED).length;

    let totalSubtasksCount = 0;
    let passedSubtasksCount = 0;
    let failedSubtasksCount = 0;
    for (const t of qaTasks) {
      if (t.subtasks && t.subtasks.length > 0) {
        totalSubtasksCount += t.subtasks.length;
        passedSubtasksCount += t.subtasks.filter((st) => st.status === "DONE").length;
        failedSubtasksCount += t.subtasks.filter((st) => st.status === "CANCELLED").length;
      }
    }

    const testedSubtasksCount = passedSubtasksCount + failedSubtasksCount;
    const overallRate =
      totalSubtasksCount > 0 ? Math.round((testedSubtasksCount / totalSubtasksCount) * 100) : 0;

    return {
      total,
      planned,
      inProgress,
      passedPages,
      failedPages,
      totalSubtasksCount,
      passedSubtasksCount,
      failedSubtasksCount,
      overallRate,
    };
  }, [qaTasks]);

  // Set individual block QA result: Pass (DONE), Failed (CANCELLED), or toggle back to Untested (TODO)
  const handleSetBlockStatus = async (
    subtaskId: string,
    targetStatus: "DONE" | "CANCELLED",
    currentStatus: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (subtaskTogglingId) return;
    setSubtaskTogglingId(subtaskId);

    const newStatus = currentStatus === targetStatus ? "TODO" : targetStatus;
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (onTaskUpdated) {
        await onTaskUpdated();
      }
    } catch (err) {
      console.error("Failed to update QA block status:", err);
    } finally {
      setSubtaskTogglingId(null);
    }
  };

  const handleSaveBlockNote = async (subtaskId: string, noteValue: string) => {
    const trimmed = noteValue.trim();
    setSavingNoteId(subtaskId);
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed || null }),
      });
      if (onTaskUpdated) {
        await onTaskUpdated();
      }
    } catch (err) {
      console.error("Failed to save QA block note:", err);
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleFinishTest = async (task: BacklogTask, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (finishingTaskId) return;
    setFinishingTaskId(task.id);
    try {
      // Save any pending block notes before finalizing the run
      for (const st of task.subtasks || []) {
        const draft = blockNotes[st.id];
        if (draft !== undefined && draft.trim() !== (st.description || "").trim()) {
          await fetch(`/api/subtasks/${st.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: draft.trim() || null }),
          });
        }
      }

      const res = await fetch(`/api/tasks/${task.id}/qa-finish`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "ტესტის დასრულება ვერ მოხერხდა");
      }

      setExpandedChecklists((prev) => ({ ...prev, [task.id]: false }));
      setBlockNotes((prev) => {
        const next = { ...prev };
        for (const st of task.subtasks || []) {
          delete next[st.id];
        }
        return next;
      });
      if (onTaskUpdated) {
        await onTaskUpdated();
      }
    } catch (err) {
      console.error("Failed to finish QA test:", err);
    } finally {
      setFinishingTaskId(null);
    }
  };

  // Helper for Task Code (e.g. SSP-8)
  const getTaskCode = (task: BacklogTask) => {
    if (task.project?.name) {
      const letters = task.project.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (letters.length >= 2 && letters !== "PROJECT") {
        return `${letters.slice(0, 3)}-${task.taskNumber}`;
      }
    }
    return `QA-${task.taskNumber}`;
  };

  // Format testing date range (e.g. "20-25 ნოემბერი" or "20-25 რიცხვი")
  const formatTestingPeriod = (startDate?: string | null, deadline?: string | null) => {
    if (!startDate && !deadline) return "პერიოდი მითითებული არ არის";
    if (startDate && deadline) {
      const s = new Date(startDate);
      const d = new Date(deadline);
      const sDay = s.getDate();
      const dDay = d.getDate();
      const monthShort = formatGeorgianDateShort(deadline).split(" ")[1] || "";
      if (s.getMonth() === d.getMonth()) {
        return `${sDay}-${dDay} ${monthShort}`;
      }
      return `${formatGeorgianDateShort(startDate)} — ${formatGeorgianDateShort(deadline)}`;
    }
    if (deadline) return `ბოლო ვადა: ${formatGeorgianDateShort(deadline)}`;
    return `დაიწყო: ${formatGeorgianDateShort(startDate!)}`;
  };

  // Format Condition / Status Label & Colors
  const getStatusBadge = (
    status: TaskStatus,
    failedSubtasks = 0,
    lastRunVerdict?: string
  ) => {
    if (status === TaskStatus.IN_PROGRESS) {
      if (failedSubtasks > 0) {
        return {
          label: `⚠️ ტესტირებაშია (${failedSubtasks} დაზიანება)`,
          badgeClass: "bg-amber-50 text-rose-700 border-amber-300 font-bold",
          dotColor: "bg-rose-500",
        };
      }
      return {
        label: "🔵 ტესტირებაშია",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-300 font-bold",
        dotColor: "bg-blue-500",
      };
    }

    if (lastRunVerdict === "PASSED") {
      return {
        label: "✅ ბოლო ტესტი: გაიარა",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
        dotColor: "bg-emerald-500",
      };
    }

    if (lastRunVerdict === "FAILED") {
      return {
        label: "❌ ბოლო ტესტი: ჩავარდა",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
        dotColor: "bg-rose-500",
      };
    }

    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-hidden p-3 sm:p-5 lg:p-6 space-y-4">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CheckSquare size={20} strokeWidth={2.4} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-tight">
                ხარისხის კონტროლი (QA & Testing Matrix)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                რეესტრი
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              საიტის გვერდებისა და მოდულების ხარისხის კონტროლი, ვიზუალური და ფუნქციონალური შემოწმება.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenNewTask()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>ახალი QA შემოწმება</span>
          </button>

          {onNavigateToTimeline && (
            <button
              onClick={onNavigateToTimeline}
              className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="თაიმლაინი"
            >
              <Calendar size={13} className="text-stone-500" />
              <span className="hidden sm:inline">თაიმლაინი</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Widgets */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-stone-500 block mb-1">სულ გვერდები</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-stone-900">{stats.total}</span>
            <span className="text-[11px] font-bold text-stone-400">
              გვერდი / {stats.totalSubtasksCount} ბლოკი
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 block mb-1">ტესტირებაშია / რიგში</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700">{stats.inProgress}</span>
            <span className="text-[11px] font-bold text-amber-600">
              {stats.planned} შესამოწმებელი
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/70 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 block mb-1">მზადაა / ჩაბარდა (Pass)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{stats.passedPages}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {stats.passedSubtasksCount}/{stats.totalSubtasksCount} ბლოკი გამართულია
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200/70 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-600 block mb-1">ჩავარდა / დაზიანებაა (Failed)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-700">{stats.failedPages}</span>
            <span className="text-[11px] font-bold text-rose-600">
              {stats.failedSubtasksCount} დაზიანებული ბლოკი
            </span>
          </div>
        </div>
      </div>

      {/* 3. Control & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0 flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ძებნა (გვერდი, შემოწმების სფერო, ტესტერი)..."
            className="w-full pl-9 pr-7 py-1.5 bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-normal text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Project Filter */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">ყველა პროექტი</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
        </div>

        {/* Tester / Assignee Filter */}
        <div className="relative">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">ყველა ტესტერი</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
        </div>

        {/* Status / Condition Filter */}
        <div className="relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">ყველა მდგომარეობა</option>
            <option value="IN_PROGRESS">ტესტირებაშია (In Testing)</option>
            <option value="PLANNED">შესამოწმებელია (Pending)</option>
            <option value="DONE">მზადაა / ჩაბარდა (Passed)</option>
            <option value="PAUSED_OR_BLOCKED">ჩავარდა / დაზიანებაა (Failed / Paused)</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
        </div>
      </div>

      {/* 4. Single-Line List of QA Tasks (One Line Per Task — No Kanban Columns) */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
        {filteredQATasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-stone-200/90 text-stone-400 text-xs">
            ხარისხის კონტროლის დავალებები არ მოიძებნა
          </div>
        ) : (
          filteredQATasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            const taskCode = getTaskCode(task);
            const isChecklistOpen = Boolean(expandedChecklists[task.id]);
            const isHistoryOpen = Boolean(expandedHistory[task.id]);
            const taskHistory = task.auditEvents || [];
            const latestHistory = taskHistory.find((ev) => ev.action === "TEST_RUN_RECORDED") || taskHistory[0];
            const lastRunVerdict =
              taskHistory.find((ev) => ev.action === "TEST_RUN_RECORDED")?.newValues?.status as
                | string
                | undefined;

            const subtasks = task.subtasks || [];
            const totalSubtasks = subtasks.length;
            const passedSubtasks = subtasks.filter((s) => s.status === "DONE").length;
            const failedSubtasks = subtasks.filter((s) => s.status === "CANCELLED").length;
            const testedSubtasks = passedSubtasks + failedSubtasks;
            const untestedSubtasks = totalSubtasks - testedSubtasks;
            const percent =
              totalSubtasks > 0
                ? Math.round((testedSubtasks / totalSubtasks) * 100)
                : task.progress;
            const statusMeta = getStatusBadge(task.status, failedSubtasks, lastRunVerdict);

            const primaryTester = task.assignments?.[0]?.user;

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`bg-white rounded-2xl border transition-all cursor-pointer shadow-2xs hover:shadow hover:border-stone-300 overflow-hidden ${
                  isSelected ? "border-emerald-500 ring-2 ring-emerald-100 shadow-xs" : "border-stone-200/90"
                }`}
              >
                {/* Main Full-Width Single-Line Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Code, Page Title, Project & Description / Testing Scope */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* QA Code Badge */}
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0 font-mono">
                        {taskCode}
                      </span>

                      {/* Project Tag */}
                      {task.project && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200/80 shrink-0">
                          {task.project.name}
                        </span>
                      )}

                      {/* Status / Last Run Pill (only when in testing or has a previous run verdict) */}
                      {statusMeta && (
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${statusMeta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                      )}
                    </div>

                    {/* Module / Page Title */}
                    <h3 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight leading-snug">
                      {task.title}
                    </h3>

                    {/* Testing Scope & Description */}
                    {task.description && (
                      <p className="text-xs text-stone-600 font-normal leading-relaxed line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Right Meta Column: Tester, Testing Dates, Progress, Checklist Toggle & Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100">
                    {/* 1. Active Tester (only shown while a test run is active) */}
                    {primaryTester && (
                      <div className="min-w-[120px]">
                        <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider mb-1">
                          ამოწმებს
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-black text-stone-700 overflow-hidden shadow-2xs shrink-0">
                            {primaryTester.avatarUrl ? (
                              <Image
                                src={primaryTester.avatarUrl}
                                alt={primaryTester.name}
                                width={20}
                                height={20}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              primaryTester.name.charAt(0)
                            )}
                          </div>
                          <span className="text-xs font-bold text-stone-800 truncate max-w-[110px]" title={primaryTester.name}>
                            {primaryTester.name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 2. Testing Dates (ბოლო ტესტირება: თარიღი + ვინ გააკეთა) */}
                    <div className="min-w-[155px]">
                      <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider mb-1">
                        ბოლო ტესტირება
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <Calendar size={13} className="text-emerald-600 shrink-0" />
                        {latestHistory ? (
                          <span className="truncate max-w-[180px]" title={`${formatNumericTbilisiDate(latestHistory.createdAt)} — ${latestHistory.actor.name}`}>
                            {formatNumericTbilisiDate(latestHistory.createdAt)} • {latestHistory.actor.name}
                          </span>
                        ) : (
                          <span>{formatTestingPeriod(task.startDate, task.deadline)}</span>
                        )}
                      </div>
                    </div>

                    {/* 3. Progress / Block Breakdown Completion */}
                    <div className="min-w-[165px]">
                      <div className="flex items-center justify-between text-xs mb-1 gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            ✓ {passedSubtasks}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded border ${
                              failedSubtasks > 0
                                ? "text-rose-700 bg-rose-50 border-rose-300 font-black"
                                : "text-stone-400 bg-stone-50 border-stone-200"
                            }`}
                          >
                            ✕ {failedSubtasks}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-stone-900">
                          {totalSubtasks > 0 ? `${testedSubtasks}/${totalSubtasks} ბლოკი` : `${percent}%`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            failedSubtasks > 0
                              ? "bg-rose-500"
                              : percent === 100
                              ? "bg-emerald-500"
                              : percent > 0
                              ? "bg-blue-600"
                              : "bg-stone-300"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* 4. Checklist & History Triggers */}
                    {totalSubtasks > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleChecklist(task.id, e)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                          isChecklistOpen
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                        title="გვერდის ბლოკების ტესტირება"
                      >
                        <ListCheck size={14} className={isChecklistOpen ? "text-emerald-600" : "text-stone-400"} />
                        <span>ბლოკები ({totalSubtasks})</span>
                        {isChecklistOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}

                    {taskHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleHistory(task.id, e)}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                          isHistoryOpen
                            ? "bg-blue-50 border-blue-300 text-blue-800"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                        title="ტესტირების ისტორია"
                      >
                        <History size={13} className={isHistoryOpen ? "text-blue-600" : "text-stone-400"} />
                        <span>ისტორია ({taskHistory.length})</span>
                      </button>
                    )}

                    {/* 5. Start Test / Complete & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {onEditTask && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTask(task);
                          }}
                          className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors cursor-pointer"
                          title="რედაქტირება"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      {task.status !== TaskStatus.IN_PROGRESS ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setStartConfirmTask(task);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          title="ტესტირების დაწყება"
                        >
                          <Play size={12} fill="currentColor" />
                          <span className="hidden sm:inline">ტესტის დაწყება</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={finishingTaskId === task.id}
                          onClick={(e) => handleFinishTest(task, e)}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                          title="ტესტის დასრულება და ისტორიაში შენახვა"
                        >
                          <CheckCircle2 size={13} />
                          <span className="hidden sm:inline">
                            {finishingTaskId === task.id ? "ინახება..." : "ტესტის დასრულება"}
                          </span>
                        </button>
                      )}

                      {isAdmin && onDeleteTask && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`დარწმუნებული ხართ, რომ გსურთ შემოწმების წაშლა (#${task.taskNumber}: ${task.title})?`)) {
                              await onDeleteTask(task.id);
                            }
                          }}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="წაშლა"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Expandable Checklist Panel (No stages — Pass / Failed per page block) */}
                {isChecklistOpen && totalSubtasks > 0 && (
                  <div
                    className="px-5 pb-4 pt-2 bg-stone-50/80 border-t border-stone-200/80 space-y-2.5 animate-in fade-in duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-stone-600 pt-1">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>
                          გვერდის ბლოკების ტესტირება: ✓ {passedSubtasks} მზადაა • ✕ {failedSubtasks} დაზიანება • ⏳ {untestedSubtasks} დარჩა
                        </span>
                      </span>
                      <span className="text-[11px] text-stone-400 font-medium">
                        დაზიანების (Failed) არსებობის შემთხვევაში, დასრულებისას გვერდის ტესტი ჩავარდება
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 pt-0.5">
                      {subtasks.map((st, idx) => {
                        const isPassed = st.status === "DONE";
                        const isFailed = st.status === "CANCELLED";
                        const isBusy = subtaskTogglingId === st.id;
                        const noteValue =
                          blockNotes[st.id] !== undefined
                            ? blockNotes[st.id]
                            : st.description || "";
                        return (
                          <div
                            key={st.id}
                            className={`p-2.5 rounded-xl border text-xs transition-colors space-y-2 ${
                              isFailed
                                ? "bg-rose-50/70 border-rose-300 text-rose-950 shadow-2xs"
                                : isPassed
                                ? "bg-emerald-50/60 border-emerald-200 text-stone-800 shadow-2xs"
                                : "bg-white border-stone-200 text-stone-800 hover:border-stone-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 shrink-0">
                                  #{idx + 1}
                                </span>
                                <span
                                  className={`font-semibold leading-snug ${
                                    isFailed
                                      ? "text-rose-900"
                                      : isPassed
                                      ? "text-emerald-900"
                                      : "text-stone-800"
                                  }`}
                                >
                                  {st.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={(e) => handleSetBlockStatus(st.id, "DONE", st.status, e)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer disabled:opacity-50 ${
                                    isPassed
                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                  }`}
                                  title="ბლოკი გამართულია (Pass)"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>მზადაა</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={(e) => handleSetBlockStatus(st.id, "CANCELLED", st.status, e)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer disabled:opacity-50 ${
                                    isFailed
                                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                      : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                                  }`}
                                  title="ბლოკში დაფიქსირდა დაზიანება / ბაგი (Failed)"
                                >
                                  <XCircle size={12} />
                                  <span>დაზიანებაა</span>
                                </button>
                              </div>
                            </div>

                            {isFailed && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <input
                                  type="text"
                                  value={noteValue}
                                  onChange={(e) =>
                                    setBlockNotes((prev) => ({
                                      ...prev,
                                      [st.id]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    if (noteValue.trim() !== (st.description || "").trim()) {
                                      handleSaveBlockNote(st.id, noteValue);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveBlockNote(st.id, noteValue);
                                    }
                                  }}
                                  placeholder="რა ხარვეზია? (არასავალდებულო)..."
                                  className="flex-1 px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-[11px] text-rose-950 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                />
                                {savingNoteId === st.id && (
                                  <span className="text-[10px] text-rose-600 font-semibold shrink-0">
                                    ინახება...
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(task.status === TaskStatus.IN_PROGRESS || testedSubtasks > 0) && (
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
                        <span className="text-[11px] text-stone-500 font-medium">
                          დასრულებისას შედეგი შეინახება რეესტრის ისტორიაში და გვერდი დაბრუნდება საწყის მდგომარეობაში.
                        </span>
                        <button
                          type="button"
                          disabled={finishingTaskId === task.id}
                          onClick={(e) => handleFinishTest(task, e)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                        >
                          <CheckCircle2 size={14} />
                          <span>
                            {finishingTaskId === task.id ? "ინახება..." : "ტესტის დასრულება"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Expandable Testing History */}
                {isHistoryOpen && taskHistory.length > 0 && (
                  <div
                    className="px-5 pb-4 pt-2.5 bg-blue-50/40 border-t border-blue-200/60 space-y-2 animate-in fade-in duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <History size={13} className="text-blue-600" />
                      <span>ტესტირების ისტორია</span>
                    </div>
                    <div className="space-y-1.5">
                      {taskHistory.map((ev) => {
                        const runVerdict = ev.newValues?.status as string | undefined;
                        const runBlocks = Array.isArray(ev.newValues?.blocks)
                          ? (ev.newValues.blocks as Array<{ title?: string; status?: string; note?: string }>)
                          : [];

                        return (
                          <div
                            key={ev.id}
                            className="px-3 py-2.5 bg-white border border-stone-200/80 rounded-xl space-y-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/70">
                                  {formatNumericTbilisiDate(ev.createdAt)}
                                </span>
                                {ev.action === "TEST_RUN_RECORDED" && runVerdict && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                      runVerdict === "PASSED"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                    }`}
                                  >
                                    {runVerdict === "PASSED" ? "✓ გაიარა" : "✕ ჩავარდა"}
                                  </span>
                                )}
                                <span className="font-extrabold text-stone-900">{ev.actor.name}</span>
                                <span className="text-stone-600">
                                  {ev.reason || ev.action}
                                </span>
                              </div>
                              <span className="text-[11px] text-stone-400 font-medium">
                                {formatTbilisiDateTime(ev.createdAt)}
                              </span>
                            </div>

                            {runBlocks.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {runBlocks.map((b, bIdx) => (
                                  <span
                                    key={bIdx}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                      b.status === "PASSED"
                                        ? "bg-emerald-50/70 text-emerald-800 border-emerald-200/80"
                                        : b.status === "FAILED"
                                        ? "bg-rose-50/70 text-rose-800 border-rose-200/80"
                                        : "bg-stone-50 text-stone-600 border-stone-200"
                                    }`}
                                  >
                                    {b.status === "PASSED" ? "✓" : b.status === "FAILED" ? "✕" : "•"} {b.title}
                                    {b.note ? ` — ${b.note}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(task.status === TaskStatus.IN_PROGRESS || testedSubtasks > 0) && (
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
                        <span className="text-[11px] text-stone-500 font-medium">
                          დასრულებისას შედეგი შეინახება რეესტრის ისტორიაში და გვერდი დაბრუნდება საწყის მდგომარეობაში.
                        </span>
                        <button
                          type="button"
                          disabled={finishingTaskId === task.id}
                          onClick={(e) => handleFinishTest(task, e)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                        >
                          <CheckCircle2 size={14} />
                          <span>
                            {finishingTaskId === task.id ? "ინახება..." : "ტესტის დასრულება"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Start Test Confirmation Popup */}
      {startConfirmTask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/45 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isStartingTest && setStartConfirmTask(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Play size={16} fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">ტესტირების დაწყება</h3>
                  <p className="text-[11px] text-stone-500">
                    {getTaskCode(startConfirmTask)} • {startConfirmTask.project?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isStartingTest}
                onClick={() => setStartConfirmTask(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl text-xs text-stone-800 space-y-2">
              <p className="font-bold leading-relaxed">
                <span className="text-emerald-700">{currentUser?.name || "მომხმარებელი"}</span>, ნამდვილად გსურთ{" "}
                <span className="font-black text-stone-900">„{startConfirmTask.title}“</span>-ის ტესტირების დაწყება?
              </p>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-600 pt-1">
                <Calendar size={13} className="text-emerald-600 shrink-0" />
                <span>
                  თარიღი: <strong className="text-stone-900 font-mono">{todayFormatted}</strong> (ავტომატურად არჩეული)
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                დაწყების შემდეგ ეს ჩანაწერი შეინახება ტესტირების ისტორიაში თქვენი სახელითა და თარიღით.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isStartingTest}
                onClick={() => setStartConfirmTask(null)}
                className="px-4 py-2 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer"
              >
                გაუქმება
              </button>
              <button
                type="button"
                disabled={isStartingTest}
                onClick={handleConfirmStartTest}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play size={12} fill="currentColor" />
                <span>{isStartingTest ? "იწყება..." : "დიახ, ტესტის დაწყება"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
