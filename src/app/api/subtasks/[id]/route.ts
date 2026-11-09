import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { calculateAndSyncTaskProgress, validateDeadlineModification } from "@/lib/workflow";
import { SubtaskStatus, Role, Prisma } from "@prisma/client";
import { z } from "zod";

const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(SubtaskStatus).optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().optional(),
  stageId: z.string().nullable().optional(),
  rescheduleReason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: subtaskId } = await params;
    const body = await req.json();

    const result = updateSubtaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const data = result.data;

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
      include: { task: true, assignments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "საბტასკი ვერ მოიძებნა" }, { status: 404 });
    }

    const isAdmin = user.role === Role.ADMIN;
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

    const dataToUpdate: Prisma.SubtaskUpdateInput = {};
    if (data.title !== undefined) dataToUpdate.title = data.title;
    if (data.description !== undefined) dataToUpdate.description = data.description;
    if (data.position !== undefined) dataToUpdate.position = data.position;
    if (data.stageId !== undefined) {
      dataToUpdate.stage = data.stageId ? { connect: { id: data.stageId } } : { disconnect: true };
    }
    if (incomingStart !== undefined) dataToUpdate.startDate = incomingStart;
    if (incomingDeadline !== undefined) dataToUpdate.deadline = incomingDeadline;

    // Lock deadline if deadline is set and subtask is assigned
    if (
      !existing.deadlineLocked &&
      ((incomingDeadline || existing.deadline) &&
        ((data.assigneeIds && data.assigneeIds.length > 0) || existing.assignments.length > 0))
    ) {
      dataToUpdate.deadlineLocked = true;
    }

    const isCompleting = data.status === SubtaskStatus.DONE && existing.status !== SubtaskStatus.DONE;
    const isReopening = data.status === SubtaskStatus.TODO && existing.status === SubtaskStatus.DONE;

    if (data.status !== undefined) {
      dataToUpdate.status = data.status;
      if (isCompleting) {
        dataToUpdate.completedBy = { connect: { id: user.id } };
        dataToUpdate.completedAt = new Date();
      } else if (isReopening) {
        dataToUpdate.completedBy = { disconnect: true };
        dataToUpdate.completedAt = null;
      }
    }

    const updatedSubtask = await prisma.$transaction(async (tx) => {
      if (data.assigneeIds !== undefined) {
        await tx.subtaskAssignment.deleteMany({ where: { subtaskId } });
        if (data.assigneeIds.length > 0) {
          await tx.subtaskAssignment.createMany({
            data: data.assigneeIds.map((uid) => ({
              subtaskId,
              userId: uid,
            })),
          });
        }
      }

      const updated = await tx.subtask.update({
        where: { id: subtaskId },
        data: dataToUpdate,
        include: {
          completedBy: { select: { id: true, name: true, avatarUrl: true } },
          assignments: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      });

      if (incomingDeadline !== undefined && existing.deadline?.getTime() !== incomingDeadline?.getTime()) {
        await logAuditEvent({
          taskId: existing.taskId,
          actorId: user.id,
          action: "DEADLINE_CHANGED",
          entityType: "SUBTASK",
          entityId: subtaskId,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || "ადმინისტრატორის მიერ საბტასკის დედლაინის შეცვლა",
          tx,
        });
      }

      if (isCompleting) {
        await logAuditEvent({
          taskId: existing.taskId,
          actorId: user.id,
          action: "SUBTASK_COMPLETED",
          entityType: "SUBTASK",
          entityId: subtaskId,
          newValues: { status: "DONE", subtaskTitle: existing.title },
          reason: "საბტასკის შესრულება",
          tx,
        });
      } else if (isReopening) {
        await logAuditEvent({
          taskId: existing.taskId,
          actorId: user.id,
          action: "SUBTASK_REOPENED",
          entityType: "SUBTASK",
          entityId: subtaskId,
          newValues: { status: "TODO", subtaskTitle: existing.title },
          reason: "საბტასკის ხელახლა გახსნა",
          tx,
        });
      }

      return updated;
    });

    // Centralized progress synchronization
    const newProgress = await calculateAndSyncTaskProgress(existing.taskId);

    return NextResponse.json({
      success: true,
      subtask: updatedSubtask,
      progress: newProgress,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/subtasks/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: subtaskId } = await params;

    const existing = await prisma.subtask.findUnique({
      where: { id: subtaskId },
    });

    if (!existing) {
      return NextResponse.json({ error: "საბტასკი ვერ მოიძებნა" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.subtask.delete({ where: { id: subtaskId } });

      await logAuditEvent({
        taskId: existing.taskId,
        actorId: user.id,
        action: "SUBTASK_DELETED",
        entityType: "SUBTASK",
        entityId: subtaskId,
        oldValues: { title: existing.title, status: existing.status },
        reason: "საბტასკის წაშლა",
        tx,
      });
    });

    const newProgress = await calculateAndSyncTaskProgress(existing.taskId);

    return NextResponse.json({ success: true, progress: newProgress });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("DELETE /api/subtasks/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
