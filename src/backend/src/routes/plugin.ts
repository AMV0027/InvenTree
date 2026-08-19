import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const pluginRouter = new Hono();

// ==================== PLUGINS ====================
// List all plugin configs
pluginRouter.get('/api/plugins', async (c) => {
  try {
    const configs = await prisma.pluginconfig.findMany();
    // Frontend expects an array here, not a paginated {count, results} response
    return c.json(configs);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Create plugin config record
pluginRouter.post('/api/plugin', async (c) => {
  try {
    const body = await c.req.json();
    const { key, name, packageName, active } = body;
    
    if (!key) return c.json({ error: 'Key is required' }, 400);
    
    const config = await prisma.pluginconfig.create({
      data: {
        key,
        name,
        packageName,
        active: active !== undefined ? active : false
      }
    });
    return c.json(config, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve plugin config
pluginRouter.get('/api/plugin/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const config = await prisma.pluginconfig.findUnique({
      where: { id },
      include: { pluginsetting_plugins: true }
    });
    if (!config) return c.json({ error: 'Plugin config not found' }, 404);
    return c.json(config);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update plugin config
pluginRouter.put('/api/plugin/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const { name, packageName, active } = body;
    
    const updated = await prisma.pluginconfig.update({
      where: { id },
      data: {
        name,
        packageName,
        active
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete plugin config
pluginRouter.delete('/api/plugin/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.pluginconfig.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
