export interface OverviewData {
  metrics: {
    activeTasksCount: number;
    completedTodayCount: number;
    completedLast7Days: number;
    completedThisMonth: number;
    pausedCount: number;
    blockedCount: number;
    overdueCount: number;
    dueSoonCount: number;
    monthName: string;
  };
  projects: Array<{
    id: string;
    name: string;
    color: string;
    tasksCount: number;
  }>;
  recentActivities: unknown[];
  users: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    activeTasksCount: number;
  }>;
  inProgressTasks: unknown[];
}
