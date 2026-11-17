import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/server/http/errors';
import { userRepository } from '@/server/repositories/user.repository';
import { auditRepository } from '@/server/repositories/audit.repository';
import { Role, AuditAction, User } from '@prisma/client';

export async function deleteUserAction(id: string, adminUser?: User) {
  const admin = adminUser || (await requireAdmin());

  const targetUser = await userRepository.findById(id);
  if (!targetUser || targetUser.isDeleted) {
    throw new NotFoundError('მომხმარებელი ვერ მოიძებნა');
  }

  if (id === admin.id) {
    throw new ValidationError('საკუთარი ადმინისტრატორის ანგარიშის წაშლა შეუძლებელია');
  }

  if (targetUser.role === Role.ADMIN) {
    const activeAdminCount = await userRepository.countActiveAdmins();
    if (activeAdminCount <= 1) {
      throw new ValidationError(
        'სისტემაში უნდა დარჩეს მინიმუმ ერთი აქტიური ადმინისტრატორი. ბოლო ადმინისტრატორის წაშლა დაუშვებელია.'
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    if (targetUser.role === Role.ADMIN) {
      await tx.$queryRawUnsafe(
        'SELECT id FROM "users" WHERE role = \'ADMIN\' AND "isActive" = true AND "isDeleted" = false FOR UPDATE'
      );

      const activeAdminCountTx = await userRepository.countActiveAdmins(tx);
      if (activeAdminCountTx <= 1) {
        throw new ValidationError(
          'სისტემაში უნდა დარჩეს მინიმუმ ერთი აქტიური ადმინისტრატორი. ბოლო ადმინისტრატორის წაშლა დაუშვებელია.'
        );
      }
    }

    // 1. Unassign from all active (in-progress/planned/backlog) tasks, stages, and subtasks, and clear deadlines
    await userRepository.unassignFromActiveTasksAndClearDeadlines(id, tx);

    // 2. Invalidate all user sessions immediately
    await userRepository.invalidateSessions(id, tx);

    // 3. Remove user notifications
    await tx.notification.deleteMany({
      where: { userId: id },
    });

    // 4. Soft-delete user: preserves name and ID for historical completed tasks/subtasks and audit events
    await userRepository.softDelete(id, targetUser.email, tx);
  });

  // Log deletion in audit history
  await auditRepository.log({
    actorId: admin.id,
    action: AuditAction.USER_DELETED,
    entityType: 'USER',
    entityId: id,
    oldValues: {
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      department: targetUser.department,
      isActive: targetUser.isActive,
    },
    newValues: {
      isDeleted: true,
      isActive: false,
    },
    reason: `მომხმარებლის (${targetUser.name}) წაშლა ადმინისტრატორის მიერ. მიმდინარე ტასკებიდან განულდა და დედლაინები გაუქმდა, არქივის ისტორია შენარჩუნებულია.`,
  });

  return {
    success: true,
    message: `მომხმარებელი (${targetUser.name}) წარმატებით წაიშალა`,
  };
}
