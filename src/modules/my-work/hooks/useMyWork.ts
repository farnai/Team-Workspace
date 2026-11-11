import { useQuery } from '@tanstack/react-query';
import { myWorkKeys } from '../query-keys';
import { myWorkApi } from '../api';

export function useMyWork() {
  return useQuery({
    queryKey: myWorkKeys.all,
    queryFn: () => myWorkApi.get(),
  });
}

