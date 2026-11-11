import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';

export async function getDeadlineRequestAction(taskId: string) {
  await requireUser();

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

  const pendingRequest = recentRequests.find((reqItem) => {
    const val = reqItem.newValues as { status?: string } | null;
    return val?.status === 'PENDING';
  });

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
