import { handle } from '@/server/http/route';
import { requireUser } from '@/server/auth/session';
import { createTestCaseDto } from '@/server/dto/test-case.dto';
import { listTaskTestCasesAction } from '@/server/actions/test-cases/list-test-cases.action';
import { createTestCaseAction } from '@/server/actions/test-cases/create-test-case.action';

export const GET = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const testCases = await listTaskTestCasesAction(id, user);
  return { testCases };
});

export const POST = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = createTestCaseDto.parse(await req.json());
  const testCase = await createTestCaseAction(id, input, user);
  return { testCase };
}, 201);
