import 'server-only'
import { projectRepository } from '@/server/repositories/project.repository'
import { toProjectSummaryResource } from '@/server/resources/project.resource'

export async function listProjectsAction() {
  const projects = await projectRepository.findAll()
  return projects.map(toProjectSummaryResource)
}

