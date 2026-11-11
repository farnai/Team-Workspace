import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './errors';

export function handle<C = any>(
  fn: (req: Request, ctx: C) => Promise<unknown>,
  statusCode = 200
) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await fn(req, ctx);
      const body =
        typeof result === 'object' && result !== null && !Array.isArray(result)
          ? { data: result, ...result }
          : { data: result };
      return NextResponse.json(body, { status: statusCode });
    } catch (err) {
      if (
        (err as { digest?: string })?.digest?.startsWith('NEXT_') ||
        (err as { digest?: string })?.digest === 'HANGING_PROMISE_REJECTION'
      ) {
        throw err;
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? 'არასწორი მონაცემები' },
          { status: 422 }
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: 'სერვერის შეცდომა' }, { status: 500 });
    }
  };
}
