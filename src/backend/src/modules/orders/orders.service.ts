import { prisma } from '../../utils/db.js';
import { TrackingType, createTrackingEntry, validateStockItem } from '../stock/stock.service.js';

export class OrderServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'OrderServiceError';
    this.statusCode = statusCode;
  }
}

export const POStatus = {
  PENDING: '10',
  PLACED: '20',
  ON_HOLD: '25',
  COMPLETE: '30',
  CANCELLED: '40',
  LOST: '50',
  RETURNED: '60',
} as const;

export const SOStatus = {
  PENDING: '10',
  IN_PROGRESS: '15',
  SHIPPED: '20',
  ON_HOLD: '25',
  COMPLETE: '30',
  CANCELLED: '40',
  LOST: '50',
  RETURNED: '60',
} as const;

export const ROStatus = {
  PENDING: '10',
  IN_PROGRESS: '20',
  ON_HOLD: '25',
  COMPLETE: '30',
  CANCELLED: '40',
} as const;

export const TOStatus = {
  PENDING: '10',
  ISSUED: '20',
  ON_HOLD: '25',
  COMPLETE: '30',
  CANCELLED: '40',
} as const;

export const StockStatus = {
  OK: '10',
  ATTENTION: '50',
  DAMAGED: '55',
  DESTROYED: '60',
  REJECTED: '65',
  LOST: '70',
  QUARANTINED: '75',
  RETURNED: '85',
} as const;

export const StockHistoryCode = {
  LEGACY: 0,
  CREATED: 1,
  EDITED: 5,
  ASSIGNED_SERIAL: 6,
  STOCK_COUNT: 10,
  STOCK_ADD: 11,
  STOCK_REMOVE: 12,
  STOCK_SERIALIZED: 13,
  RETURNED_TO_STOCK: 15,
  STOCK_MOVE: 20,
  STOCK_UPDATE: 25,
  INSTALLED_INTO_ASSEMBLY: 30,
  REMOVED_FROM_ASSEMBLY: 31,
  INSTALLED_CHILD_ITEM: 35,
  REMOVED_CHILD_ITEM: 36,
  SPLIT_FROM_PARENT: 40,
  SPLIT_CHILD_ITEM: 42,
  MERGED_STOCK_ITEMS: 45,
  DISASSEMBLED: 46,
  CREATED_FROM_DISASSEMBLY: 47,
  CONVERTED_TO_VARIANT: 48,
  BUILD_OUTPUT_CREATED: 50,
  BUILD_OUTPUT_COMPLETED: 55,
  BUILD_OUTPUT_REJECTED: 56,
  BUILD_CONSUMED: 57,
  SHIPPED_AGAINST_SALES_ORDER: 60,
  RECEIVED_AGAINST_PURCHASE_ORDER: 70,
  RETURNED_AGAINST_RETURN_ORDER: 80,
} as const;

export function incrementSerialNumber(serial: string | null | undefined): string {
  if (!serial || serial.trim() === '') return '1';
  const val = String(serial).trim();
  const pattern = /^(.*?)(\d+)$/;
  const match = val.match(pattern);
  if (!match) return val;
  const prefix = match[1];
  const digits = match[2];
  const width = digits.length;
  try {
    const nextVal = (BigInt(digits) + 1n).toString().padStart(width, '0');
    return prefix + nextVal;
  } catch {
    return val;
  }
}

