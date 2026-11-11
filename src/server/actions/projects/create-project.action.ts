import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { projectRepository } from '@/server/repositories/project.repository'
import type { CreateProjectDto } from '@/server/dto/project.dto'

export async function createProjectAction(input: CreateProjectDto, _actor: User) {
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

