import 'server-only';
import type { User } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';
import { canViewTestCases } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { toTestCaseListItemResource } from '@/server/resources/test-case.resource';

export async function listTaskTestCasesAction(taskId: string, actor: User) {
  if (!canViewTestCases(actor)) {
    throw new ForbiddenError('ტესტ-ქეისების ნახვის უფლება არ გაქვთ');
  }

  const task = await testCaseRepository.findTaskBrief(taskId);
  if (!task) {
    throw new NotFoundError('დავალება ვერ მოიძებნა');
  }

  const testCases = await testCaseRepository.findManyByTaskId(taskId);
  return testCases.map(toTestCaseListItemResource);
}
