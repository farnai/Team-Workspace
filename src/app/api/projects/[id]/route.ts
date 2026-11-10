import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { updateProjectDto } from '@/server/dto/project.dto'
import { projectRepository } from '@/server/repositories/project.repository'
import { updateProjectAction } from '@/server/actions/projects/update-project.action'
import { deleteProjectAction } from '@/server/actions/projects/delete-project.action'
import { NotFoundError } from '@/server/http/errors'

export const GET = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser()
  const { id } = await params
  const project = await projectRepository.findById(id)
  if (!project) throw new NotFoundError('პროექტი ვერ მოიძებნა')
  return { project }
})

export const PATCH = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  const input = updateProjectDto.parse(await req.json())
  const project = await updateProjectAction(id, input, user)
  return { project }
})

export const DELETE = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  return deleteProjectAction(id, user)
})
