import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { prisma } from '../../utils/db.js';
import { paginate } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';

export const usersRouter = new Hono();

// ─── GET /api/user/me ─────────────────────────────────────────────────────────
usersRouter.get('/api/user/me', async (c) => {
  const session = getCookie(c, 'sessionid');
  if (!session) return sendError(c, 401, 'Not authenticated');

  try {
    const user = await prisma.user.findFirst({
      include: { userprofile_users: true },
    });
    if (!user) return sendError(c, 404, 'User not found');

    const profile = user.userprofile_users[0] ?? null;

    return c.json({
      pk: user.id,
      username: user.username,
      first_name: profile?.displayname?.split(' ')[0] ?? 'InvenTree',
      last_name: profile?.displayname?.split(' ').slice(1).join(' ') ?? 'Administrator',
      email: user.email ?? '',
      is_staff: user.isStaff,
      is_superuser: user.isSuperuser,
      groups: [],
      profile: profile
        ? {
            language: profile.language ?? 'en',
            theme: profile.theme ?? {},
            widgets: profile.widgets ?? null,
            displayname: profile.displayname ?? '',
            position: profile.position ?? '',
            status: profile.status ?? '',
            location: profile.location ?? '',
          }
        : null,
      roles: {
        all: ['view', 'add', 'change', 'delete'],
      },
      permissions: {},
    });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── GET /api/user/me/profile ─────────────────────────────────────────────────
usersRouter.get('/api/user/me/profile', async (c) => {
  const session = getCookie(c, 'sessionid');
  if (!session) return sendError(c, 401, 'Not authenticated');
  try {
    const profile = await prisma.userprofile.findFirst();
    return c.json(profile ?? {});
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── PUT /api/user/me/profile ─────────────────────────────────────────────────
usersRouter.put('/api/user/me/profile', async (c) => {
  try {
    const body = await c.req.json();
    const profile = await prisma.userprofile.findFirst();
    if (!profile) return sendError(c, 404, 'Profile not found');
    const updated = await prisma.userprofile.update({
      where: { id: profile.id },
      data: {
        language: body.language,
        theme: body.theme,
        widgets: body.widgets,
        displayname: body.displayname,
        position: body.position,
        status: body.status,
        location: body.location,
        contact: body.contact,
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── GET /api/user/me/token ───────────────────────────────────────────────────
usersRouter.get('/api/user/me/token', (c) => c.json({ token: 'dev-token-12345' }));

// ─── GET /api/user (list) ─────────────────────────────────────────────────────
usersRouter.get('/api/user', async (c) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, isStaff: true, isSuperuser: true },
    });
    return c.json(paginate(users));
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── GET /api/user/:pk ────────────────────────────────────────────────────────
usersRouter.get('/api/user/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return sendError(c, 400, 'Invalid ID');
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, isStaff: true, isSuperuser: true },
    });
    if (!user) return sendError(c, 404, 'User not found');
    return c.json(user);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── GET /api/user/group ─────────────────────────────────────────────────────
usersRouter.get('/api/user/group', async (c) => {
  try {
    const groups = await prisma.group.findMany();
    return c.json(paginate(groups));
  } catch { return c.json(paginate([])); }
});

// ─── GET /api/user/owner ─────────────────────────────────────────────────────
usersRouter.get('/api/user/owner', async (c) => {
  try {
    const owners = await prisma.owner.findMany();
    return c.json(paginate(owners));
  } catch { return c.json(paginate([])); }
});

// ─── GET /api/user/ruleset ────────────────────────────────────────────────────
usersRouter.get('/api/user/ruleset', async (c) => {
  try {
    const rules = await prisma.ruleset.findMany({ include: { group: true } });
    return c.json(paginate(rules));
  } catch { return c.json(paginate([])); }
});

// ─── GET /api/user/tokens ─────────────────────────────────────────────────────
usersRouter.get('/api/user/tokens', async (c) => {
  try {
    const tokens = await prisma.apitoken.findMany({
      select: { id: true, name: true, expiry: true, lastSeen: true, revoked: true },
    });
    return c.json(paginate(tokens));
  } catch { return c.json(paginate([])); }
});
