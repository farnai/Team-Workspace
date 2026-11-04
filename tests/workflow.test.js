const test = require("node:test");
const assert = require("node:assert");

// Test progress formula logic
function calculateProgress(subtasks) {
  const activeSubtasks = subtasks.filter((s) => s.status !== "CANCELLED");
  const completedSubtasks = activeSubtasks.filter((s) => s.status === "DONE");

  if (activeSubtasks.length === 0) return 0;
  return Math.round((completedSubtasks.length / activeSubtasks.length) * 100);
}

// Test deadline enforcement logic
function validateDeadlineModification({ isDeadlineLocked, existingDeadline, incomingDeadline, isAdmin }) {
  if (!isDeadlineLocked) return { allowed: true };
  if (incomingDeadline !== undefined) {
    const existingTime = existingDeadline ? new Date(existingDeadline).getTime() : null;
    const incomingTime = incomingDeadline ? new Date(incomingDeadline).getTime() : null;
    if (existingTime !== incomingTime && !isAdmin) {
      return { allowed: false, error: "დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს." };
    }
  }
  return { allowed: true };
}

test("Progress calculation: 10 subtasks with 4 completed gives 40%", () => {
  const subtasks = [
    { id: "1", status: "DONE", assignees: ["vaska", "tornike"] },
    { id: "2", status: "DONE", assignees: ["vaska"] },
    { id: "3", status: "DONE", assignees: ["tornike"] },
    { id: "4", status: "DONE", assignees: ["farna"] },
    { id: "5", status: "TODO", assignees: ["vaska"] },
    { id: "6", status: "TODO", assignees: ["tornike"] },
    { id: "7", status: "TODO", assignees: ["farna"] },
    { id: "8", status: "TODO", assignees: ["nika"] },
    { id: "9", status: "TODO", assignees: ["vaska"] },
    { id: "10", status: "TODO", assignees: ["farna"] },
  ];

  const progress = calculateProgress(subtasks);
  assert.strictEqual(progress, 40);
});

test("Progress calculation: cancelled subtasks are excluded from denominator", () => {
  const subtasks = [
    { id: "1", status: "DONE" },
    { id: "2", status: "DONE" },
    { id: "3", status: "CANCELLED" }, // Should not be in denominator
    { id: "4", status: "TODO" },
    { id: "5", status: "TODO" },
  ];

  // Active subtasks = 4 (1, 2, 4, 5). Done = 2. 2/4 = 50%
  const progress = calculateProgress(subtasks);
  assert.strictEqual(progress, 50);
});

test("Progress calculation: reopening a subtask recalculates progress immediately", () => {
  const subtasks = [
    { id: "1", status: "DONE" },
    { id: "2", status: "DONE" },
    { id: "3", status: "TODO" },
    { id: "4", status: "TODO" },
  ];

  assert.strictEqual(calculateProgress(subtasks), 50);

  // Reopen subtask 2
  subtasks[1].status = "TODO";
  assert.strictEqual(calculateProgress(subtasks), 25);
});

test("Deadline lock: non-admin cannot change locked deadline", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-08"),
    incomingDeadline: new Date("2026-11-12"),
    isAdmin: false,
  });

  assert.strictEqual(result.allowed, false);
  assert.match(result.error, /ადმინისტრატორს/);
});

test("Deadline lock: admin CAN change locked deadline", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-08"),
    incomingDeadline: new Date("2026-11-12"),
    isAdmin: true,
  });

  assert.strictEqual(result.allowed, true);
});

test("Deadline lock: non-admin can set initial deadline when unlocked", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: false,
    existingDeadline: null,
    incomingDeadline: new Date("2026-11-08"),
    isAdmin: false,
  });

  assert.strictEqual(result.allowed, true);
});
