"use client";

import React, { useState } from "react";
import {
  X,
  Lock,
  Calendar,
  AlertCircle,
  Loader2,
  Folder,
  Tag,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
  Paperclip,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TaskType, Priority, TaskStatus } from "@prisma/client";
import { DatePicker } from "@/components/ui/DatePicker";

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
  stages?: {
    id: string;
    position?: number;
    title: string;
    deadline?: string | null;
    assignments?: { user: { id: string; name: string } }[];
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
  defaultProjectId?: string;
  onProjectsUpdated?: () => Promise<void> | void;
}

interface AssigneeEntry {
  userId: string;
  deadline: string; // "YYYY-MM-DD" or ""
}

interface LinkEntry {
  name: string;
  url: string;
}

function TaskModalForm({
  onClose,
  onSuccess,
  mode,
  initialTask,
  currentUser,
  projects,
  users,
  defaultProjectId,
  onProjectsUpdated,
}: Omit<TaskModalProps, "isOpen">) {
  // 1. Title & Project
  const [title, setTitle] = useState(() =>
    mode === "edit" && initialTask ? initialTask.title : ""
  );
  const [projectId, setProjectId] = useState(
    () =>
      (mode === "edit" && initialTask
        ? initialTask.projectId
        : defaultProjectId || projects[0]?.id) || ""
  );

  // Quick Project Creation
  const [isQuickProjectOpen, setIsQuickProjectOpen] = useState(false);
  const [quickProjectName, setQuickProjectName] = useState("");
  const [quickProjectColor, setQuickProjectColor] = useState("#EA580C");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [quickProjectError, setQuickProjectError] = useState<string | null>(null);

  const handleCreateQuickProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProjectName.trim()) {
      setQuickProjectError("მიუთითეთ პროექტის სახელი");
      return;
    }
    setIsCreatingProject(true);
    setQuickProjectError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickProjectName.trim(),
          color: quickProjectColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuickProjectError(data.error || "პროექტის შექმნა ვერ მოხერხდა");
        return;
      }
      if (data.project) {
        setProjectId(data.project.id);
        if (onProjectsUpdated) {
          await onProjectsUpdated();
        }
        setQuickProjectName("");
        setIsQuickProjectOpen(false);
      }
    } catch {
      setQuickProjectError("სისტემური შეცდომა");
    } finally {
      setIsCreatingProject(false);
    }
  };

  // 2. Assignees & Sequential Order
  const [assigneeList, setAssigneeList] = useState<AssigneeEntry[]>(() => {
    if (mode === "edit" && initialTask) {
      if (initialTask.stages && initialTask.stages.length > 0) {
        return initialTask.stages.map((s, idx) => ({
          userId: s.assignments?.[0]?.user?.id || initialTask.assignments?.[idx]?.user?.id || "",
          deadline: s.deadline ? s.deadline.split("T")[0] : "",
        })).filter((a) => Boolean(a.userId));
      }
      return initialTask.assignments?.map((a) => ({
        userId: a.user.id,
        deadline: initialTask.deadline ? initialTask.deadline.split("T")[0] : "",
      })) || [];
    }
    return [];
  });

  // 3. Overall Task Deadline
  const [deadline, setDeadline] = useState(() =>
    mode === "edit" && initialTask?.deadline
      ? initialTask.deadline.split("T")[0]
      : ""
  );

  // 4. Independent Links & Files
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // 5. Description
  const [description, setDescription] = useState(() =>
    mode === "edit" && initialTask ? initialTask.description || "" : ""
  );

  // 6. Additional Parameters (Collapsible)
  const [showAdditionalParams, setShowAdditionalParams] = useState(false);
  const [type, setType] = useState<TaskType>(() =>
    mode === "edit" && initialTask ? initialTask.type : TaskType.FEATURE
  );
  const [priority, setPriority] = useState<Priority>(() =>
    mode === "edit" && initialTask ? initialTask.priority : Priority.MEDIUM
  );
  const [status, setStatus] = useState<TaskStatus>(() =>
    mode === "edit" && initialTask ? initialTask.status : TaskStatus.BACKLOG
  );
  const [startDate, setStartDate] = useState(() =>
    mode === "edit" && initialTask?.startDate
      ? initialTask.startDate.split("T")[0]
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

  // Assignee Management
  const addAssignee = (userId: string) => {
    if (assigneeList.some((a) => a.userId === userId)) return;
    setAssigneeList((prev) => [...prev, { userId, deadline: "" }]);
  };

  const removeAssignee = (index: number) => {
    setAssigneeList((prev) => prev.filter((_, i) => i !== index));
  };

  const moveAssignee = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= assigneeList.length) return;

    setAssigneeList((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const updateAssigneeDeadline = (index: number, newDate: string) => {
    setAssigneeList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], deadline: newDate };
      return next;
    });
  };

  // Links Management
  const handleAddLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    setLinks((prev) => [...prev, { name: newLinkName.trim(), url }]);
    setNewLinkName("");
    setNewLinkUrl("");
  };

  const handleRemoveLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  // Files Management
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Reordering conflict detection
  const sequenceConflict = (() => {
    if (assigneeList.length <= 1) return null;

    // Check if 1st assignee deadline is missing only when starting work (IN_PROGRESS)
    if (status === TaskStatus.IN_PROGRESS && !assigneeList[0].deadline && !deadline) {
      return {
        severity: "error",
        message: "სამუშაოს დასაწყებად (In Progress) 1-ლი შემსრულებლის დედლაინი სავალდებულოა.",
      };
    }

    // Check if any deadline is after overall deadline
    if (deadline) {
      const overallTime = new Date(deadline).getTime();
      for (let i = 0; i < assigneeList.length; i++) {
        if (assigneeList[i].deadline) {
          const t = new Date(assigneeList[i].deadline).getTime();
          if (t > overallTime) {
            return {
              severity: "warning",
              message: `შემსრულებლის (#${i + 1}) დედლაინი აღემატება დავალების საერთო ვადას (${deadline}).`,
            };
          }
        }
      }
    }

    // Check sequential order consistency
    for (let i = 0; i < assigneeList.length; i++) {
      for (let j = i + 1; j < assigneeList.length; j++) {
        const dI = assigneeList[i].deadline;
        const dJ = assigneeList[j].deadline;
        if (dI && dJ && new Date(dI).getTime() > new Date(dJ).getTime()) {
          return {
            severity: "warning",
            message: `ყურადღება: თარიღების თანმიმდევრობა არ შეესაბამება რიგითობას (#${i + 1} დედლაინი უფრო გვიანია ვიდრე #${j + 1}).`,
          };
        }
      }
    }

    return null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("ტასკის სათაური სავალდებულოა");
      return;
    }

    // Sequential workflow validation: 1st assignee deadline required only when starting work (IN_PROGRESS)
    if (
      status === TaskStatus.IN_PROGRESS &&
      assigneeList.length > 1 &&
      !assigneeList[0].deadline &&
      !deadline
    ) {
      setError("სამუშაოს დასაწყებად (In Progress) 1-ლი შემსრულებლის დედლაინი სავალდებულოა");
      return;
    }

    // Overall deadline bound validation
    if (deadline && assigneeList.length > 0) {
      const overallTime = new Date(deadline).getTime();
      for (const a of assigneeList) {
        if (a.deadline && new Date(a.deadline).getTime() > overallTime) {
          setError("შემსრულებლის დედლაინი არ შეიძლება აღემატებოდეს დავალების საერთო დედლაინს");
          return;
        }
      }
    }

    // Admin reschedule check
    if (
      mode === "edit" &&
      isDeadlineLocked &&
      isAdmin &&
      deadline !== (initialTask?.deadline ? initialTask.deadline.split("T")[0] : "") &&
      !rescheduleReason.trim()
    ) {
      setError("დედლაინის შეცვლისას მიზეზის მითითება სავალდებულოა აუდიტის ლოგისთვის");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "create") {
        const formattedAssignees = assigneeList.map((a, index) => ({
          userId: a.userId,
          position: index,
          deadline: a.deadline ? new Date(a.deadline).toISOString() : null,
        }));

        const payload = {
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: projectId || undefined,
          type,
          priority,
          status,
          assignees: formattedAssignees,
          assigneeIds: assigneeList.map((a) => a.userId),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          links: links.length > 0 ? links : undefined,
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

        const createdTaskId = data.task?.id;

        // Upload attached files if any
        if (createdTaskId && selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append("file", file);
            await fetch(`/api/tasks/${createdTaskId}/attachments`, {
              method: "POST",
              body: formData,
            });
          }
        }

        onSuccess();
        onClose();
      } else if (mode === "edit" && initialTask) {
        const formattedAssignees = assigneeList.map((a, index) => ({
          userId: a.userId,
          position: index,
          deadline: a.deadline ? new Date(a.deadline).toISOString() : null,
        }));

        const payload: {
          title: string;
          description?: string | null;
          projectId?: string;
          type: TaskType;
          priority: Priority;
          status: TaskStatus;
          assignees: typeof formattedAssignees;
          assigneeIds: string[];
          startDate?: string | null;
          deadline?: string | null;
          rescheduleReason?: string;
          pauseReason?: string | null;
          blockedReason?: string | null;
          links?: LinkEntry[];
        } = {
          title: title.trim(),
          description: description.trim() || null,
          projectId: projectId || undefined,
          type,
          priority,
          status,
          assignees: formattedAssignees,
          assigneeIds: assigneeList.map((a) => a.userId),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          pauseReason: status === TaskStatus.PAUSED ? pauseReason : null,
          blockedReason: status === TaskStatus.BLOCKED ? blockedReason : null,
          links: links.length > 0 ? links : undefined,
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

        // Upload any newly attached files
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append("file", file);
            await fetch(`/api/tasks/${initialTask.id}/attachments`, {
              method: "POST",
              body: formData,
            });
          }
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
    <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
            {mode === "create" ? "+" : "#"}
          </div>
          <div>
            <h3 className="text-base font-black text-stone-900 tracking-tight">
              {mode === "create"
                ? "ახალი დავალების შექმნა"
                : `დავალების რედაქტირება: #${initialTask?.taskNumber || ""}`}
            </h3>
            <p className="text-[11px] text-stone-500 font-medium">
              სწრაფი და გამჭვირვალე დაგეგმვა გუნდისთვის
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs animate-in slide-in-from-top-1">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{error}</div>
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
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs"
      >
        {/* ========================================================= */}
        {/* SECTION 1: TITLE & PROJECT                                */}
        {/* ========================================================= */}
        <div className="space-y-3 p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80">
          <div>
            <label className="block font-bold text-stone-800 mb-1 text-xs">
              სათაური <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="მაგ. მომხმარებელთა მართვის API და ავთენტიფიკაცია"
              className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-stone-900 placeholder:text-stone-400 font-semibold text-sm transition-all"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-stone-700 flex items-center gap-1.5 text-xs">
                <Folder size={13} className="text-stone-400" />
                <span>პროექტი</span>
              </label>
              {currentUser.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => setIsQuickProjectOpen(!isQuickProjectOpen)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus size={12} />
                  <span>ახალი პროექტი</span>
                </button>
              )}
            </div>

            {isQuickProjectOpen && (
              <div className="mb-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-blue-900 block">
                  ახალი პროექტის სწრაფი დამატება
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickProjectName}
                    onChange={(e) => setQuickProjectName(e.target.value)}
                    placeholder="პროექტის სახელი..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-stone-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateQuickProject(e);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    {["#EA580C", "#2563EB", "#059669", "#7C3AED", "#E11D48"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setQuickProjectColor(c)}
                        className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                          quickProjectColor === c ? "ring-2 ring-stone-900 scale-110" : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateQuickProject}
                    disabled={isCreatingProject}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isCreatingProject ? "..." : "შენახვა"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickProjectOpen(false);
                      setQuickProjectError(null);
                    }}
                    className="p-1 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                {quickProjectError && (
                  <span className="text-[11px] text-rose-600 font-semibold block">
                    {quickProjectError}
                  </span>
                )}
              </div>
            )}

            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-stone-800 font-semibold cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: ASSIGNEES & ORDER (SEQUENTIAL WORKFLOW)        */}
        {/* ========================================================= */}
        <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-extrabold text-stone-900 text-xs">
                შემსრულებლები და რიგითობა ({assigneeList.length})
              </label>
              <p className="text-[11px] text-stone-500">
                {assigneeList.length > 1
                  ? "თანმიმდევრული სამუშაო: სამუშაო გადადის ერთი შემსრულებლიდან მეორეზე"
                  : "მიუთითეთ პასუხისმგებელი პირი (დედლაინი არასავალდებულოა)"}
              </p>
            </div>

            {/* Quick Add Assignee Dropdown */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addAssignee(e.target.value);
              }}
              className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-700 focus:outline-none cursor-pointer hover:border-stone-400 shadow-2xs"
            >
              <option value="">+ წევრის დამატება</option>
              {users
                .filter((u) => !assigneeList.some((a) => a.userId === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
            </select>
          </div>

          {/* Conflict Alert if dates order is mismatched */}
          {sequenceConflict && (
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                sequenceConflict.severity === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <AlertTriangle size={15} className="shrink-0" />
              <span>{sequenceConflict.message}</span>
            </div>
          )}

          {/* Ordered Assignees List */}
          {assigneeList.length === 0 ? (
            <div className="py-4 text-center text-xs text-stone-400 bg-white/70 rounded-xl border border-dashed border-stone-200">
              შემსრულებლები ჯერ არ არის არჩეული (დავალება იქნება ბექლოგში)
            </div>
          ) : (
            <div className="space-y-2">
              {assigneeList.map((item, index) => {
                const user = users.find((u) => u.id === item.userId);
                const isFirst = index === 0;
                const isLast = index === assigneeList.length - 1;

                return (
                  <div
                    key={item.userId}
                    className="p-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                  >
                    {/* Left: Sequence Badge + User info + Reorder Arrows */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Sequence Badge */}
                      <span className="w-5 h-5 rounded-md bg-stone-100 border border-stone-200 text-stone-700 text-[10px] font-black flex items-center justify-center shrink-0">
                        #{index + 1}
                      </span>

                      {/* Reorder Buttons (Accessible Alternative to Drag) */}
                      {assigneeList.length > 1 && (
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => moveAssignee(index, "up")}
                            className="p-0.5 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="წინ გადაწევა"
                          >
                            <ArrowUp size={11} strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => moveAssignee(index, "down")}
                            className="p-0.5 rounded text-stone-400 hover:text-stone-700 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="უკან გადაწევა"
                          >
                            <ArrowDown size={11} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}

                      {/* Avatar & Name */}
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                        {user?.name.charAt(0) || "U"}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-stone-800 text-xs truncate">
                          {user?.name || "მომხმარებელი"}
                        </span>
                        {index === 0 && assigneeList.length > 1 && (
                          <span className="ml-1.5 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            საწყისი ეტაპი
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Individual Deadline Input + Remove Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {assigneeList.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-stone-500 whitespace-nowrap">
                            {isFirst ? (
                              <span className="text-stone-700">
                                ეტაპის ვადა{status === TaskStatus.IN_PROGRESS && <span className="text-rose-500">*</span>}:
                              </span>
                            ) : (
                              <span>ვადა:</span>
                            )}
                          </label>
                          <div className="w-38 sm:w-44">
                            <DatePicker
                              value={item.deadline}
                              onChange={(val) => updateAssigneeDeadline(index, val)}
                              size="sm"
                              placeholder="აირჩიეთ ვადა"
                              className={
                                isFirst && status === TaskStatus.IN_PROGRESS && !item.deadline
                                  ? "!border-rose-300 !bg-rose-50/50"
                                  : ""
                              }
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removeAssignee(index)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="წაშლა"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: OVERALL TASK DEADLINE (OPTIONAL)               */}
        {/* ========================================================= */}
        <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-extrabold text-stone-900 flex items-center gap-1.5 text-xs">
              <Calendar size={14} className="text-stone-500" />
              <span>დავალების საერთო დედლაინი</span>
              <span className="text-stone-400 font-normal">(არასავალდებულო)</span>
            </label>

            {isDeadlineLocked && (
              <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold">
                <Lock size={10} />
                <span>დაფიქსირებულია</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-stone-500">
            {assigneeList.length === 1
              ? "ერთი შემსრულებლის შემთხვევაში დავალება იყენებს ამ ვადას."
              : "თუ მითითებულია, შემსრულებლების ინდივიდუალური ვადები არ უნდა აღემატებოდეს მას."}
          </p>

          <DatePicker
            value={deadline}
            disabled={isDeadlineReadOnly}
            onChange={(val) => setDeadline(val)}
            placeholder="დავალების საერთო დედლაინი (არასავალდებულო)"
            size="md"
          />

          {isDeadlineReadOnly ? (
            <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-2 text-stone-600 text-xs">
              <Lock size={13} className="text-stone-500 shrink-0" />
              <span>დედლაინი დაფიქსირებულია. მის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს.</span>
            </div>
          ) : isDeadlineLocked && isAdmin ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                <AlertTriangle size={13} className="text-amber-600" />
                <span>ადმინისტრატორის მიერ დედლაინის ცვლილების მიზეზი</span>
              </div>
              <input
                type="text"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="მაგ. კლიენტის მოთხოვნით ვადის გაგრძელება"
                className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:outline-none"
              />
            </div>
          ) : null}
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: INDEPENDENT LINKS & FILES                      */}
        {/* ========================================================= */}
        <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80 space-y-3">
          <label className="font-extrabold text-stone-900 text-xs block">
            დამოუკიდებელი ბმულები და ფაილები
          </label>

          {/* Links Sub-block */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
              <LinkIcon size={12} className="text-stone-400" />
              <span>გარე ბმულები (GitLab, Figma, Docs...)</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                placeholder="ბმულის სახელი (მაგ. GitLab MR #12)"
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none"
              />
              <input
                type="text"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="URL (https://...)"
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!newLinkName.trim() || !newLinkUrl.trim()}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
              >
                <Plus size={13} />
                <span>დამატება</span>
              </button>
            </div>

            {/* List of Added Links */}
            {links.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {links.map((link, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <LinkIcon size={12} className="text-blue-600 shrink-0" />
                      <span className="font-bold text-stone-800 truncate">
                        {link.name}:
                      </span>
                      <span className="text-stone-500 truncate text-[11px]">
                        {link.url}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files Sub-block */}
          <div className="space-y-2 pt-2 border-t border-stone-200/60">
            <div className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
              <Paperclip size={12} className="text-stone-400" />
              <span>ფაილების მიმაგრება</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="px-3 py-2 bg-white border border-stone-300 hover:border-stone-400 rounded-xl text-xs font-bold text-stone-700 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors">
                <Paperclip size={13} />
                <span>ფაილის არჩევა</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-stone-400">
                მაქს. 15MB თითო ფაილზე
              </span>
            </div>

            {/* List of Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={12} className="text-stone-400 shrink-0" />
                      <span className="font-semibold text-stone-800 truncate">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-stone-400 shrink-0">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 5: DESCRIPTION                                   */}
        {/* ========================================================= */}
        <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80">
          <label className="block font-bold text-stone-800 mb-1 text-xs">
            აღწერა და დეტალები
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="დავალების მოკლე აღწერა, მოთხოვნები და ჩაბარების კრიტერიუმები..."
            className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-stone-900 placeholder:text-stone-400 font-medium text-xs resize-none"
          />
        </div>

        {/* ========================================================= */}
        {/* SECTION 6: ADDITIONAL OPTIONS (COLLAPSIBLE)              */}
        {/* ========================================================= */}
        <div className="border border-stone-200/80 rounded-2xl overflow-hidden bg-stone-50/40">
          <button
            type="button"
            onClick={() => setShowAdditionalParams((prev) => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-stone-700 hover:bg-stone-100/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-stone-400" />
              <span>დამატებითი პარამეტრები (პრიორიტეტი, ტიპი, სტატუსი, დაწყება)</span>
            </div>
            {showAdditionalParams ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdditionalParams && (
            <div className="p-4 pt-1 space-y-4 border-t border-stone-200/60">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    პრიორიტეტი
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer"
                  >
                    <option value={Priority.LOW}>დაბალი (Low)</option>
                    <option value={Priority.MEDIUM}>საშუალო (Medium)</option>
                    <option value={Priority.HIGH}>მაღალი (High)</option>
                    <option value={Priority.CRITICAL}>კრიტიკული / Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ტიპი
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer"
                  >
                    <option value={TaskType.FEATURE}>Feature (ფუნქციონალი)</option>
                    <option value={TaskType.BUG}>Bug (ხარვეზი)</option>
                    <option value={TaskType.HOTFIX}>Hotfix (სასწრაფო)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    სტატუსი
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer"
                  >
                    <option value={TaskStatus.BACKLOG}>To Do / Backlog</option>
                    <option value={TaskStatus.PLANNED}>Planned</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    {mode === "edit" && (
                      <>
                        <option value={TaskStatus.PAUSED}>Paused</option>
                        <option value={TaskStatus.BLOCKED}>Blocked</option>
                        <option value={TaskStatus.DONE}>Completed</option>
                        <option value={TaskStatus.CANCELLED}>Cancelled</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    დაწყების თარიღი
                  </label>
                  <DatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    placeholder="დაწყების თარიღი"
                    size="md"
                  />
                </div>
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
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl font-bold transition-colors cursor-pointer text-xs"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>ინახება...</span>
              </>
            ) : mode === "create" ? (
              <span>დავალების შექმნა</span>
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
