import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate } from '../../lib/paginate.js';
import { dragonfly } from '../../utils/dragonfly.js';
import * as fs from 'fs';
import * as path from 'path';
import { sendError } from '../../lib/errors.js';

import { getGlobalSetting, setGlobalSetting, getUserSetting, setUserSetting } from './common.service.js';

export const commonRouter = new Hono();

// ─── API Root ─────────────────────────────────────────────────────────────────
commonRouter.get('/api', (c) => c.json({ server: 'InvenTree Node.js (Hono)', version: '0.17.0', django_version: 'N/A' }));

// ─── Version & License ────────────────────────────────────────────────────────
commonRouter.get('/api/version', (c) => c.json({ dev: false, up_to_date: true, version: '0.17.0', latest_version: '0.17.0', github: 'https://github.com/inventree/InvenTree' }));
commonRouter.get('/api/license', (c) => c.json({ license: 'MIT', libraries: [] }));

// ─── Settings ────────────────────────────────────────────────────────────────
commonRouter.get('/api/settings/global', async (c) => {
  try {
    const settings = await prisma.inventreesetting.findMany();
    const results = settings.map(setting => {
      const name = setting.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      let type = 'string';
      if (setting.value === 'True' || setting.value === 'False' || setting.value === 'true' || setting.value === 'false') type = 'boolean';
      else if (!isNaN(Number(setting.value)) && setting.value.trim() !== '') type = 'integer';

      return {
        pk: setting.id,
        key: setting.key,
        value: setting.value,
        name: name,
        description: `${name} configuration setting`,
        type: type,
        typ: type,
        choices: null
      };
    });
    return c.json(results);
  } catch { return c.json([]); }
});

commonRouter.get('/api/settings/global/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const value = await getGlobalSetting(key);
    return c.json({ key, value });
  } catch { return c.json({ key: c.req.param('key'), value: '' }); }
});

commonRouter.patch('/api/settings/global/:key', async (c) => {
  try {
    const body = await c.req.json();
    const key = c.req.param('key');
    await setGlobalSetting(key, body.value);
    return c.json({ key, value: body.value });
  } catch (err: any) { return c.json({ error: err.message }, 400); }
});

commonRouter.get('/api/settings/user', async (c) => {
  try {
    const settings = await prisma.inventreeusersetting.findMany();
    const results = settings.map(setting => {
      const name = setting.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      let type = 'string';
      if (setting.value === 'True' || setting.value === 'False' || setting.value === 'true' || setting.value === 'false') type = 'boolean';
      else if (!isNaN(Number(setting.value)) && setting.value.trim() !== '') type = 'integer';

      return {
        pk: setting.id,
        key: setting.key,
        value: setting.value,
        name: name,
        description: `User preference for ${name}`,
        type: type,
        typ: type,
        choices: null
      };
    });
    return c.json(results);
  } catch { return c.json([]); }
});

commonRouter.get('/api/settings/user/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const value = await getUserSetting(key, 1); // Mock user ID
    return c.json({ key, value });
  } catch { return c.json({ key: c.req.param('key'), value: '' }); }
});

commonRouter.patch('/api/settings/user/:key', async (c) => {
  try {
    const body = await c.req.json();
    const key = c.req.param('key');
    await setUserSetting(key, body.value, 1); // Mock user ID
    return c.json({ key, value: body.value });
  } catch (err: any) { return c.json({ error: err.message }, 400); }
});

// ─── Generic Status ───────────────────────────────────────────────────────────
commonRouter.get('/api/generic/status', (c) => c.json({
  BuildStatus: { 10: 'Pending', 20: 'Production', 25: 'On Hold', 30: 'Complete', 40: 'Cancelled' },
  PurchaseOrderStatus: { 10: 'Pending', 20: 'Placed', 30: 'Complete', 40: 'Cancelled' },
  SalesOrderStatus: { 10: 'Pending', 20: 'In Progress', 30: 'Shipped', 40: 'Complete', 50: 'Cancelled' },
  StockStatus: { 10: 'OK', 50: 'Attention needed', 55: 'Damaged', 60: 'Destroyed', 65: 'Rejected', 70: 'Lost', 85: 'Returned' },
  ReturnOrderStatus: { 10: 'Pending', 20: 'In Progress', 30: 'Complete', 40: 'Cancelled' },
}));
commonRouter.get('/api/generic/status/custom', (c) => c.json([]));

