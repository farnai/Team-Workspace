import test from "node:test";
import assert from "node:assert";
import { Role, TaskType, Priority, TaskStatus } from "@prisma/client";
import { testPrisma } from "./test-db";
import { canDeleteTask } from "@/server/policies/task.policy";
import { deleteTaskAction } from "@/server/actions/tasks/delete-task.action";
import bcrypt from "bcryptjs";

test("Task Deletion Lifecycle & Permission Guard", async (t) => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Create Admin and Regular Users
  const admin = await testPrisma.user.create({
    data: {
      email: `admin_del_${ts}@team.local`,
      name: "Admin Del",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const creatorUser = await testPrisma.user.create({
    data: {
      email: `creator_del_${ts}@team.local`,
      name: "Creator User",
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  });

  const otherUser = await testPrisma.user.create({
    data: {
      email: `other_del_${ts}@team.local`,
      name: "Other User",
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Delete Test Project ${ts}`,
      color: "#3b82f6",
    },
  });

  // 2. Create Task with stages, subtasks, assignments, comments
  const task = await testPrisma.task.create({
    data: {
      title: "Task to be Deleted",
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      projectId: project.id,
      createdById: creatorUser.id,
      stages: {
        create: [
          {
            title: "Stage 1",
            position: 1,
            isActive: true,
            isCompleted: false,
          },
        ],
      },
      subtasks: {
        create: [
          {
            title: "Subtask 1",
            status: "TODO",
            position: 1,
          },
        ],
      },
      assignments: {
        create: [
          {
            userId: otherUser.id,
          },
        ],
      },
      comments: {
        create: [
          {
            userId: creatorUser.id,
            content: "Comment before deletion",
          },
        ],
      },
    },
  });

  await t.test("Rule 1: Other non-admin user cannot delete creator's task", () => {
    const allowed = canDeleteTask(otherUser, task);
    assert.strictEqual(allowed, false, "Other user must be denied task deletion");
  });

  await t.test("Rule 2: Creator user CAN delete their own task", () => {
    const allowed = canDeleteTask(creatorUser, task);
    assert.strictEqual(allowed, true, "Creator user must be allowed task deletion");
  });

  await t.test("Rule 3: Admin CAN delete any task", () => {
    const allowed = canDeleteTask(admin, task);
    assert.strictEqual(allowed, true, "Admin must be allowed task deletion");
  });

  await t.test("Rule 4: Cascading cleanup upon task deletion via deleteTaskAction", async () => {
    // Perform task deletion using real application Action
    await deleteTaskAction(task.id, admin);

    // Verify task is gone
    const deletedTask = await testPrisma.task.findUnique({
      where: { id: task.id },
    });
    assert.strictEqual(deletedTask, null, "Task must no longer exist");

    // Verify cascaded stages are deleted
    const stages = await testPrisma.workflowStage.findMany({
      where: { taskId: task.id },
    });
    assert.strictEqual(stages.length, 0, "Stages must be cascade deleted");

    // Verify cascaded subtasks are deleted
    const subtasks = await testPrisma.subtask.findMany({
      where: { taskId: task.id },
    });
    assert.strictEqual(subtasks.length, 0, "Subtasks must be cascade deleted");

    // Verify cascaded comments are deleted
    const comments = await testPrisma.comment.findMany({
      where: { taskId: task.id },
    });
    assert.strictEqual(comments.length, 0, "Comments must be cascade deleted");

    // Verify cascaded assignments are deleted
    const assignments = await testPrisma.taskAssignment.findMany({
      where: { taskId: task.id },
    });
    assert.strictEqual(assignments.length, 0, "Assignments must be cascade deleted");
  });
});

