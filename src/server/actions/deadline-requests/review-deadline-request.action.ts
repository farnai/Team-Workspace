import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { NotFoundError } from '@/server/http/errors';
import { reviewDeadlineRequestDto } from '@/server/dto/stage.dto';
import { auditRepository } from '@/server/repositories/audit.repository';
import { formatGeorgianDateShort } from '@/lib/dateUtils';

export async function reviewDeadlineRequestAction(taskId: string, input: unknown) {
  const admin = await requireAdmin();
  const { action, responseNote } = reviewDeadlineRequestDto.parse(input);

  const pendingEvents = await prisma.auditEvent.findMany({
    where: {
      taskId,
      entityType: 'DEADLINE_CHANGE_REQUEST',
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const pendingRequest = pendingEvents.find((e) => {
    const val = e.newValues as { status?: string } | null;
    return val?.status === 'PENDING';
  });

  if (!pendingRequest) {
    throw new NotFoundError('აქტიური მოთხოვნა არ მოიძებნა');
  }

  const reqData = pendingRequest.newValues as {
    requestedDeadline: string;
    reason: string;
    stageId?: string | null;
    requestedById: string;
    requestedByName: string;
  };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  const newDeadline = new Date(reqData.requestedDeadline);

  await prisma.$transaction(async (tx) => {
    if (action === 'APPROVE') {
      if (reqData.stageId) {
        await tx.workflowStage.update({
          where: { id: reqData.stageId },
          data: {
            deadline: newDeadline,
            deadlineLocked: true,
          },
        });
      } else {
        await tx.task.update({
          where: { id: taskId },
          data: {
            deadline: newDeadline,
            deadlineLocked: true,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: reqData.requestedById,
          taskId,
          title: 'დედლაინის მოთხოვნა დამტკიცდა',
          message: `თქვენი მოთხოვნა დედლაინის შეცვლაზე დავალებაზე #${task.taskNumber} დამტკიცებულია ადმინისტრატორის მიერ. ახალი ვადა: ${formatGeorgianDateShort(newDeadline)}.`,
        },
      });

      await auditRepository.log(
        {
          taskId,
          actorId: admin.id,
          action: 'DEADLINE_CHANGED',
          entityType: 'DEADLINE_CHANGE_REQUEST',
          entityId: taskId,
          oldValues: { status: 'PENDING', requestedDeadline: reqData.requestedDeadline },
          newValues: {
            status: 'APPROVED',
            appliedDeadline: newDeadline.toISOString(),
            approvedById: admin.id,
            responseNote: responseNote || null,
          },
          reason: responseNote || 'ადმინისტრატორმა დაამტკიცა დედლაინის ცვლილება',
        },
        tx
      );
    } else {
      await tx.notification.create({
        data: {
          userId: reqData.requestedById,
          taskId,
          title: 'დედლაინის მოთხოვნა უარყოფილია',
          message: `თქვენი მოთხოვნა დედლაინის შეცვლაზე დავალებაზე #${task.taskNumber} უარყოფილია ადმინისტრატორის მიერ.${
            responseNote ? ` მიზეზი: ${responseNote}` : ''
          }`,
        },
      });

      await auditRepository.log(
        {
          taskId,
          actorId: admin.id,
          action: 'DEADLINE_CHANGED',
          entityType: 'DEADLINE_CHANGE_REQUEST',
          entityId: taskId,
          oldValues: { status: 'PENDING' },
          newValues: {
            status: 'REJECTED',
            rejectedById: admin.id,
            responseNote: responseNote || null,
          },
          reason: responseNote || 'ადმინისტრატორმა უარყო დედლაინის ცვლილების მოთხოვნა',
        },
        tx
      );
    }
  });

  return {
    action,
    message: action === 'APPROVE' ? 'მოთხოვნა წარმატებით დამტკიცდა' : 'მოთხოვნა უარყოფილია',
  };
}

