import test from "node:test";
import assert from "node:assert";
import { PrismaClient, Role, TaskType, Priority, TaskStatus } from "@prisma/client";
import {
  getOrthodoxEasterSunday,
  getGeorgianHolidaysForYear,
  isDateWorkingDay,
  calculateWorkingDaysSpan,
} from "../src/lib/calendar";
import {
  validateFileIntegrity,
  isPathContained,
  containsExecutableSignature,
} from "../src/lib/fileSecurity";
import path from "path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Step 6: Calendar & Georgian Holidays Calculations", () => {
  // 1. Orthodox Easter Meeus algorithm test across years
  // 2025 Easter Sunday: April 20, 2025
  const easter2025 = getOrthodoxEasterSunday(2025);
  assert.strictEqual(easter2025.getUTCFullYear(), 2025);
  assert.strictEqual(easter2025.getUTCMonth(), 3); // 3 = April (0-indexed)
  assert.strictEqual(easter2025.getUTCDate(), 20);

  // 2026 Easter Sunday: April 12, 2026
  const easter2026 = getOrthodoxEasterSunday(2026);
  assert.strictEqual(easter2026.getUTCFullYear(), 2026);
  assert.strictEqual(easter2026.getUTCMonth(), 3); // 3 = April
  assert.strictEqual(easter2026.getUTCDate(), 12);

  // 2027 Easter Sunday: May 2, 2027
  const easter2027 = getOrthodoxEasterSunday(2027);
  assert.strictEqual(easter2027.getUTCFullYear(), 2027);
  assert.strictEqual(easter2027.getUTCMonth(), 4); // 4 = May
  assert.strictEqual(easter2027.getUTCDate(), 2);

  // 2. Fixed & Movable Holidays in Georgia
  const holidays2026 = getGeorgianHolidaysForYear(2026);
  assert(holidays2026.length >= 17, "Must contain all 13 fixed + 4 movable holidays");

  // Check fixed holidays
  const newYear = holidays2026.find((h) => h.dateStr === "2026-01-01");
  assert(newYear, "New Year must be present");
  assert.strictEqual(newYear?.name, "ახალი წელი");

  const independenceDay = holidays2026.find((h) => h.dateStr === "2026-05-26");
  assert(independenceDay, "Independence day must be present");
  assert.strictEqual(independenceDay?.name, "საქართველოს დამოუკიდებლობის დღე");

  const giorgoba = holidays2026.find((h) => h.dateStr === "2026-11-23");
  assert(giorgoba, "Giorgoba must be present");
  assert.strictEqual(giorgoba?.name, "გიორგობა");

  // Check movable Easter holidays for 2026 (Easter is April 12)
  const goodFriday = holidays2026.find((h) => h.dateStr === "2026-04-10");
  assert(goodFriday, "Good Friday 2026 must be April 10");
  assert(goodFriday?.isMovable, "Good Friday must be marked movable");

  const easterSunday = holidays2026.find((h) => h.dateStr === "2026-04-12");
  assert(easterSunday, "Easter Sunday 2026 must be April 12");

  // 3. Working Days Map & Date Evaluation
  const workingDaysMap = new Map<number, boolean>();
  workingDaysMap.set(0, false); // Sun
  workingDaysMap.set(6, false); // Sat
  workingDaysMap.set(1, true);
  workingDaysMap.set(2, true);
  workingDaysMap.set(3, true);
  workingDaysMap.set(4, true);
  workingDaysMap.set(5, true);

  const holidaysMap = new Map<string, string>();
  for (const h of holidays2026) {
    holidaysMap.set(h.dateStr, h.name);
  }

  // Jan 1, 2026 is Thursday (weekday) but New Year Holiday -> Not working
  const jan1 = new Date(2026, 0, 1);
  const jan1Status = isDateWorkingDay(jan1, workingDaysMap, holidaysMap);
  assert.strictEqual(jan1Status.isWorking, false, "Jan 1 must not be a working day");
  assert.strictEqual(jan1Status.holidayName, "ახალი წელი");
  assert.strictEqual(jan1Status.isWeekend, false);

  // Jan 5, 2026 is Monday (regular weekday) -> Working day
  const jan5 = new Date(2026, 0, 5);
  const jan5Status = isDateWorkingDay(jan5, workingDaysMap, holidaysMap);
  assert.strictEqual(jan5Status.isWorking, true, "Jan 5 must be a working day");
  assert.strictEqual(jan5Status.holidayName, null);
  assert.strictEqual(jan5Status.isWeekend, false);

  // Jan 10, 2026 is Saturday -> Weekend
  const jan10 = new Date(2026, 0, 10);
  const jan10Status = isDateWorkingDay(jan10, workingDaysMap, holidaysMap);
  assert.strictEqual(jan10Status.isWorking, false, "Saturday must not be working");
  assert.strictEqual(jan10Status.isWeekend, true);

  // 4. Working Days Span Calculation
  // Span from 2026-01-01 (Thu holiday) to 2026-01-05 (Mon working)
  // Thu (Jan 1) - Holiday
  // Fri (Jan 2) - Bedoba Holiday
  // Sat (Jan 3) - Weekend
  // Sun (Jan 4) - Weekend
  // Mon (Jan 5) - Working
  // Total calendar days = 5, total working days = 1
  const span = calculateWorkingDaysSpan(
    new Date(2026, 0, 1),
    new Date(2026, 0, 5),
    workingDaysMap,
    holidaysMap
  );
  assert.strictEqual(span.totalCalendarDays, 5);
  assert.strictEqual(span.totalWorkingDays, 1);
});

