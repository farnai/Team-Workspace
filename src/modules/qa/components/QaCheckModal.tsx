"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  ListChecks,
} from "lucide-react";
import { Department, Priority, TaskStatus, TaskType } from "@prisma/client";
import type { BacklogTask } from "@/components/SharedBacklog";

interface ProjectOption {
  id: string;
  name: string;
  color?: string | null;
}

interface QaBlockDraft {
  id?: string;
  title: string;
}

interface QaLinkDraft {
  id?: string;
  url: string;
}

interface QaCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  projects: ProjectOption[];
  editingTask?: BacklogTask | null;
}

export function QaCheckModal({
  isOpen,
  onClose,
  onSuccess,
  projects,
  editingTask = null,
}: QaCheckModalProps) {
  const isEdit = Boolean(editingTask);

  const [title, setTitle] = useState(editingTask?.title || "");
  const [projectId, setProjectId] = useState(
    editingTask?.projectId || projects[0]?.id || ""
  );
  const [description, setDescription] = useState(editingTask?.description || "");
  const [blocks, setBlocks] = useState<QaBlockDraft[]>(() =>
    (editingTask?.subtasks || []).map((s) => ({
      id: s.id,
      title: s.title || "",
    }))
  );
  const [removedBlockIds, setRemovedBlockIds] = useState<string[]>([]);
  const [newBlockTitle, setNewBlockTitle] = useState("");
  const [links, setLinks] = useState<QaLinkDraft[]>([]);
  const [removedLinkIds, setRemovedLinkIds] = useState<string[]>([]);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blockInputRef = useRef<HTMLInputElement>(null);

  // Load existing attachments (links) when editing
  useEffect(() => {
    if (!isOpen || !editingTask) return;
    let active = true;
    fetch(`/api/tasks/${editingTask.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.task) return;
        const extLinks = (data.task.attachments || [])
          .filter((a: { isExternal?: boolean; url?: string | null }) => a.isExternal && a.url)
          .map((a: { id: string; url: string }) => ({ id: a.id, url: a.url }));
        setLinks(extLinks);
        if (Array.isArray(data.task.subtasks)) {
          setBlocks(
            data.task.subtasks.map((s: { id: string; title: string }) => ({
              id: s.id,
              title: s.title,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, editingTask]);

  if (!isOpen) return null;

  const handleAddBlock = () => {
    const trimmed = newBlockTitle.trim();
    if (!trimmed) return;
    setBlocks((prev) => [...prev, { title: trimmed }]);
    setNewBlockTitle("");
    blockInputRef.current?.focus();
  };

  const handleRemoveBlock = (idx: number) => {
    const target = blocks[idx];
    if (target?.id) {
      setRemovedBlockIds((prev) => [...prev, target.id!]);
    }
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddLink = () => {
    const trimmed = newLinkUrl.trim();
    if (!trimmed) return;
    const normalized =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    setLinks((prev) => [...prev, { url: normalized }]);
    setNewLinkUrl("");
  };

  const handleRemoveLink = (idx: number) => {
    const target = links[idx];
    if (target?.id) {
      setRemovedLinkIds((prev) => [...prev, target.id!]);
    }
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("გვერდის ან მოდულის სათაური სავალდებულოა");
      return;
    }

    const finalBlocks = [...blocks];
    if (newBlockTitle.trim()) {
      finalBlocks.push({ title: newBlockTitle.trim() });
    }

    const finalLinks = [...links];
    if (newLinkUrl.trim()) {
      const trimmed = newLinkUrl.trim();
      finalLinks.push({
        url:
          trimmed.startsWith("http://") || trimmed.startsWith("https://")
            ? trimmed
            : `https://${trimmed}`,
      });
    }

    try {
      setIsSubmitting(true);

      if (isEdit && editingTask) {
        const newLinksOnly = finalLinks
          .filter((l) => !l.id)
          .map((l) => ({ name: "", url: l.url }));

        const patchRes = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            projectId: projectId || undefined,
            description: description.trim() || null,
            links: newLinksOnly,
          }),
        });
        const patchData = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          throw new Error(patchData.error || "QA ტესტის განახლება ვერ მოხერხდა");
        }

        // Delete removed links
        for (const attId of removedLinkIds) {
          await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
        }

        // Delete removed blocks
        for (const subId of removedBlockIds) {
          await fetch(`/api/subtasks/${subId}`, { method: "DELETE" });
        }

        // Create newly added blocks
        for (const blk of finalBlocks) {
          if (!blk.id && blk.title.trim()) {
            await fetch(`/api/tasks/${editingTask.id}/subtasks`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: blk.title.trim() }),
            });
          }
        }
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            projectId: projectId || undefined,
            priority: Priority.MEDIUM,
            department: Department.QA,
            type: TaskType.QA,
            status: TaskStatus.BACKLOG,
            description: description.trim() || null,
            startDate: null,
            deadline: null,
            assigneeIds: [],
            blocks: finalBlocks.map((b) => b.title),
            links: finalLinks.map((l) => ({ name: "", url: l.url })),
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "QA ტესტის დამატება ვერ მოხერხდა");
        }
      }

      await onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "შეცდომა შენახვისას");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/45 backdrop-blur-xs flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-emerald-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckSquare size={18} strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900">
                {isEdit
                  ? "QA ტესტის რედაქტირება"
                  : "ახალი QA ტესტი (გვერდი / მოდული)"}
              </h2>
              <p className="text-[11px] text-stone-500">
                {isEdit
                  ? "შეცვალეთ გვერდის დასახელება, ბმულები ან შესამოწმებელი ბლოკები"
                  : "დაამატეთ გვერდი და მისი შესამოწმებელი ბლოკები რეგულარული ტესტირებისთვის"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-stone-700 mb-1">
                გვერდი / მოდული *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="მაგ: მთავარი გვერდი"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">პროექტი</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Page URL / Links */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-bold text-stone-700">
              <LinkIcon size={13} className="text-stone-500" />
              <span>გვერდის ბმული (URL)</span>
            </label>
            {links.length > 0 && (
              <div className="space-y-1">
                {links.map((l, idx) => (
                  <div
                    key={l.id || idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl"
                  >
                    <span className="text-stone-700 truncate">{l.url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLink();
                  }
                }}
                placeholder="https://www.gtu.edu.ge/"
                className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!newLinkUrl.trim()}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl font-bold disabled:opacity-40 cursor-pointer shrink-0"
              >
                + ბმული
              </button>
            </div>
          </div>

          {/* Test Blocks */}
          <div className="p-3.5 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-2.5">
            <label className="flex items-center gap-1.5 font-extrabold text-stone-800">
              <ListChecks size={14} className="text-emerald-600" />
              <span>გვერდის შესამოწმებელი ბლოკები ({blocks.length})</span>
            </label>

            {blocks.length > 0 && (
              <div className="space-y-1.5">
                {blocks.map((block, idx) => (
                  <div
                    key={block.id || idx}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-stone-800 truncate">{block.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBlock(idx)}
                      className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer shrink-0"
                      title="წაშლა"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={blockInputRef}
                type="text"
                value={newBlockTitle}
                onChange={(e) => setNewBlockTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddBlock();
                  }
                }}
                placeholder="მაგ: Hero, მნიშვნელოვანი სასწავლო აქტივობები, ღონისძიებები..."
                className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={handleAddBlock}
                disabled={!newBlockTitle.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer shrink-0"
              >
                <Plus size={13} />
                <span>დამატება</span>
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">
              შენიშვნა (არასავალდებულო)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="დამატებითი ინფორმაცია გვერდის შემოწმების შესახებ..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl font-semibold cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              <span>{isEdit ? "ცვლილებების შენახვა" : "გვერდის დამატება"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
