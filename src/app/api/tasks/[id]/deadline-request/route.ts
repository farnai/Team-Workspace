import { handle } from '@/server/http/route';
import { getDeadlineRequestAction } from '@/server/actions/deadline-requests/get-deadline-request.action';
import { createDeadlineRequestAction } from '@/server/actions/deadline-requests/create-deadline-request.action';
import { reviewDeadlineRequestAction } from '@/server/actions/deadline-requests/review-deadline-request.action';

export const GET = handle(async (_req, { params }) => {
  const { id } = await params;
  return getDeadlineRequestAction(id);
});

export const POST = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return createDeadlineRequestAction(id, body);
});

export const PATCH = handle(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  return reviewDeadlineRequestAction(id, body);
});
