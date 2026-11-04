import test from "node:test";
import assert from "node:assert";
import {
  PrismaClient,
  Role,
  TaskType,
  Priority,
  TaskStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Step 8.1 - Task Archive: Completed tasks record completedAt, exit active backlog, and enter archive", async () => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_archive_${ts}@team.local`,
      name: "Archive Admin",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const member = await testPrisma.user.create({
    data: {
      email: `member_archive_${ts}@team.local`,
      name: "Archive Member",
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Archive Project ${ts}`,
      color: "#3b82f6",
    },
  });

  // Create an active task
  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 90000) + 10000,
      title: `Feature for Archive Test ${ts}`,
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      progress: 60,
      projectId: project.id,
      createdById: admin.id,
      assignments: {
        create: [{ userId: member.id }],
      },
      stages: {
        create: [
          {
            title: "Development",
            position: 1,
            isActive: true,
            isCompleted: false,
          },
        ],
      },
      subtasks: {
        create: [
          {
            title: "Implement backend",
            position: 1,
            status: "DONE",
          },
          {
            title: "Implement frontend",
            position: 2,
            status: "TODO",
          },
        ],
      },
      comments: {
        create: [
          {
            content: "Initial work begun",
            userId: member.id,
          },
        ],
      },
    },
  });

  // Verify task is initially active and completedAt is null
  assert.strictEqual(task.status, TaskStatus.IN_PROGRESS);
  assert.strictEqual(task.completedAt, null);

  // Complete the task
  const completionDate = new Date();
  const completedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.DONE,
      progress: 100,
      completedAt: completionDate,
    },
  });

  await testPrisma.auditEvent.create({
    data: {
      action: "STATUS_CHANGED",
      entityType: "TASK",
      entityId: task.id,
      taskId: task.id,
      actorId: member.id,
      oldValues: JSON.stringify({ status: "IN_PROGRESS" }),
      newValues: JSON.stringify({ status: "DONE" }),
      reason: "Task completed successfully",
    },
  });

  assert.strictEqual(completedTask.status, TaskStatus.DONE);
  assert.ok(completedTask.completedAt);
  assert.strictEqual(completedTask.progress, 100);

  // Default active backlog query: filters out DONE and CANCELLED
  const activeBacklogTasks = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: {
        notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
      },
    },
  });
  assert.strictEqual(
    activeBacklogTasks.some((t) => t.id === task.id),
    false,
    "Completed task must NOT appear in default active backlog"
  );

  // Archive query: selects tasks with status === DONE, ordered by completedAt desc
  const archivedTasks = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: TaskStatus.DONE,
    },
    orderBy: {
      completedAt: "desc",
    },
    include: {
      stages: true,
      subtasks: true,
      comments: true,
      assignments: true,
    },
  });

  assert.strictEqual(archivedTasks.length, 1);
  assert.strictEqual(archivedTasks[0].id, task.id);
  assert.strictEqual(archivedTasks[0].subtasks.length, 2);
  assert.strictEqual(archivedTasks[0].comments.length, 1);
  assert.strictEqual(archivedTasks[0].stages.length, 1);
  assert.strictEqual(archivedTasks[0].assignments.length, 1);
});

test("Step 8.1 - Task Archive: Reopening a task restores active status and logs audit event while preserving history", async () => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_reopen_${ts}@team.local`,
      name: "Reopen Admin",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Reopen Project ${ts}`,
      color: "#10b981",
    },
  });

  const initialCompletedAt = new Date(Date.now() - 3600000 * 24); // 1 day ago

  const task = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 90000) + 10000,
      title: `Task to Reopen ${ts}`,
      type: TaskType.BUG,
      priority: Priority.CRITICAL,
      status: TaskStatus.DONE,
      progress: 100,
      completedAt: initialCompletedAt,
      projectId: project.id,
      createdById: admin.id,
    },
  });

  // Record initial completion audit event
  await testPrisma.auditEvent.create({
    data: {
      action: "STATUS_CHANGED",
      entityType: "TASK",
      entityId: task.id,
      taskId: task.id,
      actorId: admin.id,
      oldValues: JSON.stringify({ status: "IN_PROGRESS" }),
      newValues: JSON.stringify({ status: "DONE" }),
    },
  });

  // Reopen the task
  const reopenedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.IN_PROGRESS,
      completedAt: null,
      progress: 75,
    },
  });

  await testPrisma.auditEvent.create({
    data: {
      action: "STATUS_CHANGED",
      entityType: "TASK",
      entityId: task.id,
      taskId: task.id,
      actorId: admin.id,
      oldValues: JSON.stringify({ status: "DONE", completedAt: initialCompletedAt }),
      newValues: JSON.stringify({ status: "IN_PROGRESS", completedAt: null }),
      reason: "ხელახლა გახსნა არქივიდან დამატებითი ტესტირებისთვის",
    },
  });

  assert.strictEqual(reopenedTask.status, TaskStatus.IN_PROGRESS);
  assert.strictEqual(reopenedTask.completedAt, null);

  // Now it appears in active backlog again
  const activeTasks = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: {
        notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
      },
    },
  });
  assert.ok(activeTasks.some((t) => t.id === task.id), "Reopened task must appear in active backlog");

  // Reopened task does NOT appear in archive
  const archived = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: TaskStatus.DONE,
    },
  });
  assert.strictEqual(archived.some((t) => t.id === task.id), false);

  // Audit history contains both completion and reopening
  const events = await testPrisma.auditEvent.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
  });
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].action, "STATUS_CHANGED");
  assert.strictEqual(events[1].action, "STATUS_CHANGED");
  assert.strictEqual(events[1].reason, "ხელახლა გახსნა არქივიდან დამატებითი ტესტირებისთვის");

  // Re-complete the task -> new completedAt timestamp
  const secondCompletedAt = new Date();
  const reCompletedTask = await testPrisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.DONE,
      progress: 100,
      completedAt: secondCompletedAt,
    },
  });

  assert.strictEqual(reCompletedTask.status, TaskStatus.DONE);
  assert.ok(reCompletedTask.completedAt);
  assert.ok(reCompletedTask.completedAt.getTime() > initialCompletedAt.getTime());
});

test("Step 8.1 - Cancelled tasks are distinct from completed archive tasks and excluded from active backlog", async () => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash("testpass123", 10);

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_cancel_${ts}@team.local`,
      name: "Cancel Admin",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Cancelled Project ${ts}`,
      color: "#ef4444",
    },
  });

  const cancelledTask = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 90000) + 10000,
      title: `Cancelled Task ${ts}`,
      type: TaskType.HOTFIX,
      priority: Priority.LOW,
      status: TaskStatus.CANCELLED,
      progress: 10,
      projectId: project.id,
      createdById: admin.id,
    },
  });

  // Default active backlog must exclude cancelled tasks
  const activeTasks = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: {
        notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
      },
    },
  });
  assert.strictEqual(activeTasks.some((t) => t.id === cancelledTask.id), false);

  // Standard completed archive must NOT include cancelled tasks
  const archiveTasks = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: TaskStatus.DONE,
    },
  });
  assert.strictEqual(archiveTasks.some((t) => t.id === cancelledTask.id), false);

  // Explicit CANCELLED filter correctly finds the cancelled task
  const explicitCancelled = await testPrisma.task.findMany({
    where: {
      projectId: project.id,
      status: TaskStatus.CANCELLED,
    },
  });
  assert.ok(explicitCancelled.some((t) => t.id === cancelledTask.id));
});
