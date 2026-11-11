import { handle } from '@/server/http/route';
import { updateDailyUpdateAction } from '@/server/actions/daily-updates/update-daily-update.action';
import { deleteDailyUpdateAction } from '@/server/actions/daily-updates/delete-daily-update.action';

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const dailyUpdate = await updateDailyUpdateAction(id, body);
  return { dailyUpdate };
});

export const DELETE = handle(async (_req, { params }) => {
  const { id } = await params;
  return deleteDailyUpdateAction(id);
});
