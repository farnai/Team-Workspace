import { handle } from '@/server/http/route';
import { getCalendarSettingsAction } from '@/server/actions/calendar/get-calendar-settings.action';
import { updateWorkingCalendarAction } from '@/server/actions/calendar/update-working-calendar.action';
import { createHolidayAction } from '@/server/actions/calendar/create-holiday.action';
import { deleteHolidayAction } from '@/server/actions/calendar/delete-holiday.action';

export const GET = handle(async () => {
  return getCalendarSettingsAction();
});

export const PATCH = handle(async (req) => {
  const body = await req.json();
  return updateWorkingCalendarAction(body.days);
});

export const POST = handle(async (req) => {
  const body = await req.json();
  return createHolidayAction(body);
}, 201);

export const DELETE = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  return deleteHolidayAction(searchParams.get('id'));
});
