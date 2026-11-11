import { api } from '@/lib/api-client';
import type { TaskDetails, TaskSummary, TaskFilterParams } from './types';

export const tasksApi = {
  async list(filters?: TaskFilterParams): Promise<TaskSummary[]> {
    const searchParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) searchParams.set(key, val);
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await api.get<{ tasks: TaskSummary[] }>(`/api/tasks${query}`);
    return res.tasks;
  },

  async getById(id: string): Promise<TaskDetails> {
    const res = await api.get<{ task: TaskDetails }>(`/api/tasks/${id}`);
    return res.task;
  },

  async create(data: unknown): Promise<TaskDetails> {
    const res = await api.post<{ task: TaskDetails }>('/api/tasks', data);
    return res.task;
  },

  async update(id: string, data: unknown): Promise<TaskDetails> {
    const res = await api.patch<{ task: TaskDetails }>(`/api/tasks/${id}`, data);
    return res.task;
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/api/tasks/${id}`);
  },

  async completeStage(stageId: string): Promise<{ success: boolean }> {
    return api.post<{ success: boolean }>(`/api/stages/${stageId}/complete`);
  },
};
