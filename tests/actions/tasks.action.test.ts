import test from 'node:test'
import assert from 'node:assert'
import { testPrisma } from '../test-db'
import { Role, Priority, TaskType, Department, TaskStatus } from '@prisma/client'
import { createTaskAction } from '@/server/actions/tasks/create-task.action'
import { updateTaskAction } from '@/server/actions/tasks/update-task.action'
import { deleteTaskAction } from '@/server/actions/tasks/delete-task.action'
import { createDeadlineRequestAction } from '@/server/actions/deadline-requests/create-deadline-request.action'
import { getDeadlineRequestAction } from '@/server/actions/deadline-requests/get-deadline-request.action'
import { reviewDeadlineRequestAction } from '@/server/actions/deadline-requests/review-deadline-request.action'
import bcrypt from 'bcryptjs'

test('Actions: Tasks Lifecycle, Transactions & Audit Invariants', async (t) => {
  const ts = Date.now()
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const admin = await testPrisma.user.create({
    data: {
      email: `admin_action_${ts}@team.local`,
      name: 'Admin Action',
      role: Role.ADMIN,
      passwordHash,
      isActive: true,
    },
  })

  const member = await testPrisma.user.create({
    data: {
      email: `member_action_${ts}@team.local`,
      name: 'Member Action',
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  })

  const project = await testPrisma.project.create({
    data: {
      name: `Action Project ${ts}`,
      color: '#EA580C',
    },
  })

  let createdTaskId = ''

  await t.test('createTaskAction: creates task, assignments, and audit event atomically', async () => {
    const task = await createTaskAction(
      {
        title: `Test Task ${ts}`,
        description: 'Test action description',
        projectId: project.id,
        type: TaskType.FEATURE,
        priority: Priority.HIGH,
        department: Department.DEVELOPMENT,
        status: TaskStatus.BACKLOG,
        deadline: '2026-11-20T00:00:00.000Z',
        assigneeIds: [member.id],
        links: [{ name: 'Figma', url: 'https://figma.com/design/test' }],
      },
      admin
    )

    assert.ok(task, 'Task should be created')
    assert.strictEqual(task.title, `Test Task ${ts}`)
    assert.strictEqual(task.deadlineLocked, true, 'Deadline should be locked once set')
    assert.strictEqual(task.assignments.length, 1, 'Should have 1 assignee')
    assert.strictEqual(task.assignments[0].userId, member.id)

    createdTaskId = task.id

    // Check audit event
    const audit = await testPrisma.auditEvent.findFirst({
      where: { taskId: task.id, action: 'TASK_CREATED' },
    })
    assert.ok(audit, 'TASK_CREATED audit event should exist')
    assert.strictEqual(audit.actorId, admin.id)
  })

  await t.test('updateTaskAction: non-admin cannot change locked deadline', async () => {
    await assert.rejects(
      async () => {
        await updateTaskAction(
          createdTaskId,
          { deadline: '2026-11-25T00:00:00.000Z' },
          member
        )
      },
      /დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს/
    )
  })

  await t.test('updateTaskAction: admin can change locked deadline and updates status to IN_PROGRESS', async () => {
    const updated = await updateTaskAction(
      createdTaskId,
      {
        deadline: '2026-11-25T00:00:00.000Z',
        status: TaskStatus.IN_PROGRESS,
      },
      admin
    )

    assert.ok(updated)
    assert.strictEqual(updated.status, TaskStatus.IN_PROGRESS)

    const deadlineAudit = await testPrisma.auditEvent.findFirst({
      where: { taskId: createdTaskId, action: 'DEADLINE_CHANGED' },
    })
    assert.ok(deadlineAudit, 'DEADLINE_CHANGED audit event must be logged')
  })

  await t.test('updateTaskAction: regular user (non-creator, non-assignee) can edit task and assign to self or others', async () => {
    const outsider = await testPrisma.user.create({
      data: {
        email: `editor_user_${ts}@team.local`,
        name: 'Regular Editor',
        role: Role.USER,
        passwordHash,
        isActive: true,
      },
    })

    // 1. Regular user (neither creator nor assignee) edits task and assigns to self
    const selfAssigned = await updateTaskAction(
      createdTaskId,
      {
        title: `Edited By Regular User ${ts}`,
        description: 'Updated description by regular user',
        priority: Priority.LOW,
        assigneeIds: [outsider.id],
      },
      outsider
    )

    assert.ok(selfAssigned)
    assert.strictEqual(selfAssigned.title, `Edited By Regular User ${ts}`)
    assert.strictEqual(selfAssigned.description, 'Updated description by regular user')
    assert.strictEqual(selfAssigned.priority, Priority.LOW)
    assert.strictEqual(selfAssigned.assignments.length, 1)
    assert.strictEqual(selfAssigned.assignments[0].userId, outsider.id)

    // 2. Regular user reassigns the task to another colleague (member)
    const reassigned = await updateTaskAction(
      createdTaskId,
      {
        assigneeIds: [member.id],
      },
      outsider
    )

    assert.ok(reassigned)
    assert.strictEqual(reassigned.assignments.length, 1)
    assert.strictEqual(reassigned.assignments[0].userId, member.id)

    await testPrisma.auditEvent.deleteMany({ where: { actorId: outsider.id } })
    await testPrisma.user.delete({ where: { id: outsider.id } })
  })

  await t.test('updateTaskAction: sequential assignees create & sync workflow stages, and reopening reactivates last stage', async () => {
    const secondMember = await testPrisma.user.create({
      data: {
        email: `second_member_${ts}@team.local`,
        name: 'Second Member',
        role: Role.USER,
        passwordHash,
        isActive: true,
      },
    })

    // 1. Update with 2 sequential assignees -> creates 2 stages
    const withStages = await updateTaskAction(
      createdTaskId,
      {
        assignees: [
          { userId: member.id, position: 0, deadline: '2026-11-20T00:00:00.000Z' },
          { userId: secondMember.id, position: 1, deadline: '2026-11-24T00:00:00.000Z' },
        ],
      },
      admin
    )

    assert.ok(withStages)
    assert.strictEqual(withStages.stages.length, 2, 'Two sequential assignees must create 2 stages')
    assert.strictEqual(withStages.stages[0].assignments[0].userId, member.id)
    assert.strictEqual(withStages.stages[0].isActive, true)
    assert.strictEqual(withStages.stages[1].assignments[0].userId, secondMember.id)
    assert.strictEqual(withStages.stages[1].isActive, false)

    // 2. Swap sequential assignees -> updates existing stages
    const swappedStages = await updateTaskAction(
      createdTaskId,
      {
        assignees: [
          { userId: secondMember.id, position: 0, deadline: '2026-11-21T00:00:00.000Z' },
          { userId: member.id, position: 1, deadline: '2026-11-25T00:00:00.000Z' },
        ],
      },
      admin
    )

    assert.ok(swappedStages)
    assert.strictEqual(swappedStages.stages.length, 2)
    assert.strictEqual(swappedStages.stages[0].assignments[0].userId, secondMember.id)
    assert.strictEqual(swappedStages.stages[1].assignments[0].userId, member.id)

    // 3. Mark DONE -> all stages complete, then reopen -> last stage reactivated
    const completed = await updateTaskAction(createdTaskId, { status: TaskStatus.DONE }, admin)
    assert.ok(completed)
    assert.strictEqual(completed.status, TaskStatus.DONE)
    assert.ok(completed.stages.every((s) => s.isCompleted && !s.isActive), 'All stages must complete on DONE')

    const reopened = await updateTaskAction(createdTaskId, { status: TaskStatus.IN_PROGRESS }, admin)
    assert.ok(reopened)
    assert.strictEqual(reopened.status, TaskStatus.IN_PROGRESS)
    assert.strictEqual(reopened.completedAt, null)
    assert.strictEqual(reopened.stages[0].isActive, false)
    assert.strictEqual(reopened.stages[1].isActive, true, 'Last stage must reactivate on reopen')
    assert.strictEqual(reopened.stages[1].isCompleted, false)

    await testPrisma.auditEvent.deleteMany({ where: { actorId: secondMember.id } })
    await testPrisma.user.delete({ where: { id: secondMember.id } })
  })

  await t.test('deadline request lifecycle: create -> pending -> approve clears pending request', async () => {
    const reqResult = await createDeadlineRequestAction(
      createdTaskId,
      {
        requestedDeadline: '2026-12-01T00:00:00.000Z',
        reason: 'დამატებითი ტესტირების დრო გვჭირდება',
      },
      member
    )
    assert.ok(reqResult.requestId)

    const beforeReview = await getDeadlineRequestAction(createdTaskId, member)
    assert.ok(beforeReview.pendingRequest, 'Pending deadline request must be visible before review')
    assert.strictEqual(beforeReview.pendingRequest.id, reqResult.requestId)

    const reviewRes = await reviewDeadlineRequestAction(
      createdTaskId,
      { action: 'APPROVE', responseNote: 'დადასტურებულია' },
      admin
    )
    assert.strictEqual(reviewRes.action, 'APPROVE')

    const afterReview = await getDeadlineRequestAction(createdTaskId, member)
    assert.strictEqual(afterReview.pendingRequest, null, 'Pending request must clear after admin review')
  })

  await t.test('deleteTaskAction: non-admin non-creator cannot delete task', async () => {
    const outsider = await testPrisma.user.create({
      data: {
        email: `outsider_${ts}@team.local`,
        name: 'Outsider',
        role: Role.USER,
        passwordHash,
        isActive: true,
      },
    })

    await assert.rejects(
      async () => {
        await deleteTaskAction(createdTaskId, outsider)
      },
      /ტასკის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს ან შემქმნელს/
    )

    await testPrisma.user.delete({ where: { id: outsider.id } })
  })

  await t.test('deleteTaskAction: admin deletes task and logs TASK_DELETED without losing audit trail', async () => {
    const res = await deleteTaskAction(createdTaskId, admin)
    assert.strictEqual(res.success, true)

    const found = await testPrisma.task.findUnique({ where: { id: createdTaskId } })
    assert.strictEqual(found, null, 'Task must be deleted')

    // Verify TASK_DELETED audit event is preserved in database with taskId set to null
    const deleteAudit = await testPrisma.auditEvent.findFirst({
      where: { entityId: createdTaskId, action: 'TASK_DELETED' },
    })
    assert.ok(deleteAudit, 'TASK_DELETED audit event must be preserved')
    assert.strictEqual(deleteAudit.taskId, null, 'taskId fk must be null after task deletion')
  })

  // Cleanup
  await testPrisma.auditEvent.deleteMany({ where: { actorId: { in: [admin.id, member.id] } } })
  await testPrisma.project.delete({ where: { id: project.id } })
  await testPrisma.user.deleteMany({ where: { id: { in: [admin.id, member.id] } } })
})

