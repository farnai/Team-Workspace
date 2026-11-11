import 'server-only';
import { z } from 'zod';

export const createLinkDto = z.object({
  name: z.string().optional(),
  url: z.string().min(1, 'ბმულის URL სავალდებულოა').refine(
    (val) => {
      const lower = val.trim().toLowerCase();
      return lower.startsWith('http://') || lower.startsWith('https://');
    },
    { message: 'ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით' }
  ),
});

export const updateLinkDto = z.object({
  name: z.string().optional(),
  url: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const lower = val.trim().toLowerCase();
      return lower.startsWith('http://') || lower.startsWith('https://');
    },
    { message: 'ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით' }
  ),
});

export type CreateLinkInput = z.infer<typeof createLinkDto>;
export type UpdateLinkInput = z.infer<typeof updateLinkDto>;

