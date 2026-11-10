import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { createTaskDto, taskQueryDto } from '@/server/dto/task.dto'
import { createTaskAction } from '@/server/actions/tasks/create-task.action'
import { listTasksAction } from '@/server/actions/tasks/list-tasks.action'

export const GET = handle(async (req) => {
  await requireUser()
  const { searchParams } = new URL(req.url)
  const query = taskQueryDto.parse({
    search: searchParams.get('search') || undefined,
    projectId: searchParams.get('projectId') || undefined,
    type: searchParams.get('type') || undefined,
    priority: searchParams.get('priority') || undefined,
    status: searchParams.get('status') || undefined,
    department: searchParams.get('department') || undefined,
    assigneeId: searchParams.get('assigneeId') || undefined,
    unassigned: searchParams.get('unassigned') === 'true' || undefined,
    overdue: searchParams.get('overdue') === 'true' || undefined,
    unscheduled: searchParams.get('unscheduled') === 'true' || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
    mode: searchParams.get('mode') || undefined,
  })

  const tasks = await listTasksAction(query)
  return { tasks }
})

export const POST = handle(async (req) => {
  const user = await requireUser()
  const input = createTaskDto.parse(await req.json())
  const task = await createTaskAction(input, user)
  return { task }
})
