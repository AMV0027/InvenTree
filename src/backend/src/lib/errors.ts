import type { Context } from 'hono';

export type ApiError = {
  detail: string;
  code?: string;
};

/** Send a standardized error response */
export function sendError(c: Context, status: number, message: string): Response {
  return c.json({ detail: message } as ApiError, status as any);
}

/** Wrap async route handlers and catch DB/unexpected errors */
export async function handleAsync<T>(
  c: Context,
  fn: () => Promise<T>,
  notFoundMsg = 'Not found'
): Promise<Response> {
  try {
    const result = await fn();
    if (result === null || result === undefined) {
      return sendError(c, 404, notFoundMsg);
    }
    return c.json(result);
  } catch (err: any) {
    if (err?.code === 'P2025') return sendError(c, 404, notFoundMsg);
    if (err?.code === 'P2002') return sendError(c, 409, 'Duplicate entry');
    console.error('[API Error]', err?.message ?? err);
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
}
