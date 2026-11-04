import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { TaskType, TaskStatus, Prisma } from "@prisma/client";
import { formatGeorgianDate } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type") as TaskType | null;
    const assigneeId = searchParams.get("assigneeId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Prisma.TaskWhereInput = {
      status: TaskStatus.DONE,
    };

    if (search) {
      const q = search.trim();
      const orClauses: Prisma.TaskWhereInput[] = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
      const parsedNum = parseInt(q.replace(/\D/g, ""), 10);
      if (!isNaN(parsedNum)) {
        orClauses.push({ taskNumber: parsedNum });
      }
      where.OR = orClauses;
    }

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;

    if (assigneeId) {
      where.OR = [
        ...(where.OR || []),
        { assignments: { some: { userId: assigneeId } } },
        { stages: { some: { assignments: { some: { userId: assigneeId } } } } },
      ];
    }

    // Date range filter on completedAt
    if (dateFrom || dateTo) {
      where.completedAt = {};
      if (dateFrom) {
        where.completedAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        where.completedAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: true,
        creator: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
        assignments: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
        },
        stages: {
          orderBy: { position: "asc" },
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
        subtasks: {
          select: { id: true, title: true, status: true },
        },
        auditEvents: {
          where: { action: "STATUS_CHANGED" },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    });

    // Group tasks by completion date string (YYYY-MM-DD)
    const groupsMap = new Map<
      string,
      {
        date: string;
        formattedDate: string;
        tasks: typeof tasks;
      }
    >();

    for (const task of tasks) {
      let compDate = task.completedAt;

      // Fallback: if completedAt is missing for an older completed task,
      // derive from the latest audit event where status was set to DONE
      if (!compDate) {
        const doneAudit = task.auditEvents.find((a) => {
          if (!a.newValues) return false;
          try {
            const nv =
              typeof a.newValues === "string"
                ? JSON.parse(a.newValues)
                : a.newValues;
            return nv?.status === "DONE";
          } catch {
            return false;
          }
        });
        compDate = doneAudit ? new Date(doneAudit.createdAt) : task.createdAt;
      }

      const dateStr = compDate.toISOString().slice(0, 10);

      if (!groupsMap.has(dateStr)) {
        groupsMap.set(dateStr, {
          date: dateStr,
          formattedDate: formatGeorgianDate(dateStr),
          tasks: [],
        });
      }

      groupsMap.get(dateStr)!.tasks.push(task);
    }

    // Convert to array sorted by date descending
    const groups = Array.from(groupsMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    return NextResponse.json({
      groups,
      totalCount: tasks.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/archive error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
