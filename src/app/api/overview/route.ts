import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { subDays, addDays } from "date-fns";

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    const sevenDaysLater = addDays(now, 7);

    // Calculate start & end of Today in Asia/Tbilisi (UTC+4)
    const tbilisiOffsetMs = 4 * 60 * 60 * 1000;
    const tbilisiNow = new Date(now.getTime() + tbilisiOffsetMs);
    const y = tbilisiNow.getUTCFullYear();
    const m = tbilisiNow.getUTCMonth();
    const d = tbilisiNow.getUTCDate();
    const startOfTodayUtc = new Date(Date.UTC(y, m, d, 0, 0, 0) - tbilisiOffsetMs);
    const endOfTodayUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - tbilisiOffsetMs);

    const [
      activeCount,
      completedTodayCount,
      overdueCount,
      completedLast7Days,
      pausedCount,
      blockedCount,
      dueSoonCount,
      projects,
      recentActivities,
      users,
      inProgressTasks,
    ] = await Promise.all([
      // Active tasks
      prisma.task.count({
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
      }),
      // Completed Today (Tbilisi timezone)
      prisma.task.count({
        where: {
          status: "DONE",
          completedAt: { gte: startOfTodayUtc, lte: endOfTodayUtc },
        },
      }),
      // Overdue tasks
      prisma.task.count({
        where: {
          deadline: { lt: now },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      // Completed last 7 days
      prisma.task.count({
        where: {
          status: "DONE",
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      // Paused
      prisma.task.count({
        where: { status: "PAUSED" },
      }),
      // Blocked
      prisma.task.count({
        where: { status: "BLOCKED" },
      }),
      // Due soon (next 7 days)
      prisma.task.count({
        where: {
          deadline: { gte: now, lte: sevenDaysLater },
          status: { notIn: ["DONE", "CANCELLED"] },
        },
      }),
      // Projects with progress
      prisma.project.findMany({
        where: { isArchived: false },
        include: {
          tasks: {
            select: { id: true, status: true, progress: true },
          },
        },
      }),
      // Recent activities from real audit records
      prisma.auditEvent.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true, role: true } },
          task: { select: { id: true, taskNumber: true, title: true, type: true } },
        },
      }),
      // Active team members
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          role: true,
        },
        orderBy: { name: "asc" },
      }),
      // Active and planned tasks with workflow stages for team activity mapping
      prisma.task.findMany({
        where: { status: { in: ["IN_PROGRESS", "PLANNED", "PAUSED", "BLOCKED"] } },
        include: {
          project: { select: { id: true, name: true, color: true } },
          assignments: { select: { userId: true } },
          stages: {
            orderBy: { position: "asc" },
            include: {
              assignments: { select: { userId: true } },
            },
          },
        },
      }),
    ]);

    // Map each team member to their current active work, respecting sequential workflow stages
    let activeMembersCount = 0;

    const teamActivity = users.map((u) => {
      // Find tasks where user is assigned
      let currentActiveWork: {
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
      } | null = null;

      let nextScheduledWork: {
        taskId: string;
        taskNumber: number;
        title: string;
        stageTitle: string | null;
        startDate: string | null;
      } | null = null;

      for (const t of inProgressTasks) {
        const hasStages = t.stages.length > 0;
        const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);

        if (hasStages) {
          // If task has stages, ONLY active stage assignees are actively working!
          if (activeStage && activeStage.assignments.some((a) => a.userId === u.id)) {
            if (!currentActiveWork && t.status === "IN_PROGRESS") {
              currentActiveWork = {
                taskId: t.id,
                taskNumber: t.taskNumber,
                title: t.title,
                projectName: t.project.name,
                projectColor: t.project.color,
                type: t.type,
                priority: t.priority,
                status: t.status,
                stageTitle: activeStage.title,
                deadline: activeStage.deadline?.toISOString() || t.deadline?.toISOString() || null,
                progress: t.progress,
              };
            }
          } else {
            // Check if user is in a future stage
            const futureStage = t.stages.find(
              (s) => !s.isActive && !s.isCompleted && s.assignments.some((a) => a.userId === u.id)
            );
            if (futureStage && !nextScheduledWork) {
              nextScheduledWork = {
                taskId: t.id,
                taskNumber: t.taskNumber,
                title: t.title,
                stageTitle: futureStage.title,
                startDate: t.startDate?.toISOString() || null,
              };
            }
          }
        } else {
          // Direct task assignment without stages
          if (t.assignments.some((a) => a.userId === u.id)) {
            if (!currentActiveWork && t.status === "IN_PROGRESS") {
              currentActiveWork = {
                taskId: t.id,
                taskNumber: t.taskNumber,
                title: t.title,
                projectName: t.project.name,
                projectColor: t.project.color,
                type: t.type,
                priority: t.priority,
                status: t.status,
                stageTitle: null,
                deadline: t.deadline?.toISOString() || null,
                progress: t.progress,
              };
            }
          }
        }
      }

      if (currentActiveWork) {
        activeMembersCount++;
      }

      return {
        user: u,
        currentWork: currentActiveWork,
        nextScheduledWork,
      };
    });

    const projectSummaries = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const doneTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const avgProgress =
        totalTasks > 0
          ? Math.round(p.tasks.reduce((acc, t) => acc + t.progress, 0) / totalTasks)
          : 0;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        totalTasks,
        doneTasks,
        avgProgress,
      };
    });

    return NextResponse.json({
      metrics: {
        activeCount,
        completedTodayCount,
        overdueCount,
        completedLast7Days,
        pausedCount,
        blockedCount,
        dueSoonCount,
        activeMembersCount,
      },
      teamActivity,
      projects: projectSummaries,
      recentActivities,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/overview error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