// ─── Notifications & News ─────────────────────────────────────────────────────
commonRouter.get('/api/notifications', async (c) => {
  try {
    const notifs = await prisma.notificationmessage.findMany({ orderBy: { id: 'desc' }, take: 50 });
    return c.json(paginate(notifs));
  } catch { return c.json(paginate([])); }
});
commonRouter.post('/api/notifications/readall', async (c) => { return c.json({ success: true }); });
commonRouter.get('/api/notifications/readall', (c) => c.json({ success: true }));

commonRouter.get('/api/news', async (c) => {
  try {
    const news = await prisma.newsfeedentry.findMany({ orderBy: { id: 'desc' }, take: 20 });
    return c.json(paginate(news));
  } catch { return c.json(paginate([])); }
});
commonRouter.patch('/api/news/:id', (c) => c.json({ success: true }));

// ─── Currency ─────────────────────────────────────────────────────────────────
commonRouter.get('/api/currency/exchange', (c) => c.json({ currency: 'USD', exchange_rates: { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5 }, updated: new Date().toISOString() }));
commonRouter.get('/api/currency/refresh', (c) => c.json({ success: true }));

// ─── Units & Icons ────────────────────────────────────────────────────────────
commonRouter.get('/api/units/all', (c) => c.json([]));

// ─── Icons ────────────────────────────────────────────────────────────────────
commonRouter.get('/api/icons', async (c) => {
  try {
    const iconsPath = path.resolve(process.cwd(), 'public', 'static', 'tabler-icons', 'icons.json');
    const iconsData = fs.readFileSync(iconsPath, 'utf-8');
    const tablerIcons = JSON.parse(iconsData);

    const response = [
      {
        name: 'Tabler Icons',
        prefix: 'ti',
        fonts: {
          woff2: '/static/tabler-icons/tabler-icons.woff2',
          woff: '/static/tabler-icons/tabler-icons.woff',
          truetype: '/static/tabler-icons/tabler-icons.ttf'
        },
        icons: tablerIcons
      }
    ];

    return c.json(response);
  } catch (err: any) {
    return sendError(c, 500, 'Failed to load icons: ' + err.message);
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────
commonRouter.get('/api/search', async (c) => {
  const q = c.req.query('search') ?? '';
  if (!q) return c.json({ parts: [], stock: [], categories: [] });
  try {
    const [parts, categories] = await Promise.all([
      prisma.part.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 10, select: { id: true, name: true, description: true } }),
      prisma.partcategory.findMany({ take: 5, select: { id: true } }),
    ]);
    return c.json({ parts: paginate(parts), categories: paginate(categories) });
  } catch { return c.json({ parts: [], categories: [] }); }
});
commonRouter.post('/api/search', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const q = body.search ?? '';
  if (!q) return c.json({});
  try {
    const parts = await prisma.part.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 10, select: { id: true, name: true, description: true } });
    return c.json({ part: paginate(parts) });
  } catch { return c.json({}); }
});

// ─── Background Tasks ─────────────────────────────────────────────────────────
commonRouter.get('/api/background-task', (c) => c.json(paginate([])));
commonRouter.get('/api/background-task/pending', (c) => c.json(paginate([])));
commonRouter.get('/api/background-task/scheduled', (c) => c.json(paginate([])));
commonRouter.get('/api/background-task/failed', (c) => c.json(paginate([])));

