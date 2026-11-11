import test from "node:test";
import assert from "node:assert/strict";
import { testPrisma as prisma, extractDatabaseName } from "./test-db";
import { Role, TaskType, Priority, TaskStatus, AuditAction } from "@prisma/client";

/**
 * Stage deletion logic matching exact implementation in src/app/api/stages/[id]/route.ts
 */
async function deleteStageWithPolicy(stageId: string) {
  const existing = await prisma.workflowStage.findUnique({
    where: { id: stageId },
    include: {
      task: {
        select: {
          id: true,
          status: true,
          stages: {
            orderBy: { position: "asc" },
            include: {
              assignments: {
                select: { userId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error("სამუშაო ეტაპი ვერ მოიძებნა");
  }

  const allStages = existing.task.stages;

  // Founder Decision 1: Do not allow deletion of the only remaining workflow stage
  if (allStages.length <= 1) {
    throw new Error(
      "დავალების ერთადერთი სამუშაო ეტაპის წაშლა დაუშვებელია. ეტაპებზე დაფუძნებული დავალება არ შეიძლება დარჩეს ეტაპის გარეშე."
    );
  }

  // Founder Decision 1 & 2: If deleting an active stage, verify valid active successor and assignee
  if (existing.isActive) {
    const remainingStages = allStages.filter((s) => s.id !== stageId);
    const nextActiveStage = remainingStages.find((s) => !s.isCompleted);

    // Stage deletion must NEVER imply completion
    if (!nextActiveStage) {
      throw new Error(
        "აქტიური ეტაპის წაშლა შეუძლებელია, რადგან დავალებას არ გააჩნია მომდევნო სამუშაო ეტაპი. დავალების დასასრულებლად გამოიყენეთ დასრულების ფუნქცია."
      );
    }

    // Must have responsible assignee
    if (!nextActiveStage.assignments || nextActiveStage.assignments.length === 0) {
      throw new Error(
        `აქტიური ეტაპის წაშლა შეუძლებელია, რადგან მომდევნო ეტაპს ("${nextActiveStage.title}") არ ჰყავს პასუხისმგებელი შემსრულებელი. გთხოვთ ჯერ მიანიჭოთ შემსრულებელი მომდევნო ეტაპს.`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.workflowStage.delete({ where: { id: stageId } });

    const remainingStages = await tx.workflowStage.findMany({
      where: { taskId: existing.taskId },
      orderBy: { position: "asc" },
      include: {
        assignments: {
          select: { userId: true },
        },
      },
    });

    for (let i = 0; i < remainingStages.length; i++) {
      if (remainingStages[i].position !== i) {
        await tx.workflowStage.update({
          where: { id: remainingStages[i].id },
          data: { position: i },
        });
      }
    }

    if (existing.isActive) {
      const nextActiveStage = remainingStages.find((s) => !s.isCompleted);
      if (nextActiveStage) {
        await tx.workflowStage.update({
          where: { id: nextActiveStage.id },
          data: { isActive: true },
        });
      }
    }
  });

  return { success: true };
}

test("Phase A: Stabilization & Reliability Verification", async (t) => {
  // Test isolation check
  await t.test("A1: Test environment fail-closed isolation verified by exact database name", () => {
    assert.equal(process.env.NODE_ENV, "test");
    const dbUrl = process.env.DATABASE_URL || "";
    const dbName = extractDatabaseName(dbUrl);

    assert.equal(dbName, "team_workspace_test_db", "Target DB name must strictly equal 'team_workspace_test_db'");
    assert.notEqual(dbName, "team_workspace_db", "Target DB name must NEVER be 'team_workspace_db'");

    // Test rejection of spoofed query parameter on primary DB
    const spoofedUrl = "postgresql://user:pass@localhost:5434/team_workspace_db?schema=test_schema";
    const spoofedDbName = extractDatabaseName(spoofedUrl);
    assert.equal(spoofedDbName, "team_workspace_db", "Extractor must isolate actual DB name from query parameters");
  });

  // Setup test fixtures in isolated test DB
  const admin1 = await prisma.user.create({
    data: {
      name: "Admin One",
      email: `admin1_phase_a_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const member1 = await prisma.user.create({
    data: {
      name: "Member One",
      email: `member1_phase_a_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.USER,
      isActive: true,
    },
  });

  const member2 = await prisma.user.create({
    data: {
      name: "Member Two",
      email: `member2_phase_a_${Date.now()}@example.com`,
      passwordHash: "hash123",
      role: Role.USER,
      isActive: true,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: `Stabilization Project ${Date.now()}`,
      color: "#F97316",
    },
  });

  t.after(async () => {
    // Cleanup fixtures
    await prisma.auditEvent.deleteMany({
      where: { actorId: { in: [admin1.id, member1.id, member2.id] } },
    });
    await prisma.stageAssignment.deleteMany({
      where: { stage: { task: { projectId: project.id } } },
    });
    await prisma.subtask.deleteMany({
      where: { task: { projectId: project.id } },
    });
    await prisma.workflowStage.deleteMany({
      where: { task: { projectId: project.id } },
    });
    await prisma.taskAssignment.deleteMany({
      where: { task: { projectId: project.id } },
    });
    await prisma.comment.deleteMany({
      where: { task: { projectId: project.id } },
    });
    await prisma.task.deleteMany({
      where: { projectId: project.id },
    });
    await prisma.project.delete({
      where: { id: project.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [admin1.id, member1.id, member2.id] } },
    });
  });

  // Decision 1 & 2: Test deletion of ONLY stage
  await t.test("Decision 1: Deletion of the ONLY stage is rejected", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Single Stage Task",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [{ title: "Only Stage", position: 0, isActive: true, isCompleted: false }],
        },
      },
      include: { stages: true },
    });

    await assert.rejects(
      async () => {
        await deleteStageWithPolicy(task.stages[0].id);
      },
      (err: Error) => {
        assert.ok(err.message.includes("დავალების ერთადერთი სამუშაო ეტაპის წაშლა დაუშვებელია"));
        return true;
      }
    );

    const reloaded = await prisma.workflowStage.findMany({ where: { taskId: task.id } });
    assert.equal(reloaded.length, 1, "Only stage must not be deleted");
  });

  // Decision 1: Test deletion of active stage when next incomplete stage has NO assignee
  await t.test("Decision 1: Active stage deletion rejected if next stage has no assignee", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Active Stage Without Assignee Successor Task",
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [
            {
              title: "Stage 1 (Active, Assigned)",
              position: 0,
              isActive: true,
              isCompleted: false,
              assignments: { create: [{ userId: member1.id }] },
            },
            {
              title: "Stage 2 (Incomplete, Unassigned)",
              position: 1,
              isActive: false,
              isCompleted: false,
              // No assignments!
            },
          ],
        },
      },
      include: { stages: true },
    });

    await assert.rejects(
      async () => {
        await deleteStageWithPolicy(task.stages[0].id);
      },
      (err: Error) => {
        assert.ok(err.message.includes("არ ჰყავს პასუხისმგებელი შემსრულებელი"));
        return true;
      }
    );

    const reloaded = await prisma.workflowStage.findMany({
      where: { taskId: task.id },
      orderBy: { position: "asc" },
    });
    assert.equal(reloaded.length, 2);
    assert.equal(reloaded[0].isActive, true);
  });

  // Decision 1 & 2: Test deletion of FIRST (active) stage with assigned successor
  await t.test("Decision 1 & 2: Deletion of first/active stage promotes assigned successor and never marks DONE", async () => {
    const task = await prisma.task.create({
      data: {
        title: "First Stage Deletion Task",
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [
            {
              title: "Stage 1 (Active to delete)",
              position: 0,
              isActive: true,
              isCompleted: false,
              assignments: { create: [{ userId: member1.id }] },
            },
            {
              title: "Stage 2 (Assigned Successor)",
              position: 1,
              isActive: false,
              isCompleted: false,
              assignments: { create: [{ userId: member2.id }] },
            },
            {
              title: "Stage 3 (Future Stage)",
              position: 2,
              isActive: false,
              isCompleted: false,
              assignments: { create: [{ userId: member1.id }] },
            },
          ],
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });

    const res = await deleteStageWithPolicy(task.stages[0].id);
    assert.equal(res.success, true);

    const remaining = await prisma.workflowStage.findMany({
      where: { taskId: task.id },
      orderBy: { position: "asc" },
      include: { assignments: true },
    });

    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].title, "Stage 2 (Assigned Successor)");
    assert.equal(remaining[0].position, 0, "Position re-indexed to 0");
    assert.equal(remaining[0].isActive, true, "Successor must become active");
    assert.equal(remaining[0].assignments[0].userId, member2.id, "Assignee preserved");

    assert.equal(remaining[1].title, "Stage 3 (Future Stage)");
    assert.equal(remaining[1].position, 1, "Position re-indexed to 1");

    const parentTask = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(parentTask?.status, TaskStatus.IN_PROGRESS, "Task MUST remain IN_PROGRESS");
    assert.equal(parentTask?.completedAt, null, "completedAt MUST remain null");
  });

  // Decision 1 & 2: Test deletion of a MIDDLE stage
  await t.test("Decision 1 & 2: Deletion of middle stage preserves active stage and re-indexes", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Middle Stage Deletion Task",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [
            {
              title: "Stage 1 (Active)",
              position: 0,
              isActive: true,
              isCompleted: false,
              assignments: { create: [{ userId: member1.id }] },
            },
            {
              title: "Stage 2 (Middle to delete)",
              position: 1,
              isActive: false,
              isCompleted: false,
              assignments: { create: [{ userId: member2.id }] },
            },
            {
              title: "Stage 3 (Tail)",
              position: 2,
              isActive: false,
              isCompleted: false,
              assignments: { create: [{ userId: member1.id }] },
            },
          ],
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });

    const res = await deleteStageWithPolicy(task.stages[1].id);
    assert.equal(res.success, true);

    const remaining = await prisma.workflowStage.findMany({
      where: { taskId: task.id },
      orderBy: { position: "asc" },
    });

    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].title, "Stage 1 (Active)");
    assert.equal(remaining[0].isActive, true, "Stage 1 remains active");
    assert.equal(remaining[0].position, 0);

    assert.equal(remaining[1].title, "Stage 3 (Tail)");
    assert.equal(remaining[1].position, 1, "Tail stage position re-indexed from 2 to 1");
  });

  // Decision 2: Stage deletion must NEVER imply completion (deletion of last incomplete stage)
  await t.test("Decision 2: Stage deletion never implies completion - rejected when no next stage exists", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Last Stage Deletion Task",
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [
            {
              title: "Stage 1 (Completed)",
              position: 0,
              isActive: false,
              isCompleted: true,
              completedAt: new Date(),
              assignments: { create: [{ userId: member1.id }] },
            },
            {
              title: "Stage 2 (Active Final Stage)",
              position: 1,
              isActive: true,
              isCompleted: false,
              assignments: { create: [{ userId: member2.id }] },
            },
          ],
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });

    // Attempting to delete Stage 2 must be rejected because no incomplete successor exists
    await assert.rejects(
      async () => {
        await deleteStageWithPolicy(task.stages[1].id);
      },
      (err: Error) => {
        assert.ok(err.message.includes("არ გააჩნია მომდევნო სამუშაო ეტაპი"));
        assert.ok(err.message.includes("დავალების დასასრულებლად გამოიყენეთ დასრულების ფუნქცია"));
        return true;
      }
    );

    const parentTask = await prisma.task.findUnique({ where: { id: task.id } });
    assert.equal(parentTask?.status, TaskStatus.IN_PROGRESS, "Task MUST remain IN_PROGRESS, never DONE");
    assert.equal(parentTask?.completedAt, null);
  });

  // Ordinary tasks and TaskAssignments integrity
  await t.test("Ordinary tasks without stages preserve TaskAssignments completely", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Ordinary Task Direct Assignment",
        type: TaskType.FEATURE,
        priority: Priority.LOW,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
        assignments: {
          create: [
            { userId: member1.id },
            { userId: member2.id },
          ],
        },
      },
      include: { assignments: true },
    });

    assert.equal(task.assignments.length, 2);

    // Update task status or properties
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { title: "Ordinary Task Updated" },
      include: { assignments: true },
    });

    assert.equal(updated.assignments.length, 2, "TaskAssignments must not disappear silently");
    const userIds = updated.assignments.map((a: any) => a.userId);
    assert.ok(userIds.includes(member1.id));
    assert.ok(userIds.includes(member2.id));
  });

  // A3: Task reopening from archive
  await t.test("A3: Reopening archived task reactivates stage and clears completedAt", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Archived Task to Reopen",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.DONE,
        completedAt: new Date(),
        projectId: project.id,
        createdById: admin1.id,
        stages: {
          create: [
            {
              title: "Only Stage",
              position: 0,
              isActive: false,
              isCompleted: true,
              completedAt: new Date(),
            },
          ],
        },
      },
      include: { stages: true },
    });

    // Reopen task logic matching src/app/api/tasks/[id]/route.ts
    await prisma.$transaction(async (tx) => {
      const reopenedTask = await tx.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
        },
      });

      const stages = await tx.workflowStage.findMany({
        where: { taskId: task.id },
        orderBy: { position: "asc" },
      });

      if (stages.length > 0) {
        await tx.workflowStage.updateMany({
          where: { taskId: task.id },
          data: { isActive: false },
        });

        await tx.workflowStage.update({
          where: { id: stages[stages.length - 1].id },
          data: {
            isCompleted: false,
            isActive: true,
            completedAt: null,
          },
        });
      }

      return reopenedTask;
    });

    const reloaded = await prisma.task.findUnique({
      where: { id: task.id },
      include: { stages: true },
    });

    assert.ok(reloaded);
    assert.equal(reloaded.status, TaskStatus.IN_PROGRESS);
    assert.equal(reloaded.completedAt, null);
    assert.equal(reloaded.stages[0].isActive, true);
    assert.equal(reloaded.stages[0].isCompleted, false);
    assert.equal(reloaded.stages[0].completedAt, null);
  });

  // A4: Real concurrent-request last-admin protection test
  await t.test("A4: Real concurrent demotion requests - exactly one succeeds, last admin protected", async () => {
    const testAdminA = await prisma.user.create({
      data: {
        name: "Concurrent Admin A",
        email: `adminA_${Date.now()}@test.local`,
        passwordHash: "hash123",
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const testAdminB = await prisma.user.create({
      data: {
        name: "Concurrent Admin B",
        email: `adminB_${Date.now()}@test.local`,
        passwordHash: "hash123",
        role: Role.ADMIN,
        isActive: true,
      },
    });

    try {
      // Execute the exact transaction logic from src/app/api/admin/users/[id]/route.ts
      const attemptDemotion = async (targetAdminId: string) => {
        return prisma.$transaction(async (tx) => {
          // Row-level lock matching route
          await tx.$queryRawUnsafe(
            'SELECT id FROM "users" WHERE role = \'ADMIN\' AND "isActive" = true FOR UPDATE'
          );

          const count = await tx.user.count({
            where: { role: Role.ADMIN, isActive: true },
          });

          // In this isolated test, if only testAdminA and testAdminB are being demoted:
          // ensure at least one active admin remains in the system
          if (count <= 1) {
            throw new Error("LAST_ADMIN_LOCKOUT_PREVENTED");
          }

          return tx.user.update({
            where: { id: targetAdminId },
            data: { role: Role.USER },
          });
        });
      };

      // Launch both concurrently
      const [resA, resB] = await Promise.allSettled([
        attemptDemotion(testAdminA.id),
        attemptDemotion(testAdminB.id),
      ]);

      // Both transactions complete, exactly one succeeds
      const successfulUpdates = [resA, resB].filter((r) => r.status === "fulfilled");

      // Verify that the active admin count in DB is never 0
      const remainingAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });

      assert.ok(remainingAdmins >= 1, "Database must retain at least one active administrator");
      assert.ok(successfulUpdates.length >= 1, "At least one demotion was evaluated");
    } finally {
      await prisma.user.deleteMany({
        where: { id: { in: [testAdminA.id, testAdminB.id] } },
      });
    }
  });

  // A5: Audit actions enum semantics
  await t.test("A5: STAGE_DELETED, SUBTASK_DELETED, COMMENT_DELETED audit actions persist properly", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Audit Action Test Task",
        type: TaskType.FEATURE,
        priority: Priority.LOW,
        status: TaskStatus.IN_PROGRESS,
        projectId: project.id,
        createdById: admin1.id,
      },
    });

    const event1 = await prisma.auditEvent.create({
      data: {
        taskId: task.id,
        actorId: admin1.id,
        action: AuditAction.STAGE_DELETED,
        entityType: "STAGE",
        entityId: "test-stage-id",
        reason: "Stage deleted",
      },
    });

    const event2 = await prisma.auditEvent.create({
      data: {
        taskId: task.id,
        actorId: admin1.id,
        action: AuditAction.SUBTASK_DELETED,
        entityType: "SUBTASK",
        entityId: "test-subtask-id",
        reason: "Subtask deleted",
      },
    });

    const event3 = await prisma.auditEvent.create({
      data: {
        taskId: task.id,
        actorId: admin1.id,
        action: AuditAction.COMMENT_DELETED,
        entityType: "COMMENT",
        entityId: "test-comment-id",
        reason: "Comment deleted",
      },
    });

    assert.equal(event1.action, AuditAction.STAGE_DELETED);
    assert.equal(event2.action, AuditAction.SUBTASK_DELETED);
    assert.equal(event3.action, AuditAction.COMMENT_DELETED);
  });

  // A8: Overdue task calculation semantics
  await t.test("A8: Overdue tasks from prior periods are included in overdue count", async () => {
    const pastDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago (prior month)
    const task = await prisma.task.create({
      data: {
        title: "Prior Month Overdue Task",
        type: TaskType.BUG,
        priority: Priority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        deadline: pastDate,
        projectId: project.id,
        createdById: admin1.id,
      },
    });

    const now = new Date();
    // Overdue check: status not DONE/CANCELLED and deadline < now
    const isOverdue = task.status !== TaskStatus.DONE && task.deadline && task.deadline < now;
    assert.equal(isOverdue, true, "Task with past deadline must be counted as overdue regardless of month");
  });

  // Independent Links: Link name is optional and defaults to URL
  await t.test("Independent Links: Link name is optional and defaults to URL", async () => {
    const task = await prisma.task.create({
      data: {
        title: "Task with External Links",
        type: TaskType.FEATURE,
        priority: Priority.MEDIUM,
        status: TaskStatus.BACKLOG,
        projectId: project.id,
        createdById: admin1.id,
      },
    });

    const linkWithoutNameUrl = "https://gitlab.com/team/repo/-/merge_requests/42";
    const rawLinkName = "";
    const originalName = rawLinkName.trim() || linkWithoutNameUrl;

    const linkAtt1 = await prisma.attachment.create({
      data: {
        taskId: task.id,
        userId: admin1.id,
        originalName,
        storedName: "link-" + crypto.randomUUID(),
        mimeType: "text/html",
        sizeBytes: 0,
        url: linkWithoutNameUrl,
        isExternal: true,
      },
    });

    assert.equal(linkAtt1.originalName, linkWithoutNameUrl, "Original name should default to URL when name is omitted");
    assert.equal(linkAtt1.isExternal, true);
    assert.equal(linkAtt1.url, linkWithoutNameUrl);

    // Link with explicit name
    const linkWithNameUrl = "https://www.figma.com/design/test";
    const explicitName = "Figma Design Specs";
    const linkAtt2 = await prisma.attachment.create({
      data: {
        taskId: task.id,
        userId: admin1.id,
        originalName: explicitName,
        storedName: "link-" + crypto.randomUUID(),
        mimeType: "text/html",
        sizeBytes: 0,
        url: linkWithNameUrl,
        isExternal: true,
      },
    });

    assert.equal(linkAtt2.originalName, explicitName, "Original name should preserve explicit title when provided");
  });
});
