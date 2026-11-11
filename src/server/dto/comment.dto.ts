import 'server-only';
import { z } from 'zod';

export const createCommentDto = z.object({
  content: z.string().min(1, 'კომენტარი არ შეიძლება იყოს ცარიელი').max(5000, 'კომენტარი ზედმეტად გრძელია'),
});

export const updateCommentDto = z.object({
  content: z.string().min(1, 'კომენტარი არ შეიძლება იყოს ცარიელი').max(5000, 'კომენტარი ზედმეტად გრძელია'),
});

export type CreateCommentInput = z.infer<typeof createCommentDto>;
export type UpdateCommentInput = z.infer<typeof updateCommentDto>;
