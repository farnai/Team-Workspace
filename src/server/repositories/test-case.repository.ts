import 'server-only';
import type { Prisma } from '@prisma/client';
import { prisma, type Db } from '@/server/repositories/task.repository';

const userBriefSelect = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

export const TEST_RUN_INCLUDE = {
  executedBy: { select: userBriefSelect },
  evidences: {
    orderBy: { createdAt: 'asc' },
    include: {
      attachment: {
        include: {
          user: { select: userBriefSelect },
        },
      },
    },
  },
} satisfies Prisma.TestRunInclude;

export const TEST_CASE_DETAIL_INCLUDE = {
  task: {
    select: {
      id: true,
      title: true,
      taskNumber: true,
      createdById: true,
      status: true,
    },
  },
  createdBy: { select: userBriefSelect },
  updatedBy: { select: userBriefSelect },
  steps: {
    orderBy: { position: 'asc' },
  },
  runs: {
    orderBy: [{ executedAt: 'desc' }, { runNumber: 'desc' }],
    include: TEST_RUN_INCLUDE,
  },
} satisfies Prisma.TestCaseInclude;

export const testCaseRepository = {
  findTaskBrief(taskId: string, db: Db = prisma) {
    return db.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        taskNumber: true,
        createdById: true,
        status: true,
      },
    });
  },

  findManyByTaskId(taskId: string, db: Db = prisma) {
    return db.testCase.findMany({
      where: { taskId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        createdBy: { select: userBriefSelect },
        updatedBy: { select: userBriefSelect },
        steps: {
          orderBy: { position: 'asc' },
        },
        runs: {
          orderBy: [{ executedAt: 'desc' }, { runNumber: 'desc' }],
          take: 1,
          include: TEST_RUN_INCLUDE,
        },
        _count: {
          select: { steps: true, runs: true },
        },
      },
    });
  },

  findById(id: string, db: Db = prisma) {
    return db.testCase.findUnique({
      where: { id },
      include: TEST_CASE_DETAIL_INCLUDE,
    });
  },

  async getNextPosition(taskId: string, db: Db = prisma): Promise<number> {
    const last = await db.testCase.findFirst({
      where: { taskId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return last ? last.position + 1 : 0;
  },

  async getNextRunNumber(testCaseId: string, db: Db = prisma): Promise<number> {
    const last = await db.testRun.findFirst({
      where: { testCaseId },
      orderBy: { runNumber: 'desc' },
      select: { runNumber: true },
    });
    return last ? last.runNumber + 1 : 1;
  },

  create(data: Prisma.TestCaseUncheckedCreateInput, db: Db = prisma) {
    return db.testCase.create({
      data,
      include: TEST_CASE_DETAIL_INCLUDE,
    });
  },

  update(id: string, data: Prisma.TestCaseUncheckedUpdateInput, db: Db = prisma) {
    return db.testCase.update({
      where: { id },
      data,
    });
  },

  async replaceSteps(
    testCaseId: string,
    steps: Array<{ action: string; testData: string | null; expectedResult: string }>,
    db: Db = prisma
  ) {
    await db.testStep.deleteMany({ where: { testCaseId } });
    if (steps.length > 0) {
      await db.testStep.createMany({
        data: steps.map((step, index) => ({
          testCaseId,
          position: index,
          action: step.action,
          testData: step.testData,
          expectedResult: step.expectedResult,
        })),
      });
    }
  },

  delete(id: string, db: Db = prisma) {
    return db.testCase.delete({
      where: { id },
    });
  },

  createRun(data: Prisma.TestRunUncheckedCreateInput, db: Db = prisma) {
    return db.testRun.create({
      data,
      include: TEST_RUN_INCLUDE,
    });
  },

  findTaskAttachmentsByIds(taskId: string, attachmentIds: string[], db: Db = prisma) {
    if (attachmentIds.length === 0) return Promise.resolve([]);
    return db.attachment.findMany({
      where: {
        taskId,
        id: { in: attachmentIds },
      },
      select: { id: true },
    });
  },
};
