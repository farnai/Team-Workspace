"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Users,
  Activity,
  Layers,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
} from "lucide-react";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { formatTbilisiDateTime } from "@/lib/date";

export interface OverviewMetrics {
  activeCount: number;
  completedTodayCount: number;
  overdueCount: number;
  overdueThisMonthCount?: number;
  completedLast7Days: number;
  completedThisMonth?: number;
  pausedCount: number;
  blockedCount: number;
  dueSoonCount: number;
  activeMembersCount: number;
  monthName?: string;
}

export interface TeamMemberActivity {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: "ADMIN" | "USER";
  };
  currentWork: {
    taskId: string;
    taskNumber: number;
    title: string;
    projectName: string;
    projectColor?: string | null;
    type: string;
    priority: string;
    status: string;
    stageTitle: string | null;
    deadline: string | null;
    progress: number;
  } | null;
  nextScheduledWork: {
    taskId: string;
    taskNumber: number;
    title: string;
    stageTitle: string | null;
    startDate: string | null;
  } | null;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  reason?: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    role?: string;
  };
  task?: {
    id: string;
    taskNumber?: number;
    title: string;
    type?: string;
  } | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  color?: string | null;
  totalTasks: number;
  doneTasks: number;
  avgProgress: number;
}

interface OverviewDashboardProps {
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string | null;
  onNavigateToView?: (view: string) => void;
  refreshKey?: number;
  projects?: unknown[];
  users?: unknown[];
  onOpenNewTask?: () => void;
}

function formatAuditActionGeorgian(action: string): string {
  switch (action) {
    case "TASK_CREATED":
      return "ტასკი შეიქმნა";
    case "STATUS_CHANGED":
      return "სტატუსი შეიცვალა";
    case "DEADLINE_CHANGED":
      return "დედლაინი შეიცვალა";
    case "SCHEDULE_CHANGED":
      return "განრიგი შეიცვალა";
    case "PRIORITY_CHANGED":
      return "პრიორიტეტი შეიცვალა";
    case "WORK_PAUSED":
      return "სამუშაო შეჩერდა";
    case "WORK_RESUMED":
      return "სამუშაო განახლდა";
    case "STAGE_COMPLETED":
      return "სამუშაო ეტაპი დასრულდა";
    case "STAGE_CREATED":
      return "ახალი ეტაპი შეიქმნა";
    case "STAGE_DELETED":
      return "სამუშაო ეტაპი წაიშალა";
    case "SUBTASK_COMPLETED":
      return "საბტასკი შესრულდა";
    case "SUBTASK_DELETED":
      return "საბტასკი წაიშალა";
    case "COMMENT_ADDED":
      return "კომენტარი დაემატა";
    case "COMMENT_DELETED":
      return "კომენტარი წაიშალა";
    case "ATTACHMENT_ADDED":
      return "ფაილი აიტვირთა";
    case "DAILY_UPDATE_ADDED":
      return "დღიური ჩანაწერი დაემატა";
    case "USER_CREATED":
      return "ახალი მომხმარებელი შეიქმნა";
    case "USER_STATUS_CHANGED":
      return "მომხმარებლის სტატუსი განახლდა";
    case "TEST_CASE_CREATED":
      return "ტესტ-ქეისი დაემატა";
    case "TEST_CASE_UPDATED":
      return "ტესტ-ქეისი განახლდა";
    case "TEST_CASE_DELETED":
      return "ტესტ-ქეისი წაიშალა";
    case "TEST_RUN_RECORDED":
      return "ტესტის გაშვება დაფიქსირდა";
    default:
      return action;
  }
}

