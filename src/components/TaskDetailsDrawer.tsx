"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  ExternalLink,
  Download,
  Eye,
  Globe,
  UploadCloud,
  AtSign,
  Send,
} from "lucide-react";
import { TaskType, Priority, TaskStatus, SubtaskStatus } from "@prisma/client";
import { formatGeorgianDate, formatGeorgianDateShort, formatGeorgianDateTime } from "@/lib/dateUtils";

interface UserOption {
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

interface AuditEventItem {
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
}

interface TaskDetailsDrawerProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "USER";
  };
  users: UserOption[];
}

export function TaskDetailsDrawer({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
  currentUser,
  users,
}: TaskDetailsDrawerProps) {
  const [task, setTask] = useState<FullTaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  type DrawerTab = "work" | "details" | "comments" | "attachments" | "daily_updates" | "activity";
  const [activeTab, setActiveTab] = useState<DrawerTab>("work");
  const [error, setError] = useState<string | null>(null);

  // New Stage form state
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [newStageAssigneeIds, setNewStageAssigneeIds] = useState<string[]>([]);
  const [newStageDeadline, setNewStageDeadline] = useState("");
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  // New Subtask form state
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [targetStageId, setTargetStageId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskAssigneeIds, setNewSubtaskAssigneeIds] = useState<string[]>([]);
  const [newSubtaskDeadline, setNewSubtaskDeadline] = useState("");
  const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

  // Inline Description Edit
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // Comments state
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);

  // Attachments & Links state
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkName, setEditLinkName] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [isSavingLinkEdit, setIsSavingLinkEdit] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string | null>(null);

  // Daily Updates state
  const [dailyUpdateText, setDailyUpdateText] = useState("");
  const [isSubmittingDailyUpdate, setIsSubmittingDailyUpdate] = useState(false);
  const [editingDailyUpdateId, setEditingDailyUpdateId] = useState<string | null>(null);
  const [editDailyUpdateText, setEditDailyUpdateText] = useState("");
  const [isSavingDailyUpdateEdit, setIsSavingDailyUpdateEdit] = useState(false);

  const isAdmin = currentUser.role === "ADMIN";

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
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // --- Handlers ---

  // Complete a stage
  const handleCompleteStage = async (stageId: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/stages/${stageId}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ეტაპის დასრულება ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Reorder stage (Move Up / Down)
  const handleMoveStage = async (index: number, direction: "up" | "down") => {
    if (!task) return;
    const stages = [...task.stages];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const currentStage = stages[index];
    const targetStage = stages[targetIndex];

    try {
      // Swap positions
      await Promise.all([
        fetch(`/api/stages/${currentStage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: targetStage.position }),
        }),
        fetch(`/api/stages/${targetStage.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: currentStage.position }),
        }),
      ]);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Create Stage
  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !newStageTitle.trim()) return;

    setIsSubmittingStage(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newStageTitle.trim(),
          assigneeIds: newStageAssigneeIds,
          deadline: newStageDeadline ? new Date(newStageDeadline).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ეტაპის დამატება ვერ მოხერხდა");
      }
      setNewStageTitle("");
      setNewStageAssigneeIds([]);
      setNewStageDeadline("");
      setShowAddStage(false);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingStage(false);
    }
  };

  // Delete Stage
  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("დარწმუნებული ხართ, რომ გსურთ ეტაპის წაშლა?")) return;
    try {
      const res = await fetch(`/api/stages/${stageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ეტაპის წაშლა ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

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

    if (newSubtaskAssigneeIds.length > 0 && !newSubtaskDeadline) {
      setError("შემსრულებლის მინიჭებისას დედლაინის მითითება სავალდებულოა");
      return;
    }

    setIsSubmittingSubtask(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubtaskTitle.trim(),
          stageId: targetStageId,
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
      setTargetStageId(null);
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

  // Status Change
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("სტატუსის განახლება ვერ მოხერხდა");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // --- Step 5 Handlers ---

  // 1. Comments Handlers
  const handleCreateComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !commentText.trim()) return;
    try {
      setIsSubmittingComment(true);
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "კომენტარის დამატება ვერ მოხერხდა");
      }
      setCommentText("");
      setShowMentionMenu(false);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;
    try {
      setIsSavingCommentEdit(true);
      setError(null);
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "კომენტარის განახლება ვერ მოხერხდა");
      }
      setEditingCommentId(null);
      setEditCommentText("");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSavingCommentEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("დარწმუნებული ხართ, რომ გსურთ ამ კომენტარის წაშლა?")) return;
    try {
      setError(null);
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "კომენტარის წაშლა ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // 2. Attachments & Links Handlers
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

  const handleCreateLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !linkName.trim() || !linkUrl.trim()) return;

    const lower = linkUrl.trim().toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      setError("ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით");
      return;
    }

    try {
      setIsSubmittingLink(true);
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: linkName.trim(), url: linkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ბმულის დამატება ვერ მოხერხდა");
      }
      setLinkName("");
      setLinkUrl("");
      setShowAddLink(false);
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleEditLink = async (linkId: string) => {
    if (!editLinkName.trim() || !editLinkUrl.trim()) return;
    const lower = editLinkUrl.trim().toLowerCase();
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      setError("ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით");
      return;
    }

    try {
      setIsSavingLinkEdit(true);
      setError(null);
      const res = await fetch(`/api/attachments/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editLinkName.trim(), url: editLinkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ბმულის განახლება ვერ მოხერხდა");
      }
      setEditingLinkId(null);
      setEditLinkName("");
      setEditLinkUrl("");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSavingLinkEdit(false);
    }
  };

  const handleDeleteAttachment = async (id: string, isExternal: boolean) => {
    const msg = isExternal
      ? "დარწმუნებული ხართ, რომ გსურთ ამ ბმულის წაშლა?"
      : "დარწმუნებული ხართ, რომ გსურთ ამ ფაილის წაშლა?";
    if (!confirm(msg)) return;
    try {
      setError(null);
      const res = await fetch(`/api/attachments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "წაშლა ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // 3. Daily Updates Handlers
  const handleCreateDailyUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!task || !dailyUpdateText.trim()) return;
    try {
      setIsSubmittingDailyUpdate(true);
      setError(null);
      const res = await fetch(`/api/tasks/${task.id}/daily-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: dailyUpdateText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ჩანაწერის დამატება ვერ მოხერხდა");
      }
      setDailyUpdateText("");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmittingDailyUpdate(false);
    }
  };

  const handleEditDailyUpdate = async (updateId: string) => {
    if (!editDailyUpdateText.trim()) return;
    try {
      setIsSavingDailyUpdateEdit(true);
      setError(null);
      const res = await fetch(`/api/daily-updates/${updateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDailyUpdateText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ჩანაწერის განახლება ვერ მოხერხდა");
      }
      setEditingDailyUpdateId(null);
      setEditDailyUpdateText("");
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSavingDailyUpdateEdit(false);
    }
  };

  const handleDeleteDailyUpdate = async (updateId: string) => {
    if (!confirm("დარწმუნებული ხართ, რომ გსურთ ამ ჩანაწერის წაშლა?")) return;
    try {
      setError(null);
      const res = await fetch(`/api/daily-updates/${updateId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "ჩანაწერის წაშლა ვერ მოხერხდა");
      }
      await refreshTaskDetails();
      onTaskUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  // Paste Listener (Ctrl+V) for screenshots
  useEffect(() => {
    if (!isOpen || !taskId) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const namedFile = new File([file], `screenshot-${Date.now()}.png`, {
              type: file.type,
            });
            await handleFileUpload(namedFile);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, taskId, handleFileUpload]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDomainFromUrl = (urlStr: string): string => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return urlStr;
    }
  };

  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_\u10D0-\u10FA]+)/g);
    return (
      <span className="whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            return (
              <span
                key={i}
                className="inline-block px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold text-[11px] mx-0.5"
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  // Format Audit Action label
  const formatAuditAction = (action: string, entityType?: string, reason?: string | null) => {
    switch (action) {
      case "TASK_CREATED":
        return "ტასკი შეიქმნა";
      case "TASK_UPDATED":
        if (entityType === "COMMENT") return "კომენტარი შეიცვალა / წაიშალა";
        if (entityType === "DAILY_UPDATE") return "დღიური ჩანაწერი შეიცვალა / წაიშალა";
        if (entityType === "ATTACHMENT") return "გარე ბმული შეიცვალა";
        return reason ? reason : "ტასკი განახლდა";
      case "COMMENT_ADDED":
        return "ახალი კომენტარი დაემატა";
      case "ATTACHMENT_ADDED":
        return "ფაილი / გარე ბმული დაემატა";
      case "ATTACHMENT_REMOVED":
        return "ფაილი / გარე ბმული წაიშალა";
      case "DAILY_UPDATE_ADDED":
        return "დღიური სამუშაო ჩანაწერი დაემატა";
      case "STAGE_CREATED":
        return "სამუშაო ეტაპი შეიქმნა";
      case "STAGE_COMPLETED":
        return "ეტაპი დასრულდა და გადაეცა შემდეგ შემსრულებელს";
      case "STAGE_REORDERED":
        return "ეტაპების რიგითობა შეიცვალა";
      case "SUBTASK_CREATED":
        return "ახალი საბტასკი დაემატა";
      case "SUBTASK_COMPLETED":
        return "საბტასკი შესრულდა";
      case "SUBTASK_REOPENED":
        return "საბტასკი ხელახლა გაიხსნა";
      case "DEADLINE_CHANGED":
        return "დედლაინი შეიცვალა ადმინისტრატორის მიერ";
      case "STATUS_CHANGED":
        return "სტატუსი განახლდა";
      case "WORK_PAUSED":
        return "სამუშაო შეჩერდა";
      case "WORK_RESUMED":
        return "სამუშაო განახლდა";
      default:
        return action;
    }
  };

  // Currently responsible participants (from active stage or direct task assignments)
  const activeStage = task?.stages.find((s) => s.isActive && !s.isCompleted);
  const responsibleUsers = activeStage?.assignments.length
    ? activeStage.assignments.map((a) => a.user)
    : task?.assignments.map((a) => a.user) || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-stone-900/30 backdrop-blur-2xs animate-in fade-in duration-200">
      <div
        className="w-full sm:w-[560px] md:w-[620px] lg:w-[680px] h-full bg-white shadow-2xl border-l border-stone-200/90 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 text-stone-900"
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

              {/* Status Selector */}
              <select
                value={task?.status || TaskStatus.BACKLOG}
                onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-800 focus:outline-none cursor-pointer"
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

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors cursor-pointer"
              title="დახურვა (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Title */}
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight leading-snug">
            {task?.title || "იტვირთება..."}
          </h2>

          {/* Progress Banner & Responsible Users */}
          <div className="flex items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex-1 max-w-xs space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600">
                <span>საერთო პროგრესი</span>
                <span className="text-emerald-600 font-extrabold">
                  {task?.progress || 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${task?.progress || 0}%` }}
                />
              </div>
            </div>

            {/* Current Responsible Participants */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-stone-400 font-semibold hidden sm:inline">
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
            </div>
          </div>
        </div>

        {/* Navigation Tabs: სამუშაო | დეტალები | კომენტარები | ფაილები | დღიური | აქტივობა */}
        <div className="flex items-center border-b border-stone-200 px-4 gap-1 sm:gap-2 text-xs font-bold shrink-0 bg-white select-none overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("work")}
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
            onClick={() => setActiveTab("details")}
            className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "details"
                ? "border-orange-600 text-orange-600 font-extrabold"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <Info size={14} />
            <span>დეტალები</span>
          </button>
          <button
            onClick={() => setActiveTab("comments")}
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
            onClick={() => setActiveTab("attachments")}
            className={`py-3 px-2 flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "attachments"
                ? "border-orange-600 text-orange-600 font-extrabold"
                : "border-transparent text-stone-500 hover:text-stone-900"
            }`}
          >
            <Paperclip size={14} />
            <span>ფაილები ({task?.attachments?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("daily_updates")}
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
            onClick={() => setActiveTab("activity")}
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
            /* TAB 1: სამუშაო (Ordered Workflow Stages & Subtasks) */
            <div className="space-y-6">
              {/* Ordered Stages List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>სამუშაო ეტაპები</span>
                    <span className="text-[11px] font-bold text-stone-400">
                      ({task?.stages?.length || 0})
                    </span>
                  </h3>
                  <button
                    onClick={() => setShowAddStage(!showAddStage)}
                    className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    <span>ახალი ეტაპი</span>
                  </button>
                </div>

                {/* Add Stage Form Drawer */}
                {showAddStage && (
                  <form
                    onSubmit={handleCreateStage}
                    className="p-4 bg-orange-50/60 border border-orange-200/80 rounded-2xl space-y-3 text-xs animate-in slide-in-from-top-2"
                  >
                    <div className="font-bold text-stone-800">
                      ახალი სამუშაო ეტაპის დამატება
                    </div>
                    <input
                      type="text"
                      placeholder="ეტაპის სათაური (მაგ. UI/UX დიზაინი, QA ტესტირება)..."
                      value={newStageTitle}
                      onChange={(e) => setNewStageTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium"
                      required
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          დედლაინი
                        </label>
                        <input
                          type="date"
                          value={newStageDeadline}
                          onChange={(e) => setNewStageDeadline(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          პასუხისმგებლები
                        </label>
                        <select
                          multiple
                          value={newStageAssigneeIds}
                          onChange={(e) =>
                            setNewStageAssigneeIds(
                              Array.from(e.target.selectedOptions, (o) => o.value)
                            )
                          }
                          className="w-full px-2 py-1 bg-white border border-stone-200 rounded-xl text-xs font-medium h-16"
                        >
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddStage(false)}
                        className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white"
                      >
                        გაუქმება
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingStage}
                        className="px-4 py-1.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50"
                      >
                        {isSubmittingStage ? "ემატება..." : "ეტაპის დამატება"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Stages Sequence */}
                {task?.stages && task.stages.length > 0 ? (
                  <div className="space-y-3">
                    {task.stages.map((stage, sIdx) => {
                      const totalStageSubtasks = stage.subtasks.filter(
                        (st) => st.status !== SubtaskStatus.CANCELLED
                      ).length;
                      const doneStageSubtasks = stage.subtasks.filter(
                        (st) => st.status === SubtaskStatus.DONE
                      ).length;
                      const canCompleteStage =
                        !stage.isCompleted &&
                        stage.isActive &&
                        stage.subtasks.every(
                          (st) =>
                            st.status === SubtaskStatus.DONE ||
                            st.status === SubtaskStatus.CANCELLED
                        );

                      return (
                        <div
                          key={stage.id}
                          className={`rounded-2xl border transition-all ${
                            stage.isActive
                              ? "bg-white border-orange-500/80 shadow-xs ring-2 ring-orange-500/10"
                              : stage.isCompleted
                              ? "bg-emerald-50/30 border-emerald-200/80"
                              : "bg-stone-50/70 border-stone-200/80 opacity-80"
                          }`}
                        >
                          {/* Stage Header */}
                          <div className="p-3.5 flex items-center justify-between gap-2 border-b border-stone-100">
                            <div className="flex items-center gap-2.5">
                              {/* Stage Step Badge */}
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                  stage.isCompleted
                                    ? "bg-emerald-500 text-white"
                                    : stage.isActive
                                    ? "bg-orange-600 text-white shadow-2xs"
                                    : "bg-stone-200 text-stone-600"
                                }`}
                              >
                                {stage.isCompleted ? (
                                  <Check size={14} strokeWidth={3} />
                                ) : (
                                  sIdx + 1
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-extrabold text-stone-900">
                                    {stage.title}
                                  </h4>
                                  {totalStageSubtasks > 0 && (
                                    <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-md">
                                      {doneStageSubtasks}/{totalStageSubtasks} საბტასკი
                                    </span>
                                  )}
                                  {stage.isActive && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-700 uppercase">
                                      მიმდინარე
                                    </span>
                                  )}
                                  {stage.isCompleted && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700">
                                      დასრულებული
                                    </span>
                                  )}
                                  {!stage.isActive && !stage.isCompleted && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-stone-200/80 text-stone-500">
                                      მოლოდინში
                                    </span>
                                  )}
                                </div>

                                {/* Assignees & Dates */}
                                <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                                  <div className="flex items-center gap-1 font-medium">
                                    {stage.assignments.length > 0 ? (
                                      stage.assignments.map((a) => (
                                        <span
                                          key={a.user.id}
                                          className="text-stone-700 font-semibold"
                                        >
                                          {a.user.name}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-stone-400">
                                        შემსრულებლის გარეშე
                                      </span>
                                    )}
                                  </div>
                                  {stage.deadline && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-0.5 font-semibold text-stone-600">
                                        <Calendar size={11} className="text-stone-400" />
                                        <span>
                                          {formatGeorgianDateShort(stage.deadline)}
                                        </span>
                                        {stage.deadlineLocked && (
                                          <Lock size={10} className="text-stone-400" />
                                        )}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Stage Controls: Move Up/Down, Complete, Delete */}
                            <div className="flex items-center gap-1">
                              {/* Move Up / Down Buttons */}
                              <div className="flex items-center bg-stone-100 rounded-lg p-0.5">
                                <button
                                  onClick={() => handleMoveStage(sIdx, "up")}
                                  disabled={sIdx === 0}
                                  className="p-1 hover:bg-white rounded text-stone-500 hover:text-stone-900 disabled:opacity-30 cursor-pointer"
                                  title="ზემოთ აწევა"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => handleMoveStage(sIdx, "down")}
                                  disabled={sIdx === task.stages.length - 1}
                                  className="p-1 hover:bg-white rounded text-stone-500 hover:text-stone-900 disabled:opacity-30 cursor-pointer"
                                  title="ქვემოთ ჩამოწევა"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>

                              {/* Complete Stage Action Button */}
                              {stage.isActive && !stage.isCompleted && (
                                <button
                                  onClick={() => handleCompleteStage(stage.id)}
                                  disabled={!canCompleteStage}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    canCompleteStage
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                                  }`}
                                  title={
                                    canCompleteStage
                                      ? "ეტაპის დასრულება და ჰენდოფი"
                                      : "ეტაპის დასასრულებლად ჯერ შეასრულეთ მისი ყველა საბტასკი"
                                  }
                                >
                                  <CheckCircle2 size={13} />
                                  <span>დასრულება</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteStage(stage.id)}
                                className="p-1 text-stone-400 hover:text-rose-600 rounded hover:bg-stone-100 transition-colors cursor-pointer"
                                title="ეტაპის წაშლა"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Stage Subtasks Checklist */}
                          <div className="p-3 space-y-2 bg-white/50">
                            {stage.subtasks.length === 0 ? (
                              <div className="text-[11px] text-stone-400 italic py-1">
                                ეტაპში საბტასკები არ არის დამატებული.
                              </div>
                            ) : (
                              stage.subtasks.map((st) => (
                                <div
                                  key={st.id}
                                  className={`flex items-start justify-between gap-2 p-2 rounded-xl border text-xs transition-colors ${
                                    st.status === SubtaskStatus.DONE
                                      ? "bg-emerald-50/40 border-emerald-200/60"
                                      : st.status === SubtaskStatus.CANCELLED
                                      ? "bg-stone-50 border-stone-200 opacity-50 line-through"
                                      : "bg-white border-stone-200/80 hover:border-stone-300"
                                  }`}
                                >
                                  {/* Checkbox & Title */}
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

                                      {/* Subtask Meta: Assignees, Deadline, Completer */}
                                      <div className="flex items-center gap-2 text-[10px] text-stone-500 mt-1 flex-wrap">
                                        {/* Multi Assignees Avatars */}
                                        <div className="flex items-center -space-x-1">
                                          {st.assignments.map((a) => (
                                            <div
                                              key={a.user.id}
                                              className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 font-bold text-[9px] flex items-center justify-center border border-white"
                                              title={a.user.name}
                                            >
                                              {a.user.name.charAt(0)}
                                            </div>
                                          ))}
                                        </div>

                                        {st.deadline && (
                                          <span className="flex items-center gap-0.5 text-stone-600 font-medium">
                                            <Calendar size={10} className="text-stone-400" />
                                            <span>
                                              {formatGeorgianDateShort(st.deadline)}
                                            </span>
                                            {st.deadlineLocked && (
                                              <Lock size={9} className="text-stone-400" />
                                            )}
                                          </span>
                                        )}

                                        {st.status === SubtaskStatus.DONE &&
                                          st.completedBy && (
                                            <span className="text-emerald-700 font-medium">
                                              შესრულდა: {st.completedBy.name}
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Subtask Actions */}
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
                              ))
                            )}

                            {/* Add Subtask Trigger for this stage */}
                            <button
                              onClick={() => {
                                setTargetStageId(stage.id);
                                setShowAddSubtask(true);
                              }}
                              className="w-full flex items-center justify-center gap-1 py-1 text-[11px] font-bold text-stone-600 hover:text-orange-600 hover:bg-orange-50/50 rounded-lg border border-dashed border-stone-200 transition-all cursor-pointer"
                            >
                              <Plus size={12} />
                              <span>საბტასკის დამატება ეტაპზე</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-center text-xs text-stone-500">
                    სამუშაო ეტაპები არ არის შექმნილი. დაამატეთ ეტაპები (მაგ. დიზაინი,
                    Development, QA).
                  </div>
                )}
              </div>

              {/* Direct Subtasks Section (stageId: null) */}
              <div className="pt-4 border-t border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>დამოუკიდებელი საბტასკები</span>
                    <span className="text-[11px] font-bold text-stone-400">
                      ({task?.subtasks?.length || 0})
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      setTargetStageId(null);
                      setShowAddSubtask(true);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    <span>საბტასკის დამატება</span>
                  </button>
                </div>

                {/* Subtasks List */}
                {task?.subtasks && task.subtasks.length > 0 ? (
                  <div className="space-y-2">
                    {task.subtasks.map((st) => (
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
                              <div className="flex items-center -space-x-1">
                                {st.assignments.map((a) => (
                                  <div
                                    key={a.user.id}
                                    className="w-4 h-4 rounded-full bg-stone-200 text-stone-700 font-bold text-[9px] flex items-center justify-center border border-white"
                                    title={a.user.name}
                                  >
                                    {a.user.name.charAt(0)}
                                  </div>
                                ))}
                              </div>

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
                ) : (
                  <div className="text-[11px] text-stone-400 italic">
                    დამოუკიდებელი საბტასკები არ არის.
                  </div>
                )}
              </div>

              {/* Add Subtask Drawer/Modal */}
              {showAddSubtask && (
                <form
                  onSubmit={handleCreateSubtask}
                  className="p-4 bg-orange-50/60 border border-orange-200 rounded-2xl space-y-3 text-xs animate-in slide-in-from-top-2"
                >
                  <div className="font-bold text-stone-800">
                    ახალი საბტასკის შექმნა{" "}
                    {targetStageId ? "(ეტაპისთვის)" : "(დამოუკიდებელი)"}
                  </div>
                  <input
                    type="text"
                    placeholder="საბტასკის სათაური..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium"
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">
                        დედლაინი (სავალდებულოა თუ მინიჭებულია)
                      </label>
                      <input
                        type="date"
                        value={newSubtaskDeadline}
                        onChange={(e) => setNewSubtaskDeadline(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-stone-500 block mb-1">
                        შემსრულებლები (მრავალარჩევითი)
                      </label>
                      <select
                        multiple
                        value={newSubtaskAssigneeIds}
                        onChange={(e) =>
                          setNewSubtaskAssigneeIds(
                            Array.from(e.target.selectedOptions, (o) => o.value)
                          )
                        }
                        className="w-full px-2 py-1 bg-white border border-stone-200 rounded-xl text-xs font-medium h-16"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubtask(false);
                        setTargetStageId(null);
                      }}
                      className="px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white"
                    >
                      გაუქმება
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingSubtask}
                      className="px-4 py-1.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50"
                    >
                      {isSubmittingSubtask ? "ემატება..." : "საბტასკის დამატება"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : activeTab === "details" ? (
            /* TAB 2: დეტალები (Task Description & Metadata) */
            <div className="space-y-5 text-xs">
              {/* Description Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-800">აღწერა</h4>
                  {!isEditingDesc && (
                    <button
                      onClick={() => setIsEditingDesc(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                    >
                      <Edit3 size={12} />
                      <span>რედაქტირება</span>
                    </button>
                  )}
                </div>

                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setIsEditingDesc(false);
                          setDescValue(task?.description || "");
                        }}
                        className="px-3 py-1 border border-stone-200 rounded-lg font-semibold text-stone-600 hover:bg-stone-50"
                      >
                        გაუქმება
                      </button>
                      <button
                        onClick={handleSaveDescription}
                        className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700"
                      >
                        შენახვა
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-stone-700 leading-relaxed min-h-[60px] whitespace-pre-wrap">
                    {task?.description || "აღწერა არ არის მითითებული."}
                  </div>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-stone-200">
                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">
                    პროექტი
                  </span>
                  <span className="font-extrabold text-stone-900 block">
                    {task?.project.name}
                  </span>
                </div>

                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">
                    პრიორიტეტი
                  </span>
                  <span className="font-extrabold text-stone-900 block">
                    {task?.priority}
                  </span>
                </div>

                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">
                    დაწყების თარიღი
                  </span>
                  <span className="font-bold text-stone-700 block">
                    {formatGeorgianDate(task?.startDate)}
                  </span>
                </div>

                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 flex items-center justify-between uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <span>დედლაინი</span>
                      {task?.deadlineLocked && <Lock size={10} />}
                    </span>
                    {task?.deadlineLocked && (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                        {isAdmin ? "ადმინის მართვა" : "დაბლოკილი"}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-stone-700 block">
                    {formatGeorgianDate(task?.deadline)}
                  </span>
                </div>

                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">
                    შემქმნელი
                  </span>
                  <span className="font-bold text-stone-800 block">
                    {task?.creator.name}
                  </span>
                </div>

                <div className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-stone-400 block uppercase tracking-wider">
                    შექმნის დრო
                  </span>
                  <span className="font-medium text-stone-600 block">
                    {formatGeorgianDate(task?.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          ) : activeTab === "comments" ? (
            /* TAB: კომენტარები (Discussion Thread) */
            <div className="space-y-4 text-xs">
              {/* New Comment Input Box */}
              <form onSubmit={handleCreateComment} className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-800 flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-orange-600" />
                    <span>ახალი კომენტარი</span>
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMentionMenu(!showMentionMenu)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-200/70 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-stone-600 transition-colors cursor-pointer"
                      title="მონიშნეთ გუნდის წევრი"
                    >
                      <AtSign size={11} />
                      <span>მონიშვნა</span>
                    </button>
                    {showMentionMenu && (
                      <div className="absolute right-0 top-6 z-20 w-44 bg-white border border-stone-200 rounded-xl shadow-lg p-1 space-y-0.5 max-h-48 overflow-y-auto">
                        <div className="text-[10px] font-bold text-stone-400 px-2 py-1">გუნდის წევრები:</div>
                        {users.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setCommentText((prev) => `${prev}@${u.name} `);
                              setShowMentionMenu(false);
                            }}
                            className="w-full text-left px-2 py-1 hover:bg-orange-50 hover:text-orange-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                          >
                            <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[9px] flex items-center justify-center font-bold">
                              {u.name.charAt(0)}
                            </span>
                            <span>{u.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="დაწერეთ კომენტარი... გამოიყენეთ @ გუნდის წევრის მოსანიშნად"
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none text-xs"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-stone-400">
                    {commentText.length}/5000 სიმბოლო
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !commentText.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {isSubmittingComment ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    <span>გაგზავნა</span>
                  </button>
                </div>
              </form>

              {/* Comments Thread */}
              <div className="space-y-3 pt-2">
                <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center justify-between">
                  <span>დისკუსია ({task?.comments?.length || 0})</span>
                </h4>

                {task?.comments && task.comments.length > 0 ? (
                  <div className="space-y-3">
                    {task.comments.map((c) => {
                      const isAuthor = c.userId === currentUser.id;
                      const canManage = isAuthor || isAdmin;
                      const isEdited =
                        c.updatedAt &&
                        new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 2000;

                      return (
                        <div
                          key={c.id}
                          className="p-3.5 bg-stone-50/80 border border-stone-200/80 rounded-2xl space-y-2 relative group hover:border-stone-300 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 border border-white shadow-2xs">
                                {c.user.name.charAt(0)}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-stone-900">{c.user.name}</span>
                                <span className="text-[10px] text-stone-400">
                                  {formatGeorgianDateTime(c.createdAt)}
                                </span>
                                {isEdited && (
                                  <span className="text-[10px] font-semibold text-stone-400 italic">
                                    (რედაქტირებულია)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions for Author or Admin */}
                            {canManage && editingCommentId !== c.id && (
                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditCommentText(c.content);
                                  }}
                                  className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded cursor-pointer transition-colors"
                                  title="რედაქტირება"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                  title="წაშლა"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>

                          {editingCommentId === c.id ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={3}
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                className="w-full p-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none text-xs"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCommentId(null);
                                    setEditCommentText("");
                                  }}
                                  className="px-3 py-1 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white cursor-pointer"
                                >
                                  გაუქმება
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingCommentEdit || !editCommentText.trim()}
                                  onClick={() => handleEditComment(c.id)}
                                  className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {isSavingCommentEdit ? "ინახება..." : "შენახვა"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-stone-800 leading-relaxed font-medium pl-8">
                              {renderCommentContent(c.content)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200/70 space-y-1">
                    <MessageSquare size={24} className="mx-auto text-stone-300" />
                    <div className="text-stone-500 font-bold">კომენტარები ჯერჯერობით არ არის</div>
                    <div className="text-[11px] text-stone-400">
                      დაიწყეთ დისკუსია ამ ტასკზე გუნდის წევრებთან ერთად.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "attachments" ? (
            /* TAB: ფაილები & ბმულები (Attachments & External Links) */
            <div className="space-y-6 text-xs">
              {/* Section 1: ფაილები და სქრინშოტები */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip size={13} className="text-orange-600" />
                    <span>
                      მიმაგრებული ფაილები (
                      {task?.attachments?.filter((a) => !a.isExternal).length || 0})
                    </span>
                  </h4>
                </div>

                {/* Upload Drag & Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleFileUpload(files[0]);
                    }
                  }}
                  className={`p-5 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer ${
                    isDragging
                      ? "border-orange-500 bg-orange-50/80"
                      : "border-stone-200 hover:border-orange-400 bg-stone-50/60"
                  }`}
                  onClick={() => {
                    const el = document.getElementById("task-file-input");
                    if (el) el.click();
                  }}
                >
                  <input
                    id="task-file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                    {isUploadingFile ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <UploadCloud size={18} />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-stone-800">
                      {isUploadingFile ? "იტვირთება..." : "დააჭირეთ ფაილის ასარჩევად ან ჩააგდეთ აქ"}
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      PNG, JPG, WebP, PDF, TXT, DOCX • Ctrl+V სქრინშოტის ჩასასმელად (მაქს. 25MB)
                    </div>
                  </div>
                </div>

                {/* Uploaded Files List */}
                {task?.attachments &&
                task.attachments.filter((a) => !a.isExternal).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {task.attachments
                      .filter((a) => !a.isExternal)
                      .map((att) => {
                        const isImage = att.mimeType.startsWith("image/");
                        const canManage = att.userId === currentUser.id || isAdmin;

                        return (
                          <div
                            key={att.id}
                            className="p-3 bg-white border border-stone-200/90 rounded-2xl flex items-center gap-3 relative group hover:border-stone-300 hover:shadow-xs transition-all"
                          >
                            {/* Thumbnail or Document Icon */}
                            {isImage ? (
                              <div
                                onClick={() => {
                                  setPreviewImageUrl(`/api/attachments/${att.id}`);
                                  setPreviewImageTitle(att.originalName);
                                }}
                                className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 shrink-0 overflow-hidden relative cursor-pointer group/thumb"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/attachments/${att.id}`}
                                  alt={att.originalName}
                                  className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                                />
                                <div className="absolute inset-0 bg-stone-900/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                                  <Eye size={14} />
                                </div>
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0 flex items-center justify-center font-extrabold uppercase text-[10px]">
                                {att.originalName.split(".").pop() || "FILE"}
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div
                                className="font-bold text-stone-900 truncate"
                                title={att.originalName}
                              >
                                {att.originalName}
                              </div>
                              <div className="text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                <span>{formatFileSize(att.sizeBytes)}</span>
                                <span>•</span>
                                <span>{att.user.name}</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`/api/attachments/${att.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={att.originalName}
                                className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg cursor-pointer transition-colors"
                                title="გადმოწერა"
                              >
                                <Download size={14} />
                              </a>
                              {canManage && (
                                <button
                                  onClick={() => handleDeleteAttachment(att.id, false)}
                                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                  title="წაშლა"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-stone-50 rounded-xl text-stone-400 text-[11px] italic">
                    მიმაგრებული ფაილები არ არის.
                  </div>
                )}
              </div>

              {/* Section 2: გარე ბმულები */}
              <div className="space-y-3 pt-3 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Globe size={13} className="text-orange-600" />
                    <span>
                      გარე ბმულები (Figma, GitHub, Docs) (
                      {task?.attachments?.filter((a) => a.isExternal).length || 0})
                    </span>
                  </h4>
                  {!showAddLink && (
                    <button
                      onClick={() => setShowAddLink(true)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 text-white rounded-lg font-bold text-[11px] hover:bg-orange-700 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Plus size={12} />
                      <span>ბმულის დამატება</span>
                    </button>
                  )}
                </div>

                {/* Add Link Form */}
                {showAddLink && (
                  <form
                    onSubmit={handleCreateLink}
                    className="p-3.5 bg-orange-50/60 border border-orange-200 rounded-2xl space-y-3 animate-in slide-in-from-top-1"
                  >
                    <div className="font-bold text-stone-800">ახალი გარე ბმულის დამატება</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          სახელი / ლეიბლი
                        </label>
                        <input
                          type="text"
                          value={linkName}
                          onChange={(e) => setLinkName(e.target.value)}
                          placeholder="მაგ. Figma დიზაინი, PR #42"
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-stone-500 block mb-1">
                          URL მისამართი (https://...)
                        </label>
                        <input
                          type="url"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddLink(false);
                          setLinkName("");
                          setLinkUrl("");
                        }}
                        className="px-3 py-1 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white cursor-pointer"
                      >
                        გაუქმება
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingLink || !linkName.trim() || !linkUrl.trim()}
                        className="px-4 py-1 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingLink ? "ემატება..." : "დამატება"}
                      </button>
                    </div>
                  </form>
                )}

                {/* External Links List */}
                {task?.attachments &&
                task.attachments.filter((a) => a.isExternal).length > 0 ? (
                  <div className="space-y-2">
                    {task.attachments
                      .filter((a) => a.isExternal)
                      .map((att) => {
                        const canManage = att.userId === currentUser.id || isAdmin;
                        const isEditingThis = editingLinkId === att.id;

                        return (
                          <div
                            key={att.id}
                            className="p-3 bg-white border border-stone-200/90 rounded-2xl flex items-center justify-between gap-3 group hover:border-stone-300 transition-all"
                          >
                            {isEditingThis ? (
                              <div className="flex-1 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={editLinkName}
                                    onChange={(e) => setEditLinkName(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                                  />
                                  <input
                                    type="url"
                                    value={editLinkUrl}
                                    onChange={(e) => setEditLinkUrl(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs font-medium"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingLinkId(null)}
                                    className="px-2.5 py-0.5 border border-stone-200 text-stone-600 rounded-md font-semibold text-[11px]"
                                  >
                                    გაუქმება
                                  </button>
                                  <button
                                    disabled={isSavingLinkEdit}
                                    onClick={() => handleEditLink(att.id)}
                                    className="px-3 py-0.5 bg-orange-600 text-white rounded-md font-semibold text-[11px]"
                                  >
                                    შენახვა
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                    <ExternalLink size={15} />
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-stone-900 truncate">
                                        {att.originalName}
                                      </span>
                                      {att.url && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                                          {getDomainFromUrl(att.url)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-stone-400 flex items-center gap-1.5">
                                      <span>{att.user.name}</span>
                                      <span>•</span>
                                      <span>{formatGeorgianDate(att.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {att.url && (
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-orange-50 hover:text-orange-600 text-stone-700 font-bold text-[11px] transition-colors"
                                    >
                                      <span>გახსნა</span>
                                      <ExternalLink size={11} />
                                    </a>
                                  )}
                                  {canManage && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingLinkId(att.id);
                                          setEditLinkName(att.originalName);
                                          setEditLinkUrl(att.url || "");
                                        }}
                                        className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                                        title="რედაქტირება"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAttachment(att.id, true)}
                                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                        title="წაშლა"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-4 text-center bg-stone-50 rounded-xl text-stone-400 text-[11px] italic">
                    გარე ბმულები არ არის დამატებული.
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "daily_updates" ? (
            /* TAB: დღიური ჩანაწერები (Daily Updates) */
            <div className="space-y-4 text-xs">
              {/* Informational Callout */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-amber-900">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-extrabold text-amber-900 text-xs">
                    დღეს რა გაკეთდა? (არასავალდებულო სამუშაო ჩანაწერი)
                  </div>
                  <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    ეს ველი სრულიად არასავალდებულოა. იგი არ ახდენს გავლენას ტასკის პროგრესზე ან
                    დედლაინზე და ემსახურება გუნდის წევრებს შორის დღის სამუშაო სტატუსის გაზიარებას.
                  </div>
                </div>
              </div>

              {/* Add Daily Update Input */}
              <form
                onSubmit={handleCreateDailyUpdate}
                className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5"
              >
                <label className="font-bold text-stone-800 block">
                  ჩაწერეთ დღის სამუშაო სტატუსი:
                </label>
                <textarea
                  rows={3}
                  value={dailyUpdateText}
                  onChange={(e) => setDailyUpdateText(e.target.value)}
                  placeholder="მაგ. დღეს დავასრულე Header-ის Desktop ვერსია. ხვალ გავაგრძელებ მობილურზე მუშაობას."
                  className="w-full p-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none text-xs"
                />
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingDailyUpdate || !dailyUpdateText.trim()}
                    className="px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    {isSubmittingDailyUpdate ? "ინახება..." : "ჩანაწერის შენახვა"}
                  </button>
                </div>
              </form>

              {/* List of Previous Daily Updates */}
              <div className="space-y-3 pt-2">
                <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider">
                  წინა ჩანაწერები ({task?.dailyUpdates?.length || 0})
                </h4>

                {task?.dailyUpdates && task.dailyUpdates.length > 0 ? (
                  <div className="space-y-3">
                    {task.dailyUpdates.map((du) => {
                      const canManage = du.userId === currentUser.id || isAdmin;
                      const isEditingThis = editingDailyUpdateId === du.id;

                      return (
                        <div
                          key={du.id}
                          className="p-3.5 bg-stone-50/80 border border-stone-200/80 rounded-2xl space-y-2 group hover:border-stone-300 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 border border-white shadow-2xs">
                                {du.user.name.charAt(0)}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-stone-900">{du.user.name}</span>
                                <span className="text-[10px] text-stone-400">
                                  {formatGeorgianDateTime(du.createdAt)}
                                </span>
                              </div>
                            </div>

                            {canManage && !isEditingThis && (
                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setEditingDailyUpdateId(du.id);
                                    setEditDailyUpdateText(du.content);
                                  }}
                                  className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded cursor-pointer"
                                  title="რედაქტირება"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteDailyUpdate(du.id)}
                                  className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="წაშლა"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditingThis ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={3}
                                value={editDailyUpdateText}
                                onChange={(e) => setEditDailyUpdateText(e.target.value)}
                                className="w-full p-2.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-stone-900 font-medium resize-none text-xs"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingDailyUpdateId(null)}
                                  className="px-3 py-1 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white cursor-pointer"
                                >
                                  გაუქმება
                                </button>
                                <button
                                  disabled={isSavingDailyUpdateEdit || !editDailyUpdateText.trim()}
                                  onClick={() => handleEditDailyUpdate(du.id)}
                                  className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {isSavingDailyUpdateEdit ? "ინახება..." : "შენახვა"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-stone-800 leading-relaxed font-medium pl-8 whitespace-pre-wrap">
                              {du.content}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200/70 space-y-1">
                    <FileText size={24} className="mx-auto text-stone-300" />
                    <div className="text-stone-500 font-bold">დღიური ჩანაწერები ჯერ არ არის</div>
                    <div className="text-[11px] text-stone-400">
                      სურვილისამებრ ჩაწერეთ დღეს შესრულებული სამუშაოს მოკლე აღწერა.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TAB: აქტივობა (Real Audit Trail) */
            <div className="space-y-4">
              <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider">
                ისტორია & აუდიტის ლოგი
              </h3>

              {task?.auditEvents && task.auditEvents.length > 0 ? (
                <div className="relative border-l-2 border-stone-200 ml-3 pl-4 space-y-4 text-xs">
                  {task.auditEvents.map((event) => (
                    <div key={event.id} className="relative">
                      {/* Node Circle */}
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-orange-600 border-2 border-white shadow-2xs" />

                      <div className="bg-stone-50/80 border border-stone-200/80 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-stone-900">
                            {event.actor.name}
                          </span>
                          <span className="text-stone-400">
                            {formatGeorgianDate(event.createdAt)}
                          </span>
                        </div>

                        <div className="font-semibold text-stone-800">
                          {formatAuditAction(event.action, event.entityType, event.reason)}
                        </div>

                        {event.reason && (
                          <div className="text-[11px] text-stone-600 bg-white/80 p-1.5 rounded-lg border border-stone-100 italic">
                            მიზეზი: {event.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-stone-400 italic">
                  ისტორია ჯერჯერობით ცარიელია.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image Preview Lightbox Modal */}
        {previewImageUrl && (
          <div
            className="fixed inset-0 z-50 bg-stone-900/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-stone-200 flex items-center justify-between gap-4 bg-stone-50">
                <span className="font-bold text-stone-900 text-xs truncate max-w-md">
                  {previewImageTitle || "სურათის გადახედვა"}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={previewImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={previewImageTitle || "image"}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-colors"
                  >
                    <Download size={13} />
                    <span>გადმოწერა</span>
                  </a>
                  <button
                    onClick={() => setPreviewImageUrl(null)}
                    className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-lg cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-2 bg-stone-950/5 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImageUrl}
                  alt={previewImageTitle || "Preview"}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
