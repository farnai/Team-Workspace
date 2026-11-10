import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role, Department } from "@prisma/client";

const createUserSchema = z.object({
  name: z.string().min(2, "სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან"),
  email: z.string().email("არასწორი ელ.ფოსტა"),
  password: z.string().min(6, "პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო"),
  role: z.nativeEnum(Role).default(Role.USER),
  department: z.nativeEnum(Department).default(Department.DEVELOPMENT),
  avatarUrl: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია (მხოლოდ ადმინისტრატორს)" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { name, email, password, role, department, avatarUrl } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "მომხმარებელი ამ ელ.ფოსტით უკვე არსებობს" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role,
        department,
        avatarUrl,
        isActive: true,
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: newUser.id,
      newValues: { name: newUser.name, email: newUser.email, role: newUser.role, department: newUser.department },
      reason: "ადმინისტრატორის მიერ ახალი მომხმარებლის შექმნა",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        isActive: newUser.isActive,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია" }, { status: 403 });
    }
    console.error("Create user error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
