import 'server-only';
import { z } from 'zod';
import { Role, Department } from '@prisma/client';

export const createUserDto = z.object({
  name: z.string().min(2, 'სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან'),
  email: z.string().email('არასწორი ელ.ფოსტა'),
  password: z.string().min(6, 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო'),
  role: z.nativeEnum(Role).default(Role.USER),
  department: z.nativeEnum(Department).default(Department.DEVELOPMENT),
  avatarUrl: z.string().optional(),
});

export const updateUserDto = z.object({
  isActive: z.boolean().optional(),
  password: z.string().min(6, 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო').optional(),
  name: z.string().min(2, 'სახელი უნდა შედგებოდეს მინიმუმ 2 სიმბოლოსგან').optional(),
  role: z.nativeEnum(Role).optional(),
  department: z.nativeEnum(Department).optional(),
});

export type CreateUserInput = z.infer<typeof createUserDto>;
export type UpdateUserInput = z.infer<typeof updateUserDto>;

