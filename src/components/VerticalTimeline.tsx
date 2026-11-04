"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  AlertCircle,
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
  isOverdue?: boolean;
  assignees: { id: string; name: string; avatarUrl: string | null }[];
  totalSubtasks: number;
  doneSubtasks: number;
}

export interface TimelineActivity {
  id: string;
  action: string;
  createdAt: string;
  reason?: string | null;
  actor?: { id: string; name: string; avatarUrl: string | null };
  task?: { id: string; title: string };
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
}

export function VerticalTimeline({
  dates,
  onSelectTask,
  selectedTaskId,
  mode,
  onModeChange,
  isLoading,
}: TimelineProps) {
  const [viewUnit, setViewUnit] = useState<"day" | "week" | "month">("day");
  const [filterType, setFilterType] = useState<string>("ALL");

  return (
    <div className="flex-1 flex flex-col h-full bg-white border-r border-stone-200/80 overflow-hidden">
      {/* Timeline Controls Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-stone-900 tracking-tight">
            თაიმლაინი
          </h2>

          {/* Unit Switcher: დღე / კვირა / თვე */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-full text-xs font-semibold">
            <button
              onClick={() => setViewUnit("day")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                viewUnit === "day"
                  ? "bg-orange-600 text-white shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              დღე
            </button>
            <button
              onClick={() => setViewUnit("week")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                viewUnit === "week"
                  ? "bg-orange-600 text-white shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              კვირა
            </button>
            <button
              onClick={() => setViewUnit("month")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                viewUnit === "month"
                  ? "bg-orange-600 text-white shadow-2xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              თვე
            </button>
          </div>

          {/* Mode Switcher: Schedule vs Activity */}
          <div className="hidden lg:flex items-center bg-stone-100/80 p-0.5 rounded-full text-xs font-medium">
            <button
              onClick={() => onModeChange("schedule")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                mode === "schedule" ? "bg-white text-stone-900 shadow-2xs font-semibold" : "text-stone-500"
              }`}
            >
              განრიგი
            </button>
            <button
              onClick={() => onModeChange("activity")}
              className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                mode === "activity" ? "bg-white text-stone-900 shadow-2xs font-semibold" : "text-stone-500"
              }`}
            >
              აქტივობა (ისტორია)
            </button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs font-medium bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-stone-700 focus:outline-none"
          >
            <option value="ALL">ყველა ტიპი</option>
            <option value="FEATURE">Feature</option>
            <option value="BUG">Bug</option>
            <option value="HOTFIX">Hotfix</option>
          </select>
          <button className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer">
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Timeline Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-stone-400">იტვირთება მონაცემები...</div>
        ) : dates.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">ჩანაწერები არ მოიძებნა</div>
        ) : (
          dates.map((day) => {
            const relativeLabel = getDateRelativeLabel(day.date);
            const filteredTasks =
              filterType === "ALL"
                ? day.tasks
                : day.tasks.filter((t) => t.type === filterType);

            return (
              <div key={day.date} className="relative pl-7 group">
                {/* Vertical Timeline Axis Line */}
                <div className="absolute left-2.5 top-2.5 bottom-0 w-[1.5px] bg-stone-200/90 group-last:bottom-2" />

                {/* Node Bullet Marker */}
                <div
                  className={`absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 bg-white transition-all ${
                    day.isToday
                      ? "border-orange-600 ring-3 ring-orange-100"
                      : day.isWeekend
                      ? "border-stone-300 bg-stone-100"
                      : "border-stone-400"
                  }`}
                />

                {/* Date Header Row */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-bold text-stone-900 tracking-tight">
                    {formatGeorgianDate(day.date)}
                  </span>
                  <span className="text-xs text-stone-400 font-medium">
                    {getGeorgianDayOfWeek(day.date)}
                  </span>

                  {/* Relative Badge (დღეს, ხვალ) */}
                  {relativeLabel && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        day.isToday
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-stone-200/80 text-stone-700"
                      }`}
                    >
                      • {relativeLabel}
                    </span>
                  )}

                  {/* Weekend or Holiday Indicator */}
                  {(!day.isWorking || day.isWeekend) && (
                    <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                      • {day.holidayName ? day.holidayName : "არასამუშაო დღე"}
                    </span>
                  )}
                </div>

                {/* Task Cards for this Date */}
                {mode === "schedule" ? (
                  <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <div className="text-[11px] text-stone-300 italic pl-1">
                        დაგეგმილი ტასკები არ არის
                      </div>
                    ) : (
                      filteredTasks.map((t) => {
                        const isSelected = selectedTaskId === t.id;

                        // Type badge colors
                        let typeBadgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200/60";
                        if (t.type === "BUG") {
                          typeBadgeClass = "bg-amber-50 text-amber-700 border-amber-200/60";
                        } else if (t.type === "HOTFIX") {
                          typeBadgeClass = "bg-rose-50 text-rose-700 border-rose-200/60";
                        }

                        return (
                          <div
                            key={t.id}
                            onClick={() => onSelectTask(t.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-orange-50/40 border-orange-400 ring-2 ring-orange-200/50 shadow-xs"
                                : "bg-white hover:bg-stone-50/80 border-stone-200/80 shadow-2xs hover:shadow-xs"
                            }`}
                          >
                            {/* Top row: Type badge, Title, Progress */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase ${typeBadgeClass}`}
                                >
                                  {t.type}
                                </span>
                                <h4 className="text-xs font-bold text-stone-900 truncate max-w-xs">
                                  {t.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {t.isOverdue && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                    <AlertCircle size={11} />
                                    <span>გადაცილებული</span>
                                  </span>
                                )}

                                {t.status === "DONE" && (
                                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <CheckCircle2 size={13} />
                                  </span>
                                )}

                                <div className="text-right">
                                  <span className="text-xs font-bold text-stone-800">
                                    {t.progress}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Middle progress bar */}
                            <div className="mt-2.5 w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${t.progress}%` }}
                              />
                            </div>

                            {/* Bottom row: Assignees & Deadline */}
                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-stone-500">
                              <div className="flex items-center gap-1.5">
                                {t.assignees && t.assignees.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                      {t.assignees.map((u) => (
                                        <div
                                          key={u.id}
                                          className="w-5 h-5 rounded-full bg-stone-200 border border-white flex items-center justify-center text-[9px] font-bold text-stone-700"
                                          title={u.name}
                                        >
                                          {u.avatarUrl ? (
                                            <Image
                                              src={u.avatarUrl}
                                              alt={u.name}
                                              width={20}
                                              height={20}
                                              className="w-full h-full rounded-full object-cover"
                                              unoptimized
                                            />
                                          ) : (
                                            u.name.charAt(0)
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <span className="text-stone-700 font-medium ml-1">
                                      {t.assignees.map((u) => u.name).join(", ")}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-stone-400 italic">Unassigned</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 text-stone-500">
                                <CalendarIcon size={12} className="text-stone-400" />
                                <span>
                                  დედლაინი: {formatGeorgianDateShort(t.deadline)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  // Activity Mode (Audit Events)
                  <div className="space-y-2">
                    {day.activities.length === 0 ? (
                      <div className="text-[11px] text-stone-300 italic pl-1">
                        ამ დღეს აქტივობა არ დაფიქსირებულა
                      </div>
                    ) : (
                      day.activities.map((a) => (
                        <div
                          key={a.id}
                          className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/60 text-xs"
                        >
                          <div className="flex items-center justify-between text-stone-500 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-800">
                                {a.actor?.name}
                              </span>
                              <span>•</span>
                              <span>{a.action}</span>
                            </div>
                            <span>
                              {new Date(a.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {a.reason && (
                            <div className="mt-1 text-stone-700 font-medium">{a.reason}</div>
                          )}
                          {a.task && (
                            <div
                              onClick={() => a.task?.id && onSelectTask(a.task.id)}
                              className="mt-1 text-orange-600 hover:underline cursor-pointer font-semibold text-[11px]"
                            >
                              {a.task.title}
                            </div>
                          )}
                        </div>
                      ))
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
