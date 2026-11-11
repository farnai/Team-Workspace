import { handle } from '@/server/http/route'
import { getTimelineAction } from '@/server/actions/timeline/get-timeline.action'
import { TaskType } from '@prisma/client'

export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url)
  const rawDays = searchParams.get('days')

  return getTimelineAction({
    date: searchParams.get('date') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    days: rawDays ? parseInt(rawDays, 10) : undefined,
    mode: (searchParams.get('mode') as 'schedule' | 'activity') || undefined,
    projectId: searchParams.get('projectId') || undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
    type: (searchParams.get('type') as TaskType) || undefined,
  })
})
