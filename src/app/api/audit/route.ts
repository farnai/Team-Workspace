import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");
    const actorId = searchParams.get("actorId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = {};
    if (taskId) where.taskId = taskId;
    if (actorId) where.actorId = actorId;

    const auditEvents = await prisma.auditEvent.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true, role: true } },
        task: {
          select: {
            id: true,
            taskNumber: true,
            title: true,
            type: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ auditEvents });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/audit error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
