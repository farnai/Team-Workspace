import { useQuery } from '@tanstack/react-query';
import { taskKeys } from '../query-keys';
import { tasksApi } from '../api';

export function useTaskDetails(id?: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => tasksApi.getById(id!),
    enabled: Boolean(id),
  });
}
