"use client";

import React, { useState, useEffect } from "react";
import {
  UserCheck,
  AlertCircle,
  Clock,
  Layers,
  CheckCircle2,
  Pause,
  Calendar,
  RefreshCw,
  ChevronRight,
  Check,
} from "lucide-react";
import { formatGeorgianDateShort, isTaskOverdue } from "@/lib/dateUtils";

interface TaskSummary {
  id: string;
  taskNumber: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  progress: number;
  startDate: string | null;
  deadline: string | null;
  project: { id: string; name: string; color?: string | null };
  stages?: {
    id: string;
    title: string;
    position: number;
    isActive: boolean;
    isCompleted: boolean;
    assignments: { user: { id: string; name: string } }[];
  }[];
  subtasks?: {
    id: string;
    title: string;
    status: string;
    assignments: { user: { id: string; name: string } }[];
  }[];
}

interface MyWorkData {
  groups: {
    needsAttention: TaskSummary[];
    inProgress: TaskSummary[];
    waiting: TaskSummary[];
    planned: TaskSummary[];
    paused: TaskSummary[];
    blocked: TaskSummary[];
    completed: TaskSummary[];
  };
  counts: {
    total: number;
    needsAttention: number;
    inProgress: number;
    waiting: number;
    planned: number;
    paused: number;
    blocked: number;
    completed: number;
  };
}

interface MyWorkDashboardProps {
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string | null;
  currentUserId: string;
  refreshKey?: number;
}

type WorkTab =
  | "all"
  | "needsAttention"
  | "inProgress"
  | "waiting"
  | "planned"
  | "paused"
  | "blocked"
  | "completed";

