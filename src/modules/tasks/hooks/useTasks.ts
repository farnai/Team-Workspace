import { useQuery } from '@tanstack/react-query';
import { taskKeys } from '../query-keys';
import { tasksApi } from '../api';
import type { TaskFilterParams } from '../types';

export function useTasks(filters?: TaskFilterParams) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => tasksApi.list(filters),
  });
}

