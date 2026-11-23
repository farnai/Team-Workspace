"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  CheckCircle2,
  Circle,
  Calendar,
  Lock,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertCircle,
  Loader2,
  Edit3,
  Layers,
  History,
  Info,
  Check,
  Ban,
  MessageSquare,
  Paperclip,
  FileText,
  Pause,
  Play,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Clock,
  UserPlus,
  Users,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { TaskType, Priority, TaskStatus, SubtaskStatus, Department } from "@prisma/client";
import { formatGeorgianDate, formatGeorgianDateShort, isTaskOverdue } from "@/lib/dateUtils";
import { DepartmentBadge } from "@/lib/departments";
import { TaskCommentsSection } from "../components/TaskCommentsSection";
import { TaskAttachmentsSection } from "../components/TaskAttachmentsSection";
import { TaskDailyUpdatesSection } from "../components/TaskDailyUpdatesSection";
import { TaskActivitySection } from "../components/TaskActivitySection";
import { TaskTestingSection } from "@/modules/testing";
import { PasteConfirmModal } from "../components/PasteConfirmModal";
import { ImagePreviewModal } from "../components/ImagePreviewModal";
import { PauseTaskModal } from "../components/PauseTaskModal";
import { BlockTaskModal } from "../components/BlockTaskModal";
import { RescheduleTaskModal } from "../components/RescheduleTaskModal";
import { detectTaskConflicts } from "@/lib/conflicts";
import { DatePicker } from "@/components/ui/DatePicker";

export interface UserOption {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: "ADMIN" | "USER";
}

interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

interface SubtaskItem {
  id: string;
  taskId: string;
  stageId?: string | null;
  position: number;
  title: string;
  description?: string | null;
  status: SubtaskStatus;
  startDate?: string | null;
  deadline?: string | null;
  deadlineLocked: boolean;
  completedById?: string | null;
  completedAt?: string | null;
  completedBy?: { id: string; name: string; avatarUrl?: string | null } | null;
  assignments: {
    user: { id: string; name: string; avatarUrl?: string | null };
  }[];
}

interface StageItem {
  id: string;
  taskId: string;
  position: number;
  title: string;
  description?: string | null;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  deadlineLocked: boolean;
  assignments: {
    user: { id: string; name: string; avatarUrl?: string | null };
  }[];
  subtasks: SubtaskItem[];
}

export interface CommentItem {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

export interface AttachmentItem {
  id: string;
  taskId: string;
  userId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  isExternal: boolean;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

export interface DailyUpdateItem {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl?: string | null };
}

export interface AuditEventItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  reason?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  actor: { id: string; name: string; avatarUrl?: string | null };
}

export interface FullTaskDetails {
  id: string;
  taskNumber: number;
  projectId: string;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  department?: Department;
  startDate?: string | null;
  deadline?: string | null;
  deadlineLocked: boolean;
  progress: number;
  pausedAt?: string | null;
  pauseReason?: string | null;
  blockedReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
  project: ProjectOption;
  creator: UserOption;
  assignments: { user: UserOption }[];
  stages: StageItem[];
  subtasks: SubtaskItem[]; // Direct subtasks (stageId: null)
  comments?: CommentItem[];
  attachments?: AttachmentItem[];
  dailyUpdates?: DailyUpdateItem[];
  auditEvents: AuditEventItem[];
  _count?: {
    testCases?: number;
  };
}

interface TaskDetailsDrawerProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  onEditTask?: (task: FullTaskDetails) => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER";
  };
  users: UserOption[];
  projects?: ProjectOption[];
}

