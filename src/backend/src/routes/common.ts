import { Hono } from 'hono';
import { prisma } from '../utils/db.js';
import { dragonfly } from '../utils/dragonfly.js';
import { minioClient, bucketName } from '../utils/minio.js';
import { ListBucketsCommand } from '@aws-sdk/client-s3';

export const commonRouter = new Hono();

// ==================== SYSTEM HEALTH CHECK ====================
commonRouter.get('/api/system/health', async (c) => {
  const health: Record<string, any> = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {}
  };
  
  // 1. Check PostgreSQL (Prisma)
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = { status: 'connected' };
  } catch (err: any) {
    health.status = 'unhealthy';
    health.services.database = { status: 'disconnected', error: err.message };
  }
  
  // 2. Check Dragonfly (Redis)
  try {
    await dragonfly.ping();
    health.services.cache = { status: 'connected' };
  } catch (err: any) {
    health.status = 'unhealthy';
    health.services.cache = { status: 'disconnected', error: err.message };
  }
  
  // 3. Check MinIO (S3)
  try {
    await minioClient.send(new ListBucketsCommand({}));
    health.services.storage = { status: 'connected', bucket: bucketName };
  } catch (err: any) {
    health.status = 'unhealthy';
    health.services.storage = { status: 'disconnected', error: err.message };
  }
  
  if (health.status === 'unhealthy') {
    return c.json(health, 500);
  }
  
  return c.json(health);
});

