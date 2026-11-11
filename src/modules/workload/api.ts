import { api } from '@/lib/api-client';
import type { WorkloadData, WorkloadFilterParams } from './types';

export const workloadApi = {
  async get(filters?: WorkloadFilterParams): Promise<WorkloadData> {
    const searchParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null) searchParams.set(key, String(val));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<WorkloadData>(`/api/workload${query}`);
  },
};
