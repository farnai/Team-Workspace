import { handle } from '@/server/http/route';
import { updateSubtaskAction } from '@/server/actions/subtasks/update-subtask.action';
import { deleteSubtaskAction } from '@/server/actions/subtasks/delete-subtask.action';

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return updateSubtaskAction(id, body);
});

export const DELETE = handle(async (_req, { params }) => {
  const { id } = await params;
  return deleteSubtaskAction(id);
});
