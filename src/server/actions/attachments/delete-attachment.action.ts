import 'server-only';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { canManageAttachment } from '@/server/policies/attachment.policy';
import { attachmentRepository } from '@/server/repositories/attachment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function deleteAttachmentAction(id: string) {
  const user = await requireUser();

  const attachment = await attachmentRepository.findById(id);
  if (!attachment) {
    throw new NotFoundError('ფაილი ვერ მოიძებნა');
  }

  if (!canManageAttachment(user, attachment)) {
    throw new ForbiddenError('არ გაქვთ ამ ფაილის წაშლის უფლება');
  }

  await prisma.$transaction(async (tx) => {
    await attachmentRepository.delete(id, tx);

    await auditRepository.log(
      {
        taskId: attachment.taskId,
        actorId: user.id,
        action: 'ATTACHMENT_REMOVED',
        entityType: 'ATTACHMENT',
        entityId: id,
        oldValues: {
          originalName: attachment.originalName,
          sizeBytes: attachment.sizeBytes,
          isExternal: attachment.isExternal,
        },
        reason: attachment.isExternal ? 'გარე ბმულის წაშლა' : 'ფაილის წაშლა',
      },
      tx
    );
  });

  if (!attachment.isExternal && attachment.storedName) {
    const safeStoredName = path.basename(attachment.storedName);
    const filePath = path.normalize(path.join(UPLOAD_DIR, safeStoredName));
    if (filePath.startsWith(path.normalize(UPLOAD_DIR))) {
      try {
        await fs.unlink(filePath);
      } catch {
        // Safe ignore
      }
    }
  }

  return { message: 'ფაილი წარმატებით წაიშალა' };
}
