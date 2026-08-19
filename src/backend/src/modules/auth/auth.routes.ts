import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { prisma } from '../../utils/db.js';
import { sendError } from '../../lib/errors.js';
import bcrypt from 'bcryptjs';

export const authRouter = new Hono();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionResponse(isAuthenticated: boolean) {
  return {
    data: {
      user: isAuthenticated ? { id: 1, display: 'Administrator' } : null,
      methods: [],
      flows: [{ id: 'login', is_pending: false }],
    },
    meta: { is_authenticated: isAuthenticated, session_token: null },
    status: 200,
  };
}

// ─── GET /auth/ (legacy MFA setup check) ───────────────────────────────────────
authRouter.get('/auth/', (c) => c.json({}));

// ─── GET /api/auth/v1/config ─────────────────────────────────────────────────
authRouter.get('/api/auth/v1/config', (c) =>
  c.json({
    data: {
      socialaccount: { providers: [] },
      mfa: { is_required: false, supported_types: [] },
      account: { authentication_method: 'username' },
      headless: true,
    },
  })
);

// ─── GET /api/auth/v1/auth/session ───────────────────────────────────────────
authRouter.get('/api/auth/v1/auth/session', (c) => {
  const session = getCookie(c, 'sessionid');
  return c.json(sessionResponse(!!session));
});

// ─── POST /api/auth/v1/auth/login ────────────────────────────────────────────
authRouter.post('/api/auth/v1/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return sendError(c, 400, 'Username and password are required');
    }

    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });

    if (!user) return sendError(c, 401, 'Invalid credentials');

    // Support both plain-text (seed) and bcrypt passwords
    let valid = false;
    if (user.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = password === user.password;
    }

    if (!valid) return sendError(c, 401, 'Invalid credentials');

    const sessionId = `sess_${user.id}_${Date.now()}`;
    const csrfToken = `csrf_${Math.random().toString(36).slice(2)}`;

    setCookie(c, 'sessionid', sessionId, { path: '/', httpOnly: true, sameSite: 'Lax' });
    setCookie(c, 'csrftoken', csrfToken, { path: '/', sameSite: 'Lax' });

    return c.json({
      data: { user: { id: user.id, display: user.username }, methods: [], flows: [] },
      meta: { is_authenticated: true, session_token: sessionId },
      status: 200,
    });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── DELETE /api/auth/v1/auth/session (logout) ───────────────────────────────
authRouter.delete('/api/auth/v1/auth/session', (c) => {
  deleteCookie(c, 'sessionid', { path: '/' });
  deleteCookie(c, 'csrftoken', { path: '/' });
  return c.json({ data: {}, meta: { is_authenticated: false }, status: 200 });
});

// ─── POST /api/auth/v1/auth/session (allauth compat) ─────────────────────────
authRouter.post('/api/auth/v1/auth/session', (c) => {
  const session = getCookie(c, 'sessionid');
  return c.json(sessionResponse(!!session));
});

// ─── Stubs for password/MFA endpoints ────────────────────────────────────────
authRouter.get('/api/auth/v1/account/authenticators', (c) => c.json({ data: [] }));
authRouter.get('/api/auth/v1/account/providers', (c) => c.json({ data: [] }));
authRouter.get('/api/auth/v1/account/email', (c) => c.json({ data: [] }));
authRouter.post('/api/auth/v1/auth/password/request', (c) => c.json({ data: {}, status: 200 }));
authRouter.post('/api/auth/v1/auth/password/reset', (c) => c.json({ data: {}, status: 200 }));
authRouter.post('/api/auth/v1/account/password/change', (c) => c.json({ data: {}, status: 200 }));
authRouter.post('/api/auth/v1/auth/reauthenticate', (c) => c.json({ data: {}, status: 200 }));
