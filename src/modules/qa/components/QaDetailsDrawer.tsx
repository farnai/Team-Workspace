"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  Edit3,
  History,
  MessageSquare,
  ListChecks,
  CheckSquare,
  AlertCircle,
} from "lucide-react";
import { SubtaskStatus, TaskStatus } from "@prisma/client";
import { formatTbilisiDateTime } from "@/lib/date";
import { TaskAttachmentsSection } from "@/modules/tasks/components/TaskAttachmentsSection";
import { TaskCommentsSection } from "@/modules/tasks/components/TaskCommentsSection";
import { ImagePreviewModal } from "@/modules/tasks/components/ImagePreviewModal";
import type { AttachmentItem, CommentItem, AuditEventItem } from "@/components/TaskDetailsDrawer";

interface QaSubtask {
  id: string;
  title: string;
  description?: string | null;
  status: SubtaskStatus;
  position: number;
}

interface QaPageDetails {
  id: string;
  taskNumber: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  projectId: string;
  project?: { id: string; name: string; color?: string | null } | null;
  subtasks: QaSubtask[];
  attachments: AttachmentItem[];
  comments: CommentItem[];
  auditEvents: AuditEventItem[];
}

interface UserOption {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: "ADMIN" | "USER";
}

interface QaDetailsDrawerProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
  currentUser: { id: string; name: string; role: "ADMIN" | "USER" };
  users: UserOption[];
}