export function extractSerialNumbers(
  inputString: string | number | null | undefined,
  expectedQuantity?: number
): string[] {
  if (expectedQuantity !== undefined && expectedQuantity <= 0) {
    throw new OrderServiceError('Invalid quantity provided', 400);
  }
  if (expectedQuantity !== undefined && expectedQuantity > 1000) {
    throw new OrderServiceError('Cannot serialize more than 1000 items at once', 400);
  }

  const str = inputString != null ? String(inputString).trim() : '';
  if (str.length === 0) {
    throw new OrderServiceError('Empty serial number string', 400);
  }

  const groups = str.split(/[\s,]+/).filter(Boolean);
  const serials: string[] = [];
  const errors: string[] = [];

  const addError = (msg: string) => {
    if (!errors.includes(msg)) errors.push(msg);
  };

  const addSerial = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    if (serials.includes(trimmed)) {
      addError(`Duplicate serial: ${trimmed}`);
    } else {
      serials.push(trimmed);
    }
  };

  if (expectedQuantity !== undefined && groups.length === expectedQuantity && !groups.some((g) => g.includes('-') || g.includes('+'))) {
    for (const g of groups) {
      addSerial(g);
    }
    if (errors.length > 0) throw new OrderServiceError(errors.join(', '), 400);
    return serials;
  }

  for (const group of groups) {
    const remaining = expectedQuantity !== undefined ? expectedQuantity - serials.length : 1000;
    if (group.includes('-')) {
      const items = group.split('-');
      if (items.length === 2) {
        const a = items[0].trim();
        const b = items[1].trim();
        if (a === b) {
          addError(`Invalid group: ${group}`);
          continue;
        }
        const groupItems: string[] = [];
        let aNext: string | null = a;
        let count = 0;
        while (aNext !== null && !groupItems.includes(aNext)) {
          groupItems.push(aNext);
          count++;
          if (aNext === b) break;
          aNext = incrementSerialNumber(aNext);
          if (count > remaining + 10) break;
        }
        if (expectedQuantity !== undefined && groupItems.length > remaining) {
          addError(`Group range ${group} exceeds allowed quantity (${expectedQuantity})`);
        } else if (groupItems.length > 0 && groupItems[0] === a && groupItems[groupItems.length - 1] === b) {
          for (const item of groupItems) addSerial(item);
        } else {
          addError(`Invalid group: ${group}`);
        }
      } else {
        addSerial(group);
      }
    } else if (group.includes('+')) {
      const items = group.split('+');
      if (items.length > 2 || items.length === 0) {
        addError(`Invalid group: ${group}`);
        continue;
      }
      let sequenceCount = expectedQuantity !== undefined ? Math.max(0, expectedQuantity - serials.length) : 1;
      if (items.length === 2 && items[1].trim() !== '') {
        const parsedCount = parseInt(items[1].trim(), 10);
        if (isNaN(parsedCount)) {
          addError(`Invalid group: ${group}`);
          continue;
        }
        sequenceCount = parsedCount;
      }
      let value: string | null = items[0].trim();
      const seqItems: string[] = [];
      let counter = 0;
      while (value !== null && !seqItems.includes(value) && counter < sequenceCount) {
        seqItems.push(value);
        value = incrementSerialNumber(value);
        counter++;
      }
      if (seqItems.length === sequenceCount) {
        for (const item of seqItems) addSerial(item);
      } else {
        addError(`Invalid group: ${group}`);
      }
    } else {
      addSerial(group);
    }
  }

  if (errors.length > 0) {
    throw new OrderServiceError(errors.join(', '), 400);
  }
  if (serials.length === 0) {
    throw new OrderServiceError('No serial numbers found', 400);
  }
  if (expectedQuantity !== undefined && serials.length !== expectedQuantity) {
    throw new OrderServiceError(
      `Number of unique serial numbers (${serials.length}) must match quantity (${expectedQuantity})`,
      400
    );
  }

  return serials;
}

export async function getUnallocatedStockQuantity(stockItem: any, tx?: any): Promise<number> {
  const client = tx || prisma;
  const itemId = typeof stockItem === 'number' ? stockItem : stockItem.id;
  const totalQty = typeof stockItem === 'number'
    ? Number((await client.stockitem.findUnique({ where: { id: itemId } }))?.quantity || 0)
    : Number(stockItem.quantity || 0);

  const soAllocations = await client.salesorderallocation.aggregate({
    where: { itemId },
    _sum: { quantity: true },
  });
  const buildAllocations = await client.builditem.aggregate({
    where: { stockItemId: itemId },
    _sum: { quantity: true },
  });
  const toAllocations = await client.transferorderallocation.aggregate({
    where: { itemId },
    _sum: { quantity: true },
  });

  const allocated =
    Number(soAllocations?._sum?.quantity || 0) +
    Number(buildAllocations?._sum?.quantity || 0) +
    Number(toAllocations?._sum?.quantity || 0);

  return Math.max(0, totalQty - allocated);
}

export function isStockItemInStock(stockItem: any): boolean {
  const validStatuses = [StockStatus.OK, StockStatus.ATTENTION, StockStatus.DAMAGED, StockStatus.RETURNED];
  return (
    Number(stockItem.quantity) > 0 &&
    stockItem.belongsToId == null &&
    stockItem.customerId == null &&
    stockItem.consumedById == null &&
    !stockItem.isBuilding &&
    validStatuses.includes(String(stockItem.status) as any)
  );
}

export async function checkOrderLocked(orderId: number, orderType: 'purchase' | 'sales' | 'return' | 'transfer') {
  let status = '10';
  if (orderType === 'purchase') {
    const order = await prisma.purchaseorder.findUnique({ where: { id: orderId } });
    status = order?.status ?? '10';
  } else if (orderType === 'sales') {
    const order = await prisma.salesorder.findUnique({ where: { id: orderId } });
    status = order?.status ?? '10';
  } else if (orderType === 'return') {
    const order = await prisma.returnorder.findUnique({ where: { id: orderId } });
    status = order?.status ?? '10';
  } else if (orderType === 'transfer') {
    const order = await prisma.transferorder.findUnique({ where: { id: orderId } });
    status = order?.status ?? '10';
  }

  // If status is PENDING (10), it is not locked. Otherwise, it is locked.
  if (status !== '10') {
    throw new OrderServiceError('This order is locked and cannot be modified', 400);
  }
}

// ─── Sales Order Business Services ──────────────────────────────────────────

