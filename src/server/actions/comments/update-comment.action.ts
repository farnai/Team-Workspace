import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { NotFoundError, ForbiddenError } from '@/server/http/errors';
import { updateCommentDto } from '@/server/dto/comment.dto';
import { canManageComment } from '@/server/policies/comment.policy';
import { commentRepository } from '@/server/repositories/comment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function updateCommentAction(id: string, input: unknown) {
  const user = await requireUser();
  const data = updateCommentDto.parse(input);

  const existing = await commentRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('კომენტარი ვერ მოიძებნა');
  }

  if (!canManageComment(user, existing)) {
    throw new ForbiddenError('არ გაქვთ ამ კომენტარის რედაქტირების უფლება');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await commentRepository.update(id, { content: data.content.trim() }, tx);

    await auditRepository.log(
      {
        taskId: existing.taskId,
        actorId: user.id,
        action: 'TASK_UPDATED',
        entityType: 'COMMENT',
        entityId: id,
        oldValues: { content: existing.content },
        newValues: { content: updated.content },
        reason: 'კომენტარის რედაქტირება',
      },
      tx
    );

    return updated;
  });
}

