import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/server/http/errors';
import { stageRepository } from '@/server/repositories/stage.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { calculateAndSyncTaskProgress } from '@/lib/workflow';

export async function deleteStageAction(stageId: string) {
  const user = await requireUser();

  const existing = await stageRepository.findById(stageId);
  if (!existing) {
    throw new NotFoundError('სამუშაო ეტაპი ვერ მოიძებნა');
  }

  const allStages = existing.task.stages;

  // Founder Decision 1: Do not allow deletion of the only remaining workflow stage
  if (allStages.length <= 1) {
    throw new ValidationError(
      'დავალების ერთადერთი სამუშაო ეტაპის წაშლა დაუშვებელია. ეტაპებზე დაფუძნებული დავალება არ შეიძლება დარჩეს ეტაპის გარეშე.'
    );
  }

  // Founder Decision 1 & 2: If deleting an active stage, verify valid active successor and assignee
  if (existing.isActive) {
    const remainingStages = allStages.filter((s: (typeof allStages)[number]) => s.id !== stageId);
    const nextActiveStage = remainingStages.find((s: (typeof allStages)[number]) => !s.isCompleted);

    if (!nextActiveStage) {
      throw new ValidationError(
        'აქტიური ეტაპის წაშლა შეუძლებელია, რადგან დავალებას არ გააჩნია მომდევნო სამუშაო ეტაპი. დავალების დასასრულებლად გამოიყენეთ დასრულების ფუნქცია.'
      );
    }

    if (!nextActiveStage.assignments || nextActiveStage.assignments.length === 0) {
      throw new ValidationError(
        `აქტიური ეტაპის წაშლა შეუძლებელია, რადგან მომდევნო ეტაპს ("${nextActiveStage.title}") არ ჰყავს პასუხისმგებელი შემსრულებელი. გთხოვთ ჯერ მიანიჭოთ შემსრულებელი მომდევნო ეტაპს.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete the targeted stage
    await stageRepository.delete(stageId, tx);

    // 2. Fetch remaining stages ordered by position
    const remainingStages = await stageRepository.findManyByTaskId(existing.taskId, tx);

    // 3. Re-index positions
    for (let i = 0; i < remainingStages.length; i++) {
      if (remainingStages[i].position !== i) {
        await stageRepository.update(remainingStages[i].id, { position: i }, tx);
        remainingStages[i].position = i;
      }
    }

    // 4. Handle active stage succession if deleted stage was active
    if (existing.isActive) {
      const nextActiveStage = remainingStages.find((s: (typeof remainingStages)[number]) => !s.isCompleted);
      if (nextActiveStage) {
        await stageRepository.update(nextActiveStage.id, { isActive: true }, tx);

        for (const a of nextActiveStage.assignments) {
          await tx.notification.create({
            data: {
              userId: a.userId,
              taskId: existing.taskId,
              title: 'სამუშაო ეტაპი გააქტიურდა',
              message: `წინა ეტაპის წაშლის შემდეგ თქვენი ეტაპი "${nextActiveStage.title}" გახდა აქტიური.`,
            },
          });
        }
      }
    }

    // 5. Recalculate progress
    await calculateAndSyncTaskProgress(existing.taskId, tx);

    // 6. Log audit event
    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'STAGE_DELETED',
        entityType: 'STAGE',
        entityId: stageId,
        oldValues: {
          title: existing.title,
          position: existing.position,
          isActive: existing.isActive,
          isCompleted: existing.isCompleted,
        },
        reason: 'სამუშაო ეტაპის წაშლა',
      },
      tx
    );
  });

  return { message: 'ეტაპი წარმატებით წაიშალა' };
}
