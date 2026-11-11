import 'server-only';
import { z } from 'zod';

export const createDailyUpdateDto = z.object({
  content: z.string().min(1, 'ჩანაწერი არ შეიძლება იყოს ცარიელი').max(5000, 'ჩანაწერი ზედმეტად გრძელია'),
});

export const updateDailyUpdateDto = z.object({
  content: z.string().min(1, 'ჩანაწერი არ შეიძლება იყოს ცარიელი').max(5000, 'ჩანაწერი ზედმეტად გრძელია'),
});

export type CreateDailyUpdateInput = z.infer<typeof createDailyUpdateDto>;
export type UpdateDailyUpdateInput = z.infer<typeof updateDailyUpdateDto>;
