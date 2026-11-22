import 'server-only';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { TEST_RUN_STATUS_LABELS, type TestRunVerdict } from '@/lib/labels';
import { ForbiddenError, NotFoundError, ValidationError } from '@/server/http/errors';
import type { CreateTestRunDto } from '@/server/dto/test-case.dto';
import { canExecuteTestRun } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { toTestRunResource } from '@/server/resources/test-case.resource';

/** აფიქსირებს ტესტ-ქეისის ახალ გაშვებას ნაბიჯების უცვლელი ასლით, მტკიცებულებებით და აუდიტით. */
export async function createTestRunAction(
  testCaseId: string,
  input: CreateTestRunDto,
  actor: User
) {
  if (!canExecuteTestRun(actor)) {
    throw new ForbiddenError('ტესტის გაშვების უფლება არ გაქვთ');
  }

  const run = await prisma.$transaction(async (tx) => {
    const testCase = await testCaseRepository.findById(testCaseId, tx);
    if (!testCase) {
      throw new NotFoundError('ტესტ-ქეისი ვერ მოიძებნა');
    }

    const attachmentIds = Array.from(new Set(input.attachmentIds));
    if (attachmentIds.length > 0) {
      const matchedAttachments = await testCaseRepository.findTaskAttachmentsByIds(
        testCase.taskId,
        attachmentIds,
        tx
      );
      if (matchedAttachments.length !== attachmentIds.length) {
        throw new ValidationError('მტკიცებულების ფაილი ვერ მოიძებნა ან არ ეკუთვნის ამ დავალებას');
      }
    }

    const nextRunNumber = await testCaseRepository.getNextRunNumber(testCaseId, tx);

    const resultByStepId = new Map(
      input.stepResults.filter((r) => r.stepId).map((r) => [r.stepId!, r])
    );
    const resultByPosition = new Map(input.stepResults.map((r) => [r.position, r]));

    const stepsSnapshot = testCase.steps.map((step, index) => {
      const matched =
        resultByStepId.get(step.id) ??
        resultByPosition.get(step.position) ??
        resultByPosition.get(index);

      return {
        stepId: step.id,
        position: step.position,
        action: step.action,
        testData: step.testData ?? null,
        expectedResult: step.expectedResult,
        status: matched?.status ?? null,
        actualNote: matched?.actualNote ?? null,
      };
    });

    const createdRun = await testCaseRepository.createRun(
      {
        testCaseId: testCase.id,
        taskId: testCase.taskId,
        runNumber: nextRunNumber,
        status: input.status,
        actualResult: input.actualResult ?? null,
        reason: input.reason ?? null,
        caseTitleSnapshot: testCase.title,
        preconditionSnapshot: testCase.precondition ?? null,
        stepsSnapshot: stepsSnapshot as unknown as Prisma.InputJsonValue,
        executedById: actor.id,
        evidences:
          attachmentIds.length > 0
            ? {
                create: attachmentIds.map((attachmentId) => ({ attachmentId })),
              }
            : undefined,
      },
      tx
    );

    const statusLabel = TEST_RUN_STATUS_LABELS[input.status as TestRunVerdict].label;

    await auditRepository.log(
      {
        taskId: testCase.taskId,
        actorId: actor.id,
        action: 'TEST_RUN_RECORDED',
        entityType: 'TEST_RUN',
        entityId: createdRun.id,
        newValues: {
          testCaseId: testCase.id,
          testCaseTitle: testCase.title,
          runNumber: nextRunNumber,
          status: input.status,
          evidenceCount: attachmentIds.length,
        },
        reason: input.reason
          ? input.reason
          : `${testCase.title} (#${nextRunNumber}): ${statusLabel}${
              input.actualResult ? ` — ${input.actualResult}` : ''
            }`,
      },
      tx
    );

    return createdRun;
  });

  return toTestRunResource(run);
}
