import { handle } from '@/server/http/route';
import { listCommentsAction } from '@/server/actions/comments/list-comments.action';
import { createCommentAction } from '@/server/actions/comments/create-comment.action';

export const GET = handle(async (_req, { params }) => {
  const { id } = await params;
  const comments = await listCommentsAction(id);
  return { comments };
});

export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const comment = await createCommentAction(id, body);
  return { comment };
}, 201);
