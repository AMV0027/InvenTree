import { prisma } from '../../utils/db.js';

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
  SENT_TO_CUSTOMER: 100,
  RETURNED_FROM_CUSTOMER: 105,
} as const;

// Backwards-compatible TrackingType aliases
export const TrackingType = {
  CREATED: StockHistoryCode.CREATED,
  EDITED: StockHistoryCode.EDITED,
  MOVED: StockHistoryCode.STOCK_MOVE,
  ADD: StockHistoryCode.STOCK_ADD,
  REMOVE: StockHistoryCode.STOCK_REMOVE,
  COUNTED: StockHistoryCode.STOCK_COUNT,
  TRANSFERRED: StockHistoryCode.STOCK_MOVE,
  ...StockHistoryCode
} as const;

export async function createTrackingEntry(
  itemId: number,
  type: number,
  notes: string,
  deltas?: object,
  userId?: number
) {
  return prisma.stockitemtracking.create({
    data: {
      itemId,
      trackingType: type,
      date: new Date(),
      notes,
      deltas: deltas ?? {},
      userId,
    },
  });
}

export async function validateStockItem(
  data: { partId: number; serial?: string | null; quantity: number },
  pk?: number
) {
  // If serial number is provided, check for uniqueness for this part
  if (data.serial && data.serial.trim() !== '') {
    const existing = await prisma.stockitem.findFirst({
      where: {
        partId: data.partId,
        serial: data.serial.trim(),
        id: pk ? { not: pk } : undefined,
      },
    });
    if (existing) {
      throw new Error(`Serial number ${data.serial} already exists for this part`);
    }

    // If it has a serial number, quantity must be 1
    if (data.quantity !== 1) {
      throw new Error('Quantity must be 1 for serialized stock items');
    }
  }
}

