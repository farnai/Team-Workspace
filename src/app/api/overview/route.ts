import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { subDays } from "date-fns";

export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const [
      activeCount,
      overdueCount,
      completedLast7Days,
      pausedCount,
      blockedCount,
      projects,
      recentActivities,
    ] = await Promise.all([
      // Active tasks
      prisma.task.count({
        where: { status: { in: ["IN_PROGRESS", "PLANNED"] } },
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
      // Projects with progress
      prisma.project.findMany({
        where: { isArchived: false },
        include: {
          tasks: {
            select: { id: true, status: true, progress: true },
          },
        },
      }),
      // Recent activities
      prisma.auditEvent.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true } },
          task: { select: { id: true, taskNumber: true, title: true } },
        },
      }),
    ]);

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
        overdueCount,
        completedLast7Days,
        pausedCount,
        blockedCount,
      },
      projects: projectSummaries,
      recentActivities,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/overview error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
