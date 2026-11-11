import type { TaskSummary } from '@/modules/tasks/types';
import type { TaskType } from '@prisma/client';

export interface ArchiveGroup {
  date: string;
  formattedDate: string;
  tasks: TaskSummary[];
}

export interface ArchiveFilterParams {
  search?: string;
  projectId?: string;
  type?: TaskType;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ArchiveData {
  groups: ArchiveGroup[];
  totalCount: number;
}

