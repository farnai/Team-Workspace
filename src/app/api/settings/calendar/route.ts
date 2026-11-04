import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const createHolidaySchema = z.object({
  date: z.string().min(1, "თარიღი სავალდებულოა"),
  name: z.string().min(2, "დასახელება უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან"),
  isOfficial: z.boolean().default(false),
});

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
    const admin = await requireAdmin();
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

    await logAuditEvent({
      actorId: admin.id,
      action: "CALENDAR_UPDATED",
      entityType: "SETTINGS",
      entityId: "working_calendar",
      newValues: { days },
      reason: "სამუშაო კალენდრის დღეების განახლება ადმინისტრატორის მიერ",
    });

    return NextResponse.json({ success: true });
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

    const result = createHolidaySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { date, name, isOfficial } = result.data;
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "არასწორი თარიღის ფორმატი" }, { status: 400 });
    }

    // Check if holiday already exists on this date
    const existing = await prisma.holiday.findFirst({
      where: {
        date: {
          gte: new Date(parsedDate.toISOString().slice(0, 10) + "T00:00:00.000Z"),
          lte: new Date(parsedDate.toISOString().slice(0, 10) + "T23:59:59.999Z"),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "ამ თარიღზე უქმე უკვე დამატებულია" }, { status: 400 });
    }

    const newHoliday = await prisma.holiday.create({
      data: {
        date: parsedDate,
        name,
        isOfficial: isOfficial ?? false,
      },
    });

    await logAuditEvent({
      actorId: admin.id,
      action: "CALENDAR_UPDATED",
      entityType: "HOLIDAY",
      entityId: newHoliday.id,
      newValues: { date: newHoliday.date, name: newHoliday.name, isOfficial: newHoliday.isOfficial },
      reason: `ახალი უქმე დღის დამატება: ${name}`,
    });

    return NextResponse.json({ success: true, holiday: newHoliday });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია (მხოლოდ ადმინისტრატორს)" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID სავალდებულოა" }, { status: 400 });
    }

    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      return NextResponse.json({ error: "უქმე დღე ვერ მოიძებნა" }, { status: 404 });
    }

    await prisma.holiday.delete({ where: { id } });

    await logAuditEvent({
      actorId: admin.id,
      action: "CALENDAR_UPDATED",
      entityType: "HOLIDAY",
      entityId: id,
      oldValues: { date: holiday.date, name: holiday.name },
      reason: `უქმე დღის წაშლა: ${holiday.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "წვდომა შეზღუდულია (მხოლოდ ადმინისტრატორს)" }, { status: 403 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
