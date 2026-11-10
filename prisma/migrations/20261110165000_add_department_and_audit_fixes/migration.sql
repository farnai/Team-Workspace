-- CreateEnum (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Department') THEN
    CREATE TYPE "Department" AS ENUM ('DEVELOPMENT', 'CONTENT');
  END IF;
END $$;

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" "Department" NOT NULL DEFAULT 'DEVELOPMENT';

-- AlterTable tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "department" "Department" NOT NULL DEFAULT 'DEVELOPMENT';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_department_idx" ON "tasks"("department");

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TASK_DELETED';

-- AlterTable audit_events: change taskId fk to ON DELETE SET NULL
ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_taskId_fkey";
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

