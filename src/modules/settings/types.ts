import type { WorkingCalendar, Holiday } from '@prisma/client';

export interface CalendarSettingsData {
  workingCalendar: WorkingCalendar[];
  holidays: Holiday[];
}

export interface CreateHolidayInput {
  date: string;
  name: string;
  isOfficial?: boolean;
}