test("Step 6: File Integrity & Path Traversal Security", () => {
  // 1. Magic bytes validation for PNG
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const pngCheck = validateFileIntegrity(validPngBuffer, "screenshot.png", "image/png");
  assert.strictEqual(pngCheck.isValid, true);

  // 2. Magic bytes validation for JPEG
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const jpgCheck = validateFileIntegrity(validJpgBuffer, "photo.jpg", "image/jpeg");
  assert.strictEqual(jpgCheck.isValid, true);

  // 3. Executable file disguised as PNG must be rejected
  const fakePngBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ DOS header
  assert.strictEqual(containsExecutableSignature(fakePngBuffer), true);
  const fakePngCheck = validateFileIntegrity(fakePngBuffer, "trojan.png", "image/png");
  assert.strictEqual(fakePngCheck.isValid, false);

  // 4. Path traversal protection
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  const validPath = path.join(uploadsDir, "task_123", "image.png");
  assert.strictEqual(isPathContained(validPath, uploadsDir), true);

  const maliciousPath = path.join(uploadsDir, "..", "..", "etc", "passwd");
  assert.strictEqual(isPathContained(maliciousPath, uploadsDir), false);
});

test("Step 6: Multi-Day Task Projection, Active Stage Responsibility & Historical Activity Integrity", async () => {
  // Setup project & users
  const project = await testPrisma.project.create({
    data: {
      name: `Step 6 Timeline Project ${Date.now()}`,
      color: "#F97316",
    },
  });

  const ana = await testPrisma.user.create({
    data: {
      email: `ana_${Date.now()}@test.local`,
      name: "ანა დიზაინერი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const levan = await testPrisma.user.create({
    data: {
      email: `levan_${Date.now()}@test.local`,
      name: "ლევან დეველოპერი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const adminUser = await testPrisma.user.create({
    data: {
      email: `admin_${Date.now()}@test.local`,
      name: "ადმინისტრატორი",
      role: Role.ADMIN,
      passwordHash: "hash123",
    },
  });

  // 1. Create a multi-day task: Nov 6 to Nov 10, 2026
  const startDate = new Date(2026, 10, 6, 9, 0, 0); // Nov 6
  const deadline = new Date(2026, 10, 10, 18, 0, 0); // Nov 10

  const multiDayTask = await testPrisma.task.create({
    data: {
      taskNumber: Math.floor(Math.random() * 9000) + 1000,
      title: "მრავალდღიანი კომპონენტის განვითარება",
      projectId: project.id,
      createdById: adminUser.id,
      startDate,
      deadline,
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.HIGH,
      type: TaskType.FEATURE,
      progress: 30,
    },
  });

  // 2. Create ordered stages:
  // Stage 1 (Design): Active = true, Completed = false, Assignee = Ana
  // Stage 2 (Frontend): Active = false, Completed = false, Assignee = Levan
  const stage1 = await testPrisma.workflowStage.create({
    data: {
      taskId: multiDayTask.id,
      title: "UI/UX დიზაინის ეტაპი",
      position: 1,
      isActive: true,
      isCompleted: false,
      assignments: {
        create: { userId: ana.id },
      },
    },
    include: { assignments: { include: { user: true } } },
  });

  await testPrisma.workflowStage.create({
    data: {
      taskId: multiDayTask.id,
      title: "Frontend იმპლემენტაციის ეტაპი",
      position: 2,
      isActive: false,
      isCompleted: false,
      assignments: {
        create: { userId: levan.id },
      },
    },
  });

  // Verify Stage 1 is the currently active stage
  const fetchedStages = await testPrisma.workflowStage.findMany({
    where: { taskId: multiDayTask.id },
    orderBy: { position: "asc" },
    include: { assignments: { include: { user: true } } },
  });

  const activeStage = fetchedStages.find((s) => s.isActive && !s.isCompleted);
  assert(activeStage, "Active stage must exist");
  assert.strictEqual(activeStage?.id, stage1.id);
  assert.strictEqual(activeStage?.assignments[0]?.user.name, "ანა დიზაინერი");

  // Verify Stage 2 is waiting and not active
  const waitingStage = fetchedStages.find((s) => s.position === 2);
  assert.strictEqual(waitingStage?.isActive, false, "Waiting stage must not be active");

  // 3. Multi-day span verification:
  // The task starts Nov 6 and ends Nov 10 -> exactly 5 days span
  const daysDiff = Math.round(
    (deadline.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  assert.strictEqual(daysDiff, 4, "Date diff from Nov 6 to Nov 10 is 4 days, covering 5 date items");

  // 4. Create Audit Events representing historical transitions
  const deadlineChangeEvent = await testPrisma.auditEvent.create({
    data: {
      action: "DEADLINE_CHANGED",
      entityType: "TASK",
      entityId: multiDayTask.id,
      actorId: adminUser.id,
      taskId: multiDayTask.id,
      oldValues: { deadline: startDate.toISOString() },
      newValues: { deadline: deadline.toISOString() },
      reason: "კლიენტის მოთხოვნით დაემატა 4 დღე",
    },
    include: { actor: true },
  });

  assert.strictEqual(deadlineChangeEvent.action, "DEADLINE_CHANGED");
  assert.strictEqual(deadlineChangeEvent.actor.name, "ადმინისტრატორი");
  assert.strictEqual(deadlineChangeEvent.reason, "კლიენტის მოთხოვნით დაემატა 4 დღე");

  const statusChangeEvent = await testPrisma.auditEvent.create({
    data: {
      action: "STATUS_CHANGED",
      entityType: "TASK",
      entityId: multiDayTask.id,
      actorId: ana.id,
      taskId: multiDayTask.id,
      oldValues: { status: "PLANNED" },
      newValues: { status: "IN_PROGRESS" },
    },
    include: { actor: true },
  });

  assert.strictEqual(statusChangeEvent.action, "STATUS_CHANGED");
  assert.strictEqual((statusChangeEvent.oldValues as { status: string })?.status, "PLANNED");
  assert.strictEqual((statusChangeEvent.newValues as { status: string })?.status, "IN_PROGRESS");
});