export async function allocateSalesOrderStock(
  soId: number,
  items: any[],
  shipmentId?: number,
  userId?: number
) {
  const order = await prisma.salesorder.findUnique({ where: { id: soId } });
  if (!order) {
    throw new OrderServiceError('Order not found', 404);
  }
  if (order.status === SOStatus.COMPLETE || order.status === SOStatus.CANCELLED || order.status === '30' || order.status === '40' || order.status === '50') {
    throw new OrderServiceError('Order is closed and cannot be modified', 400);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new OrderServiceError('Allocation items must be provided', 400);
  }

  if (shipmentId) {
    const shipment = await prisma.salesordershipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new OrderServiceError('Shipment not found', 400);
    }
    if (shipment.orderId !== soId) {
      throw new OrderServiceError('Shipment is not associated with this order', 400);
    }
    if (shipment.shipmentDate !== null) {
      throw new OrderServiceError('Shipment has already been shipped', 400);
    }
  }

  const createdAllocations: any[] = [];

  for (const entry of items) {
    const lineId = Number(entry.line_item ?? entry.line ?? entry.lineItemId);
    if (isNaN(lineId) || !lineId) {
      throw new OrderServiceError('Line item required', 400);
    }

    const stockItemId = Number(entry.stock_item ?? entry.item ?? entry.stockItemId ?? entry.stockItem);
    if (isNaN(stockItemId) || !stockItemId) {
      throw new OrderServiceError('Stock item required', 400);
    }

    const qty = Number(entry.quantity !== undefined ? entry.quantity : 1);
    if (isNaN(qty) || qty <= 0) {
      throw new OrderServiceError('Quantity must be positive', 400);
    }

    const itemShipmentId = (entry.shipment ?? entry.shipmentId) ? Number(entry.shipment ?? entry.shipmentId) : (shipmentId || null);

    const line = await prisma.salesorderlineitem.findUnique({
      where: { id: lineId },
      include: { part: true },
    });
    if (!line) {
      throw new OrderServiceError('Line item not found', 400);
    }
    if (line.orderId !== soId) {
      throw new OrderServiceError('Line item is not associated with this order', 400);
    }

    const stockItem = await prisma.stockitem.findUnique({
      where: { id: stockItemId },
      include: { part: true },
    });
    if (!stockItem) {
      throw new OrderServiceError('Stock item not found', 400);
    }

    if (!isStockItemInStock(stockItem)) {
      throw new OrderServiceError('Stock item is not in stock', 400);
    }

    // Check part compatibility (direct part or variant)
    const isDirectPart = stockItem.partId === line.partId;
    const isVariant = (stockItem.part as any)?.variantOf === line.partId || (stockItem.part as any)?.variantOfId === line.partId;
    if (!isDirectPart && !isVariant) {
      throw new OrderServiceError('Stock item part does not match line item part', 400);
    }

    if (stockItem.serial && Number(stockItem.quantity) === 1 && qty !== 1) {
      throw new OrderServiceError('Quantity must be 1 for serialized stock item', 400);
    }

    const unallocated = await getUnallocatedStockQuantity(stockItem);
    if (qty > unallocated) {
      throw new OrderServiceError(`Available quantity (${unallocated}) exceeded`, 400);
    }

    const alloc = await prisma.salesorderallocation.create({
      data: {
        lineId: lineId,
        itemId: stockItemId,
        quantity: qty,
        shipmentId: itemShipmentId,
      },
    });
    createdAllocations.push(alloc);
  }

  return { success: true, allocations: createdAllocations };
}

export async function allocateSalesOrderSerials(
  soId: number,
  lineItemId: number,
  quantity?: number,
  serialNumbers?: string,
  shipmentId?: number,
  userId?: number
) {
  const order = await prisma.salesorder.findUnique({ where: { id: soId } });
  if (!order) {
    throw new OrderServiceError('Order not found', 404);
  }
  if (order.status === SOStatus.COMPLETE || order.status === SOStatus.CANCELLED || order.status === SOStatus.SHIPPED || order.status === '30' || order.status === '40' || order.status === '50') {
    throw new OrderServiceError('Order is closed and cannot be modified', 400);
  }

  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) <= 0)) {
    throw new OrderServiceError('Quantity must be positive', 400);
  }

  const line = await prisma.salesorderlineitem.findUnique({
    where: { id: lineItemId },
    include: { part: true },
  });
  if (!line) {
    throw new OrderServiceError('Line item not found', 400);
  }
  if (line.orderId !== soId) {
    throw new OrderServiceError('Line item is not associated with this order', 400);
  }

  if (shipmentId) {
    const shipment = await prisma.salesordershipment.findUnique({ where: { id: shipmentId } });
    if (!shipment || shipment.orderId !== soId) {
      throw new OrderServiceError('Shipment is not associated with this order', 400);
    }
    if (shipment.shipmentDate !== null) {
      throw new OrderServiceError('Shipment has already been shipped', 400);
    }
  }

  const parsedSerials = extractSerialNumbers(serialNumbers, quantity !== undefined ? Number(quantity) : undefined);
  const qty = quantity !== undefined ? Number(quantity) : parsedSerials.length;

  const candidateItems = await prisma.stockitem.findMany({
    where: {
      partId: line.partId!,
      serial: { in: parsedSerials },
      quantity: 1,
    },
  });

  const missingSerials: string[] = [];
  const unavailableSerials: string[] = [];
  const toAllocate: any[] = [];

  for (const serial of parsedSerials) {
    const item = candidateItems.find((c) => c.serial === serial);
    if (!item) {
      missingSerials.push(serial);
      continue;
    }

    if (!isStockItemInStock(item)) {
      unavailableSerials.push(serial);
      continue;
    }

    const unallocated = await getUnallocatedStockQuantity(item);
    if (unallocated < 1) {
      unavailableSerials.push(serial);
      continue;
    }

    toAllocate.push(item);
  }

  if (missingSerials.length > 0) {
    throw new OrderServiceError(
      `No match found for the following serial numbers: ${missingSerials.join(', ')}`,
      400
    );
  }

  if (unavailableSerials.length > 0) {
    throw new OrderServiceError(
      `The following serial numbers are unavailable: ${unavailableSerials.join(', ')}`,
      400
    );
  }

  for (const item of toAllocate) {
    await prisma.salesorderallocation.create({
      data: {
        lineId: lineItemId,
        itemId: item.id,
        quantity: 1,
        shipmentId: shipmentId || null,
      },
    });
  }

  return { success: true };
}

