import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(2).optional(),
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
      return NextResponse.json({ error: "არასწორი მონაცემები" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "მომხმარებელი ვერ მოიძებნა" }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (result.data.isActive !== undefined) dataToUpdate.isActive = result.data.isActive;
    if (result.data.name !== undefined) dataToUpdate.name = result.data.name;
    if (result.data.password) {
      dataToUpdate.passwordHash = await bcrypt.hash(result.data.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "USER_STATUS_CHANGED",
      entityType: "USER",
      entityId: id,
      oldValues: { isActive: targetUser.isActive, name: targetUser.name },
      newValues: { isActive: updatedUser.isActive, name: updatedUser.name },
      reason: "ადმინისტრატორის მიერ მომხმარებლის პროფილის განახლება",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
