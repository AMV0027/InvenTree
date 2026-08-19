import { Hono } from 'hono';
import { authRouter } from '../../modules/auth/auth.routes.js';
import { usersRouter } from '../../modules/users/users.routes.js';
import { categoriesRouter } from '../../modules/parts/categories.routes.js';
import { partsRouter } from '../../modules/parts/parts.routes.js';
import { bomRouter } from '../../modules/parts/bom.routes.js';
import { stockRouter } from '../../modules/stock/stock.routes.js';
import { purchaseRouter } from '../../modules/orders/purchase.routes.js';
import { salesRouter, returnRouter, transferRouter } from '../../modules/orders/sales.routes.js';
import { buildRouter } from '../../modules/build/build.routes.js';
import { companyRouter } from '../../modules/company/company.routes.js';
import { commonRouter } from '../../modules/common/common.routes.js';

export function createTestApp(): Hono {
  const app = new Hono({ strict: false });

  // Mount routers in identical order to index.ts
  app.route('/', authRouter);
  app.route('/', usersRouter);
  app.route('/', categoriesRouter);
  app.route('/', bomRouter);
  app.route('/', partsRouter);
  app.route('/', stockRouter);
  app.route('/', purchaseRouter);
  app.route('/', salesRouter);
  app.route('/', returnRouter);
  app.route('/', transferRouter);
  app.route('/', buildRouter);
  app.route('/', companyRouter);
  app.route('/', commonRouter);

  return app;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export async function requestJson<T = any>(
  app: Hono,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const reqInit: RequestInit = {
    method,
    headers: reqHeaders,
  };

  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    reqInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const res = await app.request(path, reqInit);
  let parsedBody: any = null;
  const text = await res.text();
  if (text && text.trim().length > 0) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  return {
    status: res.status,
    body: parsedBody,
    headers: res.headers,
  };
}

export const api = {
  get: <T = any>(app: Hono, path: string, headers?: Record<string, string>) =>
    requestJson<T>(app, 'GET', path, undefined, headers),
  post: <T = any>(app: Hono, path: string, body?: any, headers?: Record<string, string>) =>
    requestJson<T>(app, 'POST', path, body, headers),
  patch: <T = any>(app: Hono, path: string, body?: any, headers?: Record<string, string>) =>
    requestJson<T>(app, 'PATCH', path, body, headers),
  put: <T = any>(app: Hono, path: string, body?: any, headers?: Record<string, string>) =>
    requestJson<T>(app, 'PUT', path, body, headers),
  delete: <T = any>(app: Hono, path: string, headers?: Record<string, string>) =>
    requestJson<T>(app, 'DELETE', path, undefined, headers),
};
