import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { z } from "zod";

const updateProjectSchema = z.object({
  name: z.string().min(1, "პროექტის სახელი სავალდებულოა").optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            assignments: { include: { user: true } },
            stages: true,
          },
          orderBy: { taskNumber: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "პროექტი ვერ მოიძებნა" }, { status: 404 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "პროექტის რედაქტირების უფლება აქვს მხოლოდ ადმინისტრატორს" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const result = updateProjectSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "პროექტი ვერ მოიძებნა" }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        name: result.data.name !== undefined ? result.data.name : existing.name,
        description:
          result.data.description !== undefined
            ? result.data.description
            : existing.description,
        color: result.data.color !== undefined ? result.data.color : existing.color,
        isArchived:
          result.data.isArchived !== undefined
            ? result.data.isArchived
            : existing.isArchived,
      },
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "პროექტის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "პროექტი ვერ მოიძებნა" }, { status: 404 });
    }

    // If project has tasks, reassign them to default project before deleting
    if (existing._count.tasks > 0) {
      // Find a fallback project
      const fallbackProject = await prisma.project.findFirst({
        where: { id: { not: id }, isArchived: false },
      });

      if (!fallbackProject) {
        return NextResponse.json(
          {
            error:
              "პროექტში არსებობს დავალებები და სხვა აქტიური პროექტი არ მოიძებნა. გთხოვთ ჯერ შექმნათ სხვა პროექტი ან წაშალოთ ტასკები.",
          },
          { status: 400 }
        );
      }

      // Reassign tasks to fallback project
      await prisma.task.updateMany({
        where: { projectId: id },
        data: { projectId: fallbackProject.id },
      });
    }

    // Soft delete or delete
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "პროექტი წარმატებით წაიშალა",
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

