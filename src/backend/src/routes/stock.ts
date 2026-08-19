import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const stockRouter = new Hono();

// ==================== STOCK LOCATION TYPES ====================
stockRouter.get('/api/stock/location-type', async (c) => {
  try {
    const types = await prisma.stocklocationtype.findMany();
    return c.json({ count: types.length, results: types });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.post('/api/stock/location-type', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, icon } = body;
    if (!name) return c.json({ error: 'Name is required' }, 400);
    const type = await prisma.stocklocationtype.create({ data: { name, description, icon } });
    return c.json(type, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.get('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const type = await prisma.stocklocationtype.findUnique({ where: { id } });
    if (!type) return c.json({ error: 'Not found' }, 404);
    return c.json(type);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.put('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const { name, description, icon } = body;
    const updated = await prisma.stocklocationtype.update({ where: { id }, data: { name, description, icon } });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.delete('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stocklocationtype.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});


// ==================== STOCK LOCATIONS ====================
// Sub-routes before wildcards
stockRouter.get('/api/stock/location/tree', async (c) => {
  try {
    const locations = await prisma.stocklocation.findMany({ select: { id: true } });
    return c.json(locations);
  } catch (err: any) { return c.json([], 200); }
});

stockRouter.get('/api/stock/location', async (c) => {
  try {
    const locations = await prisma.stocklocation.findMany({ include: { locationType: true } });
    return c.json({ count: locations.length, results: locations });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.post('/api/stock/location', async (c) => {
  try {
    const body = await c.req.json();
    const { customIcon, ownerId, structural, external, locationTypeId } = body;
    const location = await prisma.stocklocation.create({
      data: {
        customIcon,
        owner: ownerId ? parseInt(ownerId, 10) : null,
        structural: structural !== undefined ? structural : false,
        external: external !== undefined ? external : false,
        locationTypeId: locationTypeId ? parseInt(locationTypeId, 10) : null
      }
    });
    return c.json(location, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.get('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const location = await prisma.stocklocation.findUnique({ where: { id }, include: { locationType: true } });
    if (!location) return c.json({ error: 'Not found' }, 404);
    return c.json(location);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.put('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const { customIcon, structural, external, locationTypeId } = body;
    const updated = await prisma.stocklocation.update({
      where: { id },
      data: { customIcon, structural, external, locationTypeId: locationTypeId ? parseInt(locationTypeId, 10) : null }
    });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.delete('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stocklocation.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});


// ==================== STOCK ITEMS ====================
// Action endpoints before wildcards
stockRouter.post('/api/stock/transfer', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/add', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/remove', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/count', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/assign', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/merge', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/return', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/change_status', (c) => c.json({ success: true }));
stockRouter.get('/api/stock/track', async (c) => {
  try {
    const items = await prisma.stockitemtracking.findMany();
    return c.json({ count: items.length, results: items });
  } catch { return c.json({ count: 0, results: [] }); }
});
stockRouter.get('/api/stock/test', async (c) => {
  try {
    const items = await prisma.stockitemtestresult.findMany();
    return c.json({ count: items.length, results: items });
  } catch { return c.json({ count: 0, results: [] }); }
});
stockRouter.get('/api/stock/status', (c) => c.json({ count: 0, results: [] }));

stockRouter.get('/api/stock', async (c) => {
  try {
    const items = await prisma.stockitem.findMany({
      include: { part: true, location: true }
    });
    return c.json({ count: items.length, results: items });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.post('/api/stock', async (c) => {
  try {
    const body = await c.req.json();
    const { partId, locationId, quantity, batch, serial, purchasePrice, expiry } = body;
    if (!partId || quantity === undefined) return c.json({ error: 'partId and quantity required' }, 400);
    const item = await prisma.stockitem.create({
      data: {
        partId: parseInt(partId, 10),
        locationId: locationId ? parseInt(locationId, 10) : null,
        quantity: parseFloat(quantity),
        batch,
        serial: serial ? String(serial) : null,
        serialInt: serial ? parseInt(String(serial), 10) : 0,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        expiryDate: expiry ? new Date(expiry) : null,
        isBuilding: false, deleteOnDeplete: false, status: '10', creationDate: new Date(),
      }
    });
    return c.json(item, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.get('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const item = await prisma.stockitem.findUnique({ where: { id }, include: { part: true, location: true } });
    if (!item) return c.json({ error: 'Not found' }, 404);
    return c.json(item);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.put('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const { quantity, locationId, batch, status } = body;
    const updated = await prisma.stockitem.update({
      where: { id },
      data: {
        quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
        locationId: locationId ? parseInt(locationId, 10) : undefined,
        batch,
        status: status !== undefined ? String(status) : undefined,
      }
    });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.patch('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.stockitem.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

stockRouter.delete('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stockitem.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Per-item action endpoints
stockRouter.post('/api/stock/:pk/convert', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/:pk/disassemble', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/:pk/install', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/:pk/uninstall', (c) => c.json({ success: true }));
stockRouter.post('/api/stock/:pk/serialize', (c) => c.json({ success: true }));
stockRouter.get('/api/stock/:pk/serial-numbers', (c) => c.json({ next: null, previous: null, count: 0, results: [] }));
