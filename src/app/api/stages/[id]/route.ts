import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateDeadlineModification } from "@/lib/workflow";
import { Role, Prisma } from "@prisma/client";
import { z } from "zod";

const updateStageSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().optional(),
  isActive: z.boolean().optional(),
  rescheduleReason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: stageId } = await params;
    const body = await req.json();

    const result = updateStageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const data = result.data;

    const existing = await prisma.workflowStage.findUnique({
      where: { id: stageId },
      include: { assignments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "სამუშაო ეტაპი ვერ მოიძებნა" }, { status: 404 });
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

    const dataToUpdate: Prisma.WorkflowStageUpdateInput = {};
    if (data.title !== undefined) dataToUpdate.title = data.title;
    if (data.description !== undefined) dataToUpdate.description = data.description;
    if (incomingStart !== undefined) dataToUpdate.startDate = incomingStart;
    if (incomingDeadline !== undefined) dataToUpdate.deadline = incomingDeadline;
    if (data.position !== undefined) dataToUpdate.position = data.position;
    if (data.isActive !== undefined) dataToUpdate.isActive = data.isActive;

    // Lock deadline if deadline is set and stage is assigned
    if (
      !existing.deadlineLocked &&
      ((incomingDeadline || existing.deadline) &&
        ((data.assigneeIds && data.assigneeIds.length > 0) || existing.assignments.length > 0))
    ) {
      dataToUpdate.deadlineLocked = true;
    }

    const updatedStage = await prisma.$transaction(async (tx) => {
      if (data.assigneeIds !== undefined) {
        await tx.stageAssignment.deleteMany({ where: { stageId } });
        if (data.assigneeIds.length > 0) {
          await tx.stageAssignment.createMany({
            data: data.assigneeIds.map((uid) => ({
              stageId,
              userId: uid,
            })),
          });
        }
      }

      const updated = await tx.workflowStage.update({
        where: { id: stageId },
        data: dataToUpdate,
        include: {
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
          entityType: "STAGE",
          entityId: stageId,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || "ადმინისტრატორის მიერ ეტაპის დედლაინის შეცვლა",
          tx,
        });
      }

      if (data.position !== undefined && data.position !== existing.position) {
        await logAuditEvent({
          taskId: existing.taskId,
          actorId: user.id,
          action: "STAGE_REORDERED",
          entityType: "STAGE",
          entityId: stageId,
          oldValues: { position: existing.position },
          newValues: { position: data.position },
          reason: "სამუშაო ეტაპის რიგითობის შეცვლა",
          tx,
        });
      }

      return updated;
    });

    return NextResponse.json({ success: true, stage: updatedStage });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/stages/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: stageId } = await params;

    const existing = await prisma.workflowStage.findUnique({
      where: { id: stageId },
    });

    if (!existing) {
      return NextResponse.json({ error: "სამუშაო ეტაპი ვერ მოიძებნა" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.workflowStage.delete({ where: { id: stageId } });

      // Re-index remaining stages for consistency
      const remainingStages = await tx.workflowStage.findMany({
        where: { taskId: existing.taskId },
        orderBy: { position: "asc" },
      });

      for (let i = 0; i < remainingStages.length; i++) {
        if (remainingStages[i].position !== i) {
          await tx.workflowStage.update({
            where: { id: remainingStages[i].id },
            data: { position: i },
          });
        }
      }

      await logAuditEvent({
        taskId: existing.taskId,
        actorId: user.id,
        action: "STAGE_REORDERED",
        entityType: "STAGE",
        entityId: stageId,
        oldValues: { title: existing.title, position: existing.position },
        reason: "სამუშაო ეტაპის წაშლა",
        tx,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("DELETE /api/stages/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
