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

export function canUpdateTask(user: User, task?: TaskWithActors): boolean {
  void task
  return Boolean(user.isActive && !user.isDeleted)
}

export function canDeleteTask(user: User, task: { createdById: string }): boolean {
  return user.role === Role.ADMIN || task.createdById === user.id
}

export function canCompleteStage(user: User, stage?: StageWithActors): boolean {
  void stage
  return Boolean(user.isActive && !user.isDeleted)
}

