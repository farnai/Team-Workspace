import { useToastMutation } from '@/hooks/useToastMutation';
import { testingApi } from '../api';
import { testingKeys } from '../query-keys';
import type {
  CreateTestCasePayload,
  CreateTestRunPayload,
  UpdateTestCasePayload,
} from '../types';

export function useCreateTestCase(taskId: string) {
  return useToastMutation({
    mutationFn: (payload: CreateTestCasePayload) => testingApi.createCase(taskId, payload),
    successMessage: 'ტესტ-ქეისი შეიქმნა',
    invalidate: [testingKeys.taskCases(taskId)],
  });
}

export function useUpdateTestCase(taskId: string, testCaseId: string) {
  return useToastMutation({
    mutationFn: (payload: UpdateTestCasePayload) => testingApi.updateCase(testCaseId, payload),
    successMessage: 'ტესტ-ქეისი განახლდა',
    invalidate: [testingKeys.taskCases(taskId), testingKeys.caseDetail(testCaseId)],
  });
}

export function useDeleteTestCase(taskId: string) {
  return useToastMutation({
    mutationFn: (testCaseId: string) => testingApi.deleteCase(testCaseId),
    successMessage: 'ტესტ-ქეისი წაიშალა',
    invalidate: [testingKeys.taskCases(taskId)],
  });
}

export function useCreateTestRun(taskId: string, testCaseId: string) {
  return useToastMutation({
    mutationFn: (payload: CreateTestRunPayload) => testingApi.createRun(testCaseId, payload),
    successMessage: 'ტესტის გაშვება დაფიქსირდა',
    invalidate: [testingKeys.taskCases(taskId), testingKeys.caseDetail(testCaseId)],
  });
}
