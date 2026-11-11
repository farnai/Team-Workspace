import 'server-only'
import type { User } from '@prisma/client'
import { advanceWorkflowStage } from '@/lib/workflow'

export async function completeStageAction(stageId: string, actor: User) {
  const result = await advanceWorkflowStage({
    stageId,
    actorId: actor.id,
  })
  return { nextStage: result.nextStage }
}

