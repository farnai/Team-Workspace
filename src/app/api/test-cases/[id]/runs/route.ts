import { handle } from '@/server/http/route';
import { requireUser } from '@/server/auth/session';
import { createTestRunDto } from '@/server/dto/test-case.dto';
import { createTestRunAction } from '@/server/actions/test-cases/create-test-run.action';

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = createTestRunDto.parse(await req.json());
  const run = await createTestRunAction(id, input, user);
  return { run };
}, 201);
