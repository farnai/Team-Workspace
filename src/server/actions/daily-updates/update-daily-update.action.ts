import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { updateDailyUpdateDto } from '@/server/dto/daily-update.dto';
import { canManageDailyUpdate } from '@/server/policies/daily-update.policy';
import { dailyUpdateRepository } from '@/server/repositories/daily-update.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function updateDailyUpdateAction(id: string, input: unknown) {
  const user = await requireUser();
  const data = updateDailyUpdateDto.parse(input);

  const existing = await dailyUpdateRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('ჩანაწერი ვერ მოიძებნა');
  }

  if (!canManageDailyUpdate(user, existing)) {
    throw new ForbiddenError('არ გაქვთ ამ ჩანაწერის რედაქტირების უფლება');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await dailyUpdateRepository.update(id, { content: data.content.trim() }, tx);

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'TASK_UPDATED',
        entityType: 'DAILY_UPDATE',
        entityId: id,
        oldValues: { content: existing.content },
        newValues: { content: updated.content },
        reason: 'დღიური ჩანაწერის რედაქტირება',
      },
      tx
    );

    return updated;
  });
}
