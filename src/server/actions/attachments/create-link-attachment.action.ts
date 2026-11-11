import 'server-only';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { createLinkDto } from '@/server/dto/attachment.dto';
import { attachmentRepository } from '@/server/repositories/attachment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function createLinkAttachmentAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const data = createLinkDto.parse(input);

  const trimmedUrl = data.url.trim();
  const originalName = data.name && data.name.trim() ? data.name.trim() : trimmedUrl;

  return prisma.$transaction(async (tx) => {
    const attachment = await attachmentRepository.create(
      {
        task: { connect: { id: taskId } },
        user: { connect: { id: user.id } },
        originalName,
        storedName: 'link-' + crypto.randomUUID(),
        mimeType: 'text/html',
        sizeBytes: 0,
        url: trimmedUrl,
        isExternal: true,
      },
      tx
    );

    await auditRepository.log(
      {
        taskId,
        actorId: user.id,
        action: 'ATTACHMENT_ADDED',
        entityType: 'ATTACHMENT',
        entityId: attachment.id,
        newValues: { name: attachment.originalName, url: trimmedUrl, isExternal: true },
        reason: 'გარე ბმულის დამატება: ' + attachment.originalName,
      },
      tx
    );

    return attachment;
  });
}

