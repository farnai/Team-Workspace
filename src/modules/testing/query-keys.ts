export const testingKeys = {
  all: ['testing'] as const,
  taskCases: (taskId: string) => [...testingKeys.all, 'task', taskId] as const,
  caseDetail: (testCaseId: string) => [...testingKeys.all, 'case', testCaseId] as const,
};
