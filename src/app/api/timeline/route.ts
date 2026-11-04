import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { format, addDays, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const centerDateStr = searchParams.get("date"); // e.g. "2026-11-04"
    const rangeDays = parseInt(searchParams.get("days") || "14", 10);
    const mode = searchParams.get("mode") || "schedule"; // "schedule" or "activity"
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    const type = searchParams.get("type");

    const centerDate = centerDateStr ? new Date(centerDateStr) : new Date();
    const startDate = startOfDay(subDays(centerDate, Math.floor(rangeDays / 2)));
    const endDate = endOfDay(addDays(centerDate, Math.ceil(rangeDays / 2)));

    // Load working calendar
    const workingDays = await prisma.workingCalendar.findMany();
    const workingDaysMap = new Map<number, boolean>();
    workingDays.forEach((w) => workingDaysMap.set(w.dayOfWeek, w.isWorking));

    // Load holidays in range
    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Generate date sequence
    const dates: any[] = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const dayOfWeek = cur.getDay();
      const isWorking = workingDaysMap.get(dayOfWeek) ?? (dayOfWeek !== 0 && dayOfWeek !== 6);
      const holiday = holidays.find((h) => isSameDay(new Date(h.date), cur));

      dates.push({
        date: format(cur, "yyyy-MM-dd"),
        dateObj: new Date(cur),
        dayOfWeek,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isWorking: holiday ? false : isWorking,
        holidayName: holiday?.name || null,
        isToday: isSameDay(cur, new Date()),
        tasks: [],
        activities: [],
      });
      cur = addDays(cur, 1);
    }

    // Filter tasks
    const taskWhere: any = {};
    if (projectId) taskWhere.projectId = projectId;
    if (assigneeId) taskWhere.assignments = { some: { userId: assigneeId } };
    if (type) taskWhere.type = type;

    if (mode === "schedule") {
      // Find tasks that overlap with the date range
      const tasks = await prisma.task.findMany({
        where: {
          ...taskWhere,
          status: { not: "CANCELLED" },
          OR: [
            {
              startDate: { lte: endDate },
              deadline: { gte: startDate },
            },
            {
              startDate: null,
              deadline: { gte: startDate, lte: endDate },
            },
            {
              startDate: { gte: startDate, lte: endDate },
              deadline: null,
            },
          ],
        },
        include: {
          project: true,
          assignments: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          subtasks: {
            select: { id: true, status: true },
          },
        },
      });

      // Project each task onto its relevant timeline dates
      for (const t of tasks) {
        const taskStart = t.startDate ? startOfDay(new Date(t.startDate)) : (t.deadline ? startOfDay(new Date(t.deadline)) : null);
        const taskEnd = t.deadline ? endOfDay(new Date(t.deadline)) : (t.startDate ? endOfDay(new Date(t.startDate)) : null);

        if (!taskStart || !taskEnd) continue;

        for (const d of dates) {
          const dayDate = d.dateObj;
          if (dayDate >= startOfDay(taskStart) && dayDate <= endOfDay(taskEnd)) {
            // Check if overdue relative to today
            const isOverdue = t.deadline && new Date() > new Date(t.deadline) && t.status !== "DONE";

            d.tasks.push({
              id: t.id,
              taskNumber: t.taskNumber,
              title: t.title,
              type: t.type,
              priority: t.priority,
              status: t.status,
              progress: t.progress,
              startDate: t.startDate,
              deadline: t.deadline,
              isOverdue,
              assignees: t.assignments.map((a) => a.user),
              totalSubtasks: t.subtasks.length,
              doneSubtasks: t.subtasks.filter((s) => s.status === "DONE").length,
            });
          }
        }
      }
    } else {
      // Activity Mode: query immutable audit events in range
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          ...(taskWhere.projectId ? { task: { projectId } } : {}),
        },
        include: {
          actor: { select: { id: true, name: true, avatarUrl: true } },
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
        orderBy: { createdAt: "desc" },
      });

      for (const a of auditEvents) {
        const eventDate = format(new Date(a.createdAt), "yyyy-MM-dd");
        const targetDate = dates.find((d) => d.date === eventDate);
        if (targetDate) {
          targetDate.activities.push(a);
        }
      }
    }

    return NextResponse.json({
      dates: dates.map(({ dateObj, ...rest }) => rest),
      range: {
        start: format(startDate, "yyyy-MM-dd"),
        end: format(endDate, "yyyy-MM-dd"),
        center: format(centerDate, "yyyy-MM-dd"),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/timeline error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
