export const TestRunStatus = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
} as const;

export type TestRunStatus = (typeof TestRunStatus)[keyof typeof TestRunStatus];

export const TestStepResultStatus = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  SKIPPED: 'SKIPPED',
} as const;

export type TestStepResultStatus = (typeof TestStepResultStatus)[keyof typeof TestStepResultStatus];

export interface TestUserBrief {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TestStepItem {
  id: string;
  testCaseId: string;
  position: number;
  action: string;
  testData: string | null;
  expectedResult: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestRunSnapshotStep {
  stepId: string | null;
  position: number;
  action: string;
  testData: string | null;
  expectedResult: string;
  status: TestStepResultStatus | null;
  actualNote: string | null;
}

export interface TestRunEvidenceItem {
  id: string;
  attachmentId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  isExternal: boolean;
  createdAt: string;
  uploadedBy: TestUserBrief;
}

export interface TestRunItem {
  id: string;
  testCaseId: string;
  taskId: string;
  runNumber: number;
  status: TestRunStatus;
  actualResult: string | null;
  reason: string | null;
  caseTitleSnapshot: string;
  preconditionSnapshot: string | null;
  stepsSnapshot: TestRunSnapshotStep[];
  executedBy: TestUserBrief;
  executedAt: string;
  evidences: TestRunEvidenceItem[];
}

export interface TestCaseListItem {
  id: string;
  taskId: string;
  position: number;
  title: string;
  precondition: string | null;
  createdById: string;
  createdBy: TestUserBrief;
  updatedBy: TestUserBrief | null;
  createdAt: string;
  updatedAt: string;
  stepsCount: number;
  runsCount: number;
  steps: TestStepItem[];
  latestRun: TestRunItem | null;
}

export interface TestCaseDetail extends TestCaseListItem {
  runs: TestRunItem[];
}

export interface TestStepInputPayload {
  action: string;
  testData?: string | null;
  expectedResult: string;
}

export interface CreateTestCasePayload {
  title: string;
  precondition?: string | null;
  steps: TestStepInputPayload[];
}

export interface UpdateTestCasePayload {
  title?: string;
  precondition?: string | null;
  position?: number;
  steps?: TestStepInputPayload[];
}

export interface CreateTestRunStepResultPayload {
  stepId?: string;
  position: number;
  status?: TestStepResultStatus | null;
  actualNote?: string | null;
}

export interface CreateTestRunPayload {
  status: TestRunStatus;
  actualResult?: string | null;
  reason?: string | null;
  stepResults?: CreateTestRunStepResultPayload[];
  attachmentIds?: string[];
}

export interface UploadedEvidenceAttachment {
  id: string;
  taskId: string;
  userId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  isExternal: boolean;
  createdAt: string;
  user: TestUserBrief;
}
