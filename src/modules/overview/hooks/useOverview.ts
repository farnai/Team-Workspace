import { useQuery } from '@tanstack/react-query';
import { overviewKeys } from '../query-keys';
import { overviewApi } from '../api';

export function useOverview() {
  return useQuery({
    queryKey: overviewKeys.all,
    queryFn: () => overviewApi.get(),
  });
}
