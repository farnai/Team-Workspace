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
}: KanbanBoardProps) {
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

  // Helper: Render Priority Badge
  const renderPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case Priority.CRITICAL:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Urgent
          </span>
        );
      case Priority.HIGH:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            High
          </span>
        );
      case Priority.MEDIUM:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Medium
          </span>
        );
      case Priority.LOW:
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Low
          </span>
        );
    }
  };

  // Helper: Render Status Dot / Badge
  const renderStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE:
        return (
          <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
        );
      case TaskStatus.IN_PROGRESS:
        return (
          <span className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Progress
          </span>
        );
      case TaskStatus.PAUSED:
        return (
          <span className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
            <Pause size={10} className="text-amber-500" />
            Paused
          </span>
        );
      case TaskStatus.BLOCKED:
        return (
          <span className="text-[10px] font-semibold text-rose-700 flex items-center gap-1">
            <Ban size={10} className="text-rose-500" />
            Blocked
          </span>
        );
      case TaskStatus.PLANNED:
        return (
          <span className="text-[10px] font-semibold text-indigo-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Planned
          </span>
        );
      case TaskStatus.BACKLOG:
      default:
        return (
          <span className="text-[10px] font-semibold text-stone-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            To Do
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-hidden">
      {/* Top Header Row (Matches Approved Kanban Reference) */}
      <div className="px-5 sm:px-8 py-4 bg-white border-b border-stone-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
              Kanban Board
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              ბექლოგის დაფა
            </span>
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Admin
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            გადაიტანეთ ტასკები სვეტებს შორის • დააწკაპუნეთ ბარათზე დეტალებისთვის
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewTask}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>+ New Task</span>
          </button>
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
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Projects (ყველა პროექტი)</option>
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
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Priorities (ყველა პრიორიტეტი)</option>
          <option value={Priority.CRITICAL}>Urgent / Critical</option>
          <option value={Priority.HIGH}>High</option>
          <option value={Priority.MEDIUM}>Medium</option>
          <option value={Priority.LOW}>Low</option>
        </select>

        {/* User Filter */}
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">All Assignees (ყველა წევრი)</option>
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
            <span>გასუფთავება</span>
          </button>
        )}
      </div>

      {/* 3 Kanban Columns Container */}
      <div className="flex-1 p-4 sm:p-6 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-full min-w-[860px]">
          {/* ========================================================= */}
          {/* COLUMN 1: TO DO (შესასრულებელი / ბექლოგი)                  */}
          {/* ========================================================= */}
          <div
            onDragOver={(e) => handleDragOver(e, "TODO")}
            onDragLeave={() => handleDragLeave("TODO")}
            onDrop={(e) => handleDrop(e, "TODO")}
            className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
              dragOverColumn === "TODO"
                ? "bg-blue-50/40 border-blue-400 ring-2 ring-blue-300/40"
                : "bg-stone-100/50 border-stone-200/90"
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Circle size={15} className="text-stone-400" />
                <h3 className="text-sm font-black text-stone-900 tracking-tight">
                  To Do
                </h3>
                <span className="text-xs text-stone-500 font-semibold">
                  (შესასრულებელი)
                </span>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                {columnsData.TODO.length}
              </span>
            </div>

            {/* Column Card List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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
                <div className="py-10 text-center text-xs text-stone-400">
                  ტასკები არ არის
                </div>
              )}

              {/* + Add Task button inside To Do column (matching reference) */}
              <button
                onClick={onOpenNewTask}
                className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 hover:border-stone-400 text-stone-600 hover:text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors bg-white/70 hover:bg-white cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Task</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 2: IN PROGRESS (მიმდინარე / მუშაობაში)             */}
          {/* ========================================================= */}
          <div
            onDragOver={(e) => handleDragOver(e, "IN_PROGRESS")}
            onDragLeave={() => handleDragLeave("IN_PROGRESS")}
            onDrop={(e) => handleDrop(e, "IN_PROGRESS")}
            className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden border-t-4 border-t-blue-500 ${
              dragOverColumn === "IN_PROGRESS"
                ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-300/40"
                : "bg-stone-100/50 border-stone-200/90"
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-blue-600" />
                <h3 className="text-sm font-black text-stone-900 tracking-tight">
                  In Progress
                </h3>
                <span className="text-xs text-stone-500 font-semibold">
                  (მიმდინარე)
                </span>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {columnsData.IN_PROGRESS.length}
              </span>
            </div>

            {/* Column Card List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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
                <div className="py-10 text-center text-xs text-stone-400">
                  მიმდინარე სამუშაოები არ არის
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 3: COMPLETED (დასრულებული)                         */}
          {/* ========================================================= */}
          <div
            onDragOver={(e) => handleDragOver(e, "DONE")}
            onDragLeave={() => handleDragLeave("DONE")}
            onDrop={(e) => handleDrop(e, "DONE")}
            className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden border-t-4 border-t-emerald-500 ${
              dragOverColumn === "DONE"
                ? "bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-300/40"
                : "bg-stone-100/50 border-stone-200/90"
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 bg-white border-b border-stone-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <h3 className="text-sm font-black text-stone-900 tracking-tight">
                  Completed
                </h3>
                <span className="text-xs text-stone-500 font-semibold">
                  (დასრულებული)
                </span>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {columnsData.DONE.length}
              </span>
            </div>

            {/* Column Card List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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
                <div className="py-10 text-center text-xs text-stone-400">
                  დასრულებული ტასკები არ არის
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
        <div>{renderStatusBadge(task.status)}</div>
      </div>

      {/* Task Title */}
      <h4 className="text-xs sm:text-[13px] font-bold text-stone-900 leading-snug line-clamp-2 mb-1">
        <span className="font-mono text-stone-400 font-medium mr-1.5">
          #{task.taskNumber}
        </span>
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed mb-2.5">
          {task.description}
        </p>
      )}

      {/* Project Folder Tag */}
      {task.project && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-stone-500 mb-2.5 truncate">
          <Folder size={12} className="shrink-0 text-stone-400" />
          <span className="truncate">{task.project.name}</span>
        </div>
      )}

      {/* Progress Bar (if in progress or completed) */}
      {task.progress > 0 && (
        <div className="mb-2.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 mb-0.5">
            <span>პროგრესი</span>
            <span>{task.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                task.status === TaskStatus.DONE
                  ? "bg-emerald-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Assignee Avatars (Left) & Due Date (Right) */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
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
            <span className="text-[10px] text-stone-400 italic">დაუნიშნავი</span>
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
            className={`flex items-center gap-1 text-[10px] font-semibold shrink-0 ${
              isOverdue ? "text-rose-600 font-bold" : "text-stone-500"
            }`}
          >
            <Calendar size={11} className="shrink-0" />
            <span>{formatGeorgianDateShort(task.deadline)}</span>
          </div>
        ) : (
          <span className="text-[10px] text-stone-400">უდედლაინო</span>
        )}
      </div>
    </div>
  );
}
