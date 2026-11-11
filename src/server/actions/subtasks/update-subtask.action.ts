import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { updateSubtaskDto } from '@/server/dto/subtask.dto';
import { subtaskRepository } from '@/server/repositories/subtask.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { calculateAndSyncTaskProgress, validateDeadlineModification } from '@/lib/workflow';
import { SubtaskStatus, Role, Prisma } from '@prisma/client';

export async function updateSubtaskAction(subtaskId: string, input: unknown) {
  const user = await requireUser();
  const data = updateSubtaskDto.parse(input);

  const existing = await subtaskRepository.findById(subtaskId);
  if (!existing) {
    throw new NotFoundError('საბტასკი ვერ მოიძებნა');
  }

  const isAdmin = user.role === Role.ADMIN;
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

  const dataToUpdate: Prisma.SubtaskUpdateInput = {};
  if (data.title !== undefined) dataToUpdate.title = data.title;
  if (data.description !== undefined) dataToUpdate.description = data.description;
  if (data.position !== undefined) dataToUpdate.position = data.position;
  if (data.stageId !== undefined) {
    dataToUpdate.stage = data.stageId ? { connect: { id: data.stageId } } : { disconnect: true };
  }
  if (incomingStart !== undefined) dataToUpdate.startDate = incomingStart;
  if (incomingDeadline !== undefined) dataToUpdate.deadline = incomingDeadline;

  if (
    !existing.deadlineLocked &&
    ((incomingDeadline || existing.deadline) &&
      ((data.assigneeIds && data.assigneeIds.length > 0) || existing.assignments.length > 0))
  ) {
    dataToUpdate.deadlineLocked = true;
  }

  const isCompleting = data.status === SubtaskStatus.DONE && existing.status !== SubtaskStatus.DONE;
  const isReopening = data.status === SubtaskStatus.TODO && existing.status === SubtaskStatus.DONE;

  if (data.status !== undefined) {
    dataToUpdate.status = data.status;
    if (isCompleting) {
      dataToUpdate.completedBy = { connect: { id: user.id } };
      dataToUpdate.completedAt = new Date();
    } else if (isReopening) {
      dataToUpdate.completedBy = { disconnect: true };
      dataToUpdate.completedAt = null;
    }
  }

  const updatedSubtask = await prisma.$transaction(async (tx) => {
    if (data.assigneeIds !== undefined) {
      await subtaskRepository.syncAssignees(subtaskId, data.assigneeIds, tx);
    }

    const updated = await subtaskRepository.update(subtaskId, dataToUpdate, tx);

    if (incomingDeadline !== undefined && existing.deadline?.getTime() !== incomingDeadline?.getTime()) {
      await auditRepository.log(
        {
          taskId: existing.taskId,
          actorId: user.id,
          action: 'DEADLINE_CHANGED',
          entityType: 'SUBTASK',
          entityId: subtaskId,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || 'ადმინისტრატორის მიერ საბტასკის დედლაინის შეცვლა',
        },
        tx
      );
    }

    if (isCompleting) {
      await auditRepository.log(
        {
          taskId: existing.taskId,
          actorId: user.id,
          action: 'SUBTASK_COMPLETED',
          entityType: 'SUBTASK',
          entityId: subtaskId,
          newValues: { status: 'DONE', subtaskTitle: existing.title },
          reason: 'საბტასკის შესრულება',
        },
        tx
      );
    } else if (isReopening) {
      await auditRepository.log(
        {
          taskId: existing.taskId,
          actorId: user.id,
          action: 'SUBTASK_REOPENED',
          entityType: 'SUBTASK',
          entityId: subtaskId,
          newValues: { status: 'TODO', subtaskTitle: existing.title },
          reason: 'საბტასკის ხელახლა გახსნა',
        },
        tx
      );
    }

    return updated;
  });

  const newProgress = await calculateAndSyncTaskProgress(existing.taskId);

  return { subtask: updatedSubtask, progress: newProgress };
}

