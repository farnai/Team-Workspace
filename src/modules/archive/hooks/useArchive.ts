import { useQuery } from '@tanstack/react-query';
import { archiveKeys } from '../query-keys';
import { archiveApi } from '../api';
import type { ArchiveFilterParams } from '../types';

export function useArchive(filters?: ArchiveFilterParams) {
  return useQuery({
    queryKey: archiveKeys.list(filters),
    queryFn: () => archiveApi.get(filters),
  });
}
