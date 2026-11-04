import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const updateCommentSchema = z.object({
  content: z.string().min(1, "კომენტარი არ შეიძლება იყოს ცარიელი").max(5000, "კომენტარი ზედმეტად გრძელია"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const result = updateCommentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { content } = result.data;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return NextResponse.json({ error: "კომენტარი ვერ მოიძებნა" }, { status: 404 });
    }

    if (comment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ კომენტარის რედაქტირების უფლება" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.comment.update({
        where: { id },
        data: { content: content.trim() },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await logAuditEvent({
        taskId: comment.taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        entityType: "COMMENT",
        entityId: id,
        oldValues: { content: comment.content },
        newValues: { content: res.content },
        reason: "კომენტარის რედაქტირება",
        tx,
      });

      return res;
    });

    return NextResponse.json({ success: true, comment: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/comments/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      return NextResponse.json({ error: "კომენტარი ვერ მოიძებნა" }, { status: 404 });
    }

    if (comment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ კომენტარის წაშლის უფლება" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({
        where: { id },
      });

      await logAuditEvent({
        taskId: comment.taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        entityType: "COMMENT",
        entityId: id,
        oldValues: { content: comment.content },
        reason: "კომენტარის წაშლა",
        tx,
      });
    });

    return NextResponse.json({ success: true, message: "კომენტარი წარმატებით წაიშალა" });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("DELETE /api/comments/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
