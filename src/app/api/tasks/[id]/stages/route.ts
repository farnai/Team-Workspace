import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const createStageSchema = z.object({
  title: z.string().min(1, "ეტაპის სათაური სავალდებულოა"),
  description: z.string().optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: taskId } = await params;
    const body = await req.json();

    const result = createStageSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { title, description, startDate, deadline, assigneeIds } = result.data;

    const existingCount = await prisma.workflowStage.count({
      where: { taskId },
    });

    // If it's the first stage, it is active by default
    const isActive = existingCount === 0;
    const parsedStart = startDate ? new Date(startDate) : null;
    const parsedDeadline = deadline ? new Date(deadline) : null;
    const hasInitialAssignees = Boolean(assigneeIds && assigneeIds.length > 0);
    const shouldLock = Boolean(hasInitialAssignees && parsedDeadline);

    const stage = await prisma.$transaction(async (tx) => {
      const created = await tx.workflowStage.create({
        data: {
          taskId,
          title,
          description,
          position: existingCount,
          isActive,
          startDate: parsedStart,
          deadline: parsedDeadline,
          deadlineLocked: shouldLock,
        },
      });

      if (assigneeIds && assigneeIds.length > 0) {
        await tx.stageAssignment.createMany({
          data: assigneeIds.map((uid) => ({
            stageId: created.id,
            userId: uid,
          })),
        });
      }

      await logAuditEvent({
        taskId,
        actorId: user.id,
        action: "STAGE_CREATED",
        entityType: "STAGE",
        entityId: created.id,
        newValues: { title, position: existingCount, assigneeIds },
        reason: "ახალი სამუშაო ეტაპის შექმნა",
        tx,
      });

      return created;
    });

    return NextResponse.json({ success: true, stage });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("POST /api/tasks/[id]/stages error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