export async function handleStockItemUpdate(id: number, newData: any, oldItem: any, userId?: number) {
  const deltas: any = {};

  if (newData.status !== undefined && newData.status !== oldItem.status) {
    deltas.status = newData.status;
    deltas.old_status = oldItem.status;
  }

  if (newData.quantity !== undefined && Number(newData.quantity) !== Number(oldItem.quantity)) {
    deltas.quantity = newData.quantity;
    deltas.old_quantity = oldItem.quantity;
  }

  if (newData.locationId !== undefined && newData.locationId !== oldItem.locationId) {
    deltas.location = newData.locationId;
    deltas.old_location = oldItem.locationId;
  }

  if (Object.keys(deltas).length > 0) {
    let type: number = TrackingType.EDITED;
    if (deltas.location) type = TrackingType.MOVED;
    await createTrackingEntry(id, type, newData.tracking_note ?? 'Item updated', deltas, userId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for Serial Number Processing & Hierarchy
// ─────────────────────────────────────────────────────────────────────────────

export function increment(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '1';
  }
  const str = String(value).trim();
  const match = str.match(/^(.*?)(\d+)?$/);
  if (!match) return str;
  const prefix = match[1] ?? '';
  const numStr = match[2];
  if (!numStr) return prefix;
  const width = numStr.length;
  const nextNum = parseInt(numStr, 10) + 1;
  return prefix + String(nextNum).padStart(width, '0');
}

export function extractSerialNumbers(
  inputString: string | number,
  expectedQuantity: number,
  startingValue?: string | null
): string[] {
  const qty = Number(expectedQuantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (qty > 1000) {
    throw new Error('Cannot serialize more than 1000 items at once');
  }

  let str = String(inputString ?? '').trim();
  if (str.length === 0) {
    throw new Error('Empty serial number string');
  }

  let nextVal = increment(startingValue);
  while (str.includes('~') && nextVal) {
    str = str.replace('~', nextVal);
    nextVal = increment(nextVal);
  }

  const groups = str.split(/[\s,]+/).filter(Boolean);
  const serials: string[] = [];
  const errors: string[] = [];

  const addSerial = (s: string) => {
    const trimmed = s.trim();
    if (!trimmed) return;
    if (serials.includes(trimmed)) {
      errors.push(`Duplicate serial: ${trimmed}`);
    } else {
      serials.push(trimmed);
    }
  };

  if (groups.length === qty) {
    for (const g of groups) {
      addSerial(g);
    }
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return serials;
  }

  for (const group of groups) {
    const remaining = qty - serials.length;
    if (remaining <= 0) break;

    if (group.includes('-')) {
      const items = group.split('-');
      if (items.length === 2) {
        const a = items[0].trim();
        const b = items[1].trim();
        if (a === b) {
          errors.push(`Invalid group: ${group}`);
          continue;
        }
        const groupItems: string[] = [];
        let curr = a;
        let count = 0;
        while (curr && !groupItems.includes(curr)) {
          groupItems.push(curr);
          count++;
          if (curr === b) break;
          curr = increment(curr);
          if (count > remaining + 10) break;
        }

        if (groupItems.length > remaining) {
          errors.push(`Group range ${group} exceeds allowed quantity (${qty})`);
        } else if (
          groupItems.length > 0 &&
          groupItems[0] === a &&
          groupItems[groupItems.length - 1] === b
        ) {
          for (const item of groupItems) {
            addSerial(item);
          }
        } else {
          errors.push(`Invalid group: ${group}`);
        }
      } else {
        addSerial(group);
      }
    } else if (group.includes('+')) {
      const items = group.split('+');
      if (items.length === 0 || items.length > 2) {
        errors.push(`Invalid group: ${group}`);
        continue;
      }
      const start = items[0].trim();
      let sequenceCount = remaining;
      if (items.length === 2 && items[1].trim()) {
        const parsed = parseInt(items[1].trim(), 10);
        if (isNaN(parsed)) {
          errors.push(`Invalid group: ${group}`);
          continue;
        }
        sequenceCount = parsed;
      }
      let curr = start;
      let count = 0;
      while (curr && count < sequenceCount) {
        addSerial(curr);
        curr = increment(curr);
        count++;
      }
    } else {
      addSerial(group);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  if (serials.length !== qty) {
    throw new Error(`Quantity does not match serial numbers (${serials.length} != ${qty})`);
  }

  return serials;
}

export async function findConflictingSerialNumbers(partId: number, serials: string[]): Promise<string[]> {
  const existingItems = (await prisma.stockitem.findMany({
    where: {
      partId,
      serial: { in: serials },
    },
    select: { serial: true },
  })) ?? [];
  return Array.isArray(existingItems) ? existingItems.map((i) => i.serial!).filter(Boolean) : [];
}

export async function getLatestSerialNumber(partId: number): Promise<string | null> {
  const items = (await prisma.stockitem.findMany({
    where: {
      partId,
      serial: { not: null },
      NOT: { serial: '' },
    },
    orderBy: [
      { serialInt: 'desc' },
      { serial: 'desc' },
      { id: 'desc' },
    ],
    take: 1,
    select: { serial: true },
  })) ?? [];
  return Array.isArray(items) && items.length > 0 ? items[0]?.serial ?? null : null;
}

export async function getConversionOptions(partId: number) {
  const sourcePart = await prisma.part.findUnique({ where: { id: partId } });
  if (!sourcePart) return [];

  const candidateParts: any[] = [];

  // 1. Descendants (recursive)
  let parentIds = [partId];
  while (parentIds.length > 0) {
    const children = (await prisma.part.findMany({
      where: { variantOfId: { in: parentIds } },
    })) ?? [];
    if (!Array.isArray(children) || children.length === 0) break;
    candidateParts.push(...children);
    parentIds = children.map((c) => c.id);
  }

  // 2. Immediate parent
  if (sourcePart.variantOfId) {
    const parent = await prisma.part.findUnique({ where: { id: sourcePart.variantOfId } });
    if (parent) candidateParts.push(parent);

    // 3. Siblings
    const siblings = (await prisma.part.findMany({
      where: {
        variantOfId: sourcePart.variantOfId,
        id: { not: sourcePart.id },
      },
    })) ?? [];
    if (Array.isArray(siblings)) candidateParts.push(...siblings);
  }

  // Deduplicate and filter (active: true, virtual: false, id !== sourcePart.id)
  const uniqueMap = new Map<number, any>();
  for (const part of candidateParts) {
    if (part.id !== sourcePart.id && part.active && !part.virtual) {
      uniqueMap.set(part.id, part);
    }
  }

  return Array.from(uniqueMap.values());
}

export async function checkIfPartInBom(assemblyPartId: number, childPartId: number): Promise<boolean> {
  if (assemblyPartId === childPartId) return false;

  // Direct BOM check
  const directBom = await prisma.bomitem.findFirst({
    where: {
      partId: assemblyPartId,
      subPartId: childPartId,
    },
  });
  if (directBom) return true;

  // Substitute BOM check via bomItemIds for mockDb compatibility
  const assemblyBomItems = await prisma.bomitem.findMany({
    where: { partId: assemblyPartId },
  });
  const bomItemIds = assemblyBomItems.map((b: any) => b.id);
  if (bomItemIds.length > 0) {
    const substituteBom = await prisma.bomitemsubstitute.findFirst({
      where: {
        partId: childPartId,
        bomItemId: { in: bomItemIds },
      },
    });
    if (substituteBom) return true;
  }

  // Substitute BOM check via nested relation for Prisma ORM
  try {
    const substituteBomPrisma = await prisma.bomitemsubstitute.findFirst({
      where: {
        partId: childPartId,
        bomItem: {
          partId: assemblyPartId,
        },
      },
    });
    if (substituteBomPrisma) return true;
  } catch {
    // Ignore nested filter error in mock environments
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock Action Services (Merge, Return, Convert, Install, Uninstall, Serialize)
// ─────────────────────────────────────────────────────────────────────────────

export interface MergeStockItemsParams {
  items: Array<{ item?: number; pk?: number } | number>;
  location: number;
  notes?: string;
  allow_mismatched_suppliers?: boolean;
  allow_mismatched_status?: boolean;
  userId?: number;
}

export async function mergeStockItems(params: MergeStockItemsParams) {
  const {
    items,
    location,
    notes,
    allow_mismatched_suppliers = false,
    allow_mismatched_status = false,
    userId,
  } = params;

  if (!items || items.length < 2) {
    throw new Error('At least two stock items must be provided');
  }

  const itemIds = items.map((i) => (typeof i === 'number' ? i : (i.item ?? i.pk))).filter(Boolean) as number[];

  if (itemIds.length < 2) {
    throw new Error('At least two stock items must be provided');
  }

  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error('Duplicate stock items');
  }

  const destinationLocation = await prisma.stocklocation.findUnique({ where: { id: location } });
  if (!destinationLocation) {
    throw new Error('Location not found');
  }
  if (destinationLocation.structural) {
    throw new Error('Structural locations cannot be assigned stock items');
  }

  const allItems = await prisma.stockitem.findMany({
    where: { id: { in: itemIds } },
  });

  if (allItems.length !== itemIds.length) {
    throw new Error('One or more stock items not found');
  }

  const baseItem = allItems.find((i) => i.id === itemIds[0])!;
  const otherItems = itemIds.slice(1).map((id) => allItems.find((i) => i.id === id)!);

  // Validate state for base and secondary items
  for (const item of allItems) {
    if (item.salesOrderId !== null) {
      throw new Error('Stock item has been assigned to a sales order');
    }
    if (item.belongsToId !== null) {
      throw new Error('Stock item is installed in another item');
    }
    if (item.customerId !== null) {
      throw new Error('Stock item has been assigned to a customer');
    }
    if (item.isBuilding) {
      throw new Error('Stock item is currently in production');
    }
    if (item.serial && item.serial.trim() !== '') {
      throw new Error('Serialized stock cannot be merged');
    }

    const installedCount = await prisma.stockitem.count({ where: { belongsToId: item.id } });
    if (installedCount > 0) {
      throw new Error('Stock item contains other items');
    }
  }

  // Validate compatibility with base item
  for (const other of otherItems) {
    if (other.partId !== baseItem.partId) {
      throw new Error('Stock items must refer to the same part');
    }
    if (!allow_mismatched_suppliers && other.supplierPartId !== baseItem.supplierPartId) {
      throw new Error('Stock items must refer to the same supplier part');
    }
    if (!allow_mismatched_status && other.status !== baseItem.status) {
      throw new Error('Stock status codes must match');
    }
  }

  let totalAdded = 0;
  for (const other of otherItems) {
    totalAdded += Number(other.quantity);
  }
  const newQuantity = Number(baseItem.quantity) + totalAdded;

  // Compute weighted average purchase price
  let totalPrice = 0;
  let priceQty = 0;
  if (baseItem.purchasePrice !== null && baseItem.purchasePrice !== undefined) {
    const p = Number(baseItem.purchasePrice);
    const q = Number(baseItem.quantity);
    totalPrice += p * q;
    priceQty += q;
  }
  for (const other of otherItems) {
    if (other.purchasePrice !== null && other.purchasePrice !== undefined) {
      const p = Number(other.purchasePrice);
      const q = Number(other.quantity);
      totalPrice += p * q;
      priceQty += q;
    }
  }
  const newPurchasePrice = priceQty > 0 ? totalPrice / priceQty : baseItem.purchasePrice;

  // Update allocations and delete secondary items
  for (const other of otherItems) {
    await prisma.builditem.updateMany({
      where: { stockItemId: other.id },
      data: { stockItemId: baseItem.id },
    });
    await prisma.salesorderallocation.updateMany({
      where: { itemId: other.id },
      data: { itemId: baseItem.id },
    });
    await prisma.transferorderallocation.updateMany({
      where: { itemId: other.id },
      data: { itemId: baseItem.id },
    });

    if (baseItem.parentId === other.id) {
      baseItem.parentId = null;
    }

    await prisma.stockitem.delete({ where: { id: other.id } });
  }

  await prisma.stockitem.update({
    where: { id: baseItem.id },
    data: {
      quantity: newQuantity,
      locationId: location,
      purchasePrice: newPurchasePrice !== null ? newPurchasePrice : undefined,
      parentId: baseItem.parentId,
    },
  });

  await createTrackingEntry(
    baseItem.id,
    StockHistoryCode.MERGED_STOCK_ITEMS,
    notes ?? '',
    {
      quantity: Number(newQuantity),
      added: Number(totalAdded),
    },
    userId
  );

  return { success: true };
}

export interface ReturnStockItemsParams {
  items: Array<{ pk: number; quantity?: number; status?: string; location?: number; item?: number }>;
  location?: number;
  merge?: boolean;
  notes?: string;
  userId?: number;
}

export async function returnStockItems(params: ReturnStockItemsParams) {
  const { items, merge = false, notes, userId } = params;

  if (!items || items.length === 0) {
    throw new Error('Items list cannot be empty');
  }

  for (const entry of items) {
    const targetLocId = entry.location ?? params.location;
    if (!targetLocId) {
      throw new Error('location required');
    }

    const destinationLocation = await prisma.stocklocation.findUnique({ where: { id: targetLocId } });
    if (!destinationLocation) {
      throw new Error('Location not found');
    }
    if (destinationLocation.structural) {
      throw new Error('Structural locations cannot be assigned stock items');
    }

    const stockItem = await prisma.stockitem.findUnique({
      where: { id: entry.pk },
      include: { parent: true, customer: true, consumedBy: true },
    });

    if (!stockItem) {
      throw new Error(`Stock item ${entry.pk} not found`);
    }

    const qty = entry.quantity !== undefined ? Number(entry.quantity) : undefined;
    const isSerialized = Boolean(stockItem.serial && stockItem.serial.trim() !== '');

    if (qty !== undefined && !isSerialized) {
      if (qty <= 0) {
        throw new Error('Quantity must be greater than zero');
      }
      if (qty > Number(stockItem.quantity)) {
        throw new Error('Quantity exceeds available stock');
      }
    }

    let targetItem = stockItem;

    if (qty !== undefined && qty < Number(stockItem.quantity) && !isSerialized) {
      // Split item
      const remQty = Number(stockItem.quantity) - qty;
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: { quantity: remQty },
      });

      const splitItem = await prisma.stockitem.create({
        data: {
          partId: stockItem.partId,
          locationId: targetLocId,
          quantity: qty,
          status: entry.status ? String(entry.status) : stockItem.status,
          parentId: stockItem.id,
          batch: stockItem.batch,
          purchasePrice: stockItem.purchasePrice,
          expiryDate: stockItem.expiryDate,
          link: stockItem.link,
          isBuilding: false,
          deleteOnDeplete: stockItem.deleteOnDeplete,
          serialInt: 0,
          creationDate: new Date(),
        },
      });

      targetItem = splitItem as any;
    }

    const deltas: any = {
      quantity: qty ?? Number(targetItem.quantity),
      location: targetLocId,
    };

    if (stockItem.customerId) {
      deltas.customer = stockItem.customerId;
    }
    if (stockItem.consumedById) {
      deltas.build_order = stockItem.consumedById;
    }
    if (entry.status && String(entry.status) !== stockItem.status) {
      deltas.status = String(entry.status);
      deltas.old_status = stockItem.status;
    }

    await prisma.stockitem.update({
      where: { id: targetItem.id },
      data: {
        consumedById: null,
        customerId: null,
        belongsToId: null,
        salesOrderId: null,
        locationId: targetLocId,
        status: entry.status ? String(entry.status) : undefined,
      },
    });

    await prisma.salesorderallocation.deleteMany({ where: { itemId: targetItem.id } });
    await prisma.builditem.deleteMany({ where: { stockItemId: targetItem.id } });
    await prisma.transferorderallocation.deleteMany({ where: { itemId: targetItem.id } });

    await createTrackingEntry(
      targetItem.id,
      StockHistoryCode.RETURNED_TO_STOCK,
      notes ?? '',
      deltas,
      userId
    );

    if (merge && !isSerialized && targetItem.parentId !== null) {
      const parent = await prisma.stockitem.findUnique({ where: { id: targetItem.parentId } });
      if (parent && parent.locationId === targetLocId) {
        await mergeStockItems({
          items: [{ pk: parent.id }, { pk: targetItem.id }],
          location: targetLocId,
          notes: notes,
          userId: userId,
        });
      }
    }
  }

  return { success: true };
}

export async function convertStockItem(pk: number, targetPartId: number, userId?: number, notes?: string) {
  const item = await prisma.stockitem.findUnique({
    where: { id: pk },
    include: { part: true },
  });
  if (!item) {
    throw new Error('Stock item not found');
  }

  const sourcePart = item.part ?? (await prisma.part.findUnique({ where: { id: item.partId } }));
  if (!sourcePart) {
    throw new Error('Part not found');
  }

  const targetPart = await prisma.part.findUnique({ where: { id: targetPartId } });
  if (!targetPart) {
    throw new Error('Part not found');
  }

  if (item.supplierPartId !== null && item.supplierPartId !== undefined) {
    throw new Error('Cannot convert stock item with assigned SupplierPart');
  }

  if (targetPart.id === item.partId) {
    return { success: true };
  }

  if (!targetPart.active) {
    throw new Error('Selected part is not a valid option for conversion');
  }
  if (targetPart.virtual) {
    throw new Error('Selected part is not a valid option for conversion');
  }

  const options = await getConversionOptions(item.partId);
  const isValid = options.some((opt) => opt.id === targetPart.id);
  if (!isValid) {
    throw new Error('Selected part is not a valid option for conversion');
  }

  await prisma.stockitem.update({
    where: { id: pk },
    data: { partId: targetPart.id },
  });

  await createTrackingEntry(
    pk,
    StockHistoryCode.CONVERTED_TO_VARIANT,
    notes ?? `Converted to part: ${targetPart.name}`,
    { part: targetPart.id },
    userId
  );

  return { success: true };
}

export interface InstallStockItemParams {
  assemblyId: number;
  stockItemId: number;
  quantity?: number;
  note?: string;
  userId?: number;
}

export async function installStockItem(params: InstallStockItemParams) {
  const { assemblyId, stockItemId, quantity = 1, note, userId } = params;

  const assembly = await prisma.stockitem.findUnique({
    where: { id: assemblyId },
    include: { part: true },
  });
  if (!assembly) {
    throw new Error('Stock item not found');
  }

  const assemblyPart = assembly.part ?? (await prisma.part.findUnique({ where: { id: assembly.partId } }));
  if (!assemblyPart || !assemblyPart.assembly) {
    throw new Error('Item is not an assembly');
  }

  const child = await prisma.stockitem.findUnique({
    where: { id: stockItemId },
    include: { part: true },
  });
  if (!child) {
    throw new Error('Stock item not found');
  }

  const childPart = child.part ?? (await prisma.part.findUnique({ where: { id: child.partId } }));
  if (!childPart) {
    throw new Error('Part not found');
  }

  if (child.belongsToId === assembly.id) {
    return { success: true };
  }

  if (
    (child.belongsToId !== null && child.belongsToId !== assembly.id) ||
    child.customerId !== null ||
    (child.consumedById !== null && child.consumedById !== assembly.id) ||
    child.salesOrderId !== null ||
    child.isBuilding
  ) {
    throw new Error('Stock item is unavailable');
  }

  const inBom = await checkIfPartInBom(assembly.partId, child.partId);
  if (!inBom) {
    throw new Error('Selected part is not in the Bill of Materials');
  }

  const qty = Number(quantity);
  if (qty < 1) {
    throw new Error('Quantity to install must be at least 1');
  }
  if (qty > Number(child.quantity)) {
    throw new Error('Quantity to install must not exceed available quantity');
  }

  let targetChild = child;
  const isSerialized = Boolean(child.serial && child.serial.trim() !== '');

  if (qty < Number(child.quantity) && !isSerialized) {
    const remQty = Number(child.quantity) - qty;
    await prisma.stockitem.update({
      where: { id: child.id },
      data: { quantity: remQty },
    });

    const splitChild = await prisma.stockitem.create({
      data: {
        partId: child.partId,
        locationId: null,
        quantity: qty,
        status: child.status,
        parentId: child.id,
        batch: child.batch,
        purchasePrice: child.purchasePrice,
        expiryDate: child.expiryDate,
        link: child.link,
        isBuilding: false,
        deleteOnDeplete: child.deleteOnDeplete,
        serialInt: 0,
        creationDate: new Date(),
      },
    });

    targetChild = splitChild as any;
  }

  await prisma.stockitem.update({
    where: { id: targetChild.id },
    data: {
      belongsToId: assembly.id,
      locationId: null,
    },
  });

  await createTrackingEntry(
    targetChild.id,
    StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
    note ?? '',
    {
      stockitem: assembly.id,
      quantity: Number(qty),
    },
    userId
  );

  await createTrackingEntry(
    assembly.id,
    StockHistoryCode.INSTALLED_CHILD_ITEM,
    note ?? '',
    {
      stockitem: targetChild.id,
      quantity: Number(qty),
    },
    userId
  );

  return { success: true };
}

export interface UninstallStockItemParams {
  stockItemId: number;
  location: number;
  quantity?: number;
  note?: string;
  userId?: number;
}

export async function uninstallStockItem(params: UninstallStockItemParams) {
  const { stockItemId, location, quantity, note, userId } = params;

  const item = await prisma.stockitem.findUnique({
    where: { id: stockItemId },
  });
  if (!item) {
    throw new Error('Stock item not found');
  }

  if (item.belongsToId === null) {
    throw new Error('Stock item is not currently installed');
  }

  const destLocation = await prisma.stocklocation.findUnique({ where: { id: location } });
  if (!destLocation) {
    throw new Error('Location not found');
  }
  if (destLocation.structural) {
    throw new Error('Cannot assign stock to structural location');
  }

  const parentAssemblyId = item.belongsToId;
  const isSerialized = Boolean(item.serial && item.serial.trim() !== '');
  const qty = quantity !== undefined ? Number(quantity) : Number(item.quantity);

  if (qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (qty > Number(item.quantity)) {
    throw new Error('Quantity to uninstall exceeds installed quantity');
  }

  let targetItem = item;

  if (qty < Number(item.quantity) && !isSerialized) {
    const remQty = Number(item.quantity) - qty;
    await prisma.stockitem.update({
      where: { id: item.id },
      data: { quantity: remQty },
    });

    const splitItem = await prisma.stockitem.create({
      data: {
        partId: item.partId,
        locationId: location,
        quantity: qty,
        status: item.status,
        parentId: item.id,
        batch: item.batch,
        purchasePrice: item.purchasePrice,
        expiryDate: item.expiryDate,
        link: item.link,
        isBuilding: false,
        deleteOnDeplete: item.deleteOnDeplete,
        serialInt: 0,
        belongsToId: null,
        consumedById: null,
        creationDate: new Date(),
      },
    });

    targetItem = splitItem as any;
  } else {
    await prisma.stockitem.update({
      where: { id: item.id },
      data: {
        belongsToId: null,
        consumedById: null,
        locationId: location,
      },
    });
  }

  await createTrackingEntry(
    parentAssemblyId,
    StockHistoryCode.REMOVED_CHILD_ITEM,
    note ?? '',
    {
      stockitem: targetItem.id,
      quantity: Number(qty),
    },
    userId
  );

  await createTrackingEntry(
    targetItem.id,
    StockHistoryCode.REMOVED_FROM_ASSEMBLY,
    note ?? '',
    {
      stockitem: parentAssemblyId,
      quantity: Number(qty),
    },
    userId
  );

  return { success: true };
}

export interface SerializeStockItemParams {
  stockItemId: number;
  quantity?: number;
  serial_numbers: string;
  destination?: number;
  notes?: string;
  userId?: number;
}

export async function serializeStockItem(params: SerializeStockItemParams) {
  const { stockItemId, serial_numbers, notes, userId } = params;

  const item = await prisma.stockitem.findUnique({
    where: { id: stockItemId },
    include: { part: true },
  });
  if (!item) {
    throw new Error('Stock item not found');
  }

  const itemPart = item.part ?? (await prisma.part.findUnique({ where: { id: item.partId } }));
  if (!itemPart || !itemPart.trackable) {
    throw new Error('Serial numbers cannot be assigned to this part');
  }

  if (item.serial && item.serial.trim() !== '') {
    throw new Error('Stock item is already serialized');
  }

  const destLocationId = params.destination ?? item.locationId;
  if (destLocationId) {
    const destLocation = await prisma.stocklocation.findUnique({ where: { id: destLocationId } });
    if (!destLocation) {
      throw new Error('Location not found');
    }
    if (destLocation.structural) {
      throw new Error('Cannot assign stock to structural location');
    }
  }

  let qty = params.quantity !== undefined ? Number(params.quantity) : undefined;
  if (qty === undefined) {
    const latestSerial = await getLatestSerialNumber(item.partId);
    const initialSerials = extractSerialNumbers(serial_numbers, 1, latestSerial);
    qty = initialSerials.length;
  }

  if (isNaN(qty) || qty <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  if (qty > 1000) {
    throw new Error('Cannot serialize more than 1000 items at once');
  }
  if (qty > Number(item.quantity)) {
    throw new Error(`Quantity must not exceed available stock quantity (${item.quantity})`);
  }

  const latestSerial = await getLatestSerialNumber(item.partId);
  const serials = extractSerialNumbers(serial_numbers, qty, latestSerial);

  const conflicts = await findConflictingSerialNumbers(item.partId, serials);
  if (conflicts.length > 0) {
    throw new Error(`Serial numbers already exist: ${conflicts.join(',')}`);
  }

  const existingTestResults = await prisma.stockitemtestresult.findMany({
    where: { stockItemId: item.id },
  });

  const createdItems: any[] = [];

  for (const serial of serials) {
    const serialInt = parseInt(serial, 10) || 0;
    const newItem = await prisma.stockitem.create({
      data: {
        partId: item.partId,
        locationId: destLocationId,
        quantity: 1,
        serial: serial,
        serialInt: serialInt,
        batch: item.batch,
        purchasePrice: item.purchasePrice,
        expiryDate: item.expiryDate,
        link: item.link,
        status: item.status,
        parentId: item.id,
        isBuilding: false,
        deleteOnDeplete: item.deleteOnDeplete,
        creationDate: new Date(),
      },
    });

    createdItems.push(newItem);

    await createTrackingEntry(
      newItem.id,
      StockHistoryCode.SPLIT_FROM_PARENT,
      notes ?? '',
      {
        quantity: 1,
        location: destLocationId,
      },
      userId
    );

    await createTrackingEntry(
      newItem.id,
      StockHistoryCode.ASSIGNED_SERIAL,
      notes ?? '',
      {
        serial: serial,
      },
      userId
    );

    for (const tr of existingTestResults) {
      await prisma.stockitemtestresult.create({
        data: {
          result: tr.result,
          value: tr.value,
          attachment: tr.attachment,
          notes: tr.notes,
          testStation: tr.testStation,
          startedDatetime: tr.startedDatetime,
          finishedDatetime: tr.finishedDatetime,
          date: new Date(),
          stockItemId: newItem.id,
          templateId: tr.templateId,
          userId: tr.userId,
        },
      });
    }
  }

  const remQuantity = Number(item.quantity) - qty;

  await createTrackingEntry(
    item.id,
    StockHistoryCode.STOCK_SERIALIZED,
    notes ?? '',
    {
      quantity: remQuantity,
      removed: qty,
    },
    userId
  );

  if (remQuantity === 0 && item.deleteOnDeplete) {
    await prisma.stockitem.delete({ where: { id: item.id } });
  } else {
    await prisma.stockitem.update({
      where: { id: item.id },
      data: { quantity: remQuantity },
    });
  }

  return createdItems;
}
