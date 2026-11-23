import { handle } from '@/server/http/route';
import { requireUser } from '@/server/auth/session';
import { finishQaRunAction } from '@/server/actions/tasks/finish-qa-run.action';

export const POST = handle(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const result = await finishQaRunAction(id, user);
  return result;
});
