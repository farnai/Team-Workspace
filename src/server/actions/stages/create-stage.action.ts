import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { createStageDto } from '@/server/dto/stage.dto';
import { stageRepository } from '@/server/repositories/stage.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function createStageAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const data = createStageDto.parse(input);

  const existingCount = await stageRepository.countByTaskId(taskId);
  const isActive = existingCount === 0;
  const parsedStart = data.startDate ? new Date(data.startDate) : null;
  const parsedDeadline = data.deadline ? new Date(data.deadline) : null;
  const hasInitialAssignees = Boolean(data.assigneeIds && data.assigneeIds.length > 0);
  const shouldLock = Boolean(hasInitialAssignees && parsedDeadline);

  return prisma.$transaction(async (tx) => {
    const created = await stageRepository.create(
      {
        task: { connect: { id: taskId } },
        title: data.title,
        description: data.description,
        position: existingCount,
        isActive,
        startDate: parsedStart,
        deadline: parsedDeadline,
        deadlineLocked: shouldLock,
      },
      tx
    );

    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await stageRepository.syncAssignees(created.id, data.assigneeIds, tx);
    }

    await auditRepository.log(
      {
        taskId,
        actorId: user.id,
        action: 'STAGE_CREATED',
        entityType: 'STAGE',
        entityId: created.id,
        newValues: { title: data.title, position: existingCount, assigneeIds: data.assigneeIds },
        reason: 'ახალი სამუშაო ეტაპის შექმნა',
      },
      tx
    );

    return created;
  });
}
