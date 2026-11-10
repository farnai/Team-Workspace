import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { updateTaskDto } from '@/server/dto/task.dto'
import { taskRepository } from '@/server/repositories/task.repository'
import { updateTaskAction } from '@/server/actions/tasks/update-task.action'
import { deleteTaskAction } from '@/server/actions/tasks/delete-task.action'
import { NotFoundError } from '@/server/http/errors'

export const GET = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  const { id } = await params
  const task = await taskRepository.findById(id)
  if (!task) throw new NotFoundError('ტასკი ვერ მოიძებნა')
  return { task }
})

export const PATCH = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const input = updateTaskDto.parse(await req.json())
  const task = await updateTaskAction(id, input, user)
  return { task }
})

export const DELETE = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  return deleteTaskAction(id, user)
})
