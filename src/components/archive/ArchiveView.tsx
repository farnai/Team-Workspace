"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Archive,
  Search,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Loader2,
  X,
} from "lucide-react";
import { TaskType, Priority } from "@prisma/client";

interface ArchivedTask {
  id: string;
  taskNumber: number;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: Priority;
  status: string;
  progress: number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    color?: string | null;
  };
  creator?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  assignments: {
    user: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  }[];
  stages?: {
    assignments: {
      user: {
        id: string;
        name: string;
        avatarUrl?: string | null;
      };
    }[];
  }[];
  subtasks?: {
    id: string;
    title: string;
    status: string;
  }[];
}

interface DateGroup {
  date: string;
  formattedDate: string;
  tasks: ArchivedTask[];
}

interface ArchiveViewProps {
  onSelectTask: (taskId: string) => void;
  selectedTaskId?: string | null;
  projects: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onTaskReopened?: () => void;
}

export function ArchiveView({
  onSelectTask,
  projects,
  users,
  onTaskReopened,
}: ArchiveViewProps) {
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reopeningTaskId, setReopeningTaskId] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("ALL");
  const [assigneeId, setAssigneeId] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadArchive() {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (projectId !== "ALL") params.set("projectId", projectId);
        if (assigneeId !== "ALL") params.set("assigneeId", assigneeId);
        if (type !== "ALL") params.set("type", type);
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const res = await fetch(`/api/archive?${params.toString()}`);
        if (!res.ok) {
          throw new Error("არქივის ჩატვირთვა ვერ მოხერხდა");
        }
        const data = await res.json();
        if (!ignore) {
          setGroups(data.groups || []);
          setTotalCount(data.totalCount || 0);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "სერვერის შეცდომა");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    loadArchive();
    return () => {
      ignore = true;
    };
  }, [search, projectId, assigneeId, type, dateFrom, dateTo, refreshKey]);

  const handleReopenTask = async (task: ArchivedTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `ნამდვილად გსურთ დავალების (#${task.taskNumber} — ${task.title}) ხელახლა გახსნა და აქტიურ სამუშაოებში დაბრუნება?`
      )
    ) {
      return;
    }

    try {
      setReopeningTaskId(task.id);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "დავალების ხელახლა გახსნა ვერ მოხერხდა");
      }

      setSuccessMessage(
        `დავალება #${task.taskNumber} წარმატებით გაიხსნა ხელახლა და დაბრუნდა აქტიურ სამუშაოებში`
      );
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh archive list
      setRefreshKey((k) => k + 1);
      // Notify parent to refresh timeline/backlog
      if (onTaskReopened) onTaskReopened();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "შეცდომა გახსნისას");
    } finally {
      setReopeningTaskId(null);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setProjectId("ALL");
    setAssigneeId("ALL");
    setType("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    Boolean(search.trim()) ||
    projectId !== "ALL" ||
    assigneeId !== "ALL" ||
    type !== "ALL" ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50/50 p-6 lg:p-8 space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-orange-600 font-bold text-xs uppercase tracking-wider mb-1">
              <Archive size={16} />
              <span>დავალებების არქივი</span>
            </div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              დასრულებული დავალებები
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              დასრულებული ამოცანების სრული ისტორია, დაჯგუფებული დასრულების თარიღის მიხედვით.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-2xs">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>სულ არქივში: {totalCount}</span>
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search size={14} className="absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ძებნა (დასახელება, #ID)..."
              className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Project */}
          <div>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">ყველა პროექტი</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">ყველა შემსრულებელი</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 cursor-pointer focus:outline-none"
            >
              <option value="ALL">ყველა ტიპი</option>
              <option value="FEATURE">Feature (ფუნქციონალი)</option>
              <option value="BUG">Bug (ხარვეზი)</option>
              <option value="HOTFIX">Hotfix (სწრაფი შესწორება)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full px-3 py-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <X size={13} />
                <span>გასუფთავება</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Range Row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-stone-600 flex-wrap">
          <span className="font-semibold text-stone-500">დასრულების პერიოდი:</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">დან:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-stone-400">მდე:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          <span>{error}</span>
        </div>
      )}

      {/* Groups List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-stone-400 gap-3 bg-white rounded-2xl border border-stone-200/80">
          <Loader2 size={28} className="animate-spin text-orange-600" />
          <span className="text-xs">არქივი იტვირთება...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
            <Archive size={24} />
          </div>
          <h3 className="text-sm font-bold text-stone-800">
            არქივში დავალებები არ მოიძებნა
          </h3>
          <p className="text-xs text-stone-400 max-w-sm mx-auto">
            {hasActiveFilters
              ? "მითითებული ფილტრების შესაბამისი დასრულებული დავალება ვერ მოიძებნა. სცადეთ ფილტრების გასუფთავება."
              : "დავალების დასრულებისთანავე (სტატუსი Done) ის ავტომატურად გამოჩნდება ამ არქივში."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div
              key={group.date}
              className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden"
            >
              {/* Group Date Header */}
              <div className="px-6 py-3.5 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Calendar size={14} />
                  </div>
                  <span className="text-xs font-bold text-stone-900 tracking-tight">
                    {group.formattedDate}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-stone-500">
                  {group.tasks.length} დასრულებული დავალება
                </span>
              </div>

              {/* Tasks List in this date group */}
              <div className="divide-y divide-stone-100">
                {group.tasks.map((task) => {
                  let typeBadgeClass =
                    "bg-indigo-50 text-indigo-700 border-indigo-200/60";
                  if (task.type === "BUG") {
                    typeBadgeClass =
                      "bg-amber-50 text-amber-700 border-amber-200/60";
                  } else if (task.type === "HOTFIX") {
                    typeBadgeClass =
                      "bg-rose-50 text-rose-700 border-rose-200/60";
                  }

                  // Collect all active and stage assignees
                  const allParticipants: {
                    id: string;
                    name: string;
                    avatarUrl?: string | null;
                  }[] = [];
                  task.assignments?.forEach((a) => {
                    if (
                      a.user &&
                      !allParticipants.some((p) => p.id === a.user.id)
                    ) {
                      allParticipants.push(a.user);
                    }
                  });
                  task.stages?.forEach((s) => {
                    s.assignments?.forEach((sa) => {
                      if (
                        sa.user &&
                        !allParticipants.some((p) => p.id === sa.user.id)
                      ) {
                        allParticipants.push(sa.user);
                      }
                    });
                  });

                  return (
                    <div
                      key={task.id}
                      data-testid={`archived-task-card-${task.id}`}
                      className="archived-task-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50/70 transition-colors cursor-pointer group"
                      onClick={() => onSelectTask(task.id)}
                    >
                      {/* Left side: Type, Number, Title, Project */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase shrink-0 ${typeBadgeClass}`}
                        >
                          {task.type}
                        </span>

                        <span className="text-xs font-mono font-bold text-stone-400 shrink-0">
                          #{task.taskNumber}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-stone-900 group-hover:text-orange-600 transition-colors truncate">
                              {task.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-stone-400">
                            {task.project && (
                              <span
                                className="inline-flex items-center gap-1 font-medium"
                                style={{
                                  color: task.project.color || "#78716c",
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      task.project.color || "#78716c",
                                  }}
                                />
                                <span>{task.project.name}</span>
                              </span>
                            )}

                            {task.completedAt && (
                              <span>
                                • დასრულდა:{" "}
                                {new Date(task.completedAt).toLocaleTimeString(
                                  "ka-GE",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Participants, Status, Reopen Action */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        {/* Participants Avatars */}
                        {allParticipants.length > 0 && (
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {allParticipants.slice(0, 3).map((u) => (
                              <div
                                key={u.id}
                                className="w-6 h-6 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-orange-700 shrink-0"
                                title={u.name}
                              >
                                {u.avatarUrl ? (
                                  <Image
                                    src={u.avatarUrl}
                                    alt={u.name}
                                    width={24}
                                    height={24}
                                    className="w-full h-full rounded-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  u.name.charAt(0)
                                )}
                              </div>
                            ))}
                            {allParticipants.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-stone-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-stone-500">
                                +{allParticipants.length - 3}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Status Badge */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} className="text-emerald-600" />
                          <span>დასრულებული</span>
                        </span>

                        {/* Reopen Action Button */}
                        <button
                          onClick={(e) => handleReopenTask(task, e)}
                          disabled={reopeningTaskId === task.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-orange-50 text-stone-700 hover:text-orange-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-stone-200/70"
                          title="დავალების ხელახლა გახსნა და აქტიურ სამუშაოებში დაბრუნება"
                        >
                          {reopeningTaskId === task.id ? (
                            <Loader2 size={13} className="animate-spin text-orange-600" />
                          ) : (
                            <RotateCcw size={13} />
                          )}
                          <span>ხელახლა გახსნა</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
