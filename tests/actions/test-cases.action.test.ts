import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import {
  AuditAction,
  Department,
  Priority,
  Role,
  SubtaskStatus,
  TaskStatus,
  TaskType,
  TestRunStatus,
} from '@prisma/client';
import { testPrisma } from '../test-db';
import { calculateAndSyncTaskProgress } from '@/lib/workflow';
import { listTaskTestCasesAction } from '@/server/actions/test-cases/list-test-cases.action';
import { getTestCaseAction } from '@/server/actions/test-cases/get-test-case.action';
import { createTestCaseAction } from '@/server/actions/test-cases/create-test-case.action';
import { updateTestCaseAction } from '@/server/actions/test-cases/update-test-case.action';
import { deleteTestCaseAction } from '@/server/actions/test-cases/delete-test-case.action';
import { createTestRunAction } from '@/server/actions/test-cases/create-test-run.action';
import { createTestCaseDto, createTestRunDto } from '@/server/dto/test-case.dto';

test('Actions: Manual Testing Cases, Runs, Snapshots, Permissions & Independence', async (t) => {
  const ts = Date.now();
  const passwordHash = await bcrypt.hash('TestSecret123!', 10);

  const admin = await testPrisma.user.create({
    data: {
      email: `qa_admin_${ts}@team.local`,
      name: `ადმინი ტესტ (${ts})`,
      role: Role.ADMIN,
      department: Department.DEVELOPMENT,
      passwordHash,
      isActive: true,
    },
  });

  const creatorUser = await testPrisma.user.create({
    data: {
      email: `qa_creator_${ts}@team.local`,
      name: `ნათელა ტესტ (${ts})`,
      role: Role.USER,
      department: Department.CONTENT,
      passwordHash,
      isActive: true,
    },
  });

  const otherUser = await testPrisma.user.create({
    data: {
      email: `qa_other_${ts}@team.local`,
      name: `გიორგი ტესტ (${ts})`,
      role: Role.USER,
      department: Department.QA,
      passwordHash,
      isActive: true,
    },
  });

  const inactiveUser = await testPrisma.user.create({
    data: {
      email: `qa_inactive_${ts}@team.local`,
      name: `გაუქმებული მომხმარებელი (${ts})`,
      role: Role.USER,
      department: Department.QA,
      passwordHash,
      isActive: false,
    },
  });

  const project = await testPrisma.project.create({
    data: {
      name: `Manual Testing Project ${ts}`,
      color: '#EA580C',
    },
  });

  const mainTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: `დავალება ხელით ტესტირებისთვის ${ts}`,
      description: 'ძირითადი დავალება',
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      department: Department.DEVELOPMENT,
      status: TaskStatus.IN_PROGRESS,
      progress: 0,
      createdById: admin.id,
    },
  });

  const foreignTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: `სხვა დავალება ${ts}`,
      type: TaskType.FEATURE,
      priority: Priority.LOW,
      department: Department.DEVELOPMENT,
      status: TaskStatus.BACKLOG,
      createdById: admin.id,
    },
  });

  const evidenceLink = await testPrisma.attachment.create({
    data: {
      taskId: mainTask.id,
      userId: creatorUser.id,
      originalName: 'PR #42 მტკიცებულება',
      storedName: `link_${ts}`,
      mimeType: 'text/html',
      sizeBytes: 0,
      url: 'https://example.com/pr-42',
      isExternal: true,
    },
  });

  const foreignAttachment = await testPrisma.attachment.create({
    data: {
      taskId: foreignTask.id,
      userId: admin.id,
      originalName: 'უცხო დავალების ბმული',
      storedName: `foreign_${ts}`,
      mimeType: 'text/html',
      sizeBytes: 0,
      url: 'https://example.com/foreign',
      isExternal: true,
    },
  });

  // Subtasks on mainTask to verify subtask progress independence (1 DONE + 1 TODO => 50%)
  const st1 = await testPrisma.subtask.create({
    data: {
      taskId: mainTask.id,
      title: 'საბტასკი 1',
      status: SubtaskStatus.DONE,
      position: 0,
    },
  });
  const st2 = await testPrisma.subtask.create({
    data: {
      taskId: mainTask.id,
      title: 'საბტასკი 2',
      status: SubtaskStatus.TODO,
      position: 1,
    },
  });
  await calculateAndSyncTaskProgress(mainTask.id);

  let primaryCaseId = '';
  let deletableByCreatorId = '';
  let deletableByAdminId = '';

  t.after(async () => {
    await testPrisma.auditEvent.deleteMany({
      where: {
        OR: [
          { taskId: mainTask.id },
          { taskId: foreignTask.id },
          { actorId: { in: [admin.id, creatorUser.id, otherUser.id, inactiveUser.id] } },
        ],
      },
    });
    await testPrisma.task.deleteMany({ where: { id: { in: [mainTask.id, foreignTask.id] } } });
    await testPrisma.project.deleteMany({ where: { id: project.id } });
    await testPrisma.user.deleteMany({
      where: { id: { in: [admin.id, creatorUser.id, otherUser.id, inactiveUser.id] } },
    });
  });

  await t.test('1. Task without test cases returns empty array cleanly', async () => {
    const cases = await listTaskTestCasesAction(mainTask.id, creatorUser);
    assert.deepStrictEqual(cases, []);
  });

  await t.test('2. DTO rejects invalid inputs and missing failure/block reason', async () => {
    assert.throws(() => createTestCaseDto.parse({ title: '  ', steps: [] }));
    assert.throws(() =>
      createTestCaseDto.parse({
        title: 'სათაური',
        steps: [],
      })
    );

    assert.throws(
      () =>
        createTestRunDto.parse({
          status: TestRunStatus.FAILED,
          actualResult: 'შეცდომა',
          reason: '   ',
        }),
      /ჩავარდნის ან დაბლოკვის დროს მიზეზის მითითება სავალდებულოა/
    );

    assert.throws(
      () =>
        createTestRunDto.parse({
          status: TestRunStatus.BLOCKED,
        }),
      /ჩავარდნის ან დაბლოკვის დროს მიზეზის მითითება სავალდებულოა/
    );
  });

  await t.test('3. Regular USER creates test case with ordered steps and re-opens it', async () => {
    const input = createTestCaseDto.parse({
      title: 'ავტორიზაციის ფორმის შემოწმება',
      precondition: 'მომხმარებელი გასულია სისტემიდან',
      steps: [
        {
          action: 'შეიყვანეთ ელ-ფოსტა და პაროლი',
          testData: 'natela@gmail.com / 123456',
          expectedResult: 'ველები ივსება ვალიდაციის შეცდომის გარეშე',
        },
        {
          action: 'დააჭირეთ შესვლის ღილაკს',
          expectedResult: 'იხსნება სამუშაო სივრცის მთავარი გვერდი',
        },
      ],
    });

    const created = await createTestCaseAction(mainTask.id, input, creatorUser);
    primaryCaseId = created.id;

    assert.strictEqual(created.title, 'ავტორიზაციის ფორმის შემოწმება');
    assert.strictEqual(created.precondition, 'მომხმარებელი გასულია სისტემიდან');
    assert.strictEqual(created.steps.length, 2);
    assert.strictEqual(created.steps[0].position, 0);
    assert.strictEqual(created.steps[0].testData, 'natela@gmail.com / 123456');
    assert.strictEqual(created.steps[1].position, 1);
    assert.strictEqual(created.steps[1].testData, null);
    assert.strictEqual(created.latestRun, null);

    const reopened = await getTestCaseAction(primaryCaseId, otherUser);
    assert.strictEqual(reopened.id, primaryCaseId);
    assert.strictEqual(reopened.steps[0].action, 'შეიყვანეთ ელ-ფოსტა და პაროლი');
    assert.strictEqual(reopened.steps[1].action, 'დააჭირეთ შესვლის ღილაკს');
  });

  await t.test('4. Evidence from another task is rejected', async () => {
    const payload = createTestRunDto.parse({
      status: TestRunStatus.PASSED,
      attachmentIds: [foreignAttachment.id],
    });

    await assert.rejects(
      async () => createTestRunAction(primaryCaseId, payload, creatorUser),
      /მტკიცებულების ფაილი ვერ მოიძებნა ან არ ეკუთვნის ამ დავალებას/
    );
  });

  await t.test(
    '5. Repeated runs: FAILED with reason + evidence then PASSED; list shows latest, history shows both',
    async () => {
      const createdCase = await getTestCaseAction(primaryCaseId, creatorUser);

      // Run #1: FAILED with reason + evidence
      const run1Payload = createTestRunDto.parse({
        status: TestRunStatus.FAILED,
        actualResult: 'შესვლის ღილაკმა დააბრუნა 500 სერვერის შეცდომა',
        reason: 'სესიის ქუქი არ შეიქმნა',
        stepResults: [
          { stepId: createdCase.steps[0].id, position: 0, status: 'PASSED' },
          {
            stepId: createdCase.steps[1].id,
            position: 1,
            status: 'FAILED',
            actualNote: 'HTTP 500 Login Route',
          },
        ],
        attachmentIds: [evidenceLink.id],
      });

      const run1 = await createTestRunAction(primaryCaseId, run1Payload, otherUser);
      assert.strictEqual(run1.runNumber, 1);
      assert.strictEqual(run1.status, TestRunStatus.FAILED);
      assert.strictEqual(run1.reason, 'სესიის ქუქი არ შეიქმნა');
      assert.strictEqual(run1.evidences.length, 1);
      assert.strictEqual(run1.evidences[0].attachmentId, evidenceLink.id);
      assert.strictEqual(run1.executedBy.id, otherUser.id);
      assert.strictEqual(run1.stepsSnapshot.length, 2);
      assert.strictEqual(run1.stepsSnapshot[1].status, 'FAILED');
      assert.strictEqual(run1.stepsSnapshot[1].actualNote, 'HTTP 500 Login Route');

      // Run #2: BLOCKED
      const run2Payload = createTestRunDto.parse({
        status: TestRunStatus.BLOCKED,
        reason: 'ბაზის სერვერი დროებით გათიშული იყო',
      });
      const run2 = await createTestRunAction(primaryCaseId, run2Payload, creatorUser);
      assert.strictEqual(run2.runNumber, 2);
      assert.strictEqual(run2.status, TestRunStatus.BLOCKED);

      // Run #3: PASSED
      const run3Payload = createTestRunDto.parse({
        status: TestRunStatus.PASSED,
        actualResult: 'ხარვეზი გასწორდა, ავტორიზაცია წარმატებულია',
        stepResults: [
          { stepId: createdCase.steps[0].id, position: 0, status: 'PASSED' },
          { stepId: createdCase.steps[1].id, position: 1, status: 'PASSED' },
        ],
      });
      const run3 = await createTestRunAction(primaryCaseId, run3Payload, admin);
      assert.strictEqual(run3.runNumber, 3);
      assert.strictEqual(run3.status, TestRunStatus.PASSED);

      // Check list summary shows latestRun (Run #3 PASSED)
      const list = await listTaskTestCasesAction(mainTask.id, creatorUser);
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].runsCount, 3);
      assert.strictEqual(list[0].latestRun?.status, TestRunStatus.PASSED);
      assert.strictEqual(list[0].latestRun?.runNumber, 3);

      // Check detail history contains all 3 runs in descending order
      const detail = await getTestCaseAction(primaryCaseId, creatorUser);
      assert.deepStrictEqual(
        detail.runs.map((r) => r.runNumber),
        [3, 2, 1]
      );
      assert.strictEqual(detail.runs[2].status, TestRunStatus.FAILED);
      assert.strictEqual(detail.runs[2].evidences[0].originalName, 'PR #42 მტკიცებულება');
    }
  );

  await t.test(
    '6. Snapshot immutability: editing test case steps does not alter historical run snapshots',
    async () => {
      const updated = await updateTestCaseAction(
        primaryCaseId,
        {
          title: 'განახლებული სათაური v2',
          precondition: 'განახლებული წინაპირობა v2',
          steps: [
            {
              action: 'სრულიად ახალი ნაბიჯი',
              testData: 'ახალი მონაცემი',
              expectedResult: 'ახალი მოსალოდნელი შედეგი',
            },
          ],
        },
        otherUser
      );

      assert.strictEqual(updated.title, 'განახლებული სათაური v2');
      assert.strictEqual(updated.steps.length, 1);
      assert.strictEqual(updated.steps[0].action, 'სრულიად ახალი ნაბიჯი');

      // Verify old Run #1 still holds the original title, precondition, and 2 steps verbatim
      const oldRun1 = updated.runs.find((r) => r.runNumber === 1);
      assert.ok(oldRun1);
      assert.strictEqual(oldRun1.caseTitleSnapshot, 'ავტორიზაციის ფორმის შემოწმება');
      assert.strictEqual(oldRun1.preconditionSnapshot, 'მომხმარებელი გასულია სისტემიდან');
      assert.strictEqual(oldRun1.stepsSnapshot.length, 2);
      assert.strictEqual(oldRun1.stepsSnapshot[0].action, 'შეიყვანეთ ელ-ფოსტა და პაროლი');
      assert.strictEqual(oldRun1.stepsSnapshot[0].testData, 'natela@gmail.com / 123456');
      assert.strictEqual(
        oldRun1.stepsSnapshot[1].expectedResult,
        'იხსნება სამუშაო სივრცის მთავარი გვერდი'
      );
    }
  );

  await t.test('7. Permissions: inactive users blocked; only creator or ADMIN can delete', async () => {
    const tcInput = createTestCaseDto.parse({
      title: 'უფლებების შესამოწმებელი ქეისი',
      steps: [{ action: 'ნაბიჯი A', expectedResult: 'შედეგი A' }],
    });

    const c1 = await createTestCaseAction(mainTask.id, tcInput, creatorUser);
    deletableByCreatorId = c1.id;

    const c2 = await createTestCaseAction(mainTask.id, tcInput, creatorUser);
    deletableByAdminId = c2.id;

    // Inactive user denied everywhere
    await assert.rejects(() => listTaskTestCasesAction(mainTask.id, inactiveUser));
    await assert.rejects(() => createTestCaseAction(mainTask.id, tcInput, inactiveUser));
    await assert.rejects(() => updateTestCaseAction(c1.id, { title: 'x' }, inactiveUser));
    await assert.rejects(() =>
      createTestRunAction(c1.id, createTestRunDto.parse({ status: TestRunStatus.PASSED }), inactiveUser)
    );
    await assert.rejects(() => deleteTestCaseAction(c1.id, inactiveUser));

    // Other regular USER cannot delete creatorUser's test case
    await assert.rejects(
      async () => deleteTestCaseAction(deletableByCreatorId, otherUser),
      /ტესტ-ქეისის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს ან შემქმნელს/
    );

    // Creator USER can delete own test case
    const delCreatorRes = await deleteTestCaseAction(deletableByCreatorId, creatorUser);
    assert.strictEqual(delCreatorRes.success, true);

    // ADMIN can delete any user's test case
    const delAdminRes = await deleteTestCaseAction(deletableByAdminId, admin);
    assert.strictEqual(delAdminRes.success, true);
  });

  await t.test('8. Independence from task status/subtasks & Archive accessibility', async () => {
    // Main task must STILL be IN_PROGRESS with 50% progress despite FAILED/BLOCKED/PASSED runs
    const taskBefore = await testPrisma.task.findUnique({ where: { id: mainTask.id } });
    assert.strictEqual(taskBefore?.status, TaskStatus.IN_PROGRESS);
    assert.strictEqual(taskBefore?.progress, 50);

    // Completing second subtask still updates progress to 100% normally
    await testPrisma.subtask.update({
      where: { id: st2.id },
      data: { status: SubtaskStatus.DONE, completedAt: new Date() },
    });
    const newProgress = await calculateAndSyncTaskProgress(mainTask.id);
    assert.strictEqual(newProgress, 100);

    // Archive task (status = DONE) -> testing history remains accessible to both USER and ADMIN
    await testPrisma.task.update({
      where: { id: mainTask.id },
      data: { status: TaskStatus.DONE, completedAt: new Date() },
    });

    const userArchiveList = await listTaskTestCasesAction(mainTask.id, otherUser);
    assert.strictEqual(userArchiveList.length, 1);
    const adminArchiveDetail = await getTestCaseAction(primaryCaseId, admin);
    assert.strictEqual(adminArchiveDetail.runs.length, 3);
    assert.ok(st1.id);
  });

  await t.test('9. Activity & Audit events recorded accurately on the task', async () => {
    const events = await testPrisma.auditEvent.findMany({
      where: {
        taskId: mainTask.id,
        action: {
          in: [
            AuditAction.TEST_CASE_CREATED,
            AuditAction.TEST_CASE_UPDATED,
            AuditAction.TEST_CASE_DELETED,
            AuditAction.TEST_RUN_RECORDED,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const actions = new Set(events.map((e) => e.action));
    assert.ok(actions.has(AuditAction.TEST_CASE_CREATED));
    assert.ok(actions.has(AuditAction.TEST_CASE_UPDATED));
    assert.ok(actions.has(AuditAction.TEST_CASE_DELETED));
    assert.ok(actions.has(AuditAction.TEST_RUN_RECORDED));

    const runEvents = events.filter((e) => e.action === AuditAction.TEST_RUN_RECORDED);
    assert.strictEqual(runEvents.length, 3);
  });
});
