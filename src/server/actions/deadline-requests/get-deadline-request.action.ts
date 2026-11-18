import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';

export async function getDeadlineRequestAction(taskId: string, actor?: User) {
  if (!actor) {
    await requireUser();
  }

  const recentRequests = await prisma.auditEvent.findMany({
    where: {
      taskId,
      entityType: 'DEADLINE_CHANGE_REQUEST',
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      actor: { select: { id: true, name: true, avatarUrl: true, role: true } },
    },
  });

  const latestEvent = recentRequests[0];
  const latestVal = latestEvent?.newValues as { status?: string } | null;
  const pendingRequest = latestVal?.status === 'PENDING' ? latestEvent : undefined;

  return {
    pendingRequest: pendingRequest
      ? {
          id: pendingRequest.id,
          createdAt: pendingRequest.createdAt,
          actor: pendingRequest.actor,
          requestedDeadline: (pendingRequest.newValues as Record<string, unknown>)?.requestedDeadline,
          reason: (pendingRequest.newValues as Record<string, unknown>)?.reason,
          stageId: (pendingRequest.newValues as Record<string, unknown>)?.stageId,
        }
      : null,
    history: recentRequests,
  };
}

