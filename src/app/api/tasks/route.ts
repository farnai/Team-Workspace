import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import { TaskType, Priority, TaskStatus, Prisma } from "@prisma/client";

const createTaskSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().min(1, "სათაური სავალდებულოა"),
  description: z.string().optional(),
  type: z.nativeEnum(TaskType).default(TaskType.FEATURE),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.BACKLOG),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type") as TaskType | null;
    const priority = searchParams.get("priority") as Priority | null;
    const status = searchParams.get("status") as TaskStatus | null;
    const assigneeId = searchParams.get("assigneeId");
    const unassigned = searchParams.get("unassigned") === "true";
    const overdue = searchParams.get("overdue") === "true";
    const unscheduled = searchParams.get("unscheduled") === "true";
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const mode = searchParams.get("mode"); // e.g. "backlog", "timeline"

    const where: Prisma.TaskWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
      const parsedNum = parseInt(search.replace(/\D/g, ""), 10);
      if (!isNaN(parsedNum)) {
        where.OR.push({ taskNumber: parsedNum });
      }
    }

    if (projectId) where.projectId = projectId;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (status) where.status = status;

    if (unassigned) {
      where.assignments = { none: {} };
    } else if (assigneeId) {
      where.assignments = {
        some: { userId: assigneeId },
      };
    }

    if (overdue) {
      where.deadline = { lt: new Date() };
      where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] };
    } else if (unscheduled) {
      where.deadline = null;
    }

    if (mode === "backlog") {
      where.status = TaskStatus.BACKLOG;
    }

    let orderBy: Prisma.TaskOrderByWithRelationInput[] = [
      { priority: "desc" },
      { createdAt: "desc" },
    ];

    if (sortBy === "deadline") {
      orderBy = [{ deadline: { sort: sortOrder, nulls: "last" } }, { createdAt: "desc" }];
    } else if (sortBy === "createdAt") {
      orderBy = [{ createdAt: sortOrder }];
    } else if (sortBy === "taskNumber") {
      orderBy = [{ taskNumber: sortOrder }];
    } else if (sortBy === "priority") {
      orderBy = [{ priority: sortOrder }, { createdAt: "desc" }];
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
            subtasks: {
              select: { id: true, status: true },
            },
          },
        },
        subtasks: {
          select: { id: true, status: true },
        },
      },
      orderBy,
    });

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const result = createTaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const data = result.data;

    const parsedStart = data.startDate ? new Date(data.startDate) : null;
    const parsedDeadline = data.deadline ? new Date(data.deadline) : null;
    const hasInitialAssignees = Boolean(data.assigneeIds && data.assigneeIds.length > 0);

    // Business rule: An assigned task requires an initial deadline
    if (hasInitialAssignees && !parsedDeadline) {
      return NextResponse.json(
        { error: "შემსრულებლის მინიჭებისას საწყისი დედლაინის მითითება სავალდებულოა" },
        { status: 400 }
      );
    }

    // Resolve or default project
    let projectId = data.projectId;
    if (!projectId) {
      const defaultProject = await prisma.project.findFirst();
      if (!defaultProject) {
        const createdProject = await prisma.project.create({
          data: { name: "ძირითადი პროექტი", color: "#EA580C" },
        });
        projectId = createdProject.id;
      } else {
        projectId = defaultProject.id;
      }
    }

    // Initial deadline lock rule: once a deadline is established, it is locked
    const shouldLockDeadline = Boolean(parsedDeadline);

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: projectId!,
          title: data.title,
          description: data.description,
          type: data.type,
          priority: data.priority,
          status: data.status,
          startDate: parsedStart,
          deadline: parsedDeadline,
          deadlineLocked: shouldLockDeadline,
          progress: 0,
          createdById: user.id,
        },
      });

      // Create assignments
      if (hasInitialAssignees) {
        await tx.taskAssignment.createMany({
          data: data.assigneeIds!.map((uid) => ({
            taskId: created.id,
            userId: uid,
          })),
        });
      }

      await logAuditEvent({
        taskId: created.id,
        actorId: user.id,
        action: "TASK_CREATED",
        entityType: "TASK",
        entityId: created.id,
        newValues: {
          title: created.title,
          type: created.type,
          priority: created.priority,
          deadline: created.deadline,
          assigneeIds: data.assigneeIds,
        },
        reason: "ახალი ტასკის შექმნა",
        tx,
      });

      return created;
    });

    return NextResponse.json({ success: true, task });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
