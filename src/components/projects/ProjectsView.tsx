"use client";

import React, { useState, useMemo } from "react";
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  ArrowLeft,
  Edit2,
  Trash2,
  ExternalLink,
  Kanban,
  Check,
  Calendar,
  X,
  AlertCircle,
  Folder,
} from "lucide-react";
import Image from "next/image";
import { formatGeorgianDateShort } from "@/lib/dateUtils";

export interface ProjectData {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  taskCount?: number;
  completedCount?: number;
  inProgressCount?: number;
  overdueCount?: number;
  progress?: number;
}

export interface TaskItem {
  id: string;
  taskNumber: number;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  progress: number;
  deadline?: string | null;
  startDate?: string | null;
  projectId: string;
  project?: { id: string; name: string; color?: string | null } | null;
  assignments: { user: { id: string; name: string; avatarUrl?: string | null } }[];
}

interface ProjectsViewProps {
  projects: ProjectData[];
  tasks: TaskItem[];
  users: { id: string; name: string; avatarUrl?: string | null }[];
  currentUser: { id: string; name: string; role: string };
  onSelectTask: (taskId: string) => void;
  onOpenNewTask: (defaultProjectId?: string) => void;
  onProjectsUpdated: () => Promise<void>;
  onNavigateToBacklog: (projectId?: string) => void;
}

const PRESET_COLORS = [
  "#EA580C", // Orange
  "#2563EB", // Blue
  "#7C3AED", // Purple
  "#059669", // Emerald
  "#E11D48", // Rose
  "#D97706", // Amber
  "#4F46E5", // Indigo
  "#0891B2", // Cyan
  "#475569", // Slate
];

