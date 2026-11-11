import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/auth/session';
import { createCommentDto } from '@/server/dto/comment.dto';
import { commentRepository } from '@/server/repositories/comment.repository';
import { auditRepository } from '@/server/repositories/audit.repository';

export async function createCommentAction(taskId: string, input: unknown) {
  const user = await requireUser();
  const data = createCommentDto.parse(input);

  return prisma.$transaction(async (tx) => {
    const created = await commentRepository.create(
      {
        taskId,
        userId: user.id,
        content: data.content,
      },
      tx
    );

    await auditRepository.log(
      {
        taskId,
        actorId: user.id,
        action: 'COMMENT_ADDED',
        entityType: 'COMMENT',
        entityId: created.id,
        newValues: { snippet: data.content.slice(0, 100) },
        reason: 'ახალი კომენტარის დამატება',
      },
      tx
    );

    return created;
  });
}

