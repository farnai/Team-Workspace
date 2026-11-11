import { handle } from '@/server/http/route';
import { listAdminUsersAction } from '@/server/actions/admin-users/list-admin-users.action';
import { createUserAction } from '@/server/actions/admin-users/create-user.action';

export const GET = handle(async () => {
  const users = await listAdminUsersAction();
  return { users };
});

export const POST = handle(async (req) => {
  const body = await req.json();
  const user = await createUserAction(body);
  return { user };
}, 201);
