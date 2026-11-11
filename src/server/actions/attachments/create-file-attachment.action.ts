import 'server-only';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { ValidationError } from '@/server/http/errors';
import { attachmentRepository } from '@/server/repositories/attachment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { validateFileIntegrity, isPathContained, MAX_ATTACHMENT_SIZE } from '@/lib/fileSecurity';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function createFileAttachmentAction(taskId: string, file: File | null) {
  const user = await requireUser();

  if (!file) {
    throw new ValidationError('ფაილი არ არის არჩეული');
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new ValidationError('ფაილის მაქსიმალური ზომაა 25MB');
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const integrityCheck = validateFileIntegrity(buffer, file.name, file.type || '');
  if (!integrityCheck.isValid) {
    throw new ValidationError(integrityCheck.error || 'ფაილის ფორმატი დაუშვებელია');
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name).toLowerCase();
  const safeExtension = ext.replace(/[^a-z0-9.]/g, '') || '.bin';
  const storedFileName = `${crypto.randomUUID()}${safeExtension}`;
  const destinationPath = path.resolve(UPLOAD_DIR, storedFileName);

  if (!isPathContained(destinationPath, UPLOAD_DIR)) {
    throw new ValidationError('არასწორი ფაილის გზა');
  }

  await fs.writeFile(destinationPath, buffer);

  return prisma.$transaction(async (tx) => {
    const attachment = await attachmentRepository.create(
      {
        task: { connect: { id: taskId } },
        user: { connect: { id: user.id } },
        originalName: file.name,
        storedName: storedFileName,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        isExternal: false,
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
        newValues: { originalName: file.name, sizeBytes: file.size },
        reason: 'ფაილის ატვირთვა',
      },
      tx
    );

    return attachment;
  });
}
