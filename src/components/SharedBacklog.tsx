"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Filter,
  X,
  ChevronDown,
  RotateCcw,
  Lock,
  Calendar,
  CheckCircle2,
  MoreVertical,
  Edit2,
  Ban,
  Play,
  Layers,
} from "lucide-react";
import { TaskType, Priority, TaskStatus } from "@prisma/client";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

export interface BacklogTask {
  id: string;
  taskNumber: number;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  startDate?: string | null;
  deadline?: string | null;
  deadlineLocked: boolean;
  progress: number;
  projectId: string;
  project?: { id: string; name: string; color?: string | null };
  assignments: {
    user: {
      id: string;
      name: string;
      avatarUrl?: string | null;
      role: "ADMIN" | "USER";
    };
  }[];
  subtasks?: { id: string; status: string }[];
  stages?: {
    id: string;
    title: string;
    isCompleted: boolean;
    subtasks?: { id: string; status: string }[];
  }[];
}

interface SharedBacklogProps {
  tasks: BacklogTask[];
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  onOpenNewTask: () => void;
  onEditTask: (task: BacklogTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onClose?: () => void;
  projects: { id: string; name: string }[];
  users: { id: string; name: string }[];
  isAdmin: boolean;
}

export function SharedBacklog({
  tasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTask,
  onEditTask,
  onStatusChange,
  onClose,
  projects,
  users,
}: SharedBacklogProps) {
  // Filtering & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [quickFilter, setQuickFilter] = useState<"ALL" | "UNASSIGNED" | "OVERDUE" | "UNSCHEDULED">("ALL");
  const [sortBy, setSortBy] = useState<"priority" | "deadline" | "createdAt" | "taskNumber">("priority");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  // Filtered and Sorted Tasks
  const filteredTasks = useMemo(() => {
    const now = new Date();

    return tasks
      .filter((task) => {
        // Search filter (Title or Task Number)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const taskCode = `task-${task.taskNumber}`.toLowerCase();
          const numMatch = task.taskNumber.toString() === searchQuery.replace(/\D/g, "");
          const titleMatch = task.title.toLowerCase().includes(q);
          const descMatch = task.description?.toLowerCase().includes(q) || false;
          if (!titleMatch && !descMatch && !taskCode.includes(q) && !numMatch) {
            return false;
          }
        }

        // Type filter
        if (typeFilter !== "ALL" && task.type !== typeFilter) {
          return false;
        }

        // Status filter
        if (statusFilter !== "ALL" && task.status !== statusFilter) {
          return false;
        }

        // Project filter
        if (projectFilter !== "ALL" && task.projectId !== projectFilter) {
          return false;
        }

        // Assignee filter
        if (assigneeFilter !== "ALL") {
          const hasAssignee = task.assignments.some(
            (a) => a.user.id === assigneeFilter
          );
          if (!hasAssignee) return false;
        }

        // Priority filter
        if (priorityFilter !== "ALL" && task.priority !== priorityFilter) {
          return false;
        }

        // Quick filters
        if (quickFilter === "UNASSIGNED" && task.assignments.length > 0) {
          return false;
        }
        if (quickFilter === "UNSCHEDULED" && (task.deadline || task.startDate)) {
          return false;
        }
        if (quickFilter === "OVERDUE") {
          if (!task.deadline) return false;
          if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) return false;
          const deadlineDate = new Date(task.deadline);
          if (deadlineDate >= now) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "priority") {
          const pOrder: Record<Priority, number> = {
            CRITICAL: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
          };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        }
        if (sortBy === "deadline") {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        if (sortBy === "taskNumber") {
          return b.taskNumber - a.taskNumber;
        }
        return b.taskNumber - a.taskNumber;
      });
  }, [
    tasks,
    searchQuery,
    typeFilter,
    statusFilter,
    projectFilter,
    assigneeFilter,
    priorityFilter,
    quickFilter,
    sortBy,
  ]);

