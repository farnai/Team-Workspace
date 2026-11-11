import { handle } from '@/server/http/route';
import { listDailyUpdatesAction } from '@/server/actions/daily-updates/list-daily-updates.action';
import { createDailyUpdateAction } from '@/server/actions/daily-updates/create-daily-update.action';

export const GET = handle(async (_req, { params }) => {
  const { id } = await params;
  const dailyUpdates = await listDailyUpdatesAction(id);
  return { dailyUpdates };
});

export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const dailyUpdate = await createDailyUpdateAction(id, body);
  return { dailyUpdate };
}, 201);
