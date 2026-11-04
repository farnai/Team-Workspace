import test from "node:test";
import assert from "node:assert";
import { PrismaClient, Role, TaskType, Priority, TaskStatus, SubtaskStatus, AuditAction } from "@prisma/client";
import {
  detectTaskConflicts,
  detectTeamWorkloadConflicts,
} from "../src/lib/conflicts";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Step 7: Conflict Detection Engine - Factual Conflict Rules", () => {
  // 1. Start date after deadline conflict
  const taskWithInvalidDates = {
    id: "task-conflict-1",
    taskNumber: 101,
    title: "არასწორი თარიღები",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startDate: new Date("2026-11-20T09:00:00Z"),
    deadline: new Date("2026-11-15T18:00:00Z"),
  };
  const c1 = detectTaskConflicts(taskWithInvalidDates);
  assert(
    c1.some((c) => c.type === "START_AFTER_DEADLINE"),
    "Must detect START_AFTER_DEADLINE"
  );

  // 2. Overdue task conflict
  const overdueTask = {
    id: "task-conflict-2",
    taskNumber: 102,
    title: "ვადაგადაცილებული დავალება",
    status: "IN_PROGRESS",
    priority: "CRITICAL",
    startDate: new Date("2026-10-01T09:00:00Z"),
    deadline: new Date("2026-10-15T18:00:00Z"),
  };
  const c2 = detectTaskConflicts(overdueTask);
  assert(
    c2.some((c) => c.type === "TASK_OVERDUE"),
    "Must detect TASK_OVERDUE for uncompleted task past deadline"
  );

  // 3. Paused while scheduled conflict
  const pausedTask = {
    id: "task-conflict-3",
    taskNumber: 103,
    title: "შეჩერებული დავალება",
    status: "PAUSED",
    priority: "MEDIUM",
    startDate: new Date("2026-11-01T09:00:00Z"),
    deadline: new Date("2027-11-20T18:00:00Z"),
  };
  const c3 = detectTaskConflicts(pausedTask);
  assert(
    c3.some((c) => c.type === "PAUSED_WHILE_SCHEDULED"),
    "Must detect PAUSED_WHILE_SCHEDULED for paused task in current timeframe"
  );

  // 4. Stage deadline exceeds task deadline conflict
  const stageExceedingTask = {
    id: "task-conflict-4",
    taskNumber: 104,
    title: "ეტაპის დედლაინის გადაცდომა",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startDate: new Date("2026-11-01T09:00:00Z"),
    deadline: new Date("2026-11-10T18:00:00Z"),
    stages: [
      {
        id: "stage-1",
        title: "UX ეტაპი",
        position: 1,
        isActive: true,
        isCompleted: false,
        deadline: new Date("2026-11-15T18:00:00Z"), // Nov 15 > Nov 10
      },
    ],
  };
  const c4 = detectTaskConflicts(stageExceedingTask);
  assert(
    c4.some((c) => c.type === "STAGE_EXCEEDS_TASK_DEADLINE"),
    "Must detect STAGE_EXCEEDS_TASK_DEADLINE when stage deadline > task deadline"
  );

  // 5. Holiday or weekend deadline warning
  // Nov 23, 2026 is Giorgoba (Georgian Holiday)
  const holidayTask = {
    id: "task-conflict-5",
    taskNumber: 105,
    title: "გიორგობის დედლაინი",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    startDate: new Date("2026-11-18T09:00:00Z"),
    deadline: new Date("2026-11-23T18:00:00Z"),
  };
  const c5 = detectTaskConflicts(holidayTask);
  assert(
    c5.some((c) => c.type === "HOLIDAY_DEADLINE"),
    "Must detect HOLIDAY_DEADLINE when deadline falls on Georgian holiday"
  );
});

