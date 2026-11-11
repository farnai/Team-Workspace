import { handle } from '@/server/http/route';
import { createSubtaskAction } from '@/server/actions/subtasks/create-subtask.action';

export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return createSubtaskAction(id, body);
}, 201);
