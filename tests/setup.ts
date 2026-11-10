// Global test setup preload
import { before } from "node:test";
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



