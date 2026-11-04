-- AlterTable
ALTER TABLE "subtasks" ADD COLUMN "deadlineLocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workflow_stages" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "deadline" TIMESTAMP(3),
ADD COLUMN "deadlineLocked" BOOLEAN NOT NULL DEFAULT false;

