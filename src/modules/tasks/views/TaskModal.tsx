"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Lock,
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
  Code2,
  PenTool,
  Image as ImageIcon,
  UploadCloud,
} from "lucide-react";
import { TaskType, Priority, TaskStatus, Department } from "@prisma/client";
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
  department?: Department;
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
  defaultDepartment?: Department;
  defaultType?: TaskType;
  onProjectsUpdated?: () => Promise<void> | void;
}

interface AssigneeEntry {
  userId: string;
  deadline: string; // "YYYY-MM-DD" or ""
}

interface LinkEntry {
  name?: string;
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
  defaultDepartment,
  defaultType,
  onProjectsUpdated,
}: Omit<TaskModalProps, "isOpen">) {
  // 1. Title & Project
  const [title, setTitle] = useState(() =>
    mode === "edit" && initialTask ? initialTask.title : ""
  );
  const [projectId, setProjectId] = useState<string>(() => {
    if (mode === "edit" && initialTask) {
      return typeof initialTask.projectId === "string" ? initialTask.projectId : "";
    }
    if (typeof defaultProjectId === "string" && defaultProjectId.trim()) {
      return defaultProjectId.trim();
    }
    return projects[0]?.id || "";
  });
  const [department, setDepartment] = useState<Department>(() => {
    if (mode === "edit" && initialTask?.department) {
      return initialTask.department;
    }
    if (defaultDepartment) {
      return defaultDepartment;
    }
    return Department.DEVELOPMENT;
  });

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
        userId: a.user?.id || "",
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
  const [linkUrls, setLinkUrls] = useState<string[]>([""]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // 5. Description
  const [description, setDescription] = useState(() =>
    mode === "edit" && initialTask ? initialTask.description || "" : ""
  );

  // 6. Additional Parameters (Collapsible)
  const [showAdditionalParams, setShowAdditionalParams] = useState(false);
  const [type, setType] = useState<TaskType>(() => {
    if (mode === "edit" && initialTask) {
      return initialTask.type;
    }
    if (defaultType) {
      return defaultType;
    }
    if (defaultDepartment === Department.QA) {
      return TaskType.QA;
    }
    return TaskType.FEATURE;
  });
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
  const [savedTaskId, setSavedTaskId] = useState<string | null>(null);

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

  // Links Management (Multiple URLs without link name)
  const handleAddLinkRow = () => {
    setLinkUrls((prev) => [...prev, ""]);
  };

  const handleLinkUrlChange = (index: number, value: string) => {
    setLinkUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveLinkRow = (index: number) => {
    setLinkUrls((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
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

  // Support Ctrl+V screenshot paste anywhere in the modal (matching TaskDetailsDrawer)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const hasText = e.clipboardData?.types.includes("text/plain");
      const items = e.clipboardData?.items;
      if (!items) return;

      let imageItem: DataTransferItem | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          imageItem = items[i];
          break;
        }
      }

      if (imageItem) {
        if (isInput && hasText) return;
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          const namedFile = new File([file], `screenshot-${Date.now()}.png`, {
            type: file.type,
          });
          setSelectedFiles((prev) => [...prev, namedFile]);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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

    if (savedTaskId) {
      setIsLoading(true);
      setError(null);
      try {
        const failedFiles: File[] = [];
        for (const file of selectedFiles) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch(`/api/tasks/${savedTaskId}/attachments`, {
              method: "POST",
              body: formData,
            });
            if (!uploadRes.ok) {
              failedFiles.push(file);
            }
          } catch {
            failedFiles.push(file);
          }
        }
        if (failedFiles.length > 0) {
          setSelectedFiles(failedFiles);
          setError(
            `შემდეგი ფაილების ატვირთვა კვლავ ვერ მოხერხდა: ${failedFiles.map((f) => f.name).join(", ")}. შეგიძლიათ სცადოთ ხელახლა.`
          );
          return;
        }
        onSuccess();
        onClose();
        return;
      } catch (err: unknown) {
        setError((err as Error).message || "სისტემური შეცდომა ფაილის ატვირთვისას");
        return;
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);

    try {
      if (mode === "create") {
        const formattedAssignees = assigneeList.map((a, index) => ({
          userId: a.userId,
          position: index,
          deadline: a.deadline ? new Date(a.deadline).toISOString() : null,
        }));

        const cleanProjectId = typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;

        const formattedLinks = linkUrls
          .map((raw) => raw.trim())
          .filter(Boolean)
          .map((raw) => ({
            url: raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`,
          }));

        const payload = {
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: cleanProjectId,
          type,
          priority,
          status,
          department,
          assignees: formattedAssignees,
          assigneeIds: assigneeList.map((a) => a.userId),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          links: formattedLinks.length > 0 ? formattedLinks : undefined,
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
        const taskNumber = data.task?.taskNumber;

        // Upload attached files if any
        if (createdTaskId && selectedFiles.length > 0) {
          const failedFiles: File[] = [];
          for (const file of selectedFiles) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await fetch(`/api/tasks/${createdTaskId}/attachments`, {
                method: "POST",
                body: formData,
              });
              if (!uploadRes.ok) {
                failedFiles.push(file);
              }
            } catch {
              failedFiles.push(file);
            }
          }

          if (failedFiles.length > 0) {
            onSuccess(); // Ensure newly created task appears in parent view
            setSavedTaskId(createdTaskId);
            setSelectedFiles(failedFiles);
            setError(
              `ტასკი #${taskNumber || ""} შეიქმნა, თუმცა შემდეგი ფაილების ატვირთვა ვერ მოხერხდა: ${failedFiles.map((f) => f.name).join(", ")}. შეგიძლიათ სცადოთ ხელახლა.`
            );
            return;
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

        const cleanProjectId = typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined;

        const payload: {
          title: string;
          description?: string | null;
          projectId?: string;
          type: TaskType;
          priority: Priority;
          status: TaskStatus;
          department?: Department;
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
          projectId: cleanProjectId,
          type,
          priority,
          status,
          department,
          assignees: formattedAssignees,
          assigneeIds: assigneeList.map((a) => a.userId),
          startDate: startDate ? new Date(startDate).toISOString() : null,
          pauseReason: status === TaskStatus.PAUSED ? pauseReason : null,
          blockedReason: status === TaskStatus.BLOCKED ? blockedReason : null,
          links: (() => {
            const formatted = linkUrls
              .map((raw) => raw.trim())
              .filter(Boolean)
              .map((raw) => ({
                url: raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`,
              }));
            return formatted.length > 0 ? formatted : undefined;
          })(),
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
          const failedFiles: File[] = [];
          for (const file of selectedFiles) {
            try {
              const formData = new FormData();
              formData.append("file", file);
              const uploadRes = await fetch(`/api/tasks/${initialTask.id}/attachments`, {
                method: "POST",
                body: formData,
              });
              if (!uploadRes.ok) {
                failedFiles.push(file);
              }
            } catch {
              failedFiles.push(file);
            }
          }

          if (failedFiles.length > 0) {
            onSuccess();
            setSelectedFiles(failedFiles);
            setError(
              `ტასკი განახლდა, თუმცა შემდეგი ფაილების ატვირთვა ვერ მოხერხდა: ${failedFiles.map((f) => f.name).join(", ")}. შეგიძლიათ სცადოთ ხელახლა.`
            );
            return;
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
          <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
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
                        className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${quickProjectColor === c ? "ring-2 ring-stone-900 scale-110" : ""
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

          <div>
            <label className="block font-bold text-stone-700 mb-1.5 text-xs">
              გუნდი / მიმართულება <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDepartment(Department.DEVELOPMENT);
                  if (type === TaskType.QA) setType(TaskType.FEATURE);
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${department === Department.DEVELOPMENT
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20"
                    : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                  }`}
              >
                <Code2 size={13} className={department === Department.DEVELOPMENT ? "text-white" : "text-blue-600"} />
                <span>დეველოპმენტი</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDepartment(Department.CONTENT);
                  if (type === TaskType.QA) setType(TaskType.FEATURE);
                }}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${department === Department.CONTENT
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20"
                    : "bg-white text-stone-700 border-stone-200 hover:bg-purple-50/50"
                  }`}
              >
                <PenTool size={13} className={department === Department.CONTENT ? "text-white" : "text-purple-600"} />
                <span>კონტენტი</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: DESCRIPTION & DETAILS                          */}
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
        {/* SECTION 3: INDEPENDENT LINKS & FILES                      */}
        {/* ========================================================= */}
        <div className="p-4 bg-stone-50/60 rounded-2xl border border-stone-200/80 space-y-3">
          <label className="font-extrabold text-stone-900 text-xs block">
            დამოუკიდებელი ბმულები და ფაილები
          </label>

          {/* Links Sub-block (Multiple URLs only, no name field) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                <LinkIcon size={12} className="text-stone-400" />
                <span>გარე ბმულები (Links, GitLab, Figma, Docs...)</span>
              </div>
              <button
                type="button"
                onClick={handleAddLinkRow}
                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>ბმულის დამატება</span>
              </button>
            </div>

            <div className="space-y-2">
              {linkUrls.map((urlValue, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <LinkIcon
                      size={12}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      type="text"
                      value={urlValue}
                      onChange={(e) => handleLinkUrlChange(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (urlValue.trim() && idx === linkUrls.length - 1) {
                            handleAddLinkRow();
                          }
                        }
                      }}
                      placeholder="https://..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                    />
                  </div>
                  {(linkUrls.length > 1 || urlValue.trim().length > 0) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLinkRow(idx)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      title="ბმულის წაშლა"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Files Sub-block (Matching TaskDetailsDrawer Dropzone Design) */}
          <div
            className="space-y-2.5 pt-2 border-t border-stone-200/60"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                setSelectedFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
              }
            }}
          >
            <div className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
              <Paperclip size={13} className="text-orange-600" />
              <span>მიმაგრებული ფაილები ({selectedFiles.length})</span>
            </div>

            <label className="block w-full p-5 bg-white hover:bg-orange-50/20 border-2 border-dashed border-stone-200 hover:border-orange-300 rounded-2xl cursor-pointer transition-all text-center group">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <UploadCloud size={19} />
                </div>
                <div className="text-xs font-bold text-stone-800">
                  დააჭირეთ ფაილის ასარჩევად ან ჩააგდეთ აქ
                </div>
                <div className="text-[11px] text-stone-400 font-medium">
                  PNG, JPG, WebP, PDF, TXT, DOCX • Ctrl+V სქრინშოტის ჩასასმელად (მაქს. 15MB)
                </div>
              </div>
            </label>

            {/* Visual Preview of Selected Images & Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.some((f) => f.type.startsWith("image/")) && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedFiles.map((file, idx) =>
                      file.type.startsWith("image/") ? (
                        <SelectedImageThumb
                          key={`${file.name}-${file.size}-${idx}`}
                          file={file}
                          onPreview={(url, name) => setPreviewImage({ url, name })}
                          onRemove={() => handleRemoveFile(idx)}
                        />
                      ) : null
                    )}
                  </div>
                )}

                {selectedFiles.some((f) => !f.type.startsWith("image/")) && (
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, idx) =>
                      !file.type.startsWith("image/") ? (
                        <div
                          key={`${file.name}-${file.size}-${idx}`}
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
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: ASSIGNEES & ORDER (SEQUENTIAL WORKFLOW)        */}
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
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${sequenceConflict.severity === "error"
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
        {/* SECTION 5: ADDITIONAL OPTIONS (COLLAPSIBLE)              */}
        {/* ========================================================= */}
        <div className="border border-stone-200/80 rounded-2xl overflow-hidden bg-stone-50/40">
          <button
            type="button"
            onClick={() => setShowAdditionalParams((prev) => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-stone-700 hover:bg-stone-100/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-stone-400" />
              <span>დამატებითი პარამეტრები (პრიორიტეტი, ტიპი, სტატუსი)</span>
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

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  სტატუსი
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none cursor-pointer"
                >
                  <option value={TaskStatus.BACKLOG}>TBD / განსახილველი (Backlog)</option>
                  <option value={TaskStatus.PLANNED}>To Do (დაგეგმილი)</option>
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
            ) : savedTaskId ? (
              <span>დარჩენილი ფაილების ატვირთვა</span>
            ) : mode === "create" ? (
              <span>დავალების შექმნა</span>
            ) : (
              <span>ცვლილებების შენახვა</span>
            )}
          </button>
        </div>
      </form>

      {/* Lightbox Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[70] bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between gap-3 bg-stone-50">
              <span className="text-xs font-bold text-stone-800 truncate">
                {previewImage.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 bg-stone-900/5 flex items-center justify-center max-h-[80vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectedImageThumb({
  file,
  onPreview,
  onRemove,
}: {
  file: File;
  onPreview: (url: string, name: string) => void;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (active && typeof reader.result === "string") {
        setUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    return () => {
      active = false;
    };
  }, [file]);

  return (
    <div className="relative group bg-white rounded-xl border border-stone-200 overflow-hidden shadow-2xs">
      {url ? (
        <button
          type="button"
          onClick={() => onPreview(url, file.name)}
          className="block w-full h-24 bg-stone-100 cursor-zoom-in overflow-hidden"
          title="სურათის გადიდება"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </button>
      ) : (
        <div className="w-full h-24 bg-stone-100 flex items-center justify-center">
          <ImageIcon size={20} className="text-stone-400" />
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-rose-50 text-stone-500 hover:text-rose-600 rounded-lg border border-stone-200 shadow-xs cursor-pointer transition-colors"
        title="წაშლა"
      >
        <Trash2 size={12} />
      </button>
      <div className="px-2 py-1.5 border-t border-stone-100 flex items-center justify-between gap-1 text-[10.5px]">
        <span className="font-semibold text-stone-700 truncate">{file.name}</span>
        <span className="text-stone-400 shrink-0">{Math.round(file.size / 1024)} KB</span>
      </div>
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
