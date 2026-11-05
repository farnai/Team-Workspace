"use client";

import React, { useState, useMemo } from "react";
import { AlertCircle, Calendar, X, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { getGeorgianHolidaysForYear, isDateWorkingDay } from "@/lib/calendar";

interface StageInfo {
  id: string;
  title: string;
  deadline: string | null;
}

interface RescheduleTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  currentStartDate: string | null;
  currentDeadline: string | null;
  isDeadlineLocked: boolean;
  isAdmin: boolean;
  stages?: StageInfo[];
  onRescheduleConfirmed: (
    newStartDate: string | null,
    newDeadline: string | null,
    reason: string
  ) => Promise<void>;
}

export function RescheduleTaskModal({
  isOpen,
  onClose,
  taskTitle,
  currentStartDate,
  currentDeadline,
  isDeadlineLocked,
  isAdmin,
  stages = [],
  onRescheduleConfirmed,
}: RescheduleTaskModalProps) {
  const [newStartDate, setNewStartDate] = useState(
    currentStartDate ? currentStartDate.split("T")[0] : ""
  );
  const [newDeadline, setNewDeadline] = useState(
    currentDeadline ? currentDeadline.split("T")[0] : ""
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time conflict checks
  const conflicts = useMemo(() => {
    const list: string[] = [];

    const startObj = newStartDate ? new Date(newStartDate) : null;
    const deadlineObj = newDeadline ? new Date(newDeadline) : null;

    if (startObj && deadlineObj && startObj > deadlineObj) {
      list.push("დაწყების თარიღი არ შეიძლება იყოს დედლაინზე გვიან.");
    }

    if (deadlineObj) {
      const year = deadlineObj.getFullYear();
      const hList = getGeorgianHolidaysForYear(year);
      const hMap = new Map<string, string>();
      for (const h of hList) {
        hMap.set(h.dateStr, h.name);
      }
      const wMap = new Map<number, boolean>();
      const { isWorking, holidayName } = isDateWorkingDay(deadlineObj, wMap, hMap);
      if (!isWorking) {
        const text = holidayName ? `უქმე დღეს (${holidayName})` : "შაბათ-კვირას (დასვენების დღე)";
        list.push(`ყურადღება: არჩეული ახალი დედლაინი ემთხვევა ${text}.`);
      }

      // Check child stages
      for (const st of stages) {
        if (st.deadline) {
          const stDate = new Date(st.deadline);
          if (stDate > deadlineObj) {
            list.push(
              `კონფლიქტი: ეტაპის („${st.title}“) დედლაინი (${formatGeorgianDateShort(
                st.deadline
              )}) სცდება ტასკის ახალ დედლაინს.`
            );
          }
        }
      }
    }

    return list;
  }, [newStartDate, newDeadline, stages]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin && isDeadlineLocked) {
      setError("დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს");
      return;
    }

    if (isDeadlineLocked && !reason.trim()) {
      setError("დედლაინის ცვლილებისას მიზეზის მითითება სავალდებულოა");
      return;
    }

    if (newStartDate && newDeadline && new Date(newStartDate) > new Date(newDeadline)) {
      setError("დაწყების თარიღი არ შეიძლება იყოს დედლაინზე გვიან");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onRescheduleConfirmed(
        newStartDate ? new Date(newStartDate).toISOString() : null,
        newDeadline ? new Date(newDeadline).toISOString() : null,
        reason.trim()
      );
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
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <Calendar size={16} />
            </div>
            <div>
              <div className="font-extrabold text-stone-900 text-sm">
                განრიგისა და დედლაინის შეცვლა (ადმინი)
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

        {/* Side-by-side comparison */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 space-y-2">
          <div className="font-bold text-stone-700 text-[11px] uppercase tracking-wider">
            თარიღების შედარება
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-white rounded-lg border border-stone-200 space-y-1">
              <span className="text-[10px] text-stone-400 font-bold block">
                მიმდინარე განრიგი
              </span>
              <div className="font-medium text-stone-700">
                დაწყება:{" "}
                <span className="font-bold">
                  {formatGeorgianDateShort(currentStartDate) || "არ არის"}
                </span>
              </div>
              <div className="font-medium text-stone-700">
                დედლაინი:{" "}
                <span className="font-bold text-orange-600">
                  {formatGeorgianDateShort(currentDeadline) || "არ არის"}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-orange-50/50 rounded-lg border border-orange-200 space-y-1">
              <span className="text-[10px] text-orange-700 font-bold block flex items-center gap-1">
                <ArrowRight size={10} />
                <span>შემოთავაზებული ახალი</span>
              </span>
              <div className="font-medium text-stone-800">
                დაწყება:{" "}
                <span className="font-bold">
                  {formatGeorgianDateShort(newStartDate) || "არ არის"}
                </span>
              </div>
              <div className="font-medium text-stone-800">
                დედლაინი:{" "}
                <span className="font-bold text-orange-700">
                  {formatGeorgianDateShort(newDeadline) || "არ არის"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time conflict warnings */}
        {conflicts.length > 0 && (
          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1 text-amber-900">
            <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
              <AlertTriangle size={14} className="text-amber-600" />
              <span>შესაძლო განრიგის კონფლიქტები:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium text-amber-800">
              {conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-1.5 font-medium">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-stone-800 block mb-1">
                ახალი დაწყების თარიღი
              </label>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-stone-800 block mb-1">
                ახალი დედლაინი <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-stone-800 block mb-1">
              ცვლილების მიზეზი (სავალდებულოა) <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="მაგ. დამკვეთის თხოვნით დაემატა 3 დღე, ან გადაუდებელმა Hotfix-მა შეაფერხა სამუშაო..."
              className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-xs resize-none"
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
              disabled={isSubmitting || !reason.trim() || !newDeadline}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Calendar size={13} />
              )}
              <span>განრიგის შენახვა</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
