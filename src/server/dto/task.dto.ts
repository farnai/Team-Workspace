import 'server-only'
import { z } from 'zod'
import { Priority, TaskType, Department, TaskStatus } from '@prisma/client'

export const linkItemDto = z.object({
  name: z.string().trim().max(200).optional().default(''),
  url: z.string().trim().refine((val) => /^https?:\/\//i.test(val), {
    message: 'ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით',
  }),
})

export const assigneeStageInputDto = z.object({
  userId: z.string().min(1),
  position: z.number().int().optional(),
  deadline: z.string().nullable().optional(),
})

export const createTaskDto = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(1, 'სათაური სავალდებულოა').max(200),
  description: z.string().trim().nullable().optional(),
  type: z.nativeEnum(TaskType).default(TaskType.FEATURE),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  department: z.nativeEnum(Department).default(Department.DEVELOPMENT),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.BACKLOG),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).default([]),
  assignees: z.array(assigneeStageInputDto).optional(),
  links: z.array(linkItemDto).default([]),
})

export type CreateTaskDto = z.infer<typeof createTaskDto>

export const updateTaskDto = z.object({
  projectId: z.string().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().nullable().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  department: z.nativeEnum(Department).optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  pauseReason: z.string().nullable().optional(),
  blockedReason: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  assignees: z.array(assigneeStageInputDto).optional(),
  links: z.array(linkItemDto).optional(),
  stageId: z.string().optional(),
  rescheduleReason: z.string().optional(),
})

export type UpdateTaskDto = z.infer<typeof updateTaskDto>

export const taskQueryDto = z.object({
  search: z.string().optional(),
  projectId: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  department: z.nativeEnum(Department).optional(),
  assigneeId: z.string().optional(),
  unassigned: z.boolean().optional(),
  overdue: z.boolean().optional(),
  unscheduled: z.boolean().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  mode: z.string().optional(),
})

export type TaskQueryDto = z.infer<typeof taskQueryDto>

