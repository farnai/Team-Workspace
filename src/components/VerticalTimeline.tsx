"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronLeft,
  ChevronRight,
  Lock,
  ArrowRight,
  User,
} from "lucide-react";
import {
  formatGeorgianDate,
  getGeorgianDayOfWeek,
  getDateRelativeLabel,
  formatGeorgianDateShort,
} from "@/lib/dateUtils";

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
    case "STAGE_REORDERED":
      return { label: "ეტაპების რიგითობა შეიცვალა" };
    case "SUBTASK_COMPLETED":
      return { label: "საბტასკი შესრულდა", details: act.reason || null };
    case "SUBTASK_REOPENED":
      return { label: "საბტასკი ხელახლა გაიხსნა" };
    case "SUBTASK_CREATED":
      return { label: "ახალი საბტასკი დაემატა" };
    case "COMMENT_ADDED":
      return { label: "ახალი კომენტარი დაემატა" };
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
  currentDate = new Date(),
  onDateChange,
  onPrev,
  onNext,
  onToday,
}: TimelineProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayElementRef = useRef<HTMLDivElement>(null);
  const initialScrolledRef = useRef<boolean>(false);
  const dayElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const [activeDateKey, setActiveDateKey] = useState<string>(() => {
    const today = dates.find((d) => d.isToday);
    if (today) return today.date;
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(currentDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // Focus Today near the top of viewport on initial load
  useEffect(() => {
    if (!isLoading && dates.length > 0 && todayElementRef.current && scrollContainerRef.current) {
      if (!initialScrolledRef.current) {
        const container = scrollContainerRef.current;
        const target = todayElementRef.current;
        container.scrollTop = target.offsetTop - 16;
        initialScrolledRef.current = true;
      }
    }
  }, [isLoading, dates]);

  // Scroll detection to update activeDateKey smoothly
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const focusThreshold = container.scrollTop + 60;

    let closestDate: string | null = null;
    let closestDist = Infinity;

    for (const [dateStr, el] of dayElementsRef.current.entries()) {
      if (!el) continue;
      const top = el.offsetTop;
      const height = el.offsetHeight;
      if (focusThreshold >= top && focusThreshold <= top + height) {
        closestDate = dateStr;
        break;
      }
      const dist = Math.abs(top - focusThreshold);
      if (dist < closestDist) {
        closestDist = dist;
        closestDate = dateStr;
      }
    }

    if (closestDate && closestDate !== activeDateKey) {
      setActiveDateKey(closestDate);
    }
  }, [activeDateKey]);

  const handleScrollToToday = () => {
    const todayItem = dates.find((d) => d.isToday);
    if (todayElementRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const target = todayElementRef.current;
      container.scrollTo({ top: target.offsetTop - 16, behavior: "smooth" });
    }
    if (todayItem) {
      setActiveDateKey(todayItem.date);
    }
    if (onToday) onToday();
  };

  const datePickerValue = (() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    const d = String(currentDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const dateStr = e.target.value;
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && onDateChange) {
      onDateChange(new Date(parts[0], parts[1] - 1, parts[2]));
    }
    const targetEl = dayElementsRef.current.get(dateStr);
    if (targetEl && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: targetEl.offsetTop - 16, behavior: "smooth" });
      setActiveDateKey(dateStr);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-r border-stone-200/80 overflow-hidden">
      {/* Timeline Controls Header */}
      <div className="p-3.5 sm:p-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
        {/* Left: Title & Date Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h2 className="text-base font-extrabold text-stone-900 tracking-tight">
            თაიმლაინი
          </h2>

          {/* Date Navigation Controls */}
          <div className="flex items-center gap-1 bg-stone-100/90 p-1 rounded-xl text-xs font-semibold">
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-1 hover:bg-white rounded-lg text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                title="7 დღით უკან"
              >
                <ChevronLeft size={15} />
              </button>
            )}

            {onToday && (
              <button
                onClick={handleScrollToToday}
                className="px-2 py-0.5 hover:bg-white rounded-lg text-stone-700 hover:text-orange-600 transition-colors cursor-pointer font-bold"
                title="მიმდინარე დღეზე გადასვლა"
              >
                დღეს
              </button>
            )}

            {/* Date Picker Input */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white rounded-lg border border-stone-200/70 shadow-2xs">
              <CalendarIcon size={12} className="text-stone-400" />
              <input
                type="date"
                value={datePickerValue}
                onChange={handleDatePickerChange}
                className="text-[11px] font-bold text-stone-800 bg-transparent focus:outline-none cursor-pointer"
                title="აირჩიეთ ნებისმიერი თარიღი"
              />
            </div>

            {onNext && (
              <button
                onClick={onNext}
                className="p-1 hover:bg-white rounded-lg text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                title="7 დღით წინ"
              >
                <ChevronRight size={15} />
              </button>
            )}
          </div>

          {/* Mode Switcher: Schedule vs Activity */}
          <div className="flex items-center bg-stone-100/90 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => onModeChange("schedule")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                mode === "schedule"
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              განრიგი
            </button>
            <button
              onClick={() => onModeChange("activity")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                mode === "activity"
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              აქტივობა (ისტორია)
            </button>
          </div>
        </div>

        {/* Right: Filters & Backlog Toggle */}
        <div className="flex items-center gap-2">
          {onToggleBacklog && !isBacklogOpen && (
            <button
              onClick={onToggleBacklog}
              className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full text-xs font-semibold transition-colors cursor-pointer"
              title="საერთო ბექლოგის გახსნა"
            >
              <Layers size={13} className="text-orange-600" />
              <span>ბექლოგი</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-xl px-2 py-0.5">
            <Filter size={13} className="text-stone-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs font-medium bg-transparent text-stone-700 focus:outline-none cursor-pointer"
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
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 scroll-smooth"
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
            const relativeLabel = getDateRelativeLabel(day.date);
            const isActiveDate = day.date === activeDateKey;
            const filteredTasks =
              filterType === "ALL"
                ? day.tasks
                : day.tasks.filter((t) => t.type === filterType);

            return (
              <div
                key={day.date}
                ref={(el) => {
                  if (el) dayElementsRef.current.set(day.date, el);
                  else dayElementsRef.current.delete(day.date);
                  if (day.isToday) todayElementRef.current = el;
                }}
                id={day.isToday ? "timeline-today-anchor" : `timeline-day-${day.date}`}
                className={`relative pl-7 group transition-all duration-200 rounded-2xl p-2.5 ${
                  isActiveDate
                    ? "bg-orange-50/25 ring-2 ring-orange-500/50 border border-orange-200/90 shadow-2xs opacity-100"
                    : day.isWeekend || !day.isWorking
                    ? "bg-stone-50/50 border border-stone-100/60 opacity-80 hover:opacity-100"
                    : day.isToday
                    ? "bg-emerald-50/20 border border-emerald-200/50 opacity-90 hover:opacity-100"
                    : "border border-transparent opacity-80 hover:opacity-100 hover:bg-stone-50/60"
                }`}
              >
                {/* Vertical Timeline Axis Line */}
                <div className="absolute left-2.5 top-2.5 bottom-0 w-[1.5px] bg-stone-200/90 group-last:bottom-2" />

                {/* Node Bullet Marker */}
                <div
                  className={`absolute left-1.5 top-3 w-3 h-3 rounded-full border-2 bg-white transition-all ${
                    isActiveDate
                      ? "border-orange-600 ring-4 ring-orange-200/80 scale-110"
                      : day.isToday
                      ? "border-emerald-600 ring-2 ring-emerald-100"
                      : day.holidayName
                      ? "border-amber-500 bg-amber-100"
                      : day.isWeekend
                      ? "border-stone-300 bg-stone-100"
                      : "border-stone-400"
                  }`}
                />

                {/* Date Header Row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`tracking-tight ${
                      isActiveDate
                        ? "text-sm font-black text-stone-900"
                        : "text-xs font-bold text-stone-700"
                    }`}
                  >
                    {formatGeorgianDate(day.date)}
                  </span>
                  <span
                    className={`${
                      isActiveDate
                        ? "text-xs text-stone-600 font-semibold"
                        : "text-[11px] text-stone-400 font-medium"
                    }`}
                  >
                    {getGeorgianDayOfWeek(day.date)}
                  </span>

                  {/* Active Indicator Badge */}
                  {isActiveDate && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-600 text-white shadow-2xs">
                      აქტიური
                    </span>
                  )}

                  {/* Today Badge */}
                  {day.isToday && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                      • დღეს
                    </span>
                  )}

                  {/* Relative Badge */}
                  {relativeLabel && !day.isToday && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                      • {relativeLabel}
                    </span>
                  )}

                  {/* Holiday or Weekend Badge */}
                  {day.holidayName ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      • {day.holidayName} (უქმე)
                    </span>
                  ) : day.isWeekend ? (
                    <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      • შაბათ-კვირა (დასვენება)
                    </span>
                  ) : null}
                </div>

                {/* Mode 1: Schedule Mode */}
                {mode === "schedule" ? (
                  <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <div className="text-[11px] text-stone-300 italic pl-1">
                        დაგეგმილი ტასკები არ არის
                      </div>
                    ) : (
                      filteredTasks.map((t) => {
                        const isSelected = selectedTaskId === t.id;

                        // Type badge styling
                        let typeBadgeClass =
                          "bg-indigo-50 text-indigo-700 border-indigo-200/60";
                        if (t.type === "BUG") {
                          typeBadgeClass =
                            "bg-amber-50 text-amber-700 border-amber-200/60";
                        } else if (t.type === "HOTFIX") {
                          typeBadgeClass =
                            "bg-rose-50 text-rose-700 border-rose-200/60";
                        }

                        const activeResponsibles =
                          t.responsibleUsers && t.responsibleUsers.length > 0
                            ? t.responsibleUsers
                            : t.assignees;

                        const isContinuation = Boolean(t.isMultiDay && !t.isSpanStart);

                        // Continuation Card (Single-line dashed row)
                        if (isContinuation) {
                          return (
                            <div
                              key={`${t.id}-${day.date}`}
                              onClick={() => onSelectTask(t.id)}
                              className={`px-3 py-1.5 rounded-xl border border-dashed transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                                isSelected
                                  ? "bg-orange-50/70 border-orange-500 ring-2 ring-orange-200/60 shadow-xs"
                                  : "bg-stone-50/70 hover:bg-white border-stone-200/90 shadow-2xs hover:shadow-xs"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-stone-200/80 text-stone-600 tracking-wider uppercase shrink-0">
                                  გაგრძელება
                                </span>
                                <span className="text-[10px] font-mono font-bold text-stone-400 shrink-0">
                                  #{t.taskNumber}
                                </span>
                                <h4 className="text-xs font-semibold text-stone-800 truncate">
                                  {t.title}
                                </h4>
                                {t.project && (
                                  <span className="hidden sm:inline-flex text-[9px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[100px]">
                                    {t.project.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {activeResponsibles && activeResponsibles.length > 0 && (
                                  <div className="flex -space-x-1 overflow-hidden">
                                    {activeResponsibles.slice(0, 2).map((u) => (
                                      <div
                                        key={u.id}
                                        className="w-4 h-4 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-bold text-stone-700 shrink-0"
                                        title={u.name}
                                      >
                                        {u.name.charAt(0)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <span className="text-[10px] font-bold text-stone-600">
                                  {t.progress}%
                                </span>
                                {t.isSpanEnd && (
                                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                    დედლაინი
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Case A: Inactive Date -> Ultra-compact 1-line card
                        if (!isActiveDate) {
                          return (
                            <div
                              key={`${t.id}-${day.date}`}
                              onClick={() => onSelectTask(t.id)}
                              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                                isSelected
                                  ? "bg-orange-50/60 border-orange-500 ring-2 ring-orange-200/60 shadow-xs"
                                  : "bg-white hover:bg-stone-50/90 border-stone-200/70 shadow-2xs hover:shadow-xs"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={`text-[8px] font-black px-1 py-0.2 rounded border uppercase shrink-0 ${typeBadgeClass}`}
                                >
                                  {t.type.slice(0, 3)}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-stone-400 shrink-0">
                                  #{t.taskNumber}
                                </span>
                                <h4 className="text-xs font-medium text-stone-800 truncate">
                                  {t.title}
                                </h4>
                                {t.project && (
                                  <span className="hidden sm:inline-flex text-[9px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[90px]">
                                    {t.project.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {activeResponsibles && activeResponsibles.length > 0 && (
                                  <div className="flex -space-x-1 overflow-hidden">
                                    {activeResponsibles.slice(0, 2).map((u) => (
                                      <div
                                        key={u.id}
                                        className="w-4 h-4 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-bold text-stone-700 shrink-0"
                                        title={u.name}
                                      >
                                        {u.name.charAt(0)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <span className="text-[10px] font-bold text-stone-600">
                                  {t.progress}%
                                </span>
                                {t.deadline && (
                                  <span className="text-[10px] text-stone-400 font-mono hidden sm:inline">
                                    {formatGeorgianDateShort(t.deadline)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Case B: Active Date -> Clean, compact 1-2 line card
                        return (
                          <div
                            key={`${t.id}-${day.date}`}
                            onClick={() => onSelectTask(t.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-orange-50/50 border-orange-500 ring-2 ring-orange-200/60 shadow-xs"
                                : "bg-white hover:bg-stone-50/90 border-stone-200/90 shadow-2xs hover:shadow-xs"
                            }`}
                          >
                            {/* Line 1: Type, Number, Title, Project, Overdue & Progress */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wider uppercase shrink-0 ${typeBadgeClass}`}
                                >
                                  {t.type}
                                </span>

                                <span className="text-[10px] font-mono font-bold text-stone-400 shrink-0">
                                  #{t.taskNumber}
                                </span>

                                <h4 className="text-xs font-bold text-stone-900 truncate">
                                  {t.title}
                                </h4>

                                {t.project && (
                                  <span className="hidden sm:inline-flex text-[9px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md shrink-0 truncate max-w-[120px]">
                                    {t.project.name}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {t.isOverdue && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                    <AlertCircle size={10} />
                                    <span>გადაცილებული</span>
                                  </span>
                                )}

                                {t.status === "DONE" && (
                                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 size={12} />
                                  </span>
                                )}

                                <div className="text-right">
                                  <span className="text-xs font-extrabold text-stone-800">
                                    {t.progress}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Line 2: Active Stage, Responsibles, Subtasks & Deadline */}
                            <div className="mt-2 flex items-center justify-between text-[11px] text-stone-500 gap-2 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                {t.activeStage && (
                                  <span className="text-[10px] font-bold text-orange-800 bg-orange-100/70 px-2 py-0.5 rounded-md border border-orange-200/60 truncate max-w-[140px]">
                                    {t.activeStage.title}
                                  </span>
                                )}

                                {activeResponsibles && activeResponsibles.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {activeResponsibles.map((u) => (
                                        <div
                                          key={u.id}
                                          className="w-4 h-4 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[8px] font-bold text-stone-700"
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
                                    <span className="text-stone-700 font-semibold text-[10px] truncate max-w-[100px] sm:max-w-none">
                                      {activeResponsibles.map((u) => u.name).join(", ")}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-stone-400 italic text-[10px] flex items-center gap-1">
                                    <User size={10} />
                                    <span>დაუნიშნავი</span>
                                  </span>
                                )}

                                {t.totalSubtasks > 0 && (
                                  <span className="text-[9px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded-md">
                                    {t.doneSubtasks}/{t.totalSubtasks}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {t.isMultiDay && t.startDate && t.deadline && (
                                  <span className="text-[9px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <span>{formatGeorgianDateShort(t.startDate)}</span>
                                    <ArrowRight size={8} />
                                    <span>{formatGeorgianDateShort(t.deadline)}</span>
                                  </span>
                                )}

                                <div className="flex items-center gap-1 text-stone-600 font-medium text-[10px]">
                                  <CalendarIcon size={10} className="text-stone-400" />
                                  <span>{formatGeorgianDateShort(t.deadline)}</span>
                                  {t.deadlineLocked && (
                                    <Lock size={9} className="text-stone-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Mode 2: Activity Mode (Historical Truth) */
                  <div className="space-y-2">
                    {day.activities.length === 0 ? (
                      <div className="text-[11px] text-stone-300 italic pl-1">
                        ამ დღეს აქტივობა არ დაფიქსირებულა
                      </div>
                    ) : (
                      day.activities.map((a) => {
                        const { label, details } = formatTimelineActivity(a);

                        return (
                          <div
                            key={a.id}
                            className="p-3 rounded-2xl bg-white border border-stone-200/80 shadow-2xs text-xs space-y-1 hover:border-stone-300 transition-colors"
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
                              <div className="text-stone-800 font-medium text-[11px] bg-stone-50/80 p-2 rounded-xl border border-stone-100">
                                {details}
                              </div>
                            )}

                            {a.task && (
                              <div
                                onClick={() => a.task?.id && onSelectTask(a.task.id)}
                                className="pt-0.5 text-orange-600 hover:text-orange-700 cursor-pointer font-bold text-[11px] flex items-center gap-1"
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
            );
          })
        )}
      </div>
    </div>
  );
}
