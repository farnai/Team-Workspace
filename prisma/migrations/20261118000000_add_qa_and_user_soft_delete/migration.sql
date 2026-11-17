-- AlterEnum
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'QA';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_DELETED';

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_isDeleted_idx" ON "users"("isDeleted");
CREATE INDEX IF NOT EXISTS "users_isActive_isDeleted_idx" ON "users"("isActive", "isDeleted");
