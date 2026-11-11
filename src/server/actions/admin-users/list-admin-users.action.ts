import 'server-only';
import { requireAdmin } from '@/server/auth/session';
import { userRepository } from '@/server/repositories/user.repository';

export async function listAdminUsersAction() {
  await requireAdmin();
  return userRepository.findAllAdminUsers();
}

