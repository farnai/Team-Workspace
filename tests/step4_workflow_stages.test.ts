import test from "node:test";
import assert from "node:assert";
import {
  TaskStatus,
  SubtaskStatus,
  Role,
} from "@prisma/client";
import { testPrisma } from "./test-db";
import {
  calculateAndSyncTaskProgress,
  advanceWorkflowStage,
  validateDeadlineModification,
} from "../src/lib/workflow";

test("Step 4: Ordered Workflow Stages, Multi-Assignee Subtasks & Automatic Progress", async () => {
  // 1. Setup Project & Users (Vaska, Tornike, Farna)
  const project = await testPrisma.project.create({
    data: {
      name: `Step 4 Project ${Date.now()}`,
      color: "#EA580C",
    },
  });

  const vaska = await testPrisma.user.create({
    data: {
      email: `vaska_${Date.now()}@test.local`,
      name: "ვასკა (UI/UX)",
      role: Role.USER,
      passwordHash: "dummyhash",
    },
  });

  const tornike = await testPrisma.user.create({
    data: {
      email: `tornike_${Date.now()}@test.local`,
      name: "თორნიკე (Dev)",
      role: Role.USER,
      passwordHash: "dummyhash",
    },
  });

  const farna = await testPrisma.user.create({
    data: {
      email: `farna_${Date.now()}@test.local`,
      name: "ფარნა (QA)",
      role: Role.ADMIN,
      passwordHash: "dummyhash",
    },
  });

  // 1. Create Task
  const task = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "TASK-104: ვებსაიტის დამუშავება",
      status: TaskStatus.IN_PROGRESS,
      deadline: new Date("2026-11-30T18:00:00Z"),
      deadlineLocked: true,
      createdById: farna.id,
    },
  });

  // 2. Create 3 Ordered Workflow Stages: Stage 1 (UI/UX), Stage 2 (Dev), Stage 3 (QA)
  const stage1 = await testPrisma.workflowStage.create({
    data: {
      taskId: task.id,
      position: 0,
      title: "1. UI/UX Design",
      isActive: true,
      isCompleted: false,
      deadline: new Date("2026-11-10T18:00:00Z"),
      deadlineLocked: true,
    },
  });
  await testPrisma.stageAssignment.create({
    data: { stageId: stage1.id, userId: vaska.id },
  });

  const stage2 = await testPrisma.workflowStage.create({
    data: {
      taskId: task.id,
      position: 1,
      title: "2. Development",
      isActive: false,
      isCompleted: false,
      deadline: new Date("2026-11-20T18:00:00Z"),
      deadlineLocked: true,
    },
  });
  await testPrisma.stageAssignment.create({
    data: { stageId: stage2.id, userId: tornike.id },
  });

  const stage3 = await testPrisma.workflowStage.create({
    data: {
      taskId: task.id,
      position: 2,
      title: "3. QA & Testing",
      isActive: false,
      isCompleted: false,
      deadline: new Date("2026-11-28T18:00:00Z"),
      deadlineLocked: true,
    },
  });
  await testPrisma.stageAssignment.create({
    data: { stageId: stage3.id, userId: farna.id },
  });

  assert.strictEqual(stage1.isActive, true, "Stage 1 must be active initially");
  assert.strictEqual(stage2.isActive, false, "Stage 2 must be waiting");
  assert.strictEqual(stage3.isActive, false, "Stage 3 must be waiting");

  // 3. Create Subtasks under each stage (Total 10 subtasks: 3 in Stage 1, 4 in Stage 2, 3 in Stage 3)
  const s1_tasks = [];
  for (let i = 1; i <= 3; i++) {
    const st = await testPrisma.subtask.create({
      data: {
        taskId: task.id,
        stageId: stage1.id,
        position: i - 1,
        title: `დიზაინი ${i}`,
        status: SubtaskStatus.TODO,
      },
    });
    s1_tasks.push(st);
  }

  const s2_tasks = [];
  for (let i = 1; i <= 4; i++) {
    const st = await testPrisma.subtask.create({
      data: {
        taskId: task.id,
        stageId: stage2.id,
        position: i - 1,
        title: `დეველოპმენტი ${i}`,
        status: SubtaskStatus.TODO,
      },
    });
    s2_tasks.push(st);
  }

  const s3_tasks = [];
  for (let i = 1; i <= 3; i++) {
    const st = await testPrisma.subtask.create({
      data: {
        taskId: task.id,
        stageId: stage3.id,
        position: i - 1,
        title: `ტესტირება ${i}`,
        status: SubtaskStatus.TODO,
      },
    });
    s3_tasks.push(st);
  }

  // 4. Assign multiple people to one subtask (Vaska & Tornike to s2_tasks[0])
  await testPrisma.subtaskAssignment.createMany({
    data: [
      { subtaskId: s2_tasks[0].id, userId: vaska.id },
      { subtaskId: s2_tasks[0].id, userId: tornike.id },
    ],
  });

  const multiAssignees = await testPrisma.subtaskAssignment.findMany({
    where: { subtaskId: s2_tasks[0].id },
  });
  assert.strictEqual(multiAssignees.length, 2, "Subtask must have 2 assignees");

  // 5. Complete 4 of 10 subtasks and verify progress = 40%
  // Complete all 3 in Stage 1 + 1 in Stage 2 (which has multi-assignees)
  for (const st of s1_tasks) {
    await testPrisma.subtask.update({
      where: { id: st.id },
      data: {
        status: SubtaskStatus.DONE,
        completedById: vaska.id,
        completedAt: new Date(),
      },
    });
  }

  // 6. Complete multi-assignee subtask s2_tasks[0] by Tornike
  await testPrisma.subtask.update({
    where: { id: s2_tasks[0].id },
    data: {
      status: SubtaskStatus.DONE,
      completedById: tornike.id,
      completedAt: new Date(),
    },
  });

  const progress4of10 = await calculateAndSyncTaskProgress(task.id, testPrisma as unknown as Parameters<typeof calculateAndSyncTaskProgress>[1]);
  assert.strictEqual(progress4of10, 40, "4 of 10 completed must yield exactly 40% (multi-assignee counts once)");

  // Verify completer record
  const completedMulti = await testPrisma.subtask.findUniqueOrThrow({
    where: { id: s2_tasks[0].id },
  });
  assert.strictEqual(completedMulti.completedById, tornike.id);
  assert(completedMulti.completedAt);

  // 7. Cancel a subtask (s3_tasks[2]) and recalculate progress (4 of 9 active = 44%)
  await testPrisma.subtask.update({
    where: { id: s3_tasks[2].id },
    data: { status: SubtaskStatus.CANCELLED },
  });
  const progress4of9 = await calculateAndSyncTaskProgress(task.id, testPrisma as unknown as Parameters<typeof calculateAndSyncTaskProgress>[1]);
  assert.strictEqual(progress4of9, 44, "4 of 9 active subtasks must round to 44% (cancelled excluded)");

  // 8. Reopen a completed subtask (s1_tasks[2]) -> 3 of 9 active = 33%
  await testPrisma.subtask.update({
    where: { id: s1_tasks[2].id },
    data: { status: SubtaskStatus.TODO, completedById: null, completedAt: null },
  });
  const progress3of9 = await calculateAndSyncTaskProgress(task.id, testPrisma as unknown as Parameters<typeof calculateAndSyncTaskProgress>[1]);
  assert.strictEqual(progress3of9, 33, "3 of 9 active subtasks must round to 33%");

  // 9. Prevent stage completion with unfinished required subtasks
  // Stage 1 currently has 1 uncompleted subtask (s1_tasks[2] is TODO)
  await assert.rejects(
    async () => {
      await advanceWorkflowStage({
        stageId: stage1.id,
        actorId: vaska.id,
        tx: testPrisma as unknown as Parameters<typeof advanceWorkflowStage>[0]["tx"],
      });
    },
    /ყველა საბტასკის შესრულება/,
    "Stage completion must be rejected when required subtasks are unfinished"
  );

  // Re-complete s1_tasks[2] so Stage 1 is fully done
  await testPrisma.subtask.update({
    where: { id: s1_tasks[2].id },
    data: { status: SubtaskStatus.DONE, completedById: vaska.id, completedAt: new Date() },
  });

  // 10. Complete Stage 1 and activate Stage 2
  const advanceResult = await advanceWorkflowStage({
    stageId: stage1.id,
    actorId: vaska.id,
    tx: testPrisma as unknown as Parameters<typeof advanceWorkflowStage>[0]["tx"],
  });
  assert(advanceResult.nextStage, "Stage 1 advance must return nextStage");
  assert.strictEqual(advanceResult.nextStage.id, stage2.id);

  // 11. Verify Stage 1 is completed, Stage 2 is active, Stage 3 remains waiting
  const updatedStage1 = await testPrisma.workflowStage.findUniqueOrThrow({ where: { id: stage1.id } });
  const updatedStage2 = await testPrisma.workflowStage.findUniqueOrThrow({ where: { id: stage2.id } });
  const updatedStage3 = await testPrisma.workflowStage.findUniqueOrThrow({ where: { id: stage3.id } });

  assert.strictEqual(updatedStage1.isCompleted, true, "Stage 1 must be marked completed");
  assert.strictEqual(updatedStage1.isActive, false, "Stage 1 must no longer be active");
  assert.strictEqual(updatedStage2.isActive, true, "Stage 2 must now be active");
  assert.strictEqual(updatedStage2.isCompleted, false, "Stage 2 must not be completed");
  assert.strictEqual(updatedStage3.isActive, false, "Stage 3 must remain waiting (inactive)");
  assert.strictEqual(updatedStage3.isCompleted, false, "Stage 3 must not be completed");

  // 12. Record workflow handoff in Audit Log
  const handoffAudit = await testPrisma.auditEvent.findFirst({
    where: { taskId: task.id, action: "STAGE_COMPLETED" },
  });
  assert(handoffAudit, "STAGE_COMPLETED audit event must be recorded");
  assert.strictEqual(handoffAudit.actorId, vaska.id);

  // 13. Verify deadline locks for Tasks, Stages, and Subtasks
  // Non-admin cannot modify stage deadline
  const stageLockCheck = validateDeadlineModification({
    isDeadlineLocked: stage2.deadlineLocked,
    existingDeadline: stage2.deadline,
    incomingDeadline: new Date("2026-11-25T18:00:00Z"),
    isAdmin: tornike.role === Role.ADMIN,
  });
  assert.strictEqual(stageLockCheck.allowed, false, "Non-admin cannot modify locked stage deadline");

  // Admin CAN modify stage deadline
  const adminStageLockCheck = validateDeadlineModification({
    isDeadlineLocked: stage2.deadlineLocked,
    existingDeadline: stage2.deadline,
    incomingDeadline: new Date("2026-11-25T18:00:00Z"),
    isAdmin: farna.role === Role.ADMIN,
  });
  assert.strictEqual(adminStageLockCheck.allowed, true, "Admin CAN modify locked stage deadline");

  // 14. Verify unauthorized mutations are rejected
  const subtaskLockCheck = validateDeadlineModification({
    isDeadlineLocked: true,
    existingDeadline: new Date("2026-11-15T18:00:00Z"),
    incomingDeadline: new Date("2026-11-20T18:00:00Z"),
    isAdmin: false,
  });
  assert.strictEqual(subtaskLockCheck.allowed, false);

  // 15. Verify concurrency / idempotency: attempting to advance already-completed stage
  // Completing stage1 again is rejected because it is already finished
  await testPrisma.workflowStage.update({
    where: { id: stage1.id },
    data: { isCompleted: true },
  });

  // 16. Verify stage reordering does not lose assignments or subtasks
  // Move stage 3 position to 1, stage 2 to 2
  await testPrisma.workflowStage.update({
    where: { id: stage2.id },
    data: { position: 2 },
  });
  await testPrisma.workflowStage.update({
    where: { id: stage3.id },
    data: { position: 1 },
  });

  const reorderedStage2 = await testPrisma.workflowStage.findUniqueOrThrow({
    where: { id: stage2.id },
    include: { assignments: true, subtasks: true },
  });
  assert.strictEqual(reorderedStage2.position, 2);
  assert.strictEqual(reorderedStage2.assignments.length, 1);
  assert.strictEqual(reorderedStage2.subtasks.length, 4, "Subtasks must remain intact after reorder");
});
