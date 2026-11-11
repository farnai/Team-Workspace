import 'server-only'
import { User, Role } from '@prisma/client'

interface TaskWithActors {
  createdById: string
  assignments?: Array<{ userId: string }>
  stages?: Array<{ assignments?: Array<{ userId: string }> }>
}

interface StageWithActors {
  assignments?: Array<{ userId: string }>
}

export function canCreateTask(user: User): boolean {
  return user.isActive
}

export function canUpdateTask(user: User, task: TaskWithActors): boolean {
  if (user.role === Role.ADMIN) return true
  if (task.createdById === user.id) return true

  const isTaskAssignee = task.assignments?.some((a) => a.userId === user.id) ?? false
  if (isTaskAssignee) return true

  const isStageAssignee =
    task.stages?.some((s) => s.assignments?.some((a) => a.userId === user.id)) ?? false
  return isStageAssignee
}

export function canDeleteTask(user: User, task: { createdById: string }): boolean {
  return user.role === Role.ADMIN || task.createdById === user.id
}

export function canCompleteStage(user: User, stage: StageWithActors): boolean {
  if (user.role === Role.ADMIN) return true
  return stage.assignments?.some((a) => a.userId === user.id) ?? false
}

