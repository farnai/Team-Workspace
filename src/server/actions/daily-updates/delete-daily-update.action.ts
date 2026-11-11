import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { canManageDailyUpdate } from '@/server/policies/daily-update.policy';
import { dailyUpdateRepository } from '@/server/repositories/daily-update.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function deleteDailyUpdateAction(id: string) {
  const user = await requireUser();

  const existing = await dailyUpdateRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('ჩანაწერი ვერ მოიძებნა');
  }

  if (!canManageDailyUpdate(user, existing)) {
    throw new ForbiddenError('არ გაქვთ ამ ჩანაწერის წაშლის უფლება');
  }

  await prisma.$transaction(async (tx) => {
    await dailyUpdateRepository.delete(id, tx);

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'TASK_UPDATED',
        entityType: 'DAILY_UPDATE',
        entityId: id,
        oldValues: { content: existing.content },
        reason: 'დღიური ჩანაწერის წაშლა',
      },
      tx
    );
  });

  return { message: 'ჩანაწერი წარმატებით წაიშალა' };
}
