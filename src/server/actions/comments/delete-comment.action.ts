import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { canManageComment } from '@/server/policies/comment.policy';
import { commentRepository } from '@/server/repositories/comment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function deleteCommentAction(id: string) {
  const user = await requireUser();

  const existing = await commentRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('კომენტარი ვერ მოიძებნა');
  }

  if (!canManageComment(user, existing)) {
    throw new ForbiddenError('არ გაქვთ ამ კომენტარის წაშლის უფლება');
  }

  await prisma.$transaction(async (tx) => {
    await commentRepository.delete(id, tx);

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'COMMENT_DELETED',
        entityType: 'COMMENT',
        entityId: id,
        oldValues: { content: existing.content },
        reason: 'კომენტარის წაშლა',
      },
      tx
    );
  });

  return { message: 'კომენტარი წარმატებით წაიშალა' };
}

