import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { updateStageDto } from '@/server/dto/stage.dto';
import { stageRepository } from '@/server/repositories/stage.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { validateDeadlineModification } from '@/lib/workflow';
import { Role, Prisma } from '@prisma/client';

export async function updateStageAction(stageId: string, input: unknown) {
  const user = await requireUser();
  const data = updateStageDto.parse(input);

  const existing = await stageRepository.findById(stageId);
  if (!existing) {
    throw new NotFoundError('სამუშაო ეტაპი ვერ მოიძებნა');
  }

  const isAdmin = user.role === Role.ADMIN;
  const isCreator = existing.task?.createdById === user.id;
  const isAssignee = existing.assignments.some((a: (typeof existing.assignments)[number]) => a.userId === user.id);
  const isAuthorized = isAdmin || isCreator || isAssignee;

  if (!isAuthorized) {
    throw new ForbiddenError('არ გაქვთ ამ ეტაპის რედაქტირების უფლება');
  }

  if ((data.isActive !== undefined || data.position !== undefined) && !isAdmin && !isCreator) {
    throw new ForbiddenError('ეტაპის გააქტიურების ან თანამიმდევრობის შეცვლის უფლება აქვს მხოლოდ ადმინს ან ტასკის შემქმნელს');
  }

  const incomingDeadline =
    data.deadline !== undefined
      ? data.deadline === null
        ? null
        : new Date(data.deadline)
      : undefined;

  const deadlineCheck = validateDeadlineModification({
    isDeadlineLocked: existing.deadlineLocked,
    existingDeadline: existing.deadline,
    incomingDeadline,
    isAdmin,
  });

  if (!deadlineCheck.allowed) {
    throw new ForbiddenError(deadlineCheck.error || 'დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს');
  }

  const incomingStart =
    data.startDate !== undefined
      ? data.startDate === null
        ? null
        : new Date(data.startDate)
      : undefined;

  const dataToUpdate: Prisma.WorkflowStageUpdateInput = {};
  if (data.title !== undefined) dataToUpdate.title = data.title;
  if (data.description !== undefined) dataToUpdate.description = data.description;
  if (incomingStart !== undefined) dataToUpdate.startDate = incomingStart;
  if (incomingDeadline !== undefined) dataToUpdate.deadline = incomingDeadline;
  if (data.position !== undefined) dataToUpdate.position = data.position;
  if (data.isActive !== undefined) dataToUpdate.isActive = data.isActive;

  if (
    !existing.deadlineLocked &&
    ((incomingDeadline || existing.deadline) &&
      ((data.assigneeIds && data.assigneeIds.length > 0) || existing.assignments.length > 0))
  ) {
    dataToUpdate.deadlineLocked = true;
  }

  return prisma.$transaction(async (tx) => {
    if (data.assigneeIds !== undefined) {
      await stageRepository.syncAssignees(stageId, data.assigneeIds, tx);
    }

    const updated = await stageRepository.update(stageId, dataToUpdate, tx);

    if (incomingDeadline !== undefined && existing.deadline?.getTime() !== incomingDeadline?.getTime()) {
      await auditRepository.log(
        {
          taskId: existing.taskId,
          actorId: user.id,
          action: 'DEADLINE_CHANGED',
          entityType: 'STAGE',
          entityId: stageId,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || 'ადმინისტრატორის მიერ ეტაპის დედლაინის შეცვლა',
        },
        tx
      );
    }

    if (data.position !== undefined && data.position !== existing.position) {
      await auditRepository.log(
        {
          taskId: existing.taskId,
          actorId: user.id,
          action: 'STAGE_REORDERED',
          entityType: 'STAGE',
          entityId: stageId,
          oldValues: { position: existing.position },
          newValues: { position: data.position },
          reason: 'სამუშაო ეტაპის რიგითობის შეცვლა',
        },
        tx
      );
    }

    return updated;
  });
}
