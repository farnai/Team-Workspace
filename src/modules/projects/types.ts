export interface ProjectItem {
  id: string
  name: string
  description?: string | null
  color: string
  createdAt?: string
  updatedAt?: string
  taskCount: number
  completedCount: number
  inProgressCount: number
  overdueCount: number
  progress: number
}

export interface CreateProjectPayload {
  name: string
  description?: string
  color?: string
}

export interface UpdateProjectPayload {
  name?: string
  description?: string | null
  color?: string
  isArchived?: boolean
}

