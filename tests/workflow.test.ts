import test from "node:test";
import assert from "node:assert";
import { validateDeadlineModification } from "../src/lib/workflow";

// Test production deadline modification validation logic
test("Deadline lock: non-admin cannot change locked deadline", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-08"),
    incomingDeadline: new Date("2026-11-12"),
    isAdmin: false,
  });

  assert.strictEqual(result.allowed, false);
  assert.match(result.error ?? "", /ადმინისტრატორს/);
});

test("Deadline lock: admin CAN change locked deadline", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-08"),
    incomingDeadline: new Date("2026-11-12"),
    isAdmin: true,
  });

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.error, undefined);
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

test("Deadline lock: keeping the exact same deadline does not trigger unauthorized error", () => {
  const deadline = new Date("2026-11-08T00:00:00.000Z");
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: deadline,
    incomingDeadline: new Date("2026-11-08T00:00:00.000Z"),
    isAdmin: false,
  });

  assert.strictEqual(result.allowed, true);
});

test("Deadline lock: omitting deadline during other updates is allowed for non-admin", () => {
  const result = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-08"),
    incomingDeadline: undefined,
    isAdmin: false,
  });

  assert.strictEqual(result.allowed, true);
});
