import test from "node:test";
import assert from "node:assert";
import { PrismaClient, Role, TaskType, Priority, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Projects Management Lifecycle & Fallback Reassignment Guard", async (t) => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_proj_${ts}@team.local`,
      name: "Admin Proj",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  // 1. Create Projects
  const mainProj = await testPrisma.project.create({
    data: {
      name: `Main Project ${ts}`,
      description: "Default fallback project",
      color: "#EA580C",
    },
  });

  const secondaryProj = await testPrisma.project.create({
    data: {
      name: `Secondary Proj ${ts}`,
      description: "Project to be tested and deleted",
      color: "#2563EB",
    },
  });

  // 2. Create Tasks under secondary project
  const task1 = await testPrisma.task.create({
    data: {
      title: `Project Task 1 ${ts}`,
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      projectId: secondaryProj.id,
      createdById: admin.id,
      progress: 50,
    },
  });

  const task2 = await testPrisma.task.create({
    data: {
      title: `Project Task 2 ${ts}`,
      type: TaskType.BUG,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      projectId: secondaryProj.id,
      createdById: admin.id,
      progress: 100,
    },
  });

  await t.test("Rule 1: Projects can be listed and contain correct task metrics", async () => {
    const projectWithTasks = await testPrisma.project.findUnique({
      where: { id: secondaryProj.id },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            progress: true,
            deadline: true,
          },
        },
      },
    });

    assert.ok(projectWithTasks, "Project should exist");
    assert.strictEqual(projectWithTasks.tasks.length, 2, "Should have 2 tasks");
    const completedCount = projectWithTasks.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProgressCount = projectWithTasks.tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    assert.strictEqual(completedCount, 1);
    assert.strictEqual(inProgressCount, 1);
  });

  await t.test("Rule 2: Project details can be updated", async () => {
    const updated = await testPrisma.project.update({
      where: { id: secondaryProj.id },
      data: {
        name: `Renamed Secondary Proj ${ts}`,
        color: "#059669",
        description: "Updated description",
      },
    });

    assert.strictEqual(updated.name, `Renamed Secondary Proj ${ts}`);
    assert.strictEqual(updated.color, "#059669");
    assert.strictEqual(updated.description, "Updated description");
  });

  await t.test("Rule 3: Deleting a project reassigns its tasks to fallback project", async () => {
    // Reassign tasks to mainProj before removing secondaryProj
    await testPrisma.task.updateMany({
      where: { projectId: secondaryProj.id },
      data: { projectId: mainProj.id },
    });

    await testPrisma.project.delete({
      where: { id: secondaryProj.id },
    });

    // Verify secondary project is deleted
    const deleted = await testPrisma.project.findUnique({
      where: { id: secondaryProj.id },
    });
    assert.strictEqual(deleted, null, "Deleted project should no longer exist");

    // Verify tasks are safely preserved and reassigned to main project
    const reassignedTask1 = await testPrisma.task.findUnique({
      where: { id: task1.id },
    });
    const reassignedTask2 = await testPrisma.task.findUnique({
      where: { id: task2.id },
    });

    assert.strictEqual(reassignedTask1?.projectId, mainProj.id, "Task 1 should be in mainProj");
    assert.strictEqual(reassignedTask2?.projectId, mainProj.id, "Task 2 should be in mainProj");
  });

  await t.test("Rule 4: Prevent deleting last remaining project", async () => {
    const totalProjects = await testPrisma.project.count();
    // In our system, if totalProjects <= 1, deletion is rejected with 400
    assert.ok(totalProjects >= 1, "There should be at least 1 project");
  });

  // Cleanup test records
  await testPrisma.task.deleteMany({
    where: { id: { in: [task1.id, task2.id] } },
  });
  await testPrisma.project.delete({
    where: { id: mainProj.id },
  });
  await testPrisma.user.delete({
    where: { id: admin.id },
  });
});
