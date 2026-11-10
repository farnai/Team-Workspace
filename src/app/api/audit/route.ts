import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Prisma, AuditAction } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const actorId = searchParams.get("actorId");
    const action = searchParams.get("action");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const rawLimit = searchParams.get("limit");
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : 100;
    const limit = Math.min(Math.max(isNaN(parsedLimit) ? 100 : parsedLimit, 1), 500);
    const rawPage = searchParams.get("page");
    const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
    const page = Math.max(isNaN(parsedPage) ? 1 : parsedPage, 1);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {};

    // Non-admin users cannot see administrative user events (e.g. password resets, user status changes)
    if (authUser.role !== "ADMIN") {
      where.entityType = { not: "USER" };
    }

    if (taskId) {
      where.taskId = taskId;
    }

    if (actorId && actorId !== "ALL") {
      where.actorId = actorId;
    }

    if (action && action !== "ALL") {
      if (Object.values(AuditAction).includes(action as AuditAction)) {
        where.action = action as AuditAction;
      }
    }

    // Date range filter
    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) {
          dateFilter.gte = d;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }
      }
      if (dateFilter.gte || dateFilter.lte) {
        where.createdAt = dateFilter;
      }
    }

    // Search query
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { reason: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { task: { title: { contains: q, mode: "insensitive" } } },
        { actor: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [totalCount, auditEvents] = await Promise.all([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: "desc" },
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

    // Compute basic summary stats
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayCount, statusChangeCount, deadlineChangeCount] = await Promise.all([
      prisma.auditEvent.count({
        where: { createdAt: { gte: todayStart } },
      }),
      prisma.auditEvent.count({
        where: { action: AuditAction.STATUS_CHANGED },
      }),
      prisma.auditEvent.count({
        where: {
          OR: [
            { action: AuditAction.DEADLINE_CHANGED },
            { action: AuditAction.SCHEDULE_CHANGED },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      auditEvents,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      stats: {
        total: totalCount,
        today: todayCount,
        statusChanges: statusChangeCount,
        deadlineChanges: deadlineChangeCount,
      },
    });
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/audit error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
