import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const createDailyUpdateSchema = z.object({
  content: z.string().min(1, "ჩანაწერი არ შეიძლება იყოს ცარიელი"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: taskId } = await params;

    const dailyUpdates = await prisma.dailyUpdate.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ success: true, dailyUpdates });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/tasks/[id]/daily-updates error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: taskId } = await params;
    const body = await req.json();

    const result = createDailyUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { content } = result.data;

    const update = await prisma.$transaction(async (tx) => {
      const created = await tx.dailyUpdate.create({
        data: {
          taskId,
          userId: user.id,
          content,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await logAuditEvent({
        taskId,
        actorId: user.id,
        action: "DAILY_UPDATE_ADDED",
        entityType: "DAILY_UPDATE",
        entityId: created.id,
        newValues: { snippet: content.slice(0, 100) },
        reason: "დღიური ჩანაწერის დამატება: " + content.slice(0, 40),
        tx,
      });

      return created;
    });

    return NextResponse.json({ success: true, dailyUpdate: update });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("POST /api/tasks/[id]/daily-updates error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
