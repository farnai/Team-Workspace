import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { format, addDays, subDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { TaskType, Prisma } from "@prisma/client";
import {
  getGeorgianHolidaysForYear,
  isDateWorkingDay,
  formatDateKey,
} from "@/lib/calendar";
import { isTbilisiToday } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const centerDateStr = searchParams.get("date"); // e.g. "2026-11-05"
    const startDateParam = searchParams.get("startDate"); // optional explicit start
    const endDateParam = searchParams.get("endDate"); // optional explicit end
    const rangeDays = parseInt(searchParams.get("days") || "14", 10);
    const mode = searchParams.get("mode") || "schedule"; // "schedule" or "activity"
    const projectId = searchParams.get("projectId") || undefined;
    const assigneeId = searchParams.get("assigneeId") || undefined;
    const type = (searchParams.get("type") as TaskType) || undefined;

    let startDate: Date;
    let endDate: Date;
    let centerDate: Date;

    if (startDateParam && endDateParam) {
      const partsStart = startDateParam.split("-").map(Number);
      const partsEnd = endDateParam.split("-").map(Number);
      startDate = startOfDay(new Date(partsStart[0], partsStart[1] - 1, partsStart[2]));
      endDate = endOfDay(new Date(partsEnd[0], partsEnd[1] - 1, partsEnd[2]));
      centerDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    } else {
      if (centerDateStr) {
        const parts = centerDateStr.split("-").map(Number);
        centerDate = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        centerDate = new Date();
      }
      startDate = startOfDay(subDays(centerDate, Math.floor(rangeDays / 2)));
      endDate = endOfDay(addDays(centerDate, Math.ceil(rangeDays / 2)));
    }

    // Load working calendar from DB
    const workingDays = await prisma.workingCalendar.findMany();
    const workingDaysMap = new Map<number, boolean>();
    workingDays.forEach((w) => workingDaysMap.set(w.dayOfWeek, w.isWorking));

    // Combine algorithmic Georgian holidays and DB custom holidays
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const holidaysMap = new Map<string, string>();

    // 1. Official algorithmic Georgian public holidays (fixed + Orthodox Easter)
    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = getGeorgianHolidaysForYear(y);
      for (const h of yearHolidays) {
        holidaysMap.set(h.dateStr, h.name);
      }
    }

    // 2. Custom holidays stored in database
    const dbHolidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
    for (const h of dbHolidays) {
      holidaysMap.set(formatDateKey(new Date(h.date)), h.name);
    }

    interface TimelineDateEntry {
      date: string;
      dateObj: Date;
      dayOfWeek: number;
      isWeekend: boolean;
      isWorking: boolean;
      holidayName: string | null;
      isToday: boolean;
      tasks: Record<string, unknown>[];
      activities: Record<string, unknown>[];
    }

    // Generate date sequence
    const dates: TimelineDateEntry[] = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const { isWorking, isWeekend, holidayName } = isDateWorkingDay(
        cur,
        workingDaysMap,
        holidaysMap
      );

      dates.push({
        date: format(cur, "yyyy-MM-dd"),
        dateObj: new Date(cur),
        dayOfWeek: cur.getDay(),
        isWeekend,
        isWorking,
        holidayName,
        isToday: isTbilisiToday(cur),
        tasks: [],
        activities: [],
      });
      cur = addDays(cur, 1);
    }

    // Filter tasks
    const taskWhere: Prisma.TaskWhereInput = {};
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
            {
              startDate: null,
              deadline: null,
              createdAt: { gte: startDate, lte: endDate },
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
          stages: {
            orderBy: { position: "asc" },
            include: {
              assignments: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
          subtasks: {
            select: { id: true, status: true },
          },
        },
      });

      // Project each task onto its relevant timeline dates
      for (const t of tasks) {
        const rawStart = t.startDate || t.deadline || t.createdAt;
        const rawEnd = t.deadline || t.startDate || t.createdAt;
        const taskStart = startOfDay(new Date(rawStart));
        const taskEnd = endOfDay(new Date(rawEnd));

        // Find active stage
        const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);
        const stageResponsible = activeStage?.assignments.map((a) => a.user) || [];
        const responsibleUsers =
          stageResponsible.length > 0
            ? stageResponsible
            : t.assignments.map((a) => a.user);

        for (const d of dates) {
          const dayDate = d.dateObj;
          if (dayDate >= taskStart && dayDate <= taskEnd) {
            const isOverdue = Boolean(
              t.deadline && new Date() > new Date(t.deadline) && t.status !== "DONE"
            );

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
              deadlineLocked: t.deadlineLocked,
              isOverdue,
              project: t.project
                ? {
                    id: t.project.id,
                    name: t.project.name,
                    color: t.project.color,
                  }
                : null,
              assignees: t.assignments.map((a) => a.user),
              responsibleUsers,
              activeStage: activeStage
                ? {
                    id: activeStage.id,
                    title: activeStage.title,
                    position: activeStage.position,
                    assignees: stageResponsible,
                  }
                : null,
              totalSubtasks: t.subtasks.length,
              doneSubtasks: t.subtasks.filter((s) => s.status === "DONE").length,
              isSpanStart: isSameDay(dayDate, taskStart),
              isSpanEnd: isSameDay(dayDate, taskEnd),
              isMultiDay: !isSameDay(taskStart, taskEnd),
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
          ...(projectId ? { task: { projectId } } : {}),
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
          targetDate.activities.push({
            id: a.id,
            action: a.action,
            entityType: a.entityType,
            entityId: a.entityId,
            createdAt: a.createdAt,
            actor: a.actor,
            task: a.task,
            oldValues: a.oldValues,
            newValues: a.newValues,
            reason: a.reason,
          });
        }
      }
    }

    return NextResponse.json({
      dates: dates.map((d) => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isWeekend: d.isWeekend,
        isWorking: d.isWorking,
        holidayName: d.holidayName,
        isToday: d.isToday,
        tasks: d.tasks,
        activities: d.activities,
      })),
      range: {
        start: format(startDate, "yyyy-MM-dd"),
        end: format(endDate, "yyyy-MM-dd"),
        center: format(centerDate, "yyyy-MM-dd"),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/timeline error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
