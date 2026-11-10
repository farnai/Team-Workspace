import { useToastMutation } from '@/hooks/useToastMutation'
import { projectsApi } from '../api'
import { projectKeys } from '../query-keys'
import type { UpdateProjectPayload } from '../types'

export function useUpdateProject() {
  return useToastMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) =>
      projectsApi.update(id, payload),
    successMessage: 'პროექტის მონაცემები განახლდა',
    invalidate: [projectKeys.all],
  })
}
