import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const orderRouter = new Hono();

const listOf = (items: any[]) => ({ count: items.length, results: items });

// ==================== PURCHASE ORDERS ====================
// Action endpoints before wildcards
orderRouter.post('/api/order/po/:pk/issue', (c) => c.json({ success: true }));
orderRouter.post('/api/order/po/:pk/hold', (c) => c.json({ success: true }));
orderRouter.post('/api/order/po/:pk/cancel', (c) => c.json({ success: true }));
orderRouter.post('/api/order/po/:pk/complete', (c) => c.json({ success: true }));
orderRouter.post('/api/order/po/:pk/receive', (c) => c.json({ success: true }));

// Line items
orderRouter.get('/api/order/po-line', async (c) => {
  try {
    const lines = await prisma.purchaseorderlineitem.findMany();
    return c.json(listOf(lines));
  } catch { return c.json(listOf([])); }
});
orderRouter.post('/api/order/po-line', async (c) => c.json({}, 201));
orderRouter.put('/api/order/po-line/:pk', async (c) => c.json({}));
orderRouter.patch('/api/order/po-line/:pk', async (c) => c.json({}));
orderRouter.delete('/api/order/po-line/:pk', async (c) => c.json({ success: true }));
orderRouter.get('/api/order/po-extra-line', (c) => c.json(listOf([])));
orderRouter.post('/api/order/po-extra-line', async (c) => c.json({}, 201));

orderRouter.get('/api/order/po', async (c) => {
  try {
    const orders = await prisma.purchaseorder.findMany({ include: { supplier: true } });
    return c.json(listOf(orders));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.post('/api/order/po', async (c) => {
  try {
    const body = await c.req.json();
    const { reference, status, supplierReference, supplierId, receivedById, destinationId } = body;
    if (!reference) return c.json({ error: 'Reference is required' }, 400);
    const order = await prisma.purchaseorder.create({
      data: { reference, status: status || '10', supplierReference, supplierId: supplierId ? parseInt(supplierId, 10) : null, receivedById: receivedById ? parseInt(receivedById, 10) : null, destinationId: destinationId ? parseInt(destinationId, 10) : null }
    });
    return c.json(order, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.get('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.purchaseorder.findUnique({ where: { id }, include: { supplier: true } });
    if (!order) return c.json({ error: 'Not found' }, 404);
    return c.json(order);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.put('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.purchaseorder.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.patch('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.purchaseorder.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.delete('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.purchaseorder.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// ==================== SALES ORDERS ====================
orderRouter.post('/api/order/so/:pk/issue', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/hold', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/cancel', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/ship', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/complete', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/allocate', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/allocate-serials', (c) => c.json({ success: true }));
orderRouter.post('/api/order/so/:pk/auto-allocate', (c) => c.json({ success: true }));

// Shipments
orderRouter.get('/api/order/so/shipment', (c) => c.json(listOf([])));
orderRouter.post('/api/order/so/shipment', async (c) => c.json({}, 201));
orderRouter.post('/api/order/so/shipment/:pk/ship', (c) => c.json({ success: true }));

orderRouter.get('/api/order/so-line', async (c) => {
  try {
    const lines = await prisma.salesorderlineitem.findMany();
    return c.json(listOf(lines));
  } catch { return c.json(listOf([])); }
});
orderRouter.post('/api/order/so-line', async (c) => c.json({}, 201));
orderRouter.put('/api/order/so-line/:pk', async (c) => c.json({}));
orderRouter.patch('/api/order/so-line/:pk', async (c) => c.json({}));
orderRouter.delete('/api/order/so-line/:pk', async (c) => c.json({ success: true }));
orderRouter.get('/api/order/so-extra-line', (c) => c.json(listOf([])));
orderRouter.get('/api/order/so-allocation', (c) => c.json(listOf([])));

orderRouter.get('/api/order/so', async (c) => {
  try {
    const orders = await prisma.salesorder.findMany({ include: { customer: true } });
    return c.json(listOf(orders));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.post('/api/order/so', async (c) => {
  try {
    const body = await c.req.json();
    const order = await prisma.salesorder.create({ data: body });
    return c.json(order, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.get('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id }, include: { customer: true } });
    if (!order) return c.json({ error: 'Not found' }, 404);
    return c.json(order);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.put('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.salesorder.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.delete('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.salesorder.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// ==================== RETURN ORDERS ====================
orderRouter.post('/api/order/ro/:pk/issue', (c) => c.json({ success: true }));
orderRouter.post('/api/order/ro/:pk/hold', (c) => c.json({ success: true }));
orderRouter.post('/api/order/ro/:pk/cancel', (c) => c.json({ success: true }));
orderRouter.post('/api/order/ro/:pk/complete', (c) => c.json({ success: true }));
orderRouter.post('/api/order/ro/:pk/receive', (c) => c.json({ success: true }));

orderRouter.get('/api/order/ro-line', (c) => c.json(listOf([])));
orderRouter.post('/api/order/ro-line', async (c) => c.json({}, 201));
orderRouter.get('/api/order/ro-extra-line', (c) => c.json(listOf([])));

orderRouter.get('/api/order/ro', async (c) => {
  try {
    const orders = await prisma.returnorder.findMany({ include: { customer: true } });
    return c.json(listOf(orders));
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.post('/api/order/ro', async (c) => {
  try {
    const body = await c.req.json();
    const order = await prisma.returnorder.create({ data: body });
    return c.json(order, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.get('/api/order/ro/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.returnorder.findUnique({ where: { id } });
    if (!order) return c.json({ error: 'Not found' }, 404);
    return c.json(order);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

orderRouter.delete('/api/order/ro/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.returnorder.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// ==================== TRANSFER ORDERS ====================
orderRouter.get('/api/order/transfer-order', (c) => c.json(listOf([])));
orderRouter.post('/api/order/transfer-order', async (c) => c.json({}, 201));
orderRouter.get('/api/order/transfer-order/:pk', async (c) => c.json({}));
orderRouter.post('/api/order/transfer-order/:pk/issue', (c) => c.json({ success: true }));
orderRouter.post('/api/order/transfer-order/:pk/hold', (c) => c.json({ success: true }));
orderRouter.post('/api/order/transfer-order/:pk/cancel', (c) => c.json({ success: true }));
orderRouter.post('/api/order/transfer-order/:pk/complete', (c) => c.json({ success: true }));
orderRouter.post('/api/order/transfer-order/:pk/allocate', (c) => c.json({ success: true }));
orderRouter.post('/api/order/transfer-order/:pk/allocate-serials', (c) => c.json({ success: true }));
orderRouter.get('/api/order/transfer-order-line', (c) => c.json(listOf([])));
orderRouter.get('/api/order/transfer-order-allocation', (c) => c.json(listOf([])));
