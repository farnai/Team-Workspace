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
  ShieldCheck,
  ListCheck,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { TaskStatus, Priority, Department, TaskType } from "@prisma/client";
import { BacklogTask } from "@/components/SharedBacklog";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

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
  projects: ProjectOption[];
  users: UserOption[];
  isAdmin: boolean;
  externalSearchQuery?: string;
  onNavigateToTimeline?: () => void;
}

type StatusFilter = "ALL" | "PLANNED" | "IN_PROGRESS" | "DONE" | "PAUSED_OR_BLOCKED";

export function QualityControlView({
  tasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTask,
  onStatusChange,
  onDeleteTask,
  projects,
  users,
  isAdmin,
  externalSearchQuery,
  onNavigateToTimeline,
}: QualityControlViewProps) {
  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("ALL");

  // Expanded Checklists State (Set of task IDs where checklist is opened)
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});

  // Local optimistic subtasks state for immediate checklist check/uncheck
  const [subtaskTogglingId, setSubtaskTogglingId] = useState<string | null>(null);

  const toggleChecklist = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedChecklists((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
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
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.PAUSED ||
        t.status === TaskStatus.BLOCKED
    ).length;
    const done = qaTasks.filter((t) => t.status === TaskStatus.DONE).length;

    let totalSubtasksCount = 0;
    let completedSubtasksCount = 0;
    for (const t of qaTasks) {
      if (t.subtasks && t.subtasks.length > 0) {
        totalSubtasksCount += t.subtasks.length;
        completedSubtasksCount += t.subtasks.filter((st) => st.status === "DONE").length;
      }
    }

    const overallRate =
      totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

    return {
      total,
      planned,
      inProgress,
      done,
      totalSubtasksCount,
      completedSubtasksCount,
      overallRate,
    };
  }, [qaTasks]);

  // Handle Subtask Toggle directly from the row checklist
  const handleToggleSubtask = async (subtaskId: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (subtaskTogglingId) return;
    setSubtaskTogglingId(subtaskId);

    const newStatus = currentStatus === "DONE" ? "TODO" : "DONE";
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      // Trigger parent task refresh through status change or custom update
      window.location.reload(); // Fallback fast sync or state update
    } catch (err) {
      console.error("Failed to update subtask status:", err);
    } finally {
      setSubtaskTogglingId(null);
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
  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return {
          label: "გამართულია (Passed)",
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
          dotColor: "bg-emerald-500",
        };
      case TaskStatus.IN_PROGRESS:
        return {
          label: "ტესტირებაშია (In Testing)",
          badgeClass: "bg-blue-50 text-blue-700 border-blue-300 font-bold",
          dotColor: "bg-blue-500",
        };
      case TaskStatus.PAUSED:
        return {
          label: "შეჩერებულია (Paused)",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-300 font-bold",
          dotColor: "bg-amber-500",
        };
      case TaskStatus.BLOCKED:
        return {
          label: "ხარვეზია ნაპოვნი (Issue)",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-300 font-bold",
          dotColor: "bg-rose-500",
        };
      default:
        return {
          label: "შესამოწმებელია (Planned)",
          badgeClass: "bg-stone-100 text-stone-700 border-stone-300 font-bold",
          dotColor: "bg-stone-400",
        };
    }
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
          <span className="text-[11px] font-bold text-stone-500 block mb-1">სულ მოდულები</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-stone-900">{stats.total}</span>
            <span className="text-[11px] font-bold text-stone-400">გვერდი / ტესტი</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-blue-600 block mb-1">ტესტირებაშია</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-700">{stats.inProgress}</span>
            <span className="text-[11px] font-bold text-blue-500">მიმდინარე</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-600 block mb-1">შესამოწმებელია</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-700">{stats.planned}</span>
            <span className="text-[11px] font-bold text-amber-500">რიგში</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-600 block mb-1">გამართულია (Passed)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-700">{stats.done}</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {stats.completedSubtasksCount}/{stats.totalSubtasksCount} პუნქტი
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
            <option value="IN_PROGRESS">ტესტირებაშია (In Progress)</option>
            <option value="PLANNED">შესამოწმებელია (Planned)</option>
            <option value="DONE">გამართულია (Passed)</option>
            <option value="PAUSED_OR_BLOCKED">შეჩერებული / ხარვეზი</option>
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
            const statusMeta = getStatusBadge(task.status);
            const isChecklistOpen = Boolean(expandedChecklists[task.id]);

            const subtasks = task.subtasks || [];
            const doneSubtasks = subtasks.filter((s) => s.status === "DONE").length;
            const totalSubtasks = subtasks.length;
            const percent = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : task.progress;

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

                      {/* Priority Tag */}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                          task.priority === Priority.CRITICAL
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : task.priority === Priority.HIGH
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-stone-50 text-stone-600 border-stone-200"
                        }`}
                      >
                        {task.priority === Priority.HIGH
                          ? "მაღალი"
                          : task.priority === Priority.CRITICAL
                          ? "კრიტიკული"
                          : "საშუალო"}
                      </span>

                      {/* Status / Condition Pill */}
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${statusMeta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`} />
                        <span>{statusMeta.label}</span>
                      </span>
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
                    {/* 1. Tester (ვის ეკუთვნის) */}
                    <div className="min-w-[120px]">
                      <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider mb-1">
                        ტესტერი
                      </span>
                      {primaryTester ? (
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
                      ) : (
                        <span className="text-xs text-stone-400 italic">დაუნიშნავი</span>
                      )}
                    </div>

                    {/* 2. Testing Dates (ბოლო ტესტირება / ვადა) */}
                    <div className="min-w-[125px]">
                      <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider mb-1">
                        ბოლო ტესტირება
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <Calendar size={13} className="text-emerald-600 shrink-0" />
                        <span>{formatTestingPeriod(task.startDate, task.deadline)}</span>
                      </div>
                    </div>

                    {/* 3. Progress / Checklist Completion */}
                    <div className="min-w-[130px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                          პროგრესი
                        </span>
                        <span className="text-xs font-extrabold text-stone-900">
                          {totalSubtasks > 0 ? `${doneSubtasks}/${totalSubtasks}` : `${percent}%`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            percent === 100
                              ? "bg-emerald-500"
                              : percent > 0
                              ? "bg-blue-600"
                              : "bg-stone-300"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* 4. Checklist Dropdown Trigger */}
                    {totalSubtasks > 0 && (
                      <button
                        type="button"
                        onClick={(e) => toggleChecklist(task.id, e)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                          isChecklistOpen
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                        }`}
                        title="სატესტო პუნქტების ნახვა"
                      >
                        <ListCheck size={14} className={isChecklistOpen ? "text-emerald-600" : "text-stone-400"} />
                        <span>პუნქტები ({totalSubtasks})</span>
                        {isChecklistOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}

                    {/* 5. Quick Status Button & Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {task.status !== TaskStatus.DONE ? (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onStatusChange(task.id, TaskStatus.DONE);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          title="გამართულად დადასტურება (Pass)"
                        >
                          <CheckCircle2 size={13} />
                          <span className="hidden sm:inline">დადასტურება</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onStatusChange(task.id, TaskStatus.IN_PROGRESS);
                          }}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="ხელახლა გახსნა"
                        >
                          <RotateCcw size={12} />
                          <span className="hidden sm:inline">გადამოწმება</span>
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

                {/* Inline Expandable Checklist Panel (No stages — pure checklist verification items) */}
                {isChecklistOpen && totalSubtasks > 0 && (
                  <div className="px-5 pb-4 pt-1 bg-stone-50/70 border-t border-stone-200/80 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-600 pt-2">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>სატესტო ჩექლისთი ({doneSubtasks}/{totalSubtasks} შესრულებულია)</span>
                      </span>
                      <span className="text-[11px] text-stone-400 font-medium">
                        დააწკაპუნეთ პუნქტზე სტატუსის შესაცვლელად
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {subtasks.map((st) => {
                        const isDone = st.status === "DONE";
                        return (
                          <div
                            key={st.id}
                            onClick={(e) => handleToggleSubtask(st.id, st.status, e)}
                            className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs transition-colors cursor-pointer ${
                              isDone
                                ? "bg-white border-emerald-200 text-stone-700 shadow-2xs"
                                : "bg-white border-stone-200 text-stone-800 hover:border-stone-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => {}}
                              className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                            />
                            <span
                              className={`flex-1 font-medium select-none ${
                                isDone ? "line-through text-stone-400" : "text-stone-800"
                              }`}
                            >
                              {st.title}
                            </span>
                            {isDone && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                                შემოწმდა ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
