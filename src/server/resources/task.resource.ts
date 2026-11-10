import 'server-only'
import type { Task } from '@prisma/client'

export function toTaskResource(task: Task & Record<string, unknown>) {
  return {
    id: task.id,
    number: task.taskNumber,
    taskNumber: task.taskNumber,
    title: task.title,
    status: task.status,
    priority: task.priority,
    type: task.type,
    department: task.department,
    deadline: task.deadline ? new Date(task.deadline).toISOString() : null,
    startDate: task.startDate ? new Date(task.startDate).toISOString() : null,
    progress: task.progress,
    project: task.project,
    assignments: task.assignments,
    stages: task.stages,
    _count: task._count,
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : undefined,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : undefined,
  }
}
