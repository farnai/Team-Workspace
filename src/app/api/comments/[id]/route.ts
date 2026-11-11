import { handle } from '@/server/http/route';
import { updateCommentAction } from '@/server/actions/comments/update-comment.action';
import { deleteCommentAction } from '@/server/actions/comments/delete-comment.action';

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const comment = await updateCommentAction(id, body);
  return { comment };
});

export const DELETE = handle(async (_req, { params }) => {
  const { id } = await params;
  return deleteCommentAction(id);
});
