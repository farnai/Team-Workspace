import 'server-only';
import { prisma, type Db } from '@/server/repositories/task.repository';
import type { Prisma } from '@prisma/client';
import { Role } from '@prisma/client';

export const userRepository = {
  async findAllAdminUsers(db: Db = prisma) {
    return db.user.findMany({
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
      where: { isActive: true },
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
      where: { role: Role.ADMIN, isActive: true },
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

  async invalidateSessions(userId: string, db: Db = prisma) {
    return db.session.deleteMany({
      where: { userId },
    });
  },
};

