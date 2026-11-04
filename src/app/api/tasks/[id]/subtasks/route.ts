import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { calculateAndSyncTaskProgress } from "@/lib/workflow";
import { z } from "zod";

const createSubtaskSchema = z.object({
  title: z.string().min(1, "საბტასკის სათაური სავალდებულოა"),
  description: z.string().optional(),
  stageId: z.string().nullable().optional(),
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

    const result = createSubtaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { title, description, stageId, deadline, assigneeIds } = result.data;

    const existingCount = await prisma.subtask.count({
      where: { taskId, stageId: stageId ?? null },
    });

    const parsedDeadline = deadline ? new Date(deadline) : null;

    const subtask = await prisma.$transaction(async (tx) => {
      const created = await tx.subtask.create({
        data: {
          taskId,
          stageId: stageId ?? null,
          title,
          description,
          position: existingCount,
          deadline: parsedDeadline,
          status: "TODO",
        },
      });

      if (assigneeIds && assigneeIds.length > 0) {
        await tx.subtaskAssignment.createMany({
          data: assigneeIds.map((uid) => ({
            subtaskId: created.id,
            userId: uid,
          })),
        });
      }

      await logAuditEvent({
        taskId,
        actorId: user.id,
        action: "SUBTASK_CREATED",
        entityType: "SUBTASK",
        entityId: created.id,
        newValues: { title, stageId, assigneeIds },
        reason: "ახალი საბტასკის დამატება",
        tx,
      });

      return created;
    });

    // Recalculate progress
    const updatedProgress = await calculateAndSyncTaskProgress(taskId);

    return NextResponse.json({ success: true, subtask, progress: updatedProgress });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("POST /api/tasks/[id]/subtasks error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
