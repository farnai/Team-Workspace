import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { Department, Role, TaskStatus, TaskType, Priority } from "@prisma/client";

test("Department Division: Development & Content Integration", async (t) => {
  // Setup test project & users
  const testProject = await prisma.project.create({
    data: {
      name: `Dept Test Project ${Date.now()}`,
      color: "#2563EB",
    },
  });

  const testUser = await prisma.user.create({
    data: {
      email: `dept_dev_${Date.now()}@test.local`,
      name: "Dev User",
      passwordHash: "hash123",
      role: Role.ADMIN,
      department: Department.DEVELOPMENT,
    },
  });

  const contentUser = await prisma.user.create({
    data: {
      email: `dept_content_${Date.now()}@test.local`,
      name: "Content User",
      passwordHash: "hash123",
      role: Role.USER,
      department: Department.CONTENT,
    },
  });

  await t.test("Rule 1: User correctly stores and defaults department", async () => {
    assert.equal(testUser.department, Department.DEVELOPMENT);
    assert.equal(contentUser.department, Department.CONTENT);
  });

  let devTaskId = "";
  let contentTaskId = "";

  await t.test("Rule 2: Tasks can be created with explicit department and default to DEVELOPMENT", async () => {
    // 1. Task with explicit DEVELOPMENT
    const devTask = await prisma.task.create({
      data: {
        title: "Build API Endpoints",
        projectId: testProject.id,
        createdById: testUser.id,
        department: Department.DEVELOPMENT,
        status: TaskStatus.BACKLOG,
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
      },
    });
    devTaskId = devTask.id;
    assert.equal(devTask.department, Department.DEVELOPMENT);

    // 2. Task with explicit CONTENT
    const contentTask = await prisma.task.create({
      data: {
        title: "Write Article for Landing Page",
        projectId: testProject.id,
        createdById: contentUser.id,
        department: Department.CONTENT,
        status: TaskStatus.BACKLOG,
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
      },
    });
    contentTaskId = contentTask.id;
    assert.equal(contentTask.department, Department.CONTENT);

    // 3. Task without department defaults to DEVELOPMENT
    const defaultTask = await prisma.task.create({
      data: {
        title: "Default Task",
        projectId: testProject.id,
        createdById: testUser.id,
        status: TaskStatus.BACKLOG,
        type: TaskType.FEATURE,
        priority: Priority.LOW,
      },
    });
    assert.equal(defaultTask.department, Department.DEVELOPMENT);

    // Clean up defaultTask
    await prisma.task.delete({ where: { id: defaultTask.id } });
  });

  await t.test("Rule 3: Filtering tasks by department isolates DEV and CONTENT tasks", async () => {
    const devTasks = await prisma.task.findMany({
      where: {
        projectId: testProject.id,
        department: Department.DEVELOPMENT,
      },
    });
    assert.ok(devTasks.some((t) => t.id === devTaskId));
    assert.ok(!devTasks.some((t) => t.id === contentTaskId));

    const contentTasks = await prisma.task.findMany({
      where: {
        projectId: testProject.id,
        department: Department.CONTENT,
      },
    });
    assert.ok(contentTasks.some((t) => t.id === contentTaskId));
    assert.ok(!contentTasks.some((t) => t.id === devTaskId));
  });

  await t.test("Rule 4: Updating task department transitions from DEVELOPMENT to CONTENT", async () => {
    const updated = await prisma.task.update({
      where: { id: devTaskId },
      data: { department: Department.CONTENT },
    });
    assert.equal(updated.department, Department.CONTENT);

    // Restore to DEVELOPMENT
    await prisma.task.update({
      where: { id: devTaskId },
      data: { department: Department.DEVELOPMENT },
    });
  });

  // Cleanup
  await prisma.task.deleteMany({ where: { projectId: testProject.id } });
  await prisma.project.delete({ where: { id: testProject.id } });
  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.user.delete({ where: { id: contentUser.id } });
});
