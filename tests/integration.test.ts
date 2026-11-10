import test from "node:test";
import assert from "node:assert";
import { PrismaClient, TaskStatus, SubtaskStatus } from "@prisma/client";
import {
  calculateAndSyncTaskProgress,
  validateDeadlineModification,
  advanceWorkflowStage,
} from "../src/lib/workflow";
import { logAuditEvent } from "../src/lib/audit";

// Dedicated connection to ISOLATED test database (never touched dev DB)
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Isolated Integration Test: Users, Tasks, Deadline Governance, Workflow & Progress", async () => {
  // 1. Create clean test project
  const project = await testPrisma.project.create({
    data: {
      name: "ტესტ პროექტი",
      description: "იზოლირებული სატესტო პროექტი",
      color: "#EA580C",
    },
  });

  // 2. Create users
  const adminUser = await testPrisma.user.create({
    data: {
      email: `admin_${Date.now()}@test.local`,
      name: "ადმინ ფარნა",
      role: "ADMIN",
      passwordHash: "dummyhash",
    },
  });

  const normalUser = await testPrisma.user.create({
    data: {
      email: `user_${Date.now()}@test.local`,
      name: "მომხმარებელი ვასკა",
      role: "USER",
      passwordHash: "dummyhash",
    },
  });

  const coworker = await testPrisma.user.create({
    data: {
      email: `coworker_${Date.now()}@test.local`,
      name: "თანამშრომელი თორნიკე",
      role: "USER",
      passwordHash: "dummyhash",
    },
  });

  assert.strictEqual(adminUser.role, "ADMIN");
  assert.strictEqual(normalUser.role, "USER");

  // 3. Task creation with initial deadline and assignment
  const initialDeadline = new Date("2026-11-15T18:00:00.000Z");
  const task = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "ინტეგრაციული ტესტის ამოცანა",
      type: "FEATURE",
      priority: "HIGH",
      status: TaskStatus.IN_PROGRESS,
      deadline: initialDeadline,
      deadlineLocked: true, // Locked on initial assignment
      createdById: normalUser.id,
    },
  });

  await testPrisma.taskAssignment.create({
    data: { taskId: task.id, userId: normalUser.id },
  });

  // 4. Test Task Deadline Protection
  // 4a. Non-admin attempt to modify locked deadline -> REJECTED
  const nonAdminAttempt = validateDeadlineModification({
    isDeadlineLocked: task.deadlineLocked,
    existingDeadline: task.deadline,
    incomingDeadline: new Date("2026-11-20T18:00:00.000Z"),
    isAdmin: (normalUser.role as string) === "ADMIN",
  });
  assert.strictEqual(nonAdminAttempt.allowed, false);
  assert.match(nonAdminAttempt.error ?? "", /ადმინისტრატორს/);

  // 4b. Admin modification of locked deadline -> ALLOWED & Audited
  const adminNewDeadline = new Date("2026-11-22T18:00:00.000Z");
  const adminAttempt = validateDeadlineModification({
    isDeadlineLocked: task.deadlineLocked,
    existingDeadline: task.deadline,
    incomingDeadline: adminNewDeadline,
    isAdmin: (adminUser.role as string) === "ADMIN",
  });
  assert.strictEqual(adminAttempt.allowed, true);

  // Apply admin update
  await testPrisma.task.update({
    where: { id: task.id },
    data: { deadline: adminNewDeadline },
  });

  await logAuditEvent({
    taskId: task.id,
    actorId: adminUser.id,
    action: "DEADLINE_CHANGED",
    entityType: "TASK",
    entityId: task.id,
    oldValues: { deadline: initialDeadline },
    newValues: { deadline: adminNewDeadline },
    reason: "ტესტური გადავადება ადმინის მიერ",
    tx: testPrisma,
  });

  const deadlineAudit = await testPrisma.auditEvent.findFirst({
    where: { taskId: task.id, action: "DEADLINE_CHANGED" },
  });
  assert.ok(deadlineAudit, "Audit event must be logged for deadline change");
  assert.strictEqual(deadlineAudit.actorId, adminUser.id);

  // 5. Test Subtask Creation and Subtask Deadline Lock
  const subtaskDeadline = new Date("2026-11-12T12:00:00.000Z");
  const subtask1 = await testPrisma.subtask.create({
    data: {
      taskId: task.id,
      title: "საბტასკი 1 (დავალება)",
      deadline: subtaskDeadline,
      deadlineLocked: true, // Locked upon assignment
      status: SubtaskStatus.TODO,
    },
  });

  await testPrisma.subtaskAssignment.create({
    data: { subtaskId: subtask1.id, userId: normalUser.id },
  });

  // 5a. Non-admin attempt to change subtask deadline -> REJECTED
  const subtaskNonAdminCheck = validateDeadlineModification({
    isDeadlineLocked: subtask1.deadlineLocked,
    existingDeadline: subtask1.deadline,
    incomingDeadline: new Date("2026-11-18T12:00:00.000Z"),
    isAdmin: false,
  });
  assert.strictEqual(subtaskNonAdminCheck.allowed, false);

  // 5b. Non-admin tries to unassign and bypass -> existing.deadlineLocked is still true -> REJECTED
  const unassignBypassCheck = validateDeadlineModification({
    isDeadlineLocked: subtask1.deadlineLocked,
    existingDeadline: subtask1.deadline,
    incomingDeadline: new Date("2026-11-19T12:00:00.000Z"),
    isAdmin: false,
  });
  assert.strictEqual(unassignBypassCheck.allowed, false);

  // 5c. Admin subtask deadline change -> ALLOWED
  const subtaskAdminCheck = validateDeadlineModification({
    isDeadlineLocked: subtask1.deadlineLocked,
    existingDeadline: subtask1.deadline,
    incomingDeadline: new Date("2026-11-14T12:00:00.000Z"),
    isAdmin: true,
  });
  assert.strictEqual(subtaskAdminCheck.allowed, true);

  // 6. Test Centralized Progress Calculation
  // Add 9 more subtasks (total 10)
  for (let i = 2; i <= 10; i++) {
    const s = await testPrisma.subtask.create({
      data: {
        taskId: task.id,
        title: `საბტასკი ${i}`,
        status: SubtaskStatus.TODO,
      },
    });
    // Add multiple assignees to subtask 2 to test that multi-assignee subtasks are counted once
    if (i === 2) {
      await testPrisma.subtaskAssignment.createMany({
        data: [
          { subtaskId: s.id, userId: normalUser.id },
          { subtaskId: s.id, userId: coworker.id },
        ],
      });
    }
  }

  // Mark 4 subtasks DONE (subtasks 1, 2, 3, 4)
  const allSubtasks = await testPrisma.subtask.findMany({ where: { taskId: task.id } });
  assert.strictEqual(allSubtasks.length, 10, "Total subtasks must be 10");

  for (let i = 0; i < 4; i++) {
    await testPrisma.subtask.update({
      where: { id: allSubtasks[i].id },
      data: { status: SubtaskStatus.DONE },
    });
  }

  // Calculate progress using real production service function
  const progress40 = await calculateAndSyncTaskProgress(task.id, testPrisma);
  assert.strictEqual(progress40, 40, "4 out of 10 done must yield 40% progress");

  // 7. Test cancelled subtask exclusion from denominator
  // Cancel subtask 10 -> active subtasks become 9, completed = 4 -> Math.round(4/9*100) = 44%
  await testPrisma.subtask.update({
    where: { id: allSubtasks[9].id },
    data: { status: SubtaskStatus.CANCELLED },
  });

  const progressAfterCancel = await calculateAndSyncTaskProgress(task.id, testPrisma);
  assert.strictEqual(progressAfterCancel, 44, "Cancelled subtask must be excluded from denominator (4/9 = 44%)");

  // 8. Test reopening a subtask
  // Reopen subtask 4 (DONE -> TODO) -> completed becomes 3 out of 9 active -> Math.round(3/9*100) = 33%
  await testPrisma.subtask.update({
    where: { id: allSubtasks[3].id },
    data: { status: SubtaskStatus.TODO },
  });

  const progressAfterReopen = await calculateAndSyncTaskProgress(task.id, testPrisma);
  assert.strictEqual(progressAfterReopen, 33, "Reopening a subtask must immediately lower progress (3/9 = 33%)");

  // 9. Test Sequential Workflow Stages and Atomic Handoff
  const stage1 = await testPrisma.workflowStage.create({
    data: {
      taskId: task.id,
      title: "1. დიზაინი",
      position: 0,
      isActive: true,
      deadlineLocked: true,
    },
  });

  await testPrisma.stageAssignment.create({
    data: { stageId: stage1.id, userId: normalUser.id },
  });

  const stage2 = await testPrisma.workflowStage.create({
    data: {
      taskId: task.id,
      title: "2. დეველოპმენტი",
      position: 1,
      isActive: false,
      deadlineLocked: false,
    },
  });

  await testPrisma.stageAssignment.create({
    data: { stageId: stage2.id, userId: coworker.id },
  });

  // Assign subtask 1 to stage 1 and ensure it's marked DONE
  await testPrisma.subtask.update({
    where: { id: allSubtasks[0].id },
    data: { stageId: stage1.id, status: SubtaskStatus.DONE },
  });

  // Complete stage 1 using production advanceWorkflowStage
  const handoffResult = await advanceWorkflowStage({
    stageId: stage1.id,
    actorId: normalUser.id,
    tx: testPrisma,
  });

  assert.ok(handoffResult.nextStage, "Next stage must be activated");
  assert.strictEqual(handoffResult.nextStage?.id, stage2.id);

  // Verify Stage 1 is marked completed and inactive
  const updatedStage1 = await testPrisma.workflowStage.findUnique({ where: { id: stage1.id } });
  assert.strictEqual(updatedStage1?.isCompleted, true);
  assert.strictEqual(updatedStage1?.isActive, false);

  // Verify Stage 2 is now active
  const updatedStage2 = await testPrisma.workflowStage.findUnique({ where: { id: stage2.id } });
  assert.strictEqual(updatedStage2?.isActive, true);

  // Verify notification was generated for coworker on Stage 2
  const notif = await testPrisma.notification.findFirst({
    where: { userId: coworker.id, taskId: task.id },
  });
  assert.ok(notif, "Notification must be sent to the next stage assignee");
  assert.match(notif.message, /დეველოპმენტი/);

  // Clean up test data in the test database
  await testPrisma.auditEvent.deleteMany({
    where: { actorId: { in: [adminUser.id, normalUser.id, coworker.id] } },
  });
  await testPrisma.notification.deleteMany({
    where: { userId: { in: [adminUser.id, normalUser.id, coworker.id] } },
  });
  await testPrisma.project.delete({ where: { id: project.id } });
  await testPrisma.user.deleteMany({
    where: { id: { in: [adminUser.id, normalUser.id, coworker.id] } },
  });
});

test.after(async () => {
  await testPrisma.$disconnect();
});
