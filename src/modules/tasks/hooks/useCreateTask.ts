import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '../query-keys';
import { tasksApi } from '../api';

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

