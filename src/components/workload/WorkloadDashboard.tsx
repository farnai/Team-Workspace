"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Users,
  AlertTriangle,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Calendar as CalendarIcon,
  Pause,
  Ban,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

export interface WorkloadAssignment {
  id: string;
  taskNumber: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  userState: "ACTIVE" | "WAITING" | "PAUSED" | "BLOCKED" | "OVERDUE" | "PLANNED" | "DONE";
  deadline: string | null;
  isOverdue: boolean;
}

export interface WorkloadDayCell {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isWorking: boolean;
  holidayName: string | null;
  isToday: boolean;
  assignments: WorkloadAssignment[];
  hasConflict: boolean;
  conflictMessage: string | null;
}

export interface UserWorkloadItem {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "ADMIN" | "USER";
  };
  stats: {
    activeCount: number;
    queuedCount: number;
    pausedCount: number;
    blockedCount: number;
    overdueCount: number;
    plannedCount: number;
    completedCount: number;
    activeSubtasksCount: number;
    completedSubtasksCount: number;
    upcomingDeadlinesCount: number;
    hasOverlapWarning: boolean;
  };
  upcomingDeadlines: {
    id: string;
    taskNumber: number;
    title: string;
    deadline: string | null;
    priority: string;
    type: string;
  }[];
  dateGrid: WorkloadDayCell[];
}

export interface WorkloadConflict {
  type: string;
  severity: "warning" | "critical";
  message: string;
  taskId?: string;
  taskTitle?: string;
  stageId?: string;
  stageTitle?: string;
  userId?: string;
  userName?: string;
  dateStr?: string;
}

interface WorkloadDashboardProps {
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string | null;
  projects?: { id: string; name: string }[];
  users?: { id: string; name: string }[];
  refreshKey?: number;
}

