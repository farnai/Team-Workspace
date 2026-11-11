import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { ValidationError } from '@/server/http/errors';
import { auditRepository } from '@/server/repositories/audit.repository';

const createHolidaySchema = z.object({
  date: z.string().min(1, 'თარიღი სავალდებულოა'),
  name: z.string().min(2, 'დასახელება უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან'),
  isOfficial: z.boolean().default(false),
});

export async function createHolidayAction(input: unknown) {
  const admin = await requireAdmin();
  const data = createHolidaySchema.parse(input);

  const parsedDate = new Date(data.date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError('არასწორი თარიღის ფორმატი');
  }

  const existing = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: new Date(parsedDate.toISOString().slice(0, 10) + 'T00:00:00.000Z'),
        lte: new Date(parsedDate.toISOString().slice(0, 10) + 'T23:59:59.999Z'),
      },
    },
  });

  if (existing) {
    throw new ValidationError('ამ თარიღზე უქმე უკვე დამატებულია');
  }

  const newHoliday = await prisma.holiday.create({
    data: {
      date: parsedDate,
      name: data.name,
      isOfficial: data.isOfficial ?? false,
    },
  });

  await auditRepository.log({
    actorId: admin.id,
    action: 'CALENDAR_UPDATED',
    entityType: 'HOLIDAY',
    entityId: newHoliday.id,
    newValues: { date: newHoliday.date, name: newHoliday.name, isOfficial: newHoliday.isOfficial },
    reason: `ახალი უქმე დღის დამატება: ${data.name}`,
  });

  return { holiday: newHoliday };
}
