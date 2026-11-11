import type { ArchiveFilterParams } from './types';

export const archiveKeys = {
  all: ['archive'] as const,
  list: (filters?: ArchiveFilterParams) => [...archiveKeys.all, filters ?? {}] as const,
};
