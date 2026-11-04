import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { calculateAndSyncTaskProgress } from "@/lib/workflow";
import { SubtaskStatus } from "@prisma/client";
import { z } from "zod";

const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.nativeEnum(SubtaskStatus).optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
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

    const dataToUpdate: any = {};
    if (data.title !== undefined) dataToUpdate.title = data.title;
    if (data.deadline !== undefined) {
      dataToUpdate.deadline = data.deadline ? new Date(data.deadline) : null;
    }

    const isCompleting = data.status === SubtaskStatus.DONE && existing.status !== SubtaskStatus.DONE;
    const isReopening = data.status === SubtaskStatus.TODO && existing.status === SubtaskStatus.DONE;

    if (data.status !== undefined) {
      dataToUpdate.status = data.status;
      if (isCompleting) {
        dataToUpdate.completedById = user.id;
        dataToUpdate.completedAt = new Date();
      } else if (isReopening) {
        dataToUpdate.completedById = null;
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
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/subtasks/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
