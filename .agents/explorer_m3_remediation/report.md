# Stock Item Actions (Requirement R3) & Test Harness Remediation Blueprint

**Agent**: `explorer_m3_remediation`  
**Role**: `teamwork_preview_explorer`  
**Target Subsystem**: `src/backend/src/modules/stock/` & `src/backend/src/test/`  
**Date**: 2026-08-19  

---

## Executive Summary

A comprehensive forensic investigation of all 6 Stock Item Action endpoints (Requirement R3) and the test harness was conducted across `src/backend/src/modules/stock/` (`stock.routes.ts`, `stock.service.ts`, `stock.service.test.ts`) and `src/backend/src/test/` (E2E Tiers 1–4, `mockDb.ts`, `testApp.ts`, `fixtures.ts`).

### Key Root Causes Identified:
1. **Payload Structure & Parameter Aliasing Divergence**:
   - `/api/stock/merge`: E2E tests invoke `{ target: targetId, items: [srcId1, srcId2] }` without `location`. Route strictly expected `{ items: [...], location: ... }` and failed when `location` was omitted instead of defaulting to target's existing `locationId`.
   - `/api/stock/return`: E2E tests invoke `{ items: [{ pk: id, location: locId }] }` with per-item location. Route strictly required top-level `body.location`.
   - `/api/stock/:pk/install`: E2E tests pass child item PK in URL with `{ target: assemblyId }`, whereas route expected assembly item PK in URL with `{ stock_item: childId }`.
   - `/api/stock/:pk/uninstall`: E2E tests invoke partial uninstall `{ quantity: 2, location: locId }`. Route and service did not support `quantity` or partial splitting.
   - `/api/stock/:pk/serialize`: E2E tests omit `destination` (relying on parent `locationId`) and test response `.success`. Route strictly required mandatory `destination` and returned an unadorned array without `{ success: true }`.
2. **HTTP Status Code Discrepancy**:
   - Stock action route handlers returned `201 Created` for `/merge`, `/return`, `/:pk/convert`, `/:pk/install`, `/:pk/uninstall`, and `/:pk/serialize`.
   - E2E tests assert `expect(res.status).toBe(200)`.
3. **MockDb Relation Loading vs Service Access (`part` relation on `stockitem`)**:
   - In `mockDb.ts`, Prisma relations (`include: { part: true }`) are not automatically populated on store objects. Accessing `item.part.assembly` or `item.part.trackable` directly caused `TypeError: Cannot read properties of undefined` in `installStockItem` and `serializeStockItem`. Resilient fallback loading (`item.part ?? await prisma.part.findUnique(...)`) resolves this across both real Prisma and mockDb harnesses.

---

## 1. Line-by-Line Blueprint: `src/backend/src/modules/stock/stock.routes.ts`

### 1.1 `/api/stock/merge` (Lines 250–267)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/merge', async (c) => {
  try {
    const body = await c.req.json();
    const location = toInt(body.location);
    if (!location) return sendError(c, 400, 'location required');
    const result = await mergeStockItems({
      items: body.items,
      location,
      notes: body.notes,
      allow_mismatched_suppliers: body.allow_mismatched_suppliers,
      allow_mismatched_status: body.allow_mismatched_status,
    });
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

### 1.2 `/api/stock/return` (Lines 269–285)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/return', async (c) => {
  try {
    const body = await c.req.json();
    const location = toInt(body.location);
    if (!location) return sendError(c, 400, 'location required');
    const result = await returnStockItems({
      items: body.items,
      location,
      merge: body.merge,
      notes: body.notes,
    });
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

### 1.3 `/api/stock/:pk/convert` (Lines 437–449)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/:pk/convert', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const partId = toInt(body.part);
    if (!partId) return sendError(c, 400, 'part required');
    const result = await convertStockItem(pk, partId);
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('Stock item not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

### 1.4 `/api/stock/:pk/install` (Lines 451–468)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/:pk/install', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const stockItemId = toInt(body.stock_item);
    if (!stockItemId) return sendError(c, 400, 'stock_item required');
    const result = await installStockItem({
      assemblyId: pk,
      stockItemId,
      quantity: body.quantity !== undefined ? toInt(body.quantity) : undefined,
      note: body.note,
    });
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

### 1.5 `/api/stock/:pk/uninstall` (Lines 470–486)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/:pk/uninstall', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const location = toInt(body.location);
    if (!location) return sendError(c, 400, 'location required');
    const result = await uninstallStockItem({
      stockItemId: pk,
      location,
      note: body.note,
    });
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

### 1.6 `/api/stock/:pk/serialize` (Lines 488–509)

#### Target File: `src/backend/src/modules/stock/stock.routes.ts`
```typescript
// BEFORE:
stockRouter.post('/api/stock/:pk/serialize', async (c) => {
  const pk = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const quantity = toInt(body.quantity);
    const destination = toInt(body.destination);
    if (!quantity || !body.serial_numbers || !destination) {
      return sendError(c, 400, 'quantity, serial_numbers, and destination required');
    }
    const result = await serializeStockItem({
      stockItemId: pk,
      quantity,
      serial_numbers: String(body.serial_numbers),
      destination,
      notes: body.notes,
    });
    return c.json(result, 201);
  } catch (err: any) {
    const status = err.message.includes('not found') ? 404 : 400;
    return sendError(c, status, err.message);
  }
});

// AFTER:
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
```

---

## 2. Line-by-Line Blueprint: `src/backend/src/modules/stock/stock.service.ts`

### 2.1 `returnStockItems` (Lines 533–663)
- Support per-entry location overrides (`entry.location ?? params.location`).
- If `params.location` is not specified top-level, validate each entry's location individually.
- Resiliently handle status resets when returning quarantined/inspection items.

```typescript
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
```

---

### 2.2 `convertStockItem` (Lines 665–707)
- Add optional `notes?: string` parameter.
- Support relation lookup fallback for `part`.

```typescript
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
```

---

### 2.3 `installStockItem` (Lines 717–825)
- Fallback relation lookup for `assembly.part` and `child.part`.

```typescript
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

  if (
    child.belongsToId !== null ||
    child.customerId !== null ||
    child.consumedById !== null ||
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
```

---

### 2.4 `uninstallStockItem` (Lines 827–890)
- Add support for partial quantity uninstallation & splitting.

```typescript
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
```

---

### 2.5 `serializeStockItem` (Lines 892–1039)
- Auto-derive `destination` from `item.locationId` if omitted.
- Auto-derive `quantity` from serial expressions if omitted.
- Fallback relation lookup for `item.part`.

```typescript
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
```

---

## 3. Verification Plan

1. Apply the line-by-line blueprint changes to `src/backend/src/modules/stock/stock.routes.ts` and `src/backend/src/modules/stock/stock.service.ts`.
2. Run stock unit tests:
   ```bash
   npx vitest run src/modules/stock/stock.service.test.ts
   ```
3. Run E2E stock tests:
   ```bash
   npx vitest run src/test/e2e/tier1_features/tier1_stock_features.test.ts
   npx vitest run src/test/e2e/tier2_boundaries/tier2_stock_boundaries.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_build_stock.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_cross_subsystem.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_orders_stock.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario2_return_inspection_restock.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario3_warehouse_transfer.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario4_sales_order_serials.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario5_assembly_teardown.test.ts
   ```
4. Verify all tests pass with 0 failures.
