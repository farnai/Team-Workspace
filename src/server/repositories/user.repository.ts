import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';
import type { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';

export const userRepository = {
  async findAllAdminUsers(db: Db = prisma) {
    return db.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  async findAllActiveUsers(db: Db = prisma) {
    return db.user.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.user.findUnique({
      where: { id },
    });
  },

  async findByEmail(email: string, db: Db = prisma) {
    return db.user.findUnique({
      where: { email },
    });
  },

  async countActiveAdmins(db: Db = prisma) {
    return db.user.count({
      where: { role: Role.ADMIN, isActive: true, isDeleted: false },
    });
  },

  async create(data: Prisma.UserCreateInput, db: Db = prisma) {
    return db.user.create({
      data,
    });
  },

  async update(id: string, data: Prisma.UserUpdateInput, db: Db = prisma) {
    return db.user.update({
      where: { id },
      data,
    });
  },

  async softDelete(id: string, originalEmail: string, db: Db = prisma) {
    return db.user.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
        email: `deleted_${Date.now()}_${originalEmail}`,
      },
    });
  },

  async invalidateSessions(userId: string, db: Db = prisma) {
    return db.session.deleteMany({
      where: { userId },
    });
  },

  async unassignFromActiveTasksAndClearDeadlines(userId: string, db: Db = prisma) {
    // A. Active tasks where this user is assigned (excluding DONE and CANCELLED)
    const activeTaskAssignments = await db.taskAssignment.findMany({
      where: {
        userId,
        task: { status: { notIn: ['DONE', 'CANCELLED'] } },
      },
      select: { taskId: true },
    });
    const activeTaskIds = activeTaskAssignments.map((a) => a.taskId);

    if (activeTaskIds.length > 0) {
      await db.taskAssignment.deleteMany({
        where: {
          userId,
          taskId: { in: activeTaskIds },
        },
      });

      for (const taskId of activeTaskIds) {
        const remainingCount = await db.taskAssignment.count({
          where: { taskId },
        });
        if (remainingCount === 0) {
          await db.task.update({
            where: { id: taskId },
            data: {
              deadline: null,
              startDate: null,
              deadlineLocked: false,
            },
          });
        }
      }
    }

    // B. Active workflow stages (stage not completed, task not DONE/CANCELLED)
    const activeStageAssignments = await db.stageAssignment.findMany({
      where: {
        userId,
        stage: {
          isCompleted: false,
          task: { status: { notIn: ['DONE', 'CANCELLED'] } },
        },
      },
      select: { stageId: true },
    });
    const activeStageIds = activeStageAssignments.map((a) => a.stageId);

    if (activeStageIds.length > 0) {
      await db.stageAssignment.deleteMany({
        where: {
          userId,
          stageId: { in: activeStageIds },
        },
      });

      for (const stageId of activeStageIds) {
        const remainingCount = await db.stageAssignment.count({
          where: { stageId },
        });
        if (remainingCount === 0) {
          await db.workflowStage.update({
            where: { id: stageId },
            data: {
              deadline: null,
              startDate: null,
              deadlineLocked: false,
            },
          });
        }
      }
    }

    // C. Active subtasks (subtask not DONE/CANCELLED, task not DONE/CANCELLED)
    const activeSubtaskAssignments = await db.subtaskAssignment.findMany({
      where: {
        userId,
        subtask: {
          status: { notIn: ['DONE', 'CANCELLED'] },
          task: { status: { notIn: ['DONE', 'CANCELLED'] } },
        },
      },
      select: { subtaskId: true },
    });
    const activeSubtaskIds = activeSubtaskAssignments.map((a) => a.subtaskId);

    if (activeSubtaskIds.length > 0) {
      await db.subtaskAssignment.deleteMany({
        where: {
          userId,
          subtaskId: { in: activeSubtaskIds },
        },
      });

      await db.subtask.updateMany({
        where: {
          id: { in: activeSubtaskIds },
        },
        data: {
          deadline: null,
          startDate: null,
          deadlineLocked: false,
        },
      });
    }
  },
};

