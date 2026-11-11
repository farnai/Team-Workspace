import { handle } from '@/server/http/route';
import { listAuditLogsAction } from '@/server/actions/audit/list-audit-logs.action';

export const GET = handle(async (req) => {
  const { searchParams } = new URL(req.url);
  const rawLimit = searchParams.get('limit');
  const rawPage = searchParams.get('page');

  return listAuditLogsAction({
    taskId: searchParams.get('taskId'),
    actorId: searchParams.get('actorId'),
    action: searchParams.get('action'),
    search: searchParams.get('search'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    limit: rawLimit ? parseInt(rawLimit, 10) : undefined,
    page: rawPage ? parseInt(rawPage, 10) : undefined,
  });
});