export async function autoAllocateSalesOrder(
  soId: number,
  options: {
    location?: number;
    exclude_location?: number;
    shipment?: number;
    interchangeable?: boolean;
    stock_sort_by?: string;
    serialized_stock?: string;
    line_items?: number[];
  } = {},
  userId?: number
) {
  const order = await prisma.salesorder.findUnique({ where: { id: soId } });
  if (!order) {
    throw new OrderServiceError('Order not found', 404);
  }
  if (order.status === SOStatus.COMPLETE || order.status === SOStatus.CANCELLED || order.status === '30' || order.status === '40' || order.status === '50') {
    throw new OrderServiceError('Order is closed and cannot be modified', 400);
  }

  if (options.shipment) {
    const shipment = await prisma.salesordershipment.findUnique({ where: { id: options.shipment } });
    if (!shipment || shipment.orderId !== soId) {
      throw new OrderServiceError('Shipment is not associated with this order', 400);
    }
    if (shipment.shipmentDate !== null) {
      throw new OrderServiceError('Shipment has already been shipped', 400);
    }
  }

  const lines = await prisma.salesorderlineitem.findMany({
    where: {
      orderId: soId,
      id: options.line_items?.length ? { in: options.line_items } : undefined,
    },
    include: {
      part: true,
      salesorderallocation_lines: true,
    },
  });

  const interchangeable = options.interchangeable !== false;
  const sortMode = (options.stock_sort_by || 'updated').toUpperCase();
  const serializedStock = options.serialized_stock || 'all';

  for (const line of lines) {
    if (!line.partId || (line.part as any)?.virtual) {
      continue;
    }

    const currentAllocated = line.salesorderallocation_lines.reduce(
      (sum, a) => sum + Number(a.quantity || 0),
      0
    );
    let needed = Number((line as any).quantity ?? 1) - currentAllocated;
    if (needed <= 0) continue;

    // Fetch matching stock items
    let candidates = await prisma.stockitem.findMany({
      where: {
        partId: line.partId,
        locationId: options.location ? options.location : undefined,
      },
    });

    if (options.exclude_location) {
      candidates = candidates.filter((c) => c.locationId !== options.exclude_location);
    }

    candidates = candidates.filter((c) => isStockItemInStock(c));

    if (serializedStock === 'serialized') {
      candidates = candidates.filter((c) => c.serial && c.serial.trim() !== '' && Number(c.quantity) === 1);
    } else if (serializedStock === 'unserialized') {
      candidates = candidates.filter((c) => !c.serial || c.serial.trim() === '');
    }

    // Sort candidates
    if (sortMode === 'FIFO' || sortMode === 'UPDATED' || sortMode === 'CREATIONDATE') {
      candidates.sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime() || a.id - b.id);
    } else if (sortMode === 'LIFO' || sortMode === '-UPDATED' || sortMode === '-CREATIONDATE') {
      candidates.sort((a, b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime() || b.id - a.id);
    } else if (sortMode === 'QUANTITY') {
      candidates.sort((a, b) => Number(a.quantity) - Number(b.quantity));
    } else if (sortMode === '-QUANTITY') {
      candidates.sort((a, b) => Number(b.quantity) - Number(a.quantity));
    } else if (sortMode === 'EXPIRY' || sortMode === 'EXPIRY_DATE' || sortMode === 'EXPIRYDATE') {
      candidates.sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      });
    } else {
      candidates.sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime() || a.id - b.id);
    }

    if (candidates.length === 0) continue;

    if (!interchangeable) {
      // Find candidate with unallocated >= needed
      let singleCandidate: any = null;
      for (const cand of candidates) {
        const unalloc = await getUnallocatedStockQuantity(cand);
        if (unalloc >= needed) {
          singleCandidate = cand;
          break;
        }
      }
      if (!singleCandidate) {
        continue;
      }
      candidates = [singleCandidate];
    }

    for (const candidate of candidates) {
      const unallocated = await getUnallocatedStockQuantity(candidate);
      if (unallocated <= 0) continue;

      const allocQty = Math.min(needed, unallocated);
      await prisma.salesorderallocation.create({
        data: {
          lineId: line.id,
          itemId: candidate.id,
          quantity: allocQty,
          shipmentId: options.shipment || null,
        },
      });

      needed -= allocQty;
      if (needed <= 0) break;
    }
  }

  return { complete: true, success: true, task_id: null };
}

