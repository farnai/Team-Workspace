import { handle } from '@/server/http/route';
import { listAttachmentsAction } from '@/server/actions/attachments/list-attachments.action';
import { createLinkAttachmentAction } from '@/server/actions/attachments/create-link-attachment.action';
import { createFileAttachmentAction } from '@/server/actions/attachments/create-file-attachment.action';

export const GET = handle(async (_req, { params }) => {
  const { id } = await params;
  const attachments = await listAttachmentsAction(id);
  return { attachments };
});

export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json();
    const attachment = await createLinkAttachmentAction(id, body);
    return { attachment };
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const attachment = await createFileAttachmentAction(id, file);
  return { attachment };
}, 201);
