import 'server-only'
import type { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { taskRepository } from '@/server/repositories/task.repository'
import { auditRepository } from '@/server/repositories/audit.repository'
import { canDeleteTask } from '@/server/policies/task.policy'
import { ForbiddenError, NotFoundError } from '@/server/http/errors'
import path from 'path'
import fs from 'fs/promises'

export async function deleteTaskAction(id: string, actor: User) {
  const existing = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      taskNumber: true,
      createdById: true,
      status: true,
    },
  })

  if (!existing) {
    throw new NotFoundError('დავალება ვერ მოიძებნა')
  }

  if (!canDeleteTask(actor, existing)) {
    throw new ForbiddenError('ტასკის წაშლის უფლება აქვს მხოლოდ ადმინისტრატორს ან შემქმნელს')
  }

  const attachments = await prisma.attachment.findMany({
    where: { taskId: id, isExternal: false },
    select: { storedName: true },
  })

  await prisma.$transaction(async (tx) => {
    await auditRepository.log(
      {
        taskId: id,
        actorId: actor.id,
        action: 'TASK_DELETED',
        entityType: 'TASK',
        entityId: id,
        oldValues: {
          title: existing.title,
          taskNumber: existing.taskNumber,
          status: existing.status,
        },
        reason: `დავალება #${existing.taskNumber} ("${existing.title}") წაიშალა`,
      },
      tx
    )

    await taskRepository.delete(id, tx)
  })

  // Remove physical files from disk safely after successful DB transaction
  const uploadDir = path.join(process.cwd(), 'uploads')
  for (const att of attachments) {
    try {
      const filePath = path.join(uploadDir, path.basename(att.storedName))
      await fs.unlink(filePath).catch(() => {})
    } catch {
      // ignore
    }
  }

  return {
    success: true,
    message: `დავალება #${existing.taskNumber} წარმატებით წაიშალა`,
  }
}
