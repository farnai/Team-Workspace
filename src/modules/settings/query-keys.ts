export const settingsKeys = {
  all: ['settings'] as const,
  calendar: () => [...settingsKeys.all, 'calendar'] as const,
};
