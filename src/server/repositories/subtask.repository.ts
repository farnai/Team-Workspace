import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';
import type { Prisma } from '@prisma/client';

export const subtaskRepository = {
  async countByTaskAndStage(taskId: string, stageId?: string | null, db: Db = prisma) {
    return db.subtask.count({
      where: { taskId, stageId: stageId ?? null },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.subtask.findUnique({
      where: { id },
      include: {
        task: true,
        assignments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
  },

  async create(data: Prisma.SubtaskCreateInput, db: Db = prisma) {
    return db.subtask.create({
      data,
    });
  },

  async update(id: string, data: Prisma.SubtaskUpdateInput, db: Db = prisma) {
    return db.subtask.update({
      where: { id },
      data,
      include: {
        completedBy: { select: { id: true, name: true, avatarUrl: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
  },

  async delete(id: string, db: Db = prisma) {
    return db.subtask.delete({
      where: { id },
    });
  },

  async syncAssignees(subtaskId: string, assigneeIds: string[], db: Db = prisma) {
    await db.subtaskAssignment.deleteMany({ where: { subtaskId } });
    if (assigneeIds.length > 0) {
      await db.subtaskAssignment.createMany({
        data: assigneeIds.map((uid) => ({
          subtaskId,
          userId: uid,
        })),
      });
    }
  },
};