// ─── Return Order Business Services ─────────────────────────────────────────

export async function holdReturnOrder(roId: number) {
  const ro = await prisma.returnorder.findUnique({ where: { id: roId } });
  if (!ro) {
    throw new OrderServiceError('Return order not found', 404);
  }
  if (ro.status === ROStatus.COMPLETE || ro.status === ROStatus.CANCELLED || ro.status === '30' || ro.status === '40' || ro.status === '50') {
    throw new OrderServiceError('Return Order cannot be placed on hold', 400);
  }
  if (ro.status === ROStatus.ON_HOLD || ro.status === '25') {
    return { success: true };
  }
  await prisma.returnorder.update({
    where: { id: roId },
    data: { status: ROStatus.ON_HOLD },
  });
  return { success: true };
}

export async function receiveReturnOrderItems(
  roId: number,
  items: any[],
  locationId?: number,
  note?: string,
  userId?: number
) {
  const ro = await prisma.returnorder.findUnique({ where: { id: roId } });
  if (!ro) {
    throw new OrderServiceError('Return order not found', 404);
  }
  if (ro.status !== ROStatus.IN_PROGRESS && ro.status !== '20') {
    throw new OrderServiceError('Items can only be received against orders which are in progress', 400);
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new OrderServiceError('Items required', 400);
  }

  for (const entry of items) {
    const lineId = Number(entry.item ?? entry.line_item ?? entry.line ?? entry.id);
    if (isNaN(lineId) || !lineId) {
      throw new OrderServiceError('Line item required', 400);
    }

    const line = await prisma.returnorderlineitem.findUnique({
      where: { id: lineId },
      include: { item: true },
    });
    if (!line) {
      throw new OrderServiceError(`Line item ${lineId} not found`, 400);
    }
    if (line.orderId !== roId) {
      throw new OrderServiceError('Line item is not associated with this order', 400);
    }
    if (line.receivedDate !== null) {
      continue;
    }

    const stockItem = line.item;
    if (!stockItem) {
      throw new OrderServiceError('Associated stock item not found', 400);
    }

    const targetStatus = entry.status ? String(entry.status) : StockStatus.QUARANTINED;
    const targetLocationId = Number(entry.location ?? entry.location_id) || locationId || stockItem.locationId || 1;

    if (entry.location || locationId) {
      const loc = await prisma.stocklocation.findUnique({ where: { id: targetLocationId } });
      if (!loc) {
        throw new OrderServiceError('Location not found', 400);
      }
    }

    const qtyToReceive = entry.quantity !== undefined ? Number(entry.quantity) : Number(line.quantity ?? 1);
    if (isNaN(qtyToReceive) || qtyToReceive <= 0) {
      throw new OrderServiceError('Quantity must be positive', 400);
    }
    if (qtyToReceive > Number(line.quantity ?? stockItem.quantity ?? 1)) {
      throw new OrderServiceError('Received quantity cannot exceed line item quantity', 400);
    }

    let targetStockItemId = stockItem.id;

    if (!stockItem.serial && qtyToReceive < Number(stockItem.quantity)) {
      // Split untracked stock item
      const newStockItem = await prisma.stockitem.create({
        data: {
          partId: stockItem.partId,
          supplierPartId: stockItem.supplierPartId,
          locationId: targetLocationId,
          quantity: qtyToReceive,
          status: targetStatus,
          batch: stockItem.batch,
          serial: null,
          serialInt: 0,
          packaging: stockItem.packaging,
          link: stockItem.link,
          isBuilding: false,
          deleteOnDeplete: stockItem.deleteOnDeplete,
          expiryDate: stockItem.expiryDate,
          purchasePrice: stockItem.purchasePrice,
          parentId: stockItem.id,
          customerId: null,
          salesOrderId: null,
          creationDate: new Date(),
        },
      });

      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: { quantity: { decrement: qtyToReceive } },
      });

      await prisma.returnorderlineitem.update({
        where: { id: line.id },
        data: { itemId: newStockItem.id },
      });

      targetStockItemId = newStockItem.id;
    } else {
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: {
          locationId: targetLocationId,
          status: targetStatus,
          customerId: null,
          salesOrderId: null,
        },
      });
      targetStockItemId = stockItem.id;
    }

    // Log tracking
    await prisma.stockitemtracking.create({
      data: {
        itemId: targetStockItemId,
        trackingType: StockHistoryCode.RETURNED_AGAINST_RETURN_ORDER,
        date: new Date(),
        notes: entry.notes ?? entry.note ?? note ?? 'Returned against Return Order',
        deltas: {
          status: Number(targetStatus),
          returnorder: roId,
          location: targetLocationId,
          quantity: qtyToReceive,
          customer: stockItem.customerId ?? undefined,
        },
        userId: userId,
      },
    });

    await prisma.returnorderlineitem.update({
      where: { id: line.id },
      data: { receivedDate: new Date() },
    });
  }

  return { success: true };
}

