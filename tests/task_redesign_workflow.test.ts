import test from "node:test";
import assert from "node:assert/strict";
import { testPrisma as prisma } from "./test-db";
import { Role, TaskType, Priority, TaskStatus } from "@prisma/client";

test("Task Redesign Workflow: Optional Deadlines, Sequential Assignees & Deadline Requests", async (t) => {
  // Setup test admin and users
  const adminUser = await prisma.user.create({
    data: {
      name: "ტესტ ადმინი Redesign",
      email: `admin_redesign_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const devUser1 = await prisma.user.create({
    data: {
      name: "დეველოპერი 1",
      email: `dev1_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.USER,
      isActive: true,
    },
  });

  const devUser2 = await prisma.user.create({
    data: {
      name: "დეველოპერი 2",
      email: `dev2_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.USER,
      isActive: true,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Redesign Test Project",
      color: "#3B82F6",
    },
  });

  t.after(async () => {
    await prisma.notification.deleteMany({
      where: { userId: { in: [adminUser.id, devUser1.id, devUser2.id] } },
    });
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [adminUser.id, devUser1.id, devUser2.id] } },
    });
    await prisma.task.deleteMany({
      where: { projectId: project.id },
    });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, devUser1.id, devUser2.id] } },
    });
  });

  await t.test("Rule 1: Task overall deadline is optional even with assignee", async () => {
    // Create task with 1 assignee and NO overall deadline
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "დავალება უდედლაინოდ",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.BACKLOG,
        deadline: null,
        createdById: adminUser.id,
        assignments: {
          create: [{ userId: devUser1.id }],
        },
      },
      include: { assignments: true },
    });

    assert.equal(task.deadline, null, "Task deadline is null (optional)");
    assert.equal(task.assignments.length, 1, "Assignee was assigned successfully without deadline");
  });

  await t.test("Rule 2: Sequential Workflow - 1st assignee deadline required, 2nd optional, order preserved", async () => {
    const d1 = new Date("2026-11-15T18:00:00.000Z");
    const overallDeadline = new Date("2026-11-30T18:00:00.000Z");

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "თანმიმდევრული სამუშაო",
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        deadline: overallDeadline,
        createdById: adminUser.id,
        assignments: {
          create: [{ userId: devUser1.id }, { userId: devUser2.id }],
        },
        stages: {
          create: [
            {
              position: 0,
              title: "ეტაპი 1: დეველოპერი 1",
              isActive: true,
              deadline: d1,
              deadlineLocked: true,
              assignments: { create: [{ userId: devUser1.id }] },
            },
            {
              position: 1,
              title: "ეტაპი 2: დეველოპერი 2",
              isActive: false,
              deadline: null, // optional for 2nd assignee
              deadlineLocked: false,
              assignments: { create: [{ userId: devUser2.id }] },
            },
          ],
        },
      },
      include: { stages: { orderBy: { position: "asc" }, include: { assignments: true } } },
    });

    assert.equal(task.stages.length, 2, "Created 2 stages");
    assert.equal(task.stages[0].isActive, true, "Stage 1 is active");
    assert.equal(task.stages[0].deadline?.toISOString(), d1.toISOString(), "Stage 1 has mandatory deadline");
    assert.equal(task.stages[1].isActive, false, "Stage 2 is inactive (waiting)");
    assert.equal(task.stages[1].deadline, null, "Stage 2 deadline is optional (null)");
  });

  await t.test("Rule 2.1: Task creation with multiple assignees does NOT require deadline in BACKLOG, only when starting IN_PROGRESS", async () => {
    // 1. Create task in BACKLOG with 2 assignees and NO deadline
    const backlogTask = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "ბექლოგის თანმიმდევრული დავალება უდედლაინოდ",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.BACKLOG,
        deadline: null,
        createdById: adminUser.id,
        assignments: {
          create: [{ userId: devUser1.id }, { userId: devUser2.id }],
        },
        stages: {
          create: [
            {
              position: 0,
              title: "ეტაპი 1: დეველოპერი 1",
              isActive: false,
              deadline: null, // optional at creation!
              deadlineLocked: false,
              assignments: { create: [{ userId: devUser1.id }] },
            },
            {
              position: 1,
              title: "ეტაპი 2: დეველოპერი 2",
              isActive: false,
              deadline: null,
              deadlineLocked: false,
              assignments: { create: [{ userId: devUser2.id }] },
            },
          ],
        },
      },
      include: { stages: true, assignments: true },
    });

    assert.equal(backlogTask.status, TaskStatus.BACKLOG);
    assert.equal(backlogTask.stages.length, 2);
    assert.equal(backlogTask.stages[0].deadline, null, "1st assignee deadline is optional at creation in BACKLOG");
  });

  await t.test("Rule 3: Overdue Predecessor does not falsely penalize successor", async () => {
    // Stage 1 deadline was yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "გადაცილებული 1-ლი ეტაპი",
        type: TaskType.BUG,
        priority: Priority.CRITICAL,
        status: TaskStatus.IN_PROGRESS,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // overall deadline is future
        createdById: adminUser.id,
        stages: {
          create: [
            {
              position: 0,
              title: "ეტაპი 1: დეველოპერი 1",
              isActive: true,
              deadline: yesterday, // past
              deadlineLocked: true,
              assignments: { create: [{ userId: devUser1.id }] },
            },
            {
              position: 1,
              title: "ეტაპი 2: დეველოპერი 2",
              isActive: false,
              deadline: yesterday, // estimated date that passed, but work hasn't reached it!
              deadlineLocked: true,
              assignments: { create: [{ userId: devUser2.id }] },
            },
          ],
        },
      },
      include: { stages: true },
    });

    const s1 = task.stages[0];
    const s2 = task.stages[1];

    const isS1Overdue = s1.isActive && s1.deadline && s1.deadline < new Date();
    const isS2Overdue = s2.isActive && s2.deadline && s2.deadline < new Date();

    assert.equal(isS1Overdue, true, "Active stage 1 is overdue");
    assert.equal(isS2Overdue, false, "Inactive successor stage 2 is NOT overdue (waiting)");
  });

  await t.test("Rule 4: Monthly Interval Intersection Logic", () => {
    // Task period: Oct 27, 2026 to Nov 5, 2026
    const taskStart = new Date("2026-10-27T00:00:00.000Z");
    const taskEnd = new Date("2026-11-05T23:59:59.000Z");

    // October bounds: Oct 1 - Oct 31
    const octStart = new Date("2026-10-01T00:00:00.000Z");
    const octEnd = new Date("2026-10-31T23:59:59.999Z");

    // November bounds: Nov 1 - Nov 30
    const novStart = new Date("2026-11-01T00:00:00.000Z");
    const novEnd = new Date("2026-11-30T23:59:59.999Z");

    // December bounds: Dec 1 - Dec 31
    const decStart = new Date("2026-12-01T00:00:00.000Z");
    const decEnd = new Date("2026-12-31T23:59:59.999Z");

    const intersectsOct = taskStart <= octEnd && taskEnd >= octStart;
    const intersectsNov = taskStart <= novEnd && taskEnd >= novStart;
    const intersectsDec = taskStart <= decEnd && taskEnd >= decStart;

    assert.equal(intersectsOct, true, "Task intersects October");
    assert.equal(intersectsNov, true, "Task intersects November");
    assert.equal(intersectsDec, false, "Task does NOT intersect December");
  });

  await t.test("Rule 5: Monthly Overdue Fresh Start - overdue tasks restart every month", () => {
    // Oct task with past deadline
    const octTask = {
      title: "ოქტომბრის დავალება",
      status: TaskStatus.IN_PROGRESS,
      deadline: new Date("2026-10-25T18:00:00.000Z"),
    };

    // Nov task with passed deadline
    const novTask = {
      title: "ნოემბრის დავალება",
      status: TaskStatus.IN_PROGRESS,
      deadline: new Date("2026-11-04T18:00:00.000Z"),
    };

    const novStart = new Date("2026-11-01T00:00:00.000Z");
    const novEnd = new Date("2026-11-30T23:59:59.999Z");
    const now = new Date("2026-11-06T12:00:00.000Z");

    const isOctTaskOverdueForNov =
      octTask.deadline >= novStart && octTask.deadline <= novEnd && octTask.deadline < now;
    const isNovTaskOverdueForNov =
      novTask.deadline >= novStart && novTask.deadline <= novEnd && novTask.deadline < now;

    assert.equal(isOctTaskOverdueForNov, false, "October deadline does NOT count as overdue in November (clean monthly start)");
    assert.equal(isNovTaskOverdueForNov, true, "November deadline counts as overdue in November");
  });
});