export function MyWorkDashboard({
  onSelectTask,
  currentUserId,
  refreshKey = 0,
}: MyWorkDashboardProps) {
  const [data, setData] = useState<MyWorkData | null>(null);
  const [activeTab, setActiveTab] = useState<WorkTab>("inProgress");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localCounter, setLocalCounter] = useState(0);

  useEffect(() => {
    let active = true;

    fetch("/api/my-work")
      .then((res) => {
        if (!res.ok) throw new Error("ჩემი სამუშაოების ჩატვირთვა ვერ მოხერხდა");
        return res.json();
      })
      .then((d) => {
        if (active) {
          setData(d);
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

  const counts = data?.counts || {
    total: 0,
    needsAttention: 0,
    inProgress: 0,
    waiting: 0,
    planned: 0,
    paused: 0,
    blocked: 0,
    completed: 0,
  };

  const renderTaskCard = (task: TaskSummary, categoryNote?: string) => {
    const isOverdue = isTaskOverdue(task.deadline, task.status);

    // Active stage
    const activeStage = task.stages?.find((s) => s.isActive && !s.isCompleted);
    // User stage
    const userStage = task.stages?.find((s) =>
      s.assignments.some((a) => a.user.id === currentUserId)
    );

    return (
      <div
        key={task.id}
        onClick={() => onSelectTask(task.id)}
        className="p-4 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-orange-300 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
      >
        <div className="space-y-2">
          {/* Top badges row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-black text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                #{task.taskNumber}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {task.project.name}
              </span>

              {task.priority === "CRITICAL" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  კრიტიკული
                </span>
              )}
              {task.priority === "HIGH" && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  მაღალი
                </span>
              )}
            </div>

            {/* Status / Category tag */}
            {categoryNote && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
                {categoryNote}
              </span>
            )}
            {task.status === "DONE" && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                დასრულებული
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-extrabold text-stone-900 leading-snug group-hover:text-orange-600 transition-colors">
            {task.title}
          </h3>

          {/* Workflow Stage Awareness Info */}
          {userStage && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-50 p-2 rounded-xl border border-stone-200/60">
              <Layers size={13} className="text-orange-600 shrink-0" />
              <span className="truncate">
                ჩემი ეტაპი: <strong className="text-stone-900">{userStage.title}</strong>
                {userStage.isCompleted
                  ? " (დასრულებულია)"
                  : userStage.isActive
                  ? " (მიმდინარეობს)"
                  : " (მოლოდინში)"}
              </span>
            </div>
          )}

          {/* Active Stage (if not user's own) */}
          {!userStage && activeStage && (
            <div className="flex items-center gap-1 text-[11px] text-stone-500">
              <Layers size={12} className="text-stone-400" />
              <span>აქტიური ეტაპი: {activeStage.title}</span>
            </div>
          )}
        </div>

        {/* Bottom row: Progress, Deadline, Action */}
        <div className="pt-2 border-t border-stone-100 space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500 font-semibold">
            <span>პროგრესი: {task.progress}%</span>
            {task.deadline && (
              <span
                className={`flex items-center gap-1 font-bold ${
                  isOverdue ? "text-rose-600" : "text-stone-700"
                }`}
              >
                <Clock size={12} />
                <span>{formatGeorgianDateShort(task.deadline)}</span>
                {isOverdue && <span className="text-[9px] uppercase">(ვადაგასული)</span>}
              </span>
            )}
          </div>

          <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                task.status === "DONE"
                  ? "bg-emerald-500"
                  : isOverdue
                  ? "bg-rose-500"
                  : "bg-orange-500"
              }`}
              style={{ width: `${task.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-end text-[11px] font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform">
            <span>დეტალების გახსნა</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>
    );
  };

  const getFilteredTasks = () => {
    if (!data) return [];
    const g = data.groups;
    switch (activeTab) {
      case "needsAttention":
        return g.needsAttention;
      case "inProgress":
        return g.inProgress;
      case "waiting":
        return g.waiting;
      case "planned":
        return g.planned;
      case "paused":
        return g.paused;
      case "blocked":
        return g.blocked;
      case "completed":
        return g.completed;
      case "all":
      default:
        // Combine distinct
        const map = new Map<string, TaskSummary>();
        Object.values(g).forEach((list) => list.forEach((t) => map.set(t.id, t)));
        return Array.from(map.values());
    }
  };

  const filteredTasks = getFilteredTasks();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
            <UserCheck size={20} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              ჩემი სამუშაოები (My Work)
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              თქვენზე დაკისრებული დავალებები, სამუშაო ეტაპები და პასუხისმგებლობები.
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

      {/* 2. Categorized Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold select-none">
        <button
          onClick={() => setActiveTab("inProgress")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "inProgress"
              ? "bg-orange-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <CheckCircle2 size={14} />
          <span>მუშაობაში</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "inProgress" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.inProgress}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("needsAttention")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "needsAttention"
              ? "bg-rose-600 text-white shadow-2xs"
              : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
          }`}
        >
          <AlertCircle size={14} />
          <span>ყურადღება</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "needsAttention" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
            }`}
          >
            {counts.needsAttention}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("waiting")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "waiting"
              ? "bg-stone-800 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Layers size={14} />
          <span>მოლოდინში (ეტაპები)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "waiting" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.waiting}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("planned")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "planned"
              ? "bg-blue-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Calendar size={14} />
          <span>დაგეგმილი</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "planned" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.planned}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("paused")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "paused"
              ? "bg-amber-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Pause size={14} />
          <span>შეჩერებული</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "paused" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.paused}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "completed"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Check size={14} />
          <span>დასრულებული</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "completed" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.completed}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === "all"
              ? "bg-stone-700 text-white shadow-2xs"
              : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <span>ყველა</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === "all" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-700"
            }`}
          >
            {counts.total}
          </span>
        </button>
      </div>

      {/* 3. Task Cards Grid */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-sm font-bold text-stone-800">
              დავალებები ამ კატეგორიაში არ მოიძებნა
            </h3>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              თქვენ არ გაქვთ აქტიური ჩანაწერები არჩეული ფილტრის ქვეშ.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((t) => {
              let note: string | undefined;
              if (activeTab === "waiting") note = "მოლოდინში";
              else if (activeTab === "needsAttention") note = "ყურადღება";
              else if (activeTab === "paused") note = "შეჩერებული";
              else if (activeTab === "blocked") note = "დაბლოკილი";
              return renderTaskCard(t, note);
            })}
          </div>
        )}
      </div>
    </div>
  );
}
