import { api } from '@/lib/api-client';
import type { OverviewData } from './types';

export const overviewApi = {
  async get(): Promise<OverviewData> {
    return api.get<OverviewData>('/api/overview');
  },
};

