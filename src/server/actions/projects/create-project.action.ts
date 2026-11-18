import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { projectRepository } from '@/server/repositories/project.repository'
import { canManageProjects } from '@/server/policies/project.policy'
import { ForbiddenError } from '@/server/http/errors'
import type { CreateProjectDto } from '@/server/dto/project.dto'

export async function createProjectAction(input: CreateProjectDto, actor: User) {
  if (!canManageProjects(actor)) {
    throw new ForbiddenError('პროექტის შექმნის უფლება აქვს მხოლოდ ადმინისტრატორს')
  }

  return prisma.$transaction(async (tx) => {
    return projectRepository.create(
      {
        name: input.name,
        description: input.description,
        color: input.color,
      },
      tx
    )
  })
}

