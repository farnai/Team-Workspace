import 'server-only';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';
import type { UpdateTestCaseDto } from '@/server/dto/test-case.dto';
import { canUpdateTestCase } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { toTestCaseDetailResource } from '@/server/resources/test-case.resource';

/** ანახლებს ტესტ-ქეისს და მის ნაბიჯებს ისე, რომ ძველი გაშვებების ისტორიული სნეფშოტები უცვლელი რჩება. */
export async function updateTestCaseAction(
  testCaseId: string,
  input: UpdateTestCaseDto,
  actor: User
) {
  const existing = await testCaseRepository.findById(testCaseId);
  if (!existing) {
    throw new NotFoundError('ტესტ-ქეისი ვერ მოიძებნა');
  }

  if (!canUpdateTestCase(actor, existing.task)) {
    throw new ForbiddenError('ტესტ-ქეისის რედაქტირების უფლება არ გაქვთ');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Prisma.TestCaseUncheckedUpdateInput = {
      updatedById: actor.id,
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.precondition !== undefined) updateData.precondition = input.precondition;
    if (input.position !== undefined) updateData.position = input.position;

    await testCaseRepository.update(testCaseId, updateData, tx);

    if (input.steps !== undefined) {
      await testCaseRepository.replaceSteps(
        testCaseId,
        input.steps.map((s) => ({
          action: s.action,
          testData: s.testData ?? null,
          expectedResult: s.expectedResult,
        })),
        tx
      );
    }

    const reloaded = await testCaseRepository.findById(testCaseId, tx);
    if (!reloaded) {
      throw new NotFoundError('ტესტ-ქეისი ვერ მოიძებნა');
    }

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: actor.id,
        action: 'TEST_CASE_UPDATED',
        entityType: 'TEST_CASE',
        entityId: testCaseId,
        oldValues: {
          title: existing.title,
          precondition: existing.precondition,
          stepsCount: existing.steps.length,
        },
        newValues: {
          title: reloaded.title,
          precondition: reloaded.precondition,
          stepsCount: reloaded.steps.length,
        },
        reason: `განახლდა ტესტ-ქეისი "${reloaded.title}"`,
      },
      tx
    );

    return reloaded;
  });

  return toTestCaseDetailResource(updated);
}
