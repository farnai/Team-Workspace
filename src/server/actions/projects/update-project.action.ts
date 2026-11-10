import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { projectRepository } from '@/server/repositories/project.repository'
import { canManageProjects } from '@/server/policies/project.policy'
import { ForbiddenError, NotFoundError } from '@/server/http/errors'
import type { UpdateProjectDto } from '@/server/dto/project.dto'

export async function updateProjectAction(id: string, input: UpdateProjectDto, actor: User) {
  if (!canManageProjects(actor)) {
    throw new ForbiddenError('პროექტის რედაქტირების უფლება აქვს მხოლოდ ადმინისტრატორს')
  }

  const existing = await projectRepository.findById(id)
  if (!existing) {
    throw new NotFoundError('პროექტი ვერ მოიძებნა')
  }

  return prisma.$transaction(async (tx) => {
    return projectRepository.update(
      id,
      {
        name: input.name !== undefined ? input.name : existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        color: input.color !== undefined ? input.color : existing.color,
        isArchived: input.isArchived !== undefined ? input.isArchived : existing.isArchived,
      },
      tx
    )
  })
}
