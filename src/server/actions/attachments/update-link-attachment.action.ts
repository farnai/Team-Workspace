import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError, ValidationError } from '@/server/http/errors';
import { updateLinkDto } from '@/server/dto/attachment.dto';
import { canManageAttachment } from '@/server/policies/attachment.policy';
import { attachmentRepository } from '@/server/repositories/attachment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function updateLinkAttachmentAction(id: string, input: unknown) {
  const user = await requireUser();
  const data = updateLinkDto.parse(input);

  const attachment = await attachmentRepository.findById(id);
  if (!attachment) {
    throw new NotFoundError('ბმული ვერ მოიძებნა');
  }

  if (!canManageAttachment(user, attachment)) {
    throw new ForbiddenError('არ გაქვთ ამ ბმულის რედაქტირების უფლება');
  }

  if (!attachment.isExternal) {
    throw new ValidationError('მხოლოდ გარე ბმულების რედაქტირებაა შესაძლებელი');
  }

  const trimmedUrl = data.url ? data.url.trim() : attachment.url;

  return prisma.$transaction(async (tx) => {
    const updated = await attachmentRepository.update(
      id,
      {
        originalName: data.name ? data.name.trim() : attachment.originalName,
        url: trimmedUrl,
      },
      tx
    );

    await auditRepository.log(
      {
        taskId: attachment.taskId,
        actorId: user.id,
        action: 'TASK_UPDATED',
        entityType: 'ATTACHMENT',
        entityId: id,
        oldValues: { name: attachment.originalName, url: attachment.url },
        newValues: { name: updated.originalName, url: updated.url },
        reason: 'გარე ბმულის რედაქტირება',
      },
      tx
    );

    return updated;
  });
}
