import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "პროექტის სახელი სავალდებულოა"),
  description: z.string().optional(),
  color: z.string().optional(),
});

export async function GET() {
  try {
    await requireAuth();

    const projects = await prisma.project.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: {
            id: true,
            status: true,
            deadline: true,
            progress: true,
          },
        },
      },
    });

    const now = new Date();

    const enriched = projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const overdue = p.tasks.filter(
        (t) =>
          t.deadline &&
          new Date(t.deadline) < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;
      const progress =
        total > 0
          ? Math.round(
              p.tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / total
            )
          : 0;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color || "#EA580C",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        taskCount: total,
        completedCount: done,
        inProgressCount: inProgress,
        overdueCount: overdue,
        progress,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const result = createProjectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: result.data.name,
        description: result.data.description,
        color: result.data.color || "#EA580C",
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
