import { useQuery } from '@tanstack/react-query';
import { testingApi } from '../api';
import { testingKeys } from '../query-keys';

export function useTaskTestCases(taskId: string | null) {
  return useQuery({
    queryKey: testingKeys.taskCases(taskId ?? ''),
    queryFn: () => testingApi.listByTask(taskId!),
    enabled: Boolean(taskId),
  });
}
