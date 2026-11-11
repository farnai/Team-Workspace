// Global test setup preload
import { before } from "node:test";
import Module from "node:module";

// Mock server-only in the test runner environment so server files can be imported directly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalRequire = (Module as any).prototype.require;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Module as any).prototype.require = function (id: string, ...args: any[]) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, [id, ...args]);
};

import { testPrisma } from "./test-db";

// Ensure sequence is synchronized with max(taskNumber) in the isolated test DB to prevent collisions
before(async () => {
  try {
    await testPrisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        seq_name text;
      BEGIN
        seq_name := pg_get_serial_sequence('"tasks"', 'taskNumber');
        IF seq_name IS NOT NULL THEN
          EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX("taskNumber") FROM "tasks"), 0) + 1, false)', seq_name);
        END IF;
      END $$;
    `);
  } catch {
    // Ignore if table or sequence does not exist
  }
});



