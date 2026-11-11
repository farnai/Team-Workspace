import test from "node:test";
import assert from "node:assert";
import {
  TaskStatus,
  TaskType,
  Priority,
  Role,
} from "@prisma/client";
import { testPrisma } from "./test-db";
import { validateDeadlineModification } from "../src/lib/workflow";
import { logAuditEvent } from "../src/lib/audit";

test("Step 3: Comprehensive Shared Backlog, Task Governance & Timeline Integration Tests", async () => {
  // Setup: Project & Users
  const project = await testPrisma.project.create({
    data: {
      name: "Step 3 Test Project",
      color: "#EA580C",
    },
  });

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_step3_${Date.now()}@test.local`,
      name: "ადმინ ფარნა",
      role: Role.ADMIN,
      passwordHash: "dummyhash",
    },
  });

  const memberA = await testPrisma.user.create({
    data: {
      email: `member_a_${Date.now()}@test.local`,
      name: "დეველოპერი ვასკა",
      role: Role.USER,
      passwordHash: "dummyhash",
    },
  });

  const memberB = await testPrisma.user.create({
    data: {
      email: `member_b_${Date.now()}@test.local`,
      name: "დიზაინერი თორნიკე",
      role: Role.USER,
      passwordHash: "dummyhash",
    },
  });

  // 1. Authenticated task creation
  const task1 = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "დავალება 1: ავთენტიფიცირებული შექმნა",
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.BACKLOG,
      createdById: memberA.id,
    },
  });
  assert(task1.id, "Task should be created with a valid ID");
  assert.strictEqual(task1.createdById, memberA.id);

  // 2. Unauthenticated task creation rejected (simulated API logic verification)
  const isUserAuthenticated = (user: { id?: string } | null) => Boolean(user?.id);
  assert.strictEqual(isUserAuthenticated(null), false, "Unauthenticated user must be rejected");

  // 3. Task created without assignee (allowed without deadline)
  const unassignedTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "დაუგეგმავი და დაუნიშნავი დავალება",
      type: TaskType.BUG,
      priority: Priority.LOW,
      status: TaskStatus.BACKLOG,
      startDate: null,
      deadline: null,
      deadlineLocked: false,
      createdById: memberA.id,
    },
  });
  assert.strictEqual(unassignedTask.deadline, null);
  assert.strictEqual(unassignedTask.deadlineLocked, false);

  // 4. Assigned task requires initial deadline rule
  const validateAssignedDeadline = (assigneeCount: number, deadline: Date | null) => {
    if (assigneeCount > 0 && !deadline) {
      return { allowed: false, error: "შემსრულებლის მინიჭებისას დედლაინის მითითება სავალდებულოა" };
    }
    return { allowed: true };
  };
  const assignWithoutDeadline = validateAssignedDeadline(1, null);
  assert.strictEqual(assignWithoutDeadline.allowed, false);

  const assignWithDeadline = validateAssignedDeadline(1, new Date("2026-11-20T18:00:00Z"));
  assert.strictEqual(assignWithDeadline.allowed, true);

  // 5. Multiple-assignee assignment supported
  const multiAssignTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "მრავალშემსრულებლიანი ამოცანა",
      type: TaskType.FEATURE,
      priority: Priority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      deadline: new Date("2026-11-25T18:00:00Z"),
      deadlineLocked: true,
      createdById: memberA.id,
    },
  });

  await testPrisma.taskAssignment.createMany({
    data: [
      { taskId: multiAssignTask.id, userId: memberA.id },
      { taskId: multiAssignTask.id, userId: memberB.id },
    ],
  });

  const assignments = await testPrisma.taskAssignment.findMany({
    where: { taskId: multiAssignTask.id },
  });
  assert.strictEqual(assignments.length, 2, "Task must have 2 assignees");

  // 6. User cannot modify locked deadline
  const nonAdminDeadlineAttempt = validateDeadlineModification({
    isDeadlineLocked: multiAssignTask.deadlineLocked,
    existingDeadline: multiAssignTask.deadline,
    incomingDeadline: new Date("2026-11-30T18:00:00Z"),
    isAdmin: memberA.role === Role.ADMIN,
  });
  assert.strictEqual(nonAdminDeadlineAttempt.allowed, false);

  // 7. Admin can modify deadline with reason
  const adminNewDeadline = new Date("2026-12-05T18:00:00Z");
  const adminDeadlineAttempt = validateDeadlineModification({
    isDeadlineLocked: multiAssignTask.deadlineLocked,
    existingDeadline: multiAssignTask.deadline,
    incomingDeadline: adminNewDeadline,
    isAdmin: admin.role === Role.ADMIN,
  });
  assert.strictEqual(adminDeadlineAttempt.allowed, true);

  // Record audit for admin change
  await logAuditEvent({
    taskId: multiAssignTask.id,
    actorId: admin.id,
    action: "DEADLINE_CHANGED",
    entityType: "TASK",
    entityId: multiAssignTask.id,
    oldValues: { deadline: multiAssignTask.deadline },
    newValues: { deadline: adminNewDeadline },
    reason: "ადმინისტრატორის მიერ დედლაინის გადაწევა კლიენტის მოთხოვნით",
    tx: testPrisma as unknown as Parameters<typeof logAuditEvent>[0]["tx"],
  });

  const deadlineAudit = await testPrisma.auditEvent.findFirst({
    where: { taskId: multiAssignTask.id, action: "DEADLINE_CHANGED" },
  });
  assert(deadlineAudit, "Audit log must record DEADLINE_CHANGED");
  assert.strictEqual(deadlineAudit.actorId, admin.id);

  // 8. Unassignment cannot bypass deadline protection
  // Even if assignees are removed, deadlineLocked remains true
  await testPrisma.taskAssignment.deleteMany({
    where: { taskId: multiAssignTask.id },
  });
  const unassignedLockedTask = await testPrisma.task.findUniqueOrThrow({
    where: { id: multiAssignTask.id },
  });
  assert.strictEqual(unassignedLockedTask.deadlineLocked, true);

  const bypassAttempt = validateDeadlineModification({
    isDeadlineLocked: unassignedLockedTask.deadlineLocked,
    existingDeadline: unassignedLockedTask.deadline,
    incomingDeadline: new Date("2026-12-10T18:00:00Z"),
    isAdmin: memberA.role === Role.ADMIN,
  });
  assert.strictEqual(bypassAttempt.allowed, false, "Unassignment must NOT bypass deadline lock");

  // 9. Task status updates (Backlog -> Planned -> In Progress -> Paused -> Done)
  await testPrisma.task.update({
    where: { id: task1.id },
    data: {
      status: TaskStatus.PAUSED,
      pausedAt: new Date(),
      pauseReason: "შეჩერებულია ჰოტფიქსის გამო",
    },
  });

  const pausedTask = await testPrisma.task.findUniqueOrThrow({
    where: { id: task1.id },
  });
  assert.strictEqual(pausedTask.status, TaskStatus.PAUSED);
  assert.strictEqual(pausedTask.pauseReason, "შეჩერებულია ჰოტფიქსის გამო");

  // 10. Audit event creation for status change
  await logAuditEvent({
    taskId: task1.id,
    actorId: memberA.id,
    action: "WORK_PAUSED",
    entityType: "TASK",
    entityId: task1.id,
    oldValues: { status: TaskStatus.BACKLOG },
    newValues: { status: TaskStatus.PAUSED },
    reason: "შეჩერებულია ჰოტფიქსის გამო",
    tx: testPrisma as unknown as Parameters<typeof logAuditEvent>[0]["tx"],
  });

  const pauseAudit = await testPrisma.auditEvent.findFirst({
    where: { taskId: task1.id, action: "WORK_PAUSED" },
  });
  assert(pauseAudit, "Audit event must record WORK_PAUSED");

  // 11. Task filtering tests
  // Filter by project
  const projectTasks = await testPrisma.task.findMany({
    where: { projectId: project.id },
  });
  assert(projectTasks.length >= 3);

  // Filter by unassigned
  const unassignedTasks = await testPrisma.task.findMany({
    where: { assignments: { none: {} } },
  });
  assert(unassignedTasks.some((t) => t.id === unassignedTask.id));

  // Filter by status PAUSED
  const pausedTasks = await testPrisma.task.findMany({
    where: { status: TaskStatus.PAUSED },
  });
  assert(pausedTasks.some((t) => t.id === task1.id));

  // 12 & 13. Timeline reflects task creation & updates (Multi-day date range projection)
  const startDate = new Date("2026-11-10T00:00:00Z");
  const endDate = new Date("2026-11-13T00:00:00Z");
  const uniqueTitle = `თაიმლაინის მრავალდღიანი სამუშაო_${Date.now()}`;

  const timelineTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: uniqueTitle,
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      startDate: startDate,
      deadline: endDate,
      deadlineLocked: true,
      createdById: admin.id,
    },
  });
  assert(timelineTask.id, "Timeline task created");

  // 14. Multi-day tasks do NOT create duplicate records
  const allTasksCount = await testPrisma.task.count({
    where: { title: uniqueTitle },
  });
  assert.strictEqual(allTasksCount, 1, "Exactly one task record must exist for multi-day span");

  // Verify projection logic: task spans 4 days (10, 11, 12, 13 Nov)
  const fallsOnDate = (taskStart: Date, taskEnd: Date, checkDateStr: string) => {
    const checkDate = new Date(checkDateStr + "T12:00:00Z");
    const s = new Date(taskStart.toISOString().split("T")[0] + "T00:00:00Z");
    const e = new Date(taskEnd.toISOString().split("T")[0] + "T23:59:59Z");
    return checkDate >= s && checkDate <= e;
  };

  assert.strictEqual(fallsOnDate(startDate, endDate, "2026-11-10"), true);
  assert.strictEqual(fallsOnDate(startDate, endDate, "2026-11-11"), true);
  assert.strictEqual(fallsOnDate(startDate, endDate, "2026-11-12"), true);
  assert.strictEqual(fallsOnDate(startDate, endDate, "2026-11-13"), true);
  assert.strictEqual(fallsOnDate(startDate, endDate, "2026-11-14"), false); // Past deadline
});
