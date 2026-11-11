import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { createDailyUpdateDto } from '@/server/dto/daily-update.dto';
import { dailyUpdateRepository } from '@/server/repositories/daily-update.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function createDailyUpdateAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const data = createDailyUpdateDto.parse(input);

  return prisma.$transaction(async (tx) => {
    const created = await dailyUpdateRepository.create(
      {
        taskId,
        userId: user.id,
        content: data.content,
      },
      tx
    );

    await auditRepository.log(
      {
        taskId,
        actorId: user.id,
        action: 'DAILY_UPDATE_ADDED',
        entityType: 'DAILY_UPDATE',
        entityId: created.id,
        newValues: { snippet: data.content.slice(0, 100) },
        reason: 'დღიური ჩანაწერის დამატება: ' + data.content.slice(0, 40),
      },
      tx
    );

    return created;
  });
}

