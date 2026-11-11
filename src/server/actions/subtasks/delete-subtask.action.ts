import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError } from '@/server/http/errors';
import { subtaskRepository } from '@/server/repositories/subtask.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { calculateAndSyncTaskProgress } from '@/lib/workflow';

export async function deleteSubtaskAction(subtaskId: string) {
  const user = await requireUser();

  const existing = await subtaskRepository.findById(subtaskId);
  if (!existing) {
    throw new NotFoundError('საბტასკი ვერ მოიძებნა');
  }

  await prisma.$transaction(async (tx) => {
    await subtaskRepository.delete(subtaskId, tx);

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'SUBTASK_DELETED',
        entityType: 'SUBTASK',
        entityId: subtaskId,
        oldValues: { title: existing.title, status: existing.status },
        reason: 'საბტასკის წაშლა',
      },
      tx
    );
  });

  const progress = await calculateAndSyncTaskProgress(existing.taskId);
  return { progress };
}