  const resetFilters = () => {
    setSearchQuery("");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setProjectFilter("ALL");
    setAssigneeFilter("ALL");
    setPriorityFilter("ALL");
    setQuickFilter("ALL");
    setSortBy("priority");
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    typeFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    projectFilter !== "ALL" ||
    assigneeFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    quickFilter !== "ALL";

  const renderTypeBadge = (type: TaskType) => {
    switch (type) {
      case TaskType.FEATURE:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
            Feature
          </span>
        );
      case TaskType.BUG:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
            Bug
          </span>
        );
      case TaskType.HOTFIX:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
            Hotfix
          </span>
        );
      default:
        return null;
    }
  };

  const renderStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.BACKLOG:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-600">
            Backlog
          </span>
        );
      case TaskStatus.PLANNED:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
            Planned
          </span>
        );
      case TaskStatus.IN_PROGRESS:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
            In Progress
          </span>
        );
      case TaskStatus.PAUSED:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
            Paused
          </span>
        );
      case TaskStatus.BLOCKED:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
            Blocked
          </span>
        );
      case TaskStatus.DONE:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            Done
          </span>
        );
      case TaskStatus.CANCELLED:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 text-stone-400 line-through">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const renderPriorityDot = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return (
          <span
            className="w-2 h-2 rounded-full bg-rose-600 ring-2 ring-rose-200"
            title="კრიტიკული პრიორიტეტი"
          />
        );
      case Priority.HIGH:
        return (
          <span
            className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-200"
            title="მაღალი პრიორიტეტი"
          />
        );
      case Priority.MEDIUM:
        return (
          <span
            className="w-2 h-2 rounded-full bg-blue-400"
            title="საშუალო პრიორიტეტი"
          />
        );
      case Priority.LOW:
        return (
          <span
            className="w-2 h-2 rounded-full bg-stone-300"
            title="დაბალი პრიორიტეტი"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-stone-200/80 select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                საერთო ბექლოგი
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-stone-100 text-stone-700">
                {filteredTasks.length} / {tasks.length}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              ტასკების ერთიანი სივრცე და ფილტრები
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenNewTask}
            className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-full text-xs font-semibold shadow-2xs hover:shadow transition-all cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>ახალი</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
              title="ბექლოგის დახურვა"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search & Main Filter Controls */}
      <div className="p-3 border-b border-stone-100 bg-stone-50/50 space-y-2.5 shrink-0">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ძებნა ბექლოგში (სათაური, #ID)..."
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-full text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 text-stone-400 hover:text-stone-700"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Type Category Pills: ყველა / Feature / Bug / Hotfix */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "ALL", label: "ყველა" },
            { id: TaskType.FEATURE, label: "Features" },
            { id: TaskType.BUG, label: "Bugs" },
            { id: TaskType.HOTFIX, label: "Hotfix" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTypeFilter(item.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                typeFilter === item.id
                  ? "bg-orange-600 text-white shadow-2xs font-bold"
                  : "bg-white border border-stone-200/90 text-stone-600 hover:bg-stone-100/70"
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
              showAdvancedFilters || hasActiveFilters
                ? "bg-orange-50 border-orange-200 text-orange-700 font-bold"
                : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Filter size={12} />
            <span>ფილტრები</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${
                showAdvancedFilters ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="pt-2 border-t border-stone-200/70 space-y-2 animate-in slide-in-from-top-2 duration-150 text-xs">
            {/* Quick Filter Badges */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "ALL", label: "ყველა" },
                { id: "UNASSIGNED", label: "დაუნიშნავი" },
                { id: "OVERDUE", label: "ვადაგადაცილებული" },
                { id: "UNSCHEDULED", label: "უდედლაინო" },
              ].map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuickFilter(q.id as typeof quickFilter)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                    quickFilter === q.id
                      ? "bg-stone-800 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* Dropdown Filters Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">
                  სტატუსი
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none"
                >
                  <option value="ALL">ყველა სტატუსი</option>
                  <option value={TaskStatus.BACKLOG}>Backlog</option>
                  <option value={TaskStatus.PLANNED}>Planned</option>
                  <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                  <option value={TaskStatus.PAUSED}>Paused</option>
                  <option value={TaskStatus.BLOCKED}>Blocked</option>
                  <option value={TaskStatus.DONE}>Done</option>
                  <option value={TaskStatus.CANCELLED}>Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">
                  პროექტი
                </label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none"
                >
                  <option value="ALL">ყველა პროექტი</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">
                  შემსრულებელი
                </label>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none"
                >
                  <option value="ALL">ყველა ადამიანი</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-0.5">
                  დალაგება
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full px-2 py-1 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:outline-none"
                >
                  <option value="priority">პრიორიტეტით (უმაღლესი)</option>
                  <option value="deadline">დედლაინით (უახლოესი)</option>
                  <option value="taskNumber">ტასკის #</option>
                </select>
              </div>
            </div>

            {/* Reset Filters Link */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer pt-1"
              >
                <RotateCcw size={12} />
                <span>ფილტრების გასუფთავება</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Task Cards Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200">
            <Layers size={24} className="mx-auto text-stone-400 mb-2" />
            <h4 className="text-xs font-bold text-stone-800">
              ტასკები ვერ მოიძებნა
            </h4>
            <p className="text-[11px] text-stone-500 mt-0.5">
              სცადეთ ფილტრების გასუფთავება ან შექმენით ახალი ტასკი.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1 bg-white border border-stone-200 text-stone-700 rounded-full text-xs font-semibold hover:bg-stone-50 cursor-pointer"
              >
                ფილტრების გასუფთავება
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isSelected = selectedTaskId === task.id;
            const now = new Date();
            const isOverdue =
              Boolean(task.deadline) &&
              new Date(task.deadline!) < now &&
              task.status !== TaskStatus.DONE &&
              task.status !== TaskStatus.CANCELLED;

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`group relative p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-50/50 border-orange-500 ring-2 ring-orange-500/10 shadow-xs"
                    : "bg-white border-stone-200/90 hover:border-stone-300 hover:shadow-xs"
                }`}
              >
                {/* Top Row: Task Number + Type + Priority + Quick Menu */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-extrabold text-stone-500 font-mono">
                      TASK-{task.taskNumber}
                    </span>
                    {renderTypeBadge(task.type)}
                    {renderPriorityDot(task.priority)}
                    {renderStatusBadge(task.status)}
                  </div>

                  {/* Actions Dropdown Toggle */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuTaskId(
                          activeMenuTaskId === task.id ? null : task.id
                        );
                      }}
                      className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      title="ქმედებები"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {/* Quick Actions Dropdown */}
                    {activeMenuTaskId === task.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-stone-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs"
                      >
                        <button
                          onClick={() => {
                            setActiveMenuTaskId(null);
                            onEditTask(task);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-stone-700 hover:bg-stone-100 font-medium"
                        >
                          <Edit2 size={13} className="text-stone-500" />
                          <span>რედაქტირება</span>
                        </button>

                        <div className="border-t border-stone-100 my-1" />

                        {/* Quick Status Transitions */}
                        {task.status !== TaskStatus.IN_PROGRESS && (
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              onStatusChange(task.id, TaskStatus.IN_PROGRESS);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-blue-700 hover:bg-blue-50 font-medium"
                          >
                            <Play size={13} className="text-blue-500" />
                            <span>დაწყება (In Progress)</span>
                          </button>
                        )}

                        {task.status !== TaskStatus.DONE && (
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              onStatusChange(task.id, TaskStatus.DONE);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-emerald-700 hover:bg-emerald-50 font-medium"
                          >
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <span>დასრულება (Done)</span>
                          </button>
                        )}

                        {task.status !== TaskStatus.CANCELLED ? (
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              onStatusChange(task.id, TaskStatus.CANCELLED);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-700 hover:bg-rose-50 font-medium"
                          >
                            <Ban size={13} className="text-rose-500" />
                            <span>გაუქმება (Cancel)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveMenuTaskId(null);
                              onStatusChange(task.id, TaskStatus.BACKLOG);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-stone-700 hover:bg-stone-100 font-medium"
                          >
                            <RotateCcw size={13} className="text-stone-500" />
                            <span>გახსნა (Reopen)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xs font-bold text-stone-900 group-hover:text-orange-600 transition-colors line-clamp-2 leading-snug">
                  {task.title}
                </h3>

                {/* Progress Bar (if subtasks exist or progress > 0) */}
                {task.progress > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-stone-500">
                      <span>პროგრესი</span>
                      <span className="font-bold text-stone-700">
                        {task.progress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Meta Row: Project, Deadline, Assignees */}
                <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-[11px]">
                  {/* Deadline Pill */}
                  <div className="flex items-center gap-1.5">
                    {task.deadline ? (
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          isOverdue
                            ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md"
                            : "text-stone-600"
                        }`}
                      >
                        <Calendar size={12} className={isOverdue ? "text-rose-600" : "text-stone-400"} />
                        <span>{formatGeorgianDateShort(task.deadline)}</span>
                        {task.deadlineLocked && (
                          <span title="დედლაინი დაფიქსირებულია">
                            <Lock size={10} className="text-stone-400" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-stone-400 text-[10px]">უდედლაინო</span>
                    )}

                    {task.project && (
                      <span className="text-stone-400 text-[10px] font-medium hidden sm:inline">
                        • {task.project.name}
                      </span>
                    )}
                  </div>

                  {/* Assignees Avatars */}
                  <div className="flex items-center -space-x-1.5">
                    {task.assignments.length === 0 ? (
                      <span className="text-[10px] text-stone-400 font-medium">
                        დაუნიშნავი
                      </span>
                    ) : (
                      task.assignments.map((a) => (
                        <div
                          key={a.user.id}
                          className="w-5 h-5 rounded-full bg-orange-100 border border-white flex items-center justify-center text-[10px] font-bold text-orange-700 shadow-2xs"
                          title={a.user.name}
                        >
                          {a.user.name.charAt(0)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
