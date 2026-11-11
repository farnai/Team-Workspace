import 'server-only';
import { requireUser } from '@/server/auth/session';
import { userRepository } from '@/server/repositories/user.repository';

export async function listUsersAction() {
  await requireUser();
  return userRepository.findAllActiveUsers();
}
