import { handle } from '@/server/http/route';
import { listUsersAction } from '@/server/actions/users/list-users.action';

export const GET = handle(async () => {
  const users = await listUsersAction();
  return { users };
});
