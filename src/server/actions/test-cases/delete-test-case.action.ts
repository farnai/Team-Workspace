import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';
import { canDeleteTestCase } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

/** შლის ტესტ-ქეისს (მხოლოდ ადმინისტრატორი ან ტესტ-ქეისის შემქმნელი) აუდიტის ჩაწერით. */
export async function deleteTestCaseAction(testCaseId: string, actor: User) {
  const existing = await testCaseRepository.findById(testCaseId);
  if (!existing) {
    throw new NotFoundError('ტესტ-ქეისი ვერ მოიძებნა');
  }

  if (!canDeleteTestCase(actor, existing)) {
    throw new ForbiddenError('ტესტ-ქეისის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს ან შემქმნელს');
  }

  await prisma.$transaction(async (tx) => {
    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: actor.id,
        action: 'TEST_CASE_DELETED',
        entityType: 'TEST_CASE',
        entityId: testCaseId,
        oldValues: {
          title: existing.title,
          runsCount: existing.runs.length,
        },
        reason: `წაიშალა ტესტ-ქეისი "${existing.title}"`,
      },
      tx
    );

    await testCaseRepository.delete(testCaseId, tx);
  });

  return { success: true };
}
