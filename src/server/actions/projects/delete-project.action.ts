import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { projectRepository } from '@/server/repositories/project.repository'
import { canManageProjects } from '@/server/policies/project.policy'
import { ForbiddenError, NotFoundError, AppError } from '@/server/http/errors'

export async function deleteProjectAction(id: string, actor: User) {
  if (!canManageProjects(actor)) {
    throw new ForbiddenError('პროექტის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს')
  }

  const existing = await projectRepository.findById(id)
  if (!existing) {
    throw new NotFoundError('პროექტი ვერ მოიძებნა')
  }

  return prisma.$transaction(async (tx) => {
    // If project has tasks, reassign them to default project before deleting
    if (existing._count.tasks > 0) {
      const fallbackProject = await projectRepository.findFallback(id, tx)
      if (!fallbackProject) {
        throw new AppError(
          'პროექტში არსებობს დავალებები და სხვა აქტიური პროექტი არ მოიძებნა. გთხოვთ ჯერ შექმნათ სხვა პროექტი ან წაშალოთ ტასკები.',
          400
        )
      }

      await projectRepository.reassignTasks(id, fallbackProject.id, tx)
    }

    await projectRepository.delete(id, tx)
    return { success: true, message: 'პროექტი წარმატებით წაიშალა' }
  })
}

