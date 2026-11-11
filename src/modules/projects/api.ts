import { api } from '@/lib/api-client'
import type { ProjectItem, CreateProjectPayload, UpdateProjectPayload } from './types'

export const projectsApi = {
  list: () => api.get<{ projects: ProjectItem[] }>('/projects'),
  get: (id: string) => api.get<{ project: ProjectItem }>(`/projects/${id}`),
  create: (payload: CreateProjectPayload) =>
    api.post<{ project: ProjectItem }>('/projects', payload),
  update: (id: string, payload: UpdateProjectPayload) =>
    api.patch<{ project: ProjectItem }>(`/projects/${id}`, payload),
  delete: (id: string) => api.delete<{ success: boolean }>(`/projects/${id}`),
}

