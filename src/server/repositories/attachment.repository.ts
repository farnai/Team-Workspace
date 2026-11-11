import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';
import type { Prisma } from '@prisma/client';

export const attachmentRepository = {
  async findByTaskId(taskId: string, db: Db = prisma) {
    return db.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.attachment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async create(data: Prisma.AttachmentCreateInput, db: Db = prisma) {
    return db.attachment.create({
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async update(id: string, data: Prisma.AttachmentUpdateInput, db: Db = prisma) {
    return db.attachment.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async delete(id: string, db: Db = prisma) {
    return db.attachment.delete({
      where: { id },
    });
  },
};

