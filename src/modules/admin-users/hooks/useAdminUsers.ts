import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminUserKeys } from '../query-keys';
import { adminUsersApi } from '../api';
import type { CreateUserInput, UpdateUserInput } from '../types';

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUserKeys.lists(),
    queryFn: () => adminUsersApi.list(),
  });
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserInput) => adminUsersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
    },
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      adminUsersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.lists() });
    },
  });
}
