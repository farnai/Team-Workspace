"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Search,
  Plus,
  Circle,
  Clock,
  CheckCircle2,
  Folder,
  Calendar,
  RotateCcw,
  Table as TableIcon,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  Check,
  Layers,
  CheckSquare,
  Trash2,
} from "lucide-react";
import { Priority, TaskStatus, Department } from "@prisma/client";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { BacklogTask } from "@/components/SharedBacklog";
import { DepartmentBadge } from "@/lib/departments";

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

interface KanbanBoardProps {
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
  onNavigateToTimeline?: () => void;
}

type KanbanColumnId = "TODO" | "IN_PROGRESS" | "DONE";
type StatusTabFilter = "ALL" | "TODO" | "IN_PROGRESS" | "DONE";

type SortField =
  | "title"
  | "project"
  | "department"
  | "priority"
  | "status"
  | "assignees"
  | "progress"
  | "deadline";

type SortDirection = "asc" | "desc";

export function KanbanBoard({
  tasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTask,
  onStatusChange,
  onDeleteTask,
  projects,
  users,
  onNavigateToTimeline,
}: KanbanBoardProps) {
  // View mode switcher: Board (დაფა) vs Table (ცხრილი) — default to board
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // Status Tab Filter (like My Work navigation tabs)
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTabFilter>("ALL");

  // Search and Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<"ALL" | "DEVELOPMENT" | "CONTENT">("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Base filtered tasks (excluding CANCELLED, matching search, project, user, priority, department)
  const baseFilteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Exclude cancelled tasks from active backlog
      if (task.status === TaskStatus.CANCELLED) return false;

      // Search query (title, description, task number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesNumber = String(task.taskNumber).includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesNumber && !matchesDesc) return false;
      }

      // Project filter
      if (selectedProject !== "ALL" && task.projectId !== selectedProject) {
        return false;
      }

      // Department filter
      if (selectedDepartment !== "ALL" && (task.department || "DEVELOPMENT") !== selectedDepartment) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== "ALL" && task.priority !== selectedPriority) {
        return false;
      }

      // User filter
      if (selectedUser !== "ALL") {
        const hasUser = task.assignments.some((a) => a.user.id === selectedUser);
        if (!hasUser) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedProject, selectedDepartment, selectedPriority, selectedUser]);

  // Status Counts for Tabs
  const counts = useMemo(() => {
    const todo = baseFilteredTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    ).length;
    const inProgress = baseFilteredTasks.filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.PAUSED ||
        t.status === TaskStatus.BLOCKED
    ).length;
    const completed = baseFilteredTasks.filter((t) => t.status === TaskStatus.DONE).length;

    return {
      total: baseFilteredTasks.length,
      todo,
      inProgress,
      completed,
    };
  }, [baseFilteredTasks]);

  // Tasks filtered by Active Status Tab
  const statusFilteredTasks = useMemo(() => {
    if (activeStatusTab === "ALL") return baseFilteredTasks;
    if (activeStatusTab === "TODO") {
      return baseFilteredTasks.filter(
        (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
      );
    }
    if (activeStatusTab === "IN_PROGRESS") {
      return baseFilteredTasks.filter(
        (t) =>
          t.status === TaskStatus.IN_PROGRESS ||
          t.status === TaskStatus.PAUSED ||
          t.status === TaskStatus.BLOCKED
      );
    }
    if (activeStatusTab === "DONE") {
      return baseFilteredTasks.filter((t) => t.status === TaskStatus.DONE);
    }
    return baseFilteredTasks;
  }, [baseFilteredTasks, activeStatusTab]);

  // Sorted tasks based on active sortField and sortDirection
  const sortedTasks = useMemo(() => {
    if (!sortField) return statusFilteredTasks;

    const priorityWeights: Record<Priority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const statusWeights: Record<TaskStatus, number> = {
      BACKLOG: 1,
      PLANNED: 2,
      IN_PROGRESS: 3,
      PAUSED: 4,
      BLOCKED: 5,
      DONE: 6,
      CANCELLED: 7,
    };

    return [...statusFilteredTasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title, "ka");
          break;

        case "project": {
          const nameA = a.project?.name || "";
          const nameB = b.project?.name || "";
          comparison = nameA.localeCompare(nameB, "ka");
          break;
        }

        case "department": {
          const depA = a.department || "DEVELOPMENT";
          const depB = b.department || "DEVELOPMENT";
          comparison = depA.localeCompare(depB);
          break;
        }

        case "priority": {
          const weightA = priorityWeights[a.priority] || 0;
          const weightB = priorityWeights[b.priority] || 0;
          comparison = weightA - weightB;
          break;
        }

        case "status": {
          const weightA = statusWeights[a.status] || 0;
          const weightB = statusWeights[b.status] || 0;
          comparison = weightA - weightB;
          break;
        }

        case "assignees": {
          const nameA = a.assignments[0]?.user.name || "";
          const nameB = b.assignments[0]?.user.name || "";
          comparison = nameA.localeCompare(nameB, "ka");
          break;
        }

        case "progress":
          comparison = a.progress - b.progress;
          break;

        case "deadline": {
          const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          comparison = timeA - timeB;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [statusFilteredTasks, sortField, sortDirection]);

  // Group tasks into columns for Board view
  const columnsData = useMemo(() => {
    const todo = baseFilteredTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    );
    const inProgress = baseFilteredTasks.filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.PAUSED ||
        t.status === TaskStatus.BLOCKED
    );
    const done = baseFilteredTasks.filter((t) => t.status === TaskStatus.DONE);

    return {
      TODO: todo,
      IN_PROGRESS: inProgress,
      DONE: done,
    };
  }, [baseFilteredTasks]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: KanbanColumnId) => {
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);

    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let targetStatus: TaskStatus = TaskStatus.IN_PROGRESS;
    if (targetCol === "TODO") {
      targetStatus = TaskStatus.BACKLOG;
    } else if (targetCol === "IN_PROGRESS") {
      targetStatus = TaskStatus.IN_PROGRESS;
    } else if (targetCol === "DONE") {
      targetStatus = TaskStatus.DONE;
    }

    if (task.status === targetStatus) return;

    try {
      await onStatusChange(taskId, targetStatus);
    } catch (err) {
      console.error("Failed to update status on drop:", err);
    }
  };

  // Helper: Render sortable column header for Table View
  const renderSortableHeader = (
    label: string,
    field: SortField,
    className = ""
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleHeaderSort(field)}
        className={`py-3 px-4 select-none cursor-pointer group hover:bg-stone-100/90 transition-colors ${className}`}
        title={`სორტირება: ${label}`}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={
              isActive
                ? "text-blue-700 font-black"
                : "text-stone-600 font-extrabold"
            }
          >
            {label}
          </span>
          <span className="shrink-0 transition-opacity">
            {isActive ? (
              sortDirection === "asc" ? (
                <ArrowUp size={12} className="text-blue-600 stroke-[2.5]" />
              ) : (
                <ArrowDown size={12} className="text-blue-600 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown
                size={12}
                className="text-stone-300 group-hover:text-stone-500 opacity-60 group-hover:opacity-100"
              />
            )}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-hidden p-3 sm:p-5 lg:p-6 space-y-3.5">
      {/* 1. Header Banner (Matching "My Work" Style Banner) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-stone-900 tracking-tight leading-tight">
              ბექლოგი (Backlog)
            </h1>
            <p className="text-[11px] text-stone-500 font-medium">
              პროექტის დავალებები, სამუშაო ეტაპები და მიმდინარე სტატუსები.
            </p>
          </div>
        </div>

        {/* Action Buttons: + New Task, View Switcher (Board vs Table), Calendar */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewTask}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>ახალი ტასკი</span>
          </button>

          <button
            onClick={() => setViewMode((prev) => (prev === "board" ? "table" : "board"))}
            className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title={viewMode === "board" ? "ცხრილის ხედი" : "დაფის ხედი"}
          >
            {viewMode === "board" ? (
              <>
                <TableIcon size={13} className="text-stone-500" />
                <span>ცხრილი</span>
              </>
            ) : (
              <>
                <LayoutGrid size={13} className="text-stone-500" />
                <span>დაფა</span>
              </>
            )}
          </button>

          {onNavigateToTimeline && (
            <button
              onClick={onNavigateToTimeline}
              className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Calendar / თაიმლაინი"
            >
              <Calendar size={13} className="text-stone-500" />
              <span className="hidden sm:inline">კალენდარი</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Status Navigation Tabs (Matching My Work Tab Style) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold select-none shrink-0">
        <button
          onClick={() => setActiveStatusTab("ALL")}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap text-xs font-bold ${
            activeStatusTab === "ALL"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
          }`}
        >
          <Layers size={13} />
          <span>ყველა ტასკი</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeStatusTab === "ALL"
                ? "bg-white/20 text-white"
                : "bg-stone-100 text-stone-700 font-bold"
            }`}
          >
            {counts.total}
          </span>
        </button>

        <button
          onClick={() => setActiveStatusTab("TODO")}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap text-xs font-bold ${
            activeStatusTab === "TODO"
              ? "bg-stone-800 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
          }`}
        >
          <Circle size={13} className="text-stone-400" />
          <span>To Do</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeStatusTab === "TODO"
                ? "bg-white/20 text-white"
                : "bg-stone-100 text-stone-700 font-bold"
            }`}
          >
            {counts.todo}
          </span>
        </button>

        <button
          onClick={() => setActiveStatusTab("IN_PROGRESS")}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap text-xs font-bold ${
            activeStatusTab === "IN_PROGRESS"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
          }`}
        >
          <Clock size={13} className="text-blue-500" />
          <span>In Progress</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeStatusTab === "IN_PROGRESS"
                ? "bg-white/20 text-white"
                : "bg-stone-100 text-stone-700 font-bold"
            }`}
          >
            {counts.inProgress}
          </span>
        </button>

        <button
          onClick={() => setActiveStatusTab("DONE")}
          className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap text-xs font-bold ${
            activeStatusTab === "DONE"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
          }`}
        >
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span>Completed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeStatusTab === "DONE"
                ? "bg-white/20 text-white"
                : "bg-stone-100 text-stone-700 font-bold"
            }`}
          >
            {counts.completed}
          </span>
        </button>
      </div>

      {/* 3. Comprehensive Filter Bar (Filter by Everything) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0 flex items-center gap-2 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ძებნა (სათაური, აღწერა, #)..."
            className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl text-xs font-normal text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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

        {/* Assignee Filter */}
        <div className="relative">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">ყველა შემსრულებელი</option>
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

        {/* Department / Team Filter */}
        <div className="relative">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value as "ALL" | "DEVELOPMENT" | "CONTENT")}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">ყველა გუნდი</option>
            <option value="DEVELOPMENT">💻 დეველოპმენტი</option>
            <option value="CONTENT">✍️ კონტენტი</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
        </div>

        {/* Priority Filter */}
        <div className="relative">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="appearance-none bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-xl pl-3 pr-7 py-1.5 text-xs font-normal text-stone-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">ყველა პრიორიტეტი</option>
            <option value={Priority.CRITICAL}>Urgent</option>
            <option value={Priority.HIGH}>High</option>
            <option value={Priority.MEDIUM}>Medium</option>
            <option value={Priority.LOW}>Low</option>
          </select>
          <ChevronDown
            size={12}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
        </div>

        {/* Reset Filters Button */}
        {(searchQuery || selectedProject !== "ALL" || selectedDepartment !== "ALL" || selectedPriority !== "ALL" || selectedUser !== "ALL" || activeStatusTab !== "ALL") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedProject("ALL");
              setSelectedDepartment("ALL");
              setSelectedPriority("ALL");
              setSelectedUser("ALL");
              setActiveStatusTab("ALL");
            }}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>გასუფთავება</span>
          </button>
        )}
      </div>

      {/* 4. Main Content Area: Board View (With Clean Box Design) or Table View */}
      {viewMode === "table" ? (
        /* ========================================================= */
        /* TABLE VIEW (INTERACTIVE SORTING ON ALL HEADERS)           */
        /* ========================================================= */
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 font-extrabold uppercase text-[10px] tracking-wider">
                    {renderSortableHeader("დავალება", "title")}
                    {renderSortableHeader("პროექტი", "project")}
                    {renderSortableHeader("გუნდი", "department")}
                    {renderSortableHeader("პრიორიტეტი", "priority")}
                    {renderSortableHeader("სტატუსი", "status")}
                    {renderSortableHeader("შემსრულებლები", "assignees")}
                    {renderSortableHeader("პროგრესი", "progress")}
                    {renderSortableHeader("დედლაინი", "deadline")}
                    <th className="py-3 px-4 text-right w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sortedTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask(task.id)}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        selectedTaskId === task.id ? "bg-blue-50/70" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-stone-900 max-w-xs truncate">
                        <span className="font-mono text-stone-400 mr-2 text-[11px]">
                          #{task.taskNumber}
                        </span>
                        {task.title}
                      </td>
                      <td className="py-3 px-4 text-stone-600">
                        {task.project ? (
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Folder size={12} className="text-stone-400" />
                            {task.project.name}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <DepartmentBadge department={task.department} size="xs" />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-semibold text-stone-700">
                          {task.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[11px] font-medium text-stone-600">
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center -space-x-1.5">
                          {task.assignments && task.assignments.length > 0 ? (
                            task.assignments.slice(0, 3).map((a) => (
                              <div
                                key={a.user.id}
                                className="w-5 h-5 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-bold text-stone-700 shadow-2xs"
                                title={a.user.name}
                              >
                                {a.user.name.charAt(0)}
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-stone-400 italic">დაუნიშნავი</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-stone-700">
                        {task.progress}%
                      </td>
                      <td className="py-3 px-4 text-stone-600 font-medium">
                        {task.deadline ? (
                          <span className="flex items-center gap-1 font-semibold text-stone-700">
                            <Calendar size={12} className="text-stone-400" />
                            {formatGeorgianDateShort(task.deadline)}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">უდედლაინო</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {onDeleteTask && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `დარწმუნებული ხართ, რომ გსურთ დავალების წაშლა (#${task.taskNumber}: ${task.title})?`
                                )
                              ) {
                                await onDeleteTask(task.id);
                              }
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ტასკის წაშლა"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {sortedTasks.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-xs text-stone-400">
                        დავალებები ვერ მოიძებნა
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* BOARD VIEW (MATCHING EXACT APPROVED BOX DESIGN)           */
        /* ========================================================= */
        <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
          <div
            className={`grid gap-4 h-full ${
              activeStatusTab === "ALL"
                ? "grid-cols-1 md:grid-cols-3 min-w-[860px]"
                : "grid-cols-1 max-w-xl mx-auto"
            }`}
          >
            {/* COLUMN 1: TO DO */}
            {(activeStatusTab === "ALL" || activeStatusTab === "TODO") && (
              <div
                onDragOver={(e) => handleDragOver(e, "TODO")}
                onDragLeave={() => handleDragLeave("TODO")}
                onDrop={(e) => handleDrop(e, "TODO")}
                className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
                  dragOverColumn === "TODO"
                    ? "bg-blue-50/40 border-blue-400 ring-2 ring-blue-300/40"
                    : "bg-[#F8F9FA] border-stone-200/90 shadow-2xs"
                }`}
              >
                {/* Column Header: "To Do  {count}" */}
                <div className="p-3.5 pb-2 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-stone-800 tracking-tight flex items-center gap-2">
                    <span>To Do</span>
                    <span className="text-stone-500 font-normal text-sm">
                      {columnsData.TODO.length}
                    </span>
                  </h3>
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2.5 min-h-0">
                  {columnsData.TODO.map((task) => (
                    <KanbanTaskBox
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onSelect={() => onSelectTask(task.id)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {columnsData.TODO.length === 0 && (
                    <div className="py-8 text-center text-xs text-stone-400">
                      დავალებები არ არის
                    </div>
                  )}

                  {/* Dashed "+" Button Matching Approved Reference Box Design */}
                  <button
                    onClick={onOpenNewTask}
                    className="w-full py-2 border border-dashed border-stone-300 hover:border-stone-400 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white/60 transition-all cursor-pointer mt-1"
                    title="ახალი ტასკის დამატება"
                  >
                    <Plus size={16} strokeWidth={2} className="text-stone-400" />
                  </button>
                </div>
              </div>
            )}

            {/* COLUMN 2: IN PROGRESS */}
            {(activeStatusTab === "ALL" || activeStatusTab === "IN_PROGRESS") && (
              <div
                onDragOver={(e) => handleDragOver(e, "IN_PROGRESS")}
                onDragLeave={() => handleDragLeave("IN_PROGRESS")}
                onDrop={(e) => handleDrop(e, "IN_PROGRESS")}
                className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
                  dragOverColumn === "IN_PROGRESS"
                    ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-300/40"
                    : "bg-[#F8F9FA] border-stone-200/90 shadow-2xs"
                }`}
              >
                {/* Column Header: "In Progress  {count}" */}
                <div className="p-3.5 pb-2 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-stone-800 tracking-tight flex items-center gap-2">
                    <span>In Progress</span>
                    <span className="text-stone-500 font-normal text-sm">
                      {columnsData.IN_PROGRESS.length}
                    </span>
                  </h3>
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2.5 min-h-0">
                  {columnsData.IN_PROGRESS.map((task) => (
                    <KanbanTaskBox
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onSelect={() => onSelectTask(task.id)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {columnsData.IN_PROGRESS.length === 0 && (
                    <div className="py-8 text-center text-xs text-stone-400">
                      დავალებები არ არის
                    </div>
                  )}

                  {/* Dashed "+" Button Matching Approved Reference Box Design */}
                  <button
                    onClick={onOpenNewTask}
                    className="w-full py-2 border border-dashed border-stone-300 hover:border-stone-400 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white/60 transition-all cursor-pointer mt-1"
                    title="ახალი ტასკის დამატება"
                  >
                    <Plus size={16} strokeWidth={2} className="text-stone-400" />
                  </button>
                </div>
              </div>
            )}

            {/* COLUMN 3: COMPLETED */}
            {(activeStatusTab === "ALL" || activeStatusTab === "DONE") && (
              <div
                onDragOver={(e) => handleDragOver(e, "DONE")}
                onDragLeave={() => handleDragLeave("DONE")}
                onDrop={(e) => handleDrop(e, "DONE")}
                className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
                  dragOverColumn === "DONE"
                    ? "bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-300/40"
                    : "bg-[#F8F9FA] border-stone-200/90 shadow-2xs"
                }`}
              >
                {/* Column Header: "Completed  {count}" */}
                <div className="p-3.5 pb-2 flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold text-stone-800 tracking-tight flex items-center gap-2">
                    <span>Completed</span>
                    <span className="text-stone-500 font-normal text-sm">
                      {columnsData.DONE.length}
                    </span>
                  </h3>
                </div>

                {/* Column Card List */}
                <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2.5 min-h-0">
                  {columnsData.DONE.map((task) => (
                    <KanbanTaskBox
                      key={task.id}
                      task={task}
                      isSelected={selectedTaskId === task.id}
                      onSelect={() => onSelectTask(task.id)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {columnsData.DONE.length === 0 && (
                    <div className="py-8 text-center text-xs text-stone-400">
                      დავალებები არ არის
                    </div>
                  )}

                  {/* Dashed "+" Button Matching Approved Reference Box Design */}
                  <button
                    onClick={onOpenNewTask}
                    className="w-full py-2 border border-dashed border-stone-300 hover:border-stone-400 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-white/60 transition-all cursor-pointer mt-1"
                    title="ახალი ტასკის დამატება"
                  >
                    <Plus size={16} strokeWidth={2} className="text-stone-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// KanbanTaskBox Subcomponent (Matching Exact Image Design)
// -------------------------------------------------------------
interface KanbanTaskBoxProps {
  task: BacklogTask;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function KanbanTaskBox({
  task,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
}: KanbanTaskBoxProps) {
  // Format task code: matching exact reference design e.g. SSP-7
  const taskCode = useMemo(() => {
    if (task.project?.name) {
      const letters = task.project.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      if (letters.length >= 2 && letters !== "PROJECT") {
        return `${letters.slice(0, 3)}-${task.taskNumber}`;
      }
    }
    return `SSP-${task.taskNumber}`;
  }, [task.project?.name, task.taskNumber]);

  const primaryAssignee = task.assignments?.[0]?.user;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group relative p-3.5 sm:p-4 bg-white rounded-xl border transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-xs select-none flex flex-col justify-between ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200 shadow-xs"
          : "border-stone-200/90 hover:border-stone-300"
      }`}
    >
      {/* 1. Task Title (Textual, Clean, Minimalist, Legible) */}
      <h4 className="text-[14px] sm:text-[15px] font-normal text-stone-900 leading-snug line-clamp-3 mb-2.5">
        {task.title}
      </h4>

      {/* 2. Bottom Row: [☑] Task Number (Left) & Assignee Avatar (Right) */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          {/* Blue Outline Checkbox Square Matching Exact Screenshot */}
          <svg
            className="w-4 h-4 text-blue-600 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          {/* Task Code (e.g. SSP-7) */}
          <span className="text-[13px] font-medium text-stone-700 tracking-tight">
            {taskCode}
          </span>
          <DepartmentBadge department={task.department} size="xs" />
        </div>

        {/* Assignee Avatar (ONLY if someone is assigned) */}
        {primaryAssignee && (
          <div
            className="w-6 h-6 rounded-full overflow-hidden border border-white shadow-2xs shrink-0 flex items-center justify-center bg-stone-200 text-[10px] font-bold text-stone-700"
            title={primaryAssignee.name}
          >
            {primaryAssignee.avatarUrl ? (
              <Image
                src={primaryAssignee.avatarUrl}
                alt={primaryAssignee.name}
                width={24}
                height={24}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              primaryAssignee.name.charAt(0)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
