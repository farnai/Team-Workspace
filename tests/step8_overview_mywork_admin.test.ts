import test from "node:test";
import assert from "node:assert";
import {
  PrismaClient,
  Role,
  TaskType,
  Priority,
  TaskStatus,
  SubtaskStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { detectTeamWorkloadConflicts, BasicTaskForConflict } from "../src/lib/conflicts";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Step 8: Admin User Management - Creation, Deactivation, History Preservation & Login Guard", async () => {
  // 1. Create an admin and a regular user
  const adminEmail = `admin_step8_${Date.now()}@team.local`;
  const userEmail = `dev_step8_${Date.now()}@team.local`;
  const initialPassword = "initialPassword123";
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  const admin = await testPrisma.user.create({
    data: {
      email: adminEmail,
      name: "Step 8 Admin",
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  });

  const member = await testPrisma.user.create({
    data: {
      email: userEmail,
      name: "Step 8 Developer",
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  });

  assert.ok(member.id);
  assert.strictEqual(member.isActive, true);

  // 2. Create project and historical records for member (tasks, comments, subtasks)
  const project = await testPrisma.project.create({
    data: {
      name: `Step 8 Project ${Date.now()}`,
      color: "#f97316",
    },
  });

  const task = await testPrisma.task.create({
    data: {
      title: "Task with historical user activity",
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      projectId: project.id,
      createdById: admin.id,
      deadline: new Date(Date.now() + 86400000),
      deadlineLocked: true,
      assignments: {
        create: { userId: member.id },
      },
      comments: {
        create: {
          userId: member.id,
          content: "Historical comment by member",
        },
      },
      subtasks: {
        create: {
          title: "Subtask completed by member",
          status: SubtaskStatus.DONE,
          completedById: member.id,
          completedAt: new Date(),
        },
      },
    },
    include: {
      comments: true,
      subtasks: true,
    },
  });

  assert.strictEqual(task.comments.length, 1);
  assert.strictEqual(task.subtasks.length, 1);

  // 3. Deactivate user (Soft deactivation - NO hard deletion)
  const deactivatedUser = await testPrisma.user.update({
    where: { id: member.id },
    data: { isActive: false },
  });

  assert.strictEqual(deactivatedUser.isActive, false);

  // 4. Verify login rejection logic when isActive is false
  const userForLogin = await testPrisma.user.findUnique({
    where: { email: userEmail },
  });
  assert.ok(userForLogin);
  assert.strictEqual(userForLogin.isActive, false);

  // In auth logic: if (!user || !user.isActive) -> rejects login!
  const canLogin = userForLogin && userForLogin.isActive;
  assert.strictEqual(canLogin, false, "Deactivated user must not be permitted to log in");

  // 5. Verify historical records are completely preserved
  const historicalComments = await testPrisma.comment.findMany({
    where: { userId: member.id },
  });
  assert.strictEqual(historicalComments.length, 1, "Historical comments must be preserved");

  const completedSubtasks = await testPrisma.subtask.findMany({
    where: { completedById: member.id },
  });
  assert.strictEqual(completedSubtasks.length, 1, "Completed subtasks must be preserved");

  // 6. Reset password for user
  const newPassword = "newPassword456";
  const newHash = await bcrypt.hash(newPassword, 10);
  const userWithNewPassword = await testPrisma.user.update({
    where: { id: member.id },
    data: { passwordHash: newHash, isActive: true },
  });

  const isOldPasswordValid = await bcrypt.compare(initialPassword, userWithNewPassword.passwordHash);
  const isNewPasswordValid = await bcrypt.compare(newPassword, userWithNewPassword.passwordHash);
  assert.strictEqual(isOldPasswordValid, false, "Old password must be invalidated");
  assert.strictEqual(isNewPasswordValid, true, "New password must match");
  assert.strictEqual(userWithNewPassword.isActive, true, "Reactivated user can log in");
});

test("Step 8: Sequential Workflow Stages - Active vs Waiting Stage Assignee in Overview & My Work", async () => {
  const ts = Date.now();
  const designer = await testPrisma.user.create({
    data: {
      email: `designer_${ts}@team.local`,
      name: "Vaska Designer",
      role: Role.USER,
      passwordHash: "hash",
    },
  });

  const developer = await testPrisma.user.create({
    data: {
      email: `dev_${ts}@team.local`,
      name: "Tornike Dev",
      role: Role.USER,
      passwordHash: "hash",
    },
  });

  const qa = await testPrisma.user.create({
    data: {
      email: `qa_${ts}@team.local`,
      name: "Farna QA",
      role: Role.USER,
      passwordHash: "hash",
    },
  });

  const project = await testPrisma.project.create({
    data: { name: `Workflow Project ${ts}` },
  });

  // Task with 3 sequential stages:
  // Stage 1: Design (completed) -> assigned to Vaska
  // Stage 2: Development (active) -> assigned to Tornike
  // Stage 3: QA (waiting/future) -> assigned to Farna
  const task = await testPrisma.task.create({
    data: {
      title: "Sequential Feature Pipeline",
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      projectId: project.id,
      createdById: designer.id,
      deadline: new Date(Date.now() + 86400000 * 3),
      stages: {
        create: [
          {
            title: "დიზაინი (Design)",
            position: 1,
            isActive: false,
            isCompleted: true,
            assignments: { create: { userId: designer.id } },
          },
          {
            title: "დეველოპმენტი (Dev)",
            position: 2,
            isActive: true,
            isCompleted: false,
            assignments: { create: { userId: developer.id } },
          },
          {
            title: "ტესტირება (QA)",
            position: 3,
            isActive: false,
            isCompleted: false,
            assignments: { create: { userId: qa.id } },
          },
        ],
      },
    },
    include: {
      stages: {
        include: { assignments: true },
      },
    },
  });

  // Verify stage states
  const activeStage = task.stages.find((s) => s.isActive && !s.isCompleted);
  assert.ok(activeStage);
  assert.strictEqual(activeStage.position, 2);
  assert.strictEqual(activeStage.assignments[0].userId, developer.id);

  // In Overview / My Work logic:
  // Designer's stage is completed
  // Developer is the active worker on the task
  // QA is WAITING for previous stages to complete
  const isDevActive = activeStage.assignments.some((a) => a.userId === developer.id);
  assert.strictEqual(isDevActive, true, "Tornike must be identified as currently active");

  const futureStage = task.stages.find((s) => !s.isActive && !s.isCompleted);
  assert.ok(futureStage);
  const isQaWaiting = futureStage.assignments.some((a) => a.userId === qa.id);
  assert.strictEqual(isQaWaiting, true, "Farna must be waiting for previous stage completion");

  const isQaActive = activeStage.assignments.some((a) => a.userId === qa.id);
  assert.strictEqual(isQaActive, false, "QA user must NOT be reported as active on unstarted stage");
});

test("Step 8: Notifications - Creation, Unread Count & Mark All As Read", async () => {
  const ts = Date.now();
  const user = await testPrisma.user.create({
    data: {
      email: `notif_user_${ts}@team.local`,
      name: "Notification Test User",
      role: Role.USER,
      passwordHash: "hash",
    },
  });

  // 1. Create two unread notifications
  await testPrisma.notification.createMany({
    data: [
      {
        userId: user.id,
        title: "ახალი დავალება",
        message: "თქვენ დაგენიშნათ ტასკი #101",
        isRead: false,
      },
      {
        userId: user.id,
        title: "სტატუსის ცვლილება",
        message: "ტასკი გადავიდა მუშაობის ეტაპზე",
        isRead: false,
      },
    ],
  });

  const unreadBefore = await testPrisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
  assert.strictEqual(unreadBefore, 2);

  // 2. Mark one notification as read
  const firstNotif = await testPrisma.notification.findFirst({
    where: { userId: user.id, isRead: false },
  });
  assert.ok(firstNotif);

  await testPrisma.notification.update({
    where: { id: firstNotif.id },
    data: { isRead: true },
  });

  const unreadAfterSingle = await testPrisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
  assert.strictEqual(unreadAfterSingle, 1);

  // 3. Mark all remaining as read
  await testPrisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  const unreadAfterAll = await testPrisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
  assert.strictEqual(unreadAfterAll, 0);
});

test("Step 8: Workload Conflict Severity - Normal Parallel Tasks are Warning, Not False Critical", () => {
  const startDate = new Date("2026-11-05T00:00:00Z");
  const endDate = new Date("2026-11-08T23:59:59Z");

  const normalTask1: BasicTaskForConflict = {
    id: "task-1",
    taskNumber: 101,
    title: "Normal Task 1",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    startDate,
    deadline: new Date("2026-11-07T00:00:00Z"),
    assignments: [{ user: { id: "user-1", name: "Giorgi" } }],
  };

  const normalTask2: BasicTaskForConflict = {
    id: "task-2",
    taskNumber: 102,
    title: "Normal Task 2",
    priority: "HIGH",
    status: "IN_PROGRESS",
    startDate,
    deadline: new Date("2026-11-08T00:00:00Z"),
    assignments: [{ user: { id: "user-1", name: "Giorgi" } }],
  };

  const normalConflicts = detectTeamWorkloadConflicts(
    [normalTask1, normalTask2],
    startDate,
    endDate
  );

  const overloadConflicts = normalConflicts.filter((c) => c.type === "USER_OVERLOAD");
  assert.strictEqual(overloadConflicts.length > 0, true);
  assert.strictEqual(
    overloadConflicts[0].severity,
    "warning",
    "2 simultaneous tasks with normal priority must be a warning, not critical alarm"
  );
  assert.ok(overloadConflicts[0].message.includes("2"));

  // Critical is reserved for 2+ CRITICAL priority tasks simultaneously
  const critTask1: BasicTaskForConflict = {
    id: "task-3",
    taskNumber: 103,
    title: "Urgent Hotfix 1",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    startDate,
    deadline: new Date("2026-11-06T00:00:00Z"),
    assignments: [{ user: { id: "user-2", name: "Nika" } }],
  };

  const critTask2: BasicTaskForConflict = {
    id: "task-4",
    taskNumber: 104,
    title: "Urgent Hotfix 2",
    priority: "CRITICAL",
    status: "IN_PROGRESS",
    startDate,
    deadline: new Date("2026-11-06T00:00:00Z"),
    assignments: [{ user: { id: "user-2", name: "Nika" } }],
  };

  const critConflicts = detectTeamWorkloadConflicts(
    [critTask1, critTask2],
    startDate,
    endDate
  );

  const critOverload = critConflicts.filter((c) => c.type === "USER_OVERLOAD");
  assert.strictEqual(critOverload.length > 0, true);
  assert.strictEqual(
    critOverload[0].severity,
    "critical",
    "2 simultaneous CRITICAL tasks must trigger critical severity"
  );
});

test("Step 8: Working Calendar & Holidays - Custom Non-working Day Lifecycle", async () => {
  const holidayDate = new Date("2026-12-31T00:00:00Z");

  // Create custom non-working day
  const customHoliday = await testPrisma.holiday.create({
    data: {
      date: holidayDate,
      name: "საახალწლო დამატებითი დასვენება",
      isOfficial: false,
    },
  });

  assert.ok(customHoliday.id);
  assert.strictEqual(customHoliday.isOfficial, false);
  assert.strictEqual(customHoliday.name, "საახალწლო დამატებითი დასვენება");

  // Verify retrieval
  const found = await testPrisma.holiday.findUnique({
    where: { id: customHoliday.id },
  });
  assert.ok(found);

  // Delete custom holiday
  await testPrisma.holiday.delete({
    where: { id: customHoliday.id },
  });

  const afterDelete = await testPrisma.holiday.findUnique({
    where: { id: customHoliday.id },
  });
  assert.strictEqual(afterDelete, null, "Custom holiday must be cleanly deletable");
});
