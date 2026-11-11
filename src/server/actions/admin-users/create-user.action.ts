import 'server-only';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/server/auth/session';
import { ValidationError } from '@/server/http/errors';
import { createUserDto } from '@/server/dto/user.dto';
import { userRepository } from '@/server/repositories/user.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function createUserAction(input: unknown) {
  const admin = await requireAdmin();
  const data = createUserDto.parse(input);
  const normalizedEmail = data.email.toLowerCase().trim();

  const existing = await userRepository.findByEmail(normalizedEmail);
  if (existing) {
    throw new ValidationError('მომხმარებელი ამ ელ.ფოსტით უკვე არსებობს');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const newUser = await userRepository.create({
    name: data.name,
    email: normalizedEmail,
    passwordHash,
    role: data.role,
    department: data.department,
    avatarUrl: data.avatarUrl,
    isActive: true,
  });

  await auditRepository.log({
    actorId: admin.id,
    action: 'USER_CREATED',
    entityType: 'USER',
    entityId: newUser.id,
    newValues: {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      department: newUser.department,
    },
    reason: 'ადმინისტრატორის მიერ ახალი მომხმარებლის შექმნა',
  });

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    department: newUser.department,
    isActive: newUser.isActive,
  };
}

