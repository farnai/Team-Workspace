import { useQuery } from '@tanstack/react-query';
import { testingApi } from '../api';
import { testingKeys } from '../query-keys';

export function useTestCaseDetail(testCaseId: string | null) {
  return useQuery({
    queryKey: testingKeys.caseDetail(testCaseId ?? ''),
    queryFn: () => testingApi.getCase(testCaseId!),
    enabled: Boolean(testCaseId),
  });
}
