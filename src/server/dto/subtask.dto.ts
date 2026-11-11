import 'server-only';
import { z } from 'zod';
import { SubtaskStatus } from '@prisma/client';

export const createSubtaskDto = z.object({
  title: z.string().min(1, 'საბტასკის სათაური სავალდებულოა'),
  description: z.string().optional(),
  stageId: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateSubtaskDto = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.nativeEnum(SubtaskStatus).optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().optional(),
  stageId: z.string().nullable().optional(),
  rescheduleReason: z.string().optional(),
});

export type CreateSubtaskInput = z.infer<typeof createSubtaskDto>;
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskDto>;
