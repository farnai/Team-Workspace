import 'server-only'
import { isTaskOverdue } from '@/lib/date'

interface ProjectWithTasks {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: Date
  updatedAt: Date
  tasks: Array<{
    id: string
    status: string
    deadline: Date | null
    progress: number
  }>
}

export function toProjectSummaryResource(p: ProjectWithTasks) {
  const total = p.tasks.length
  const done = p.tasks.filter((t) => t.status === 'DONE').length
  const inProgress = p.tasks.filter((t) => t.status === 'IN_PROGRESS').length
  const overdue = p.tasks.filter((t) => isTaskOverdue(t.deadline, t.status)).length
  const progress =
    total > 0
      ? Math.round(p.tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / total)
      : 0

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color || '#EA580C',
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    taskCount: total,
    completedCount: done,
    inProgressCount: inProgress,
    overdueCount: overdue,
    progress,
  }
}

