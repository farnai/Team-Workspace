import type { TaskSummary } from '@/modules/tasks/types';

export interface MyWorkGroups {
  needsAttention: TaskSummary[];
  inProgress: TaskSummary[];
  waiting: TaskSummary[];
  planned: TaskSummary[];
  paused: TaskSummary[];
  blocked: TaskSummary[];
  completed: TaskSummary[];
}

export interface MyWorkCounts {
  total: number;
  needsAttention: number;
  inProgress: number;
  waiting: number;
  planned: number;
  paused: number;
  blocked: number;
  completed: number;
}

export interface MyWorkData {
  groups: MyWorkGroups;
  counts: MyWorkCounts;
}
