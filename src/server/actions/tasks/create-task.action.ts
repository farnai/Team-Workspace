import 'server-only'
import type { User } from '@prisma/client'
import { TaskStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditRepository } from '@/server/repositories/audit.repository'
import { AppError } from '@/server/http/errors'
import type { CreateTaskDto } from '@/server/dto/task.dto'

export async function createTaskAction(input: CreateTaskDto, actor: User) {
  const parsedStart = input.startDate ? new Date(input.startDate) : null
  const parsedDeadline = input.deadline ? new Date(input.deadline) : null

  // 1. Resolve assignees list
  let resolvedAssignees: {
    userId: string
    position: number
    deadline: Date | null
  }[] = []

  if (input.assignees && input.assignees.length > 0) {
    resolvedAssignees = input.assignees
      .map((a, idx) => ({
        userId: a.userId,
        position: a.position !== undefined ? a.position : idx,
        deadline: a.deadline ? new Date(a.deadline) : null,
      }))
      .sort((a, b) => a.position - b.position)
  } else if (input.assigneeIds && input.assigneeIds.length > 0) {
    resolvedAssignees = input.assigneeIds.map((uid, idx) => ({
      userId: uid,
      position: idx,
      deadline: parsedDeadline,
    }))
  }

  // 2. Validate rules:
  if (resolvedAssignees.length > 1) {
    const firstAssignee = resolvedAssignees[0]
    if (input.status === TaskStatus.IN_PROGRESS && !firstAssignee.deadline) {
      throw new AppError('სამუშაოს დასაწყებად (In Progress) 1-ლი შემსრულებლის დედლაინი სავალდებულოა', 400)
    }

    if (parsedDeadline) {
      for (const a of resolvedAssignees) {
        if (a.deadline && a.deadline.getTime() > parsedDeadline.getTime()) {
          throw new AppError('შემსრულებლის დედლაინი არ შეიძლება აღემატებოდეს დავალების საერთო დედლაინს', 400)
        }
      }
    }

    for (let i = 0; i < resolvedAssignees.length; i++) {
      for (let j = i + 1; j < resolvedAssignees.length; j++) {
        const dI = resolvedAssignees[i].deadline
        const dJ = resolvedAssignees[j].deadline
        if (dI && dJ && dI.getTime() > dJ.getTime()) {
          throw new AppError('თანმიმდევრული შემსრულებლების დედლაინები უნდა შეესაბამებოდეს რიგითობას', 400)
        }
      }
    }
  } else if (resolvedAssignees.length === 1) {
    if (parsedDeadline && !resolvedAssignees[0].deadline) {
      resolvedAssignees[0].deadline = parsedDeadline
    }
  }

  let projectId = input.projectId
  if (!projectId) {
    const defaultProject = await prisma.project.findFirst({ where: { isArchived: false } })
    if (!defaultProject) {
      const createdProject = await prisma.project.create({
        data: { name: 'ძირითადი პროექტი', color: '#EA580C' },
      })
      projectId = createdProject.id
    } else {
      projectId = defaultProject.id
    }
  }

  const shouldLockDeadline = Boolean(parsedDeadline)

  return prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        projectId: projectId!,
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        department: input.department,
        status: input.status,
        startDate: parsedStart,
        deadline: parsedDeadline,
        deadlineLocked: shouldLockDeadline,
        progress: 0,
        createdById: actor.id,
      },
    })

    if (resolvedAssignees.length > 0) {
      const uniqueUserIds = Array.from(new Set(resolvedAssignees.map((a) => a.userId)))

      await tx.taskAssignment.createMany({
        data: uniqueUserIds.map((uid) => ({
          taskId: created.id,
          userId: uid,
        })),
      })

      if (resolvedAssignees.length > 1) {
        const assigneeUsers = await tx.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, name: true },
        })
        const userNameMap = new Map(assigneeUsers.map((u) => [u.id, u.name]))

        for (let i = 0; i < resolvedAssignees.length; i++) {
          const a = resolvedAssignees[i]
          const uName = userNameMap.get(a.userId) || `შემსრულებელი ${i + 1}`
          const stage = await tx.workflowStage.create({
            data: {
              taskId: created.id,
              position: i,
              title: `ეტაპი ${i + 1}: ${uName}`,
              isActive: i === 0,
              startDate: i === 0 ? parsedStart : null,
              deadline: a.deadline,
              deadlineLocked: Boolean(a.deadline),
            },
          })

          await tx.stageAssignment.create({
            data: {
              stageId: stage.id,
              userId: a.userId,
            },
          })
        }
      }
    }

    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        if (link.url?.trim()) {
          const trimmedUrl = link.url.trim()
          const originalName = link.name?.trim() || trimmedUrl
          await tx.attachment.create({
            data: {
              taskId: created.id,
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

    await auditRepository.log(
      {
        taskId: created.id,
        actorId: actor.id,
        action: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: created.id,
        newValues: {
          title: created.title,
          priority: created.priority,
          department: created.department,
          status: created.status,
          deadline: created.deadline,
        },
        reason: 'ახალი დავალების შექმნა',
      },
      tx
    )

    return tx.task.findUnique({
      where: { id: created.id },
      include: {
        project: true,
        assignments: { include: { user: true } },
        stages: { include: { assignments: { include: { user: true } } } },
      },
    })
  })
}

