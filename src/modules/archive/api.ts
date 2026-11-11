import { api } from '@/lib/api-client';
import type { ArchiveData, ArchiveFilterParams } from './types';

export const archiveApi = {
  async get(filters?: ArchiveFilterParams): Promise<ArchiveData> {
    const searchParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) searchParams.set(key, val);
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return api.get<ArchiveData>(`/api/archive${query}`);
  },
};