export function TaskDetailsDrawer({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
  onEditTask,
  currentUser,
  users,
  projects,
}: TaskDetailsDrawerProps) {
  const [task, setTask] = useState<FullTaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  type DrawerTab = "work" | "comments" | "daily_updates" | "activity";
  const [activeTab, setActiveTab] = useState<DrawerTab>("work");
  const [error, setError] = useState<string | null>(null);

  // New Subtask form state
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssigneeIds, setNewSubtaskAssigneeIds] = useState<string[]>([]);
  const [newSubtaskDeadline, setNewSubtaskDeadline] = useState("");
  const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

  // Inline Description Edit
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // Inline Assignee Picker
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Modals & Paste State
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pastedFile, setPastedFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string | null>(null);

  // Step 7: Workload, Pause & Reschedule Modals
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);

  // Task Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // Deadline Change Request State (Successor / Admin)
  const [pendingDeadlineRequest, setPendingDeadlineRequest] = useState<{
    id: string;
    createdAt: string;
    actor: { id: string; name: string };
    requestedDeadline: string;
    reason: string;
    stageId?: string | null;
  } | null>(null);
  const [isDeadlineRequestModalOpen, setIsDeadlineRequestModalOpen] = useState(false);
  const [targetRequestStageId, setTargetRequestStageId] = useState<string | null>(null);
  const [reqNewDeadline, setReqNewDeadline] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [isSubmittingDeadlineReq, setIsSubmittingDeadlineReq] = useState(false);

  const isAdmin = currentUser.role === "ADMIN";

  // Step 9.B: Outside-click handling and Tabs accessibility
  const isBackdropMouseDownRef = useRef(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const updateTabsScrollState = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollTabsLeft(el.scrollLeft > 2);
    setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateTabsScrollState();
    const el = tabsContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateTabsScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateTabsScrollState, isOpen, activeTab]);

  const handleTabSelect = (tab: DrawerTab) => {
    setActiveTab(tab);
    const btn = tabRefs.current[tab];
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isBackdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget) {
      if (
        isPauseModalOpen ||
        isBlockModalOpen ||
        isRescheduleModalOpen ||
        showDeleteConfirm ||
        pastedFile !== null ||
        previewImageUrl !== null
      ) {
        return;
      }
      onClose();
    }
    isBackdropMouseDownRef.current = false;
  };

  // Fetch Full Task Data
  const refreshTaskDetails = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data.task);
        setDescValue(data.task.description || "");
      }
      const reqRes = await fetch(`/api/tasks/${taskId}/deadline-request`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setPendingDeadlineRequest(reqData.pendingRequest || null);
      }
    } catch (err: unknown) {
      console.error("Failed to refresh task details:", err);
    }
  }, [taskId]);

  useEffect(() => {
    if (!isOpen || !taskId) return;
    let active = true;

    async function loadDetails() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        if (!res.ok) {
          throw new Error("დავალების ჩატვირთვა ვერ მოხერხდა");
        }
        const data = await res.json();
        if (active) {
          setTask(data.task);
          setDescValue(data.task.description || "");
        }
        const reqRes = await fetch(`/api/tasks/${taskId}/deadline-request`);
        if (reqRes.ok && active) {
          const reqData = await reqRes.json();
          setPendingDeadlineRequest(reqData.pendingRequest || null);
        }
      } catch (err: unknown) {
        if (active) {
          setError((err as Error).message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadDetails();
    return () => {
      active = false;
    };
  }, [isOpen, taskId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        // If a child modal/preview is open, do not close the entire drawer
        if (
          isPauseModalOpen ||
          isBlockModalOpen ||
          isRescheduleModalOpen ||
          showDeleteConfirm ||
          Boolean(pastedFile) ||
          Boolean(previewImageUrl)
        ) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    onClose,
    isPauseModalOpen,
    isBlockModalOpen,
    isRescheduleModalOpen,
    showDeleteConfirm,
    pastedFile,
    previewImageUrl,
  ]);

  // --- Handlers ---

  // Toggle Subtask Status
  const handleToggleSubtask = async (subtask: SubtaskItem) => {
    const nextStatus =
      subtask.status === SubtaskStatus.DONE ? SubtaskStatus.TODO : SubtaskStatus.DONE;
    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "საბტასკის სტატუსის ცვლილება ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Set QA Block Status (Pass / Failed / Reset to TODO)
  const handleSetQaBlockStatus = async (
    subtaskId: string,
    targetStatus: SubtaskStatus,
    currentStatus: SubtaskStatus
  ) => {
    const nextStatus = currentStatus === targetStatus ? SubtaskStatus.TODO : targetStatus;
    try {
      setError(null);
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "ბლოკის სტატუსის შეცვლა ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Cancel Subtask
  const handleCancelSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: SubtaskStatus.CANCELLED }),
      });
      if (!res.ok) throw new Error("საბტასკის გაუქმება ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Delete Subtask
  const handleDeleteSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("საბტასკის წაშლა ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Create Subtask
  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newSubtaskTitle.trim()) return;

    setIsSubmittingSubtask(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          stageId: null,
          assigneeIds: newSubtaskAssigneeIds,
          deadline: newSubtaskDeadline ? new Date(newSubtaskDeadline).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "საბტასკის დამატება ვერ მოხერხდა");
      }
      setNewSubtaskTitle("");
      setNewSubtaskAssigneeIds([]);
      setNewSubtaskDeadline("");
      setShowAddSubtask(false);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingSubtask(false);
    }
  };

  // Save Description
  const handleSaveDescription = async () => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue.trim() || null }),
      });
      if (!res.ok) throw new Error("აღწერის განახლება ვერ მოხერხდა");
      setIsEditingDesc(false);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Reassign Task to Another Project
  const handleUpdateProject = async (newProjectId: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: newProjectId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "პროექტის შეცვლა ვერ მოხერხდა");
      }
      const found = projects?.find((p) => p.id === newProjectId);
      if (found) {
        setTask((prev) =>
          prev ? { ...prev, projectId: newProjectId, project: found } : null
        );
      }
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Update Department
  const handleUpdateDepartment = async (newDepartment: Department) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: newDepartment }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "გუნდის შეცვლა ვერ მოხერხდა");
      }
      setTask((prev) => (prev ? { ...prev, department: newDepartment } : null));
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Update Task Assignees
  const handleUpdateTaskAssignees = async (newAssigneeIds: string[]) => {
    if (!task) return;
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: newAssigneeIds }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "შემსრულებლების განახლება ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Status Change
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    if (newStatus === TaskStatus.PAUSED) {
      setIsPauseModalOpen(true);
      return;
    }
    if (newStatus === TaskStatus.BLOCKED) {
      setIsBlockModalOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "სტატუსის განახლება ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Pause Task Handler
  const handlePauseTask = async (reason: string) => {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: TaskStatus.PAUSED, pauseReason: reason }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "დავალების შეჩერება ვერ მოხერხდა");
    await refreshTaskDetails();
    onTaskUpdated();
  };

  // Resume Task Handler
  const handleResumeTask = async () => {
    if (!task) return;
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: TaskStatus.IN_PROGRESS }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "დავალების განახლება ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Block Task Handler
  const handleBlockTask = async (reason: string) => {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: TaskStatus.BLOCKED, blockedReason: reason }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "დავალების დაბლოკვა ვერ მოხერხდა");
    await refreshTaskDetails();
    onTaskUpdated();
  };

  // Unblock Task Handler
  const handleUnblockTask = async () => {
    if (!task) return;
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: TaskStatus.IN_PROGRESS }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "დავალების განბლოკვა ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Delete Task Handler
  const handleDeleteTask = async () => {
    if (!taskId) return;
    try {
      setIsDeletingTask(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "ტასკის წაშლა ვერ მოხერხდა");
      setShowDeleteConfirm(false);
      onClose();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsDeletingTask(false);
    }
  };

  // Priority Change Handler
  const handlePriorityChange = async (newPriority: Priority) => {
    if (!task) return;
    try {
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "პრიორიტეტის განახლება ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Admin / Initial Deadline Reschedule Handler
  const handleReschedule = async (
    newStartDate: string | null,
    newDeadline: string | null,
    reason: string
  ) => {
    if (!task) return;
    const effectiveStartDate = newStartDate
      ? new Date(newStartDate).toISOString()
      : !task.startDate && newDeadline
      ? new Date().toISOString()
      : task.startDate || null;

    const payload: Record<string, unknown> = {
      startDate: effectiveStartDate,
      deadline: newDeadline ? new Date(newDeadline).toISOString() : null,
      rescheduleReason: reason,
    };

    if (
      newDeadline &&
      (task.status === TaskStatus.BACKLOG || task.status === TaskStatus.PLANNED)
    ) {
      payload.status = TaskStatus.IN_PROGRESS;
    }

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "განრიგის განახლება ვერ მოხერხდა");
    await refreshTaskDetails();
    onTaskUpdated();
  };

  // Deadline Change Request Handlers
  const handleAdminApproveRequest = async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/deadline-request`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "მოთხოვნის დამტკიცება ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleAdminRejectRequest = async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/deadline-request`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "მოთხოვნის უარყოფა ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleSubmitDeadlineRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !reqNewDeadline || !reqReason.trim()) return;
    try {
      setIsSubmittingDeadlineReq(true);
      const res = await fetch(`/api/tasks/${taskId}/deadline-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedDeadline: reqNewDeadline,
          reason: reqReason.trim(),
          stageId: targetRequestStageId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "მოთხოვნის გაგზავნა ვერ მოხერხდა");
      setIsDeadlineRequestModalOpen(false);
      setReqNewDeadline("");
      setReqReason("");
      setTargetRequestStageId(null);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingDeadlineReq(false);
    }
  };

  // --- File Upload Handler (Preserved for Attachments & Paste Confirm) ---
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!taskId) return;
      if (file.size > 25 * 1024 * 1024) {
        setError("ფაილის მაქსიმალური ზომაა 25MB");
        return;
      }
      const ext = (file.name.substring(file.name.lastIndexOf(".")) || "").toLowerCase();
      const dangerousExtensions = [
        ".exe",
        ".bat",
        ".cmd",
        ".sh",
        ".php",
        ".vbs",
        ".msi",
        ".jar",
        ".ps1",
        ".scr",
        ".dll",
      ];
      if (dangerousExtensions.includes(ext)) {
        setError("ამ ტიპის ფაილის ატვირთვა აკრძალულია უსაფრთხოების მიზნით");
        return;
      }

      try {
        setIsUploadingFile(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "ფაილის ატვირთვა ვერ მოხერხდა");
        }
        await refreshTaskDetails();
        onTaskUpdated();
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setIsUploadingFile(false);
      }
    },
    [taskId, refreshTaskDetails, onTaskUpdated]
  );

  // Paste Listener (Ctrl+V) for screenshots with confirmation modal
  useEffect(() => {
    if (!isOpen || !taskId) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // If user is focused on an input/textarea and text is being pasted, allow native behavior
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
        // If focused in an input and text is also available, prefer normal text paste
        if (isInput && hasText) {
          return;
        }
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          const namedFile = new File([file], `screenshot-${Date.now()}.png`, {
            type: file.type,
          });
          setPastedFile(namedFile);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, taskId]);

  // Direct task assignees
  const responsibleUsers = (task?.assignments || []).map((a) => a.user);

  // Step 7: Conflicts detection for current task
  const taskConflicts = task ? detectTaskConflicts(task) : [];

  const renderSubtaskForm = () => (
    <form
      onSubmit={handleCreateSubtask}
      className="p-3.5 bg-orange-50/60 border border-orange-200/90 rounded-2xl space-y-3 text-xs animate-in slide-in-from-top-2 mt-2"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-stone-900">
          ახალი ქვე-დავალება (ჩეკლისტი)
        </span>
      </div>
      <input
        type="text"
        placeholder="რა არის გასაკეთებელი? (მაგ. ფორმის ვალიდაცია)..."
        value={newSubtaskTitle}
        onChange={(e) => setNewSubtaskTitle(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium"
        required
        autoFocus
      />

      <div className="space-y-2.5">
        <div>
          <label className="text-[10px] font-bold text-stone-500 block mb-1.5">
            შემსრულებელი (აირჩიეთ კლიკით — არასავალდებულო)
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white border border-stone-200 rounded-xl">
            {users.map((u) => {
              const selected = newSubtaskAssigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    setNewSubtaskAssigneeIds((prev) =>
                      selected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                    )
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                    selected
                      ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                      : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                  }`}
                >
                  <span>{u.name}</span>
                  {selected && <Check size={10} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-xs">
          <label className="text-[10px] font-bold text-stone-500 block mb-1">
            ვადა (არასავალდებულო)
          </label>
          <DatePicker
            value={newSubtaskDeadline}
            onChange={(val) => setNewSubtaskDeadline(val)}
            placeholder="აირჩიეთ ვადა"
            size="sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setShowAddSubtask(false);
            setNewSubtaskTitle("");
            setNewSubtaskDeadline("");
            setNewSubtaskAssigneeIds([]);
          }}
          className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white cursor-pointer"
        >
          გაუქმება
        </button>
        <button
          type="submit"
          disabled={isSubmittingSubtask}
          className="px-4 py-1.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
        >
          {isSubmittingSubtask ? "ემატება..." : "დამატება"}
        </button>
      </div>
    </form>
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-stone-900/35 backdrop-blur-2xs animate-in fade-in duration-200"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        data-testid="task-details-drawer"
        className="w-full sm:w-[580px] md:w-[680px] lg:w-[780px] xl:w-[820px] max-w-full h-full bg-white shadow-2xl border-l border-stone-200/90 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 text-stone-900"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drawer Header */}
        <div className="p-4 border-b border-stone-200/80 bg-stone-50/50 flex flex-col gap-2 shrink-0 select-none">
          {/* First Row: Task ID, Badges, Close Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black text-stone-500 bg-stone-200/70 px-2 py-0.5 rounded-md">
                TASK-{task?.taskNumber || "..."}
              </span>

              {task?.type === TaskType.FEATURE && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Feature
                </span>
              )}
              {task?.type === TaskType.QA && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  QA შემოწმება
                </span>
              )}
              {task?.type === TaskType.BUG && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  Bug
                </span>
              )}
              {task?.type === TaskType.HOTFIX && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  Hotfix
                </span>
              )}

              {/* Department Badge */}
              <DepartmentBadge department={task?.department} size="xs" />

              {/* Priority Selector */}
              <select
                value={task?.priority || Priority.MEDIUM}
                onChange={(e) => handlePriorityChange(e.target.value as Priority)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer transition-colors ${
                  task?.priority === Priority.CRITICAL
                    ? "bg-rose-50 text-rose-700 border-rose-300 font-extrabold"
                    : task?.priority === Priority.HIGH
                    ? "bg-orange-50 text-orange-700 border-orange-300"
                    : task?.priority === Priority.LOW
                    ? "bg-stone-50 text-stone-600 border-stone-200"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                }`}
                title="პრიორიტეტის შეცვლა"
              >
                <option value={Priority.LOW}>დაბალი (Low)</option>
                <option value={Priority.MEDIUM}>საშუალო (Medium)</option>
                <option value={Priority.HIGH}>მაღალი (High)</option>
                <option value={Priority.CRITICAL}>კრიტიკული (Critical)</option>
              </select>

              {/* Status Selector */}
              <select
                value={task?.status || TaskStatus.BACKLOG}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border focus:outline-none cursor-pointer ${
                  task?.status === TaskStatus.PAUSED
                    ? "bg-amber-100 text-amber-900 border-amber-300 font-extrabold"
                    : task?.status === TaskStatus.BLOCKED
                    ? "bg-rose-100 text-rose-900 border-rose-300 font-extrabold"
                    : task?.status === TaskStatus.DONE
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold"
                    : "bg-white border-stone-200 text-stone-800"
                }`}
              >
                <option value={TaskStatus.BACKLOG}>TBD / განსახილველი</option>
                <option value={TaskStatus.PLANNED}>To Do (დაგეგმილი)</option>
                <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                <option value={TaskStatus.PAUSED}>Paused (შეჩერებული)</option>
                <option value={TaskStatus.BLOCKED}>Blocked (დაბლოკილი)</option>
                <option value={TaskStatus.DONE}>Done (დასრულებული)</option>
                <option value={TaskStatus.CANCELLED}>Cancelled (გაუქმებული)</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="ტასკის წაშლა"
              >
                <Trash2 size={16} />
              </button>

              <button
                data-testid="close-task-drawer"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors cursor-pointer"
                title="დახურვა (Esc)"
                aria-label="დახურვა"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight leading-snug">
            {task?.title || "იტვირთება..."}
          </h2>

          {/* Action Row: Reopen / Legacy Resume-Unblock / Reschedule */}
          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
            {task?.status === TaskStatus.DONE && (
              <button
                onClick={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="არქივიდან ამოღება და სამუშაოში დაბრუნება"
              >
                <RotateCcw size={12} />
                <span>ხელახლა გახსნა</span>
              </button>
            )}

            {task?.status === TaskStatus.PAUSED && (
              <button
                onClick={handleResumeTask}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Play size={12} fill="currentColor" />
                <span>განახლება</span>
              </button>
            )}

            {task?.status === TaskStatus.BLOCKED && (
              <button
                onClick={handleUnblockTask}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Check size={12} strokeWidth={2.5} />
                <span>განბლოკვა</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-auto shrink-0">
              {(isAdmin || !task?.deadlineLocked) && (
                <button
                  onClick={() => setIsRescheduleModalOpen(true)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={task?.deadline ? "დედლაინის შეცვლა" : "დედლაინის დაყენება"}
                >
                  <Calendar size={12} />
                  <span>
                    {task?.deadline
                      ? `დედლაინი: ${formatGeorgianDateShort(task.deadline)}`
                      : "დედლაინი"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Pending Deadline Change Request Banner */}
          {pendingDeadlineRequest && (
            <div className="mt-2.5 p-3 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-amber-950">
                    დედლაინის შეცვლის მოთხოვნა
                  </div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    <span className="font-bold">{pendingDeadlineRequest.actor.name}</span> ითხოვს ახალ ვადას:{" "}
                    <span className="font-bold font-mono">
                      {formatGeorgianDateShort(pendingDeadlineRequest.requestedDeadline)}
                    </span>
                    {pendingDeadlineRequest.reason && (
                      <span className="italic block text-stone-600 mt-0.5">
                        &quot;{pendingDeadlineRequest.reason}&quot;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isAdmin ? (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    onClick={handleAdminApproveRequest}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    დამტკიცება
                  </button>
                  <button
                    onClick={handleAdminRejectRequest}
                    className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    უარყოფა
                  </button>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">
                  მოლოდინში (ადმინისტრატორი განიხილავს)
                </span>
              )}
            </div>
          )}

          {/* Responsible Users */}
          <div className="flex items-center justify-end gap-3 pt-1 text-xs">
            {/* Current Responsible Participants */}
            <div className="relative flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-[10px] text-stone-400 font-semibold">
                პასუხისმგებელი:
              </span>
              <div className="flex items-center -space-x-1">
                {responsibleUsers.length > 0 ? (
                  responsibleUsers.map((u) => (
                    <div
                      key={u.id}
                      className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-2xs"
                      title={u.name}
                    >
                      {u.name.charAt(0)}
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-stone-400">დაუნიშნავი</span>
                )}
              </div>

              {task && (
                <button
                  type="button"
                  onClick={() => setShowAssigneePicker((prev) => !prev)}
                  className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="შემსრულებლების შეცვლა"
                >
                  <Users size={11} />
                  <span>შეცვლა</span>
                </button>
              )}

              {showAssigneePicker && task && (() => {
                const taskAssigneeIds = (task.assignments || []).map((a) => a.user.id);
                const selectedUsers = taskAssigneeIds
                  .map((id) => users.find((u) => u.id === id))
                  .filter((u): u is NonNullable<typeof u> => Boolean(u));
                const unselectedUsers = users.filter((u) => !taskAssigneeIds.includes(u.id));

                const moveOrder = (idx: number, dir: "up" | "down") => {
                  const next = [...taskAssigneeIds];
                  const target = dir === "up" ? idx - 1 : idx + 1;
                  if (target < 0 || target >= next.length) return;
                  [next[idx], next[target]] = [next[target], next[idx]];
                  handleUpdateTaskAssignees(next);
                };

                return (
                  <div className="absolute right-0 top-full mt-1.5 z-30 w-68 bg-white border border-stone-200 rounded-2xl shadow-xl p-2.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
                      <span className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">
                        შემსრულებლები და რიგითობა
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAssigneePicker(false)}
                        className="text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {selectedUsers.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {selectedUsers.map((u, idx) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-50/70 border border-orange-200/70"
                          >
                            <span className="w-4 h-4 rounded bg-orange-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-stone-900 truncate flex-1">
                              {u.name}
                            </span>
                            {selectedUsers.length > 1 && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveOrder(idx, "up")}
                                  className="px-1 text-[10px] text-stone-500 hover:text-stone-900 disabled:opacity-25 cursor-pointer"
                                  title="წინ გადაწევა"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === selectedUsers.length - 1}
                                  onClick={() => moveOrder(idx, "down")}
                                  className="px-1 text-[10px] text-stone-500 hover:text-stone-900 disabled:opacity-25 cursor-pointer"
                                  title="უკან გადაწევა"
                                >
                                  ↓
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateTaskAssignees(taskAssigneeIds.filter((id) => id !== u.id))
                              }
                              className="p-0.5 text-stone-400 hover:text-rose-600 cursor-pointer"
                              title="ამოშლა"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {unselectedUsers.length > 0 && (
                      <div className="pt-1 border-t border-stone-100 max-h-36 overflow-y-auto space-y-1">
                        {unselectedUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleUpdateTaskAssignees([...taskAssigneeIds, u.id])}
                            className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-stone-50 text-left cursor-pointer"
                          >
                            <span className="font-medium text-stone-700 truncate">{u.name}</span>
                            <span className="text-[10px] font-bold text-orange-600 shrink-0">+ დამატება</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Navigation Tabs: სამუშაო | კომენტარები | დღიური | აქტივობა */}
        <div className="relative border-b border-stone-200 bg-white shrink-0 select-none">
          <div
            ref={tabsContainerRef}
            onScroll={updateTabsScrollState}
            role="tablist"
            className="flex items-center px-3 sm:px-4 gap-1 sm:gap-2 text-xs font-bold overflow-x-auto no-scrollbar scroll-smooth"
          >
            <button
              role="tab"
              aria-selected={activeTab === "work"}
              ref={(el) => { tabRefs.current["work"] = el; }}
              onClick={() => handleTabSelect("work")}
              className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "work"
                  ? "border-orange-600 text-orange-600 font-extrabold"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              <Layers size={14} />
              <span>სამუშაო</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "comments"}
              ref={(el) => { tabRefs.current["comments"] = el; }}
              onClick={() => handleTabSelect("comments")}
              className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "comments"
                  ? "border-orange-600 text-orange-600 font-extrabold"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              <MessageSquare size={14} />
              <span>კომენტარები ({task?.comments?.length || 0})</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "daily_updates"}
              ref={(el) => { tabRefs.current["daily_updates"] = el; }}
              onClick={() => handleTabSelect("daily_updates")}
              className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "daily_updates"
                  ? "border-orange-600 text-orange-600 font-extrabold"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              <FileText size={14} />
              <span>დღიური ({task?.dailyUpdates?.length || 0})</span>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "activity"}
              ref={(el) => { tabRefs.current["activity"] = el; }}
              onClick={() => handleTabSelect("activity")}
              className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === "activity"
                  ? "border-orange-600 text-orange-600 font-extrabold"
                  : "border-transparent text-stone-500 hover:text-stone-900"
              }`}
            >
              <History size={14} />
              <span>აქტივობა ({task?.auditEvents?.length || 0})</span>
            </button>
          </div>

          {/* Left/Right subtle fade overflow indicators on mobile */}
          {canScrollTabsLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-r from-white to-transparent sm:hidden" />
          )}
          {canScrollTabsRight && (
            <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-white to-transparent sm:hidden" />
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Paused Banner */}
        {task?.status === TaskStatus.PAUSED && (
          <div className="mx-6 mt-3 p-3.5 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start justify-between gap-3 text-amber-900 text-xs shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Pause size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-extrabold flex items-center gap-2">
                  <span>დავალება დროებით შეჩერებულია</span>
                  {task.pausedAt && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full">
                      {formatGeorgianDate(task.pausedAt)}
                    </span>
                  )}
                </div>
                {task.pauseReason && (
                  <div className="text-stone-700 font-medium bg-white/80 p-2 rounded-xl border border-amber-200/60 text-[11px]">
                    <span className="font-bold text-amber-800">შეჩერების მიზეზი: </span>
                    {task.pauseReason}
                  </div>
                )}
                <p className="text-[10px] text-amber-700">
                  შეჩერებისას ქვე-დავალებების პროგრესი და ეტაპების რიგითობა უცვლელია. დედლაინი ავტომატურად არ გადაწეულა.
                </p>
              </div>
            </div>
            <button
              onClick={handleResumeTask}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>განახლება</span>
            </button>
          </div>
        )}

        {/* Blocked Banner */}
        {task?.status === TaskStatus.BLOCKED && (
          <div className="mx-6 mt-3 p-3.5 bg-rose-50 border border-rose-200/90 rounded-2xl flex items-start justify-between gap-3 text-rose-900 text-xs shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Ban size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-extrabold text-rose-950">დავალება დაბლოკილია (გარეგანი დაბრკოლება)</div>
                {task.blockedReason && (
                  <div className="text-stone-700 font-medium bg-white/80 p-2 rounded-xl border border-rose-200/60 text-[11px]">
                    <span className="font-bold text-rose-800">დაბრკოლების მიზეზი: </span>
                    {task.blockedReason}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleUnblockTask}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
            >
              <Check size={13} strokeWidth={2.5} />
              <span>განბლოკვა</span>
            </button>
          </div>
        )}

        {/* Scheduling Conflicts Banner */}
        {taskConflicts.length > 0 && (
          <div className="mx-6 mt-3 p-3 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-2 text-xs shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-amber-900">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>განრიგის გაფრთხილებები / კონფლიქტები ({taskConflicts.length})</span>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setIsRescheduleModalOpen(true)}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                >
                  განრიგის კორექტირება
                </button>
              )}
            </div>
            <div className="space-y-1 text-[11px]">
              {taskConflicts.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={c.severity === "critical" ? "text-rose-500 font-bold" : "text-amber-500 font-bold"}>
                    •
                  </span>
                  <span className={c.severity === "critical" ? "font-bold text-rose-800" : "font-medium text-stone-700"}>
                    {c.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !task ? (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-orange-600" />
              <span className="text-xs text-stone-500 font-semibold">
                იტვირთება დეტალები...
              </span>
            </div>
          ) : activeTab === "work" ? (
            /* TAB 1: სამუშაო (Unified Workspace: Description, Stages, Subtasks & Scrollable Files/Links) */
            <div className="space-y-5">
              {/* Compact Inline Editable Description */}
              <div className="p-3.5 bg-stone-50/70 rounded-2xl border border-stone-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-stone-800 uppercase tracking-wider text-[11px]">
                    აღწერა
                  </span>
                  {!isEditingDesc && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 cursor-pointer"
                    >
                      <Edit3 size={11} />
                      <span>{task?.description ? "რედაქტირება" : "აღწერის დამატება"}</span>
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      placeholder="დავალების აღწერა..."
                      className="w-full p-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingDesc(false);
                          setDescValue(task?.description || "");
                        }}
                        className="px-2.5 py-1 border border-stone-200 bg-white rounded-lg font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                      >
                        გაუქმება
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 cursor-pointer"
                      >
                        შენახვა
                      </button>
                    </div>
                  </div>
                ) : task?.description ? (
                  <div className="text-stone-700 leading-relaxed whitespace-pre-wrap break-words">
                    {task.description.split(/(https?:\/\/[^\s<>"']+)/g).map((part, idx) =>
                      /^https?:\/\//.test(part) ? (
                        <a
                          key={idx}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 underline break-all"
                        >
                          {part}
                        </a>
                      ) : (
                        <React.Fragment key={idx}>{part}</React.Fragment>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-stone-400 italic text-[11px]">
                    აღწერა მითითებული არ არის
                  </div>
                )}
              </div>

              {/* Unified Files & Links Section */}
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/40 p-3.5">
                <TaskAttachmentsSection
                  taskId={task?.id || ""}
                  attachments={task?.attachments || []}
                  currentUser={currentUser}
                  onRefresh={refreshTaskDetails}
                  onError={setError}
                  isUploadingFile={isUploadingFile}
                  onUploadFile={handleFileUpload}
                  onPreviewImage={(url: string, title?: string) => {
                    setPreviewImageUrl(url);
                    setPreviewImageTitle(title || null);
                  }}
                />
              </div>

              {task?.department === Department.QA || task?.type === TaskType.QA ? (
                /* QA Testing Checklist Mode (No workflow stages — Pass/Fail per block) */
                (() => {
                  const qaBlocks = task?.subtasks || [];
                  const passedCount = qaBlocks.filter((s) => s.status === SubtaskStatus.DONE).length;
                  const failedCount = qaBlocks.filter((s) => s.status === SubtaskStatus.CANCELLED).length;
                  const untestedCount = qaBlocks.length - passedCount - failedCount;
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck size={16} className="text-emerald-600" />
                            <span>გვერდის ბლოკების ტესტირება (Pass / Failed)</span>
                            <span className="text-[11px] font-bold text-stone-500">
                              ({qaBlocks.length})
                            </span>
                          </h3>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            თითოეული ბლოკი შეამოწმეთ ვიზუალურად და ფუნქციონალურად.
                          </p>
                        </div>
                        {!showAddSubtask && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddSubtask(true);
                              setNewSubtaskAssigneeIds([]);
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer border border-emerald-200"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                            <span>ბლოკის დამატება</span>
                          </button>
                        )}
                      </div>

                      {/* QA Page Verdict Summary Bar */}
                      <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 font-bold">
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ {passedCount} მზადაა (Pass)
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg border ${
                                failedCount > 0
                                  ? "bg-rose-50 text-rose-700 border-rose-300"
                                  : "bg-white text-stone-500 border-stone-200"
                              }`}
                            >
                              ✕ {failedCount} დაზიანება (Failed)
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-white text-stone-600 border border-stone-200">
                              ⏳ {untestedCount} შესამოწმებელი
                            </span>
                          </div>
                          {qaBlocks.length > 0 && untestedCount === 0 && (
                            <span
                              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                failedCount > 0
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}
                            >
                              {failedCount > 0 ? "❌ გვერდის ტესტი ჩავარდა" : "✅ გვერდი მზადაა (Passed)"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500">
                          თუ 1 ბლოკზე მაინც დაფიქსირდა დაზიანება, გვერდის ტესტირების დასრულებისას გვერდს ენიჭება &quot;ტესტი ჩავარდა&quot;.
                        </p>
                      </div>

                      {/* Subtask Form */}
                      {showAddSubtask && renderSubtaskForm()}

                      {/* QA Blocks List */}
                      {qaBlocks.length > 0 ? (
                        <div className="space-y-2">
                          {qaBlocks.map((st, idx) => {
                            const isPassed = st.status === SubtaskStatus.DONE;
                            const isFailed = st.status === SubtaskStatus.CANCELLED;
                            return (
                              <div
                                key={st.id}
                                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 p-3 rounded-xl border text-xs transition-colors ${
                                  isFailed
                                    ? "bg-rose-50/70 border-rose-300"
                                    : isPassed
                                    ? "bg-emerald-50/50 border-emerald-200/80"
                                    : "bg-white border-stone-200/80 hover:border-stone-300"
                                }`}
                              >
                                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                  <span className="mt-0.5 shrink-0">
                                    {isPassed ? (
                                      <CheckCircle2 size={16} className="text-emerald-600 fill-emerald-100" />
                                    ) : isFailed ? (
                                      <XCircle size={16} className="text-rose-600 fill-rose-100" />
                                    ) : (
                                      <Circle size={16} className="text-stone-400" />
                                    )}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-black font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                        #{idx + 1}
                                      </span>
                                      <span
                                        className={`font-semibold ${
                                          isFailed
                                            ? "text-rose-900"
                                            : isPassed
                                            ? "text-emerald-950"
                                            : "text-stone-900"
                                        }`}
                                      >
                                        {st.title}
                                      </span>
                                    </div>

                                    {isPassed && st.completedBy && (
                                      <div className="text-[10px] text-emerald-700 font-medium mt-1">
                                        შეამოწმა: {st.completedBy.name}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSetQaBlockStatus(st.id, SubtaskStatus.DONE, st.status)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
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
                                    onClick={() => handleSetQaBlockStatus(st.id, SubtaskStatus.CANCELLED, st.status)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                      isFailed
                                        ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                                    }`}
                                    title="ბლოკში დაფიქსირდა დაზიანება / ბაგი (Failed)"
                                  >
                                    <XCircle size={12} />
                                    <span>დაზიანებაა</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubtask(st.id)}
                                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                                    title="წაშლა"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-center text-xs text-stone-500">
                          სატესტო ბლოკები ჯერ არ არის დამატებული. დაამატეთ გვერდის შესამოწმებელი ბლოკები.
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (() => {
                const allSubtasks = [
                  ...(task?.subtasks || []),
                  ...(task?.stages?.flatMap((s) => s.subtasks || []) || []),
                ];
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span>ქვე-დავალებები (ჩეკლისტი)</span>
                        <span className="text-[11px] font-bold text-stone-400">
                          ({allSubtasks.length})
                        </span>
                      </h3>
                      {!showAddSubtask && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddSubtask(true);
                            setNewSubtaskAssigneeIds([]);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer shrink-0"
                        >
                          <Plus size={13} strokeWidth={2.5} />
                          <span>დამატება</span>
                        </button>
                      )}
                    </div>

                    {/* Subtasks List */}
                    {allSubtasks.length > 0 && (
                      <div className="space-y-2">
                        {allSubtasks.map((st) => (
                          <div
                            key={st.id}
                            className={`flex items-start justify-between gap-2 p-2.5 rounded-xl border text-xs transition-colors ${
                              st.status === SubtaskStatus.DONE
                                ? "bg-emerald-50/40 border-emerald-200/60"
                                : st.status === SubtaskStatus.CANCELLED
                                ? "bg-stone-50 border-stone-200 opacity-50 line-through"
                                : "bg-white border-stone-200/80 hover:border-stone-300"
                            }`}
                          >
                            <div className="flex items-start gap-2 flex-1">
                              <button
                                onClick={() => handleToggleSubtask(st)}
                                className="mt-0.5 text-stone-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              >
                                {st.status === SubtaskStatus.DONE ? (
                                  <CheckCircle2
                                    size={16}
                                    className="text-emerald-600 fill-emerald-100"
                                  />
                                ) : (
                                  <Circle size={16} />
                                )}
                              </button>

                              <div className="flex-1">
                                <div
                                  className={`font-semibold ${
                                    st.status === SubtaskStatus.DONE
                                      ? "text-stone-500 line-through"
                                      : "text-stone-900"
                                  }`}
                                >
                                  {st.title}
                                </div>

                                <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-1 flex-wrap">
                                  {(st.assignments || []).length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {(st.assignments || []).map((a) => (
                                        <span
                                          key={a.user?.id || Math.random()}
                                          className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold text-[10px] border border-stone-200/80"
                                        >
                                          {a.user?.name || "?"}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {st.deadline && (
                                    <span className="flex items-center gap-0.5 text-stone-600 font-medium">
                                      <Calendar size={10} className="text-stone-400" />
                                      <span>{formatGeorgianDateShort(st.deadline)}</span>
                                      {st.deadlineLocked && (
                                        <Lock size={9} className="text-stone-400" />
                                      )}
                                    </span>
                                  )}

                                  {st.status === SubtaskStatus.DONE && st.completedBy && (
                                    <span className="text-emerald-700 font-medium">
                                      შესრულდა: {st.completedBy.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {st.status !== SubtaskStatus.CANCELLED && (
                                <button
                                  onClick={() => handleCancelSubtask(st.id)}
                                  className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                                  title="გაუქმება"
                                >
                                  <Ban size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteSubtask(st.id)}
                                className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                                title="წაშლა"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Subtask creation form */}
                    {showAddSubtask && renderSubtaskForm()}
                  </div>
                );
              })()
          }
        </div>
          ) : activeTab === "comments" ? (
            /* TAB: კომენტარები (Modular Component) */
            <TaskCommentsSection
              taskId={task?.id || ""}
              comments={task?.comments || []}
              currentUser={currentUser}
              users={users}
              onRefresh={refreshTaskDetails}
              onError={setError}
            />
          ) : activeTab === "daily_updates" ? (
            /* TAB: დღიური ჩანაწერები (Modular Component) */
            <TaskDailyUpdatesSection
              taskId={task?.id || ""}
              dailyUpdates={task?.dailyUpdates || []}
              currentUser={currentUser}
              onRefresh={refreshTaskDetails}
              onError={setError}
            />
          ) : (
            /* TAB: აქტივობა (Modular Component) */
            <TaskActivitySection auditEvents={task?.auditEvents || []} />
          )}
        </div>

        {/* Image Preview Lightbox Modal */}
        <ImagePreviewModal
          imageUrl={previewImageUrl}
          imageTitle={previewImageTitle}
          onClose={() => setPreviewImageUrl(null)}
        />

        {/* Paste Confirmation Modal */}
        <PasteConfirmModal
          file={pastedFile}
          isUploading={isUploadingFile}
          onConfirm={async (file: File) => {
            await handleFileUpload(file);
            setPastedFile(null);
          }}
          onCancel={() => setPastedFile(null)}
        />

        {/* Step 7: Pause Task Modal */}
        {task && (
          <PauseTaskModal
            isOpen={isPauseModalOpen}
            onClose={() => setIsPauseModalOpen(false)}
            taskId={task.id}
            taskTitle={task.title}
            currentStatus={task.status}
            progress={task.progress}
            deadline={task.deadline || null}
            onPauseConfirmed={handlePauseTask}
          />
        )}

        {/* Step 7: Block Task Modal */}
        {task && (
          <BlockTaskModal
            isOpen={isBlockModalOpen}
            onClose={() => setIsBlockModalOpen(false)}
            taskId={task.id}
            taskTitle={task.title}
            onBlockConfirmed={handleBlockTask}
          />
        )}

        {/* Step 7: Admin Reschedule Modal */}
        {task && (
          <RescheduleTaskModal
            isOpen={isRescheduleModalOpen}
            onClose={() => setIsRescheduleModalOpen(false)}
            taskId={task.id}
            taskTitle={task.title}
            currentStartDate={task.startDate || null}
            currentDeadline={task.deadline || null}
            isDeadlineLocked={task.deadlineLocked}
            isAdmin={isAdmin}
            stages={(task.stages || []).map((s) => ({
              id: s.id,
              title: s.title,
              deadline: s.deadline || null,
            }))}
            onRescheduleConfirmed={handleReschedule}
          />
        )}

        {/* Deadline Change Request Modal for Successors / Assignees */}
        {isDeadlineRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Clock size={15} />
                  </div>
                  <h3 className="text-sm font-black text-stone-900">
                    დედლაინის შეცვლის მოთხოვნა
                  </h3>
                </div>
                <button
                  onClick={() => setIsDeadlineRequestModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-stone-500">
                მიუთითეთ ახალი სასურველი ვადა და მიზეზი. მოთხოვნა გადაეგზავნება ადმინისტრატორს დასამტკიცებლად.
              </p>

              <form onSubmit={handleSubmitDeadlineRequest} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    სასურველი ახალი ვადა <span className="text-rose-500">*</span>
                  </label>
                  <DatePicker
                    value={reqNewDeadline}
                    onChange={(val) => setReqNewDeadline(val)}
                    placeholder="სასურველი ვადა"
                    size="md"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    მიზეზი <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="მაგ. წინა ეტაპის დაგვიანების გამო მჭირდება ვადის გადაწევა"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-medium focus:outline-none resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setIsDeadlineRequestModalOpen(false)}
                    className="px-3.5 py-1.5 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 cursor-pointer"
                  >
                    გაუქმება
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDeadlineReq}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingDeadlineReq ? "იგზავნება..." : "მოთხოვნის გაგზავნა"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Task Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
            <div
              className="bg-white rounded-2xl border border-stone-200/90 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-stone-900">
                    დავალების წაშლა
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    დარწმუნებული ხართ, რომ გსურთ დავალების წაშლა?{" "}
                    <strong className="text-stone-900 font-bold">
                      #{task?.taskNumber}: {task?.title}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs text-rose-800 space-y-1">
                <div className="font-bold">ყურადღება: ეს ქმედება შეუქცევადია!</div>
                <div className="text-[11px] text-rose-700/90">
                  დავალებასთან ერთად წაიშლება ყველა დაკავშირებული ეტაპი, საბტასკი, კომენტარი და ფაილი.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={isDeletingTask}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  გაუქმება
                </button>
                <button
                  type="button"
                  disabled={isDeletingTask}
                  onClick={handleDeleteTask}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingTask ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>იშლება...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>წაშლა</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
