import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';
import type { Prisma } from '@prisma/client';

export const stageRepository = {
  async countByTaskId(taskId: string, db: Db = prisma) {
    return db.workflowStage.count({
      where: { taskId },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.workflowStage.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        task: {
          select: {
            id: true,
            status: true,
            createdById: true,
            stages: {
              orderBy: { position: 'asc' },
              include: {
                assignments: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
  },

  async findManyByTaskId(taskId: string, db: Db = prisma) {
    return db.workflowStage.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    });
  },

  async create(data: Prisma.WorkflowStageCreateInput, db: Db = prisma) {
    return db.workflowStage.create({
      data,
    });
  },

  async update(id: string, data: Prisma.WorkflowStageUpdateInput, db: Db = prisma) {
    return db.workflowStage.update({
      where: { id },
      data,
      include: {
        assignments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
  },

  async delete(id: string, db: Db = prisma) {
    return db.workflowStage.delete({
      where: { id },
    });
  },

  async syncAssignees(stageId: string, assigneeIds: string[], db: Db = prisma) {
    await db.stageAssignment.deleteMany({ where: { stageId } });
    if (assigneeIds.length > 0) {
      await db.stageAssignment.createMany({
        data: assigneeIds.map((uid) => ({
          stageId,
          userId: uid,
        })),
      });
    }
  },
};

