import { useQuery } from '@tanstack/react-query';
import { workloadKeys } from '../query-keys';
import { workloadApi } from '../api';
import type { WorkloadFilterParams } from '../types';

export function useWorkload(filters?: WorkloadFilterParams) {
  return useQuery({
    queryKey: workloadKeys.list(filters),
    queryFn: () => workloadApi.get(filters),
  });
}
