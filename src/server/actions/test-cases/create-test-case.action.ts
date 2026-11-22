import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';
import type { CreateTestCaseDto } from '@/server/dto/test-case.dto';
import { canCreateTestCase } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { toTestCaseDetailResource } from '@/server/resources/test-case.resource';

/** ქმნის დავალებასთან დაკავშირებულ ტესტ-ქეისს დალაგებული ნაბიჯებით ერთ ტრანზაქციაში. */
export async function createTestCaseAction(
  taskId: string,
  input: CreateTestCaseDto,
  actor: User
) {
  const task = await testCaseRepository.findTaskBrief(taskId);
  if (!task) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  if (!canCreateTestCase(actor, task)) {
    throw new ForbiddenError('ტესტ-ქეისის შექმნის უფლება არ გაქვთ');
  }

  const created = await prisma.$transaction(async (tx) => {
    const position = await testCaseRepository.getNextPosition(taskId, tx);

    const testCase = await testCaseRepository.create(
      {
        taskId,
        position,
        title: input.title,
        precondition: input.precondition ?? null,
        createdById: actor.id,
        steps: {
          create: input.steps.map((step, index) => ({
            position: index,
            action: step.action,
            testData: step.testData ?? null,
            expectedResult: step.expectedResult,
          })),
        },
      },
      tx
    );

    await auditRepository.log(
      {
        taskId,
        actorId: actor.id,
        action: 'TEST_CASE_CREATED',
        entityType: 'TEST_CASE',
        entityId: testCase.id,
        newValues: {
          title: testCase.title,
          stepsCount: testCase.steps.length,
        },
        reason: `დაემატა ტესტ-ქეისი "${testCase.title}" (${testCase.steps.length} ნაბიჯი)`,
      },
      tx
    );

    return testCase;
  });

  return toTestCaseDetailResource(created);
}
