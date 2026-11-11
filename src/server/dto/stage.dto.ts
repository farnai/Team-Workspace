import 'server-only';
import { z } from 'zod';

export const createStageDto = z.object({
  title: z.string().min(1, 'ეტაპის სათაური სავალდებულოა'),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateStageDto = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  position: z.number().optional(),
  isActive: z.boolean().optional(),
  rescheduleReason: z.string().optional(),
});

export const createDeadlineRequestDto = z.object({
  requestedDeadline: z.string().min(1, 'სასურველი დედლაინის მითითება სავალდებულოა'),
  reason: z.string().min(1, 'დედლაინის შეცვლის მოთხოვნის მიზეზის მითითება სავალდებულოა'),
  stageId: z.string().nullable().optional(),
});

export const reviewDeadlineRequestDto = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  responseNote: z.string().optional(),
});

export type CreateStageInput = z.infer<typeof createStageDto>;
export type UpdateStageInput = z.infer<typeof updateStageDto>;
export type CreateDeadlineRequestInput = z.infer<typeof createDeadlineRequestDto>;
export type ReviewDeadlineRequestInput = z.infer<typeof reviewDeadlineRequestDto>;
