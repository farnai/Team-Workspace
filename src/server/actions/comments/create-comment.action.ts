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

    // Notify users @mentioned in the comment
    if (data.content.includes('@')) {
      const [task, activeUsers] = await Promise.all([
        tx.task.findUnique({
          where: { id: taskId },
          select: { taskNumber: true, title: true },
        }),
        tx.user.findMany({
          where: { isActive: true, id: { not: user.id } },
          select: { id: true, name: true },
        }),
      ]);

      if (task) {
        const lowerContent = data.content.toLowerCase();
        // Sort longest names first so "Giorgi Koberidze" matches before "Giorgi"
        const sortedUsers = [...activeUsers].sort(
          (a, b) => b.name.length - a.name.length
        );
        const mentionedUserIds = new Set<string>();

        for (const candidate of sortedUsers) {
          const needle = `@${candidate.name.toLowerCase()}`;
          if (lowerContent.includes(needle)) {
            mentionedUserIds.add(candidate.id);
          }
        }

        const snippet =
          data.content.length > 120
            ? `${data.content.slice(0, 120)}...`
            : data.content;

        for (const recipientId of mentionedUserIds) {
          await tx.notification.create({
            data: {
              userId: recipientId,
              taskId,
              title: 'კომენტარში მოგნიშნეს',
              message: `${user.name}-მა მოგნიშნათ კომენტარში დავალებაზე #${task.taskNumber} (${task.title}): "${snippet}"`,
            },
          });
        }
      }
    }

    return created;
  });
}