// ==================== GLOBAL SETTINGS ====================
// Get all global settings
commonRouter.get('/api/settings/global', async (c) => {
  try {
    const cached = await dragonfly.get('settings:global');
    if (cached) {
      return c.json(JSON.parse(cached));
    }
    
    const settings = await prisma.baseinventreesetting.findMany();
    await dragonfly.set('settings:global', JSON.stringify(settings), 'EX', 300);
    return c.json({ count: settings.length, results: settings });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Get single global setting by key
commonRouter.get('/api/settings/global/:key', async (c) => {
  const key = c.req.param('key');
  try {
    const cached = await dragonfly.get(`setting:global:${key}`);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
    
    const setting = await prisma.baseinventreesetting.findFirst({
      where: { key }
    });
    
    if (!setting) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    
    await dragonfly.set(`setting:global:${key}`, JSON.stringify(setting), 'EX', 300);
    return c.json(setting);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create/Update global setting
commonRouter.post('/api/settings/global', async (c) => {
  try {
    const body = await c.req.json();
    const { key, value } = body;
    
    if (!key) {
      return c.json({ error: 'Key is required' }, 400);
    }
    
    const setting = await prisma.baseinventreesetting.upsert({
      where: { id: body.id || -1 },
      update: { key, value },
      create: { key, value }
    });
    
    await dragonfly.del('settings:global');
    await dragonfly.del(`setting:global:${key}`);
    
    return c.json(setting, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update global setting by key
commonRouter.put('/api/settings/global/:key', async (c) => {
  const key = c.req.param('key');
  try {
    const body = await c.req.json();
    const { value } = body;
    
    const existing = await prisma.baseinventreesetting.findFirst({
      where: { key }
    });
    
    if (!existing) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    
    const updated = await prisma.baseinventreesetting.update({
      where: { id: existing.id },
      data: { value }
    });
    
    await dragonfly.del('settings:global');
    await dragonfly.del(`setting:global:${key}`);
    
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete global setting by key
commonRouter.delete('/api/settings/global/:key', async (c) => {
  const key = c.req.param('key');
  try {
    const existing = await prisma.baseinventreesetting.findFirst({
      where: { key }
    });
    
    if (!existing) {
      return c.json({ error: 'Setting not found' }, 404);
    }
    
    await prisma.baseinventreesetting.delete({
      where: { id: existing.id }
    });
    
    await dragonfly.del('settings:global');
    await dragonfly.del(`setting:global:${key}`);
    
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ==================== PROJECT CODES ====================
commonRouter.get('/api/project-code', async (c) => {
  try {
    const codes = await prisma.projectcode.findMany();
    return c.json({ count: codes.length, results: codes });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

commonRouter.get('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const code = await prisma.projectcode.findUnique({ where: { id } });
    if (!code) return c.json({ error: 'Project code not found' }, 404);
    return c.json(code);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

commonRouter.post('/api/project-code', async (c) => {
  try {
    const body = await c.req.json();
    const { code, description, active, responsibleId } = body;
    
    if (!code || !description) {
      return c.json({ error: 'Code and description are required' }, 400);
    }
    
    const newCode = await prisma.projectcode.create({
      data: {
        code,
        description,
        active: active !== undefined ? active : true,
        responsibleId: responsibleId ? parseInt(responsibleId, 10) : null
      }
    });
    
    return c.json(newCode, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

commonRouter.put('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const { code, description, active, responsibleId } = body;
    
    const updated = await prisma.projectcode.update({
      where: { id },
      data: {
        code,
        description,
        active,
        responsibleId: responsibleId ? parseInt(responsibleId, 10) : null
      }
    });
    
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

commonRouter.delete('/api/project-code/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.projectcode.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ==================== NEWS / NOTIFICATIONS ====================
commonRouter.get('/api/news', (c) => c.json({ count: 0, results: [] }));
commonRouter.patch('/api/news/:id', (c) => c.json({ success: true }));

commonRouter.get('/api/notifications', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/notifications/readall', (c) => c.json({ success: true }));
commonRouter.post('/api/notifications/readall', (c) => c.json({ success: true }));

// ==================== VERSION / LICENSE ====================
commonRouter.get('/api/version', (c) => c.json({
  dev: false,
  up_to_date: true,
  version: '0.17.0',
  latest_version: '0.17.0',
  github: 'https://github.com/inventree/InvenTree'
}));

commonRouter.get('/api/license', (c) => c.json({ license: 'MIT', libraries: [] }));

// ==================== AUTH CONFIG ====================
commonRouter.get('/api/auth/v1/config', (c) => c.json({
  data: {
    socialaccount: { providers: [] },
    mfa: { is_required: false, supported_types: [] },
    account: { authentication_method: 'username' },
    headless: true
  }
}));

// ==================== GENERIC STATUS ====================
commonRouter.get('/api/generic/status', (c) => c.json({}));
commonRouter.get('/api/generic/status/custom', (c) => c.json([]));

// ==================== CURRENCY ====================
commonRouter.get('/api/currency/exchange', (c) => c.json({ currency: 'USD', exchange_rates: {}, updated: new Date().toISOString() }));
commonRouter.get('/api/currency/refresh', (c) => c.json({ success: true }));

// ==================== UNITS / ICONS ====================
commonRouter.get('/api/units/all', (c) => c.json([]));
commonRouter.get('/api/icons', (c) => c.json([]));

// ==================== SEARCH ====================
commonRouter.get('/api/search', (c) => c.json({ results: [] }));
commonRouter.post('/api/search', (c) => c.json({ results: [] }));

// ==================== BACKGROUND TASKS ====================
commonRouter.get('/api/background-task', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/background-task/pending', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/background-task/scheduled', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/background-task/failed', (c) => c.json({ count: 0, results: [] }));

// ==================== ATTACHMENT / ERROR REPORT ====================
commonRouter.get('/api/attachment', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/error-report', (c) => c.json({ count: 0, results: [] }));

// ==================== CUSTOM UNITS / TAGS / PARAMETER ====================
commonRouter.get('/api/units', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/tag', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/parameter', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/parameter/template', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/contenttype', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/selection', (c) => c.json({ count: 0, results: [] }));

// ==================== DATA OUTPUT ====================
commonRouter.get('/api/data-output', (c) => c.json({ count: 0, results: [] }));

// ==================== ADMIN ENDPOINTS ====================
commonRouter.get('/api/admin/email', (c) => c.json({ count: 0, results: [] }));
commonRouter.post('/api/admin/email/test', (c) => c.json({ success: true }));
commonRouter.get('/api/admin/config', (c) => c.json([]));

// ==================== SYSTEM INTERNAL ====================
commonRouter.post('/api/system-internal/observability/end', (c) => c.json({ success: true }));

// ==================== USER EXTRAS ====================
commonRouter.get('/api/user', (c) => c.json({ count: 1, results: [] }));
commonRouter.get('/api/user/group', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/user/owner', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/user/ruleset', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/user/tokens', (c) => c.json({ count: 0, results: [] }));

// ==================== BARCODE ====================
commonRouter.post('/api/barcode', (c) => c.json({}));
commonRouter.get('/api/barcode/history', (c) => c.json({ count: 0, results: [] }));
commonRouter.post('/api/barcode/generate', (c) => c.json({ barcode: '' }));

// ==================== PLUGIN UI FEATURES ====================
commonRouter.get('/api/plugins/ui/features/:feature_type', (c) => c.json({ count: 0, results: [] }));
commonRouter.get('/api/plugins/status', (c) => c.json({ registry: { active_plugins: [] } }));

// ==================== API ROOT (empty schema) ====================
commonRouter.get('/api', (c) => c.json({ server: 'InvenTree Node.js', version: '0.17.0' }));