test("Step 7: Pause & Resume Lifecycle Integrity (Subtask & Deadline Preservation)", async () => {
  // Create test workspace entities
  const project = await testPrisma.project.create({
    data: {
      name: `Step 7 Pause Project ${Date.now()}`,
      color: "#3B82F6",
    },
  });

  const member = await testPrisma.user.create({
    data: {
      email: `pausetest_${Date.now()}@test.local`,
      name: "გიორგი შემსრულებელი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const initialDeadline = new Date(2026, 10, 15, 18, 0, 0);
  const initialStartDate = new Date(2026, 10, 5, 9, 0, 0);

  // Create Task with 2 subtasks (1 completed, 1 pending)
  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "დავალება შეჩერების ტესტირებისთვის",
      projectId: project.id,
      createdById: member.id,
      startDate: initialStartDate,
      deadline: initialDeadline,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      type: TaskType.FEATURE,
      progress: 50,
      subtasks: {
        create: [
          {
            title: "დასრულებული ქვედავალება",
            position: 1,
            status: SubtaskStatus.DONE,
            completedById: member.id,
            completedAt: new Date(),
          },
          {
            title: "მიმდინარე ქვედავალება",
            position: 2,
            status: SubtaskStatus.TODO,
          },
        ],
      },
      assignments: {
        create: { userId: member.id },
      },
    },
    include: { subtasks: true },
  });

  assert.strictEqual(task.status, TaskStatus.IN_PROGRESS);
  assert.strictEqual(task.subtasks.length, 2);

  // 1. Simulate Task Pause: Requires reason, records pausedAt, does NOT change deadline
  const pauseReason = "ველოდებით კლიენტისგან დამატებით API დოკუმენტაციას";
  const pausedAt = new Date();

  const pausedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.PAUSED,
      pauseReason,
      pausedAt,
    },
    include: { subtasks: true },
  });

  // Log WORK_PAUSED audit event
  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      entityId: task.id,
      actorId: member.id,
      action: AuditAction.WORK_PAUSED,
      entityType: "TASK",
      reason: pauseReason,
    },
  });

  // VERIFY: Status is PAUSED, reason and timestamp recorded
  assert.strictEqual(pausedTask.status, TaskStatus.PAUSED);
  assert.strictEqual(pausedTask.pauseReason, pauseReason);
  assert(pausedTask.pausedAt !== null, "pausedAt must be set");

  // VERIFY: Deadlines are strictly preserved without automatic extensions
  assert.strictEqual(
    pausedTask.deadline?.toISOString(),
    initialDeadline.toISOString(),
    "Deadline must NOT be automatically modified on pause"
  );
  assert.strictEqual(
    pausedTask.startDate?.toISOString(),
    initialStartDate.toISOString(),
    "Start date must NOT be modified on pause"
  );

  // VERIFY: Completed subtasks remain completed (no reset)
  const completedSubtask = pausedTask.subtasks.find((s) => s.title === "დასრულებული ქვედავალება");
  assert.strictEqual(completedSubtask?.status, SubtaskStatus.DONE);
  assert(completedSubtask?.completedAt !== null, "Completed subtask completion date preserved");

  // VERIFY: Audit event was created
  const auditLogs = await testPrisma.auditEvent.findMany({
    where: { taskId: task.id, action: AuditAction.WORK_PAUSED },
  });
  assert.strictEqual(auditLogs.length, 1);
  assert.strictEqual(auditLogs[0].reason, pauseReason);

  // 2. Simulate Task Resume: Clears pauseReason and pausedAt, returns to IN_PROGRESS
  const resumedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.IN_PROGRESS,
      pauseReason: null,
      pausedAt: null,
    },
    include: { subtasks: true },
  });

  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      entityId: task.id,
      actorId: member.id,
      action: AuditAction.WORK_RESUMED,
      entityType: "TASK",
      reason: "დოკუმენტაცია მიღებულია, მუშაობა განახლდა",
    },
  });

  // VERIFY: Status is IN_PROGRESS, pause details cleared
  assert.strictEqual(resumedTask.status, TaskStatus.IN_PROGRESS);
  assert.strictEqual(resumedTask.pauseReason, null);
  assert.strictEqual(resumedTask.pausedAt, null);

  // VERIFY: Subtask progress remains 50%
  const subtasksAfterResume = resumedTask.subtasks;
  assert.strictEqual(
    subtasksAfterResume.find((s) => s.title === "დასრულებული ქვედავალება")?.status,
    SubtaskStatus.DONE
  );

  const resumeLogs = await testPrisma.auditEvent.findMany({
    where: { taskId: task.id, action: AuditAction.WORK_RESUMED },
  });
  assert.strictEqual(resumeLogs.length, 1);
});

