import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { createSubtaskDto } from '@/server/dto/subtask.dto';
import { subtaskRepository } from '@/server/repositories/subtask.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { calculateAndSyncTaskProgress } from '@/lib/workflow';

export async function createSubtaskAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const data = createSubtaskDto.parse(input);

  const existingCount = await subtaskRepository.countByTaskAndStage(taskId, data.stageId);
  const parsedDeadline = data.deadline ? new Date(data.deadline) : null;
  const hasInitialAssignees = Boolean(data.assigneeIds && data.assigneeIds.length > 0);
  const shouldLock = Boolean(hasInitialAssignees && parsedDeadline);

  const subtask = await prisma.$transaction(async (tx) => {
    const created = await subtaskRepository.create(
      {
        task: { connect: { id: taskId } },
        stage: data.stageId ? { connect: { id: data.stageId } } : undefined,
        title: data.title,
        description: data.description,
        position: existingCount,
        deadline: parsedDeadline,
        deadlineLocked: shouldLock,
        status: 'TODO',
      },
      tx
    );

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await subtaskRepository.syncAssignees(created.id, data.assigneeIds, tx);
    }

    await auditRepository.log(
      {
        taskId,
        actorId: user.id,
        action: 'SUBTASK_CREATED',
        entityType: 'SUBTASK',
        entityId: created.id,
        newValues: { title: data.title, stageId: data.stageId, assigneeIds: data.assigneeIds },
        reason: 'ახალი საბტასკის დამატება',
      },
      tx
    );

    return created;
  });

  const progress = await calculateAndSyncTaskProgress(taskId);
  return { subtask, progress };
}

