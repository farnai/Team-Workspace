import 'server-only'
import type { User } from '@prisma/client'
import { TaskStatus, Role, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { taskRepository } from '@/server/repositories/task.repository'
import { auditRepository } from '@/server/repositories/audit.repository'
import { canUpdateTask } from '@/server/policies/task.policy'
import { validateDeadlineModification, calculateAndSyncTaskProgress } from '@/lib/workflow'
import { ForbiddenError, NotFoundError, AppError } from '@/server/http/errors'
import type { UpdateTaskDto } from '@/server/dto/task.dto'

export async function updateTaskAction(id: string, data: UpdateTaskDto, actor: User) {
  const existing = await prisma.task.findUnique({
    where: { id },
    include: {
      assignments: true,
      stages: {
        orderBy: { position: 'asc' },
        include: { assignments: true },
      },
    },
  })

  if (!existing) {
    throw new NotFoundError('ტასკი ვერ მოიძებნა')
  }

  if (!canUpdateTask(actor, existing)) {
    throw new ForbiddenError('არ გაქვთ ამ დავალების რედაქტირების უფლება')
  }

  const isAdmin = actor.role === Role.ADMIN

  const incomingDeadline =
    data.deadline !== undefined
      ? data.deadline === null
        ? null
        : new Date(data.deadline)
      : undefined

  const deadlineCheck = validateDeadlineModification({
    isDeadlineLocked: existing.deadlineLocked,
    existingDeadline: existing.deadline,
    incomingDeadline,
    isAdmin,
  })

  if (!deadlineCheck.allowed) {
    throw new ForbiddenError(deadlineCheck.error || 'დედლაინის შეცვლა შეუძლია მხოლოდ ადმინისტრატორს')
  }

  const effectiveDeadline =
    incomingDeadline !== undefined ? incomingDeadline : existing.deadline

  const targetStatus = data.status || existing.status

  if (data.assignees && data.assignees.length > 1) {
    const sorted = [...data.assignees].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    )
    if (targetStatus === TaskStatus.IN_PROGRESS && !sorted[0].deadline) {
      throw new AppError('სამუშაოს დასაწყებად (In Progress) 1-ლი შემსრულებლის დედლაინი სავალდებულოა', 400)
    }
    if (effectiveDeadline) {
      for (const a of sorted) {
        if (a.deadline && new Date(a.deadline).getTime() > effectiveDeadline.getTime()) {
          throw new AppError('შემსრულებლის დედლაინი არ შეიძლება აღემატებოდეს დავალების საერთო დედლაინს', 400)
        }
      }
    }
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const dI = sorted[i].deadline ? new Date(sorted[i].deadline!) : null
        const dJ = sorted[j].deadline ? new Date(sorted[j].deadline!) : null
        if (dI && dJ && dI.getTime() > dJ.getTime()) {
          throw new AppError('თანმიმდევრული შემსრულებლების დედლაინები უნდა შეესაბამებოდეს რიგითობას', 400)
        }
      }
    }
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const updatePayload: Prisma.TaskUpdateInput = {}

    if (data.title !== undefined) updatePayload.title = data.title
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.type !== undefined) updatePayload.type = data.type
    if (data.priority !== undefined) updatePayload.priority = data.priority
    if (data.department !== undefined) updatePayload.department = data.department
    if (data.projectId !== undefined) {
      updatePayload.project = { connect: { id: data.projectId } }
    }

    if (data.startDate !== undefined) {
      updatePayload.startDate = data.startDate ? new Date(data.startDate) : null
    }

    if (incomingDeadline !== undefined) {
      updatePayload.deadline = incomingDeadline
      if (!existing.deadlineLocked && incomingDeadline) {
        updatePayload.deadlineLocked = true
      }
    }

    if (data.status) {
      updatePayload.status = data.status
      if (data.status === TaskStatus.DONE) {
        updatePayload.completedAt = new Date()
      } else if (existing.status === TaskStatus.DONE) {
        updatePayload.completedAt = null
      }
    }

    const task = await tx.task.update({
      where: { id },
      data: updatePayload,
      include: {
        assignments: { include: { user: true } },
        stages: { include: { assignments: { include: { user: true } } } },
      },
    })

    // Audit logs for status and properties
    if (data.status && data.status !== existing.status) {
      let action: 'STATUS_CHANGED' | 'WORK_PAUSED' | 'WORK_RESUMED' = 'STATUS_CHANGED'
      let reason: string | undefined = data.rescheduleReason

      if (data.status === TaskStatus.PAUSED) {
        action = 'WORK_PAUSED'
        reason = data.pauseReason || data.rescheduleReason || 'სამუშაო შეჩერებულია'
      } else if (data.status === TaskStatus.BLOCKED) {
        action = 'STATUS_CHANGED'
        reason = data.blockedReason || 'დავალება დაბლოკილია'
      } else if (existing.status === TaskStatus.PAUSED && data.status === TaskStatus.IN_PROGRESS) {
        action = 'WORK_RESUMED'
        reason = 'სამუშაო განახლდა'
      }

      await auditRepository.log(
        {
          taskId: id,
          actorId: actor.id,
          action,
          entityType: 'TASK',
          entityId: id,
          oldValues: { status: existing.status },
          newValues: { status: data.status },
          reason,
        },
        tx
      )
    }

    if (incomingDeadline !== undefined && incomingDeadline?.toISOString() !== existing.deadline?.toISOString()) {
      await auditRepository.log(
        {
          taskId: id,
          actorId: actor.id,
          action: 'DEADLINE_CHANGED',
          entityType: 'TASK',
          entityId: id,
          oldValues: { deadline: existing.deadline },
          newValues: { deadline: incomingDeadline },
          reason: data.rescheduleReason || 'დედლაინის განახლება',
        },
        tx
      )
    }

    if (data.priority && data.priority !== existing.priority) {
      await auditRepository.log(
        {
          taskId: id,
          actorId: actor.id,
          action: 'PRIORITY_CHANGED',
          entityType: 'TASK',
          entityId: id,
          oldValues: { priority: existing.priority },
          newValues: { priority: data.priority },
          reason: 'პრიორიტეტის ცვლილება',
        },
        tx
      )
    }

    if (data.department && data.department !== existing.department) {
      await auditRepository.log(
        {
          taskId: id,
          actorId: actor.id,
          action: 'DEPARTMENT_CHANGED',
          entityType: 'TASK',
          entityId: id,
          oldValues: { department: existing.department },
          newValues: { department: data.department },
          reason: `გუნდის ცვლილება: ${data.department}`,
        },
        tx
      )
    }

    // Handle assignees update
    let finalAssigneeIds: string[] | null = null
    if (data.assignees && data.assignees.length > 0) {
      finalAssigneeIds = Array.from(new Set(data.assignees.map((a) => a.userId)))
    } else if (data.assigneeIds !== undefined) {
      finalAssigneeIds = data.assigneeIds
    }

    if (finalAssigneeIds !== null) {
      await taskRepository.setAssignees(id, finalAssigneeIds, tx)

      await auditRepository.log(
        {
          taskId: id,
          actorId: actor.id,
          action: 'TASK_ASSIGNED',
          entityType: 'TASK',
          entityId: id,
          oldValues: { assigneeIds: existing.assignments.map((a) => a.userId) },
          newValues: { assigneeIds: finalAssigneeIds },
          reason: 'შემსრულებლების განახლება',
        },
        tx
      )
    }

    // Links update
    if (data.links && data.links.length > 0) {
      for (const link of data.links) {
        if (link.url?.trim()) {
          const trimmedUrl = link.url.trim()
          const originalName = link.name?.trim() || trimmedUrl
          await tx.attachment.create({
            data: {
              taskId: id,
              userId: actor.id,
              originalName,
              storedName: `link_${Date.now()}`,
              mimeType: 'text/uri-list',
              sizeBytes: 0,
              isExternal: true,
              url: trimmedUrl,
            },
          })
        }
      }
    }

    return task
  })

  await calculateAndSyncTaskProgress(id)

  return taskRepository.findById(id)
}
