import { handle } from '@/server/http/route';
import { requireUser } from '@/server/auth/session';
import { startQaRunAction } from '@/server/actions/tasks/start-qa-run.action';

export const POST = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const task = await startQaRunAction(id, user);
  return { task };
});
