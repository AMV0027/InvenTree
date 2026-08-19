import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate, toInt, toFloat } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';
import { POStatus, checkOrderLocked, receivePurchaseOrderItems } from './orders.service.js';

export const purchaseRouter = new Hono();

// ─── Purchase Order Status Codes ──────────────────────────────────────────────

// ─── Line Items & Extra Lines (before /:pk wildcard) ─────────────────────────
purchaseRouter.get('/api/order/po-line', async (c) => {
  try {
    const lines = await prisma.purchaseorderlineitem.findMany({
      include: { order: { select: { id: true, reference: true } }, part: { select: { id: true, sku: true } } },
    });
    return c.json(paginate(lines));
  } catch { return c.json(paginate([])); }
});

purchaseRouter.post('/api/order/po-line', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.order) return sendError(c, 400, 'order required');
    await checkOrderLocked(toInt(body.order)!, 'purchase');
    
    const line = await prisma.purchaseorderlineitem.create({
      data: {
        orderId: toInt(body.order)!,
        partId: toInt(body.part),
        received: 0,
        purchasePrice: toFloat(body.purchase_price),
        destinationId: toInt(body.destination),
      },
    });
    return c.json(line, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.patch('/api/order/po-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.purchaseorderlineitem.findUnique({ where: { id } });
    if (line) await checkOrderLocked(line.orderId, 'purchase');
    
    const body = await c.req.json();
    const updated = await prisma.purchaseorderlineitem.update({ where: { id }, data: { purchasePrice: toFloat(body.purchase_price) } });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.delete('/api/order/po-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.purchaseorderlineitem.findUnique({ where: { id } });
    if (line) await checkOrderLocked(line.orderId, 'purchase');
    
    await prisma.purchaseorderlineitem.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.get('/api/order/po-extra-line', (c) => c.json(paginate([])));
purchaseRouter.post('/api/order/po-extra-line', async (c) => c.json({}, 201));

// ─── Purchase Order Actions (before /:pk wildcard) ───────────────────────────
purchaseRouter.post('/api/order/po/:pk/issue', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.purchaseorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    if (order.status !== POStatus.PENDING) return sendError(c, 400, 'Order must be in Pending status to issue');
    await prisma.purchaseorder.update({ where: { id }, data: { status: POStatus.PLACED } });
    return c.json({ success: true, status: POStatus.PLACED });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.post('/api/order/po/:pk/complete', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.purchaseorder.update({ where: { id }, data: { status: POStatus.COMPLETE, completeDate: new Date() } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.post('/api/order/po/:pk/cancel', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.purchaseorder.update({ where: { id }, data: { status: POStatus.CANCELLED } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.post('/api/order/po/:pk/hold', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.purchaseorder.update({ where: { id }, data: { status: POStatus.PENDING } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.post('/api/order/po/:pk/receive', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const { items, location } = body;
    if (!items?.length) return sendError(c, 400, 'items required');
    
    await receivePurchaseOrderItems(id, items, toInt(location));
    
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 400, err.message); }
});

// ─── Purchase Order CRUD ──────────────────────────────────────────────────────
purchaseRouter.get('/api/order/po', async (c) => {
  try {
    const orders = await prisma.purchaseorder.findMany({
      include: { supplier: { select: { id: true, name: true } }, destination: { select: { id: true } } },
      orderBy: { id: 'desc' },
    });
    return c.json(paginate(orders));
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.post('/api/order/po', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.reference) return sendError(c, 400, 'reference required');
    const order = await prisma.purchaseorder.create({
      data: {
        reference: body.reference, status: POStatus.PENDING,
        supplierReference: body.supplier_reference,
        supplierId: toInt(body.supplier),
        destinationId: toInt(body.destination),
      },
    });
    return c.json(order, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.get('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.purchaseorder.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseorderlineitem_orders: { include: { part: { select: { id: true, sku: true } } } },
      },
    });
    if (!order) return sendError(c, 404, 'Order not found');
    return c.json(order);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.patch('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.purchaseorder.update({
      where: { id },
      data: { reference: body.reference, supplierReference: body.supplier_reference, supplierId: toInt(body.supplier), destinationId: toInt(body.destination) },
    });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

purchaseRouter.delete('/api/order/po/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.purchaseorder.findUnique({ where: { id } });
    if (order?.status === POStatus.COMPLETE) return sendError(c, 400, 'Cannot delete a completed order');
    await prisma.purchaseorder.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) { return sendError(c, 500, err.message); }
});
