import 'server-only'
import { z } from 'zod'

export const createProjectDto = z.object({
  name: z.string().trim().min(1, 'პროექტის სახელი სავალდებულოა').max(100),
  description: z.string().trim().max(500).optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'არასწორი ფერის კოდი').optional().default('#EA580C'),
})

export type CreateProjectDto = z.infer<typeof createProjectDto>

export const updateProjectDto = z.object({
  name: z.string().trim().min(1, 'პროექტის სახელი სავალდებულოა').max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'არასწორი ფერის კოდი').optional(),
  isArchived: z.boolean().optional(),
})

export type UpdateProjectDto = z.infer<typeof updateProjectDto>

