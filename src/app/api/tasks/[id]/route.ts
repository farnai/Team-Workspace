import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateDeadlineModification, calculateAndSyncTaskProgress } from "@/lib/workflow";
import { TaskType, Priority, TaskStatus, Role, Prisma } from "@prisma/client";
import { z } from "zod";
import crypto from "crypto";

const updateTaskSchema = z.object({
  projectId: z.string().optional(),
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
  assignees: z
    .array(
      z.object({
        userId: z.string(),
        position: z.number().optional(),
        deadline: z.string().nullable().optional(),
      })
    )
    .optional(),
  links: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
      })
    )
    .optional(),
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

    const effectiveDeadline =
      incomingDeadline !== undefined ? incomingDeadline : existing.deadline;

    // Validate sequential assignees if provided
    if (data.assignees && data.assignees.length > 1) {
      const sorted = [...data.assignees].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );
      if (!sorted[0].deadline) {
        return NextResponse.json(
          { error: "თანმიმდევრული სამუშაოსთვის 1-ლი შემსრულებლის დედლაინი სავალდებულოა" },
          { status: 400 }
        );
      }
      if (effectiveDeadline) {
        for (const a of sorted) {
          if (a.deadline && new Date(a.deadline).getTime() > effectiveDeadline.getTime()) {
            return NextResponse.json(
              { error: "შემსრულებლის დედლაინი არ შეიძლება აღემატებოდეს დავალების საერთო დედლაინს" },
              { status: 400 }
            );
          }
        }
      }
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const dI = sorted[i].deadline ? new Date(sorted[i].deadline!) : null;
          const dJ = sorted[j].deadline ? new Date(sorted[j].deadline!) : null;
          if (dI && dJ && dI.getTime() > dJ.getTime()) {
            return NextResponse.json(
              { error: "თანმიმდევრული შემსრულებლების დედლაინები უნდა შეესაბამებოდეს რიგითობას" },
              { status: 400 }
            );
          }
        }
      }
    }

    const incomingStart =
      data.startDate !== undefined
        ? data.startDate === null
          ? null
          : new Date(data.startDate)
        : undefined;

    // Validate start date is not after deadline
    const effectiveStart =
      incomingStart !== undefined ? incomingStart : existing.startDate;
    if (effectiveStart && effectiveDeadline && effectiveStart > effectiveDeadline) {
      return NextResponse.json(
        { error: "დაწყების თარიღი არ შეიძლება იყოს დედლაინზე გვიან" },
        { status: 400 }
      );
    }

    // Require reason when admin modifies an established locked deadline
    if (
      existing.deadlineLocked &&
      existing.deadline &&
      incomingDeadline &&
      existing.deadline.getTime() !== incomingDeadline.getTime()
    ) {
      if (!data.rescheduleReason || !data.rescheduleReason.trim()) {
        return NextResponse.json(
          { error: "დედლაინის ცვლილებისას მიზეზის მითითება სავალდებულოა" },
          { status: 400 }
        );
      }
    }

    // Validation for Pause
    if (data.status === TaskStatus.PAUSED) {
      if (
        existing.status === TaskStatus.DONE ||
        existing.status === TaskStatus.CANCELLED
      ) {
        return NextResponse.json(
          { error: "დასრულებული ან გაუქმებული დავალების შეჩერება დაუშვებელია" },
          { status: 400 }
        );
      }
      if (!data.pauseReason || !data.pauseReason.trim()) {
        return NextResponse.json(
          { error: "დავალების შეჩერების მიზეზის მითითება სავალდებულოა" },
          { status: 400 }
        );
      }
    }

    // Validation for Blocked
    if (data.status === TaskStatus.BLOCKED) {
      if (
        existing.status === TaskStatus.DONE ||
        existing.status === TaskStatus.CANCELLED
      ) {
        return NextResponse.json(
          { error: "დასრულებული ან გაუქმებული დავალების დაბლოკვა დაუშვებელია" },
          { status: 400 }
        );
      }
      if (!data.blockedReason || !data.blockedReason.trim()) {
        return NextResponse.json(
          { error: "დაბლოკვის მიზეზის (დაბრკოლების) მითითება სავალდებულოა" },
          { status: 400 }
        );
      }
    }

    const dataToUpdate: Prisma.TaskUpdateInput = {};
    if (data.projectId !== undefined) {
      dataToUpdate.project = { connect: { id: data.projectId } };
    }
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
        dataToUpdate.pauseReason = data.pauseReason!.trim();
      } else if (existing.status === TaskStatus.PAUSED) {
        dataToUpdate.pausedAt = null;
        dataToUpdate.pauseReason = null;
      }

      if (data.status === TaskStatus.BLOCKED) {
        dataToUpdate.blockedReason = data.blockedReason!.trim();
      } else if (existing.status === TaskStatus.BLOCKED) {
        dataToUpdate.blockedReason = null;
      }

      if (data.status === TaskStatus.DONE) {
        dataToUpdate.completedAt = new Date();
      } else if (existing.status === TaskStatus.DONE) {
        dataToUpdate.completedAt = null;
      }
    }

    // Lock deadline if deadline is established
    if (!existing.deadlineLocked && effectiveDeadline) {
      dataToUpdate.deadlineLocked = true;
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const assigneesChanged =
        data.assignees !== undefined || data.assigneeIds !== undefined;

      // Handle structured assignees updates
      if (data.assignees !== undefined) {
        const sorted = [...data.assignees].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        const uniqueUserIds = Array.from(new Set(sorted.map((a) => a.userId)));

        await tx.taskAssignment.deleteMany({ where: { taskId: id } });
        if (uniqueUserIds.length > 0) {
          await tx.taskAssignment.createMany({
            data: uniqueUserIds.map((uid) => ({
              taskId: id,
              userId: uid,
            })),
          });
        }

        // If multiple sequential assignees, update or create workflow stages
        if (sorted.length > 1) {
          const existingStages = await tx.workflowStage.findMany({
            where: { taskId: id },
            orderBy: { position: "asc" },
          });

          const assigneeUsers = await tx.user.findMany({
            where: { id: { in: uniqueUserIds } },
            select: { id: true, name: true },
          });
          const userNameMap = new Map(assigneeUsers.map((u) => [u.id, u.name]));

          for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i];
            const uName = userNameMap.get(a.userId) || `შემსრულებელი ${i + 1}`;
            const parsedStageDeadline = a.deadline ? new Date(a.deadline) : null;
            const existingStage = existingStages[i];

            if (existingStage) {
              await tx.workflowStage.update({
                where: { id: existingStage.id },
                data: {
                  position: i,
                  title: `ეტაპი ${i + 1}: ${uName}`,
                  deadline: parsedStageDeadline ?? existingStage.deadline,
                  deadlineLocked: Boolean(
                    parsedStageDeadline ?? existingStage.deadline
                  ),
                },
              });
              await tx.stageAssignment.deleteMany({
                where: { stageId: existingStage.id },
              });
              await tx.stageAssignment.create({
                data: { stageId: existingStage.id, userId: a.userId },
              });
            } else {
              const newStage = await tx.workflowStage.create({
                data: {
                  taskId: id,
                  position: i,
                  title: `ეტაპი ${i + 1}: ${uName}`,
                  isActive: i === 0 && !existingStages.some((s) => s.isActive),
                  deadline: parsedStageDeadline,
                  deadlineLocked: Boolean(parsedStageDeadline),
                },
              });
              await tx.stageAssignment.create({
                data: { stageId: newStage.id, userId: a.userId },
              });
            }
          }

          if (existingStages.length > sorted.length) {
            const extras = existingStages.slice(sorted.length);
            for (const extra of extras) {
              await tx.workflowStage.delete({ where: { id: extra.id } });
            }
          }
        }
      } else if (data.assigneeIds !== undefined) {
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

      // Handle links
      if (data.links && data.links.length > 0) {
        for (const link of data.links) {
          if (link.name?.trim() && link.url?.trim()) {
            await tx.attachment.create({
              data: {
                taskId: id,
                userId: user.id,
                originalName: link.name.trim(),
                storedName: "link-" + crypto.randomUUID(),
                mimeType: "text/html",
                sizeBytes: 0,
                url: link.url.trim(),
                isExternal: true,
              },
            });
          }
        }
      }

      const task = await tx.task.update({
        where: { id },
        data: dataToUpdate,
      });

      // Audit logs
      if (
        incomingDeadline !== undefined &&
        existing.deadline?.getTime() !== incomingDeadline?.getTime()
      ) {
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

      if (
        incomingStart !== undefined &&
        existing.startDate?.getTime() !== incomingStart?.getTime()
      ) {
        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action: "SCHEDULE_CHANGED",
          entityType: "TASK",
          entityId: id,
          oldValues: { startDate: existing.startDate },
          newValues: { startDate: incomingStart },
          reason: data.rescheduleReason || "დაწყების თარიღის ცვლილება",
          tx,
        });
      }

      if (data.status !== undefined && data.status !== existing.status) {
        let action: "WORK_PAUSED" | "WORK_RESUMED" | "STATUS_CHANGED" =
          "STATUS_CHANGED";
        let reason = data.pauseReason || data.blockedReason || "სტატუსის ცვლილება";

        if (data.status === TaskStatus.PAUSED) {
          action = "WORK_PAUSED";
          reason = data.pauseReason || "სამუშაო შეჩერდა";
        } else if (existing.status === TaskStatus.PAUSED) {
          action = "WORK_RESUMED";
          reason = data.rescheduleReason || "სამუშაო განახლდა";
        }

        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action,
          entityType: "TASK",
          entityId: id,
          oldValues: { status: existing.status },
          newValues: { status: data.status },
          reason,
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

      if (assigneesChanged) {
        await logAuditEvent({
          taskId: id,
          actorId: user.id,
          action: "TASK_ASSIGNED",
          entityType: "TASK",
          entityId: id,
          oldValues: {
            assigneeIds: existing.assignments.map((a) => a.userId),
          },
          newValues: { assigneeIds: data.assigneeIds },
          reason: "შემსრულებლების განახლება",
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
