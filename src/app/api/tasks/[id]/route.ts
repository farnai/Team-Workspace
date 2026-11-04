import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateDeadlineModification, calculateAndSyncTaskProgress } from "@/lib/workflow";
import { TaskType, Priority, TaskStatus, Role, Prisma } from "@prisma/client";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  pauseReason: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  rescheduleReason: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
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
              orderBy: { position: "asc" },
              include: {
                completedBy: { select: { id: true, name: true, avatarUrl: true } },
                assignments: {
                  include: {
                    user: { select: { id: true, name: true, avatarUrl: true } },
                  },
                },
              },
            },
          },
        },
        subtasks: {
          where: { stageId: null },
          orderBy: { position: "asc" },
          include: {
            completedBy: { select: { id: true, name: true, avatarUrl: true } },
            assignments: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        dailyUpdates: {
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        auditEvents: {
          orderBy: { createdAt: "desc" },
          include: {
            actor: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "ტასკი ვერ მოიძებნა" }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const result = updateTaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const data = result.data;
    const existing = await prisma.task.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "ტასკი ვერ მოიძებნა" }, { status: 404 });
    }

    const isAdmin = user.role === Role.ADMIN;

    // Check deadline authorization
    const incomingDeadline =
      data.deadline !== undefined
        ? data.deadline === null
          ? null
          : new Date(data.deadline)
        : undefined;

    const deadlineCheck = validateDeadlineModification({
      isDeadlineLocked: existing.deadlineLocked,
      existingDeadline: existing.deadline,
      incomingDeadline,
      isAdmin,
    });

    if (!deadlineCheck.allowed) {
      return NextResponse.json(
        { error: deadlineCheck.error || "დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს" },
        { status: 403 }
      );
    }

    const incomingStart =
      data.startDate !== undefined
        ? data.startDate === null
          ? null
          : new Date(data.startDate)
        : undefined;

    const dataToUpdate: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) dataToUpdate.title = data.title;
    if (data.description !== undefined) dataToUpdate.description = data.description;
    if (data.type !== undefined) dataToUpdate.type = data.type;
    if (data.priority !== undefined) dataToUpdate.priority = data.priority;
    if (incomingStart !== undefined) dataToUpdate.startDate = incomingStart;
    if (incomingDeadline !== undefined) dataToUpdate.deadline = incomingDeadline;

    // Status transitions
    if (data.status !== undefined) {
      dataToUpdate.status = data.status;
      if (data.status === TaskStatus.PAUSED) {
        dataToUpdate.pausedAt = new Date();
        dataToUpdate.pauseReason = data.pauseReason || "დროებით შეჩერებულია";
      } else if (existing.status === TaskStatus.PAUSED) {
        dataToUpdate.pausedAt = null;
        dataToUpdate.pauseReason = null;
      }

      if (data.status === TaskStatus.BLOCKED) {
        dataToUpdate.blockedReason = data.blockedReason || "დაბლოკილია";
      } else if (existing.status === TaskStatus.BLOCKED) {
        dataToUpdate.blockedReason = null;
      }

      if (data.status === TaskStatus.DONE) {
        dataToUpdate.completedAt = new Date();
      } else if (existing.status === TaskStatus.DONE) {
        dataToUpdate.completedAt = null;
      }
    }

    // Lock deadline if deadline is set and task is assigned
    if (
      !existing.deadlineLocked &&
      ((incomingDeadline || existing.deadline) &&
        ((data.assigneeIds && data.assigneeIds.length > 0) || existing.assignments.length > 0))
    ) {
      dataToUpdate.deadlineLocked = true;
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      // Handle assignee updates
      if (data.assigneeIds !== undefined) {
        await tx.taskAssignment.deleteMany({ where: { taskId: id } });
        if (data.assigneeIds.length > 0) {
          await tx.taskAssignment.createMany({
            data: data.assigneeIds.map((uid) => ({
              taskId: id,
              userId: uid,
            })),
          });
        }
      }

      const task = await tx.task.update({
        where: { id },
        data: dataToUpdate,
      });

      // Audit logs
      if (incomingDeadline !== undefined && existing.deadline?.getTime() !== incomingDeadline?.getTime()) {
        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action: "DEADLINE_CHANGED",
          entityType: "TASK",
          entityId: id,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || "ადმინისტრატორის მიერ დედლაინის შეცვლა",
          tx,
        });
      }

      if (data.status !== undefined && data.status !== existing.status) {
        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action: "STATUS_CHANGED",
          entityType: "TASK",
          entityId: id,
          oldValues: { status: existing.status },
          newValues: { status: data.status },
          reason: data.pauseReason || data.blockedReason || "სტატუსის ცვლილება",
          tx,
        });
      }

      if (data.priority !== undefined && data.priority !== existing.priority) {
        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action: "PRIORITY_CHANGED",
          entityType: "TASK",
          entityId: id,
          oldValues: { priority: existing.priority },
          newValues: { priority: data.priority },
          reason: "პრიორიტეტის განახლება",
          tx,
        });
      }

      return task;
    });

    // Re-sync progress
    await calculateAndSyncTaskProgress(id);

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/tasks/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
