"use client";

import React, { useState } from "react";
import { MessageSquare, AtSign, Loader2, Send, Edit3, Trash2 } from "lucide-react";
import { formatGeorgianDateTime } from "@/lib/dateUtils";
import { CommentItem, UserOption } from "@/components/TaskDetailsDrawer";

interface TaskCommentsSectionProps {
  taskId: string;
  comments: CommentItem[];
  currentUser: { id: string; role: "ADMIN" | "USER" };
  users: UserOption[];
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function TaskCommentsSection({
  taskId,
  comments,
  currentUser,
  users,
  onRefresh,
  onError,
}: TaskCommentsSectionProps) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);

  const isAdmin = currentUser.role === "ADMIN";

  const handleCreateComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "კომენტარის დამატება ვერ მოხერხდა");

      setCommentText("");
      setShowMentionMenu(false);
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentText.trim()) return;

    try {
      setIsSavingEdit(true);
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "კომენტარის განახლება ვერ მოხერხდა");

      setEditingCommentId(null);
      setEditCommentText("");
      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("დარწმუნებული ხართ, რომ გსურთ ამ კომენტარის წაშლა?")) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "კომენტარის წაშლა ვერ მოხერხდა");

      await onRefresh();
    } catch (err: unknown) {
      onError((err as Error).message);
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

  return (
    <div className="space-y-4 text-xs">
      {/* New Comment Input Box */}
      <form
        onSubmit={handleCreateComment}
        className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2"
      >
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
                <div className="text-[10px] font-bold text-stone-400 px-2 py-1">
                  გუნდის წევრები:
                </div>
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setCommentText((prev) => `${prev}@${u.name} `);
                      setShowMentionMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-orange-50 hover:text-orange-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
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
            disabled={isSubmitting || !commentText.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            <span>გაგზავნა</span>
          </button>
        </div>
      </form>

      {/* Comments Thread */}
      <div className="space-y-3 pt-2">
        <h4 className="font-extrabold text-stone-800 text-xs uppercase tracking-wider flex items-center justify-between">
          <span>დისკუსია ({comments.length})</span>
        </h4>

        {comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((c) => {
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
                          disabled={isSavingEdit || !editCommentText.trim()}
                          onClick={() => handleEditComment(c.id)}
                          className="px-3 py-1 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingEdit ? "ინახება..." : "შენახვა"}
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
  );
}