export function WorkloadDashboard({
  onSelectTask,
  selectedTaskId,
  projects = [],
  users = [],
  refreshKey = 0,
}: WorkloadDashboardProps) {
  const [daysPeriod, setDaysPeriod] = useState<7 | 14>(7);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [selectedUserId, setSelectedUserId] = useState<string>("ALL");
  const [startDateOffset, setStartDateOffset] = useState<number>(0);

  const [workloads, setWorkloads] = useState<UserWorkloadItem[]>([]);
  const [conflicts, setConflicts] = useState<WorkloadConflict[]>([]);
  const [dateHeaders, setDateHeaders] = useState<
    {
      date: string;
      dayOfWeek: number;
      isWeekend: boolean;
      isWorking: boolean;
      holidayName: string | null;
      isToday: boolean;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshCounter, setLocalRefreshCounter] = useState(0);

  // Fetch Workload Data inside Effect with cancellation support
  useEffect(() => {
    let active = true;

    const today = new Date();
    today.setDate(today.getDate() + startDateOffset);
    const startStr = today.toISOString().split("T")[0];

    const endDay = new Date(today);
    endDay.setDate(endDay.getDate() + daysPeriod - 1);
    const endStr = endDay.toISOString().split("T")[0];

    let url = `/api/workload?startDate=${startStr}&endDate=${endStr}&days=${daysPeriod}`;
    if (selectedProjectId !== "ALL") url += `&projectId=${selectedProjectId}`;
    if (selectedUserId !== "ALL") url += `&userId=${selectedUserId}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("დატვირთვის მონაცემების ჩატვირთვა ვერ მოხერხდა");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setWorkloads(data.workloads || []);
          setConflicts(data.conflicts || []);
          setDateHeaders(data.dates || []);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [daysPeriod, selectedProjectId, selectedUserId, startDateOffset, refreshKey, localRefreshCounter]);

  const handleManualRefresh = () => {
    setIsLoading(true);
    setLocalRefreshCounter((c) => c + 1);
  };

  // Overall Team Summary Totals
  const teamTotals = workloads.reduce(
    (acc, w) => {
      acc.totalActive += w.stats.activeCount;
      acc.totalQueued += w.stats.queuedCount;
      acc.totalPaused += w.stats.pausedCount;
      acc.totalBlocked += w.stats.blockedCount;
      acc.totalOverdue += w.stats.overdueCount;
      acc.totalSubtasks += w.stats.activeSubtasksCount;
      return acc;
    },
    {
      totalActive: 0,
      totalQueued: 0,
      totalPaused: 0,
      totalBlocked: 0,
      totalOverdue: 0,
      totalSubtasks: 0,
    }
  );

  const getGeorgianDayName = (dayOfWeek: number) => {
    const days = [
      "კვირა",
      "ორშაბათი",
      "სამშაბათი",
      "ოთხშაბათი",
      "ხუთშაბათი",
      "პარასკევი",
      "შაბათი",
    ];
    return days[dayOfWeek];
  };

  const getAssignmentBadgeClass = (state: WorkloadAssignment["userState"]) => {
    switch (state) {
      case "ACTIVE":
        return "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100";
      case "WAITING":
        return "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200";
      case "PAUSED":
        return "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100";
      case "BLOCKED":
        return "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100";
      case "OVERDUE":
        return "bg-rose-100 text-rose-900 border-rose-400 font-black";
      case "DONE":
        return "bg-stone-50 text-stone-400 border-stone-200 line-through";
      case "PLANNED":
        return "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  const getUserStateLabel = (state: WorkloadAssignment["userState"]) => {
    switch (state) {
      case "ACTIVE":
        return "აქტიური";
      case "WAITING":
        return "მოლოდინში";
      case "PAUSED":
        return "შეჩერებული";
      case "BLOCKED":
        return "დაბლოკილი";
      case "OVERDUE":
        return "გადაცილებული";
      case "DONE":
        return "დასრულებული";
      case "PLANNED":
        return "დაგეგმილი";
    }
  };

  return (
    <div className="w-full bg-[#F8F7F4] p-4 sm:p-6 space-y-6 text-stone-900 pb-16">
      {/* 1. Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold shadow-2xs">
              <Users size={16} />
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-stone-900">
              გუნდის დატვირთვა & განრიგი
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            გუნდის წევრების რეალური დავალებები, ეტაპების მოლოდინის სტატუსი და განრიგის
            კონფლიქტები.
          </p>
        </div>

        {/* Filter & Period Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period Toggle: 7 vs 14 days */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setDaysPeriod(7)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                daysPeriod === 7
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              7 დღე
            </button>
            <button
              onClick={() => setDaysPeriod(14)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                daysPeriod === 14
                  ? "bg-white text-stone-900 shadow-2xs font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              14 დღე
            </button>
          </div>

          {/* Date Offset Buttons */}
          <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl">
            <button
              onClick={() => setStartDateOffset((prev) => prev - daysPeriod)}
              className="p-1 hover:bg-white rounded-lg text-stone-600 transition-colors cursor-pointer"
              title="წინა პერიოდი"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setStartDateOffset(0)}
              className="px-2 py-0.5 text-xs font-bold text-stone-700 hover:bg-white rounded-lg cursor-pointer"
            >
              დღეს
            </button>
            <button
              onClick={() => setStartDateOffset((prev) => prev + daysPeriod)}
              className="p-1 hover:bg-white rounded-lg text-stone-600 transition-colors cursor-pointer"
              title="შემდეგი პერიოდი"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-2.5 py-1 text-xs">
            <Filter size={12} className="text-stone-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent font-medium text-stone-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ყველა პროექტი</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl px-2.5 py-1 text-xs">
            <Users size={12} className="text-stone-400" />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-transparent font-medium text-stone-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ყველა წევრი</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors cursor-pointer"
            title="განახლება"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 2. Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
            <span>აქტიური ტასკები</span>
            <CheckCircle2 size={13} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-stone-900">
            {teamTotals.totalActive}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            შესრულების პროცესში
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500 text-[10px] font-bold uppercase tracking-wider">
            <span>მოლოდინში (ეტაპები)</span>
            <Clock size={13} className="text-stone-500" />
          </div>
          <div className="text-xl font-black text-stone-800">
            {teamTotals.totalQueued}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            რიგში მყოფი ეტაპები
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-700 text-[10px] font-bold uppercase tracking-wider">
            <span>შეჩერებული</span>
            <Pause size={13} className="text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700">
            {teamTotals.totalPaused}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            დროებით შეჩერებული
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 text-[10px] font-bold uppercase tracking-wider">
            <span>დაბლოკილი</span>
            <Ban size={13} className="text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-700">
            {teamTotals.totalBlocked}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            დაბრკოლების გამო
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-700 text-[10px] font-bold uppercase tracking-wider">
            <span>გადაცილებული</span>
            <AlertCircle size={13} className="text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-800">
            {teamTotals.totalOverdue}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            ვადაგასული დედლაინი
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-600 text-[10px] font-bold uppercase tracking-wider">
            <span>საბტასკები</span>
            <Layers size={13} className="text-orange-600" />
          </div>
          <div className="text-xl font-black text-stone-900">
            {teamTotals.totalSubtasks}
          </div>
          <div className="text-[10px] text-stone-400 font-semibold">
            დანიშნული ქვედავალებები
          </div>
        </div>
      </div>

      {/* 3. Global Conflicts Panel */}
      {conflicts.length > 0 && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-2 text-amber-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-xs text-amber-900 uppercase tracking-wider">
              <AlertTriangle size={15} className="text-amber-600" />
              <span>განრიგის ფაქტობრივი გაფრთხილებები ({conflicts.length})</span>
            </div>
            <span className="text-[10px] text-amber-700 font-semibold">
              ავტომატური ცვლილებების გარეშე
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {conflicts.slice(0, 6).map((c, i) => (
              <div
                key={i}
                className="p-2.5 bg-white rounded-xl border border-amber-200/70 text-xs flex items-start justify-between gap-2 shadow-2xs"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-stone-900 leading-snug">
                    {c.message}
                  </div>
                  {c.dateStr && (
                    <div className="text-[10px] text-stone-400 font-medium">
                      თარიღი: {c.dateStr}
                    </div>
                  )}
                </div>
                {c.taskId && (
                  <button
                    onClick={() => onSelectTask(c.taskId!)}
                    className="p-1 hover:bg-orange-50 text-orange-600 rounded-lg shrink-0 cursor-pointer"
                    title="დავალების გახსნა"
                  >
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2 font-medium">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Desktop & Tablet Workload Matrix Grid (Calendar View) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden flex flex-col">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-orange-600" />
            <h3 className="font-extrabold text-stone-900 text-xs uppercase tracking-wider">
              დატვირთვის კალენდარული მატრიცა ({daysPeriod} დღე)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-stone-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>აქტიური</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
              <span>მოლოდინში</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>შეჩერებული</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>დაბლოკილი</span>
            </span>
          </div>
        </div>

        {/* Scrollable Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[768px]">
            {/* Header Row: Dates */}
            <thead>
              <tr className="bg-stone-50/70 border-b border-stone-200">
                <th className="p-3 font-extrabold text-stone-700 w-48 sticky left-0 bg-stone-50/95 z-10 border-r border-stone-200/80">
                  გუნდის წევრი
                </th>
                {dateHeaders.map((dh) => (
                  <th
                    key={dh.date}
                    className={`p-2.5 font-bold text-center border-r border-stone-200/70 ${
                      dh.isWeekend || !dh.isWorking
                        ? "bg-stone-100/60"
                        : dh.isToday
                        ? "bg-orange-50/40 text-orange-800"
                        : "text-stone-700"
                    }`}
                  >
                    <div className="text-[10px] text-stone-400 font-semibold uppercase">
                      {getGeorgianDayName(dh.dayOfWeek)}
                    </div>
                    <div className="font-black text-xs text-stone-900 mt-0.5">
                      {dh.date.substring(5)}
                    </div>
                    {dh.holidayName && (
                      <div
                        className="text-[9px] text-amber-800 bg-amber-100 rounded px-1 py-0.2 mt-0.5 truncate max-w-[85px] mx-auto"
                        title={dh.holidayName}
                      >
                        {dh.holidayName}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body: User Rows */}
            <tbody className="divide-y divide-stone-100">
              {isLoading && workloads.length === 0 ? (
                <tr>
                  <td
                    colSpan={dateHeaders.length + 1}
                    className="p-12 text-center text-xs text-stone-400"
                  >
                    იტვირთება დატვირთვის მონაცემები...
                  </td>
                </tr>
              ) : workloads.length === 0 ? (
                <tr>
                  <td
                    colSpan={dateHeaders.length + 1}
                    className="p-12 text-center text-xs text-stone-400"
                  >
                    მონაცემები არ მოიძებნა
                  </td>
                </tr>
              ) : (
                workloads.map((item) => (
                  <tr key={item.user.id} className="hover:bg-stone-50/50 transition-colors">
                    {/* User Column */}
                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-stone-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center shrink-0 border border-white shadow-2xs">
                          {item.user.avatarUrl ? (
                            <Image
                              src={item.user.avatarUrl}
                              alt={item.user.name}
                              width={32}
                              height={32}
                              className="w-full h-full rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            item.user.name.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-stone-900 text-xs truncate">
                            {item.user.name}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-0.5 font-medium">
                            <span>აქტიური: {item.stats.activeCount}</span>
                            <span>•</span>
                            <span>რიგში: {item.stats.queuedCount}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {item.dateGrid.map((cell) => (
                      <td
                        key={cell.date}
                        className={`p-2 border-r border-stone-100 align-top transition-colors ${
                          cell.isWeekend || !cell.isWorking
                            ? "bg-stone-50/40"
                            : cell.isToday
                            ? "bg-orange-50/15"
                            : ""
                        }`}
                      >
                        <div className="space-y-1.5 min-h-[48px]">
                          {/* Overlap Conflict Pill */}
                          {cell.hasConflict && (
                            <div
                              className="px-1.5 py-0.5 bg-amber-100/90 border border-amber-300 text-amber-900 text-[9px] font-bold rounded flex items-center gap-1 shadow-2xs"
                              title={cell.conflictMessage || "პარალელური დავალებები"}
                            >
                              <AlertTriangle size={10} className="shrink-0 text-amber-600" />
                              <span className="truncate">პარალელური ({cell.assignments.length})</span>
                            </div>
                          )}

                          {/* Task Chips */}
                          {cell.assignments.map((task) => {
                            const isSelected = selectedTaskId === task.id;
                            return (
                              <div
                                key={`${task.id}-${cell.date}`}
                                onClick={() => onSelectTask(task.id)}
                                className={`p-1.5 rounded-lg border text-[10px] cursor-pointer transition-all shadow-2xs ${
                                  isSelected ? "ring-2 ring-orange-500 font-extrabold" : ""
                                } ${getAssignmentBadgeClass(
                                  task.userState
                                )}`}
                                title={`#${task.taskNumber} ${task.title} • სტატუსი: ${getUserStateLabel(
                                  task.userState
                                )}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono font-bold shrink-0">
                                    #{task.taskNumber}
                                  </span>
                                  <span className="text-[8px] font-black uppercase px-1 rounded bg-white/70">
                                    {getUserStateLabel(task.userState)}
                                  </span>
                                </div>
                                <div className="font-bold truncate mt-0.5">
                                  {task.title}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Mobile & Compact View: User Cards (for 390px / 320px) */}
      <div className="lg:hidden space-y-4">
        <h3 className="font-extrabold text-stone-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Users size={14} className="text-orange-600" />
          <span>გუნდის წევრების დატვირთვის ბარათები</span>
        </h3>

        {workloads.map((item) => (
          <div
            key={item.user.id}
            className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-3"
          >
            {/* User header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-black text-xs flex items-center justify-center">
                  {item.user.name.charAt(0)}
                </div>
                <div>
                  <div className="font-extrabold text-stone-900 text-xs">
                    {item.user.name}
                  </div>
                  <div className="text-[10px] text-stone-400 font-medium">
                    {item.user.email}
                  </div>
                </div>
              </div>
              {item.stats.hasOverlapWarning && (
                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                  გადაკვეთა
                </span>
              )}
            </div>

            {/* Metric Chips */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-[10px] text-emerald-800 font-bold block">აქტიური</span>
                <span className="text-sm font-black text-emerald-900">
                  {item.stats.activeCount}
                </span>
              </div>
              <div className="p-2 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[10px] text-stone-600 font-bold block">მოლოდინში</span>
                <span className="text-sm font-black text-stone-900">
                  {item.stats.queuedCount}
                </span>
              </div>
              <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-[10px] text-amber-800 font-bold block">შეჩერებული</span>
                <span className="text-sm font-black text-amber-900">
                  {item.stats.pausedCount}
                </span>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            {item.upcomingDeadlines.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-stone-400 block uppercase">
                  უახლოესი დედლაინები ({item.upcomingDeadlines.length}):
                </span>
                {item.upcomingDeadlines.slice(0, 3).map((ud) => (
                  <div
                    key={ud.id}
                    onClick={() => onSelectTask(ud.id)}
                    className={`p-2 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      selectedTaskId === ud.id
                        ? "bg-orange-50 border-orange-300 ring-2 ring-orange-500 font-extrabold"
                        : "bg-stone-50 hover:bg-orange-50/50 border-stone-200/70"
                    }`}
                  >
                    <span className="font-bold text-stone-900 truncate">
                      #{ud.taskNumber} {ud.title}
                    </span>
                    <span className="text-[10px] font-bold text-orange-600 shrink-0">
                      {formatGeorgianDateShort(ud.deadline)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
