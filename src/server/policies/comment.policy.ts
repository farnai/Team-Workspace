import 'server-only';
import type { UserSession } from '@/server/auth/session';

export function canManageComment(user: UserSession, comment: { userId: string }): boolean {
  return user.role === 'ADMIN' || comment.userId === user.id;
}

