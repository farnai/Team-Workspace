import 'server-only';
import { Role, type User } from '@prisma/client';
import { canCompleteStage, canUpdateTask } from '@/server/policies/task.policy';

interface TaskPolicyTarget {
  createdById: string;
}

interface TestCasePolicyTarget {
  createdById: string;
}

export function canViewTestCases(user: User): boolean {
  return Boolean(user.isActive && !user.isDeleted);
}

export function canCreateTestCase(user: User, task?: TaskPolicyTarget): boolean {
  return canUpdateTask(user, task);
}

export function canUpdateTestCase(user: User, task?: TaskPolicyTarget): boolean {
  return canUpdateTask(user, task);
}

export function canDeleteTestCase(user: User, testCase: TestCasePolicyTarget): boolean {
  if (!user.isActive || user.isDeleted) {
    return false;
  }
  return user.role === Role.ADMIN || testCase.createdById === user.id;
}

export function canExecuteTestRun(user: User): boolean {
  return canCompleteStage(user);
}
