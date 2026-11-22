import { prisma } from "./prisma";
import { Department, SubtaskStatus, TaskStatus, TaskType, Prisma } from "@prisma/client";
import { logAuditEvent } from "./audit";

/**
 * Calculates progress from subtasks according to the core rule:
 * - Standard tasks: Progress = (Completed Subtasks / Total Active Subtasks) * 100
 *   (multi-assignee subtasks counted once; CANCELLED subtasks excluded).
 * - QA tasks: Each subtask represents a page block tested as Pass (DONE) or Failed (CANCELLED).
 *   Progress reflects tested blocks %. When all blocks are tested, even 1 Failed block
 *   automatically sets the QA page task status to BLOCKED (Failed); otherwise DONE (Passed).
 */
export async function calculateAndSyncTaskProgress(
  taskId: string,
  tx?: Prisma.TransactionClient,
  actorId?: string
): Promise<number> {
  const client = tx || prisma;

  const [task, subtasks] = await Promise.all([
    client.task.findUnique({
      where: { id: taskId },
      select: { status: true, department: true, type: true },
    }),
    client.subtask.findMany({
      where: { taskId },
      orderBy: { position: "asc" },
      select: { title: true, status: true },
    }),
  ]);

  const isQaTask =
    task?.department === Department.QA || task?.type === TaskType.QA;

  if (isQaTask) {
    const totalBlocks = subtasks.length;
    const passedBlocks = subtasks.filter(
      (s) => s.status === SubtaskStatus.DONE
    ).length;
    const failedBlocks = subtasks.filter(
      (s) => s.status === SubtaskStatus.CANCELLED
    ).length;
    const testedBlocks = passedBlocks + failedBlocks;
    const untestedBlocks = totalBlocks - testedBlocks;

    const calculatedProgress =
      totalBlocks > 0
        ? Math.round((testedBlocks / totalBlocks) * 100)
        : task?.status === TaskStatus.DONE
        ? 100
        : 0;

    const updateData: Prisma.TaskUpdateInput = {
      progress: calculatedProgress,
    };

    if (totalBlocks > 0 && task?.status !== TaskStatus.CANCELLED) {
      if (untestedBlocks === 0) {
        if (failedBlocks > 0) {
          updateData.status = TaskStatus.BLOCKED;
          updateData.blockedReason = `ტესტი ჩავარდა: დაზიანება დაფიქსირდა ${failedBlocks} ბლოკში`;
          updateData.completedAt = null;
        } else {
          updateData.status = TaskStatus.DONE;
          updateData.blockedReason = null;
          updateData.completedAt = new Date();
        }
      } else if (testedBlocks > 0) {
        if (
          task?.status === TaskStatus.BACKLOG ||
          task?.status === TaskStatus.PLANNED ||
          task?.status === TaskStatus.DONE ||
          task?.status === TaskStatus.BLOCKED
        ) {
          updateData.status = TaskStatus.IN_PROGRESS;
          updateData.completedAt = null;
          updateData.blockedReason =
            failedBlocks > 0
              ? `დაფიქსირებულია ${failedBlocks} დაზიანება (ტესტირება გრძელდება)`
              : null;
        }
      } else if (
        task?.status === TaskStatus.DONE ||
        task?.status === TaskStatus.BLOCKED
      ) {
        updateData.status = TaskStatus.PLANNED;
        updateData.completedAt = null;
        updateData.blockedReason = null;
      }
    }

    await client.task.update({
      where: { id: taskId },
      data: updateData,
    });

    const transitionedToVerdict =
      untestedBlocks === 0 &&
      totalBlocks > 0 &&
      task?.status !== TaskStatus.CANCELLED &&
      ((failedBlocks > 0 && task?.status !== TaskStatus.BLOCKED) ||
        (failedBlocks === 0 && task?.status !== TaskStatus.DONE));

    if (actorId && transitionedToVerdict) {
      await logAuditEvent({
        taskId,
        actorId,
        action: "TEST_RUN_RECORDED",
        entityType: "QA_PAGE_RUN",
        entityId: taskId,
        newValues: {
          status: failedBlocks > 0 ? "FAILED" : "PASSED",
          passedCount: passedBlocks,
          failedCount: failedBlocks,
          totalCount: totalBlocks,
          blocks: subtasks.map((s) => ({
            title: s.title,
            status: s.status === SubtaskStatus.DONE ? "PASSED" : "FAILED",
          })),
        },
        reason:
          failedBlocks > 0
            ? `ტესტი ჩავარდა — ${passedBlocks}/${totalBlocks} გამართული, ${failedBlocks} დაზიანება`
            : `ტესტი წარმატებულია — ${passedBlocks}/${totalBlocks} ბლოკი გამართულია`,
        tx: tx,
      });
    }

    return calculatedProgress;
  }

  const activeSubtasks = subtasks.filter(
    (s) => s.status !== SubtaskStatus.CANCELLED
  );
  const completedSubtasks = activeSubtasks.filter(
    (s) => s.status === SubtaskStatus.DONE
  );

  let calculatedProgress = 0;

  if (activeSubtasks.length > 0) {
    calculatedProgress = Math.round(
      (completedSubtasks.length / activeSubtasks.length) * 100
    );
  } else {
    // If no active subtasks exist, progress is either 0 or 100 depending on task completion
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
  const executeAdvance = async (client: Prisma.TransactionClient | typeof prisma) => {
    const currentStage = await client.workflowStage.findUnique({
      where: { id: stageId },
      include: {
        assignments: true,
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

    if (!currentStage.isActive) {
      throw new Error("მხოლოდ აქტიური ეტაპის დასრულებაა შესაძლებელი");
    }

    if (currentStage.isCompleted) {
      throw new Error("ეტაპი უკვე დასრულებულია");
    }

    // Permission check: Any active non-deleted user
    const actor = await client.user.findUnique({
      where: { id: actorId },
      select: { role: true, isActive: true, isDeleted: true },
    });

    if (!actor || !actor.isActive || actor.isDeleted) {
      throw new Error("არ გაქვთ ამ ეტაპის დასრულების უფლება");
    }

    if (currentStage.assignments.length === 0) {
      await client.stageAssignment.create({
        data: { stageId, userId: actorId },
      });
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
    await calculateAndSyncTaskProgress(currentStage.taskId, client as Prisma.TransactionClient);

    // Log audit
    await logAuditEvent({
      taskId: currentStage.taskId,
      actorId,
      action: "STAGE_COMPLETED",
      entityType: "STAGE",
      entityId: stageId,
      newValues: { stageTitle: currentStage.title, nextStageTitle: nextStage?.title ?? "დასრულებული" },
      reason: "ეტაპის წარმატებით დასრულება და ჰენდოფი",
      tx: client as Prisma.TransactionClient,
    });

    return { nextStage };
  };

  if (tx) {
    return executeAdvance(tx);
  } else {
    return prisma.$transaction((txClient) => executeAdvance(txClient));
  }
}
