import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const updateDailyUpdateSchema = z.object({
  content: z.string().min(1, "ჩანაწერი არ შეიძლება იყოს ცარიელი"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const result = updateDailyUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { content } = result.data;

    const dailyUpdate = await prisma.dailyUpdate.findUnique({
      where: { id },
    });

    if (!dailyUpdate) {
      return NextResponse.json({ error: "ჩანაწერი ვერ მოიძებნა" }, { status: 404 });
    }

    if (dailyUpdate.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ ჩანაწერის რედაქტირების უფლება" }, { status: 403 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.dailyUpdate.update({
        where: { id },
        data: { content: content.trim() },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await logAuditEvent({
        taskId: dailyUpdate.taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        entityType: "DAILY_UPDATE",
        entityId: id,
        oldValues: { content: dailyUpdate.content },
        newValues: { content: res.content },
        reason: "დღიური ჩანაწერის რედაქტირება",
        tx,
      });

      return res;
    });

    return NextResponse.json({ success: true, dailyUpdate: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/daily-updates/[id] error:", error);
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

    const dailyUpdate = await prisma.dailyUpdate.findUnique({
      where: { id },
    });

    if (!dailyUpdate) {
      return NextResponse.json({ error: "ჩანაწერი ვერ მოიძებნა" }, { status: 404 });
    }

    if (dailyUpdate.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ ჩანაწერის წაშლის უფლება" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dailyUpdate.delete({
        where: { id },
      });

      await logAuditEvent({
        taskId: dailyUpdate.taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        entityType: "DAILY_UPDATE",
        entityId: id,
        oldValues: { content: dailyUpdate.content },
        reason: "დღიური ჩანაწერის წაშლა",
        tx,
      });
    });

    return NextResponse.json({ success: true, message: "ჩანაწერი წარმატებით წაიშალა" });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("DELETE /api/daily-updates/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
