import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const [workingCalendar, holidays] = await Promise.all([
      prisma.workingCalendar.findMany({ orderBy: { dayOfWeek: "asc" } }),
      prisma.holiday.findMany({ orderBy: { date: "asc" } }),
    ]);

    return NextResponse.json({ workingCalendar, holidays });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { days } = body; // Array of { dayOfWeek: number, isWorking: boolean }

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: "არასწორი მონაცემები" }, { status: 400 });
    }

    for (const d of days) {
      await prisma.workingCalendar.upsert({
        where: { dayOfWeek: d.dayOfWeek },
        update: { isWorking: d.isWorking },
        create: { dayOfWeek: d.dayOfWeek, isWorking: d.isWorking },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
