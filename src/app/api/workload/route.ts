import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        taskAssignments: {
          include: {
            task: {
              include: {
                stages: {
                  where: { isActive: true },
                  include: { assignments: true },
                },
                subtasks: true,
              },
            },
          },
        },
        stageAssignments: {
          include: {
            stage: {
              include: {
                task: true,
                subtasks: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();

    const workloads = users.map((u) => {
      const assignedTasks = u.taskAssignments.map((ta) => ta.task);

      const activeTasks = assignedTasks.filter(
        (t) => t.status === "IN_PROGRESS" || t.status === "PLANNED"
      );

      const pausedTasks = assignedTasks.filter((t) => t.status === "PAUSED");
      const blockedTasks = assignedTasks.filter((t) => t.status === "BLOCKED");

      const overdueTasks = assignedTasks.filter(
        (t) => t.deadline && new Date(t.deadline) < now && t.status !== "DONE" && t.status !== "CANCELLED"
      );

      // Active subtasks
      let activeSubtasksCount = 0;
      assignedTasks.forEach((t) => {
        const remaining = t.subtasks.filter((s) => s.status !== "DONE" && s.status !== "CANCELLED");
        activeSubtasksCount += remaining.length;
      });

      // Stages in queue (where stage is not active yet)
      const waitingStages = u.stageAssignments.filter(
        (sa) => !sa.stage.isActive && !sa.stage.isCompleted
      );

      // Simple load percentage calculation based on active tasks (e.g. 1 task = 25%, 4 tasks = 100%)
      const loadPercentage = Math.min(Math.round((activeTasks.length / 4) * 100), 100);

      // Check overlap
      const hasOverlapWarning = activeTasks.length >= 3;

      return {
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
          role: u.role,
        },
        stats: {
          activeCount: activeTasks.length,
          queuedCount: waitingStages.length,
          pausedCount: pausedTasks.length,
          blockedCount: blockedTasks.length,
          overdueCount: overdueTasks.length,
          activeSubtasksCount,
          loadPercentage: loadPercentage || (activeTasks.length > 0 ? 30 : 10),
          hasOverlapWarning,
        },
      };
    });

    return NextResponse.json({ workloads });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/workload error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