export function OverviewDashboard({
  onSelectTask,
  refreshKey = 0,
}: OverviewDashboardProps) {
  const [teamActivity, setTeamActivity] = useState<TeamMemberActivity[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localCounter, setLocalCounter] = useState(0);

  // Compact Team Activity Filter & View Mode State
  const [teamFilter, setTeamFilter] = useState<"ALL" | "ACTIVE" | "WAITING" | "FREE">("ALL");
  const [teamViewMode, setTeamViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    let active = true;

    fetch("/api/overview")
      .then((res) => {
        if (!res.ok) throw new Error("მიმოხილვის მონაცემების ჩატვირთვა ვერ მოხერხდა");
        return res.json();
      })
      .then((data) => {
        if (active) {
          if (data.teamActivity) setTeamActivity(data.teamActivity);
          if (data.recentActivities) setRecentActivities(data.recentActivities);
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
  }, [refreshKey, localCounter]);

  const handleRefresh = () => {
    setIsLoading(true);
    setLocalCounter((c) => c + 1);
  };

  // Filtered Team Members
  const filteredTeamActivity = useMemo(() => {
    return teamActivity.filter((item) => {
      if (teamFilter === "ACTIVE") return Boolean(item.currentWork);
      if (teamFilter === "WAITING") return !item.currentWork && Boolean(item.nextScheduledWork);
      if (teamFilter === "FREE") return !item.currentWork && !item.nextScheduledWork;
      return true;
    });
  }, [teamActivity, teamFilter]);

  const activeCount = useMemo(
    () => teamActivity.filter((t) => t.currentWork).length,
    [teamActivity]
  );
  const waitingCount = useMemo(
    () => teamActivity.filter((t) => !t.currentWork && t.nextScheduledWork).length,
    [teamActivity]
  );
  const freeCount = useMemo(
    () => teamActivity.filter((t) => !t.currentWork && !t.nextScheduledWork).length,
    [teamActivity]
  );

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header Banner (Compact & Sleek) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Activity size={17} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-stone-900 tracking-tight leading-tight">
              საერთო მიმოხილვა (Overview)
            </h1>
            <p className="text-[11px] text-stone-500 font-medium">
              გუნდის მიმდინარე მდგომარეობა, პასუხისმგებლობები და უახლესი აქტივობები.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="განახლება"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin text-orange-600" : ""} />
          <span className="hidden sm:inline">განახლება</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 font-medium">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Team Activity Section: "ვინ რაზე მუშაობს?" (Redesigned & Space-Efficient) */}
      <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs p-4 space-y-3">
        {/* Header Toolbar: Filters & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-orange-600" />
            <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
              ვინ რაზე მუშაობს? ({teamActivity.length})
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setTeamFilter("ALL")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                  teamFilter === "ALL"
                    ? "bg-white text-stone-900 font-bold shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                ყველა ({teamActivity.length})
              </button>
              <button
                onClick={() => setTeamFilter("ACTIVE")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                  teamFilter === "ACTIVE"
                    ? "bg-white text-emerald-800 font-bold shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                აქტიური ({activeCount})
              </button>
              <button
                onClick={() => setTeamFilter("WAITING")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                  teamFilter === "WAITING"
                    ? "bg-white text-amber-800 font-bold shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                მოლოდინში ({waitingCount})
              </button>
              <button
                onClick={() => setTeamFilter("FREE")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                  teamFilter === "FREE"
                    ? "bg-white text-stone-800 font-bold shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                თავისუფალი ({freeCount})
              </button>
            </div>

            {/* View Mode Toggle: Grid Cards vs Table */}
            <div className="inline-flex items-center p-0.5 bg-stone-100 rounded-lg text-xs">
              <button
                onClick={() => setTeamViewMode("cards")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  teamViewMode === "cards"
                    ? "bg-white text-stone-900 shadow-2xs"
                    : "text-stone-400 hover:text-stone-700"
                }`}
                title="ბარათების ხედი"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setTeamViewMode("table")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  teamViewMode === "table"
                    ? "bg-white text-stone-900 shadow-2xs"
                    : "text-stone-400 hover:text-stone-700"
                }`}
                title="ცხრილის ხედი"
              >
                <TableIcon size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Compact Responsive Cards (3 Columns on Desktop) */}
        {teamViewMode === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredTeamActivity.map((item) => (
              <div
                key={item.user.id}
                className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                  item.currentWork
                    ? "bg-white border-stone-200/90 shadow-2xs hover:border-orange-300"
                    : item.nextScheduledWork
                    ? "bg-stone-50/70 border-stone-200/80"
                    : "bg-stone-50/40 border-stone-100"
                }`}
              >
                {/* Member Header Line */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-6 h-6 rounded-full bg-orange-600 text-white font-bold text-[10px] flex items-center justify-center overflow-hidden border border-white shadow-2xs">
                        {item.user.avatarUrl ? (
                          <Image
                            src={item.user.avatarUrl}
                            alt={item.user.name}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          item.user.name.charAt(0)
                        )}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                          item.currentWork
                            ? "bg-emerald-500"
                            : item.nextScheduledWork
                            ? "bg-amber-500"
                            : "bg-stone-300"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-stone-900 text-xs leading-tight truncate">
                        {item.user.name}
                      </div>
                      <div className="text-[9.5px] text-stone-400 font-medium truncate">
                        {item.user.role === "ADMIN" ? "Admin" : "Team Member"}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  {item.currentWork ? (
                    item.currentWork.type === "QA" ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-stone-700 text-white border border-stone-700 shrink-0">
                        ტესტს აკეთებს
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                        აქტიურია
                      </span>
                    )
                  ) : item.nextScheduledWork ? (
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shrink-0">
                      მოლოდინში
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-medium bg-stone-100 text-stone-400 border border-stone-200/50 shrink-0">
                      თავისუფალი
                    </span>
                  )}
                </div>

                {/* Task Details Snippet */}
                {item.currentWork ? (
                  <div
                    onClick={() => onSelectTask(item.currentWork!.taskId)}
                    className={`mt-2 p-2 rounded-lg border transition-colors cursor-pointer space-y-1 group/task ${
                      item.currentWork.type === "QA"
                        ? "bg-stone-100/90 hover:bg-stone-200/70 border-stone-300/80"
                        : "bg-stone-50/80 hover:bg-stone-100/80 border-stone-200/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {item.currentWork.type === "QA" && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-stone-700 text-white uppercase shrink-0">
                            QA
                          </span>
                        )}
                        <span className="text-[9.5px] font-mono font-bold text-orange-600 bg-orange-50 px-1 py-0.2 rounded shrink-0">
                          #{item.currentWork.taskNumber}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400 truncate font-medium">
                        {item.currentWork.projectName}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-stone-900 group-hover/task:text-blue-600 truncate transition-colors">
                      {item.currentWork.type === "QA"
                        ? `ტესტირება: ${item.currentWork.title}`
                        : item.currentWork.title}
                    </div>

                    {item.currentWork.stageTitle && (
                      <div className="flex items-center gap-1 text-[9.5px] font-semibold text-stone-600 bg-white px-1.5 py-0.5 rounded border border-stone-200/60 truncate">
                        <Layers size={10} className="text-orange-600 shrink-0" />
                        <span className="truncate">ეტაპი: {item.currentWork.stageTitle}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-medium text-stone-500 pt-0.5">
                      <span>პროგრესი: {item.currentWork.progress}%</span>
                      {item.currentWork.deadline && (
                        <span className="text-stone-700 font-semibold flex items-center gap-0.5">
                          <Calendar size={10} className="text-stone-400" />
                          {formatGeorgianDateShort(item.currentWork.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : item.nextScheduledWork ? (
                  <div className="mt-2 p-2 bg-white/70 rounded-lg border border-stone-200/60 text-[10.5px] space-y-0.5">
                    <div className="text-[9.5px] text-amber-700 font-bold uppercase tracking-tight">
                      შემდეგი ეტაპი:
                    </div>
                    <div className="font-semibold text-stone-800 truncate">
                      #{item.nextScheduledWork.taskNumber} {item.nextScheduledWork.title}
                    </div>
                    {item.nextScheduledWork.stageTitle && (
                      <div className="text-[9.5px] text-stone-400 truncate">
                        ეტაპი: {item.nextScheduledWork.stageTitle}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 py-1 text-center text-[10.5px] text-stone-400 italic bg-stone-50/50 rounded-lg border border-dashed border-stone-200/60">
                    მიმდინარე აქტიური სამუშაო არ აქვს
                  </div>
                )}
              </div>
            ))}

            {filteredTeamActivity.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-stone-400">
                ამ ფილტრით თანამშრომლები ვერ მოიძებნა
              </div>
            )}
          </div>
        ) : (
          /* View Mode 2: Compact Table View */
          <div className="overflow-x-auto rounded-xl border border-stone-200/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/90 text-stone-600 font-extrabold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-3">თანამშრომელი</th>
                  <th className="py-2 px-3">სტატუსი</th>
                  <th className="py-2 px-3">მიმდინარე დავალება</th>
                  <th className="py-2 px-3">პროექტი / ეტაპი</th>
                  <th className="py-2 px-3">პროგრესი</th>
                  <th className="py-2 px-3">დედლაინი</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {filteredTeamActivity.map((item) => (
                  <tr
                    key={item.user.id}
                    onClick={() => {
                      if (item.currentWork) onSelectTask(item.currentWork.taskId);
                    }}
                    className={`transition-colors ${
                      item.currentWork
                        ? "hover:bg-blue-50/40 cursor-pointer"
                        : "hover:bg-stone-50/60"
                    }`}
                  >
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-orange-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                          {item.user.name.charAt(0)}
                        </div>
                        <span className="font-bold text-stone-900">{item.user.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {item.currentWork ? (
                        item.currentWork.type === "QA" ? (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-stone-700 text-white">
                            ტესტს აკეთებს
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            აქტიური
                          </span>
                        )
                      ) : item.nextScheduledWork ? (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                          მოლოდინში
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-stone-100 text-stone-400">
                          თავისუფალი
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 max-w-xs truncate font-semibold text-stone-800">
                      {item.currentWork ? (
                        <span className="inline-flex items-center gap-1">
                          {item.currentWork.type === "QA" && (
                            <span className="text-[9px] font-black px-1 py-0.2 rounded bg-stone-700 text-white uppercase">
                              QA
                            </span>
                          )}
                          <span className="font-mono text-orange-600 font-bold">
                            #{item.currentWork.taskNumber}
                          </span>
                          <span>{item.currentWork.title}</span>
                        </span>
                      ) : item.nextScheduledWork ? (
                        <span className="text-stone-500 italic">
                          #{item.nextScheduledWork.taskNumber} {item.nextScheduledWork.title}
                        </span>
                      ) : (
                        <span className="text-stone-300 italic">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-stone-500">
                      {item.currentWork ? (
                        <span className="truncate">
                          {item.currentWork.projectName}
                          {item.currentWork.stageTitle ? ` (${item.currentWork.stageTitle})` : ""}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-bold text-stone-700">
                      {item.currentWork ? `${item.currentWork.progress}%` : "—"}
                    </td>
                    <td className="py-2 px-3 text-stone-600">
                      {item.currentWork?.deadline ? (
                        formatGeorgianDateShort(item.currentWork.deadline)
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Recent Activity Feed */}
      <div>
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-orange-600" />
              <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                ბოლო მოვლენები (Real Activity)
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-400">აუდიტის ჟურნალიდან</span>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">
                აქტივობა არ არის
              </div>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-2 bg-stone-50/60 rounded-lg border border-stone-200/70 text-xs flex items-start gap-2 hover:bg-stone-50 transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                    {act.actor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-stone-900 truncate text-[11px]">
                        {act.actor.name}
                      </span>
                      <span className="text-[9.5px] text-stone-400 shrink-0 font-medium">
                        {formatTbilisiDateTime(act.createdAt)}
                      </span>
                    </div>
                    <div className="font-semibold text-stone-700 mt-0.5 flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="px-1.5 py-0.2 rounded bg-white text-[9.5px] border border-stone-200 font-bold">
                        {formatAuditActionGeorgian(act.action)}
                      </span>
                      {act.task && (
                        <button
                          onClick={() => onSelectTask(act.task!.id)}
                          className="text-orange-600 hover:text-orange-700 font-bold truncate cursor-pointer text-[11px]"
                        >
                          #{act.task.taskNumber} {act.task.title}
                        </button>
                      )}
                    </div>
                    {act.reason &&
                      act.reason.trim() !== formatAuditActionGeorgian(act.action).trim() && (
                        <div className="text-[9.5px] text-stone-500 mt-0.5 italic bg-white/70 p-1 rounded">
                          {["WORK_PAUSED", "STATUS_CHANGED", "DEADLINE_CHANGED", "SCHEDULE_CHANGED", "TASK_DELETED"].includes(act.action)
                            ? `მიზეზი: ${act.reason}`
                            : act.reason}
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
