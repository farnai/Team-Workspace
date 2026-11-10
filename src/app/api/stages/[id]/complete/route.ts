import { handle } from '@/server/http/route'
import { requireUser } from '@/server/auth/session'
import { completeStageAction } from '@/server/actions/tasks/complete-stage.action'

export const POST = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await params
  return completeStageAction(id, user)
})
