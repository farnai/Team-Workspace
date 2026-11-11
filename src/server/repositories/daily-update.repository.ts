import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';

export const dailyUpdateRepository = {
  async findByTaskId(taskId: string, db: Db = prisma) {
    return db.dailyUpdate.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.dailyUpdate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async create(data: { taskId: string; userId: string; content: string }, db: Db = prisma) {
    return db.dailyUpdate.create({
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async update(id: string, data: { content: string }, db: Db = prisma) {
    return db.dailyUpdate.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async delete(id: string, db: Db = prisma) {
    return db.dailyUpdate.delete({
      where: { id },
    });
  },
};

