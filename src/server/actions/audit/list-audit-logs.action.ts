import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { Prisma, AuditAction } from '@prisma/client';

export interface AuditQueryFilter {
  taskId?: string | null;
  actorId?: string | null;
  action?: string | null;
  search?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
  page?: number;
}

export async function listAuditLogsAction(query: AuditQueryFilter) {
  const authUser = await requireUser();

  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);
  const page = Math.max(query.page ?? 1, 1);
  const skip = (page - 1) * limit;

  const where: Prisma.AuditEventWhereInput = {};

  if (authUser.role !== 'ADMIN') {
    where.entityType = { not: 'USER' };
  }

  if (query.taskId) {
    where.taskId = query.taskId;
  }

  if (query.actorId && query.actorId !== 'ALL') {
    where.actorId = query.actorId;
  }

  if (query.action && query.action !== 'ALL') {
    if (Object.values(AuditAction).includes(query.action as AuditAction)) {
      where.action = query.action as AuditAction;
    }
  }

  if (query.startDate || query.endDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.startDate) {
      const d = new Date(query.startDate);
      if (!isNaN(d.getTime())) {
        dateFilter.gte = d;
      }
    }
    if (query.endDate) {
      const end = new Date(query.endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }
    if (dateFilter.gte || dateFilter.lte) {
      where.createdAt = dateFilter;
    }
  }

  if (query.search && query.search.trim()) {
    const q = query.search.trim();
    where.OR = [
      { reason: { contains: q, mode: 'insensitive' } },
      { entityType: { contains: q, mode: 'insensitive' } },
      { task: { title: { contains: q, mode: 'insensitive' } } },
      { actor: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [totalCount, auditEvents] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true, role: true } },
        task: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            type: true,
            status: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    auditEvents,
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

