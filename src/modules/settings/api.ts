import { api } from '@/lib/api-client';
import type { CalendarSettingsData, CreateHolidayInput } from './types';

export const settingsApi = {
  async getCalendar(): Promise<CalendarSettingsData> {
    return api.get<CalendarSettingsData>('/api/settings/calendar');
  },

  async updateWorkingCalendar(days: Array<{ dayOfWeek: number; isWorking: boolean }>): Promise<{ success: boolean }> {
    return api.patch<{ success: boolean }>('/api/settings/calendar', { days });
  },

  async createHoliday(data: CreateHolidayInput): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>('/api/settings/calendar', data);
  },

  async deleteHoliday(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/settings/calendar?id=${id}`);
  },
};