export function ProjectsView({
  projects,
  tasks,
  currentUser,
  onSelectTask,
  onOpenNewTask,
  onProjectsUpdated,
  onNavigateToBacklog,
}: ProjectsViewProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [taskStatusTab, setTaskStatusTab] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "DONE">("ALL");

  // Project Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectColor, setProjectColor] = useState("#EA580C");
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<ProjectData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdmin = currentUser.role === "ADMIN";

  // Active Project (if viewing inside a project)
  const activeProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Tasks of Active Project
  const activeProjectTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter((t) => t.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  // Filtered Tasks inside Active Project
  const filteredProjectTasks = useMemo(() => {
    let list = activeProjectTasks;

    if (taskStatusTab === "TODO") {
      list = list.filter((t) => t.status === "BACKLOG" || t.status === "PLANNED");
    } else if (taskStatusTab === "IN_PROGRESS") {
      list = list.filter((t) => t.status === "IN_PROGRESS");
    } else if (taskStatusTab === "DONE") {
      list = list.filter((t) => t.status === "DONE");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          String(t.taskNumber).includes(q) ||
          t.assignments.some((a) => a.user.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeProjectTasks, taskStatusTab, searchQuery]);

  // Filtered Projects List
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditingProjectId(null);
    setProjectName("");
    setProjectDescription("");
    setProjectColor("#EA580C");
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: ProjectData) => {
    setModalMode("edit");
    setEditingProjectId(p.id);
    setProjectName(p.name);
    setProjectDescription(p.description || "");
    setProjectColor(p.color || "#EA580C");
    setModalError(null);
    setIsModalOpen(true);
  };

  // Submit Create or Edit Project
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      setModalError("პროექტის სახელი სავალდებულოა");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (modalMode === "create") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim(),
            description: projectDescription.trim() || null,
            color: projectColor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "პროექტის შექმნა ვერ მოხერხდა");
      } else {
        const res = await fetch(`/api/projects/${editingProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim(),
            description: projectDescription.trim() || null,
            color: projectColor,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "პროექტის განახლება ვერ მოხერხდა");
      }

      await onProjectsUpdated();
      setIsModalOpen(false);
    } catch (err: unknown) {
      setModalError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Project Handler
  const handleDeleteProject = async () => {
    if (!deleteConfirmProject) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/projects/${deleteConfirmProject.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "პროექტის წაშლა ვერ მოხერხდა");

      if (selectedProjectId === deleteConfirmProject.id) {
        setSelectedProjectId(null);
      }
      setDeleteConfirmProject(null);
      await onProjectsUpdated();
    } catch (err: unknown) {
      setDeleteError((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-3 sm:p-5 lg:p-6 space-y-4">
      {/* ========================================================= */}
      {/* 1. TOP HEADER BANNER                                      */}
      {/* ========================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          {activeProject ? (
            <button
              onClick={() => setSelectedProjectId(null)}
              className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-stone-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="ყველა პროექტზე დაბრუნება"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">ყველა პროექტი</span>
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FolderKanban size={18} />
            </div>
          )}

          <div>
            <h1 className="text-sm sm:text-base font-black text-stone-900 tracking-tight leading-tight flex items-center gap-2">
              <span>{activeProject ? activeProject.name : "პროექტები (Projects)"}</span>
              {activeProject?.color && (
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white shadow-2xs"
                  style={{ backgroundColor: activeProject.color }}
                />
              )}
            </h1>
            <p className="text-[11px] text-stone-500 font-medium">
              {activeProject
                ? activeProject.description || "პროექტის დავალებები, სტატუსები და პროგრესი."
                : "გუნდის პროექტების მართვა, მიმდინარე დავალებები და საერთო პროგრესი."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeProject ? (
            <>
              <button
                onClick={() => onOpenNewTask(activeProject.id)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>+ ახალი ტასკი</span>
              </button>

              <button
                onClick={() => onNavigateToBacklog(activeProject.id)}
                className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                title="ამ პროექტის გახსნა Kanban დაფაზე"
              >
                <Kanban size={13} className="text-stone-500" />
                <span className="hidden sm:inline">დაფაზე ნახვა</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => handleOpenEditModal(activeProject)}
                  className="p-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 hover:text-stone-900 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="პროექტის რედაქტირება"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </>
          ) : (
            isAdmin && (
              <button
                onClick={handleOpenCreateModal}
                className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:shadow cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>+ ახალი პროექტი</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW A: INSIDE A SPECIFIC PROJECT (TASKS OF PROJECT)     */}
      {/* ========================================================= */}
      {activeProject ? (
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Status Tabs & Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold select-none">
              <button
                onClick={() => setTaskStatusTab("ALL")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  taskStatusTab === "ALL"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
                }`}
              >
                <span>ყველა</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {activeProjectTasks.length}
                </span>
              </button>

              <button
                onClick={() => setTaskStatusTab("TODO")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  taskStatusTab === "TODO"
                    ? "bg-stone-800 text-white shadow-2xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
                }`}
              >
                <span>To Do</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {activeProjectTasks.filter((t) => t.status === "BACKLOG" || t.status === "PLANNED").length}
                </span>
              </button>

              <button
                onClick={() => setTaskStatusTab("IN_PROGRESS")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  taskStatusTab === "IN_PROGRESS"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
                }`}
              >
                <span>In Progress</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {activeProjectTasks.filter((t) => t.status === "IN_PROGRESS").length}
                </span>
              </button>

              <button
                onClick={() => setTaskStatusTab("DONE")}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs ${
                  taskStatusTab === "DONE"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/90"
                }`}
              >
                <span>Completed</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {activeProjectTasks.filter((t) => t.status === "DONE").length}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="ძებნა ამ პროექტში..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>

          {/* Tasks Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredProjectTasks.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-stone-200/80 p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                  <Layers size={22} />
                </div>
                <h3 className="text-sm font-bold text-stone-700">დავალებები არ მოიძებნა</h3>
                <p className="text-xs text-stone-400">
                  ამ პროექტში დავალებები ჯერ არ არის ან არ შეესაბამება ფილტრს.
                </p>
                <button
                  onClick={() => onOpenNewTask(activeProject.id)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>დაამატეთ პირველი ტასკი</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProjectTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="p-4 bg-white rounded-xl border border-stone-200/90 hover:border-stone-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-3 select-none"
                  >
                    <div>
                      {/* Priority & Status Pill */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 uppercase">
                          {task.status}
                        </span>
                        <span className="text-[10px] font-bold text-stone-500">
                          {task.priority}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-[14px] font-normal text-stone-900 leading-snug line-clamp-2">
                        {task.title}
                      </h4>
                    </div>

                    {/* Bottom Row: [☑ SSP-X] & Assignee Avatar */}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-100">
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4 text-blue-600 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="4" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                        <span className="text-[13px] font-medium text-stone-700 tracking-tight">
                          SSP-{task.taskNumber}
                        </span>
                        {task.deadline && (
                          <span className="text-[10px] text-stone-400 font-medium ml-1 flex items-center gap-1">
                            <Calendar size={10} />
                            {formatGeorgianDateShort(task.deadline)}
                          </span>
                        )}
                      </div>

                      {/* Assignee Avatar */}
                      {task.assignments && task.assignments[0]?.user && (
                        <div
                          className="w-6 h-6 rounded-full overflow-hidden border border-white shadow-2xs shrink-0 flex items-center justify-center bg-stone-200 text-[10px] font-bold text-stone-700"
                          title={task.assignments[0].user.name}
                        >
                          {task.assignments[0].user.avatarUrl ? (
                            <Image
                              src={task.assignments[0].user.avatarUrl}
                              alt={task.assignments[0].user.name}
                              width={24}
                              height={24}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            task.assignments[0].user.name.charAt(0)
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* VIEW B: ALL PROJECTS OVERVIEW LIST / GRID                */
        /* ========================================================= */
        <div className="flex-1 flex flex-col min-h-0 space-y-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="პროექტების ძებნა..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
          </div>

          {/* Projects Cards Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((p) => {
                const projectTasks = tasks.filter((t) => t.projectId === p.id);
                const totalTasks = projectTasks.length;
                const completedTasks = projectTasks.filter((t) => t.status === "DONE").length;
                const inProgressTasks = projectTasks.filter((t) => t.status === "IN_PROGRESS").length;
                const overdueTasks = projectTasks.filter(
                  (t) =>
                    t.deadline &&
                    new Date(t.deadline) < new Date() &&
                    t.status !== "DONE" &&
                    t.status !== "CANCELLED"
                ).length;
                const progressPct =
                  totalTasks > 0
                    ? Math.round(
                        projectTasks.reduce((acc, t) => acc + (t.progress || 0), 0) /
                          totalTasks
                      )
                    : 0;

                const color = p.color || "#EA580C";

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className="p-5 bg-white rounded-2xl border border-stone-200/90 shadow-2xs hover:shadow-xs hover:border-stone-300 transition-all flex flex-col justify-between space-y-4 group cursor-pointer"
                  >
                    <div>
                      {/* Header: Project Color Indicator, Name & Menu */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            <Folder size={18} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-stone-900 text-sm sm:text-base leading-snug group-hover:text-blue-600 transition-colors">
                              {p.name}
                            </h3>
                            <span className="text-[11px] text-stone-400 font-medium">
                              სულ: {totalTasks} დავალება
                            </span>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(p);
                              }}
                              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="რედაქტირება"
                            >
                              <Edit2 size={13} />
                            </button>
                            {projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmProject(p);
                                }}
                                className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="პროექტის წაშლა"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-stone-500 mt-2.5 line-clamp-2 min-h-[32px]">
                        {p.description || "პროექტის აღწერა მითითებული არ არის."}
                      </p>

                      {/* Metrics Pills */}
                      <div className="grid grid-cols-4 gap-1.5 mt-3.5 text-center select-none">
                        <div className="p-1.5 bg-stone-50 rounded-lg border border-stone-100">
                          <span className="block text-xs font-black text-stone-800">
                            {totalTasks}
                          </span>
                          <span className="block text-[9px] text-stone-400 font-bold uppercase">
                            სულ
                          </span>
                        </div>
                        <div className="p-1.5 bg-blue-50/60 rounded-lg border border-blue-100">
                          <span className="block text-xs font-black text-blue-700">
                            {inProgressTasks}
                          </span>
                          <span className="block text-[9px] text-blue-600 font-bold uppercase">
                            მიმდინარე
                          </span>
                        </div>
                        <div className="p-1.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                          <span className="block text-xs font-black text-emerald-700">
                            {completedTasks}
                          </span>
                          <span className="block text-[9px] text-emerald-600 font-bold uppercase">
                            დასრულდა
                          </span>
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            overdueTasks > 0
                              ? "bg-rose-50 border-rose-100"
                              : "bg-stone-50 border-stone-100"
                          }`}
                        >
                          <span
                            className={`block text-xs font-black ${
                              overdueTasks > 0 ? "text-rose-700" : "text-stone-400"
                            }`}
                          >
                            {overdueTasks}
                          </span>
                          <span
                            className={`block text-[9px] font-bold uppercase ${
                              overdueTasks > 0 ? "text-rose-600" : "text-stone-400"
                            }`}
                          >
                            ვადაგად.
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-stone-600">
                          <span>პროგრესი</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${progressPct}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action: ტასკების ნახვა */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <button
                        onClick={() => setSelectedProjectId(p.id)}
                        className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-800 hover:text-stone-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200/60"
                      >
                        <Layers size={13} className="text-stone-500" />
                        <span>ტასკების ნახვა ({totalTasks})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CREATE / EDIT PROJECT MODAL                            */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
              <h3 className="font-extrabold text-stone-900 text-sm">
                {modalMode === "create" ? "ახალი პროექტის შექმნა" : "პროექტის რედაქტირება"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleProjectSubmit} className="p-5 space-y-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  პროექტის სახელი <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="მაგ: E-Commerce Platform / მობილური აპლიკაცია"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  აღწერა (არასავალდებულო)
                </label>
                <textarea
                  rows={3}
                  placeholder="მოკლე აღწერა პროექტის მიზნის შესახებ..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 resize-none"
                />
              </div>

              {/* Color Palette */}
              <div>
                <label className="block font-bold text-stone-800 mb-2">
                  პროექტის ფერი
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setProjectColor(col)}
                      className={`w-7 h-7 rounded-xl transition-all cursor-pointer flex items-center justify-center border-2 ${
                        projectColor === col ? "border-stone-900 scale-110 shadow-xs" : "border-transparent"
                      }`}
                      style={{ backgroundColor: col }}
                      title={col}
                    >
                      {projectColor === col && <Check size={14} className="text-white" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl font-bold text-stone-700 transition-colors cursor-pointer"
                >
                  გაუქმება
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                >
                  {isSubmitting ? "ინახება..." : modalMode === "create" ? "პროექტის შექმნა" : "შენახვა"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DELETE PROJECT CONFIRMATION MODAL                      */}
      {/* ========================================================= */}
      {deleteConfirmProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col p-5 space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-stone-900 text-sm">
                წაიშალოს პროექტი „{deleteConfirmProject.name}“?
              </h3>
              <p className="text-xs text-stone-500">
                თუ პროექტში არის დავალებები, ისინი ავტომატურად გადამისამართდება სხვა აქტიურ პროექტზე.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmProject(null)}
                className="px-4 py-2 border border-stone-300 hover:bg-stone-50 rounded-xl font-bold text-stone-700 text-xs transition-colors cursor-pointer"
              >
                გაუქმება
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                {isDeleting ? "იშლება..." : "დიახ, წაშლა"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
