import { handle } from '@/server/http/route';
import { updateUserAction } from '@/server/actions/admin-users/update-user.action';

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const user = await updateUserAction(id, body);
  return { user };
});
