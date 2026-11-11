import 'server-only';
import { requireUser } from '@/server/auth/session';
import { attachmentRepository } from '@/server/repositories/attachment.repository';

export async function listAttachmentsAction(taskId: string) {
  await requireUser();
  return attachmentRepository.findByTaskId(taskId);
}

