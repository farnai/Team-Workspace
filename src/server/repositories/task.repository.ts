import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export { prisma };
export type Db = PrismaClient | Prisma.TransactionClient;

export const taskRepository = {
  findById(id: string, db: Db = prisma) {
    return db.task.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, role: true },
            },
          },
        },
        stages: {
          orderBy: { position: 'asc' },
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true, role: true },
                },
              },
            },
            subtasks: {
              orderBy: { position: 'asc' },
            },
          },
        },
        project: {
          select: { id: true, name: true, color: true },
        },
        creator: {
          select: { id: true, name: true, email: true, avatarUrl: true, role: true },
        },
        subtasks: {
          orderBy: { position: 'asc' },
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true },
                },
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        dailyUpdates: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    })
  },

  findMany(
    where: Prisma.TaskWhereInput,
    orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: 'desc' },
    db: Db = prisma
  ) {
    return db.task.findMany({
      where,
      orderBy,
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
        creator: {
          select: { id: true, name: true, avatarUrl: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, role: true },
            },
          },
        },
        stages: {
          orderBy: { position: 'asc' },
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatarUrl: true, role: true },
                },
              },
            },
            subtasks: {
              select: { id: true, status: true },
            },
          },
        },
        subtasks: {
          select: { id: true, status: true },
        },
        attachments: {
          select: { id: true, originalName: true, isExternal: true, url: true },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
            subtasks: true,
            dailyUpdates: true,
          },
        },
      },
    })
  },

  create(data: Prisma.TaskUncheckedCreateInput, db: Db = prisma) {
    return db.task.create({ data })
  },

  update(id: string, data: Prisma.TaskUncheckedUpdateInput, db: Db = prisma) {
    return db.task.update({
      where: { id },
      data,
    })
  },

  delete(id: string, db: Db = prisma) {
    return db.task.delete({
      where: { id },
    })
  },

  async setAssignees(taskId: string, userIds: string[], db: Db = prisma) {
    await db.taskAssignment.deleteMany({ where: { taskId } })
    if (userIds.length > 0) {
      await db.taskAssignment.createMany({
        data: userIds.map((userId) => ({ taskId, userId })),
        skipDuplicates: true,
      })
    }
  },

  async getNextTaskNumber(db: Db = prisma): Promise<number> {
    const lastTask = await db.task.findFirst({
      orderBy: { taskNumber: 'desc' },
      select: { taskNumber: true },
    })
    return (lastTask?.taskNumber || 0) + 1
  },
}
