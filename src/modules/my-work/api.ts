import { api } from '@/lib/api-client';
import type { MyWorkData } from './types';

export const myWorkApi = {
  async get(): Promise<MyWorkData> {
    return api.get<MyWorkData>('/api/my-work');
  },
};
