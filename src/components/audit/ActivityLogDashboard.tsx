"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Clock,
  ArrowRight,
  Folder,
  MessageSquare,
  Paperclip,
  Pause,
  Play,
  CalendarClock,
  Shield,
  Layers,
  ChevronDown,
  ChevronRight,
  Download,
  RotateCcw,
  LayoutList,
  Table as TableIcon,
  AlertCircle,
  Sparkles,
  Code2,
} from "lucide-react";
import { AuditAction, Role } from "@prisma/client";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

interface AuditActor {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
}

interface AuditTask {
  id: string;
  taskNumber: number;
  title: string;
  type: string;
  status: string;
  project?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
}

export interface AuditEventItem {
  id: string;
  taskId?: string | null;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  reason?: string | null;
  createdAt: string;
  actor: AuditActor;
  task?: AuditTask | null;
}

interface ActivityLogDashboardProps {
  onSelectTask: (taskId: string) => void;
  users: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  currentUser?: { id: string; name: string; role: Role };
}

// Action translation to Georgian & category metadata
interface ActionMeta {
  label: string;
  category: "task" | "workflow" | "deadline" | "comment" | "pause" | "user" | "system";
  colorClass: string;
  bgClass: string;
  icon: React.ElementType;
}

const ACTION_MAP: Record<AuditAction, ActionMeta> = {
  TASK_CREATED: {
    label: "დავალების შექმნა",
    category: "task",
    colorClass: "text-blue-700 border-blue-200",
    bgClass: "bg-blue-50 text-blue-700",
    icon: Sparkles,
  },
  TASK_UPDATED: {
    label: "დავალების რედაქტირება",
    category: "task",
    colorClass: "text-stone-700 border-stone-200",
    bgClass: "bg-stone-100 text-stone-700",
    icon: Layers,
  },
  DEPARTMENT_CHANGED: {
    label: "გუნდის ცვლილება",
    category: "task",
    colorClass: "text-purple-700 border-purple-200",
    bgClass: "bg-purple-50 text-purple-700",
    icon: Code2,
  },
  TASK_ASSIGNED: {
    label: "შემსრულებლის მინიჭება",
    category: "workflow",
    colorClass: "text-indigo-700 border-indigo-200",
    bgClass: "bg-indigo-50 text-indigo-700",
    icon: UserIcon,
  },
  TASK_UNASSIGNED: {
    label: "შემსრულებლის მოხსნა",
    category: "workflow",
    colorClass: "text-amber-700 border-amber-200",
    bgClass: "bg-amber-50 text-amber-700",
    icon: UserIcon,
  },
  STAGE_CREATED: {
    label: "ეტაპის დამატება",
    category: "workflow",
    colorClass: "text-blue-700 border-blue-200",
    bgClass: "bg-blue-50 text-blue-700",
    icon: Layers,
  },
  STAGE_REORDERED: {
    label: "ეტაპების გადალაგება",
    category: "workflow",
    colorClass: "text-indigo-700 border-indigo-200",
    bgClass: "bg-indigo-50 text-indigo-700",
    icon: Layers,
  },
  STAGE_COMPLETED: {
    label: "ეტაპის დასრულება",
    category: "workflow",
    colorClass: "text-emerald-700 border-emerald-200",
    bgClass: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  SUBTASK_CREATED: {
    label: "ქვედავალების შექმნა",
    category: "workflow",
    colorClass: "text-blue-700 border-blue-200",
    bgClass: "bg-blue-50 text-blue-700",
    icon: Layers,
  },
  SUBTASK_COMPLETED: {
    label: "ქვედავალების შესრულება",
    category: "workflow",
    colorClass: "text-emerald-700 border-emerald-200",
    bgClass: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  SUBTASK_REOPENED: {
    label: "ქვედავალების განახლება",
    category: "workflow",
    colorClass: "text-amber-700 border-amber-200",
    bgClass: "bg-amber-50 text-amber-700",
    icon: RotateCcw,
  },
  STATUS_CHANGED: {
    label: "სტატუსის ცვლილება",
    category: "task",
    colorClass: "text-blue-700 border-blue-200",
    bgClass: "bg-blue-50 text-blue-700",
    icon: ArrowRight,
  },
  WORK_PAUSED: {
    label: "მუშაობის შეჩერება (პაუზა)",
    category: "pause",
    colorClass: "text-amber-700 border-amber-200",
    bgClass: "bg-amber-50 text-amber-700",
    icon: Pause,
  },
  WORK_RESUMED: {
    label: "მუშაობის განახლება",
    category: "pause",
    colorClass: "text-emerald-700 border-emerald-200",
    bgClass: "bg-emerald-50 text-emerald-700",
    icon: Play,
  },
  DEADLINE_CHANGED: {
    label: "დედლაინის ცვლილება",
    category: "deadline",
    colorClass: "text-rose-700 border-rose-200",
    bgClass: "bg-rose-50 text-rose-700",
    icon: CalendarClock,
  },
  SCHEDULE_CHANGED: {
    label: "გრაფიკის გადავადება",
    category: "deadline",
    colorClass: "text-purple-700 border-purple-200",
    bgClass: "bg-purple-50 text-purple-700",
    icon: CalendarClock,
  },
  PRIORITY_CHANGED: {
    label: "პრიორიტეტის ცვლილება",
    category: "task",
    colorClass: "text-amber-700 border-amber-200",
    bgClass: "bg-amber-50 text-amber-700",
    icon: AlertCircle,
  },
  ATTACHMENT_ADDED: {
    label: "ფაილის/ბმულის მიმაგრება",
    category: "comment",
    colorClass: "text-cyan-700 border-cyan-200",
    bgClass: "bg-cyan-50 text-cyan-700",
    icon: Paperclip,
  },
  ATTACHMENT_REMOVED: {
    label: "ფაილის წაშლა",
    category: "comment",
    colorClass: "text-rose-700 border-rose-200",
    bgClass: "bg-rose-50 text-rose-700",
    icon: Paperclip,
  },
  COMMENT_ADDED: {
    label: "კომენტარის დამატება",
    category: "comment",
    colorClass: "text-indigo-700 border-indigo-200",
    bgClass: "bg-indigo-50 text-indigo-700",
    icon: MessageSquare,
  },
  DAILY_UPDATE_ADDED: {
    label: "დღიური ანგარიში",
    category: "comment",
    colorClass: "text-emerald-700 border-emerald-200",
    bgClass: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  USER_CREATED: {
    label: "მომხმარებლის დამატება",
    category: "user",
    colorClass: "text-blue-700 border-blue-200",
    bgClass: "bg-blue-50 text-blue-700",
    icon: UserIcon,
  },
  USER_STATUS_CHANGED: {
    label: "მომხმარებლის სტატუსი",
    category: "user",
    colorClass: "text-stone-700 border-stone-200",
    bgClass: "bg-stone-100 text-stone-700",
    icon: Shield,
  },
  CALENDAR_UPDATED: {
    label: "კალენდრის განახლება",
    category: "system",
    colorClass: "text-purple-700 border-purple-200",
    bgClass: "bg-purple-50 text-purple-700",
    icon: Calendar,
  },
};

export function ActivityLogDashboard({
  onSelectTask,
  users,
  currentUser,
}: ActivityLogDashboardProps) {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    statusChanges: 0,
    deadlineChanges: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedActor, setSelectedActor] = useState<string>("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Fetch audit events
  const fetchAuditEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");

      if (selectedActor !== "ALL") {
        params.set("actorId", selectedActor);
      }

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      // Date range calculation
      const now = new Date();
      if (selectedPeriod === "TODAY") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        params.set("startDate", today.toISOString());
      } else if (selectedPeriod === "7DAYS") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        params.set("startDate", sevenDaysAgo.toISOString());
      } else if (selectedPeriod === "MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        params.set("startDate", startOfMonth.toISOString());
      }

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error("მონაცემების ჩატვირთვა ვერ მოხერხდა");
      }
      const data = await res.json();
      setEvents(data.auditEvents || []);
      setTotalCount(data.totalCount || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error("Audit log fetch error:", err);
      setError(err.message || "შეცდომა ლოგების ჩატვირთვისას");
    } finally {
      setIsLoading(false);
    }
  }, [selectedActor, searchQuery, selectedPeriod]);

  useEffect(() => {
    fetchAuditEvents();
  }, [fetchAuditEvents]);

  // Client-side category filtering
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedCategory === "ALL") return true;
      const meta = ACTION_MAP[e.action];
      if (!meta) return true;
      return meta.category === selectedCategory;
    });
  }, [events, selectedCategory]);

  // Group events by Day for Timeline View
  const groupedEvents = useMemo(() => {
    const groups: { [dateLabel: string]: AuditEventItem[] } = {};
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    filteredEvents.forEach((event) => {
      const eventDate = new Date(event.createdAt);
      const dateKey = eventDate.toISOString().split("T")[0];

      let label = formatGeorgianDateShort(eventDate);
      if (dateKey === todayStr) {
        label = `დღეს • ${label}`;
      } else if (dateKey === yesterdayStr) {
        label = `გუშინ • ${label}`;
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(event);
    });

    return Object.entries(groups);
  }, [filteredEvents]);

  // Format Time (HH:mm:ss)
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("ka-GE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Format Relative Time (მაგ. 5 წუთის წინ)
  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "ახლახანს";
      if (diffMins < 60) return `${diffMins} წთ წინ`;
      if (diffHours < 24) return `${diffHours} სთ წინ`;
      return `${diffDays} დღის წინ`;
    } catch {
      return "";
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredEvents.length === 0) return;

    const headers = ["თარიღი", "დრო", "მომხმარებელი", "როლი", "მოქმედება", "დავალება", "მიზეზი"];
    const rows = filteredEvents.map((e) => {
      const d = new Date(e.createdAt);
      const meta = ACTION_MAP[e.action];
      return [
        d.toLocaleDateString("ka-GE"),
        formatTime(e.createdAt),
        `"${e.actor.name.replace(/"/g, '""')}"`,
        e.actor.role,
        `"${meta?.label || e.action}"`,
        e.task ? `"#${e.task.taskNumber} ${e.task.title.replace(/"/g, '""')}"` : '""',
        `"${(e.reason || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_log_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render value diffs cleanly
  const renderValueDiff = (oldVals: any, newVals: any, action: AuditAction) => {
    if (!oldVals && !newVals) return null;

    if (action === AuditAction.STATUS_CHANGED) {
      return (
        <div className="flex items-center gap-1.5 text-xs mt-1">
          <span className="font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600 line-through">
            {oldVals?.status || "—"}
          </span>
          <ArrowRight size={12} className="text-stone-400" />
          <span className="font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
            {newVals?.status || "—"}
          </span>
        </div>
      );
    }

    if (action === AuditAction.DEADLINE_CHANGED || action === AuditAction.SCHEDULE_CHANGED) {
      const oldDate = oldVals?.deadline ? formatGeorgianDateShort(oldVals.deadline) : "უდედლაინო";
      const newDate = newVals?.deadline ? formatGeorgianDateShort(newVals.deadline) : "უდედლაინო";
      return (
        <div className="flex items-center gap-1.5 text-xs mt-1">
          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 line-through">
            {oldDate}
          </span>
          <ArrowRight size={12} className="text-stone-400" />
          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
            {newDate}
          </span>
        </div>
      );
    }

    if (action === AuditAction.PRIORITY_CHANGED) {
      return (
        <div className="flex items-center gap-1.5 text-xs mt-1">
          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-600 line-through">
            {oldVals?.priority || "—"}
          </span>
          <ArrowRight size={12} className="text-stone-400" />
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
            {newVals?.priority || "—"}
          </span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8F7F4] overflow-hidden">
      {/* 1. Header Row */}
      <div className="px-5 sm:px-8 py-4 bg-white border-b border-stone-200 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <History size={24} className="text-stone-700" />
              <span>ლოგი / ისტორია</span>
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Audit Trail
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            სისტემაში განხორციელებული ცვლილებების, დავალებების მართვისა და აუდიტის სრული ქრონოლოგია
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <button
            onClick={() => fetchAuditEvents()}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="განახლება"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-blue-600" : "text-stone-600"} />
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200">
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <LayoutList size={14} />
              <span>ნაკადი</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-stone-900 shadow-2xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <TableIcon size={14} />
              <span>ცხრილი</span>
            </button>
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredEvents.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
            title="CSV ექსპორტი"
          >
            <Download size={14} className="text-stone-500" />
            <span className="hidden sm:inline">CSV ექსპორტი</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="px-5 sm:px-8 py-3.5 bg-white/70 border-b border-stone-200/80 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Total Events */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 shrink-0">
              <History size={18} />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                {stats.total}
              </div>
              <div className="text-[11px] text-stone-500 font-medium">სულ მოვლენა</div>
            </div>
          </div>

          {/* Card 2: Today's Events */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-blue-700 leading-tight">
                {stats.today}
              </div>
              <div className="text-[11px] text-stone-500 font-medium">დღევანდელი მოვლენა</div>
            </div>
          </div>

          {/* Card 3: Status Changes */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-emerald-700 leading-tight">
                {stats.statusChanges}
              </div>
              <div className="text-[11px] text-stone-500 font-medium">სტატუსის ცვლილება</div>
            </div>
          </div>

          {/* Card 4: Deadline Changes */}
          <div className="bg-white p-3 rounded-xl border border-stone-200/90 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <CalendarClock size={18} />
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-rose-700 leading-tight">
                {stats.deadlineChanges}
              </div>
              <div className="text-[11px] text-stone-500 font-medium">ვადის გადაწევა</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="px-5 sm:px-8 py-3 bg-white/50 border-b border-stone-200/80 shrink-0 flex items-center gap-2.5 flex-wrap">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ძებნა (ტასკი, მომხმარებელი, მიზეზი)..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">ყველა მოქმედება</option>
          <option value="task">დავალების ცვლილებები</option>
          <option value="workflow">სამუშაო პროცესი (Workflow)</option>
          <option value="deadline">დედლაინი & გრაფიკი</option>
          <option value="pause">პაუზა & განახლება</option>
          <option value="comment">კომენტარები & ფაილები</option>
          <option value="user">მომხმარებლები & სისტემა</option>
        </select>

        {/* Actor Filter */}
        <select
          value={selectedActor}
          onChange={(e) => setSelectedActor(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">ყველა მომხმარებელი</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Period Filter */}
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
        >
          <option value="ALL">ყველა დრო</option>
          <option value="TODAY">დღეს</option>
          <option value="7DAYS">ბოლო 7 დღე</option>
          <option value="MONTH">მიმდინარე თვე</option>
        </select>

        {/* Reset button */}
        {(searchQuery || selectedCategory !== "ALL" || selectedActor !== "ALL" || selectedPeriod !== "ALL") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("ALL");
              setSelectedActor("ALL");
              setSelectedPeriod("ALL");
            }}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>გასუფთავება</span>
          </button>
        )}
      </div>

      {/* 4. Main Body: Timeline Stream or Table View */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-2">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            <span className="text-xs font-bold">ისტორიის ჩატვირთვა...</span>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs text-rose-700">
            {error}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-20 bg-white rounded-2xl border border-stone-200/90 text-center p-8 shadow-2xs">
            <History size={36} className="mx-auto text-stone-300 mb-2" />
            <h3 className="text-sm font-bold text-stone-800">ჩანაწერები ვერ მოიძებნა</h3>
            <p className="text-xs text-stone-500 mt-1">
              მითითებული ფილტრებით აუდიტის მოვლენები არ არსებობს
            </p>
          </div>
        ) : viewMode === "timeline" ? (
          /* ========================================================= */
          /* TIMELINE STREAM VIEW                                      */
          /* ========================================================= */
          <div className="max-w-4xl mx-auto space-y-8">
            {groupedEvents.map(([dateLabel, dayEvents]) => (
              <div key={dateLabel} className="space-y-3">
                {/* Day Header Badge */}
                <div className="sticky top-0 z-10 flex items-center gap-2 py-1 bg-[#F8F7F4]/90 backdrop-blur-xs">
                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-stone-200/80 text-stone-700 shadow-2xs">
                    {dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-stone-200" />
                  <span className="text-[11px] text-stone-400 font-semibold">
                    {dayEvents.length} მოქმედება
                  </span>
                </div>

                {/* Event Cards inside Day */}
                <div className="relative pl-6 sm:pl-8 space-y-3 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {dayEvents.map((event) => {
                    const meta = ACTION_MAP[event.action] || {
                      label: event.action,
                      category: "system",
                      colorClass: "text-stone-700 border-stone-200",
                      bgClass: "bg-stone-100 text-stone-700",
                      icon: Layers,
                    };
                    const IconComponent = meta.icon;
                    const isExpanded = expandedEventId === event.id;

                    return (
                      <div
                        key={event.id}
                        className="relative bg-white rounded-xl border border-stone-200/90 p-4 shadow-2xs hover:shadow-sm transition-all"
                      >
                        {/* Dot on the rail */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-4 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-2xs ${meta.bgClass}`}
                        >
                          <IconComponent size={12} />
                        </div>

                        {/* Event Card Content */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          {/* Actor info & Action label */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Avatar */}
                            {event.actor.avatarUrl ? (
                              <img
                                src={event.actor.avatarUrl}
                                alt={event.actor.name}
                                className="w-6 h-6 rounded-full object-cover border border-stone-200"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-700">
                                {event.actor.name.charAt(0)}
                              </div>
                            )}

                            <span className="text-xs font-extrabold text-stone-900">
                              {event.actor.name}
                            </span>

                            {event.actor.role === "ADMIN" && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Admin
                              </span>
                            )}

                            {/* Action Tag */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.colorClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>

                          {/* Timestamps */}
                          <div className="flex items-center gap-2 text-[11px] text-stone-400 shrink-0 font-medium">
                            <Clock size={11} />
                            <span>{formatTime(event.createdAt)}</span>
                            <span className="text-stone-300">•</span>
                            <span>{formatRelativeTime(event.createdAt)}</span>
                          </div>
                        </div>

                        {/* Task Link (if associated with task) */}
                        {event.task && (
                          <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => onSelectTask(event.task!.id)}
                              className="text-xs font-bold text-stone-800 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-left cursor-pointer group"
                            >
                              <span className="font-mono text-stone-400 group-hover:text-blue-500">
                                #{event.task.taskNumber}
                              </span>
                              <span className="underline decoration-stone-300 group-hover:decoration-blue-500">
                                {event.task.title}
                              </span>
                            </button>

                            {event.task.project && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/80">
                                <Folder size={10} className="text-stone-400" />
                                {event.task.project.name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Reason / Note Block */}
                        {event.reason && (
                          <div className="mt-2 p-2 bg-stone-50 rounded-lg text-xs text-stone-700 border-l-2 border-stone-400 font-medium leading-relaxed">
                            {event.reason}
                          </div>
                        )}

                        {/* Visual Diff for Status or Deadline */}
                        {renderValueDiff(event.oldValues, event.newValues, event.action)}

                        {/* Technical JSON Toggle */}
                        {(event.oldValues || event.newValues) && (
                          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                            <button
                              onClick={() =>
                                setExpandedEventId(isExpanded ? null : event.id)
                              }
                              className="text-[10px] font-bold text-stone-400 hover:text-stone-700 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronDown size={11} />
                                  <span>დეტალების დამალვა</span>
                                </>
                              ) : (
                                <>
                                  <ChevronRight size={11} />
                                  <span>ტექნიკური დეტალები (JSON)</span>
                                </>
                              )}
                            </button>
                            <span className="text-[10px] text-stone-300 font-mono">
                              ID: {event.id.slice(0, 8)}...
                            </span>
                          </div>
                        )}

                        {/* Expanded JSON Inspector */}
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-stone-900 text-stone-100 rounded-lg text-[10.5px] font-mono overflow-x-auto space-y-2">
                            {event.oldValues && (
                              <div>
                                <span className="text-rose-400 font-bold block mb-0.5">
                                  // ძველი მნიშვნელობა (oldValues):
                                </span>
                                <pre>{JSON.stringify(event.oldValues, null, 2)}</pre>
                              </div>
                            )}
                            {event.newValues && (
                              <div>
                                <span className="text-emerald-400 font-bold block mb-0.5">
                                  // ახალი მნიშვნელობა (newValues):
                                </span>
                                <pre>{JSON.stringify(event.newValues, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ========================================================= */
          /* TABLE VIEW                                                */
          /* ========================================================= */
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-600 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">დრო / თარიღი</th>
                    <th className="py-3 px-4">ავტორი</th>
                    <th className="py-3 px-4">მოქმედება</th>
                    <th className="py-3 px-4">დავალება</th>
                    <th className="py-3 px-4">მიზეზი / ცვლილება</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredEvents.map((event) => {
                    const meta = ACTION_MAP[event.action] || {
                      label: event.action,
                      colorClass: "text-stone-700 border-stone-200",
                    };
                    return (
                      <tr
                        key={event.id}
                        className="hover:bg-stone-50/60 transition-colors"
                      >
                        {/* Date & Time */}
                        <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                          <div className="font-bold text-stone-800">
                            {formatGeorgianDateShort(event.createdAt)}
                          </div>
                          <div className="text-[10px] text-stone-400 font-mono">
                            {formatTime(event.createdAt)}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {event.actor.avatarUrl ? (
                              <img
                                src={event.actor.avatarUrl}
                                alt={event.actor.name}
                                className="w-5 h-5 rounded-full object-cover border border-stone-200"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center text-[8px] font-bold text-stone-700">
                                {event.actor.name.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-stone-800">
                              {event.actor.name}
                            </span>
                            {event.actor.role === "ADMIN" && (
                              <span className="text-[8px] font-bold px-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                Admin
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.colorClass}`}
                          >
                            {meta.label}
                          </span>
                        </td>

                        {/* Associated Task */}
                        <td className="py-3 px-4 max-w-xs truncate">
                          {event.task ? (
                            <button
                              onClick={() => onSelectTask(event.task!.id)}
                              className="font-bold text-stone-900 hover:text-blue-600 transition-colors cursor-pointer truncate text-left"
                            >
                              <span className="font-mono text-stone-400 mr-1.5">
                                #{event.task.taskNumber}
                              </span>
                              {event.task.title}
                            </button>
                          ) : (
                            <span className="text-stone-400 italic">სისტემური</span>
                          )}
                        </td>

                        {/* Reason / Details */}
                        <td className="py-3 px-4 text-stone-600 max-w-sm">
                          {event.reason ? (
                            <span className="font-medium text-stone-800">{event.reason}</span>
                          ) : (
                            renderValueDiff(event.oldValues, event.newValues, event.action) || (
                              <span className="text-stone-400 italic">—</span>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
