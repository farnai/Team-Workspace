import 'server-only';
import { requireUser } from '@/server/auth/session';
import { commentRepository } from '@/server/repositories/comment.repository';

export async function listCommentsAction(taskId: string) {
  await requireUser();
  return commentRepository.findByTaskId(taskId);
}
