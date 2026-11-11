import test from 'node:test'
import assert from 'node:assert'
import { testPrisma } from '../test-db'
import { Role, TaskType, Priority, TaskStatus } from '@prisma/client'
import { timelineRepository } from '@/server/repositories/timeline.repository'
import bcrypt from 'bcryptjs'

test('Timeline Repository: Strict Date Filtering (Excludes Dateless Tasks)', async (t) => {
  const ts = Date.now()
  const passwordHash = await bcrypt.hash('Password123!', 10)

  const user = await testPrisma.user.create({
    data: {
      email: `timeline_user_${ts}@team.local`,
      name: 'Timeline User',
      role: Role.USER,
      passwordHash,
      isActive: true,
    },
  })

  const project = await testPrisma.project.create({
    data: {
      name: `Timeline Project ${ts}`,
      color: '#10B981',
    },
  })

  // 1. Task without dates (Backlog / Dateless)
  const datelessTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: `Dateless Task ${ts}`,
      type: TaskType.FEATURE,
      priority: Priority.MEDIUM,
      status: TaskStatus.BACKLOG,
      startDate: null,
      deadline: null,
      createdById: user.id,
    },
  })

  // 2. Task with scheduled deadline
  const deadlineDate = new Date('2026-11-15T12:00:00Z')
  const scheduledTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: `Scheduled Task ${ts}`,
      type: TaskType.FEATURE,
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      startDate: new Date('2026-11-12T09:00:00Z'),
      deadline: deadlineDate,
      createdById: user.id,
    },
  })

  // 3. Task with deadline only (single day)
  const deadlineOnlyTask = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: `Deadline Only Task ${ts}`,
      type: TaskType.BUG,
      priority: Priority.CRITICAL,
      status: TaskStatus.PLANNED,
      startDate: null,
      deadline: new Date('2026-11-14T18:00:00Z'),
      createdById: user.id,
    },
  })

  await t.test('Schedule query strictly excludes tasks without deadlines/dates', async () => {
    const rangeStart = new Date('2026-11-01T00:00:00Z')
    const rangeEnd = new Date('2026-11-30T23:59:59Z')

    const tasks = await timelineRepository.getScheduleTasks(
      {
        startDate: rangeStart,
        endDate: rangeEnd,
        projectId: project.id,
      },
      testPrisma
    )

    const ids = tasks.map((tk) => tk.id)

    // Dateless task must NEVER be included in schedule query
    assert.strictEqual(
      ids.includes(datelessTask.id),
      false,
      'Task without deadline or startDate must NOT be returned in timeline schedule query'
    )

    // Scheduled task must be included
    assert.strictEqual(
      ids.includes(scheduledTask.id),
      true,
      'Scheduled task with dates must be returned in timeline schedule query'
    )

    // Deadline-only task must be included
    assert.strictEqual(
      ids.includes(deadlineOnlyTask.id),
      true,
      'Task with deadline must be returned in timeline schedule query'
    )
  })
})
