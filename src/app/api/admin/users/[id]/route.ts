import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { Prisma, Role, Department } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6, "პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო").optional(),
  name: z.string().min(2, "სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან").optional(),
  role: z.nativeEnum(Role).optional(),
  department: z.nativeEnum(Department).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    const result = updateUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "მომხმარებელი ვერ მოიძებნა" }, { status: 404 });
    }

    if (id === admin.id && result.data.isActive === false) {
      return NextResponse.json(
        { error: "საკუთარი ადმინისტრატორის ანგარიშის დეაქტივაცია შეუძლებელია" },
        { status: 400 }
      );
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};
    if (result.data.isActive !== undefined) dataToUpdate.isActive = result.data.isActive;
    if (result.data.name !== undefined) dataToUpdate.name = result.data.name;
    if (result.data.role !== undefined) dataToUpdate.role = result.data.role;
    if (result.data.department !== undefined) dataToUpdate.department = result.data.department;
    if (result.data.password) {
      dataToUpdate.passwordHash = await bcrypt.hash(result.data.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    let reason = "ადმინისტრატორის მიერ მომხმარებლის პროფილის განახლება";
    if (result.data.isActive !== undefined) {
      reason = result.data.isActive ? "მომხმარებლის გააქტიურება" : "მომხმარებლის დეაქტივაცია";
    } else if (result.data.password) {
      reason = "მომხმარებლის პაროლის განახლება ადმინისტრატორის მიერ";
    } else if (result.data.department !== undefined) {
      reason = `მომხმარებლის გუნდის ცვლილება: ${result.data.department}`;
    }

    await logAuditEvent({
      actorId: admin.id,
      action: "USER_STATUS_CHANGED",
      entityType: "USER",
      entityId: id,
      oldValues: {
        isActive: targetUser.isActive,
        name: targetUser.name,
        role: targetUser.role,
        department: targetUser.department,
      },
      newValues: {
        isActive: updatedUser.isActive,
        name: updatedUser.name,
        role: updatedUser.role,
        department: updatedUser.department,
      },
      reason,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია (მხოლოდ ადმინისტრატორს)" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
