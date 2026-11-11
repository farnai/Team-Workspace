import test from 'node:test'
import assert from 'node:assert'
import { testPrisma } from '../test-db'
import { Role, Priority, TaskType, Department, TaskStatus } from '@prisma/client'
import { createTaskAction } from '@/server/actions/tasks/create-task.action'
import { updateTaskAction } from '@/server/actions/tasks/update-task.action'
import { deleteTaskAction } from '@/server/actions/tasks/delete-task.action'
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

