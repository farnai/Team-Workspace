import { handle } from '@/server/http/route';
import { updateStageAction } from '@/server/actions/stages/update-stage.action';
import { deleteStageAction } from '@/server/actions/stages/delete-stage.action';

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const stage = await updateStageAction(id, body);
  return { stage };
});

export const DELETE = handle(async (_req, { params }) => {
  const { id } = await params;
  return deleteStageAction(id);
});
