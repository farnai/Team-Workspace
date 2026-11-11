import { useToastMutation } from '@/hooks/useToastMutation'
import { projectsApi } from '../api'
import { projectKeys } from '../query-keys'
import type { CreateProjectPayload } from '../types'

export function useCreateProject() {
  return useToastMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    successMessage: 'პროექტი წარმატებით შეიქმნა',
    invalidate: [projectKeys.all],
  })
}

