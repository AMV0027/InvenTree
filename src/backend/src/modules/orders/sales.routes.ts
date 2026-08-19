import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate, toInt, toFloat } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';
import {
  SOStatus,
  ROStatus,
  TOStatus,
  OrderServiceError,
  allocateSalesOrderStock,
  allocateSalesOrderSerials,
  autoAllocateSalesOrder,
  holdReturnOrder,
  receiveReturnOrderItems,
  issueTransferOrder,
  holdTransferOrder,
  cancelTransferOrder,
  allocateTransferOrderStock,
  allocateTransferOrderSerials,
  completeTransferOrder,
} from './orders.service.js';

export const salesRouter = new Hono();
export const returnRouter = new Hono();
export const transferRouter = new Hono();

function handleOrderError(c: any, err: any) {
  if (err instanceof OrderServiceError) {
    return sendError(c, err.statusCode, err.message);
  }
  const msg = err?.message || 'Internal server error';
  const status = msg.toLowerCase().includes('not found') ? 404 : 400;
  return sendError(c, status, msg);
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── SALES ORDERS ─────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ─── Sales Order Line Items ───────────────────────────────────────────────────
salesRouter.get('/api/order/so-line', async (c) => {
  try {
    const orderId = toInt(c.req.query('order'));
    const lines = await prisma.salesorderlineitem.findMany({
      where: orderId ? { orderId } : undefined,
      include: {
        order: { select: { id: true, reference: true } },
        part: { select: { id: true, name: true, IPN: true } },
        salesorderallocation_lines: true,
      },
    });
    return c.json(paginate(lines));
  } catch {
    return c.json(paginate([]));
  }
});

salesRouter.post('/api/order/so-line', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.order || !body.part) return sendError(c, 400, 'order and part required');
    const line = await prisma.salesorderlineitem.create({
      data: {
        orderId: toInt(body.order)!,
        partId: toInt(body.part)!,
        shipped: 0,
        salePrice: toFloat(body.sale_price),
      },
    });
    return c.json(line, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.get('/api/order/so-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.salesorderlineitem.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, reference: true } },
        part: { select: { id: true, name: true, IPN: true } },
        salesorderallocation_lines: true,
      },
    });
    if (!line) return sendError(c, 404, 'Line item not found');
    return c.json(line);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.patch('/api/order/so-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.salesorderlineitem.update({
      where: { id },
      data: {
        salePrice: toFloat(body.sale_price),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.delete('/api/order/so-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.salesorderlineitem.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.get('/api/order/so-extra-line', (c) => c.json(paginate([])));
salesRouter.post('/api/order/so-extra-line', (c) => c.json({}, 201));

// ─── Sales Order Allocations ──────────────────────────────────────────────────
salesRouter.get('/api/order/so-allocation', async (c) => {
  try {
    const lineId = toInt(c.req.query('line'));
    const allocs = await prisma.salesorderallocation.findMany({
      where: lineId ? { lineId } : undefined,
      include: {
        item: { select: { id: true, quantity: true, serial: true, status: true, partId: true } },
        line: { select: { id: true, orderId: true, partId: true } },
      },
    });
    return c.json(paginate(allocs));
  } catch {
    return c.json(paginate([]));
  }
});

salesRouter.post('/api/order/so-allocation', async (c) => {
  try {
    const body = await c.req.json();
    const alloc = await prisma.salesorderallocation.create({
      data: {
        lineId: toInt(body.line)!,
        itemId: toInt(body.item)!,
        quantity: toFloat(body.quantity) || 1,
        shipmentId: toInt(body.shipment) || null,
      },
    });
    return c.json(alloc, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.delete('/api/order/so-allocation/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.salesorderallocation.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

// ─── Sales Order Shipments ────────────────────────────────────────────────────
salesRouter.get('/api/order/so/shipment', async (c) => {
  try {
    const orderId = toInt(c.req.query('order'));
    const shipments = await prisma.salesordershipment.findMany({
      where: orderId ? { orderId } : undefined,
      include: { order: { select: { id: true, reference: true } } },
    });
    return c.json(paginate(shipments));
  } catch {
    return c.json(paginate([]));
  }
});

salesRouter.post('/api/order/so/shipment', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.order) return sendError(c, 400, 'order required');
    const shipment = await prisma.salesordershipment.create({
      data: {
        orderId: toInt(body.order)!,
        reference: body.reference ?? '',
        trackingNumber: body.tracking_number,
        invoiceNumber: body.invoice_number,
      },
    });
    return c.json(shipment, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.get('/api/order/so/shipment/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const shipment = await prisma.salesordershipment.findUnique({
      where: { id },
      include: { order: true, salesorderallocation_shipments: true },
    });
    if (!shipment) return sendError(c, 404, 'Shipment not found');
    return c.json(shipment);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.patch('/api/order/so/shipment/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const shipment = await prisma.salesordershipment.update({
      where: { id },
      data: {
        reference: body.reference,
        trackingNumber: body.tracking_number,
        invoiceNumber: body.invoice_number,
      },
    });
    return c.json(shipment);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.delete('/api/order/so/shipment/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.salesordershipment.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/shipment/:pk/ship', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const shipment = await prisma.salesordershipment.update({
      where: { id },
      data: { shipmentDate: new Date() },
    });
    return c.json(shipment);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

// ─── Sales Order Actions ──────────────────────────────────────────────────────
salesRouter.post('/api/order/so/:pk/issue', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    await prisma.salesorder.update({ where: { id }, data: { status: SOStatus.IN_PROGRESS } });
    return c.json({ success: true, status: SOStatus.IN_PROGRESS });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/ship', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    await prisma.salesorder.update({
      where: { id },
      data: { status: SOStatus.SHIPPED, shipmentDate: new Date() },
    });
    return c.json({ success: true, status: SOStatus.SHIPPED });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/complete', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    await prisma.salesorder.update({ where: { id }, data: { status: SOStatus.COMPLETE } });
    return c.json({ success: true, status: SOStatus.COMPLETE });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/cancel', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    await prisma.salesorder.update({ where: { id }, data: { status: SOStatus.CANCELLED } });
    return c.json({ success: true, status: SOStatus.CANCELLED });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/hold', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Order not found');
    await prisma.salesorder.update({ where: { id }, data: { status: SOStatus.ON_HOLD } });
    return c.json({ success: true, status: SOStatus.ON_HOLD });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);
    const result = await allocateSalesOrderStock(id, items, toInt(body.shipment ?? body.shipmentId));
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/allocate-serials', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const lineItemId = toInt(body.line_item ?? body.line ?? body.lineItemId);
    const result = await allocateSalesOrderSerials(
      id,
      lineItemId!,
      body.quantity !== undefined ? toInt(body.quantity) : undefined,
      body.serial_numbers ?? body.serials ?? body.serial_list ?? body.serialNumbers,
      toInt(body.shipment ?? body.shipmentId)
    );
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so/:pk/auto-allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const sortStrategy = body.stock_sort_by ?? body.strategy ?? body.sort_by ?? body.sort;
    const result = await autoAllocateSalesOrder(id, {
      location: toInt(body.location ?? body.location_id),
      exclude_location: toInt(body.exclude_location ?? body.exclude_location_id),
      shipment: toInt(body.shipment ?? body.shipment_id),
      interchangeable: body.interchangeable !== undefined ? Boolean(body.interchangeable) : true,
      stock_sort_by: sortStrategy ? String(sortStrategy) : undefined,
      serialized_stock: body.serialized_stock,
      line_items: Array.isArray(body.line_items) ? body.line_items.map(Number) : Array.isArray(body.lines) ? body.lines.map(Number) : body.line ? [Number(body.line)] : undefined,
    });
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

// ─── Sales Order CRUD ─────────────────────────────────────────────────────────
salesRouter.get('/api/order/so', async (c) => {
  try {
    const orders = await prisma.salesorder.findMany({
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { id: 'desc' },
    });
    return c.json(paginate(orders));
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.post('/api/order/so', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.reference) return sendError(c, 400, 'reference required');
    const order = await prisma.salesorder.create({
      data: {
        reference: body.reference,
        status: SOStatus.PENDING,
        customerReference: body.customer_reference,
        customerId: toInt(body.customer),
      },
    });
    return c.json(order, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.get('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({
      where: { id },
      include: {
        customer: true,
        salesorderlineitem_orders: {
          include: {
            part: { select: { id: true, name: true } },
            salesorderallocation_lines: true,
          },
        },
        salesordershipment_orders: true,
      },
    });
    if (!order) return sendError(c, 404, 'Order not found');
    return c.json(order);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.patch('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.salesorder.update({
      where: { id },
      data: {
        reference: body.reference,
        customerReference: body.customer_reference,
        customerId: toInt(body.customer),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

salesRouter.delete('/api/order/so/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.salesorder.findUnique({ where: { id } });
    if (order?.status === SOStatus.COMPLETE) {
      return sendError(c, 400, 'Cannot delete a completed order');
    }
    await prisma.salesorder.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── RETURN ORDERS ────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

returnRouter.get('/api/order/ro-line', async (c) => {
  try {
    const orderId = toInt(c.req.query('order'));
    const lines = await prisma.returnorderlineitem.findMany({
      where: orderId ? { orderId } : undefined,
      include: {
        order: { select: { id: true, reference: true } },
        item: { select: { id: true, quantity: true, serial: true, status: true, partId: true } },
      },
    });
    return c.json(paginate(lines));
  } catch {
    return c.json(paginate([]));
  }
});

returnRouter.post('/api/order/ro-line', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.order || !body.item) return sendError(c, 400, 'order and item required');
    const line = await prisma.returnorderlineitem.create({
      data: {
        orderId: toInt(body.order)!,
        itemId: toInt(body.item)!,
        quantity: toFloat(body.quantity) || 1,
        outcome: body.outcome ?? '10',
        price: toFloat(body.price),
      },
    });
    return c.json(line, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.get('/api/order/ro-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.returnorderlineitem.findUnique({
      where: { id },
      include: { order: true, item: true },
    });
    if (!line) return sendError(c, 404, 'Line item not found');
    return c.json(line);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.patch('/api/order/ro-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.returnorderlineitem.update({
      where: { id },
      data: {
        quantity: toFloat(body.quantity),
        outcome: body.outcome,
        price: toFloat(body.price),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.delete('/api/order/ro-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.returnorderlineitem.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.get('/api/order/ro-extra-line', (c) => c.json(paginate([])));
returnRouter.post('/api/order/ro-extra-line', (c) => c.json({}, 201));

returnRouter.post('/api/order/ro/:pk/issue', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.returnorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Return order not found');
    await prisma.returnorder.update({ where: { id }, data: { status: ROStatus.IN_PROGRESS } });
    return c.json({ success: true, status: ROStatus.IN_PROGRESS });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.post('/api/order/ro/:pk/cancel', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.returnorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Return order not found');
    await prisma.returnorder.update({ where: { id }, data: { status: ROStatus.CANCELLED } });
    return c.json({ success: true, status: ROStatus.CANCELLED });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.post('/api/order/ro/:pk/complete', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.returnorder.findUnique({ where: { id } });
    if (!order) return sendError(c, 404, 'Return order not found');
    await prisma.returnorder.update({
      where: { id },
      data: { status: ROStatus.COMPLETE, completeDate: new Date() },
    });
    return c.json({ success: true, status: ROStatus.COMPLETE });
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.post('/api/order/ro/:pk/hold', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const result = await holdReturnOrder(id);
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.post('/api/order/ro/:pk/receive', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : (body.line_item || body.item ? [body] : []);
    const result = await receiveReturnOrderItems(
      id,
      items,
      toInt(body.location ?? body.location_id ?? body.destination),
      body.note ?? body.notes
    );
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.get('/api/order/ro', async (c) => {
  try {
    const orders = await prisma.returnorder.findMany({
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { id: 'desc' },
    });
    return c.json(paginate(orders));
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.post('/api/order/ro', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.reference) return sendError(c, 400, 'reference required');
    const order = await prisma.returnorder.create({
      data: {
        reference: body.reference,
        status: ROStatus.PENDING,
        customerId: toInt(body.customer),
        customerReference: body.customer_reference,
      },
    });
    return c.json(order, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.get('/api/order/ro/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const o = await prisma.returnorder.findUnique({
      where: { id },
      include: {
        customer: true,
        returnorderlineitem_orders: { include: { item: true } },
      },
    });
    if (!o) return sendError(c, 404, 'Not found');
    return c.json(o);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.patch('/api/order/ro/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.returnorder.update({
      where: { id },
      data: {
        reference: body.reference,
        customerReference: body.customer_reference,
        customerId: toInt(body.customer),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

returnRouter.delete('/api/order/ro/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.returnorder.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── TRANSFER ORDERS ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

transferRouter.get('/api/order/transfer-order-line', async (c) => {
  try {
    const orderId = toInt(c.req.query('order'));
    const lines = await prisma.transferorderlineitem.findMany({
      where: orderId ? { orderId } : undefined,
      include: {
        order: { select: { id: true, reference: true } },
        part: { select: { id: true, name: true, IPN: true } },
        transferorderallocation_lines: true,
      },
    });
    return c.json(paginate(lines));
  } catch {
    return c.json(paginate([]));
  }
});

transferRouter.post('/api/order/transfer-order-line', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.order || !body.part) return sendError(c, 400, 'order and part required');
    const line = await prisma.transferorderlineitem.create({
      data: {
        orderId: toInt(body.order)!,
        partId: toInt(body.part)!,
        transferred: 0,
      },
    });
    return c.json(line, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.get('/api/order/transfer-order-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.transferorderlineitem.findUnique({
      where: { id },
      include: {
        order: true,
        part: true,
        transferorderallocation_lines: true,
      },
    });
    if (!line) return sendError(c, 404, 'Line item not found');
    return c.json(line);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.patch('/api/order/transfer-order-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.transferorderlineitem.update({
      where: { id },
      data: {
        partId: toInt(body.part),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.delete('/api/order/transfer-order-line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.transferorderlineitem.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.get('/api/order/transfer-order-allocation', async (c) => {
  try {
    const lineId = toInt(c.req.query('line'));
    const allocs = await prisma.transferorderallocation.findMany({
      where: lineId ? { lineId } : undefined,
      include: {
        item: { select: { id: true, quantity: true, serial: true, status: true, partId: true } },
        line: { select: { id: true, orderId: true, partId: true } },
      },
    });
    return c.json(paginate(allocs));
  } catch {
    return c.json(paginate([]));
  }
});

transferRouter.post('/api/order/transfer-order-allocation', async (c) => {
  try {
    const body = await c.req.json();
    const alloc = await prisma.transferorderallocation.create({
      data: {
        lineId: toInt(body.line)!,
        itemId: toInt(body.item)!,
        quantity: toFloat(body.quantity) || 1,
      },
    });
    return c.json(alloc, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.delete('/api/order/transfer-order-allocation/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.transferorderallocation.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.get('/api/order/transfer-order', async (c) => {
  try {
    const orders = await prisma.transferorder.findMany({
      include: {
        takeFrom: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    });
    return c.json(paginate(orders));
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.reference) return sendError(c, 400, 'reference required');
    const order = await prisma.transferorder.create({
      data: {
        reference: body.reference,
        status: TOStatus.PENDING,
        takeFromId: toInt(body.take_from),
        destinationId: toInt(body.destination),
        consume: Boolean(body.consume),
      },
    });
    return c.json(order, 201);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.get('/api/order/transfer-order/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.transferorder.findUnique({
      where: { id },
      include: {
        takeFrom: true,
        destination: true,
        transferorderlineitem_orders: {
          include: {
            part: { select: { id: true, name: true } },
            transferorderallocation_lines: { include: { item: true } },
          },
        },
      },
    });
    if (!order) return sendError(c, 404, 'Transfer order not found');
    return c.json(order);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.patch('/api/order/transfer-order/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.transferorder.update({
      where: { id },
      data: {
        reference: body.reference,
        takeFromId: toInt(body.take_from),
        destinationId: toInt(body.destination),
        consume: body.consume !== undefined ? Boolean(body.consume) : undefined,
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.delete('/api/order/transfer-order/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const order = await prisma.transferorder.findUnique({ where: { id } });
    if (order?.status === TOStatus.COMPLETE) {
      return sendError(c, 400, 'Cannot delete a completed order');
    }
    await prisma.transferorder.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/issue', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const result = await issueTransferOrder(id);
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/hold', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const result = await holdTransferOrder(id);
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/cancel', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const result = await cancelTransferOrder(id);
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/complete', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await completeTransferOrder(id, Boolean(body.accept_incomplete_allocation));
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);
    const result = await allocateTransferOrderStock(id, items);
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});

transferRouter.post('/api/order/transfer-order/:pk/allocate-serials', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const lineItemId = toInt(body.line_item ?? body.line ?? body.lineItemId);
    const result = await allocateTransferOrderSerials(
      id,
      lineItemId!,
      body.quantity !== undefined ? toInt(body.quantity) : undefined,
      body.serial_numbers ?? body.serials ?? body.serial_list
    );
    return c.json(result, 200);
  } catch (err: any) {
    return handleOrderError(c, err);
  }
});
