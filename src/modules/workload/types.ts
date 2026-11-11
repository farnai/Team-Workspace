export interface WorkloadFilterParams {
  startDate?: string;
  endDate?: string;
  days?: number;
  projectId?: string;
  userId?: string;
  department?: string;
}

export interface WorkloadData {
  days: unknown[];
  users: unknown[];
  unassignedTasks: unknown[];
  conflicts: unknown[];
  projects: unknown[];
  workingDays: unknown[];
  holidays: unknown[];
}

