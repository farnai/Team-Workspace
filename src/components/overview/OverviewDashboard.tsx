"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Pause,
  Ban,
  Users,
  Activity,
  Layers,
  RefreshCw,
  Folder,
} from "lucide-react";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

export interface OverviewMetrics {
  activeCount: number;
  completedTodayCount: number;
  overdueCount: number;
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
    case "SUBTASK_COMPLETED":
      return "საბტასკი შესრულდა";
    case "COMMENT_ADDED":
      return "კომენტარი დაემატა";
    case "ATTACHMENT_ADDED":
      return "ფაილი აიტვირთა";
    case "DAILY_UPDATE_ADDED":
      return "დღიური ჩანაწერი დაემატა";
    case "USER_CREATED":
      return "ახალი მომხმარებელი შეიქმნა";
    case "USER_STATUS_CHANGED":
      return "მომხმარებლის სტატუსი განახლდა";
    default:
      return action;
  }
}

export function OverviewDashboard({
  onSelectTask,
  onNavigateToView,
  refreshKey = 0,
}: OverviewDashboardProps) {
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    activeCount: 0,
    completedTodayCount: 0,
    overdueCount: 0,
    completedLast7Days: 0,
    pausedCount: 0,
    blockedCount: 0,
    dueSoonCount: 0,
    activeMembersCount: 0,
  });

  const [teamActivity, setTeamActivity] = useState<TeamMemberActivity[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localCounter, setLocalCounter] = useState(0);

  useEffect(() => {
    let active = true;

    fetch("/api/overview")
      .then((res) => {
        if (!res.ok) throw new Error("მიმოხილვის მონაცემების ჩატვირთვა ვერ მოხერხდა");
        return res.json();
      })
      .then((data) => {
        if (active) {
          if (data.metrics) setMetrics(data.metrics);
          if (data.teamActivity) setTeamActivity(data.teamActivity);
          if (data.projects) setProjects(data.projects);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              საერთო მიმოხილვა (Overview)
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              გუნდის მიმდინარე მდგომარეობა, პასუხისმგებლობები და უახლესი აქტივობები.
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="განახლება"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin text-orange-600" : ""} />
          <span className="hidden sm:inline">განახლება</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2 font-medium">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Key Operational Metrics Grid (Clickable) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Tasks */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("backlog")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-emerald-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
              აქტიური ტასკები (თვეში)
            </span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {metrics.activeCount}
            </span>
            <span className="text-[10px] text-stone-400 font-semibold">{metrics.monthName || "მიმდინარე თვე"}</span>
          </div>
        </div>

        {/* Completed Today (Tbilisi Timezone) */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("timeline")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-emerald-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              დღეს დასრულებული
            </span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">
              {metrics.completedTodayCount}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">Asia/Tbilisi</span>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("workload")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-rose-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
              გადაცილებული (თვეში)
            </span>
            <AlertCircle size={16} className="text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${metrics.overdueCount > 0 ? "text-rose-600" : "text-stone-900"}`}>
              {metrics.overdueCount}
            </span>
            <span className="text-[10px] text-rose-500 font-semibold">მიმდინარე თვე</span>
          </div>
        </div>

        {/* Paused Tasks */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("workload")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-amber-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              შეჩერებული
            </span>
            <Pause size={16} className="text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700">
              {metrics.pausedCount}
            </span>
            <span className="text-[10px] text-amber-600 font-semibold">დროებით</span>
          </div>
        </div>

        {/* Blocked Tasks */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("workload")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-rose-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">
              დაბლოკილი
            </span>
            <Ban size={16} className="text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700">
              {metrics.blockedCount}
            </span>
            <span className="text-[10px] text-rose-500 font-semibold">დაბრკოლებით</span>
          </div>
        </div>

        {/* Due Soon (7 Days) */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("timeline")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-blue-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-blue-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              უახლოესი დედლაინები
            </span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-900">
              {metrics.dueSoonCount}
            </span>
            <span className="text-[10px] text-blue-600 font-semibold">შემდეგ 7 დღეში</span>
          </div>
        </div>

        {/* Active Team Members */}
        <div
          onClick={() => onNavigateToView && onNavigateToView("workload")}
          className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-orange-300 transition-all cursor-pointer group col-span-2 sm:col-span-1 lg:col-span-2"
        >
          <div className="flex items-center justify-between text-stone-400 group-hover:text-orange-600 transition-colors">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-800">
              აქტიური შემსრულებლები
            </span>
            <Users size={16} className="text-orange-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {metrics.activeMembersCount} / {teamActivity.length}
            </span>
            <span className="text-[10px] text-stone-500 font-semibold">გუნდის წევრი მუშაობს</span>
          </div>
        </div>
      </div>

      {/* 3. Team Activity Section: "ვინ რაზე მუშაობს?" (Sequential Workflow Aware) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-orange-600" />
            <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
              ვინ რაზე მუშაობს? (გუნდის მიმდინარე აქტივობა)
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-stone-400">
            მიმდინარე ეტაპის შესაბამისად
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {teamActivity.map((item) => (
            <div
              key={item.user.id}
              className="p-3.5 bg-stone-50/70 hover:bg-stone-50 rounded-2xl border border-stone-200/80 transition-all space-y-2.5"
            >
              {/* Member Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white font-bold text-xs flex items-center justify-center overflow-hidden border border-white shadow-2xs shrink-0">
                    {item.user.avatarUrl ? (
                      <Image
                        src={item.user.avatarUrl}
                        alt={item.user.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      item.user.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="font-extrabold text-stone-900 text-xs leading-tight">
                      {item.user.name}
                    </div>
                    <div className="text-[10px] text-stone-400 font-medium">
                      {item.user.role === "ADMIN" ? "Admin" : "Team Member"}
                    </div>
                  </div>
                </div>

                {item.currentWork ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    აქტიურია
                  </span>
                ) : item.nextScheduledWork ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-700">
                    მოლოდინში
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-400">
                    თავისუფალი
                  </span>
                )}
              </div>

              {/* Current Active Work Card */}
              {item.currentWork ? (
                <div
                  onClick={() => onSelectTask(item.currentWork!.taskId)}
                  className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs hover:border-orange-300 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.2 rounded">
                      #{item.currentWork.taskNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-400 truncate max-w-[120px]">
                      {item.currentWork.projectName}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-stone-900 truncate">
                    {item.currentWork.title}
                  </div>

                  {item.currentWork.stageTitle && (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-stone-700 bg-stone-100/90 px-2 py-0.5 rounded-md">
                      <Layers size={11} className="text-orange-600" />
                      <span className="truncate">ეტაპი: {item.currentWork.stageTitle}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-semibold text-stone-500 pt-1">
                    <span>პროგრესი: {item.currentWork.progress}%</span>
                    {item.currentWork.deadline && (
                      <span className="text-orange-700 font-bold">
                        ვადა: {formatGeorgianDateShort(item.currentWork.deadline)}
                      </span>
                    )}
                  </div>
                </div>
              ) : item.nextScheduledWork ? (
                <div className="p-2.5 bg-white/70 rounded-xl border border-stone-200/60 text-xs space-y-1">
                  <div className="text-[10px] text-stone-400 font-bold uppercase">
                    მოლოდინში (შემდეგი ეტაპი):
                  </div>
                  <div className="font-semibold text-stone-700 truncate">
                    #{item.nextScheduledWork.taskNumber} {item.nextScheduledWork.title}
                  </div>
                  {item.nextScheduledWork.stageTitle && (
                    <div className="text-[10px] text-stone-500">
                      ეტაპი: {item.nextScheduledWork.stageTitle}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 text-center text-xs text-stone-400 italic">
                  მიმდინარე აქტიური სამუშაო არ აქვს
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Bottom Grid: Projects Health & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Projects Summary */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Folder size={18} className="text-orange-600" />
              <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                პროექტების მიმდინარეობა ({projects.length})
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">
                პროექტები არ არის
              </div>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-stone-900">{p.name}</span>
                    <span className="text-[11px] font-bold text-stone-500">
                      {p.doneTasks}/{p.totalTasks} დასრულებული
                    </span>
                  </div>

                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${p.avgProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-400 font-semibold">
                    <span>საშუალო პროგრესი</span>
                    <span className="text-emerald-700 font-bold">{p.avgProgress}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-orange-600" />
              <h2 className="text-xs font-black text-stone-900 uppercase tracking-wider">
                ბოლო მოვლენები (Real Activity)
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-400">აუდიტის ჟურნალიდან</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400">
                აქტივობა არ არის
              </div>
            ) : (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 bg-stone-50/60 rounded-xl border border-stone-200/70 text-xs flex items-start gap-2.5 hover:bg-stone-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {act.actor.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-stone-900 truncate">
                        {act.actor.name}
                      </span>
                      <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                        {formatGeorgianDateShort(act.createdAt)}
                      </span>
                    </div>
                    <div className="font-semibold text-stone-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded bg-white text-[10px] border border-stone-200 font-bold">
                        {formatAuditActionGeorgian(act.action)}
                      </span>
                      {act.task && (
                        <button
                          onClick={() => onSelectTask(act.task!.id)}
                          className="text-orange-600 hover:text-orange-700 font-bold truncate cursor-pointer"
                        >
                          #{act.task.taskNumber} {act.task.title}
                        </button>
                      )}
                    </div>
                    {act.reason && (
                      <div className="text-[10px] text-stone-500 mt-1 italic bg-white/70 p-1 rounded">
                        მიზეზი: {act.reason}
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
