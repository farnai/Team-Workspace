import { getGeorgianHolidaysForYear, isDateWorkingDay } from "./calendar";
import { formatGeorgianDate, formatGeorgianDateShort } from "./dateUtils";

export interface ConflictItem {
  type:
    | "USER_OVERLOAD"
    | "STAGE_EXCEEDS_TASK_DEADLINE"
    | "HOLIDAY_DEADLINE"
    | "TASK_OVERDUE"
    | "STAGE_OVERDUE"
    | "PAUSED_WHILE_SCHEDULED"
    | "HIGH_PRIORITY_OVERLAP"
    | "START_AFTER_DEADLINE";
  severity: "warning" | "critical";
  message: string;
  title: string;
  taskId?: string;
  taskTitle?: string;
  taskNumber?: number;
  stageId?: string;
  stageTitle?: string;
  userId?: string;
  userName?: string;
  responsibleName?: string;
  responsibleInfo?: string;
  dateStr?: string;
  deadlineStr?: string;
  daysOverdue?: number;
  taskStatus?: string;
  taskPriority?: string;
  reason?: string;
}

export interface BasicTaskForConflict {
  id: string;
  taskNumber: number;
  title: string;
  status: string;
  priority: string;
  progress?: number;
  startDate?: Date | string | null;
  deadline?: Date | string | null;
  pauseReason?: string | null;
  blockedReason?: string | null;
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
  project?: { id: string; name: string } | null;
}

/**
 * Determine the specific responsible assignee(s) for a task.
 * In sequential workflows, only the active incomplete stage's assignee is responsible.
 * In direct tasks, the task assignees are responsible.
 */
export function getResponsibleAssigneeInfo(task: BasicTaskForConflict): {
  responsibleName: string;
  responsibleInfo: string;
  activeStage?: {
    id: string;
    title: string;
    deadline?: Date | string | null;
    assignees: string[];
  };
} {
  // 1. If sequential stages exist: find active stage
  if (task.stages && task.stages.length > 0) {
    const activeStage = task.stages.find((s) => s.isActive && !s.isCompleted);
    if (activeStage) {
      const names =
        activeStage.assignments?.map((a) => a.user.name).filter(Boolean) || [];
      const responsibleName = names.length > 0 ? names.join(", ") : "დაუნიშნავი";
      return {
        responsibleName,
        responsibleInfo: `აქტიური ეტაპი: „${activeStage.title}“ (${responsibleName})`,
        activeStage: {
          id: activeStage.id,
          title: activeStage.title,
          deadline: activeStage.deadline,
          assignees: names,
        },
      };
    }
  }

  // 2. Direct task assignments
  if (task.assignments && task.assignments.length > 0) {
    const names = task.assignments.map((a) => a.user.name).filter(Boolean);
    if (names.length > 0) {
      return {
        responsibleName: names.join(", "),
        responsibleInfo: `შემსრულებელი: ${names.join(", ")}`,
      };
    }
  }

  return {
    responsibleName: "დაუნიშნავი",
    responsibleInfo: "შემსრულებელი არ არის დანიშნული",
  };
}

/**
 * Format human-readable state explanation for the task
 */
function getTaskStateDescription(task: BasicTaskForConflict): string {
  if (task.status === "PAUSED") {
    return `შეჩერებულია (${task.pauseReason ? `მიზეზი: ${task.pauseReason}` : "მიზეზი მითითებული არ არის"})`;
  }
  if (task.status === "BLOCKED") {
    return `დაბლოკილია (${task.blockedReason ? `დაბრკოლება: ${task.blockedReason}` : "დაბრკოლება მითითებული არ არის"})`;
  }
  if (task.status === "BACKLOG") {
    return "ბექლოგშია (მუშაობა ჯერ არ დაწყებულა)";
  }
  if (task.status === "PLANNED") {
    return "დაგეგმილია (PLANNED)";
  }
  if (task.status === "IN_PROGRESS") {
    return `მიმდინარეობს (${task.progress ?? 0}% შესრულებულია)`;
  }
  return task.status;
}

/**
 * Detect scheduling conflicts for a single task.
 */
