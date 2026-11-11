import { api } from '@/lib/api-client';
import type { AdminUserItem, CreateUserInput, UpdateUserInput } from './types';

export const adminUsersApi = {
  async list(): Promise<AdminUserItem[]> {
    const res = await api.get<{ users: AdminUserItem[] }>('/api/admin/users');
    return res.users;
  },

  async create(data: CreateUserInput): Promise<AdminUserItem> {
    const res = await api.post<{ user: AdminUserItem }>('/api/admin/users', data);
    return res.user;
  },

  async update(id: string, data: UpdateUserInput): Promise<AdminUserItem> {
    const res = await api.patch<{ user: AdminUserItem }>(`/api/admin/users/${id}`, data);
    return res.user;
  },
};

