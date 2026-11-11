import 'server-only';
import type { UserSession } from '@/server/auth/session';

export function canManageAttachment(user: UserSession, attachment: { userId: string }): boolean {
  return user.role === 'ADMIN' || attachment.userId === user.id;
}

