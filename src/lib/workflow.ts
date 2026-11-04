import { prisma } from "./prisma";
import { SubtaskStatus, TaskStatus, Prisma } from "@prisma/client";
import { logAuditEvent } from "./audit";

/**
 * Calculates progress from subtasks according to the core rule:
 * Progress = (Completed Subtasks / Total Active Subtasks) * 100
 * Subtasks with multiple assignees are counted once.
 * Cancelled subtasks are excluded from the denominator.
 */
export async function calculateAndSyncTaskProgress(
  taskId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const client = tx || prisma;

  const subtasks = await client.subtask.findMany({
    where: { taskId },
    select: { status: true },
  });

  const activeSubtasks = subtasks.filter((s) => s.status !== SubtaskStatus.CANCELLED);
  const completedSubtasks = activeSubtasks.filter((s) => s.status === SubtaskStatus.DONE);

  let calculatedProgress = 0;

  if (activeSubtasks.length > 0) {
    calculatedProgress = Math.round((completedSubtasks.length / activeSubtasks.length) * 100);
  } else {
    // If no active subtasks exist, progress is either 0 or 100 depending on task completion
    const task = await client.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    });
    calculatedProgress = task?.status === TaskStatus.DONE ? 100 : 0;
  }

  await client.task.update({
    where: { id: taskId },
    data: { progress: calculatedProgress },
  });

  return calculatedProgress;
}

/**
 * Checks deadline modification authorization.
 * If deadline is already locked, only an ADMIN can modify it.
 */
export function validateDeadlineModification({
  isDeadlineLocked,
  existingDeadline,
  incomingDeadline,
  isAdmin,
}: {
  isDeadlineLocked: boolean;
  existingDeadline: Date | null;
  incomingDeadline?: Date | null;
  isAdmin: boolean;
}): { allowed: boolean; error?: string } {
  if (!isDeadlineLocked) {
    return { allowed: true };
  }

  // If deadline is already locked and incoming deadline was specified
  if (incomingDeadline !== undefined) {
    const existingTime = existingDeadline ? new Date(existingDeadline).getTime() : null;
    const incomingTime = incomingDeadline ? new Date(incomingDeadline).getTime() : null;

    if (existingTime !== incomingTime && !isAdmin) {
      return {
        allowed: false,
        error: "დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს. (Deadline is locked)",
      };
    }
  }

  return { allowed: true };
}

/**
 * Handles completing a workflow stage and handing off to the next stage atomically.
 */
export async function advanceWorkflowStage({
  stageId,
  actorId,
  tx,
}: {
  stageId: string;
  actorId: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = tx || prisma;

  const currentStage = await client.workflowStage.findUnique({
    where: { id: stageId },
    include: {
      subtasks: true,
      task: {
        include: {
          stages: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!currentStage) {
    throw new Error("სამუშაო ეტაპი ვერ მოიძებნა");
  }

  // Check that all non-cancelled subtasks in this stage are completed
  const unfinishedSubtasks = currentStage.subtasks.filter(
    (s) => s.status !== SubtaskStatus.DONE && s.status !== SubtaskStatus.CANCELLED
  );

  if (unfinishedSubtasks.length > 0) {
    throw new Error("ეტაპის დასასრულებლად საჭიროა მისი ყველა საბტასკის შესრულება");
  }

  const now = new Date();

  // Mark current stage done
  await client.workflowStage.update({
    where: { id: stageId },
    data: {
      isCompleted: true,
      completedAt: now,
      isActive: false,
    },
  });

  // Find next sequential stage
  const stages = currentStage.task.stages;
  const currentIndex = stages.findIndex((s) => s.id === stageId);
  const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;

  if (nextStage) {
    await client.workflowStage.update({
      where: { id: nextStage.id },
      data: { isActive: true },
    });

    // Notify assignees of next stage
    const nextAssignees = await client.stageAssignment.findMany({
      where: { stageId: nextStage.id },
      select: { userId: true },
    });

    for (const a of nextAssignees) {
      await client.notification.create({
        data: {
          userId: a.userId,
          taskId: currentStage.taskId,
          title: "სამუშაო ეტაპი გააქტიურდა",
          message: `ტასკზე "${currentStage.task.title}" თქვენი ეტაპი: "${nextStage.title}" გახდა აქტიური.`,
        },
      });
    }
  } else {
    // All stages finished
    await client.task.update({
      where: { id: currentStage.taskId },
      data: {
        status: TaskStatus.DONE,
        completedAt: now,
      },
    });
  }

  // Recalculate overall progress
  await calculateAndSyncTaskProgress(currentStage.taskId, client);

  // Log audit
  await logAuditEvent({
    taskId: currentStage.taskId,
    actorId,
    action: "STAGE_COMPLETED",
    entityType: "STAGE",
    entityId: stageId,
    newValues: { stageTitle: currentStage.title, nextStageTitle: nextStage?.title ?? "დასრულებული" },
    reason: "ეტაპის წარმატებით დასრულება და ჰენდოფი",
    tx: client,
  });

  return { nextStage };
}
