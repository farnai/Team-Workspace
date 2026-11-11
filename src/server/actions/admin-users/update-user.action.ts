import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/server/http/errors';
import { updateUserDto } from '@/server/dto/user.dto';
import { userRepository } from '@/server/repositories/user.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { Role, Prisma } from '@prisma/client';

export async function updateUserAction(id: string, input: unknown) {
  const admin = await requireAdmin();
  const data = updateUserDto.parse(input);

  const targetUser = await userRepository.findById(id);
  if (!targetUser) {
    throw new NotFoundError('მომხმარებელი ვერ მოიძებნა');
  }

  if (id === admin.id && data.isActive === false) {
    throw new ValidationError('საკუთარი ადმინისტრატორის ანგარიშის დეაქტივაცია შეუძლებელია');
  }

  const wouldRemoveAdmin =
    targetUser.role === Role.ADMIN &&
    (data.isActive === false || data.role === Role.USER);

  if (wouldRemoveAdmin) {
    const activeAdminCount = await userRepository.countActiveAdmins();
    if (activeAdminCount <= 1) {
      throw new ValidationError(
        'სისტემაში უნდა დარჩეს მინიმუმ ერთი აქტიური ადმინისტრატორი. ბოლო ადმინისტრატორის დეაქტივაცია ან როლის ჩამორთმევა დაუშვებელია.'
      );
    }
  }

  const dataToUpdate: Prisma.UserUpdateInput = {};
  if (data.isActive !== undefined) dataToUpdate.isActive = data.isActive;
  if (data.name !== undefined) dataToUpdate.name = data.name;
  if (data.role !== undefined) dataToUpdate.role = data.role;
  if (data.department !== undefined) dataToUpdate.department = data.department;
  if (data.password) {
    dataToUpdate.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    if (wouldRemoveAdmin) {
      await tx.$queryRawUnsafe(
        'SELECT id FROM "users" WHERE role = \'ADMIN\' AND "isActive" = true FOR UPDATE'
      );

      const activeAdminCountTx = await userRepository.countActiveAdmins(tx);
      if (activeAdminCountTx <= 1) {
        throw new ValidationError(
          'სისტემაში უნდა დარჩეს მინიმუმ ერთი აქტიური ადმინისტრატორი. ბოლო ადმინისტრატორის დეაქტივაცია ან როლის ჩამორთმევა დაუშვებელია.'
        );
      }
    }

    if (data.password || data.isActive === false) {
      await userRepository.invalidateSessions(id, tx);
    }

    return userRepository.update(id, dataToUpdate, tx);
  });

  let reason = 'ადმინისტრატორის მიერ მომხმარებლის პროფილის განახლება';
  if (data.isActive !== undefined) {
    reason = data.isActive ? 'მომხმარებლის გააქტიურება' : 'მომხმარებლის დეაქტივაცია';
  } else if (data.password) {
    reason = 'მომხმარებლის პაროლის განახლება ადმინისტრატორის მიერ';
  } else if (data.department !== undefined) {
    reason = `მომხმარებლის გუნდის ცვლილება: ${data.department}`;
  }

  await auditRepository.log({
    actorId: admin.id,
    action: 'USER_STATUS_CHANGED',
    entityType: 'USER',
    entityId: id,
    oldValues: {
      isActive: targetUser.isActive,
      name: targetUser.name,
      role: targetUser.role,
      department: targetUser.department,
    },
    newValues: {
      isActive: updatedUser.isActive,
      name: updatedUser.name,
      role: updatedUser.role,
      department: updatedUser.department,
    },
    reason,
  });

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    department: updatedUser.department,
    isActive: updatedUser.isActive,
  };
}