export function detectTaskConflicts(
  task: BasicTaskForConflict,
  workingDaysMap?: Map<number, boolean>,
  holidaysMap?: Map<string, string>
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];

  const taskStart = task.startDate ? new Date(task.startDate) : null;
  const taskDeadline = task.deadline ? new Date(task.deadline) : null;
  const taskCode = `SSP-${task.taskNumber || "?"}`;
  const { responsibleName, responsibleInfo } = getResponsibleAssigneeInfo(task);

  // 1. Start date after deadline
  if (taskStart && taskDeadline && taskStart > taskDeadline) {
    conflicts.push({
      type: "START_AFTER_DEADLINE",
      severity: "critical",
      title: `[${taskCode}] ${task.title}`,
      message: `დაწყების თარიღი (${formatGeorgianDateShort(taskStart)}) სცდება დედლაინს (${formatGeorgianDateShort(taskDeadline)}). ${responsibleInfo}.`,
      taskId: task.id,
      taskTitle: task.title,
      taskNumber: task.taskNumber,
      responsibleName,
      responsibleInfo,
      taskStatus: task.status,
      taskPriority: task.priority,
    });
  }

  // 2. Overdue task (overall deadline)
  const now = new Date();
  if (
    taskDeadline &&
    taskDeadline < now &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED"
  ) {
    const daysOverdue = Math.max(
      1,
      Math.floor((now.getTime() - taskDeadline.getTime()) / (1000 * 60 * 60 * 24))
    );
    const deadlineFormatted = formatGeorgianDate(taskDeadline);
    const stateDesc = getTaskStateDescription(task);

    conflicts.push({
      type: "TASK_OVERDUE",
      severity: "critical",
      title: `[${taskCode}] ${task.title}`,
      message: `დედლაინი იყო ${deadlineFormatted} (${daysOverdue} დღის ვადაგადაცილება). ${responsibleInfo}. მდგომარეობა: ${stateDesc}.`,
      taskId: task.id,
      taskTitle: task.title,
      taskNumber: task.taskNumber,
      responsibleName,
      responsibleInfo,
      deadlineStr: deadlineFormatted,
      daysOverdue,
      taskStatus: task.status,
      taskPriority: task.priority,
      reason: stateDesc,
    });
  }

  // 3. Child stage overdue (in sequential workflows, only active stage is overdue!)
  if (
    task.stages &&
    task.stages.length > 0 &&
    task.status !== "DONE" &&
    task.status !== "CANCELLED"
  ) {
    const activeStage = task.stages.find((s) => s.isActive && !s.isCompleted);
    if (activeStage && activeStage.deadline) {
      const stageDeadline = new Date(activeStage.deadline);
      if (stageDeadline < now) {
        const stageDaysOverdue = Math.max(
          1,
          Math.floor((now.getTime() - stageDeadline.getTime()) / (1000 * 60 * 60 * 24))
        );
        const stageAssignees =
          activeStage.assignments?.map((a) => a.user.name).filter(Boolean) || [];
        const stageResponsible =
          stageAssignees.length > 0 ? stageAssignees.join(", ") : "დაუნიშნავი";

        // Only add if not duplicate of task-level overdue on same date
        const isDuplicateOfTaskOverdue =
          taskDeadline &&
          Math.abs(taskDeadline.getTime() - stageDeadline.getTime()) < 1000 * 60 * 60;

        if (!isDuplicateOfTaskOverdue) {
          conflicts.push({
            type: "STAGE_OVERDUE",
            severity: "critical",
            title: `[${taskCode}] ${task.title}`,
            message: `აქტიური ეტაპის („${activeStage.title}“) დედლაინი იყო ${formatGeorgianDate(stageDeadline)} (${stageDaysOverdue} დღის ვადაგადაცილება). პასუხისმგებელი: ${stageResponsible}. მომდევნო შემსრულებლები ელოდებიან ამ ეტაპის დასრულებას.`,
            taskId: task.id,
            taskTitle: task.title,
            taskNumber: task.taskNumber,
            stageId: activeStage.id,
            stageTitle: activeStage.title,
            responsibleName: stageResponsible,
            responsibleInfo: `აქტიური ეტაპი: „${activeStage.title}“ (${stageResponsible})`,
            daysOverdue: stageDaysOverdue,
            deadlineStr: formatGeorgianDate(stageDeadline),
            taskStatus: task.status,
            taskPriority: task.priority,
          });
        }
      }
    }
  }

  // 4. Task is paused while scheduled in current timeframe
  if (task.status === "PAUSED" && taskDeadline && taskDeadline >= now) {
    const pauseReasonText = task.pauseReason
      ? `მიზეზი: „${task.pauseReason}“`
      : "შეჩერების მიზეზი მითითებული არ არის";
    conflicts.push({
      type: "PAUSED_WHILE_SCHEDULED",
      severity: "warning",
      title: `[${taskCode}] ${task.title}`,
      message: `დავალება შეჩერებულია (${pauseReasonText}), თუმცა რჩება მიმდინარე განრიგში (დედლაინი: ${formatGeorgianDateShort(taskDeadline)}). ${responsibleInfo}.`,
      taskId: task.id,
      taskTitle: task.title,
      taskNumber: task.taskNumber,
      responsibleName,
      responsibleInfo,
      deadlineStr: formatGeorgianDate(taskDeadline),
      taskStatus: task.status,
      taskPriority: task.priority,
      reason: pauseReasonText,
    });
  }

  // 5. Child stage deadline exceeds parent task deadline
  if (task.stages && taskDeadline) {
    for (const stage of task.stages) {
      if (stage.deadline) {
        const stageDeadline = new Date(stage.deadline);
        if (stageDeadline > taskDeadline) {
          const names =
            stage.assignments?.map((a) => a.user.name).filter(Boolean) || [];
          const rName = names.length > 0 ? names.join(", ") : "დაუნიშნავი";
          conflicts.push({
            type: "STAGE_EXCEEDS_TASK_DEADLINE",
            severity: "critical",
            title: `[${taskCode}] ${task.title}`,
            message: `ეტაპის („${stage.title}“) დედლაინი (${formatGeorgianDateShort(stageDeadline)}) სცდება მთლიანი დავალების დედლაინს (${formatGeorgianDateShort(taskDeadline)}). პასუხისმგებელი: ${rName}.`,
            taskId: task.id,
            taskTitle: task.title,
            taskNumber: task.taskNumber,
            stageId: stage.id,
            stageTitle: stage.title,
            responsibleName: rName,
            taskStatus: task.status,
            taskPriority: task.priority,
          });
        }
      }
    }
  }

  // 6. Task deadline falls on weekend or Georgian holiday
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
      const reason = holidayName
        ? `უქმე დღეს („${holidayName}“)`
        : "შაბათ-კვირას (დასვენების დღე)";
      conflicts.push({
        type: "HOLIDAY_DEADLINE",
        severity: "warning",
        title: `[${taskCode}] ${task.title}`,
        message: `დავალების დედლაინი (${formatGeorgianDate(taskDeadline)}) ემთხვევა ${reason}. ${responsibleInfo}.`,
        taskId: task.id,
        taskTitle: task.title,
        taskNumber: task.taskNumber,
        responsibleName,
        responsibleInfo,
        deadlineStr: formatGeorgianDate(taskDeadline),
        taskStatus: task.status,
        taskPriority: task.priority,
        reason,
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
    Map<
      string,
      { taskId: string; taskTitle: string; taskNumber: number; priority: string }[]
    >
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
    const uniqueUsers = Array.from(
      new Map(activeUsers.map((u) => [u.id, u])).values()
    );

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
          taskNumber: t.taskNumber,
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
        const criticalCount = assignedList.filter(
          (a) => a.priority === "CRITICAL"
        ).length;
        const isCriticalCondition = criticalCount >= 2;

        const uName = userNameMap.get(userId) || "თანამშრომელი";
        const parts = dateStr.split("-").map(Number);
        const dateFormatted = formatGeorgianDate(new Date(parts[0], parts[1] - 1, parts[2]));

        conflicts.push({
          type: "USER_OVERLOAD",
          severity: isCriticalCondition ? "critical" : "warning",
          title: `${uName} (პარალელური დატვირთვა)`,
          message: `${uName}-ს ამ დღეს (${dateFormatted}) ერთდროულად აქვს ${assignedList.length} აქტიური დავალება: ${assignedList
            .map((a) => `[SSP-${a.taskNumber}] ${a.taskTitle}`)
            .join(", ")}.`,
          userId,
          userName: uName,
          responsibleName: uName,
          dateStr: dateFormatted,
          reason: `${assignedList.length} პარალელური დავალება ერთსა და იმავე დღეს`,
        });
      }
    }
  }

  return conflicts;
}
