import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateDeadlineModification, calculateAndSyncTaskProgress } from "@/lib/workflow";
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
      include: {
        task: {
          select: {
            id: true,
            status: true,
            stages: {
              orderBy: { position: "asc" },
              include: {
                assignments: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "სამუშაო ეტაპი ვერ მოიძებნა" }, { status: 404 });
    }

    const allStages = existing.task.stages;

    // Founder Decision 1: Do not allow deletion of the only remaining workflow stage
    if (allStages.length <= 1) {
      return NextResponse.json(
        {
          error:
            "დავალების ერთადერთი სამუშაო ეტაპის წაშლა დაუშვებელია. ეტაპებზე დაფუძნებული დავალება არ შეიძლება დარჩეს ეტაპის გარეშე.",
        },
        { status: 400 }
      );
    }

    // Founder Decision 1 & 2: If deleting an active stage, verify valid active successor and assignee
    if (existing.isActive) {
      const remainingStages = allStages.filter((s) => s.id !== stageId);
      const nextActiveStage = remainingStages.find((s) => !s.isCompleted);

      // Stage deletion must NEVER imply completion - if no valid incomplete stage exists, reject deletion
      if (!nextActiveStage) {
        return NextResponse.json(
          {
            error:
              "აქტიური ეტაპის წაშლა შეუძლებელია, რადგან დავალებას არ გააჩნია მომდევნო სამუშაო ეტაპი. დავალების დასასრულებლად გამოიყენეთ დასრულების ფუნქცია.",
          },
          { status: 400 }
        );
      }

      // If next stage has no responsible assignee, reject deletion to prevent orphaned tasks
      if (!nextActiveStage.assignments || nextActiveStage.assignments.length === 0) {
        return NextResponse.json(
          {
            error: `აქტიური ეტაპის წაშლა შეუძლებელია, რადგან მომდევნო ეტაპს ("${nextActiveStage.title}") არ ჰყავს პასუხისმგებელი შემსრულებელი. გთხოვთ ჯერ მიანიჭოთ შემსრულებელი მომდევნო ეტაპს.`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete the targeted stage
      await tx.workflowStage.delete({ where: { id: stageId } });

      // 2. Fetch remaining stages ordered by position
      const remainingStages = await tx.workflowStage.findMany({
        where: { taskId: existing.taskId },
        orderBy: { position: "asc" },
        include: {
          assignments: {
            select: { userId: true },
          },
        },
      });

      // 3. Re-index positions
      for (let i = 0; i < remainingStages.length; i++) {
        if (remainingStages[i].position !== i) {
          await tx.workflowStage.update({
            where: { id: remainingStages[i].id },
            data: { position: i },
          });
          remainingStages[i].position = i;
        }
      }

      // 4. Handle active stage succession if the deleted stage was active
      if (existing.isActive) {
        // Find the first subsequent incomplete stage
        const nextActiveStage = remainingStages.find((s) => !s.isCompleted);

        if (nextActiveStage) {
          // Activate the next incomplete stage
          await tx.workflowStage.update({
            where: { id: nextActiveStage.id },
            data: { isActive: true },
          });

          // Notify assignees of the newly activated stage
          for (const a of nextActiveStage.assignments) {
            await tx.notification.create({
              data: {
                userId: a.userId,
                taskId: existing.taskId,
                title: "სამუშაო ეტაპი გააქტიურდა",
                message: `წინა ეტაპის წაშლის შემდეგ თქვენი ეტაპი "${nextActiveStage.title}" გახდა აქტიური.`,
              },
            });
          }
        }
      }

      // 5. Recalculate and sync overall task progress
      await calculateAndSyncTaskProgress(existing.taskId, tx);

      // 6. Log accurate STAGE_DELETED audit event
      await logAuditEvent({
        taskId: existing.taskId,
        actorId: user.id,
        action: "STAGE_DELETED",
        entityType: "STAGE",
        entityId: stageId,
        oldValues: {
          title: existing.title,
          position: existing.position,
          isActive: existing.isActive,
          isCompleted: existing.isCompleted,
        },
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
