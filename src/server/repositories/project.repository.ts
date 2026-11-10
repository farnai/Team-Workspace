import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export const projectRepository = {
  findAll(db: Db = prisma) {
    return db.project.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            deadline: true,
            progress: true,
          },
        },
      },
    })
  },

  findById(id: string, db: Db = prisma) {
    return db.project.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          include: {
            assignments: { include: { user: true } },
            stages: true,
          },
          orderBy: { taskNumber: 'asc' },
        },
      },
    })
  },

  create(data: Prisma.ProjectCreateInput, db: Db = prisma) {
    return db.project.create({ data })
  },

  update(id: string, data: Prisma.ProjectUpdateInput, db: Db = prisma) {
    return db.project.update({
      where: { id },
      data,
    })
  },

  delete(id: string, db: Db = prisma) {
    return db.project.delete({ where: { id } })
  },

  findFallback(excludeId: string, db: Db = prisma) {
    return db.project.findFirst({
      where: { id: { not: excludeId }, isArchived: false },
      orderBy: { createdAt: 'asc' },
    })
  },

  reassignTasks(fromProjectId: string, toProjectId: string, db: Db = prisma) {
    return db.task.updateMany({
      where: { projectId: fromProjectId },
      data: { projectId: toProjectId },
    })
  },
}
