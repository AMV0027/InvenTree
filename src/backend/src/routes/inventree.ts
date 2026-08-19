import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const inventreeRouter = new Hono();

// ==================== SEARCH ====================
inventreeRouter.get('/api/search', async (c) => {
  const query = c.req.query('q') || '';
  try {
    const parts = await prisma.part.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 10
    });
    
    const locations = await prisma.stocklocation.findMany({
      where: {
        customIcon: { contains: query, mode: 'insensitive' }
      },
      take: 10
    });
    
    return c.json({ parts, locations });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ==================== GENERATORS ====================
// Generate Batch Code
inventreeRouter.post('/api/generate/batch-code', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const batchCode = `BATCH-${today}-${rand}`;
    return c.json({ batchCode });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

inventreeRouter.get('/api/generate/batch-code', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const batchCode = `BATCH-${today}-${rand}`;
    return c.json({ batchCode });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Generate Serial Number
inventreeRouter.post('/api/generate/serial-number', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const partId = body.partId ? parseInt(body.partId, 10) : null;
    
    let nextSerial = 1;
    if (partId) {
      const highest = await prisma.stockitem.findFirst({
        where: { partId },
        orderBy: { serialInt: 'desc' }
      });
      if (highest && highest.serialInt) {
        nextSerial = highest.serialInt + 1;
      }
    } else {
      const highest = await prisma.stockitem.findFirst({
        orderBy: { serialInt: 'desc' }
      });
      if (highest && highest.serialInt) {
        nextSerial = highest.serialInt + 1;
      }
    }
    
    return c.json({ serialNumber: nextSerial });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

inventreeRouter.get('/api/generate/serial-number', async (c) => {
  try {
    const highest = await prisma.stockitem.findFirst({
      orderBy: { serialInt: 'desc' }
    });
    const nextSerial = highest && highest.serialInt ? highest.serialInt + 1 : 1;
    return c.json({ serialNumber: nextSerial });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ==================== SYSTEM INFO ====================
inventreeRouter.get('/api/version', (c) => {
  return c.json({
    version: '1.0.0-node',
    api_version: 1,
    server: 'hono-nodejs',
    database: 'postgresql',
    cache: 'dragonfly'
  });
});

inventreeRouter.get('/api', (c) => {
  return c.json({
    title: 'InvenTree API',
    description: 'Scaffolding Hono Node.js backend rewrite of InvenTree',
    version: '1.0.0-node'
  });
});
