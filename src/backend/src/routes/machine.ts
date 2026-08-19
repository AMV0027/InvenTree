import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const machineRouter = new Hono();

// ==================== MACHINES ====================
// List machine configs
machineRouter.get('/api/machine', async (c) => {
  try {
    const configs = await prisma.machineconfig.findMany();
    return c.json({ count: configs.length, results: configs });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Create machine config
machineRouter.post('/api/machine', async (c) => {
  try {
    const body = await c.req.json();
    const { name, machineType, driver, active } = body;
    
    if (!name || !driver) {
      return c.json({ error: 'Name and driver are required' }, 400);
    }
    
    const config = await prisma.machineconfig.create({
      data: {
        name,
        machineType: machineType || 'generic',
        driver,
        active: active !== undefined ? active : true
      }
    });
    return c.json(config, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve machine config
machineRouter.get('/api/machine/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const config = await prisma.machineconfig.findUnique({
      where: { id },
      include: { machinesetting_machineConfigs: true }
    });
    if (!config) return c.json({ error: 'Machine config not found' }, 404);
    return c.json(config);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update machine config
machineRouter.put('/api/machine/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const { name, machineType, driver, active } = body;
    
    const updated = await prisma.machineconfig.update({
      where: { id },
      data: {
        name,
        machineType,
        driver,
        active
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete machine config
machineRouter.delete('/api/machine/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.machineconfig.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
