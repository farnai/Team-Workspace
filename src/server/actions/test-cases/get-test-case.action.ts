import 'server-only';
import type { User } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@/server/http/errors';
import { canViewTestCases } from '@/server/policies/test-case.policy';
import { testCaseRepository } from '@/server/repositories/test-case.repository';
import { toTestCaseDetailResource } from '@/server/resources/test-case.resource';

export async function getTestCaseAction(testCaseId: string, actor: User) {
  if (!canViewTestCases(actor)) {
    throw new ForbiddenError('ტესტ-ქეისის ნახვის უფლება არ გაქვთ');
  }

  const testCase = await testCaseRepository.findById(testCaseId);
  if (!testCase) {
    throw new NotFoundError('ტესტ-ქეისი ვერ მოიძებნა');
  }

  return toTestCaseDetailResource(testCase);
}
