import 'server-only';
import type {
  Attachment,
  TestCase,
  TestRun,
  TestRunEvidence,
  TestStep,
  User,
} from '@prisma/client';

type UserBrief = Pick<User, 'id' | 'name' | 'avatarUrl'>;

export interface TestRunSnapshotStep {
  stepId: string | null;
  position: number;
  action: string;
  testData: string | null;
  expectedResult: string;
  status: 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED' | null;
  actualNote: string | null;
}

type FullEvidence = TestRunEvidence & {
  attachment: Attachment & { user: UserBrief };
};

type FullRun = TestRun & {
  executedBy: UserBrief;
  evidences?: FullEvidence[];
  _count?: { evidences: number };
};

type FullTestCaseListRow = TestCase & {
  createdBy: UserBrief;
  updatedBy: UserBrief | null;
  steps: TestStep[];
  runs: FullRun[];
  _count?: { steps: number; runs: number };
};

type FullTestCaseDetailRow = TestCase & {
  createdBy: UserBrief;
  updatedBy: UserBrief | null;
  steps: TestStep[];
  runs: FullRun[];
};

export function toTestStepResource(step: TestStep) {
  return {
    id: step.id,
    testCaseId: step.testCaseId,
    position: step.position,
    action: step.action,
    testData: step.testData ?? null,
    expectedResult: step.expectedResult,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  };
}

export function toTestRunEvidenceResource(evidence: FullEvidence) {
  return {
    id: evidence.id,
    attachmentId: evidence.attachmentId,
    originalName: evidence.attachment.originalName,
    mimeType: evidence.attachment.mimeType,
    sizeBytes: evidence.attachment.sizeBytes,
    url: evidence.attachment.url ?? null,
    isExternal: evidence.attachment.isExternal,
    createdAt: evidence.attachment.createdAt.toISOString(),
    uploadedBy: evidence.attachment.user,
  };
}

function parseStepsSnapshot(raw: unknown): TestRunSnapshotStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const rec = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const rawStatus = rec.status;
    const status =
      rawStatus === 'PASSED' ||
      rawStatus === 'FAILED' ||
      rawStatus === 'BLOCKED' ||
      rawStatus === 'SKIPPED'
        ? rawStatus
        : null;

    return {
      stepId: typeof rec.stepId === 'string' ? rec.stepId : null,
      position: typeof rec.position === 'number' ? rec.position : idx,
      action: typeof rec.action === 'string' ? rec.action : '',
      testData: typeof rec.testData === 'string' && rec.testData.length > 0 ? rec.testData : null,
      expectedResult: typeof rec.expectedResult === 'string' ? rec.expectedResult : '',
      status,
      actualNote:
        typeof rec.actualNote === 'string' && rec.actualNote.length > 0 ? rec.actualNote : null,
    };
  });
}

export function toTestRunResource(run: FullRun) {
  return {
    id: run.id,
    testCaseId: run.testCaseId,
    taskId: run.taskId,
    runNumber: run.runNumber,
    status: run.status,
    actualResult: run.actualResult ?? null,
    reason: run.reason ?? null,
    caseTitleSnapshot: run.caseTitleSnapshot,
    preconditionSnapshot: run.preconditionSnapshot ?? null,
    stepsSnapshot: parseStepsSnapshot(run.stepsSnapshot),
    executedBy: run.executedBy,
    executedAt: run.executedAt.toISOString(),
    evidences: (run.evidences ?? []).map(toTestRunEvidenceResource),
  };
}

export function toTestCaseListItemResource(tc: FullTestCaseListRow) {
  const latestRun = tc.runs[0] ? toTestRunResource(tc.runs[0]) : null;
  return {
    id: tc.id,
    taskId: tc.taskId,
    position: tc.position,
    title: tc.title,
    precondition: tc.precondition ?? null,
    createdById: tc.createdById,
    createdBy: tc.createdBy,
    updatedBy: tc.updatedBy ?? null,
    createdAt: tc.createdAt.toISOString(),
    updatedAt: tc.updatedAt.toISOString(),
    stepsCount: tc._count?.steps ?? tc.steps.length,
    runsCount: tc._count?.runs ?? tc.runs.length,
    steps: tc.steps.map(toTestStepResource),
    latestRun,
  };
}

export function toTestCaseDetailResource(tc: FullTestCaseDetailRow) {
  return {
    id: tc.id,
    taskId: tc.taskId,
    position: tc.position,
    title: tc.title,
    precondition: tc.precondition ?? null,
    createdById: tc.createdById,
    createdBy: tc.createdBy,
    updatedBy: tc.updatedBy ?? null,
    createdAt: tc.createdAt.toISOString(),
    updatedAt: tc.updatedAt.toISOString(),
    stepsCount: tc.steps.length,
    runsCount: tc.runs.length,
    steps: tc.steps.map(toTestStepResource),
    runs: tc.runs.map(toTestRunResource),
    latestRun: tc.runs[0] ? toTestRunResource(tc.runs[0]) : null,
  };
}
