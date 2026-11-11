import type { WorkloadFilterParams } from './types';

export const workloadKeys = {
  all: ['workload'] as const,
  list: (filters?: WorkloadFilterParams) => [...workloadKeys.all, filters ?? {}] as const,
};
