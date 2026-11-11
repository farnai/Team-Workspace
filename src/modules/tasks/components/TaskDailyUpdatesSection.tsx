"use client";

import React, { useState } from "react";
import { Info, FileText, Edit3, Trash2 } from "lucide-react";
import { formatGeorgianDateTime } from "@/lib/dateUtils";
import { DailyUpdateItem } from "@/components/TaskDetailsDrawer";

interface TaskDailyUpdatesSectionProps {
  taskId: string;
  dailyUpdates: DailyUpdateItem[];
  currentUser: { id: string; role: "ADMIN" | "USER" };
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function TaskDailyUpdatesSection({
  taskId,
  dailyUpdates,
  currentUser,
  onRefresh,
  onError,
}: TaskDailyUpdatesSectionProps) {
  const [dailyUpdateText, setDailyUpdateText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDailyUpdateText, setEditDailyUpdateText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isAdmin = currentUser.role === "ADMIN";

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dailyUpdateText.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/tasks/${taskId}/daily-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: dailyUpdateText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ჩანაწერის დამატება ვერ მოხერხდა");

      setDailyUpdateText("");
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (updateId: string) => {
    if (!editDailyUpdateText.trim()) return;

    try {
      setIsSavingEdit(true);
      const res = await fetch(`/api/daily-updates/${updateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editDailyUpdateText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ჩანაწერის განახლება ვერ მოხერხდა");

      setEditingId(null);
      setEditDailyUpdateText("");
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (updateId: string) => {
    if (!confirm("დარწმუნებული ხართ, რომ გსურთ ამ ჩანაწერის წაშლა?")) return;

    try {
      const res = await fetch(`/api/daily-updates/${updateId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ჩანაწერის წაშლა ვერ მოხერხდა");

      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    }
  };

  return (
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
        onSubmit={handleCreate}
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
            disabled={isSubmitting || !dailyUpdateText.trim()}
            className="px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
          >
            {isSubmitting ? "ინახება..." : "ჩანაწერის შენახვა"}
          </button>
        </div>
      </form>

      {/* List of Previous Daily Updates */}
      <div className="space-y-3 pt-2">
        <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider">
          წინა ჩანაწერები ({dailyUpdates.length})
        </h4>

        {dailyUpdates.length > 0 ? (
          <div className="space-y-3">
            {dailyUpdates.map((du) => {
              const canManage = du.userId === currentUser.id || isAdmin;
              const isEditingThis = editingId === du.id;

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
                            setEditingId(du.id);
                            setEditDailyUpdateText(du.content);
                          }}
                          className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded cursor-pointer"
                          title="რედაქტირება"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(du.id)}
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
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 border border-stone-200 text-stone-600 rounded-lg font-semibold hover:bg-white cursor-pointer"
                        >
                          გაუქმება
                        </button>
                        <button
                          disabled={isSavingEdit || !editDailyUpdateText.trim()}
                          onClick={() => handleEdit(du.id)}
                          className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingEdit ? "ინახება..." : "შენახვა"}
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
  );
}
