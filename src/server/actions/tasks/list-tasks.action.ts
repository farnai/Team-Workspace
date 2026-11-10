import 'server-only'
import { Prisma, TaskStatus } from '@prisma/client'
import { taskRepository } from '@/server/repositories/task.repository'
import { toTaskResource } from '@/server/resources/task.resource'
import { getTbilisiTodayString } from '@/lib/date'
import type { TaskQueryDto } from '@/server/dto/task.dto'

export async function listTasksAction(query: TaskQueryDto) {
  const where: Prisma.TaskWhereInput = {}

  if (query.projectId) {
    where.projectId = query.projectId
  }

  if (query.type) {
    where.type = query.type
  }

  if (query.priority) {
    where.priority = query.priority
  }

  if (query.status) {
    where.status = query.status
  }

  if (query.department) {
    where.department = query.department
  }

  if (query.assigneeId) {
    where.assignments = {
      some: { userId: query.assigneeId },
    }
  }

  if (query.unassigned) {
    where.assignments = { none: {} }
  }

  if (query.overdue) {
    const today = getTbilisiTodayString()
    where.deadline = { lt: new Date(today) }
    where.status = { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
  }

  if (query.unscheduled) {
    where.startDate = null
    where.deadline = null
  }

  if (query.search && query.search.trim()) {
    const q = query.search.trim()
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ]
  }

  let orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: 'desc' }
  if (query.sortBy === 'deadline') {
    orderBy = { deadline: query.sortOrder }
  } else if (query.sortBy === 'priority') {
    orderBy = { priority: query.sortOrder }
  } else if (query.sortBy === 'taskNumber') {
    orderBy = { taskNumber: query.sortOrder }
  }

  const tasks = await taskRepository.findMany(where, orderBy)
  return tasks.map((t) => toTaskResource(t as unknown as Parameters<typeof toTaskResource>[0]))
}
