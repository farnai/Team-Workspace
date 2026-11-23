import 'server-only';
import { SubtaskStatus, TaskStatus, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canUpdateTask } from '@/server/policies/task.policy';
import { taskRepository } from '@/server/repositories/task.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';

/**
 * ასრულებს QA გვერდის ტესტირების მიმდინარე სესიას:
 * 1) იწერს ტესტირების შედეგს (TEST_RUN_RECORDED) ისტორიაში ბლოკების სტატუსებითა და შენიშვნებით
 * 2) აბრუნებს გვერდსა და მის ბლოკებს საწყის, სუფთა მდგომარეობაში შემდეგი ტესტირებისთვის.
 */
export async function finishQaRunAction(taskId: string, actor: User) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignments: true,
      subtasks: { orderBy: { position: 'asc' } },
    },
  });

  if (!existing) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  if (!canUpdateTask(actor, existing)) {
    throw new ForbiddenError('ტესტირების დასრულების უფლება არ გაქვთ');
  }

  const totalCount = existing.subtasks.length;
  const passedCount = existing.subtasks.filter((s) => s.status === SubtaskStatus.DONE).length;
  const failedCount = existing.subtasks.filter((s) => s.status === SubtaskStatus.CANCELLED).length;
  const verdict: 'PASSED' | 'FAILED' = failedCount > 0 ? 'FAILED' : 'PASSED';

  await prisma.$transaction(async (tx) => {
    await auditRepository.log(
      {
        taskId,
        actorId: actor.id,
        action: 'TEST_RUN_RECORDED',
        entityType: 'QA_PAGE_RUN',
        entityId: taskId,
        newValues: {
          status: verdict,
          passedCount,
          failedCount,
          totalCount,
          blocks: existing.subtasks.map((s) => ({
            title: s.title,
            status:
              s.status === SubtaskStatus.DONE
                ? 'PASSED'
                : s.status === SubtaskStatus.CANCELLED
                ? 'FAILED'
                : 'TODO',
            ...(s.description ? { note: s.description } : {}),
          })),
        },
        reason:
          failedCount > 0
            ? `ტესტი ჩავარდა — ${passedCount}/${totalCount} გამართული, ${failedCount} დაზიანება`
            : `ტესტი წარმატებულია — ${passedCount}/${totalCount} ბლოკი გამართულია`,
      },
      tx
    );

    // Reset blocks and page back to clean initial state for the next scheduled/manual check
    await tx.subtask.updateMany({
      where: { taskId },
      data: {
        status: SubtaskStatus.TODO,
        description: null,
        completedById: null,
        completedAt: null,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.BACKLOG,
        progress: 0,
        startDate: null,
        blockedReason: null,
        completedAt: null,
      },
    });

    await taskRepository.setAssignees(taskId, [], tx);
  });

  return {
    verdict,
    passedCount,
    failedCount,
    totalCount,
  };
}
