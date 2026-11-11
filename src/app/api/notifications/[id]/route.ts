import { handle } from '@/server/http/route';
import { markNotificationReadAction } from '@/server/actions/notifications/mark-read.action';

export const PATCH = handle(async (_req, { params }) => {
  const { id } = await params;
  return markNotificationReadAction(id);
});
