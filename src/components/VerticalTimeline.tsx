"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Lock,
  Layers,
} from "lucide-react";
import {
  formatGeorgianDate,
  getGeorgianDayOfWeek,
  getDateRelativeLabel,
  formatGeorgianDateShort,
  getTbilisiTodayString,
} from "@/lib/dateUtils";
import { DatePicker } from "@/components/ui/DatePicker";

export interface TimelineTask {
  id: string;
  taskNumber: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  progress: number;
  startDate: string | null;
  deadline: string | null;
  deadlineLocked?: boolean;
  isOverdue?: boolean;
  project?: { id: string; name: string; color?: string | null } | null;
  assignees: { id: string; name: string; avatarUrl: string | null }[];
  responsibleUsers?: { id: string; name: string; avatarUrl: string | null }[];
  activeStage?: {
    id: string;
    title: string;
    position: number;
    deadline?: string | null;
    assignees: { id: string; name: string; avatarUrl: string | null }[];
  } | null;
  totalSubtasks: number;
  doneSubtasks: number;
  isSpanStart?: boolean;
  isSpanEnd?: boolean;
  isMultiDay?: boolean;
}

export interface TimelineActivity {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  reason?: string | null;
  actor?: { id: string; name: string; avatarUrl: string | null };
  task?: {
    id: string;
    taskNumber?: number;
    title: string;
    type?: string;
    status?: string;
  } | null;
  oldValues?: unknown;
  newValues?: unknown;
}

export interface TimelineDateItem {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isWorking: boolean;
  holidayName?: string | null;
  isToday: boolean;
  tasks: TimelineTask[];
  activities: TimelineActivity[];
}

interface TimelineProps {
  dates: TimelineDateItem[];
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  mode: "schedule" | "activity";
  onModeChange: (mode: "schedule" | "activity") => void;
  isLoading?: boolean;
  onToggleBacklog?: () => void;
  isBacklogOpen?: boolean;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
}

function parseJsonSafe(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
  if (typeof val === "object") return val as Record<string, unknown>;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return null;
}

function formatTimelineActivity(act: TimelineActivity): {
  label: string;
  details?: string | null;
} {
  const oldVal = parseJsonSafe(act.oldValues);
  const newVal = parseJsonSafe(act.newValues);

  switch (act.action) {
    case "STATUS_CHANGED": {
      const from = (oldVal?.status as string) || "საწყისი";
      const to = (newVal?.status as string) || "განახლებული";
      return {
        label: "სტატუსის ცვლილება",
        details: `${from} → ${to}`,
      };
    }
    case "DEADLINE_CHANGED": {
      const from = oldVal?.deadline
        ? formatGeorgianDateShort(oldVal.deadline as string)
        : "არ იყო";
      const to = newVal?.deadline
        ? formatGeorgianDateShort(newVal.deadline as string)
        : "წაიშალა";
      return {
        label: "დედლაინის ცვლილება (ადმინისტრატორი)",
        details: `${from} → ${to}${act.reason ? ` • მიზეზი: ${act.reason}` : ""}`,
      };
    }
    case "STAGE_COMPLETED":
      return {
        label: "სამუშაო ეტაპი დასრულდა",
        details: act.reason || "გადაეცა შემდეგ ეტაპზე",
      };
    case "STAGE_CREATED":
      return { label: "ახალი სამუშაო ეტაპი შეიქმნა" };
    case "STAGE_DELETED":
      return { label: "სამუშაო ეტაპი წაიშალა", details: act.reason || null };
    case "STAGE_REORDERED":
      return { label: "ეტაპების რიგითობა შეიცვალა" };
    case "SUBTASK_COMPLETED":
      return { label: "საბტასკი შესრულდა", details: act.reason || null };
    case "SUBTASK_REOPENED":
      return { label: "საბტასკი ხელახლა გაიხსნა" };
    case "SUBTASK_CREATED":
      return { label: "ახალი საბტასკი დაემატა" };
    case "SUBTASK_DELETED":
      return { label: "საბტასკი წაიშალა", details: act.reason || null };
    case "COMMENT_ADDED":
      return { label: "ახალი კომენტარი დაემატა" };
    case "COMMENT_DELETED":
      return { label: "კომენტარი წაიშალა", details: act.reason || null };
    case "ATTACHMENT_ADDED":
      return { label: "ფაილი / გარე ბმული დაემატა" };
    case "ATTACHMENT_REMOVED":
      return { label: "ფაილი / გარე ბმული წაიშალა" };
    case "DAILY_UPDATE_ADDED":
      return { label: "დღიური სამუშაო ჩანაწერი დაემატა" };
    case "TASK_CREATED":
      return { label: "ტასკი შეიქმნა" };
    case "WORK_PAUSED":
      return { label: "სამუშაო შეჩერდა" };
    case "WORK_RESUMED":
      return { label: "სამუშაო განახლდა" };
    default:
      return { label: act.action, details: act.reason || null };
  }
}