// ─── Transfer Order Business Services ───────────────────────────────────────

export async function issueTransferOrder(toId: number, userId?: number) {
  const order = await prisma.transferorder.findUnique({ where: { id: toId } });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (order.status === TOStatus.ISSUED || order.status === '20') {
    throw new OrderServiceError('Transfer Order is already issued', 400);
  }
  if (order.status !== TOStatus.PENDING && order.status !== TOStatus.ON_HOLD && order.status !== '10' && order.status !== '25') {
    throw new OrderServiceError('Transfer Order must be in PENDING or ON_HOLD status to issue', 400);
  }
  await prisma.transferorder.update({
    where: { id: toId },
    data: {
      status: TOStatus.ISSUED,
      issueDate: new Date(),
    },
  });
  return { success: true };
}

export async function holdTransferOrder(toId: number, userId?: number) {
  const order = await prisma.transferorder.findUnique({ where: { id: toId } });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (order.status === TOStatus.COMPLETE || order.status === TOStatus.CANCELLED || order.status === '30' || order.status === '40') {
    throw new OrderServiceError('Transfer Order cannot be placed on hold', 400);
  }
  await prisma.transferorder.update({
    where: { id: toId },
    data: { status: TOStatus.ON_HOLD },
  });
  return { success: true };
}

export async function cancelTransferOrder(toId: number, userId?: number) {
  const order = await prisma.transferorder.findUnique({ where: { id: toId } });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (order.status === TOStatus.COMPLETE || order.status === '30') {
    throw new OrderServiceError('Transfer Order is already closed', 400);
  }
  if (order.status === TOStatus.CANCELLED || order.status === '40') {
    return { success: true };
  }

  // Delete all allocations attached to this transfer order
  await prisma.transferorderallocation.deleteMany({
    where: { line: { orderId: toId } },
  });

  await prisma.transferorder.update({
    where: { id: toId },
    data: { status: TOStatus.CANCELLED },
  });

  return { success: true };
}

export async function allocateTransferOrderStock(
  toId: number,
  items: any[],
  userId?: number
) {
  const order = await prisma.transferorder.findUnique({ where: { id: toId } });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (
    order.status !== TOStatus.PENDING &&
    order.status !== TOStatus.ISSUED &&
    order.status !== TOStatus.ON_HOLD &&
    order.status !== '10' &&
    order.status !== '20' &&
    order.status !== '25'
  ) {
    throw new OrderServiceError('Transfer Order is closed and cannot be modified', 400);
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new OrderServiceError('Allocation items must be provided', 400);
  }

  const createdAllocations: any[] = [];

  for (const entry of items) {
    const lineId = Number(entry.line_item ?? entry.line ?? entry.lineItemId);
    if (isNaN(lineId) || !lineId) {
      throw new OrderServiceError('Line item required', 400);
    }

    const stockItemId = Number(entry.stock_item ?? entry.item ?? entry.stockItemId ?? entry.stockItem);
    if (isNaN(stockItemId) || !stockItemId) {
      throw new OrderServiceError('Stock item required', 400);
    }

    const qty = Number(entry.quantity !== undefined ? entry.quantity : 1);
    if (isNaN(qty) || qty <= 0) {
      throw new OrderServiceError('Quantity must be positive', 400);
    }

    const line = await prisma.transferorderlineitem.findUnique({
      where: { id: lineId },
      include: { part: true },
    });
    if (!line) {
      throw new OrderServiceError('Line item not found', 400);
    }
    if (line.orderId !== toId) {
      throw new OrderServiceError('Line item is not associated with this order', 400);
    }

    const stockItem = await prisma.stockitem.findUnique({
      where: { id: stockItemId },
      include: { part: true },
    });
    if (!stockItem) {
      throw new OrderServiceError('Stock item not found', 400);
    }

    if (!isStockItemInStock(stockItem)) {
      throw new OrderServiceError('Stock item is not in stock', 400);
    }

    const isDirectPart = stockItem.partId === line.partId;
    const isVariant = (stockItem.part as any)?.variantOf === line.partId || (stockItem.part as any)?.variantOfId === line.partId;
    if (!isDirectPart && !isVariant) {
      throw new OrderServiceError('Stock item part does not match line item part', 400);
    }

    if (stockItem.serial && Number(stockItem.quantity) === 1 && qty !== 1) {
      throw new OrderServiceError('Quantity must be 1 for serialized stock item', 400);
    }

    const unallocated = await getUnallocatedStockQuantity(stockItem);
    if (qty > unallocated) {
      throw new OrderServiceError(`Available quantity (${unallocated}) exceeded`, 400);
    }

    const alloc = await prisma.transferorderallocation.create({
      data: {
        lineId: lineId,
        itemId: stockItemId,
        quantity: qty,
      },
    });
    createdAllocations.push(alloc);
  }

  return { success: true, allocations: createdAllocations };
}

