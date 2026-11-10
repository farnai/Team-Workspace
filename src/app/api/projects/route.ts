import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { createProjectDto } from '@/server/dto/project.dto'
import { listProjectsAction } from '@/server/actions/projects/list-projects.action'
import { createProjectAction } from '@/server/actions/projects/create-project.action'

export const GET = handle(async () => {
  await requireUser()
  const projects = await listProjectsAction()
  return { projects }
})

export const POST = handle(async (req) => {
  const user = await requireUser()
  const input = createProjectDto.parse(await req.json())
  const project = await createProjectAction(input, user)
  return { project }
})
