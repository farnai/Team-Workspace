import 'server-only';
import { requireUser } from '@/server/auth/session';
import { dailyUpdateRepository } from '@/server/repositories/daily-update.repository';

export async function listDailyUpdatesAction(taskId: string) {
  await requireUser();
  return dailyUpdateRepository.findByTaskId(taskId);
}