export function VerticalTimeline({
  dates,
  onSelectTask,
  selectedTaskId,
  mode,
  onModeChange,
  isLoading,
  onToggleBacklog,
  isBacklogOpen,
  onDateChange,
  onPrev,
  onNext,
  onToday,
}: TimelineProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayElementRef = useRef<HTMLDivElement>(null);
  const dayElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const todayDateStr =
    typeof window !== "undefined" ? getTbilisiTodayString() : "2026-11-05";

  // Active date key (string in YYYY-MM-DD format)
  const [activeDateKey, setActiveDateKey] = useState<string>(() => {
    const today = dates.find((d) => d.isToday);
    if (today) return today.date;
    return todayDateStr;
  });

  const effectiveActiveDateKey = (() => {
    if (dates.length > 0) {
      const exists = dates.some((d) => d.date === activeDateKey);
      if (exists) return activeDateKey;
      const today = dates.find((d) => d.isToday);
      if (today) return today.date;
      return dates[0]?.date || activeDateKey;
    }
    return activeDateKey;
  })();

  const isProgrammaticScrollingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const hasInitiallyPositionedRef = useRef<boolean>(false);

  // Initial positioning: On fresh load with loaded dates, place Today immediately near the top
  useEffect(() => {
    if (isLoading || dates.length === 0) return;
    if (hasInitiallyPositionedRef.current) return;

    const todayItem =
      dates.find((d) => d.isToday) || dates.find((d) => d.date === todayDateStr);
    const targetDate = todayItem ? todayItem.date : dates[0]?.date;
    if (!targetDate) return;

    const targetEl =
      dayElementsRef.current.get(targetDate) || todayElementRef.current;
    const container = scrollContainerRef.current;

    if (targetEl && container) {
      // Temporarily set scrollBehavior to auto for instant, flicker-free initial alignment
      const prevBehavior = container.style.scrollBehavior;
      container.style.scrollBehavior = "auto";

      const cRect = container.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const targetScrollTop = container.scrollTop + (tRect.top - cRect.top) - 12;

      container.scrollTop = Math.max(0, targetScrollTop);
      hasInitiallyPositionedRef.current = true;

      // Restore default smooth scrolling for subsequent user navigation
      requestAnimationFrame(() => {
        if (container) {
          container.style.scrollBehavior = prevBehavior || "";
        }
      });
    }
  }, [isLoading, dates, todayDateStr]);

  // Dynamic active-day detection on manual scroll
  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollingRef.current) return;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const cRect = container.getBoundingClientRect();

      // Focus line is 24px below the top of the timeline scroll container
      const focusY = cRect.top + 24;

      let closestDate: string | null = null;
      let closestDist = Infinity;

      for (const [dateStr, el] of dayElementsRef.current.entries()) {
        if (!el) continue;
        const dRect = el.getBoundingClientRect();

        // Check if the focus line falls within this day's element boundaries
        if (focusY >= dRect.top && focusY <= dRect.bottom) {
          closestDate = dateStr;
          break;
        }

        // Or measure distance to focus line
        const dist = Math.abs(dRect.top - focusY);
        if (dist < closestDist) {
          closestDist = dist;
          closestDate = dateStr;
        }
      }

      if (closestDate && closestDate !== activeDateKey) {
        setActiveDateKey(closestDate);
      }
    });
  }, [activeDateKey]);

  // Navigate to Today
  const handleScrollToToday = () => {
    const todayItem =
      dates.find((d) => d.isToday) || dates.find((d) => d.date === todayDateStr);
    const container = scrollContainerRef.current;

    if (todayItem) {
      const targetEl =
        dayElementsRef.current.get(todayItem.date) || todayElementRef.current;
      if (targetEl && container) {
        isProgrammaticScrollingRef.current = true;
        const cRect = container.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        const targetScroll = container.scrollTop + (tRect.top - cRect.top) - 12;

        container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
        setActiveDateKey(todayItem.date);

        setTimeout(() => {
          isProgrammaticScrollingRef.current = false;
        }, 500);
      }
    } else {
      if (onToday) onToday();
    }
  };

  // Date picker selection
  const handleDatePickerChange = (newDateStr: string) => {
    if (!newDateStr) return;

    const targetEl = dayElementsRef.current.get(newDateStr);
    const container = scrollContainerRef.current;

    if (targetEl && container) {
      isProgrammaticScrollingRef.current = true;
      const cRect = container.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      const targetScroll = container.scrollTop + (tRect.top - cRect.top) - 12;

      container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
      setActiveDateKey(newDateStr);

      setTimeout(() => {
        isProgrammaticScrollingRef.current = false;
      }, 500);
    } else {
      setActiveDateKey(newDateStr);
      const [y, m, d] = newDateStr.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && onDateChange) {
        onDateChange(new Date(y, m - 1, d));
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-r border-stone-200/80 overflow-hidden min-h-0">
      {/* Timeline Controls Header */}
      <div className="p-2.5 sm:p-3 border-b border-stone-100 flex flex-wrap items-center justify-between gap-2.5 shrink-0 bg-white z-10 shadow-2xs">
        {/* Left: Title & Date Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-sm font-extrabold text-stone-900 tracking-tight">
            თაიმლაინი
          </h2>

          {/* Date Controls Bar */}
          <div className="flex items-center gap-1 bg-stone-100/90 p-0.5 rounded-xl text-xs font-semibold">
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-1 hover:bg-white rounded-lg text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                title="7 დღით უკან"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {onToday && (
              <button
                onClick={handleScrollToToday}
                className="px-2 py-0.5 hover:bg-white rounded-lg text-stone-700 hover:text-orange-600 transition-colors cursor-pointer text-xs font-bold"
                title="მიმდინარე დღეზე გადასვლა"
              >
                დღეს
              </button>
            )}

            {/* Modern Georgian Date Picker */}
            <div className="w-38 sm:w-44">
              <DatePicker
                value={effectiveActiveDateKey}
                onChange={handleDatePickerChange}
                size="sm"
                clearable={false}
                placeholder="თარიღი"
              />
            </div>

            {onNext && (
              <button
                onClick={onNext}
                className="p-1 hover:bg-white rounded-lg text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                title="7 დღით წინ"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => onModeChange("schedule")}
              className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                mode === "schedule"
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              განრიგი
            </button>
            <button
              onClick={() => onModeChange("activity")}
              className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                mode === "activity"
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              აქტივობა
            </button>
          </div>
        </div>

        {/* Right: Filters & Backlog Toggle */}
        <div className="flex items-center gap-1.5">
          {onToggleBacklog && !isBacklogOpen && (
            <button
              onClick={onToggleBacklog}
              className="flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full text-xs font-semibold transition-colors cursor-pointer"
              title="საერთო ბექლოგის გახსნა"
            >
              <Layers size={13} className="text-orange-600" />
              <span>ბექლოგი</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2 py-0.5">
            <Filter size={12} className="text-stone-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[11px] font-semibold bg-transparent text-stone-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ყველა ტიპი</option>
              <option value="FEATURE">Feature</option>
              <option value="BUG">Bug</option>
              <option value="HOTFIX">Hotfix</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Timeline Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 scroll-smooth"
      >
        {isLoading ? (
          <div className="p-12 text-center text-xs text-stone-400">
            იტვირთება თაიმლაინი...
          </div>
        ) : dates.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400">
            ჩანაწერები არ მოიძებნა
          </div>
        ) : (
          dates.map((day) => {
            const isActiveDate = day.date === effectiveActiveDateKey;
            const isTodayDate = day.isToday || day.date === todayDateStr;
            const relativeLabel = getDateRelativeLabel(day.date);
            const filteredTasks =
              filterType === "ALL"
                ? day.tasks
                : day.tasks.filter((t) => t.type === filterType);
            const hasTasks = filteredTasks.length > 0;

            const isTodayAndActive = isTodayDate && isActiveDate;
            const isTodayNotActive = isTodayDate && !isActiveDate;
            const isOtherActive = !isTodayDate && isActiveDate;

            return (
              <div
                key={day.date}
                ref={(el) => {
                  if (el) dayElementsRef.current.set(day.date, el);
                  else dayElementsRef.current.delete(day.date);
                  if (day.isToday) todayElementRef.current = el;
                }}
                id={day.isToday ? "timeline-today-anchor" : `timeline-day-${day.date}`}
                className="relative flex items-stretch gap-2.5 sm:gap-3 group"
              >
                {/* Left Column: Timeline Rail & Date Marker Gutter (24px fixed width) */}
                <div className="relative flex flex-col items-center shrink-0 w-6 self-stretch">
                  {/* Continuous Vertical Rail connecting days seamlessly with 0px gap */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-stone-300 group-first:top-3.5 group-last:bottom-auto group-last:h-4" />

                  {/* Circular Node Marker positioned directly on the rail */}
                  <div
                    className={`relative z-10 mt-3 rounded-full border-2 transition-all shrink-0 ${
                      isTodayDate
                        ? "w-3.5 h-3.5 border-blue-600 bg-blue-500 ring-4 ring-blue-100 scale-125 shadow-xs"
                        : day.holidayName
                        ? "w-2.5 h-2.5 border-amber-500 bg-amber-100"
                        : day.isWeekend
                        ? "w-2.5 h-2.5 border-stone-300 bg-stone-200"
                        : "w-2.5 h-2.5 border-stone-300 bg-stone-200 hover:border-stone-400"
                    }`}
                  />
                </div>

                {/* Right Column: Day Content Box wrapper with bottom padding for 0px rail continuity */}
                <div className="flex-1 min-w-0 pb-2.5 sm:pb-3">
                  <div
                    className={`transition-all duration-150 ${
                      isTodayDate
                        ? "bg-white border-2 border-blue-500/90 shadow-md ring-2 ring-blue-100/70 p-3 sm:p-3.5 rounded-2xl"
                        : day.isWeekend || !day.isWorking
                        ? "bg-stone-100/40 border border-stone-200/50 p-2 sm:p-2.5 rounded-xl"
                        : "bg-stone-100/60 hover:bg-stone-100/80 border border-stone-200/60 p-2 sm:p-2.5 rounded-xl"
                    }`}
                  >
                  {/* Date Header Row */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span
                      className={`tracking-tight ${
                        isTodayDate
                          ? "text-base sm:text-lg font-black text-stone-900"
                          : "text-xs sm:text-[13px] font-semibold text-stone-600"
                      }`}
                    >
                      {formatGeorgianDate(day.date)}
                    </span>

                    <span
                      className={`${
                        isTodayDate
                          ? "text-xs text-stone-600 font-semibold"
                          : "text-[11px] text-stone-400 font-medium"
                      }`}
                    >
                      {getGeorgianDayOfWeek(day.date)}
                    </span>

                    {/* Today Badge */}
                    {isTodayDate && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200/60 shadow-2xs">
                        • დღეს
                      </span>
                    )}

                    {/* Relative Badge */}
                    {relativeLabel && !isTodayDate && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-stone-200/70 text-stone-600">
                        • {relativeLabel}
                      </span>
                    )}

                    {/* Holiday or Weekend Badge */}
                    {day.holidayName ? (
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-full border border-amber-200/80">
                        • {day.holidayName} (უქმე)
                      </span>
                    ) : day.isWeekend ? (
                      <span className="text-[9px] font-medium text-stone-400 bg-stone-200/60 px-1.5 py-0.5 rounded-full">
                        • დასვენება
                      </span>
                    ) : null}

                    {/* Empty Day Note */}
                    {!hasTasks && mode === "schedule" && (
                      <span className="text-[11px] text-stone-400 italic ml-1">
                        • სამუშაოები არ არის
                      </span>
                    )}
                  </div>

                {/* Mode 1: Schedule Mode */}
                {mode === "schedule" ? (
                  hasTasks && (
                    <div className="space-y-1.5">
                      {filteredTasks.map((t) => {
                        const isSelected = selectedTaskId === t.id;

                        let typeBadge = {
                          label: "FEAT",
                          class: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
                        };
                        if (t.type === "BUG") {
                          typeBadge = {
                            label: "BUG",
                            class: "bg-amber-50 text-amber-700 border-amber-200/60",
                          };
                        } else if (t.type === "HOTFIX") {
                          typeBadge = {
                            label: "HOTFIX",
                            class: "bg-rose-50 text-rose-700 border-rose-200/60",
                          };
                        }

                        const activeResponsibles =
                          t.responsibleUsers && t.responsibleUsers.length > 0
                            ? t.responsibleUsers
                            : t.assignees;

                        const isContinuation = Boolean(
                          t.isMultiDay && !t.isSpanStart
                        );

                        const isOverdue =
                          Boolean(t.deadline) &&
                          new Date(t.deadline!) < new Date() &&
                          t.status !== "DONE" &&
                          t.status !== "CANCELLED";

                        const isDeadlineTomorrow = (() => {
                          if (!t.deadline || t.status === "DONE" || t.status === "CANCELLED") return false;
                          const d = new Date(t.deadline);
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          return (
                            d.getFullYear() === tomorrow.getFullYear() &&
                            d.getMonth() === tomorrow.getMonth() &&
                            d.getDate() === tomorrow.getDate()
                          );
                        })();

                        const isStageDelayed =
                          !isOverdue &&
                          Boolean(t.activeStage?.deadline) &&
                          new Date(t.activeStage!.deadline!) < new Date() &&
                          t.status !== "DONE" &&
                          t.status !== "CANCELLED";

                        const cardHighlightClass = isSelected
                          ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-200 shadow-xs"
                          : isOverdue
                          ? "bg-rose-50/40 border-rose-400 text-rose-900 shadow-2xs hover:shadow-xs"
                          : isDeadlineTomorrow
                          ? "bg-amber-50/40 border-amber-400 text-amber-900 shadow-2xs hover:shadow-xs"
                          : isStageDelayed
                          ? "bg-amber-50/30 border-amber-300 text-amber-900 shadow-2xs hover:shadow-xs"
                          : "bg-white hover:bg-stone-50 border-stone-200 shadow-2xs hover:shadow-xs";

                        // Continuation Card (single-line dashed row)
                        if (isContinuation) {
                          return (
                            <div
                              key={`${t.id}-${day.date}`}
                              data-task-id={t.id}
                              onClick={() => onSelectTask(t.id)}
                              className={`px-2.5 py-1 rounded-lg border border-dashed transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                                isSelected
                                  ? "bg-blue-50/70 border-blue-500 ring-1 ring-blue-200"
                                  : isOverdue
                                  ? "bg-rose-50/30 border-rose-300 text-rose-900"
                                  : "bg-white/80 hover:bg-white border-stone-200/80"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-stone-200/80 text-stone-600 uppercase shrink-0">
                                  გაგრძელება
                                </span>
                                <span className="text-[10px] font-mono text-stone-400 shrink-0">
                                  #{t.taskNumber}
                                </span>
                                <h4 className="text-xs font-medium text-stone-800 truncate">
                                  {t.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {activeResponsibles &&
                                  activeResponsibles.length > 0 && (
                                    <div className="flex -space-x-1">
                                      {activeResponsibles.slice(0, 2).map((u) => (
                                        <div
                                          key={u.id}
                                          className="w-4 h-4 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[7px] font-bold text-stone-700"
                                          title={u.name}
                                        >
                                          {u.name.charAt(0)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="text-[10px] font-bold text-stone-700">
                                    {t.progress}%
                                  </span>
                                  <span className="text-stone-300">•</span>
                                  {t.deadline ? (
                                    <span className={`text-[10px] font-bold ${isOverdue ? "text-rose-600 font-extrabold" : "text-stone-600"}`}>
                                      {formatGeorgianDateShort(t.deadline)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-stone-400 italic">უდედლაინო</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Standard Compact Card
                        return (
                          <div
                            key={`${t.id}-${day.date}`}
                            data-task-id={t.id}
                            onClick={() => onSelectTask(t.id)}
                            className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${cardHighlightClass}`}
                          >
                            {/* Left: Type, Task#, Title, Active Stage */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className={`text-[8px] font-black px-1.5 py-0.2 rounded border uppercase tracking-wider shrink-0 ${typeBadge.class}`}
                              >
                                {typeBadge.label}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-stone-400 shrink-0">
                                #{t.taskNumber}
                              </span>
                              <h4 className="text-xs font-semibold text-stone-900 truncate">
                                {t.title}
                              </h4>
                              {t.activeStage && (
                                <span className="hidden md:inline-flex text-[9px] font-bold text-blue-800 bg-blue-100/70 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[120px]">
                                  {t.activeStage.title}
                                </span>
                              )}
                            </div>

                            {/* Right: Overdue / Warning, Done, Responsibles, Progress, Deadline */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isOverdue && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-rose-700 bg-rose-100/90 px-1.5 py-0.2 rounded border border-rose-200 shrink-0">
                                  <AlertCircle size={9} />
                                  <span>ვადაგადაცილებული</span>
                                </span>
                              )}
                              {isStageDelayed && !isOverdue && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                  <span>ეტაპი შეფერხებულია</span>
                                </span>
                              )}
                              {isDeadlineTomorrow && !isOverdue && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                  ხვალ იწურება
                                </span>
                              )}
                              {t.status === "DONE" && (
                                <CheckCircle2 size={13} className="text-emerald-600" />
                              )}
                              {activeResponsibles &&
                                activeResponsibles.length > 0 && (
                                  <div className="flex -space-x-1 overflow-hidden">
                                    {activeResponsibles.slice(0, 2).map((u) => (
                                      <div
                                        key={u.id}
                                        className="w-4 h-4 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[7px] font-bold text-stone-700 shrink-0"
                                        title={u.name}
                                      >
                                        {u.avatarUrl ? (
                                          <Image
                                            src={u.avatarUrl}
                                            alt={u.name}
                                            width={16}
                                            height={16}
                                            className="w-full h-full rounded-full object-cover"
                                            unoptimized
                                          />
                                        ) : (
                                          u.name.charAt(0)
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              {/* Tail: Always progress% and deadline or "უდედლაინო" */}
                              <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold">
                                <span className="text-[10px] font-bold text-stone-700">
                                  {t.progress}%
                                </span>
                                <span className="text-stone-300">•</span>
                                {t.deadline ? (
                                  <div
                                    className={`flex items-center gap-0.5 text-[10px] font-bold shrink-0 ${
                                      isOverdue
                                        ? "text-rose-600 font-extrabold"
                                        : isDeadlineTomorrow
                                        ? "text-amber-700"
                                        : "text-stone-600"
                                    }`}
                                  >
                                    <CalendarIcon size={10} className="text-stone-400 shrink-0" />
                                    <span>{formatGeorgianDateShort(t.deadline)}</span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-stone-400 italic">
                                    უდედლაინო
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* Mode 2: Activity Mode (Historical Truth) */
                  <div className="space-y-1.5">
                    {day.activities.length === 0 ? (
                      <div className="text-[10px] text-stone-300 italic pl-1">
                        აქტივობა არ არის
                      </div>
                    ) : (
                      day.activities.map((a) => {
                        const { label, details } = formatTimelineActivity(a);

                        return (
                          <div
                            key={a.id}
                            className="p-2 rounded-xl bg-white border border-stone-200/80 shadow-2xs text-xs space-y-1 hover:border-stone-300 transition-colors"
                          >
                            <div className="flex items-center justify-between text-stone-500 text-[10px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-stone-900">
                                  {a.actor?.name || "სისტემა"}
                                </span>
                                <span>•</span>
                                <span className="font-semibold text-stone-700">
                                  {label}
                                </span>
                              </div>
                              <span className="font-mono text-stone-400">
                                {new Date(a.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {details && (
                              <div className="text-stone-800 font-medium text-[10px] bg-stone-50/80 p-1.5 rounded-lg border border-stone-100">
                                {details}
                              </div>
                            )}

                            {a.task && (
                              <div
                                onClick={() => a.task?.id && onSelectTask(a.task.id)}
                                className="pt-0.5 text-orange-600 hover:text-orange-700 cursor-pointer font-bold text-[10px] flex items-center gap-1"
                              >
                                <span>
                                  #{a.task.taskNumber || ""} {a.task.title}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
