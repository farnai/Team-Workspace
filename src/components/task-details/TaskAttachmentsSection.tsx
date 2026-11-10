"use client";

import React, { useState } from "react";
import {
  Paperclip,
  UploadCloud,
  Loader2,
  Eye,
  Download,
  Trash2,
  Globe,
  Plus,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { formatGeorgianDate } from "@/lib/dateUtils";
import { AttachmentItem } from "@/components/TaskDetailsDrawer";

interface TaskAttachmentsSectionProps {
  taskId: string;
  attachments: AttachmentItem[];
  currentUser: { id: string; role: "ADMIN" | "USER" };
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onPreviewImage: (url: string, title: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  isUploadingFile: boolean;
}

export function TaskAttachmentsSection({
  taskId,
  attachments,
  currentUser,
  onRefresh,
  onError,
  onPreviewImage,
  onUploadFile,
  isUploadingFile,
}: TaskAttachmentsSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkName, setEditLinkName] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [isSavingLinkEdit, setIsSavingLinkEdit] = useState(false);

  const isAdmin = currentUser.role === "ADMIN";

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

  const handleCreateLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!linkUrl.trim()) return;

    let urlToSubmit = linkUrl.trim();
    if (!urlToSubmit.startsWith("http://") && !urlToSubmit.startsWith("https://")) {
      urlToSubmit = "https://" + urlToSubmit;
    }

    try {
      setIsSubmittingLink(true);
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: linkName.trim(), url: urlToSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ბმულის დამატება ვერ მოხერხდა");

      setLinkName("");
      setLinkUrl("");
      setShowAddLink(false);
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const handleEditLink = async (linkId: string) => {
    if (!editLinkUrl.trim()) return;
    let urlToSubmit = editLinkUrl.trim();
    if (!urlToSubmit.startsWith("http://") && !urlToSubmit.startsWith("https://")) {
      urlToSubmit = "https://" + urlToSubmit;
    }

    try {
      setIsSavingLinkEdit(true);
      const res = await fetch(`/api/attachments/${linkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editLinkName.trim(), url: urlToSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ბმულის განახლება ვერ მოხერხდა");

      setEditingLinkId(null);
      setEditLinkName("");
      setEditLinkUrl("");
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
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
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "წაშლა ვერ მოხერხდა");

      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    }
  };

  const files = attachments.filter((a) => !a.isExternal);
  const links = attachments.filter((a) => a.isExternal);

  return (
    <div className="space-y-6 text-xs">
      {/* Section 1: ფაილები და სქრინშოტები */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip size={13} className="text-orange-600" />
            <span>მიმაგრებული ფაილები ({files.length})</span>
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
            const droppedFiles = e.dataTransfer.files;
            if (droppedFiles && droppedFiles.length > 0) {
              onUploadFile(droppedFiles[0]);
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
              if (file) onUploadFile(file);
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
        {files.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {files.map((att) => {
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
                      onClick={() => onPreviewImage(`/api/attachments/${att.id}`, att.originalName)}
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
            <span>გარე ბმულები (Figma, GitHub, Docs) ({links.length})</span>
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
                  სახელი / ლეიბლი (არასავალდებულო)
                </label>
                <input
                  type="text"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="მაგ. Figma დიზაინი, PR #42 (არასავალდებულო)"
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
                disabled={isSubmittingLink || !linkUrl.trim()}
                className="px-4 py-1 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingLink ? "ემატება..." : "დამატება"}
              </button>
            </div>
          </form>
        )}

        {/* External Links List */}
        {links.length > 0 ? (
          <div className="space-y-2">
            {links.map((att) => {
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
                          disabled={isSavingLinkEdit || !editLinkUrl.trim()}
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
  );
}
