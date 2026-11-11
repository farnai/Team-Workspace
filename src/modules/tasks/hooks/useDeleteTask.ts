import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '../query-keys';
import { tasksApi } from '../api';

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}