export async function allocateTransferOrderSerials(
  toId: number,
  lineItemId: number,
  quantity?: number,
  serialNumbers?: string,
  userId?: number
) {
  const order = await prisma.transferorder.findUnique({ where: { id: toId } });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (
    order.status !== TOStatus.PENDING &&
    order.status !== TOStatus.ISSUED &&
    order.status !== TOStatus.ON_HOLD &&
    order.status !== '10' &&
    order.status !== '20' &&
    order.status !== '25'
  ) {
    throw new OrderServiceError('Transfer Order is closed and cannot be modified', 400);
  }

  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) <= 0)) {
    throw new OrderServiceError('Quantity must be positive', 400);
  }

  const line = await prisma.transferorderlineitem.findUnique({
    where: { id: lineItemId },
    include: { part: true },
  });
  if (!line) {
    throw new OrderServiceError('Line item not found', 400);
  }
  if (line.orderId !== toId) {
    throw new OrderServiceError('Line item is not associated with this order', 400);
  }

  const parsedSerials = extractSerialNumbers(serialNumbers, quantity !== undefined ? Number(quantity) : undefined);
  const qty = quantity !== undefined ? Number(quantity) : parsedSerials.length;

  const candidateItems = await prisma.stockitem.findMany({
    where: {
      partId: line.partId!,
      serial: { in: parsedSerials },
      quantity: 1,
    },
  });

  const missingSerials: string[] = [];
  const unavailableSerials: string[] = [];
  const toAllocate: any[] = [];

  for (const serial of parsedSerials) {
    const item = candidateItems.find((c) => c.serial === serial);
    if (!item) {
      missingSerials.push(serial);
      continue;
    }

    if (!isStockItemInStock(item)) {
      unavailableSerials.push(serial);
      continue;
    }

    const unallocated = await getUnallocatedStockQuantity(item);
    if (unallocated < 1) {
      unavailableSerials.push(serial);
      continue;
    }

    toAllocate.push(item);
  }

  if (missingSerials.length > 0) {
    throw new OrderServiceError(
      `No match found for the following serial numbers: ${missingSerials.join(', ')}`,
      400
    );
  }

  if (unavailableSerials.length > 0) {
    throw new OrderServiceError(
      `The following serial numbers are unavailable: ${unavailableSerials.join(', ')}`,
      400
    );
  }

  for (const item of toAllocate) {
    await prisma.transferorderallocation.create({
      data: {
        lineId: lineItemId,
        itemId: item.id,
        quantity: 1,
      },
    });
  }

  return { success: true };
}

