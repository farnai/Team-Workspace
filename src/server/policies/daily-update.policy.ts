import 'server-only';
import type { UserSession } from '@/server/auth/session';

export function canManageDailyUpdate(user: UserSession, update: { userId: string }): boolean {
  return user.role === 'ADMIN' || update.userId === user.id;
}
