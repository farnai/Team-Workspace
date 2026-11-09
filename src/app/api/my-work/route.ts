import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const currentUser = await requireAuth();
    const userId = currentUser.id;

    // Fetch all tasks where current user is involved (task assignee, stage assignee, or subtask assignee)
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { assignments: { some: { userId } } },
          { stages: { some: { assignments: { some: { userId } } } } },
          { subtasks: { some: { assignments: { some: { userId } } } } },
        ],
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        creator: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        stages: {
          orderBy: { position: "asc" },
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
            subtasks: {
              orderBy: { position: "asc" },
              include: {
                assignments: {
                  include: {
                    user: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
        subtasks: {
          where: { stageId: null },
          orderBy: { position: "asc" },
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();

    const needsAttention: typeof tasks = [];
    const inProgress: typeof tasks = [];
    const waiting: typeof tasks = [];
    const planned: typeof tasks = [];
    const paused: typeof tasks = [];
    const blocked: typeof tasks = [];
    const completed: typeof tasks = [];

    for (const t of tasks) {
      const isDone = t.status === "DONE";
      const isPaused = t.status === "PAUSED";
      const isBlocked = t.status === "BLOCKED";
      const isPlanned = t.status === "PLANNED";
      const isOverdue = Boolean(t.deadline && new Date(t.deadline) < now && !isDone);

      // Check stage participation
      const hasStages = t.stages.length > 0;
      const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);
      const isCurrentActiveStageAssignee = Boolean(
        activeStage && activeStage.assignments.some((a) => a.userId === userId)
      );

      const isFutureStageAssignee = t.stages.some(
        (s) => !s.isActive && !s.isCompleted && s.assignments.some((a) => a.userId === userId)
      );

      const isDirectTaskAssignee = t.assignments.some((a) => a.userId === userId);
      const hasPendingDirectSubtask = t.subtasks.some(
        (st) => st.status !== "DONE" && st.assignments.some((a) => a.userId === userId)
      );

      if (isDone) {
        completed.push(t);
      } else if (isBlocked) {
        blocked.push(t);
        // Also needs attention
        needsAttention.push(t);
      } else if (isPaused) {
        paused.push(t);
      } else if (isOverdue) {
        needsAttention.push(t);
        if (t.status === "IN_PROGRESS") {
          inProgress.push(t);
        } else if (isPlanned) {
          planned.push(t);
        }
      } else if (hasStages) {
        // Sequential Workflow Awareness:
        if (isCurrentActiveStageAssignee) {
          if (t.status === "IN_PROGRESS") {
            inProgress.push(t);
          } else {
            planned.push(t);
          }
        } else if (isFutureStageAssignee) {
          waiting.push(t);
        } else if (isDirectTaskAssignee || hasPendingDirectSubtask) {
          if (t.status === "IN_PROGRESS") inProgress.push(t);
          else planned.push(t);
        } else if (!t.stages.some((s) => s.isActive && !s.isCompleted)) {
          // Defensive fallback: If task is active but no stage is marked active, keep visible in inProgress
          if (t.status === "IN_PROGRESS") {
            inProgress.push(t);
          } else {
            planned.push(t);
          }
        } else {
          // User completed their specific stage and another stage is active
          completed.push(t);
        }
      } else {
        // No stages: Direct task
        if (t.status === "IN_PROGRESS") {
          inProgress.push(t);
        } else if (isPlanned) {
          planned.push(t);
        } else {
          inProgress.push(t);
        }
      }
    }

    return NextResponse.json({
      groups: {
        needsAttention,
        inProgress,
        waiting,
        planned,
        paused,
        blocked,
        completed,
      },
      counts: {
        total: tasks.length,
        needsAttention: needsAttention.length,
        inProgress: inProgress.length,
        waiting: waiting.length,
        planned: planned.length,
        paused: paused.length,
        blocked: blocked.length,
        completed: completed.length,
      },
    });
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/my-work error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