// ─── Project Codes ────────────────────────────────────────────────────────────
commonRouter.get('/api/project-code', async (c) => {
  try { const codes = await prisma.projectcode.findMany(); return c.json(paginate(codes)); }
  catch { return c.json(paginate([])); }
});
commonRouter.post('/api/project-code', async (c) => {
  try { const body = await c.req.json(); const code = await prisma.projectcode.create({ data: { code: body.code, description: body.description, active: body.active ?? true } }); return c.json(code, 201); }
  catch (err: any) { return c.json({ error: err.message }, 500); }
});
commonRouter.get('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { const code = await prisma.projectcode.findUnique({ where: { id } }); if (!code) return c.json({ error: 'Not found' }, 404); return c.json(code); }
  catch (err: any) { return c.json({ error: err.message }, 500); }
});
commonRouter.patch('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { const body = await c.req.json(); const updated = await prisma.projectcode.update({ where: { id }, data: { code: body.code, description: body.description, active: body.active } }); return c.json(updated); }
  catch (err: any) { return c.json({ error: err.message }, 500); }
});
commonRouter.delete('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.projectcode.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return c.json({ error: err.message }, 500); }
});

// ─── Content Type / Misc Stubs ────────────────────────────────────────────────
commonRouter.get('/api/contenttype', (c) => c.json(paginate([])));
commonRouter.get('/api/selection', async (c) => { try { const lists = await prisma.selectionlist.findMany(); return c.json(paginate(lists)); } catch { return c.json(paginate([])); } });
commonRouter.get('/api/attachment', async (c) => { try { const items = await prisma.attachment.findMany({ take: 100 }); return c.json(paginate(items)); } catch { return c.json(paginate([])); } });
commonRouter.get('/api/tag', (c) => c.json(paginate([])));
commonRouter.get('/api/parameter', async (c) => { try { const p = await prisma.parameter.findMany({ include: { template: { select: { name: true } } } }); return c.json(paginate(p)); } catch { return c.json(paginate([])); } });
commonRouter.get('/api/parameter/template', async (c) => { try { const t = await prisma.parametertemplate.findMany(); return c.json(paginate(t)); } catch { return c.json(paginate([])); } });
commonRouter.get('/api/data-output', (c) => c.json(paginate([])));
commonRouter.get('/api/error-report', (c) => c.json(paginate([])));
commonRouter.get('/api/units', async (c) => { try { const u = await prisma.customunit.findMany(); return c.json(paginate(u)); } catch { return c.json(paginate([])); } });
commonRouter.get('/api/barcode/history', (c) => c.json(paginate([])));
commonRouter.post('/api/barcode', (c) => c.json({}));
commonRouter.post('/api/barcode/generate', (c) => c.json({ barcode: '' }));
commonRouter.get('/api/admin/email', (c) => c.json(paginate([])));
commonRouter.post('/api/admin/email/test', (c) => c.json({ success: true }));
commonRouter.get('/api/admin/config', (c) => c.json([]));
commonRouter.post('/api/system-internal/observability/end', (c) => c.json({ success: true }));
commonRouter.get('/api/plugins/ui/features/:feature_type', (c) => c.json(paginate([])));
commonRouter.get('/api/plugins/status', (c) => c.json({ registry: { active_plugins: [] } }));
commonRouter.post('/api/generate/batch-code', (c) => c.json({ batch_code: `BATCH-${Date.now()}` }));
commonRouter.post('/api/generate/serial-number', (c) => c.json({ serial_number: Date.now() }));
commonRouter.post('/api/notes-image-upload', (c) => c.json({ url: '/media/notes-image.png' }));

// ─── System Health ────────────────────────────────────────────────────────────
commonRouter.get('/api/system/health', async (c) => {
  const health: Record<string, any> = { status: 'healthy', timestamp: new Date().toISOString(), services: {} };
  try { await prisma.$queryRaw`SELECT 1`; health.services.database = { status: 'connected' }; }
  catch { health.status = 'unhealthy'; health.services.database = { status: 'disconnected' }; }
  return c.json(health, health.status === 'unhealthy' ? 500 : 200);
});
