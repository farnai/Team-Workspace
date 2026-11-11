import 'server-only'
import { format, addDays, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns'
import { requireUser } from '@/server/auth/session'
import { getTimelineQueryDto, type GetTimelineQueryDto } from '@/server/dto/timeline.dto'
import { timelineRepository } from '@/server/repositories/timeline.repository'
import {
  getGeorgianHolidaysForYear,
  isDateWorkingDay,
  formatDateKey,
} from '@/lib/calendar'
import { isTbilisiToday } from '@/lib/dateUtils'

export async function getTimelineAction(rawInput: unknown) {
  await requireUser()
  const input = getTimelineQueryDto.parse(rawInput)

  let startDate: Date
  let endDate: Date
  let centerDate: Date

  if (input.startDate && input.endDate) {
    const partsStart = input.startDate.split('-').map(Number)
    const partsEnd = input.endDate.split('-').map(Number)
    startDate = startOfDay(new Date(partsStart[0], partsStart[1] - 1, partsStart[2]))
    endDate = endOfDay(new Date(partsEnd[0], partsEnd[1] - 1, partsEnd[2]))
    centerDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2)
  } else {
    if (input.date) {
      const parts = input.date.split('-').map(Number)
      centerDate = new Date(parts[0], parts[1] - 1, parts[2])
    } else {
      centerDate = new Date()
    }
    startDate = startOfDay(subDays(centerDate, Math.floor(input.days / 2)))
    endDate = endOfDay(addDays(centerDate, Math.ceil(input.days / 2)))
  }

  // Load working calendar from repository
  const workingDays = await timelineRepository.getWorkingDays()
  const workingDaysMap = new Map<number, boolean>()
  workingDays.forEach((w) => workingDaysMap.set(w.dayOfWeek, w.isWorking))

  // Combine algorithmic Georgian holidays and DB custom holidays
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  const holidaysMap = new Map<string, string>()

  // 1. Official algorithmic Georgian public holidays
  for (let y = startYear; y <= endYear; y++) {
    const yearHolidays = getGeorgianHolidaysForYear(y)
    for (const h of yearHolidays) {
      holidaysMap.set(h.dateStr, h.name)
    }
  }

  // 2. Custom holidays from database
  const dbHolidays = await timelineRepository.getDbHolidays(startDate, endDate)
  for (const h of dbHolidays) {
    holidaysMap.set(formatDateKey(new Date(h.date)), h.name)
  }

  interface TimelineDateEntry {
    date: string
    dateObj: Date
    dayOfWeek: number
    isWeekend: boolean
    isWorking: boolean
    holidayName: string | null
    isToday: boolean
    tasks: Record<string, unknown>[]
    activities: Record<string, unknown>[]
  }

  // Generate date sequence
  const dates: TimelineDateEntry[] = []
  let cur = new Date(startDate)
  while (cur <= endDate) {
    const { isWorking, isWeekend, holidayName } = isDateWorkingDay(
      cur,
      workingDaysMap,
      holidaysMap
    )

    dates.push({
      date: format(cur, 'yyyy-MM-dd'),
      dateObj: new Date(cur),
      dayOfWeek: cur.getDay(),
      isWeekend,
      isWorking,
      holidayName,
      isToday: isTbilisiToday(cur),
      tasks: [],
      activities: [],
    })
    cur = addDays(cur, 1)
  }

  if (input.mode === 'schedule') {
    const tasks = await timelineRepository.getScheduleTasks({
      startDate,
      endDate,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      type: input.type,
    })

    // Project each scheduled task onto its relevant timeline dates
    for (const t of tasks) {
      // Find active stage
      const activeStage = t.stages.find((s) => s.isActive && !s.isCompleted)
      const stageResponsible = activeStage?.assignments.map((a) => a.user) || []
      const responsibleUsers =
        stageResponsible.length > 0
          ? stageResponsible
          : t.assignments.map((a) => a.user)

      // Effective dates: ONLY from scheduled dates or stage dates. NEVER use createdAt!
      const effectiveStart =
        t.startDate || t.deadline || activeStage?.startDate || activeStage?.deadline
      const effectiveEnd =
        t.deadline || t.startDate || activeStage?.deadline || activeStage?.startDate

      // Dateless tasks MUST NOT appear in the schedule timeline
      if (!effectiveStart || !effectiveEnd) {
        continue
      }

      const startMs = Math.min(new Date(effectiveStart).getTime(), new Date(effectiveEnd).getTime())
      const endMs = Math.max(new Date(effectiveStart).getTime(), new Date(effectiveEnd).getTime())
      const taskStart = startOfDay(new Date(startMs))
      const taskEnd = endOfDay(new Date(endMs))

      for (const d of dates) {
        const dayDate = d.dateObj
        if (dayDate >= taskStart && dayDate <= taskEnd) {
          const isOverdue = Boolean(
            t.deadline && new Date() > new Date(t.deadline) && t.status !== 'DONE'
          )

          d.tasks.push({
            id: t.id,
            taskNumber: t.taskNumber,
            title: t.title,
            type: t.type,
            priority: t.priority,
            status: t.status,
            progress: t.progress,
            startDate: t.startDate,
            deadline: t.deadline,
            deadlineLocked: t.deadlineLocked,
            isOverdue,
            project: t.project
              ? {
                  id: t.project.id,
                  name: t.project.name,
                  color: t.project.color,
                }
              : null,
            assignees: t.assignments.map((a) => a.user),
            responsibleUsers,
            activeStage: activeStage
              ? {
                  id: activeStage.id,
                  title: activeStage.title,
                  position: activeStage.position,
                  deadline: activeStage.deadline,
                  assignees: stageResponsible,
                }
              : null,
            totalSubtasks: t.subtasks.length,
            doneSubtasks: t.subtasks.filter((s) => s.status === 'DONE').length,
            isSpanStart: isSameDay(dayDate, taskStart),
            isSpanEnd: isSameDay(dayDate, taskEnd),
            isMultiDay: !isSameDay(taskStart, taskEnd),
          })
        }
      }
    }
  } else {
    // Activity Mode: immutable audit events in range
    const auditEvents = await timelineRepository.getAuditEvents({
      startDate,
      endDate,
      projectId: input.projectId,
    })

    for (const a of auditEvents) {
      const eventDate = format(new Date(a.createdAt), 'yyyy-MM-dd')
      const targetDate = dates.find((d) => d.date === eventDate)
      if (targetDate) {
        targetDate.activities.push({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt,
          actor: a.actor,
          task: a.task,
          oldValues: a.oldValues,
          newValues: a.newValues,
          reason: a.reason,
        })
      }
    }
  }

  return {
    dates: dates.map((d) => ({
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      isWeekend: d.isWeekend,
      isWorking: d.isWorking,
      holidayName: d.holidayName,
      isToday: d.isToday,
      tasks: d.tasks,
      activities: d.activities,
    })),
    range: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
      center: format(centerDate, 'yyyy-MM-dd'),
    },
  }
}
