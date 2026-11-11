import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireUser } from '@/server/auth/session';
import { handle } from '@/server/http/route';
import { attachmentRepository } from '@/server/repositories/attachment.repository';
import { updateLinkAttachmentAction } from '@/server/actions/attachments/update-link-attachment.action';
import { deleteAttachmentAction } from '@/server/actions/attachments/delete-attachment.action';
import { isPathContained } from '@/lib/fileSecurity';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;

    const attachment = await attachmentRepository.findById(id);
    if (!attachment) {
      return NextResponse.json({ error: 'ფაილი ვერ მოიძებნა' }, { status: 404 });
    }

    if (attachment.isExternal && attachment.url) {
      return NextResponse.redirect(attachment.url);
    }

    const safeStoredName = path.basename(attachment.storedName);
    const filePath = path.resolve(UPLOAD_DIR, safeStoredName);

    if (!isPathContained(filePath, UPLOAD_DIR)) {
      return NextResponse.json({ error: 'არასწორი ფაილის გზა' }, { status: 400 });
    }

    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; sandbox",
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'გთხოვთ გაიაროთ ავტორიზაცია' }, { status: 401 });
    }
    return NextResponse.json({ error: 'ფაილი დისკზე ვერ მოიძებნა' }, { status: 404 });
  }
}

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const attachment = await updateLinkAttachmentAction(id, body);
  return { attachment };
});

export const DELETE = handle(async (_req, { params }) => {
  const { id } = await params;
  return deleteAttachmentAction(id);
});
