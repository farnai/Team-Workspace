import 'server-only'
import { z } from 'zod'
import { TaskType } from '@prisma/client'

export const getTimelineQueryDto = z.object({
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.coerce.number().int().positive().default(14),
  mode: z.enum(['schedule', 'activity']).default('schedule'),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  type: z.nativeEnum(TaskType).optional(),
})

export type GetTimelineQueryDto = z.infer<typeof getTimelineQueryDto>
