import { getGeorgianHolidaysForYear, isDateWorkingDay } from "./calendar";

export interface ConflictItem {
  type:
    | "USER_OVERLOAD"
    | "STAGE_EXCEEDS_TASK_DEADLINE"
    | "HOLIDAY_DEADLINE"
    | "TASK_OVERDUE"
    | "PAUSED_WHILE_SCHEDULED"
    | "HIGH_PRIORITY_OVERLAP"
    | "START_AFTER_DEADLINE";
  severity: "warning" | "critical";
  message: string;
  taskId?: string;
  taskTitle?: string;
  stageId?: string;
  stageTitle?: string;
  userId?: string;
  userName?: string;
  dateStr?: string;
}

export interface BasicTaskForConflict {
  id: string;
  taskNumber: number;
  title: string;
  status: string;
  priority: string;
  startDate?: Date | string | null;
  deadline?: Date | string | null;
  stages?: {
    id: string;
    title: string;
    position: number;
    isActive: boolean;
    isCompleted: boolean;
    deadline?: Date | string | null;
    assignments?: { user: { id: string; name: string } }[];
  }[];
  assignments?: { user: { id: string; name: string } }[];
}

/**
 * Detect scheduling conflicts for a single task or across a set of tasks.
 */
export function detectTaskConflicts(
  task: BasicTaskForConflict,
  workingDaysMap?: Map<number, boolean>,
  holidaysMap?: Map<string, string>
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  const taskStart = task.startDate ? new Date(task.startDate) : null;
  const taskDeadline = task.deadline ? new Date(task.deadline) : null;

  // 1. Start date after deadline
  if (taskStart && taskDeadline && taskStart > taskDeadline) {
    conflicts.push({
      type: "START_AFTER_DEADLINE",
      severity: "critical",
      message: "დაწყების თარიღი სცდება დედლაინს.",
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  // 2. Overdue task
  const now = new Date();
  if (taskDeadline && taskDeadline < now && task.status !== "DONE" && task.status !== "CANCELLED") {
    conflicts.push({
      type: "TASK_OVERDUE",
      severity: "critical",
      message: "დავალების დედლაინი გადაცილებულია და არ არის დასრულებული.",
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  // 3. Task is paused while scheduled in current timeframe
  if (task.status === "PAUSED" && taskDeadline && taskDeadline >= now) {
    conflicts.push({
      type: "PAUSED_WHILE_SCHEDULED",
      severity: "warning",
      message: "დავალება შეჩერებულია, თუმცა რჩება მიმდინარე განრიგში.",
      taskId: task.id,
      taskTitle: task.title,
    });
  }

  // 4. Child stage deadline exceeds parent task deadline
  if (task.stages && taskDeadline) {
    for (const stage of task.stages) {
      if (stage.deadline) {
        const stageDeadline = new Date(stage.deadline);
        if (stageDeadline > taskDeadline) {
          conflicts.push({
            type: "STAGE_EXCEEDS_TASK_DEADLINE",
            severity: "critical",
            message: `ეტაპის („${stage.title}“) დედლაინი სცდება მთლიანი დავალების დედლაინს.`,
            taskId: task.id,
            taskTitle: task.title,
            stageId: stage.id,
            stageTitle: stage.title,
          });
        }
      }
    }
  }

  // 5. Task deadline falls on weekend or Georgian holiday
  if (taskDeadline) {
    const year = taskDeadline.getFullYear();
    const hMap = holidaysMap || new Map<string, string>();
    if (!holidaysMap) {
      const yearHolidays = getGeorgianHolidaysForYear(year);
      for (const h of yearHolidays) {
        hMap.set(h.dateStr, h.name);
      }
    }
    const wMap = workingDaysMap || new Map<number, boolean>();

    const { isWorking, holidayName } = isDateWorkingDay(taskDeadline, wMap, hMap);
    if (!isWorking) {
      const reason = holidayName ? `უქმე დღეს (${holidayName})` : "შაბათ-კვირას (დასვენების დღე)";
      conflicts.push({
        type: "HOLIDAY_DEADLINE",
        severity: "warning",
        message: `დედლაინი ემთხვევა ${reason}.`,
        taskId: task.id,
        taskTitle: task.title,
      });
    }
  }

  return conflicts;
}

/**
 * Detect team-wide overlapping workload conflicts.
 * Checks for users assigned to multiple active tasks on the same date.
 */
export function detectTeamWorkloadConflicts(
  tasks: BasicTaskForConflict[],
  startDate: Date,
  endDate: Date
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  // Group active assignments by user and date
  const activeTasks = tasks.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "PLANNED"
  );

  const userDayMap = new Map<
    string,
    Map<string, { taskId: string; taskTitle: string; priority: string }[]>
  >();
  const userNameMap = new Map<string, string>();

  for (const t of activeTasks) {
    const rawStart = t.startDate || t.deadline || new Date();
    const rawEnd = t.deadline || t.startDate || new Date();
    const start = new Date(rawStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rawEnd);
    end.setHours(23, 59, 59, 999);

    // Identify active participants for this task:
    // If active stage exists, only active stage assignees are actively working.
    // If no stages exist, use task assignees.
    const activeStage = t.stages?.find((s) => s.isActive && !s.isCompleted);
    let activeUsers: { id: string; name: string }[] = [];

    if (activeStage && activeStage.assignments && activeStage.assignments.length > 0) {
      activeUsers = activeStage.assignments.map((a) => a.user);
    } else if (t.assignments) {
      activeUsers = t.assignments.map((a) => a.user);
    }

    // Deduplicate active users on this task
    const uniqueUsers = Array.from(new Map(activeUsers.map((u) => [u.id, u])).values());

    for (const u of uniqueUsers) {
      userNameMap.set(u.id, u.name);
      if (!userDayMap.has(u.id)) {
        userDayMap.set(u.id, new Map());
      }
      const dayMap = userDayMap.get(u.id)!;

      const cur = new Date(Math.max(start.getTime(), startDate.getTime()));
      const loopEnd = new Date(Math.min(end.getTime(), endDate.getTime()));

      while (cur <= loopEnd) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}`;

        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey)!.push({
          taskId: t.id,
          taskTitle: t.title,
          priority: t.priority,
        });

        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  // Check for conflicts: users with 2+ active tasks on a single date
  for (const [userId, dayMap] of userDayMap.entries()) {
    for (const [dateStr, assignedList] of dayMap.entries()) {
      if (assignedList.length >= 2) {
        // Step 8 correction: Overlapping tasks produce a warning by default.
        // Critical severity is reserved only for genuinely critical conditions (e.g. 2+ CRITICAL priority tasks simultaneously).
        const criticalCount = assignedList.filter(
          (a) => a.priority === "CRITICAL"
        ).length;
        const isCriticalCondition = criticalCount >= 2;

        const uName = userNameMap.get(userId) || "თანამშრომელი";
        conflicts.push({
          type: "USER_OVERLOAD",
          severity: isCriticalCondition ? "critical" : "warning",
          message: `${uName}-ს ამ დღეს (${dateStr}) აქვს ${assignedList.length} პარალელური დავალება: ${assignedList
            .map((a) => a.taskTitle)
            .join(", ")}.`,
          userId,
          userName: uName,
          dateStr,
        });
      }
    }
  }

  return conflicts;
}
