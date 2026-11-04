"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  Folder,
  Tag,
  AlertTriangle,
} from "lucide-react";
import { TaskType, Priority, TaskStatus } from "@prisma/client";

export interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

export interface UserOption {
  id: string;
  name: string;
  email?: string;
  role: "ADMIN" | "USER";
  avatarUrl?: string | null;
}

export interface TaskData {
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
  projectId: string;
  assignments: {
    user: {
      id: string;
      name: string;
      email?: string;
      role?: "ADMIN" | "USER";
      avatarUrl?: string | null;
    };
  }[];
  pauseReason?: string | null;
  blockedReason?: string | null;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "create" | "edit";
  initialTask?: TaskData | null;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER";
  };
  projects: ProjectOption[];
  users: UserOption[];
}

function TaskModalForm({
  onClose,
  onSuccess,
  mode,
  initialTask,
  currentUser,
  projects,
  users,
}: Omit<TaskModalProps, "isOpen">) {
  const [title, setTitle] = useState(() =>
    mode === "edit" && initialTask ? initialTask.title : ""
  );
  const [description, setDescription] = useState(() =>
    mode === "edit" && initialTask ? initialTask.description || "" : ""
  );
  const [projectId, setProjectId] = useState(
    () =>
      (mode === "edit" && initialTask
        ? initialTask.projectId
        : projects[0]?.id) || ""
  );
  const [type, setType] = useState<TaskType>(() =>
    mode === "edit" && initialTask ? initialTask.type : TaskType.FEATURE
  );
  const [priority, setPriority] = useState<Priority>(() =>
    mode === "edit" && initialTask ? initialTask.priority : Priority.MEDIUM
  );
  const [status, setStatus] = useState<TaskStatus>(() =>
    mode === "edit" && initialTask ? initialTask.status : TaskStatus.BACKLOG
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() =>
    mode === "edit" && initialTask
      ? initialTask.assignments?.map((a) => a.user.id) || []
      : []
  );
  const [startDate, setStartDate] = useState(() =>
    mode === "edit" && initialTask?.startDate
      ? initialTask.startDate.split("T")[0]
      : ""
  );
  const [deadline, setDeadline] = useState(() =>
    mode === "edit" && initialTask?.deadline
      ? initialTask.deadline.split("T")[0]
      : ""
  );
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [pauseReason, setPauseReason] = useState(() =>
    mode === "edit" && initialTask?.pauseReason ? initialTask.pauseReason : ""
  );
  const [blockedReason, setBlockedReason] = useState(() =>
    mode === "edit" && initialTask?.blockedReason ? initialTask.blockedReason : ""
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "ADMIN";
  const isDeadlineLocked = Boolean(initialTask?.deadlineLocked);
  const isDeadlineReadOnly = mode === "edit" && isDeadlineLocked && !isAdmin;

  const toggleUserAssignment = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("ტასკის სათაური სავალდებულოა");
      return;
    }

    // Business rule: Assigned tasks must have a deadline
    if (selectedUserIds.length > 0 && !deadline) {
      setError("შემსრულებლის მინიჭებისას დედლაინის მითითება სავალდებულოა");
      return;
    }

    // Business rule: If Admin modifies locked deadline, reason is required
    if (
      mode === "edit" &&
      isDeadlineLocked &&
      isAdmin &&
      deadline !==
        (initialTask?.deadline ? initialTask.deadline.split("T")[0] : "") &&
      !rescheduleReason.trim()
    ) {
      setError(
        "დედლაინის შეცვლისას მიზეზის მითითება სავალდებულოა აუდიტის ლოგისთვის"
      );
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "create") {
        const payload: {
          title: string;
          description?: string;
          projectId?: string;
          type: TaskType;
          priority: Priority;
          status: TaskStatus;
          assigneeIds?: string[];
          startDate?: string | null;
          deadline?: string | null;
        } = {
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          type,
          priority,
          status,
          assigneeIds: selectedUserIds,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
        };

        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "ტასკის შექმნა ვერ მოხერხდა");
        }

        onSuccess();
        onClose();
      } else if (mode === "edit" && initialTask) {
        const payload: {
          title: string;
          description?: string | null;
          projectId?: string;
          type: TaskType;
          priority: Priority;
          status: TaskStatus;
          assigneeIds?: string[];
          startDate?: string | null;
          deadline?: string | null;
          rescheduleReason?: string;
          pauseReason?: string | null;
          blockedReason?: string | null;
        } = {
          title: title.trim(),
          description: description.trim() || null,
          projectId: projectId || undefined,
          type,
          priority,
          status,
          assigneeIds: selectedUserIds,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          pauseReason: status === TaskStatus.PAUSED ? pauseReason : null,
          blockedReason: status === TaskStatus.BLOCKED ? blockedReason : null,
        };

        if (!isDeadlineReadOnly) {
          payload.deadline = deadline ? new Date(deadline).toISOString() : null;
          if (rescheduleReason.trim()) {
            payload.rescheduleReason = rescheduleReason.trim();
          }
        }

        const res = await fetch(`/api/tasks/${initialTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "ტასკის განახლება ვერ მოხერხდა");
        }

        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      setError((err as Error).message || "სისტემური შეცდომა");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600 font-bold text-sm">
            {mode === "create" ? "+" : "#"}
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              {mode === "create"
                ? "ახალი ტასკის შექმნა"
                : `ტასკის რედაქტირება: TASK-${initialTask?.taskNumber || ""}`}
            </h3>
            <p className="text-[11px] text-stone-500">
              {mode === "create"
                ? "შეავსეთ მონაცემები სამუშაოს დასაგეგმად"
                : "განაახლეთ ტასკის პარამეტრები და შემსრულებლები"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs animate-in slide-in-from-top-1">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Form Body */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs"
      >
        {/* Title Field */}
        <div>
          <label className="block font-bold text-stone-800 mb-1">
            სათაური <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="მაგ. ახალი ავთენტიფიკაციის მოდული"
            className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 placeholder:text-stone-400 font-medium"
            required
          />
        </div>

        {/* Project & Type Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-stone-800 mb-1 flex items-center gap-1.5">
              <Folder size={13} className="text-stone-400" />
              <span>პროექტი</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-stone-800 mb-1 flex items-center gap-1.5">
              <Tag size={13} className="text-stone-400" />
              <span>ტიპი</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskType)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
            >
              <option value={TaskType.FEATURE}>Feature (ფუნქცია)</option>
              <option value={TaskType.BUG}>Bug (ხარვეზი)</option>
              <option value={TaskType.HOTFIX}>Hotfix (სასწრაფო)</option>
            </select>
          </div>
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-stone-800 mb-1">
              პრიორიტეტი
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
            >
              <option value={Priority.LOW}>დაბალი (Low)</option>
              <option value={Priority.MEDIUM}>საშუალო (Medium)</option>
              <option value={Priority.HIGH}>მაღალი (High)</option>
              <option value={Priority.CRITICAL}>კრიტიკული (Critical)</option>
            </select>
          </div>

          {mode === "edit" ? (
            <div>
              <label className="block font-bold text-stone-800 mb-1">
                სტატუსი
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
              >
                <option value={TaskStatus.BACKLOG}>Backlog</option>
                <option value={TaskStatus.PLANNED}>Planned</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.PAUSED}>Paused</option>
                <option value={TaskStatus.BLOCKED}>Blocked</option>
                <option value={TaskStatus.DONE}>Done</option>
                <option value={TaskStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-stone-800 mb-1">
                საწყისი სტატუსი
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
              >
                <option value={TaskStatus.BACKLOG}>Backlog (საწყისი)</option>
                <option value={TaskStatus.PLANNED}>Planned (დაგეგმილი)</option>
                <option value={TaskStatus.IN_PROGRESS}>
                  In Progress (მიმდინარე)
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Conditional Reasons for Paused / Blocked */}
        {status === TaskStatus.PAUSED && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="block font-bold text-amber-900 mb-1">
              შეჩერების მიზეზი (სავალდებულო)
            </label>
            <input
              type="text"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="მაგ. შეჩერებულია ჰოტფიქსის გამო"
              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-amber-950 focus:outline-none"
              required
            />
          </div>
        )}

        {status === TaskStatus.BLOCKED && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <label className="block font-bold text-rose-900 mb-1">
              დაბლოკვის მიზეზი (სავალდებულო)
            </label>
            <input
              type="text"
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder="მაგ. ველოდებით API წვდომას"
              className="w-full px-3 py-1.5 bg-white border border-rose-300 rounded-lg text-xs text-rose-950 focus:outline-none"
              required
            />
          </div>
        )}

        {/* Assignees (Multi-select) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-bold text-stone-800">
              შემსრულებლები ({selectedUserIds.length})
            </label>
            {selectedUserIds.length > 0 && (
              <span className="text-[11px] text-orange-600 font-semibold">
                დედლაინი სავალდებულოა
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 p-2 bg-stone-50 border border-stone-200 rounded-2xl max-h-32 overflow-y-auto">
            {users.map((u) => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUserAssignment(u.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-600 text-white shadow-2xs font-semibold"
                      : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected
                        ? "bg-white text-orange-600"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <span>{u.name}</span>
                  {isSelected && <CheckCircle size={12} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dates: Start Date & Deadline */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-stone-800 mb-1 flex items-center gap-1.5">
              <Calendar size={13} className="text-stone-400" />
              <span>დაწყების თარიღი</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-stone-800 flex items-center gap-1.5">
                <Calendar size={13} className="text-stone-400" />
                <span>დედლაინი</span>
                {selectedUserIds.length > 0 && (
                  <span className="text-rose-500">*</span>
                )}
              </label>
              {isDeadlineLocked && (
                <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-full font-bold">
                  <Lock size={10} />
                  <span>დაბლოკილი</span>
                </span>
              )}
            </div>

            <input
              type="date"
              value={deadline}
              disabled={isDeadlineReadOnly}
              onChange={(e) => setDeadline(e.target.value)}
              className={`w-full px-3 py-2 border rounded-xl font-medium focus:outline-none ${
                isDeadlineReadOnly
                  ? "bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed"
                  : "bg-stone-50 border-stone-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900"
              }`}
              required={selectedUserIds.length > 0}
            />
          </div>
        </div>

        {/* Deadline Lock Notice / Reschedule Reason for Admin */}
        {isDeadlineReadOnly ? (
          <div className="p-3 bg-stone-100 border border-stone-200 rounded-2xl flex items-center gap-2 text-stone-600">
            <Lock size={14} className="text-stone-500 shrink-0" />
            <span>
              დედლაინი დაფიქსირებულია. მის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს.
            </span>
          </div>
        ) : isDeadlineLocked && isAdmin ? (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>ადმინისტრატორის დედლაინის ცვლილება</span>
            </div>
            <p className="text-[11px] text-amber-700">
              მიუთითეთ დედლაინის შეცვლის დასაბუთებული მიზეზი აუდიტის ლოგისთვის:
            </p>
            <input
              type="text"
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              placeholder="მაგ. კლიენტის მოთხოვნით ვადის გაგრძელება"
              className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none"
            />
          </div>
        ) : null}

        {/* Description Field */}
        <div>
          <label className="block font-bold text-stone-800 mb-1">აღწერა</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ტასკის დეტალური აღწერა და მოთხოვნები..."
            className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 placeholder:text-stone-400 font-medium resize-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>ინახება...</span>
              </>
            ) : mode === "create" ? (
              <span>ტასკის შექმნა</span>
            ) : (
              <span>ცვლილებების შენახვა</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TaskModal(props: TaskModalProps) {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <TaskModalForm
        key={`${props.mode}-${props.initialTask?.id || "create"}`}
        {...props}
      />
    </div>
  );
}
