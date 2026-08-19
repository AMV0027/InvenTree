import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate, toInt, toFloat } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';
import {
  TrackingType,
  createTrackingEntry,
  validateStockItem,
  handleStockItemUpdate,
  mergeStockItems,
  returnStockItems,
  convertStockItem,
  installStockItem,
  uninstallStockItem,
  serializeStockItem,
} from './stock.service.js';

export const stockRouter = new Hono();

// ─── Location sub-routes BEFORE /:pk wildcard ─────────────────────────────────
stockRouter.get('/api/stock/location/tree', async (c) => {
  try {
    const locs = await prisma.stocklocation.findMany({
      select: { id: true, structural: true, external: true, locationTypeId: true },
    });
    return c.json(locs);
  } catch {
    return c.json([]);
  }
});

stockRouter.get('/api/stock/location-type', async (c) => {
  try {
    const types = await prisma.stocklocationtype.findMany();
    return c.json(paginate(types));
  } catch {
    return c.json(paginate([]));
  }
});

stockRouter.post('/api/stock/location-type', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return sendError(c, 400, 'name required');
    const type = await prisma.stocklocationtype.create({
      data: { name: body.name, description: body.description, icon: body.icon },
    });
    return c.json(type, 201);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.get('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const t = await prisma.stocklocationtype.findUnique({ where: { id } });
    if (!t) return sendError(c, 404, 'Not found');
    return c.json(t);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.patch('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.stocklocationtype.update({
      where: { id },
      data: { name: body.name, description: body.description, icon: body.icon },
    });
    return c.json(updated);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.delete('/api/stock/location-type/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stocklocationtype.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── Stock Locations ──────────────────────────────────────────────────────────
stockRouter.get('/api/stock/location', async (c) => {
  try {
    const locs = await prisma.stocklocation.findMany({ include: { locationType: true } });
    return c.json(paginate(locs));
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/location', async (c) => {
  try {
    const body = await c.req.json();
    const loc = await prisma.stocklocation.create({
      data: {
        structural: body.structural ?? false,
        external: body.external ?? false,
        customIcon: body.custom_icon,
        locationTypeId: toInt(body.location_type),
      },
    });
    return c.json(loc, 201);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.get('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const loc = await prisma.stocklocation.findUnique({
      where: { id },
      include: { locationType: true },
    });
    if (!loc) return sendError(c, 404, 'Not found');
    const itemCount = await prisma.stockitem.count({ where: { locationId: id } });
    return c.json({ ...loc, items: itemCount });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.patch('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.stocklocation.update({
      where: { id },
      data: {
        structural: body.structural,
        external: body.external,
        customIcon: body.custom_icon,
        locationTypeId: toInt(body.location_type),
      },
    });
    return c.json(updated);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.delete('/api/stock/location/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const items = await prisma.stockitem.count({ where: { locationId: id } });
    if (items > 0) return sendError(c, 400, `Cannot delete: location has ${items} stock items`);
    await prisma.stocklocation.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// ─── Stock Action endpoints BEFORE /:pk wildcard ──────────────────────────────
stockRouter.post('/api/stock/transfer', async (c) => {
  try {
    const body = await c.req.json();
    const { items, location, notes } = body;
    if (!location || !items?.length) return sendError(c, 400, 'location and items required');
    await Promise.all(
      items.map(async (item: any) => {
        await prisma.stockitem.update({ where: { id: item.pk }, data: { locationId: toInt(location) } });
        await createTrackingEntry(item.pk, TrackingType.MOVED, notes ?? 'Transferred', { location });
      })
    );
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/add', async (c) => {
  try {
    const body = await c.req.json();
    const { items, notes } = body;
    await Promise.all(
      items.map(async (item: any) => {
        const current = await prisma.stockitem.findUnique({ where: { id: item.pk }, select: { quantity: true } });
        const newQty = (current?.quantity.toNumber() ?? 0) + (item.quantity ?? 0);
        await prisma.stockitem.update({ where: { id: item.pk }, data: { quantity: newQty } });
        await createTrackingEntry(item.pk, TrackingType.ADD, notes ?? 'Stock added', { quantity: item.quantity });
      })
    );
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/remove', async (c) => {
  try {
    const body = await c.req.json();
    const { items, notes } = body;
    await Promise.all(
      items.map(async (item: any) => {
        const current = await prisma.stockitem.findUnique({ where: { id: item.pk }, select: { quantity: true } });
        const newQty = Math.max(0, (current?.quantity.toNumber() ?? 0) - (item.quantity ?? 0));
        await prisma.stockitem.update({ where: { id: item.pk }, data: { quantity: newQty } });
        await createTrackingEntry(item.pk, TrackingType.REMOVE, notes ?? 'Stock removed', { quantity: item.quantity });
      })
    );
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/count', async (c) => {
  try {
    const body = await c.req.json();
    const { items, notes } = body;
    await Promise.all(
      items.map(async (item: any) => {
        await prisma.stockitem.update({
          where: { id: item.pk },
          data: { quantity: item.quantity, stocktakeDate: new Date() },
        });
        await createTrackingEntry(item.pk, TrackingType.COUNTED, notes ?? 'Stock counted', { quantity: item.quantity });
      })
    );
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/assign', async (c) => {
  try {
    const body = await c.req.json();
    const { items, customer } = body;
    await Promise.all(
      items.map((item: any) =>
        prisma.stockitem.update({ where: { id: item.item.pk }, data: { customerId: toInt(customer) } })
      )
    );
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock/merge', async (c) => {
  try {
    const body = await c.req.json();
    const targetId = toInt(body.target);
    let rawItems = body.items;
    if (!Array.isArray(rawItems)) rawItems = [];

    let itemPks: number[] = [];
    if (targetId) {
      const otherIds = rawItems
        .map((i: any) => (typeof i === 'number' ? i : toInt(i.pk ?? i.item ?? i.id)))
        .filter(Boolean) as number[];
      itemPks = [targetId, ...otherIds];
    } else {
      itemPks = rawItems
        .map((i: any) => (typeof i === 'number' ? i : toInt(i.pk ?? i.item ?? i.id)))
        .filter(Boolean) as number[];
    }

    if (itemPks.length < 2) {
      return sendError(c, 400, 'At least two stock items must be provided');
    }

    let location = toInt(body.location ?? body.destination);
    if (!location && targetId) {
      const targetItem = await prisma.stockitem.findUnique({ where: { id: targetId } });
      if (!targetItem) return sendError(c, 404, 'Target stock item not found');
      location = targetItem.locationId ?? undefined;
    }
    if (!location && itemPks.length > 0) {
      const baseItem = await prisma.stockitem.findUnique({ where: { id: itemPks[0] } });
      if (baseItem?.locationId) location = baseItem.locationId;
    }
    if (!location) {
      return sendError(c, 400, 'location required');
    }

    const result = await mergeStockItems({
      items: itemPks,
      location,
      notes: body.notes ?? body.note,
      allow_mismatched_suppliers: body.allow_mismatched_suppliers ?? false,
      allow_mismatched_status: body.allow_mismatched_status ?? false,
    });
    return c.json(result, 200);
  } catch (err: any) {
    const status = (err.message.includes('not found') || err.message.includes('does not exist')) ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/return', async (c) => {
  try {
    const body = await c.req.json();
    const topLocation = toInt(body.location ?? body.destination);
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return sendError(c, 400, 'Items list cannot be empty');
    }

    const items = rawItems.map((entry: any) => {
      const pk = toInt(entry.pk ?? entry.item ?? entry.id);
      const itemLoc = toInt(entry.location ?? entry.locationId) ?? topLocation;
      return {
        pk: pk!,
        quantity: entry.quantity !== undefined ? toFloat(entry.quantity) : undefined,
        location: itemLoc,
        status: entry.status !== undefined ? String(entry.status) : undefined,
      };
    });

    const result = await returnStockItems({
      items,
      location: topLocation,
      merge: body.merge ?? false,
      notes: body.notes ?? body.note,
    });
    return c.json(result, 200);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/change_status', async (c) => {
  try {
    const body = await c.req.json();
    await prisma.stockitem.updateMany({
      where: { id: { in: body.items?.map((i: any) => i.pk) ?? [] } },
      data: { status: String(body.status) },
    });
    return c.json({ success: true });
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.get('/api/stock/track', async (c) => {
  try {
    const tracking = await prisma.stockitemtracking.findMany({
      include: { item: { select: { id: true } }, user: { select: { id: true, username: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    });
    return c.json(paginate(tracking));
  } catch {
    return c.json(paginate([]));
  }
});

stockRouter.get('/api/stock/test', async (c) => {
  try {
    const results = await prisma.stockitemtestresult.findMany({
      include: { stockItem: { select: { id: true } }, template: { select: { testName: true } } },
    });
    return c.json(paginate(results));
  } catch {
    return c.json(paginate([]));
  }
});

stockRouter.get('/api/stock/status', (c) => c.json({ count: 0, results: [] }));

// ─── Stock Item CRUD ──────────────────────────────────────────────────────────
stockRouter.get('/api/stock', async (c) => {
  try {
    const items = await prisma.stockitem.findMany({
      include: { part: { select: { id: true, name: true, units: true } }, location: { select: { id: true } } },
      orderBy: { id: 'desc' },
      take: 500,
    });
    return c.json(paginate(items));
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.post('/api/stock', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.part || body.quantity === undefined) return sendError(c, 400, 'part and quantity required');

    await validateStockItem({
      partId: toInt(body.part)!,
      quantity: toFloat(body.quantity) ?? 0,
      serial: body.serial ? String(body.serial) : null,
    });

    const item = await prisma.stockitem.create({
      data: {
        partId: toInt(body.part)!,
        locationId: toInt(body.location),
        quantity: toFloat(body.quantity) ?? 0,
        batch: body.batch,
        serial: body.serial ? String(body.serial) : null,
        serialInt: toInt(body.serial) ?? 0,
        purchasePrice: toFloat(body.purchase_price),
        expiryDate: body.expiry_date ? new Date(body.expiry_date) : null,
        link: body.link,
        status: String(body.status ?? '10'),
        isBuilding: false,
        deleteOnDeplete: body.delete_on_deplete ?? false,
        creationDate: new Date(),
      },
    });
    await createTrackingEntry(item.id, TrackingType.CREATED, 'Stock item created');
    return c.json(item, 201);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.get('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const item = await prisma.stockitem.findUnique({
      where: { id },
      include: {
        part: { select: { id: true, name: true, units: true, trackable: true } },
        location: true,
        purchaseOrder: { select: { id: true, reference: true } },
      },
    });
    if (!item) return sendError(c, 404, 'Stock item not found');
    return c.json(item);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.patch('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const oldItem = await prisma.stockitem.findUnique({ where: { id } });
    if (!oldItem) return sendError(c, 404, 'Stock item not found');

    if (body.serial !== undefined) {
      await validateStockItem({ partId: oldItem.partId, serial: body.serial, quantity: oldItem.quantity.toNumber() }, id);
    }

    const updated = await prisma.stockitem.update({
      where: { id },
      data: {
        partId: body.part ? toInt(body.part) : undefined,
        locationId: body.location ? toInt(body.location) : undefined,
        quantity: body.quantity ? toFloat(body.quantity) : undefined,
        batch: body.batch,
        serial: body.serial ? String(body.serial) : undefined,
        purchasePrice: body.purchase_price ? toFloat(body.purchase_price) : undefined,
        status: body.status ? String(body.status) : undefined,
        link: body.link,
      },
    });

    await handleStockItemUpdate(id, body, oldItem);

    return c.json(updated);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

stockRouter.delete('/api/stock/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stockitem.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) {
    return sendError(c, 500, err.message);
  }
});

// Per-item actions
stockRouter.post('/api/stock/:pk/convert', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const partId = toInt(body.part ?? body.part_id ?? body.target_part);
    if (!partId) return sendError(c, 400, 'part required');
    const result = await convertStockItem(pk, partId, undefined, body.notes ?? body.note);
    return c.json(result, 200);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/:pk/install', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const targetId = toInt(body.target ?? body.assembly ?? body.parent ?? body.install_into);
    const childId = toInt(body.stock_item ?? body.item ?? body.child ?? body.part_item);

    let assemblyId: number | undefined;
    let stockItemId: number | undefined;

    if (targetId) {
      // :pk is the component stock item, target is the assembly item
      stockItemId = pk;
      assemblyId = targetId;
    } else if (childId) {
      // :pk is the assembly item, childId is the component item
      assemblyId = pk;
      stockItemId = childId;
    } else {
      return sendError(c, 400, 'target or stock_item required');
    }

    if (assemblyId === stockItemId) {
      return sendError(c, 400, 'Cannot install item into itself');
    }

    const result = await installStockItem({
      assemblyId,
      stockItemId,
      quantity: body.quantity !== undefined ? toFloat(body.quantity) : undefined,
      note: body.note ?? body.notes,
    });
    return c.json(result, 200);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/:pk/uninstall', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const location = toInt(body.location ?? body.destination);
    if (!location) return sendError(c, 400, 'location required');
    const result = await uninstallStockItem({
      stockItemId: pk,
      location,
      quantity: body.quantity !== undefined ? toFloat(body.quantity) : undefined,
      note: body.note ?? body.notes,
    });
    return c.json(result, 200);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/:pk/serialize', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const rawSerials = body.serial_numbers ?? body.serials ?? body.serial;
    if (!rawSerials) {
      return sendError(c, 400, 'serial_numbers required');
    }
    const quantity = body.quantity !== undefined ? toInt(body.quantity) : undefined;
    const destination = toInt(body.destination ?? body.location ?? body.location_id);

    const result = await serializeStockItem({
      stockItemId: pk,
      quantity,
      serial_numbers: String(rawSerials),
      destination,
      notes: body.notes ?? body.note,
    });
    return c.json({ success: true, results: result }, 200);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

stockRouter.post('/api/stock/:pk/disassemble', (c) => c.json({ success: true }));
stockRouter.get('/api/stock/:pk/serial-numbers', (c) => c.json({ count: 0, results: [] }));
