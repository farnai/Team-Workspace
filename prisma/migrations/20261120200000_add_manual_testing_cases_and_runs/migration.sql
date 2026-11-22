-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PASSED', 'FAILED', 'BLOCKED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TEST_CASE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'TEST_CASE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'TEST_CASE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'TEST_RUN_RECORDED';

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "precondition" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_steps" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "testData" TEXT,
    "expectedResult" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "status" "TestRunStatus" NOT NULL,
    "actualResult" TEXT,
    "reason" TEXT,
    "caseTitleSnapshot" TEXT NOT NULL,
    "preconditionSnapshot" TEXT,
    "stepsSnapshot" JSONB NOT NULL,
    "executedById" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_evidences" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "test_cases_taskId_position_idx" ON "test_cases"("taskId", "position");

-- CreateIndex
CREATE INDEX "test_steps_testCaseId_position_idx" ON "test_steps"("testCaseId", "position");

-- CreateIndex
CREATE INDEX "test_runs_testCaseId_executedAt_idx" ON "test_runs"("testCaseId", "executedAt");

-- CreateIndex
CREATE INDEX "test_runs_taskId_executedAt_idx" ON "test_runs"("taskId", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_testCaseId_runNumber_key" ON "test_runs"("testCaseId", "runNumber");

-- CreateIndex
CREATE INDEX "test_run_evidences_testRunId_idx" ON "test_run_evidences"("testRunId");

-- CreateIndex
CREATE INDEX "test_run_evidences_attachmentId_idx" ON "test_run_evidences"("attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_evidences_testRunId_attachmentId_key" ON "test_run_evidences"("testRunId", "attachmentId");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_steps" ADD CONSTRAINT "test_steps_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_evidences" ADD CONSTRAINT "test_run_evidences_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_evidences" ADD CONSTRAINT "test_run_evidences_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
