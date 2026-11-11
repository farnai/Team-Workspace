import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';

export async function getCalendarSettingsAction() {
  await requireUser();

  const [workingCalendar, holidays] = await Promise.all([
    prisma.workingCalendar.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
  ]);

  return { workingCalendar, holidays };
}
