import { handle } from '@/server/http/route';
import { requireUser } from '@/server/auth/session';
import { updateTestCaseDto } from '@/server/dto/test-case.dto';
import { getTestCaseAction } from '@/server/actions/test-cases/get-test-case.action';
import { updateTestCaseAction } from '@/server/actions/test-cases/update-test-case.action';
import { deleteTestCaseAction } from '@/server/actions/test-cases/delete-test-case.action';

export const GET = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const testCase = await getTestCaseAction(id, user);
  return { testCase };
});

export const PATCH = handle(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = updateTestCaseDto.parse(await req.json());
  const testCase = await updateTestCaseAction(id, input, user);
  return { testCase };
});

export const DELETE = handle(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  return deleteTestCaseAction(id, user);
});
