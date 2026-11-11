import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma, TaskType } from '@prisma/client'

type Db = typeof prisma | Prisma.TransactionClient

export const timelineRepository = {
  async getWorkingDays(db: Db = prisma) {
    return db.workingCalendar.findMany()
  },

  async getDbHolidays(startDate: Date, endDate: Date, db: Db = prisma) {
    return db.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    })
  },

  async getScheduleTasks(
    params: {
      startDate: Date
      endDate: Date
      projectId?: string
      assigneeId?: string
      type?: TaskType
    },
    db: Db = prisma
  ) {
    const taskWhere: Prisma.TaskWhereInput = {
      status: { not: 'CANCELLED' },
    }
    if (params.projectId) taskWhere.projectId = params.projectId
    if (params.assigneeId) taskWhere.assignments = { some: { userId: params.assigneeId } }
    if (params.type) taskWhere.type = params.type

    return db.task.findMany({
      where: {
        ...taskWhere,
        OR: [
          {
            startDate: { lte: params.endDate },
            deadline: { gte: params.startDate },
          },
          {
            startDate: null,
            deadline: { gte: params.startDate, lte: params.endDate },
          },
          {
            startDate: { gte: params.startDate, lte: params.endDate },
            deadline: null,
          },
          {
            startDate: null,
            deadline: null,
            stages: {
              some: {
                OR: [
                  {
                    startDate: { lte: params.endDate },
                    deadline: { gte: params.startDate },
                  },
                  {
                    startDate: null,
                    deadline: { gte: params.startDate, lte: params.endDate },
                  },
                  {
                    startDate: { gte: params.startDate, lte: params.endDate },
                    deadline: null,
                  },
                ],
              },
            },
          },
        ],
      },
      include: {
        project: true,
        assignments: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        stages: {
          orderBy: { position: 'asc' },
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
        subtasks: {
          select: { id: true, status: true },
        },
      },
    })
  },

  async getAuditEvents(
    params: {
      startDate: Date
      endDate: Date
      projectId?: string
    },
    db: Db = prisma
  ) {
    return db.auditEvent.findMany({
      where: {
        createdAt: {
          gte: params.startDate,
          lte: params.endDate,
        },
        ...(params.projectId ? { task: { projectId: params.projectId } } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true } },
        task: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  },
}