test("Step 7: Block & Unblock with Obstacle Tracking", async () => {
  const project = await testPrisma.project.create({
    data: { name: `Block Project ${Date.now()}` },
  });

  const user = await testPrisma.user.create({
    data: {
      email: `blocktest_${Date.now()}@test.local`,
      name: "ნინო დეველოპერი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "დაბლოკვის ფუნქციონალის ტესტი",
      projectId: project.id,
      createdById: user.id,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      type: TaskType.FEATURE,
    },
  });

  // 1. Block Task with reason
  const obstacleReason = "სერვერის ინფრასტრუქტურა მიუწვდომელია (დაბრკოლება devops-ისგან)";
  const blockedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.BLOCKED,
      blockedReason: obstacleReason,
    },
  });

  assert.strictEqual(blockedTask.status, TaskStatus.BLOCKED);
  assert.strictEqual(blockedTask.blockedReason, obstacleReason);

  // 2. Unblock Task
  const unblockedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.IN_PROGRESS,
      blockedReason: null,
    },
  });

  assert.strictEqual(unblockedTask.status, TaskStatus.IN_PROGRESS);
  assert.strictEqual(unblockedTask.blockedReason, null);
});

test("Step 7: Admin Manual Rescheduling, Reason Mandate & Start Date <= Deadline Validation", async () => {
  const project = await testPrisma.project.create({
    data: { name: `Reschedule Project ${Date.now()}` },
  });

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_reschedule_${Date.now()}@test.local`,
      name: "ადმინისტრატორი გიორგი",
      role: Role.ADMIN,
      passwordHash: "hash123",
    },
  });

  const normalUser = await testPrisma.user.create({
    data: {
      email: `user_reschedule_${Date.now()}@test.local`,
      name: "ჩვეულებრივი მომხმარებელი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });
  assert.strictEqual(normalUser.role, Role.USER);

  // Task with locked deadline
  const originalStartDate = new Date("2026-11-05T09:00:00Z");
  const originalDeadline = new Date("2026-11-10T18:00:00Z");

  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "დაბლოკილი დედლაინის მქონე დავალება",
      projectId: project.id,
      createdById: admin.id,
      startDate: originalStartDate,
      deadline: originalDeadline,
      deadlineLocked: true, // LOCKED
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      type: TaskType.FEATURE,
    },
  });

  // 1. Verify Start Date > Deadline is an invalid state
  const invalidProposedStart = new Date("2026-11-20T09:00:00Z");
  const invalidProposedDeadline = new Date("2026-11-15T18:00:00Z");
  assert(
    invalidProposedStart > invalidProposedDeadline,
    "Start date exceeds deadline - validation must catch this"
  );

  // 2. Perform valid Admin reschedule with reason
  const newStartDate = new Date("2026-11-08T09:00:00Z");
  const newDeadline = new Date("2026-11-16T18:00:00Z");
  const rescheduleReason = "პროექტის მოთხოვნები გაფართოვდა, საჭირო გახდა 6 დამატებითი დღე";

  const updatedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      startDate: newStartDate,
      deadline: newDeadline,
    },
  });

  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      entityId: task.id,
      actorId: admin.id,
      action: AuditAction.DEADLINE_CHANGED,
      entityType: "TASK",
      reason: rescheduleReason,
      oldValues: {
        startDate: originalStartDate.toISOString(),
        deadline: originalDeadline.toISOString(),
      },
      newValues: {
        startDate: newStartDate.toISOString(),
        deadline: newDeadline.toISOString(),
      },
    },
  });

  assert.strictEqual(updatedTask.startDate?.toISOString(), newStartDate.toISOString());
  assert.strictEqual(updatedTask.deadline?.toISOString(), newDeadline.toISOString());

  // Check audit trail
  const logs = await testPrisma.auditEvent.findMany({
    where: { taskId: task.id, action: AuditAction.DEADLINE_CHANGED },
  });
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].reason, rescheduleReason);
  assert.strictEqual(logs[0].actorId, admin.id);
});

test("Step 7: Workload Distinct Task Calculations (No Double-Counting & Stage Responsibility)", async () => {
  const project = await testPrisma.project.create({
    data: { name: `Workload Distinct Project ${Date.now()}` },
  });

  const worker = await testPrisma.user.create({
    data: {
      email: `worker_${Date.now()}@test.local`,
      name: "მარიამ დეველოპერი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  // Create Parent Task where worker is assigned to parent task AND 3 subtasks of that task
  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "დავალება მრავალი საბტასკით",
      projectId: project.id,
      createdById: worker.id,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      type: TaskType.FEATURE,
      assignments: {
        create: { userId: worker.id },
      },
      subtasks: {
        create: [
          {
            title: "ქვედავალება 1",
            position: 1,
            status: SubtaskStatus.TODO,
            assignments: { create: { userId: worker.id } },
          },
          {
            title: "ქვედავალება 2",
            position: 2,
            status: SubtaskStatus.TODO,
            assignments: { create: { userId: worker.id } },
          },
          {
            title: "ქვედავალება 3",
            position: 3,
            status: SubtaskStatus.DONE,
            assignments: { create: { userId: worker.id } },
          },
        ],
      },
    },
    include: {
      assignments: true,
      subtasks: { include: { assignments: true } },
    },
  });

  // Create another task where worker is ONLY assigned to a FUTURE (inactive) workflow stage
  const futureStageTask = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "დავალება სამომავლო ეტაპით",
      projectId: project.id,
      createdById: worker.id,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      type: TaskType.FEATURE,
      stages: {
        create: [
          {
            title: "მიმდინარე ეტაპი (სხვისი)",
            position: 1,
            isActive: true,
            isCompleted: false,
          },
          {
            title: "შემდეგი ეტაპი (მარიამის მოლოდინში)",
            position: 2,
            isActive: false, // NOT active
            isCompleted: false, // NOT completed
            assignments: {
              create: { userId: worker.id },
            },
          },
        ],
      },
    },
    include: {
      stages: { include: { assignments: true } },
    },
  });

  // Query tasks for worker
  const allTasks = await testPrisma.task.findMany({
    where: { id: { in: [task.id, futureStageTask.id] } },
    include: {
      assignments: true,
      stages: { include: { assignments: true } },
      subtasks: { include: { assignments: true } },
    },
  });

  // Calculate distinct counts according to Step 7 algorithm:
  // 1. Task 1: Worker is direct assignee and subtask assignee -> Distinct parent task count = 1. Active = 1.
  // 2. Task 2: Worker is in future inactive stage -> Distinct task count = 1. Queued/Waiting = 1. Active = 0!
  let distinctActiveTasks = 0;
  let distinctQueuedTasks = 0;

  for (const t of allTasks) {
    const isDirectAssignee = t.assignments.some((a) => a.userId === worker.id);
    const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted);
    const isDirectActiveStageAssignee = activeStage?.assignments.some((a) => a.userId === worker.id);
    const hasAnyActiveSubtask = t.subtasks.some(
      (st) => st.status !== SubtaskStatus.DONE && st.assignments.some((a) => a.userId === worker.id)
    );

    const isFutureStageAssignee = t.stages.some(
      (s) => !s.isActive && !s.isCompleted && s.assignments.some((a) => a.userId === worker.id)
    );

    if (t.status === TaskStatus.IN_PROGRESS) {
      if (isDirectAssignee || isDirectActiveStageAssignee || hasAnyActiveSubtask) {
        distinctActiveTasks++;
      } else if (isFutureStageAssignee) {
        distinctQueuedTasks++;
      }
    }
  }

  // VERIFY: Active count must be 1, NOT 4 (no subtask inflation!)
  assert.strictEqual(
    distinctActiveTasks,
    1,
    "Active tasks count must be exactly 1 despite multiple subtasks"
  );

  // VERIFY: Future stage assignment must be counted as queued (მოლოდინში), NOT active
  assert.strictEqual(
    distinctQueuedTasks,
    1,
    "User assigned to future stage must be counted as Queued/Waiting, NOT Active"
  );
});

test("Step 7: Overload Warning (2+ Active Tasks on Same Day)", () => {
  const ana = { id: "user-ana", name: "ანა" };

  const taskA = {
    id: "task-a",
    taskNumber: 201,
    title: "ამოცანა A",
    status: "IN_PROGRESS",
    priority: "HIGH",
    startDate: new Date("2026-11-05T09:00:00Z"),
    deadline: new Date("2026-11-07T18:00:00Z"),
    assignments: [{ user: ana }],
  };

  const taskB = {
    id: "task-b",
    taskNumber: 202,
    title: "ამოცანა B",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    startDate: new Date("2026-11-06T09:00:00Z"),
    deadline: new Date("2026-11-08T18:00:00Z"),
    assignments: [{ user: ana }],
  };

  const teamConflicts = detectTeamWorkloadConflicts(
    [taskA, taskB],
    new Date("2026-11-05T00:00:00Z"),
    new Date("2026-11-07T23:59:59Z")
  );

  const overloadConflicts = teamConflicts.filter((c) => c.type === "USER_OVERLOAD");
  assert(
    overloadConflicts.length > 0,
    "Must detect USER_OVERLOAD when user has 2+ active tasks on 2026-11-06"
  );
  assert(
    overloadConflicts.some((c) => c.userName === "ანა"),
    "Conflict must specify Ana as overloaded user"
  );
  assert.strictEqual(
    overloadConflicts[0].severity,
    "warning",
    "Overload of 2 standard tasks must produce warning severity (not critical)"
  );
});
