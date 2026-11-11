import { useToastMutation } from '@/hooks/useToastMutation'
import { projectsApi } from '../api'
import { projectKeys } from '../query-keys'

export function useDeleteProject() {
  return useToastMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    successMessage: 'პროექტი წაიშალა',
    invalidate: [projectKeys.all],
  })
}

