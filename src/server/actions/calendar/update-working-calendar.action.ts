import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { ValidationError } from '@/server/http/errors';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function updateWorkingCalendarAction(days: unknown) {
  const admin = await requireAdmin();

  if (!Array.isArray(days)) {
    throw new ValidationError('არასწორი მონაცემები');
  }

  for (const d of days) {
    await prisma.workingCalendar.upsert({
      where: { dayOfWeek: d.dayOfWeek },
      update: { isWorking: d.isWorking },
      create: { dayOfWeek: d.dayOfWeek, isWorking: d.isWorking },
    });
  }

  await auditRepository.log({
    actorId: admin.id,
    action: 'CALENDAR_UPDATED',
    entityType: 'SETTINGS',
    entityId: 'working_calendar',
    newValues: { days },
    reason: 'სამუშაო კალენდრის დღეების განახლება ადმინისტრატორის მიერ',
  });

  return { success: true };
}
