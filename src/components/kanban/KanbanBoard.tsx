"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Circle,
  Clock,
  CheckCircle2,
  Folder,
  Calendar,
  GripVertical,
  Pause,
  Ban,
  RotateCcw,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";
import { Priority, TaskStatus } from "@prisma/client";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { BacklogTask } from "@/components/SharedBacklog";

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
  projects: ProjectOption[];
  users: UserOption[];
  isAdmin: boolean;
  onNavigateToTimeline?: () => void;
}

type KanbanColumnId = "TODO" | "IN_PROGRESS" | "DONE";

export function KanbanBoard({
  tasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTask,
  onStatusChange,
  projects,
  users,
  isAdmin,
  onNavigateToTimeline,
}: KanbanBoardProps) {
  // View mode switcher: Board (დაფა) vs Table (ცხრილი)
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // Search and Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Exclude cancelled tasks from active kanban board
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
  }, [tasks, searchQuery, selectedProject, selectedPriority, selectedUser]);

  // Group tasks into 3 columns
  const columnsData = useMemo(() => {
    const todo = filteredTasks.filter(
      (t) => t.status === TaskStatus.BACKLOG || t.status === TaskStatus.PLANNED
    );
    const inProgress = filteredTasks.filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        t.status === TaskStatus.PAUSED ||
        t.status === TaskStatus.BLOCKED
    );
    const done = filteredTasks.filter((t) => t.status === TaskStatus.DONE);

    return {
      TODO: todo,
      IN_PROGRESS: inProgress,
      DONE: done,
    };
  }, [filteredTasks]);

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

  // Helper: Render Priority Badge matching reference `# Priority` format
  const renderPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            # Urgent
          </span>
        );
      case Priority.HIGH:
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            # High
          </span>
        );
      case Priority.MEDIUM:
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-50/70 text-blue-700 border border-blue-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            # Medium
          </span>
        );
      case Priority.LOW:
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/80">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            # Low
          </span>
        );
    }
  };

  // Helper: Render Status Dot / Badge matching reference format
  const renderStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return (
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case TaskStatus.IN_PROGRESS:
        return (
          <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Progress
          </span>
        );
      case TaskStatus.PAUSED:
        return (
          <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
            <Pause size={11} className="text-amber-500" />
            Paused
          </span>
        );
      case TaskStatus.BLOCKED:
        return (
          <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
            <Ban size={11} className="text-rose-500" />
            Blocked
          </span>
        );
      case TaskStatus.PLANNED:
        return (
          <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Planned
          </span>
        );
      case TaskStatus.BACKLOG:
      default:
        return (
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Todo
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-hidden">
      {/* Top Header Row (Matches Approved Kanban Reference) */}
      <div className="px-5 sm:px-8 py-4 bg-white border-b border-stone-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
            Kanban Board
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Drag tasks between columns · click a card to edit
          </p>
        </div>

        {/* Action Buttons matching Approved Reference */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewTask}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>+ New Task</span>
          </button>

          <button
            onClick={() => setViewMode((prev) => (prev === "board" ? "table" : "board"))}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title={viewMode === "board" ? "Table view (ცხრილი)" : "Board view (დაფა)"}
          >
            {viewMode === "board" ? (
              <>
                <TableIcon size={14} className="text-stone-500" />
                <span>Table view</span>
              </>
            ) : (
              <>
                <LayoutGrid size={14} className="text-stone-500" />
                <span>Board view</span>
              </>
            )}
          </button>

          {onNavigateToTimeline && (
            <button
              onClick={onNavigateToTimeline}
              className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Calendar / თაიმლაინი"
            >
              <Calendar size={14} className="text-stone-500" />
              <span>Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-5 sm:px-8 py-3 bg-white/60 border-b border-stone-200/80 shrink-0 flex items-center gap-2.5 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Priorities</option>
          <option value={Priority.CRITICAL}>Urgent</option>
          <option value={Priority.HIGH}>High</option>
          <option value={Priority.MEDIUM}>Medium</option>
          <option value={Priority.LOW}>Low</option>
        </select>

        {/* User Filter */}
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Reset Filters */}
        {(searchQuery || selectedProject !== "ALL" || selectedPriority !== "ALL" || selectedUser !== "ALL") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedProject("ALL");
              setSelectedPriority("ALL");
              setSelectedUser("ALL");
            }}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Main Content Area: Board View or Table View */}
      {viewMode === "table" ? (
        /* ========================================================= */
        /* TABLE VIEW (MATCHING HEADER SWITCHER)                     */
        /* ========================================================= */
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-0">
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">დავალება</th>
                    <th className="py-3 px-4">პროექტი</th>
                    <th className="py-3 px-4">პრიორიტეტი</th>
                    <th className="py-3 px-4">სტატუსი</th>
                    <th className="py-3 px-4">შემსრულებლები</th>
                    <th className="py-3 px-4">პროგრესი</th>
                    <th className="py-3 px-4">დედლაინი</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredTasks.map((task) => (
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
                        {renderPriorityBadge(task.priority)}
                      </td>
                      <td className="py-3 px-4">
                        {renderStatusBadge(task.status)}
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
                    </tr>
                  ))}
                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-stone-400">
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
        /* 3 KANBAN COLUMNS CONTAINER                                */
        /* ========================================================= */
        <div className="flex-1 p-4 sm:p-6 overflow-x-auto overflow-y-hidden min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-full min-w-[860px]">
            {/* COLUMN 1: TO DO */}
            <div
              onDragOver={(e) => handleDragOver(e, "TODO")}
              onDragLeave={() => handleDragLeave("TODO")}
              onDrop={(e) => handleDrop(e, "TODO")}
              className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
                dragOverColumn === "TODO"
                  ? "bg-blue-50/40 border-blue-400 ring-2 ring-blue-300/40"
                  : "bg-[#F8F9FA] border-stone-200/90"
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 pb-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Circle size={15} className="text-stone-400" />
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    To Do
                  </h3>
                </div>
                <span className="text-xs font-semibold text-stone-400">
                  {columnsData.TODO.length}
                </span>
              </div>

              {/* Column Card List */}
              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0">
                {columnsData.TODO.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task.id)}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    renderPriorityBadge={renderPriorityBadge}
                    renderStatusBadge={renderStatusBadge}
                  />
                ))}

                {columnsData.TODO.length === 0 && (
                  <div className="py-12 text-center text-xs text-stone-400">
                    No tasks in To Do
                  </div>
                )}
              </div>

              {/* Pinned + Add Task button matching reference */}
              <div className="p-2.5 border-t border-stone-200/60 shrink-0 bg-transparent">
                <button
                  onClick={onOpenNewTask}
                  className="w-full py-1.5 px-2 text-stone-500 hover:text-stone-900 text-xs font-semibold flex items-center justify-start gap-1.5 transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50"
                >
                  <Plus size={14} className="text-stone-400" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>

            {/* COLUMN 2: IN PROGRESS */}
            <div
              onDragOver={(e) => handleDragOver(e, "IN_PROGRESS")}
              onDragLeave={() => handleDragLeave("IN_PROGRESS")}
              onDrop={(e) => handleDrop(e, "IN_PROGRESS")}
              className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden border-t-2 border-t-blue-500 ${
                dragOverColumn === "IN_PROGRESS"
                  ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-300/40"
                  : "bg-[#F8F9FA] border-stone-200/90"
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 pb-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-blue-500" />
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    In Progress
                  </h3>
                </div>
                <span className="text-xs font-semibold text-stone-400">
                  {columnsData.IN_PROGRESS.length}
                </span>
              </div>

              {/* Column Card List */}
              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0">
                {columnsData.IN_PROGRESS.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task.id)}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    renderPriorityBadge={renderPriorityBadge}
                    renderStatusBadge={renderStatusBadge}
                  />
                ))}

                {columnsData.IN_PROGRESS.length === 0 && (
                  <div className="py-12 text-center text-xs text-stone-400">
                    No active tasks
                  </div>
                )}
              </div>

              {/* Pinned + Add Task button matching reference */}
              <div className="p-2.5 border-t border-stone-200/60 shrink-0 bg-transparent">
                <button
                  onClick={onOpenNewTask}
                  className="w-full py-1.5 px-2 text-stone-500 hover:text-stone-900 text-xs font-semibold flex items-center justify-start gap-1.5 transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50"
                >
                  <Plus size={14} className="text-stone-400" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>

            {/* COLUMN 3: COMPLETED */}
            <div
              onDragOver={(e) => handleDragOver(e, "DONE")}
              onDragLeave={() => handleDragLeave("DONE")}
              onDrop={(e) => handleDrop(e, "DONE")}
              className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden border-t-2 border-t-emerald-500 ${
                dragOverColumn === "DONE"
                  ? "bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-300/40"
                  : "bg-[#F8F9FA] border-stone-200/90"
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 pb-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                    Completed
                  </h3>
                </div>
                <span className="text-xs font-semibold text-stone-400">
                  {columnsData.DONE.length}
                </span>
              </div>

              {/* Column Card List */}
              <div className="flex-1 overflow-y-auto px-3 py-1 space-y-3 min-h-0">
                {columnsData.DONE.map((task) => (
                  <KanbanTaskCard
                    key={task.id}
                    task={task}
                    isSelected={selectedTaskId === task.id}
                    onSelect={() => onSelectTask(task.id)}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    renderPriorityBadge={renderPriorityBadge}
                    renderStatusBadge={renderStatusBadge}
                  />
                ))}

                {columnsData.DONE.length === 0 && (
                  <div className="py-12 text-center text-xs text-stone-400">
                    No completed tasks
                  </div>
                )}
              </div>

              {/* Pinned + Add Task button matching reference */}
              <div className="p-2.5 border-t border-stone-200/60 shrink-0 bg-transparent">
                <button
                  onClick={onOpenNewTask}
                  className="w-full py-1.5 px-2 text-stone-500 hover:text-stone-900 text-xs font-semibold flex items-center justify-start gap-1.5 transition-colors cursor-pointer rounded-lg hover:bg-stone-200/50"
                >
                  <Plus size={14} className="text-stone-400" />
                  <span>Add Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// KanbanTaskCard Subcomponent (Matches Approved Visual Design)
// -------------------------------------------------------------
interface KanbanTaskCardProps {
  task: BacklogTask;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  renderPriorityBadge: (p: Priority) => React.ReactNode;
  renderStatusBadge: (s: TaskStatus) => React.ReactNode;
}

function KanbanTaskCard({
  task,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  renderPriorityBadge,
  renderStatusBadge,
}: KanbanTaskCardProps) {
  const isOverdue =
    Boolean(task.deadline) &&
    new Date(task.deadline!) < new Date() &&
    task.status !== TaskStatus.DONE &&
    task.status !== TaskStatus.CANCELLED;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group relative p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-md select-none ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-stone-200/90 hover:border-stone-300"
      }`}
    >
      {/* Top Row: Priority Badge + Status Dot */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <GripVertical
            size={13}
            className="text-stone-300 group-hover:text-stone-500 cursor-grab shrink-0"
          />
          {renderPriorityBadge(task.priority)}
        </div>
        <div className="flex items-center gap-1">
          {renderStatusBadge(task.status)}
          <span className="text-[10px] text-stone-300 hover:text-stone-500 ml-0.5">⊙</span>
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-[13px] font-bold text-stone-900 leading-snug line-clamp-2 mb-1">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed mb-2">
          {task.description}
        </p>
      )}

      {/* Project Folder Tag */}
      {task.project && (
        <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mb-2.5 truncate">
          <Folder size={12} className="shrink-0 text-stone-400" />
          <span className="truncate">{task.project.name}</span>
        </div>
      )}

      {/* Card Footer: Assignee Avatars (Left) & Due Date (Right) */}
      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        {/* Assignees */}
        <div className="flex items-center -space-x-1.5">
          {task.assignments && task.assignments.length > 0 ? (
            task.assignments.slice(0, 3).map((a) => (
              <div
                key={a.user.id}
                className="w-5 h-5 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-extrabold text-stone-700 shadow-2xs"
                title={a.user.name}
              >
                {a.user.name.charAt(0)}
              </div>
            ))
          ) : (
            <span className="text-[10px] text-stone-300 italic">დაუნიშნავი</span>
          )}
          {task.assignments && task.assignments.length > 3 && (
            <span className="text-[9px] font-bold text-stone-400 pl-2">
              +{task.assignments.length - 3}
            </span>
          )}
        </div>

        {/* Due Date */}
        {task.deadline ? (
          <div
            className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${
              isOverdue ? "text-rose-600 font-bold" : "text-stone-400"
            }`}
          >
            <Calendar size={11} className="shrink-0" />
            <span>{formatGeorgianDateShort(task.deadline)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-stone-300">უდედლაინო</span>
        )}
      </div>
    </div>
  );
}
