import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '../api'
import { projectKeys } from '../query-keys'

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: async () => {
      const res = await projectsApi.list()
      return res.projects
    },
  })
}
