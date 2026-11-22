import 'server-only';
import { SubtaskStatus, TaskStatus, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getTbilisiTodayString } from '@/lib/date';
import { canUpdateTask } from '@/server/policies/task.policy';
import { taskRepository } from '@/server/repositories/task.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';

/**
 * იწყებს QA გვერდის ტესტირების ახალ სესიას:
 * 1) საჭიროების შემთხვევაში ინახავს წინა გაშვების შედეგს ისტორიაში
 * 2) ანულებს ყველა ბლოკის სტატუსს (TODO) ახალი შემოწმებისთვის
 * 3) აყენებს IN_PROGRESS სტატუსს, დღევანდელ თარიღს (Asia/Tbilisi) და მიმდინარე ტესტერს.
 */
export async function startQaRunAction(taskId: string, actor: User) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignments: true,
      subtasks: { orderBy: { position: 'asc' } },
      auditEvents: {
        where: { action: 'TEST_RUN_RECORDED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  if (!canUpdateTask(actor, existing)) {
    throw new ForbiddenError('ტესტირების დაწყების უფლება არ გაქვთ');
  }

  const todayStr = getTbilisiTodayString();
  const [y, m, d] = todayStr.split('-');
  const todayFormatted = `${m}.${d}.${y}`;
  const startDate = new Date(`${todayStr}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    const testedSubtasks = existing.subtasks.filter(
      (s) => s.status === SubtaskStatus.DONE || s.status === SubtaskStatus.CANCELLED
    );

    if (
      testedSubtasks.length > 0 &&
      (existing.status === TaskStatus.DONE || existing.status === TaskStatus.BLOCKED) &&
      existing.auditEvents.length === 0
    ) {
      const passedCount = existing.subtasks.filter((s) => s.status === SubtaskStatus.DONE).length;
      const failedCount = existing.subtasks.filter((s) => s.status === SubtaskStatus.CANCELLED).length;
      await auditRepository.log(
        {
          taskId,
          actorId: actor.id,
          action: 'TEST_RUN_RECORDED',
          entityType: 'QA_PAGE_RUN',
          entityId: taskId,
          newValues: {
            status: failedCount > 0 ? 'FAILED' : 'PASSED',
            passedCount,
            failedCount,
            totalCount: existing.subtasks.length,
            blocks: existing.subtasks.map((s) => ({
              title: s.title,
              status: s.status === SubtaskStatus.DONE ? 'PASSED' : s.status === SubtaskStatus.CANCELLED ? 'FAILED' : 'TODO',
            })),
          },
          reason:
            failedCount > 0
              ? `წინა ტესტის შედეგი: ჩავარდა (${passedCount}/${existing.subtasks.length} გამართული, ${failedCount} დაზიანება)`
              : `წინა ტესტის შედეგი: წარმატებული (${passedCount}/${existing.subtasks.length} ბლოკი)`,
        },
        tx
      );
    }

    await tx.subtask.updateMany({
      where: { taskId },
      data: {
        status: SubtaskStatus.TODO,
        completedById: null,
        completedAt: null,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.IN_PROGRESS,
        progress: 0,
        startDate,
        blockedReason: null,
        completedAt: null,
      },
    });

    const otherAssignees = existing.assignments
      .map((a) => a.userId)
      .filter((id) => id !== actor.id);
    await taskRepository.setAssignees(taskId, [actor.id, ...otherAssignees], tx);

    await auditRepository.log(
      {
        taskId,
        actorId: actor.id,
        action: 'STATUS_CHANGED',
        entityType: 'QA_PAGE_RUN',
        entityId: taskId,
        oldValues: { status: existing.status },
        newValues: { status: TaskStatus.IN_PROGRESS, startedBy: actor.name, date: todayFormatted },
        reason: `ტესტირება დაიწყო (${todayFormatted})`,
      },
      tx
    );
  });

  return taskRepository.findById(taskId);
}