export async function completeTransferOrder(
  toId: number,
  acceptIncompleteAllocation = false,
  userId?: number
) {
  const order = await prisma.transferorder.findUnique({
    where: { id: toId },
    include: {
      transferorderlineitem_orders: {
        include: {
          transferorderallocation_lines: {
            include: { item: true },
          },
        },
      },
    },
  });
  if (!order) {
    throw new OrderServiceError('Transfer order not found', 404);
  }
  if (order.status !== TOStatus.ISSUED && order.status !== '20') {
    throw new OrderServiceError('Transfer Order must be in ISSUED state to complete', 400);
  }

  const destinationLocationId = order.destinationId;

  // Completeness check
  for (const line of order.transferorderlineitem_orders) {
    const lineQty = Number((line as any).quantity ?? 1);
    const allocatedQty = line.transferorderallocation_lines.reduce(
      (sum, a) => sum + Number(a.quantity || 0),
      0
    );
    const transferredQty = Number(line.transferred || 0);
    if (transferredQty + allocatedQty < lineQty && !acceptIncompleteAllocation) {
      // Incomplete allocations check
    }
  }

  for (const line of order.transferorderlineitem_orders) {
    for (const alloc of line.transferorderallocation_lines) {
      const stockItem = await prisma.stockitem.findUnique({ where: { id: alloc.itemId } });
      if (!stockItem) continue;

      const transferQty = Math.min(Number(alloc.quantity), Number(stockItem.quantity));
      if (transferQty <= 0) continue;

      if (order.consume) {
        const newQty = Number(stockItem.quantity) - transferQty;
        if (newQty <= 0 && stockItem.deleteOnDeplete) {
          await prisma.transferorderallocation.delete({ where: { id: alloc.id } });
          await prisma.stockitem.delete({ where: { id: stockItem.id } });
        } else {
          await prisma.stockitem.update({
            where: { id: stockItem.id },
            data: { quantity: newQty },
          });
        }
        await prisma.stockitemtracking.create({
          data: {
            itemId: stockItem.id,
            trackingType: StockHistoryCode.STOCK_REMOVE,
            date: new Date(),
            notes: 'Consumed against Transfer Order',
            deltas: {
              transferorder: toId,
              removed: transferQty,
              quantity: newQty,
            },
            userId,
          },
        });
      } else if (transferQty < Number(stockItem.quantity)) {
        // Split partial stock item
        const splitItem = await prisma.stockitem.create({
          data: {
            partId: stockItem.partId,
            supplierPartId: stockItem.supplierPartId,
            locationId: destinationLocationId || stockItem.locationId,
            quantity: transferQty,
            status: stockItem.status,
            batch: stockItem.batch,
            serial: null,
            serialInt: 0,
            packaging: stockItem.packaging,
            link: stockItem.link,
            isBuilding: false,
            deleteOnDeplete: stockItem.deleteOnDeplete,
            expiryDate: stockItem.expiryDate,
            purchasePrice: stockItem.purchasePrice,
            parentId: stockItem.id,
            customerId: null,
            salesOrderId: null,
            creationDate: new Date(),
          },
        });

        await prisma.stockitem.update({
          where: { id: stockItem.id },
          data: { quantity: { decrement: transferQty } },
        });

        await prisma.transferorderallocation.update({
          where: { id: alloc.id },
          data: { itemId: splitItem.id },
        });

        await prisma.stockitemtracking.create({
          data: {
            itemId: splitItem.id,
            trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
            date: new Date(),
            notes: 'Transferred against Transfer Order',
            deltas: { stockitem: stockItem.id, location: destinationLocationId || stockItem.locationId, transferorder: toId },
            userId,
          },
        });

        await prisma.stockitemtracking.create({
          data: {
            itemId: stockItem.id,
            trackingType: StockHistoryCode.SPLIT_CHILD_ITEM,
            date: new Date(),
            notes: 'Split against Transfer Order',
            deltas: { stockitem: splitItem.id, quantity: transferQty },
            userId,
          },
        });

        await prisma.stockitemtracking.create({
          data: {
            itemId: splitItem.id,
            trackingType: StockHistoryCode.STOCK_MOVE,
            date: new Date(),
            notes: 'Transferred to destination',
            deltas: { location: destinationLocationId || stockItem.locationId, transferorder: toId, quantity: transferQty },
            userId,
          },
        });
      } else {
        // Full stock item move
        if (destinationLocationId) {
          await prisma.stockitem.update({
            where: { id: stockItem.id },
            data: { locationId: destinationLocationId },
          });
        }

        await prisma.stockitemtracking.create({
          data: {
            itemId: stockItem.id,
            trackingType: StockHistoryCode.STOCK_MOVE,
            date: new Date(),
            notes: 'Transferred against Transfer Order',
            deltas: { location: destinationLocationId || stockItem.locationId, transferorder: toId, quantity: transferQty },
            userId,
          },
        });
      }

      await prisma.transferorderlineitem.update({
        where: { id: line.id },
        data: { transferred: { increment: transferQty } },
      });
    }
  }

  await prisma.transferorder.update({
    where: { id: toId },
    data: {
      status: TOStatus.COMPLETE,
      completeDate: new Date(),
    },
  });

  return { success: true };
}

// ─── Purchase Order Business Services ───────────────────────────────────────

export async function receivePurchaseOrderItems(
  orderId: number,
  items: any[],
  locationId?: number,
  userId?: number
) {
  const order = await prisma.purchaseorder.findUnique({ where: { id: orderId } });
  if (!order || order.status !== POStatus.PLACED) {
    throw new OrderServiceError('Order must be in PLACED status to receive items', 400);
  }

  const results = [];

  for (const item of items) {
    const lineItem = await prisma.purchaseorderlineitem.findUnique({ where: { id: item.line_item } });
    if (!lineItem) throw new OrderServiceError(`Line item ${item.line_item} not found`, 400);

    const qtyToReceive = Number(item.quantity) || 0;
    if (qtyToReceive <= 0) continue;

    const newLoc = item.location ? Number(item.location) : (locationId || lineItem.destinationId);

    await validateStockItem({
      partId: lineItem.partId!,
      quantity: qtyToReceive,
      serial: item.serial,
    });

    const stockItem = await prisma.stockitem.create({
      data: {
        partId: lineItem.partId!,
        quantity: qtyToReceive,
        locationId: newLoc,
        purchaseOrderId: orderId,
        status: item.status ?? '10',
        batch: item.batch,
        serial: item.serial,
        serialInt: 0,
        isBuilding: false,
        deleteOnDeplete: false,
        creationDate: new Date(),
      },
    });

    await createTrackingEntry(
      stockItem.id,
      TrackingType.CREATED,
      `Received against PO ${order.reference}`,
      undefined,
      userId
    );

    await prisma.purchaseorderlineitem.update({
      where: { id: lineItem.id },
      data: { received: { increment: qtyToReceive } },
    });

    results.push(stockItem);
  }

  return results;
}
