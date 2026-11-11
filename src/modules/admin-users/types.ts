import type { User, Role, Department } from '@prisma/client';

export type AdminUserItem = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'department' | 'avatarUrl' | 'isActive' | 'createdAt'
>;

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: Department;
  avatarUrl?: string;
}

export interface UpdateUserInput {
  isActive?: boolean;
  password?: string;
  name?: string;
  role?: Role;
  department?: Department;
}

