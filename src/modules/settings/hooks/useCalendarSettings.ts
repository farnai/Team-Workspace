import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsKeys } from '../query-keys';
import { settingsApi } from '../api';
import type { CreateHolidayInput } from '../types';

export function useCalendarSettings() {
  return useQuery({
    queryKey: settingsKeys.calendar(),
    queryFn: () => settingsApi.getCalendar(),
  });
}

export function useUpdateWorkingCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days: Array<{ dayOfWeek: number; isWorking: boolean }>) =>
      settingsApi.updateWorkingCalendar(days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.calendar() });
    },
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHolidayInput) => settingsApi.createHoliday(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.calendar() });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.calendar() });
    },
  });
}
