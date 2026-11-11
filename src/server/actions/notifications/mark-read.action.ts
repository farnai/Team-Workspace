import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError } from '@/server/http/errors';

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification || notification.userId !== user.id) {
    throw new NotFoundError('შეტყობინება ვერ მოიძებნა');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return { notification: updated };
}

