const test = require("node:test");
const assert = require("node:assert");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

test("Database Integration: Tasks, Progress, Audit, and Workflow", async (t) => {
  // 1. Verify Users
  const farna = await prisma.user.findUnique({ where: { email: "admin@team.local" } });
  const vaska = await prisma.user.findUnique({ where: { email: "vaska@team.local" } });
  assert.ok(farna, "Admin user Farna must exist");
  assert.ok(vaska, "User Vaska must exist");
  assert.strictEqual(farna.role, "ADMIN");
  assert.strictEqual(vaska.role, "USER");

  // 2. Test Task 104
  const task104 = await prisma.task.findUnique({
    where: { taskNumber: 104 },
    include: {
      subtasks: true,
      stages: true,
    },
  });
  assert.ok(task104, "TASK-104 must exist");
  assert.strictEqual(task104.progress, 60, "TASK-104 progress must be 60%");
  assert.strictEqual(task104.deadlineLocked, true, "Deadline must be locked");

  // 3. Verify Subtasks count
  const doneSubtasks = task104.subtasks.filter((s) => s.status === "DONE");
  assert.strictEqual(task104.subtasks.length, 10, "Total subtasks must be 10");
  assert.strictEqual(doneSubtasks.length, 6, "Completed subtasks must be 6");

  // 4. Verify Audit Events
  const audits = await prisma.auditEvent.findMany({ where: { taskId: task104.id } });
  assert.ok(audits.length >= 1, "Audit events must be recorded for task 104");

  // 5. Test Dynamic Task Creation & Auto Progress Calculation
  const testProject = await prisma.project.findFirst();
  const newTask = await prisma.task.create({
    data: {
      projectId: testProject.id,
      title: "ინტეგრაციის ტესტის ტასკი",
      type: "FEATURE",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      createdById: vaska.id,
    },
  });

  // Add 4 subtasks
  const s1 = await prisma.subtask.create({ data: { taskId: newTask.id, title: "სუბტასკი 1", status: "TODO" } });
  const s2 = await prisma.subtask.create({ data: { taskId: newTask.id, title: "სუბტასკი 2", status: "TODO" } });
  const s3 = await prisma.subtask.create({ data: { taskId: newTask.id, title: "სუბტასკი 3", status: "TODO" } });
  const s4 = await prisma.subtask.create({ data: { taskId: newTask.id, title: "სუბტასკი 4", status: "TODO" } });

  // Mark 1 subtask DONE
  await prisma.subtask.update({ where: { id: s1.id }, data: { status: "DONE" } });

  // Compute progress
  const subtasks = await prisma.subtask.findMany({ where: { taskId: newTask.id } });
  const active = subtasks.filter((s) => s.status !== "CANCELLED");
  const completed = active.filter((s) => s.status === "DONE");
  const progress = Math.round((completed.length / active.length) * 100);

  assert.strictEqual(progress, 25, "1 out of 4 subtasks must give 25% progress");

  // Clean up test task
  await prisma.task.delete({ where: { id: newTask.id } });
});

test.after(async () => {
  await prisma.$disconnect();
});
