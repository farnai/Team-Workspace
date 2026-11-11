"use client";

import React, { useState } from "react";
import { AlertCircle, Ban, X, Loader2, Info } from "lucide-react";

interface BlockTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onBlockConfirmed: (reason: string) => Promise<void>;
}

export function BlockTaskModal({
  isOpen,
  onClose,
  taskTitle,
  onBlockConfirmed,
}: BlockTaskModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("დაბლოკვის მიზეზის მითითება სავალდებულოა");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onBlockConfirmed(reason.trim());
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
              <Ban size={16} />
            </div>
            <div>
              <div className="font-extrabold text-stone-900 text-sm">
                დავალების დაბლოკვა (დაბრკოლება)
              </div>
              <div className="text-[11px] text-stone-500 font-medium truncate max-w-sm">
                {taskTitle}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Informational Callout */}
        <div className="p-3 bg-rose-50/80 border border-rose-200/70 rounded-xl flex items-start gap-2 text-rose-900">
          <Info size={16} className="text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">გარე დამოკიდებულება / დაბრკოლება:</div>
            <div className="text-[11px] text-rose-800 leading-relaxed font-medium">
              დაბლოკილი სტატუსი მიუთითებს, რომ მუშაობის გაგრძელება შეუძლებელია
              გარე მიზეზის გამო (მაგ. ველოდებით დამკვეთისგან API მონაცემებს).
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-1.5 font-medium">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="font-bold text-stone-800 block mb-1">
              დაბრკოლების აღწერა <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="მაგ. ველოდებით დამკვეთის ტექნიკური გუნდისგან API გასაღებებსა და დოკუმენტაციას..."
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 border border-stone-200 text-stone-600 rounded-xl font-semibold hover:bg-stone-50 cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Ban size={13} />
              )}
              <span>დავალების დაბლოკვა</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

