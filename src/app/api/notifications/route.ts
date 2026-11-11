import { handle } from '@/server/http/route';
import { listNotificationsAction } from '@/server/actions/notifications/list-notifications.action';
import { markAllNotificationsReadAction } from '@/server/actions/notifications/mark-all-read.action';

export const GET = handle(async () => {
  return listNotificationsAction();
});

export const POST = handle(async () => {
  return markAllNotificationsReadAction();
});
