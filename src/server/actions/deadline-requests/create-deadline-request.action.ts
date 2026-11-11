import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError } from '@/server/http/errors';
import { createDeadlineRequestDto } from '@/server/dto/stage.dto';
import { auditRepository } from '@/server/repositories/audit.repository';
import { formatGeorgianDateShort } from '@/lib/dateUtils';
import { Role } from '@prisma/client';

export async function createDeadlineRequestAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const { requestedDeadline, reason, stageId } = createDeadlineRequestDto.parse(input);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      stages: { orderBy: { position: 'asc' } },
    },
  });

  if (!task) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  const targetStage = stageId ? task.stages.find((s) => s.id === stageId) : null;
  const admins = await prisma.user.findMany({
    where: { role: Role.ADMIN, isActive: true },
    select: { id: true },
  });

  const parsedDate = new Date(requestedDeadline);
  const dateStr = formatGeorgianDateShort(parsedDate);

  const audit = await auditRepository.log({
    taskId,
    actorId: user.id,
    action: 'DEADLINE_CHANGED',
    entityType: 'DEADLINE_CHANGE_REQUEST',
    entityId: taskId,
    newValues: {
      requestedDeadline: parsedDate.toISOString(),
      reason: reason.trim(),
      stageId: stageId || null,
      stageTitle: targetStage?.title || null,
      requestedById: user.id,
      requestedByName: user.name,
      status: 'PENDING',
    },
    reason: reason.trim(),
  });

  for (const admin of admins) {
    await prisma.notification.create({
      data: {
        userId: admin.id,
        taskId,
        title: 'დედლაინის ცვლილების მოთხოვნა',
        message: `${user.name}-მა მოითხოვა დედლაინის გადაწევა დავალებაზე #${task.taskNumber} (${task.title})${
          targetStage ? ` [${targetStage.title}]` : ''
        }. სასურველი ვადა: ${dateStr}. მიზეზი: ${reason.trim()}`,
      },
    });
  }

  return {
    message: 'მოთხოვნა წარმატებით გაიგზავნა ადმინისტრატორთან',
    requestId: audit.id,
  };
}
