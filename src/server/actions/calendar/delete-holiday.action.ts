import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/server/http/errors';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function deleteHolidayAction(id: string | null) {
  const admin = await requireAdmin();

  if (!id) {
    throw new ValidationError('ID სავალდებულოა');
  }

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) {
    throw new NotFoundError('უქმე დღე ვერ მოიძებნა');
  }

  await prisma.holiday.delete({ where: { id } });

  await auditRepository.log({
    actorId: admin.id,
    action: 'CALENDAR_UPDATED',
    entityType: 'HOLIDAY',
    entityId: id,
    oldValues: { date: holiday.date, name: holiday.name },
    reason: `უქმე დღის წაშლა: ${holiday.name}`,
  });

  return { success: true };
}