export function QaDetailsDrawer({
  taskId,
  isOpen,
  onClose,
  onUpdated,
  currentUser,
  users,
}: QaDetailsDrawerProps) {
  const [page, setPage] = useState<QaPageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"blocks" | "history" | "comments">("blocks");

  // Title & description editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // Add block
  const [newBlockTitle, setNewBlockTitle] = useState("");
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});

  // File upload & preview
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string | null>(null);

  const isAdmin = currentUser.role === "ADMIN";

  const fetchDetails = useCallback(async () => {
    if (!taskId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "QA გვერდის ჩატვირთვა ვერ მოხერხდა");
      setPage(data.task);
      setTitleValue(data.task.title || "");
      setDescValue(data.task.description || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (!isOpen || !taskId) return;
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "QA გვერდის ჩატვირთვა ვერ მოხერხდა");
        if (active) {
          setPage(data.task);
          setTitleValue(data.task.title || "");
          setDescValue(data.task.description || "");
          setError(null);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "შეცდომა");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const handleSaveTitle = async () => {
    if (!page || !titleValue.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      if (!res.ok) throw new Error("სათაურის განახლება ვერ მოხერხდა");
      setIsEditingTitle(false);
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  };

  const handleSaveDescription = async () => {
    if (!page) return;
    try {
      const res = await fetch(`/api/tasks/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descValue.trim() || null }),
      });
      if (!res.ok) throw new Error("აღწერის განახლება ვერ მოხერხდა");
      setIsEditingDesc(false);
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page || !newBlockTitle.trim()) return;
    setIsAddingBlock(true);
    try {
      const res = await fetch(`/api/tasks/${page.id}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newBlockTitle.trim() }),
      });
      if (!res.ok) throw new Error("ბლოკის დამატება ვერ მოხერხდა");
      setNewBlockTitle("");
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    } finally {
      setIsAddingBlock(false);
    }
  };

  const handleDeleteBlock = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("ბლოკის წაშლა ვერ მოხერხდა");
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  };

  const handleSetBlockStatus = async (
    subtaskId: string,
    targetStatus: SubtaskStatus,
    currentStatus: SubtaskStatus
  ) => {
    if (togglingId) return;
    setTogglingId(subtaskId);
    const nextStatus = currentStatus === targetStatus ? SubtaskStatus.TODO : targetStatus;
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveBlockNote = async (subtaskId: string, note: string) => {
    try {
      await fetch(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: note.trim() || null }),
      });
      await fetchDetails();
      await onUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!page) return;
    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tasks/${page.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ფაილის ატვირთვა ვერ მოხერხდა");
      await fetchDetails();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDeleteQaPage = async () => {
    if (!page) return;
    if (!confirm(`ნამდვილად გსურთ QA გვერდის წაშლა („${page.title}“)?`)) return;
    try {
      const res = await fetch(`/api/tasks/${page.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("წაშლა ვერ მოხერხდა");
      await onUpdated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა");
    }
  };

  const testRuns = (page?.auditEvents || []).filter(
    (ev) => ev.action === "TEST_RUN_RECORDED"
  );

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-stone-900/35 backdrop-blur-2xs animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-emerald-50/30 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black font-mono">
                <CheckSquare size={11} />
                <span>QA-{page?.taskNumber ?? "..."}</span>
              </span>
              {page?.project && (
                <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 text-[11px] font-bold">
                  {page.project.name}
                </span>
              )}
              {page?.status === TaskStatus.IN_PROGRESS && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-extrabold">
                  🔵 ტესტირება მიმდინარეობს
                </span>
              )}
            </div>

            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="flex-1 px-2.5 py-1 bg-white border border-emerald-400 rounded-lg text-sm font-bold text-stone-900 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  შენახვა
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h2 className="text-base font-black text-stone-900 truncate">
                  {page?.title || "იტვირთება..."}
                </h2>
                {page && (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="სათაურის შეცვლა"
                  >
                    <Edit3 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && page && (
              <button
                type="button"
                onClick={handleDeleteQaPage}
                className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="QA გვერდის წაშლა"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-stone-200 flex items-center gap-5 bg-white shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("blocks")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "blocks"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <ListChecks size={14} />
            <span>ბლოკები და ფაილები ({page?.subtasks.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "history"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <History size={14} />
            <span>ტესტირების ისტორია ({testRuns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("comments")}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "comments"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <MessageSquare size={14} />
            <span>კომენტარები ({page?.comments.length || 0})</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-stone-400 gap-2">
              <Loader2 size={20} className="animate-spin text-emerald-600" />
              <span>იტვირთება...</span>
            </div>
          ) : !page ? null : activeTab === "blocks" ? (
            <>
              {/* Description / Scope */}
              <div className="p-3.5 bg-stone-50/70 rounded-2xl border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-stone-800 uppercase tracking-wider text-[11px]">
                    შემოწმების აღწერა / შენიშვნა
                  </span>
                  {!isEditingDesc && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(true)}
                      className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      {page.description ? "რედაქტირება" : "დამატება"}
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      className="w-full p-2.5 bg-white border border-stone-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingDesc(false)}
                        className="px-3 py-1 border border-stone-200 rounded-lg text-stone-600 cursor-pointer"
                      >
                        გაუქმება
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDescription}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold cursor-pointer"
                      >
                        შენახვა
                      </button>
                    </div>
                  </div>
                ) : page.description ? (
                  <div className="text-stone-700 whitespace-pre-wrap leading-relaxed">
                    {page.description}
                  </div>
                ) : (
                  <div className="text-stone-400 italic text-[11px]">აღწერა მითითებული არ არის</div>
                )}
              </div>

              {/* Links & Screenshots */}
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/40 p-3.5">
                <TaskAttachmentsSection
                  taskId={page.id}
                  attachments={page.attachments || []}
                  currentUser={currentUser}
                  onRefresh={fetchDetails}
                  onError={setError}
                  isUploadingFile={isUploadingFile}
                  onUploadFile={handleFileUpload}
                  onPreviewImage={(url: string, title?: string) => {
                    setPreviewImageUrl(url);
                    setPreviewImageTitle(title || null);
                  }}
                />
              </div>

              {/* QA Blocks */}
              <div className="space-y-3">
                <h3 className="font-black text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ListChecks size={14} className="text-emerald-600" />
                  <span>გვერდის შესამოწმებელი ბლოკები ({page.subtasks.length})</span>
                </h3>

                <div className="space-y-2">
                  {page.subtasks.map((st, idx) => {
                    const isPassed = st.status === SubtaskStatus.DONE;
                    const isFailed = st.status === SubtaskStatus.CANCELLED;
                    const noteValue =
                      blockNotes[st.id] !== undefined
                        ? blockNotes[st.id]
                        : st.description || "";
                    return (
                      <div
                        key={st.id}
                        className={`p-3 rounded-xl border space-y-2 ${
                          isFailed
                            ? "bg-rose-50/70 border-rose-300"
                            : isPassed
                            ? "bg-emerald-50/60 border-emerald-200"
                            : "bg-white border-stone-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-stone-900 truncate">{st.title}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSetBlockStatus(st.id, SubtaskStatus.DONE, st.status)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                                isPassed
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              }`}
                            >
                              <CheckCircle2 size={12} />
                              <span>მზადაა</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetBlockStatus(st.id, SubtaskStatus.CANCELLED, st.status)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                                isFailed
                                  ? "bg-rose-600 text-white border-rose-600"
                                  : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                              }`}
                            >
                              <XCircle size={12} />
                              <span>დაზიანებაა</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlock(st.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                              title="ბლოკის წაშლა"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isFailed && (
                          <input
                            type="text"
                            value={noteValue}
                            onChange={(e) =>
                              setBlockNotes((prev) => ({ ...prev, [st.id]: e.target.value }))
                            }
                            onBlur={() => {
                              if (noteValue.trim() !== (st.description || "").trim()) {
                                handleSaveBlockNote(st.id, noteValue);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveBlockNote(st.id, noteValue);
                              }
                            }}
                            placeholder="რა ხარვეზია? (არასავალდებულო)..."
                            className="w-full px-2.5 py-1 bg-white border border-rose-200 rounded-lg text-[11px] text-rose-950 focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add block inline */}
                <form onSubmit={handleAddBlock} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newBlockTitle}
                    onChange={(e) => setNewBlockTitle(e.target.value)}
                    placeholder="ახალი ბლოკის დამატება (მაგ: Footer, კონტაქტის ფორმა)..."
                    className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="submit"
                    disabled={isAddingBlock}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>დამატება</span>
                  </button>
                </form>
              </div>
            </>
          ) : activeTab === "history" ? (
            <div className="space-y-2.5">
              {testRuns.length === 0 ? (
                <div className="p-8 text-center text-stone-400 italic bg-stone-50 rounded-2xl border border-stone-200/70">
                  ტესტირების ისტორია ჯერ ცარიელია.
                </div>
              ) : (
                testRuns.map((ev) => {
                  const runVerdict = ev.newValues?.status as string | undefined;
                  const runBlocks = Array.isArray(ev.newValues?.blocks)
                    ? (ev.newValues.blocks as Array<{ title?: string; status?: string; note?: string }>)
                    : [];
                  return (
                    <div
                      key={ev.id}
                      className="p-3.5 bg-white border border-stone-200 rounded-2xl space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              runVerdict === "PASSED"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {runVerdict === "PASSED" ? "✓ გაიარა" : "✕ ჩავარდა"}
                          </span>
                          <span className="font-extrabold text-stone-900">{ev.actor.name}</span>
                          <span className="text-stone-600">{ev.reason}</span>
                        </div>
                        <span className="text-[11px] text-stone-400 font-medium">
                          {formatTbilisiDateTime(ev.createdAt)}
                        </span>
                      </div>
                      {runBlocks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {runBlocks.map((b, bIdx) => (
                            <span
                              key={bIdx}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                                b.status === "PASSED"
                                  ? "bg-emerald-50/70 text-emerald-800 border-emerald-200/80"
                                  : b.status === "FAILED"
                                  ? "bg-rose-50/70 text-rose-800 border-rose-200/80"
                                  : "bg-stone-50 text-stone-600 border-stone-200"
                              }`}
                            >
                              {b.status === "PASSED" ? "✓" : b.status === "FAILED" ? "✕" : "•"} {b.title}
                              {b.note ? ` — ${b.note}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <TaskCommentsSection
              taskId={page.id}
              comments={page.comments || []}
              currentUser={currentUser}
              users={users}
              onRefresh={fetchDetails}
              onError={setError}
            />
          )}
        </div>
      </div>

      <ImagePreviewModal
        imageUrl={previewImageUrl}
        imageTitle={previewImageTitle}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
