import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  format,
  addDays,
  startOfDay,
  endOfDay,
  isSameDay,
} from "date-fns";
import {
  getGeorgianHolidaysForYear,
  isDateWorkingDay,
  formatDateKey,
} from "@/lib/calendar";
import { detectTeamWorkloadConflicts, detectTaskConflicts } from "@/lib/conflicts";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const daysParam = parseInt(searchParams.get("days") || "7", 10);
    const projectId = searchParams.get("projectId") || undefined;
    const filterUserId = searchParams.get("userId") || undefined;
    const departmentParam = searchParams.get("department") || undefined;

    let startDate: Date;
    let endDate: Date;

    if (startDateParam && endDateParam) {
      const pStart = startDateParam.split("-").map(Number);
      const pEnd = endDateParam.split("-").map(Number);
      startDate = startOfDay(new Date(pStart[0], pStart[1] - 1, pStart[2]));
      endDate = endOfDay(new Date(pEnd[0], pEnd[1] - 1, pEnd[2]));
    } else {
      // Default: current week / 7 days starting today
      const today = new Date();
      startDate = startOfDay(today);
      endDate = endOfDay(addDays(startDate, daysParam - 1));
    }

    // Load working calendar & holidays
    const workingDays = await prisma.workingCalendar.findMany();
    const workingDaysMap = new Map<number, boolean>();
    workingDays.forEach((w) => workingDaysMap.set(w.dayOfWeek, w.isWorking));

    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const holidaysMap = new Map<string, string>();

    for (let y = startYear; y <= endYear; y++) {
      const yearHolidays = getGeorgianHolidaysForYear(y);
      for (const h of yearHolidays) {
        holidaysMap.set(h.dateStr, h.name);
      }
    }

    const dbHolidays = await prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });
    for (const h of dbHolidays) {
      holidaysMap.set(formatDateKey(new Date(h.date)), h.name);
    }

    // Generate date sequence
    const dates: {
      date: string;
      dateObj: Date;
      dayOfWeek: number;
      isWeekend: boolean;
      isWorking: boolean;
      holidayName: string | null;
      isToday: boolean;
    }[] = [];

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
        isToday: isSameDay(cur, new Date()),
      });
      cur = addDays(cur, 1);
    }

    // Load active users
    const userWhere: { id?: string; isActive: boolean; department?: "DEVELOPMENT" | "CONTENT" } = filterUserId
      ? { id: filterUserId, isActive: true }
      : { isActive: true };

    if (departmentParam === "DEVELOPMENT" || departmentParam === "CONTENT") {
      userWhere.department = departmentParam;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        department: true,
      },
    });

    // Load all tasks with assignments, stages, and subtasks
    const taskWhere: { projectId?: string; department?: "DEVELOPMENT" | "CONTENT" } = projectId ? { projectId } : {};
    if (departmentParam === "DEVELOPMENT" || departmentParam === "CONTENT") {
      taskWhere.department = departmentParam;
    }
    const allTasks = await prisma.task.findMany({
      where: taskWhere,
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
          include: {
            assignments: {
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const upcomingThreshold = addDays(now, 7);

    // Compute workload for each user
    const workloads = users.map((u) => {
      // Find all distinct tasks associated with user u
      const userTasks = allTasks.filter((t) => {
        const isTaskAssignee = t.assignments.some((a) => a.userId === u.id);
        const isStageAssignee = t.stages.some((s) =>
          s.assignments.some((a) => a.userId === u.id)
        );
        const isSubtaskAssignee = t.subtasks.some((st) =>
          st.assignments.some((a) => a.userId === u.id)
        );
        return isTaskAssignee || isStageAssignee || isSubtaskAssignee;
      });

      // Distinct Task Categorization (prevent double-counting)
      const activeTasks: typeof allTasks = [];
      const waitingTasks: typeof allTasks = [];
      const pausedTasks: typeof allTasks = [];
      const blockedTasks: typeof allTasks = [];
      const overdueTasks: typeof allTasks = [];
      const plannedTasks: typeof allTasks = [];
      const completedTasks: typeof allTasks = [];
      const upcomingDeadlines: typeof allTasks = [];

      for (const t of userTasks) {
        const isOverdue =
          Boolean(t.deadline && new Date(t.deadline) < now && t.status !== "DONE" && t.status !== "CANCELLED");

        if (isOverdue) {
          overdueTasks.push(t);
        }

        if (
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= upcomingThreshold &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
        ) {
          upcomingDeadlines.push(t);
        }

        if (t.status === "DONE" || t.status === "CANCELLED") {
          completedTasks.push(t);
          continue;
        }

        if (t.status === "PAUSED") {
          pausedTasks.push(t);
          continue;
        }

        if (t.status === "BLOCKED") {
          blockedTasks.push(t);
          continue;
        }

        // For IN_PROGRESS or PLANNED tasks:
        // Distinguish active vs waiting workflow stages
        if (t.stages.length > 0) {
          const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);
          const isUserInActiveStage = activeStage?.assignments.some(
            (a) => a.userId === u.id
          );
          const isUserInWaitingStage = t.stages.some(
            (s) =>
              !s.isActive &&
              !s.isCompleted &&
              s.assignments.some((a) => a.userId === u.id)
          );

          if (isUserInActiveStage) {
            activeTasks.push(t);
          } else if (isUserInWaitingStage) {
            waitingTasks.push(t);
          } else {
            // User is directly assigned to task without specific active/waiting stage
            if (t.status === "IN_PROGRESS") {
              activeTasks.push(t);
            } else {
              plannedTasks.push(t);
            }
          }
        } else {
          // No stages
          if (t.status === "IN_PROGRESS") {
            activeTasks.push(t);
          } else {
            plannedTasks.push(t);
          }
        }
      }

      // Distinct Subtask Counts for User u
      const userSubtasks = allTasks.flatMap((t) =>
        t.subtasks.filter((st) => st.assignments.some((a) => a.userId === u.id))
      );
      const activeSubtasks = userSubtasks.filter(
        (st) => st.status !== "DONE" && st.status !== "CANCELLED"
      );
      const completedSubtasks = userSubtasks.filter((st) => st.status === "DONE");

      // Date Matrix Row for User u
      const dateGrid = dates.map((d) => {
        const dayDate = d.dateObj;

        // Find tasks active/scheduled on this day
        const dayAssignments: {
          id: string;
          taskNumber: number;
          title: string;
          type: string;
          priority: string;
          status: string;
          userState:
            | "ACTIVE"
            | "WAITING"
            | "PAUSED"
            | "BLOCKED"
            | "OVERDUE"
            | "PLANNED"
            | "DONE";
          deadline: string | null;
          isOverdue: boolean;
        }[] = [];

        for (const t of userTasks) {
          const rawStart = t.startDate || t.deadline || t.createdAt;
          const rawEnd = t.deadline || t.startDate || t.createdAt;
          const start = startOfDay(new Date(rawStart));
          const end = endOfDay(new Date(rawEnd));

          if (dayDate >= start && dayDate <= end) {
            const isOverdue = Boolean(
              t.deadline && new Date(t.deadline) < now && t.status !== "DONE" && t.status !== "CANCELLED"
            );

            let userState:
              | "ACTIVE"
              | "WAITING"
              | "PAUSED"
              | "BLOCKED"
              | "OVERDUE"
              | "PLANNED"
              | "DONE" = "ACTIVE";

            if (t.status === "DONE") {
              userState = "DONE";
            } else if (isOverdue) {
              userState = "OVERDUE";
            } else if (t.status === "PAUSED") {
              userState = "PAUSED";
            } else if (t.status === "BLOCKED") {
              userState = "BLOCKED";
            } else if (t.stages.length > 0) {
              const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);
              const inActive = activeStage?.assignments.some((a) => a.userId === u.id);
              const inWaiting = t.stages.some(
                (s) =>
                  !s.isActive &&
                  !s.isCompleted &&
                  s.assignments.some((a) => a.userId === u.id)
              );
              if (inActive) {
                userState = "ACTIVE";
              } else if (inWaiting) {
                userState = "WAITING";
              } else if (t.status === "PLANNED") {
                userState = "PLANNED";
              } else {
                userState = "ACTIVE";
              }
            } else if (t.status === "PLANNED") {
              userState = "PLANNED";
            }

            dayAssignments.push({
              id: t.id,
              taskNumber: t.taskNumber,
              title: t.title,
              type: t.type,
              priority: t.priority,
              status: t.status,
              userState,
              deadline: t.deadline ? format(new Date(t.deadline), "yyyy-MM-dd") : null,
              isOverdue,
            });
          }
        }

        // Factual Overlap Check: user has >= 2 active assignments on this date
        const activeCountOnDay = dayAssignments.filter(
          (a) => a.userState === "ACTIVE"
        ).length;
        const hasDayConflict = activeCountOnDay >= 2;
        const conflictMessage = hasDayConflict
          ? `${u.name}-ს ამ დღეს ${activeCountOnDay} პარალელური აქტიური დავალება აქვს.`
          : null;

        return {
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          isWeekend: d.isWeekend,
          isWorking: d.isWorking,
          holidayName: d.holidayName,
          isToday: d.isToday,
          assignments: dayAssignments,
          hasConflict: hasDayConflict,
          conflictMessage,
        };
      });

      // Overall user conflict flag
      const hasOverlapWarning = dateGrid.some((dg) => dg.hasConflict);

      return {
        user: u,
        stats: {
          activeCount: activeTasks.length,
          queuedCount: waitingTasks.length,
          pausedCount: pausedTasks.length,
          blockedCount: blockedTasks.length,
          overdueCount: overdueTasks.length,
          plannedCount: plannedTasks.length,
          completedCount: completedTasks.length,
          activeSubtasksCount: activeSubtasks.length,
          completedSubtasksCount: completedSubtasks.length,
          upcomingDeadlinesCount: upcomingDeadlines.length,
          hasOverlapWarning,
        },
        upcomingDeadlines: upcomingDeadlines.map((t) => ({
          id: t.id,
          taskNumber: t.taskNumber,
          title: t.title,
          deadline: t.deadline,
          priority: t.priority,
          type: t.type,
        })),
        dateGrid,
      };
    });

    // Detect team-wide conflicts
    const teamConflicts = detectTeamWorkloadConflicts(allTasks, startDate, endDate);
    const individualTaskConflicts = allTasks.flatMap((t) =>
      detectTaskConflicts(t, workingDaysMap, holidaysMap)
    );

    const allConflicts = [...teamConflicts, ...individualTaskConflicts];

    return NextResponse.json({
      dates: dates.map((d) => ({
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        isWeekend: d.isWeekend,
        isWorking: d.isWorking,
        holidayName: d.holidayName,
        isToday: d.isToday,
      })),
      range: {
        start: format(startDate, "yyyy-MM-dd"),
        end: format(endDate, "yyyy-MM-dd"),
        days: dates.length,
      },
      workloads,
      conflicts: allConflicts,
    });
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/workload error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
