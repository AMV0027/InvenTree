# Build Order Operations (Requirement R1) Remediation Blueprint & Analysis

**Author**: `explorer_m1_remediation` (Role: teamwork_preview_explorer)  
**Target Module**: `src/backend/src/modules/build/` (`build.routes.ts`, `build.service.ts`, `build.service.test.ts`)  
**Associated Test Suites**: 
- `src/backend/src/modules/build/build.service.test.ts`
- `src/backend/src/test/e2e/tier1_features/tier1_build_features.test.ts`
- `src/backend/src/test/e2e/tier2_boundaries/tier2_build_boundaries.test.ts`
- `src/backend/src/test/e2e/tier3_interactions/tier3_build_stock.test.ts`
- `src/backend/src/test/e2e/tier3_interactions/tier3_cross_subsystem.test.ts`
- `src/backend/src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts`

---

## 1. Executive Summary & Root Cause Analysis

An in-depth static code analysis and contract trace was conducted across the Node.js Hono backend build module and all E2E test suites (Tiers 1–4). The underlying business logic services implemented in `build.service.ts` correctly capture the core relational logic (stock splits, `deleteOnDeplete`, BOM variant traversal, assembly installation, and tracking history codes `56`, `57`, `30`, `35`, `40`, `42`).

However, several critical interface, parameter placement, default value, and validation contract mismatches cause test failures across all 5 Build Order endpoints:

1. **Scrap Outputs (`/api/build/:pk/scrap-outputs`)**:
   - `build.service.ts:160, 169` strictly requires top-level `location` and `notes`. E2E tests send `location` and `notes` nested inside each item of the `outputs` array (`outputs[i].location`, `outputs[i].notes`) and frequently omit `location` or `notes` entirely (e.g. test 1.2, test 1.3, test 1.4, test 1.5, test 3.8).
   - Missing build status guard: scrapping on a completed build order (`status === '30'` / `'40'`) is not rejected.

2. **Auto-Allocate (`/api/build/:pk/auto-allocate`)**:
   - `interchangeable`: `build.service.ts:451` defaults `allowInterchangeable = data.interchangeable === true` (defaulting to `false`). When multiple candidate stock items exist to fulfill a build line, it skips the line entirely unless `interchangeable: true` is explicitly provided. In InvenTree Python and E2E test 2.3, multi-item allocation is standard behavior (`interchangeable` should default to `true`).
   - Parameter aliases: E2E test 2.5 passes `allow_substitutes: true` instead of `substitutes: true`, and tests pass `optional_items` / `allow_optional`.
   - Missing build status guard: auto-allocating on a CANCELLED or COMPLETE build order is not rejected.

3. **Allocate (`/api/build/:pk/allocate`)**:
   - Parameter naming: E2E tests and scenarios pass `install_into: output.id` (or `installIntoId`), whereas `build.service.ts:617` strictly extracted `item.output`.
   - Over-restrictive trackability guards: `build.service.ts:675, 684` throws an error if a trackable part is allocated without an output, or if an untracked part specifies an output. In InvenTree, general allocation of serialized/trackable parts to a build order without specifying a specific output is fully valid (tested in E2E test 3.3).
   - Stock availability validation: allocating quarantined (`status = '75'`) or rejected (`status = '65'`) stock items must be rejected with 400 (boundary test 3.5).
   - Single item vs array payload: supports both `{ items: [...] }` and single-object `{ build_line, stock_item, quantity, install_into }`.

4. **Unallocate (`/api/build/:pk/unallocate`)**:
   - Missing `items` support: `build.service.ts:730` only supported `{ build_line, output }`. E2E test 4.3 passes `{ items: [allocId] }` and test 4.4 passes `{ items: [{ build_item: alloc.id, quantity: 2 }] }` (partial unallocation).
   - Over-filtering on `installIntoId`: `build.service.ts:767` filtered `installIntoId = null` when `output` was omitted, causing it to fail to unallocate items assigned to outputs during full build unallocations (`tier1_build_features.test.ts:293`).
   - Missing build status guard: unallocating on a completed build order must reject with 400 (boundary test 4.2).

5. **Consume (`/api/build/:pk/consume`)**:
   - Rejecting empty payloads: `build.service.ts:793` threw 400 when neither `items` nor `lines` was passed. In InvenTree Python and E2E tests (`tier1` 5.1–5.5, `tier3` 3.1, 3.7, 3.8, `tier4` scenario 1), sending `{}` or `{ notes: '...' }` instructs the backend to consume ALL outstanding allocations for the build order.
   - Build status validation: consuming when build is in `PENDING` (`status = '10'`) or `CANCELLED` (`status = '30'`) must be rejected with 400 (boundary tests 5.2, 5.4). Must only allow consumption when build is in `PRODUCTION` (`status = '20'`).
   - Graceful empty allocation handling: if no allocations exist when consume is invoked, return `{ success: true }` (200 OK) without error (boundary test 5.3, 5.5).

---

## 2. Endpoint-by-Endpoint Parameter & Schema Mismatches

| Endpoint | Received Test Payload | Expected by Old `build.service.ts` | Normalized Fix |
| :--- | :--- | :--- | :--- |
| `POST /api/build/:pk/scrap-outputs` | `{ outputs: [{ output: 10, quantity: 2, location: 5, notes: '...' }] }` or `{ location: 5, outputs: [{ output: 10 }] }` or `{ outputs: [{ output: 10, notes: '...' }] }` | Strictly required top-level `location` & `notes` | Resolve per item: `entry.location ?? data.location ?? stockItem.locationId ?? build.destinationId ?? null`. Resolve notes: `entry.notes ?? data.notes ?? 'Scrapped build output'`. Location & notes are optional. |
| `POST /api/build/:pk/auto-allocate` | `{}` (needed 50, item1 has 30, item2 has 40) | `allowInterchangeable = false` (skipped line!) | Default `allowInterchangeable = data.interchangeable !== false` (defaults to `true`). |
| `POST /api/build/:pk/auto-allocate` | `{ allow_substitutes: true }` | `data.substitutes` | Check `(data.allow_substitutes ?? data.substitutes) !== false`. |
| `POST /api/build/:pk/allocate` | `{ items: [{ build_line: 1, stock_item: 2, quantity: 1, install_into: 5 }] }` | `item.output` | Check `item.output ?? item.install_into ?? item.installIntoId ?? null`. |
| `POST /api/build/:pk/allocate` | `{ items: [{ build_line: 1, stock_item: 2, quantity: 1 }] }` (trackable component) | Threw 400 "Build output must be specified for tracked parts" | Remove mandatory output requirement; trackable components can be allocated generally to the build. Validate output only if `outputId` is provided. |
| `POST /api/build/:pk/allocate` | `{ items: [{ build_line: 1, stock_item: 2, quantity: 1 }] }` (where stock status = 65 or 75) | Permitted non-10 stock | Add check: `if (stockItem.status === '65' \|\| stockItem.status === '75') throw new BuildError('Item is not available for allocation', 400);` |
| `POST /api/build/:pk/unallocate` | `{ items: [101] }` or `{ items: [{ build_item: 101, quantity: 2 }] }` | Only accepted `{ build_line, output }` | Handle `data.items`: delete item or decrement allocation quantity by `item.quantity`. |
| `POST /api/build/:pk/unallocate` | `{}` (unallocate all) | Set `installIntoId = null`, leaving output allocations undeleted | If `output` filter is not specified, delete all allocations across all `installIntoId` values. |
| `POST /api/build/:pk/consume` | `{}` or `{ notes: 'Completed batch' }` | Threw 400 "At least one item or line must be provided" | If neither `items` nor `lines` are provided, query all `buildline` IDs for the build and consume all allocated `builditem` records. |
| `POST /api/build/:pk/consume` | `{}` on build with `status = '10'` (PENDING) | Accepted PENDING | Check `if (build.status !== BuildStatus.PRODUCTION) throw new BuildError('Build order is not in production', 400);` |

---

## 3. Detailed Line-by-Line Remediation Blueprint

### A. Modifications to `src/backend/src/modules/build/build.service.ts`

#### 1. `scrapBuildOutputs` (Lines 142–255)
```typescript
export interface ScrapOutputsData {
  outputs: Array<{
    output?: number;
    stock_item?: number;
    id?: number;
    quantity?: number;
    location?: number | null;
    notes?: string;
  }> | number[];
  location?: number | null;
  discard_allocations?: boolean;
  notes?: string;
}

export async function scrapBuildOutputs(buildId: number, data: ScrapOutputsData, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.COMPLETE || build.status === BuildStatus.CANCELLED) {
    throw new BuildError('Cannot scrap outputs for a completed or cancelled build', 400);
  }

  if (!data.outputs || !Array.isArray(data.outputs) || data.outputs.length === 0) {
    throw new BuildError('A list of build outputs must be provided', 400);
  }

  // Pre-validate all outputs
  for (const rawItem of data.outputs) {
    const outputId = typeof rawItem === 'number' ? rawItem : (rawItem.output ?? rawItem.stock_item ?? rawItem.id);
    if (!outputId) throw new BuildError('Output ID must be specified', 400);

    const stockItem = await prisma.stockitem.findUnique({ where: { id: outputId } });
    if (!stockItem) throw new BuildError('Stock item does not exist', 400);
    if (stockItem.buildId !== build.id) throw new BuildError('Build output does not match the parent build', 400);
    if (stockItem.partId !== build.partId) throw new BuildError('Output part does not match BuildOrder part', 400);
    if (!stockItem.isBuilding) throw new BuildError('This build output has already been completed', 400);

    const stockQty = toNumber(stockItem.quantity);
    const scrapQty = (typeof rawItem === 'object' && rawItem.quantity !== undefined) ? Number(rawItem.quantity) : stockQty;
    if (isNaN(scrapQty) || scrapQty <= 0) throw new BuildError('Quantity must be greater than zero', 400);
    if (scrapQty > stockQty) throw new BuildError('Quantity cannot be greater than the output quantity', 400);

    const targetLocId = (typeof rawItem === 'object' && rawItem.location) ? rawItem.location : data.location;
    if (targetLocId) {
      const loc = await prisma.stocklocation.findUnique({ where: { id: targetLocId } });
      if (!loc) throw new BuildError('Invalid location', 400);
    }
  }

  const discardAllocations = data.discard_allocations === true;

  for (const rawItem of data.outputs) {
    const outputId = typeof rawItem === 'number' ? rawItem : (rawItem.output ?? rawItem.stock_item ?? rawItem.id)!;
    const itemObj = typeof rawItem === 'object' ? rawItem : { output: outputId };
    
    const stockItem = (await prisma.stockitem.findUnique({ where: { id: outputId } }))!;
    const stockQty = toNumber(stockItem.quantity);
    const scrapQty = itemObj.quantity !== undefined ? Number(itemObj.quantity) : stockQty;
    const finalLocation = itemObj.location ?? data.location ?? stockItem.locationId ?? build.destinationId ?? null;
    const finalNotes = itemObj.notes ?? data.notes ?? 'Scrapped build output';

    let scrappedItemId = stockItem.id;

    if (scrapQty < stockQty) {
      // Partial scrap: reduce original and create rejected child
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: { quantity: stockQty - scrapQty }
      });

      const child = await prisma.stockitem.create({
        data: {
          partId: stockItem.partId,
          quantity: scrapQty,
          batch: stockItem.batch,
          locationId: finalLocation,
          status: StockStatus.REJECTED,
          isBuilding: false,
          parentId: stockItem.id,
          buildId: build.id,
          deleteOnDeplete: stockItem.deleteOnDeplete,
          serialInt: 0,
          creationDate: new Date(),
        }
      });
      scrappedItemId = child.id;

      await prisma.stockitemtracking.create({
        data: {
          itemId: child.id,
          partId: child.partId,
          trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
          notes: finalNotes,
          deltas: { quantity: scrapQty, parent: stockItem.id },
          date: new Date(),
          userId
        }
      });

      await prisma.stockitemtracking.create({
        data: {
          itemId: stockItem.id,
          partId: stockItem.partId,
          trackingType: StockHistoryCode.SPLIT_CHILD_ITEM,
          notes: finalNotes,
          deltas: { quantity: scrapQty, child: child.id },
          date: new Date(),
          userId
        }
      });
    } else {
      // Full scrap
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: {
          isBuilding: false,
          status: StockStatus.REJECTED,
          locationId: finalLocation
        }
      });
      scrappedItemId = stockItem.id;
    }

    // Process attached allocations and log tracking...
    // (Retain existing allocation completion / discard logic with finalNotes and finalLocation)
  }

  return { success: true };
}
```

---

#### 2. `autoAllocateBuild` (Lines 415–460)
```typescript
export interface AutoAllocateData {
  location?: number | null;
  exclude_location?: number | null;
  interchangeable?: boolean;
  substitutes?: boolean;
  allow_substitutes?: boolean;
  optional_items?: boolean;
  allow_optional?: boolean;
  item_type?: 'untracked' | 'tracked' | 'all';
  stock_sort_by?: string;
  build_lines?: number[];
}

export async function autoAllocateBuild(buildId: number, data: AutoAllocateData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.CANCELLED || build.status === BuildStatus.COMPLETE) {
    throw new BuildError('Cannot auto-allocate for a cancelled or completed build', 400);
  }

  const lineFilter: any = { buildId: build.id };
  if (data.build_lines && Array.isArray(data.build_lines) && data.build_lines.length > 0) {
    lineFilter.id = { in: data.build_lines };
  }

  const lines = await prisma.buildline.findMany({
    where: lineFilter,
    include: {
      bomItem: {
        include: {
          subPart: true,
          bomitemsubstitute_bomItems: {
            include: { part: true }
          }
        }
      },
      builditem_buildLines: true
    }
  });

  const itemType = data.item_type ?? 'untracked';
  const allowInterchangeable = data.interchangeable !== undefined ? Boolean(data.interchangeable) : true;
  const allowSubstitutes = (data.allow_substitutes !== undefined ? Boolean(data.allow_substitutes) : data.substitutes) !== false;
  const allowOptional = data.optional_items === true || data.allow_optional === true;

  // Remainder of matching, priority sorting, candidate allocation...
```

---

#### 3. `allocateStockToBuild` (Lines 612–727)
```typescript
export interface AllocateData {
  items?: Array<{
    build_line?: number;
    buildLineId?: number;
    line?: number;
    stock_item?: number;
    stockItemId?: number;
    item?: number;
    quantity: number;
    output?: number | null;
    install_into?: number | null;
    installIntoId?: number | null;
  }>;
  build_line?: number;
  buildLineId?: number;
  stock_item?: number;
  stockItemId?: number;
  quantity?: number;
  output?: number | null;
  install_into?: number | null;
}

export async function allocateStockToBuild(buildId: number, data: AllocateData, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.CANCELLED || build.status === BuildStatus.COMPLETE) {
    throw new BuildError('Cannot allocate stock to a cancelled or completed build', 400);
  }

  const rawItems = Array.isArray(data.items)
    ? data.items
    : (data.stock_item || (data as any).stockItemId || data.build_line ? [data as any] : []);

  if (rawItems.length === 0) {
    throw new BuildError('Allocation items must be provided', 400);
  }

  const normalizedItems = rawItems.map(item => ({
    buildLineId: item.build_line ?? item.buildLineId ?? item.line,
    stockItemId: item.stock_item ?? item.stockItemId ?? item.item,
    quantity: item.quantity,
    outputId: item.output ?? item.install_into ?? item.installIntoId ?? null,
  }));

  for (const item of normalizedItems) {
    if (!item.buildLineId || !item.stockItemId || item.quantity === undefined || item.quantity === null) {
      throw new BuildError('build_line, stock_item, and quantity are required', 400);
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BuildError('Quantity must be greater than zero', 400);
    }

    const buildLine = await prisma.buildline.findUnique({
      where: { id: item.buildLineId },
      include: {
        bomItem: {
          include: {
            subPart: true,
            bomitemsubstitute_bomItems: true
          }
        }
      }
    });
    if (!buildLine) throw new BuildError('Build line not found', 400);
    if (buildLine.buildId !== build.id) throw new BuildError('bom_item.part must point to the same part as the build order', 400);

    const stockItem = await prisma.stockitem.findUnique({
      where: { id: item.stockItemId },
      include: { part: true }
    });
    if (!stockItem) throw new BuildError('Stock item not found', 400);
    if (stockItem.isBuilding || stockItem.consumedById || stockItem.belongsToId || stockItem.customerId || toNumber(stockItem.quantity) <= 0) {
      throw new BuildError('Item must be in stock', 400);
    }
    if (stockItem.status === StockStatus.REJECTED || stockItem.status === StockStatus.QUARANTINED || stockItem.status === StockStatus.DAMAGED || stockItem.status === StockStatus.DESTROYED) {
      throw new BuildError('Item is not available for allocation', 400);
    }

    const validPartIds = [buildLine.bomItem.subPartId];
    if (buildLine.bomItem.allowVariants) {
      const variants = await prisma.part.findMany({ where: { variantOfId: buildLine.bomItem.subPartId } });
      validPartIds.push(...variants.map(v => v.id));
    }
    if (buildLine.bomItem.bomitemsubstitute_bomItems) {
      validPartIds.push(...buildLine.bomItem.bomitemsubstitute_bomItems.map(s => s.partId));
    }

    if (!validPartIds.includes(stockItem.partId)) {
      throw new BuildError('Selected stock item does not match BOM line', 400);
    }

    if (item.outputId) {
      const outputItem = await prisma.stockitem.findUnique({ where: { id: item.outputId } });
      if (!outputItem || outputItem.buildId !== build.id || !outputItem.isBuilding) {
        throw new BuildError('Invalid build output', 400);
      }
    }

    const existingBi = await prisma.builditem.findFirst({
      where: {
        buildLineId: item.buildLineId,
        stockItemId: item.stockItemId,
        installIntoId: item.outputId ?? null
      }
    });

    const allAllocs = await prisma.builditem.findMany({
      where: { stockItemId: item.stockItemId }
    });

    const otherAllocated = allAllocs
      .filter(bi => bi.id !== existingBi?.id)
      .reduce((sum, bi) => sum + toNumber(bi.quantity), 0);

    const available = toNumber(stockItem.quantity) - otherAllocated;
    const targetTotal = (existingBi ? toNumber(existingBi.quantity) : 0) + qty;

    if (targetTotal > available) {
      const unallocatedLeft = Math.max(0, available - (existingBi ? toNumber(existingBi.quantity) : 0));
      throw new BuildError(`Available quantity (${unallocatedLeft}) exceeded`, 400);
    }
  }

  for (const item of normalizedItems) {
    const buildLine = (await prisma.buildline.findUnique({
      where: { id: item.buildLineId },
      include: { bomItem: { include: { subPart: true } } }
    }))!;

    if (buildLine.bomItem.consumable || buildLine.bomItem.subPart.consumable) {
      continue;
    }

    await upsertBuildItemAllocation(item.buildLineId, item.stockItemId, Number(item.quantity), item.outputId ?? null);
  }

  return { success: true };
}
```

---

#### 4. `unallocateBuildStock` (Lines 730–773)
```typescript
export interface UnallocateData {
  build_line?: number;
  output?: number;
  install_into?: number;
  items?: Array<number | { build_item?: number; id?: number; quantity?: number }>;
}

export async function unallocateBuildStock(buildId: number, data: UnallocateData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.COMPLETE || build.status === BuildStatus.CANCELLED) {
    throw new BuildError('Cannot unallocate stock from a completed or cancelled build', 400);
  }

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    for (const entry of data.items) {
      const itemId = typeof entry === 'number' ? entry : (entry.build_item ?? entry.id);
      if (!itemId) throw new BuildError('Build item ID required', 400);

      const bi = await prisma.builditem.findUnique({
        where: { id: itemId },
        include: { buildLine: true }
      });
      if (!bi) throw new BuildError('Build item not found', 400);
      if (bi.buildLine && bi.buildLine.buildId !== build.id) {
        throw new BuildError('Build item does not match parent build', 400);
      }

      if (typeof entry === 'object' && entry.quantity !== undefined) {
        const qty = Number(entry.quantity);
        if (isNaN(qty) || qty <= 0) throw new BuildError('Quantity must be greater than zero', 400);
        const allocQty = toNumber(bi.quantity);
        if (qty > allocQty) throw new BuildError('Quantity cannot be greater than the allocated quantity', 400);

        if (qty < allocQty) {
          await prisma.builditem.update({
            where: { id: bi.id },
            data: { quantity: allocQty - qty }
          });
        } else {
          await prisma.builditem.delete({ where: { id: bi.id } });
        }
      } else {
        await prisma.builditem.delete({ where: { id: bi.id } });
      }
    }
    return { success: true };
  }

  const targetOutput = data.output ?? data.install_into;
  if (targetOutput) {
    const outputItem = await prisma.stockitem.findUnique({ where: { id: targetOutput } });
    if (!outputItem || outputItem.buildId !== build.id) {
      throw new BuildError('Build output does not match the parent build', 400);
    }
  }

  if (data.build_line) {
    const buildLine = await prisma.buildline.findUnique({ where: { id: data.build_line } });
    if (!buildLine || buildLine.buildId !== build.id) {
      throw new BuildError('Build line does not match parent build', 400);
    }
  }

  const lines = await prisma.buildline.findMany({ where: { buildId: build.id }, select: { id: true } });
  const lineIds = lines.map(l => l.id);

  const filter: any = {};
  if (data.build_line) {
    filter.buildLineId = data.build_line;
  } else {
    filter.buildLineId = { in: lineIds };
  }

  if (targetOutput) {
    filter.installIntoId = targetOutput;
  }

  await prisma.builditem.deleteMany({ where: filter });

  return { success: true };
}
```

---

#### 5. `consumeBuildStock` (Lines 775–863)
```typescript
export interface ConsumeData {
  items?: Array<{
    build_item?: number;
    id?: number;
    quantity?: number;
  }>;
  lines?: Array<{
    build_line?: number;
    id?: number;
  }>;
  notes?: string;
}

export async function consumeBuildStock(buildId: number, data: ConsumeData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.PENDING) {
    throw new BuildError('Build order is not in production', 400);
  }
  if (build.status === BuildStatus.CANCELLED) {
    throw new BuildError('Build order is cancelled', 400);
  }
  if (build.status === BuildStatus.COMPLETE) {
    throw new BuildError('Build order is already completed', 400);
  }

  const hasItems = data.items && Array.isArray(data.items) && data.items.length > 0;
  const hasLines = data.lines && Array.isArray(data.lines) && data.lines.length > 0;

  const toConsume: Array<{ buildItemId: number; quantity: number }> = [];

  if (!hasItems && !hasLines) {
    // Consume ALL allocations for this build order
    const buildLines = await prisma.buildline.findMany({
      where: { buildId: build.id },
      select: { id: true }
    });
    const lineIds = buildLines.map(l => l.id);
    const allocations = await prisma.builditem.findMany({
      where: { buildLineId: { in: lineIds } }
    });

    if (allocations.length === 0) {
      return { success: true };
    }

    for (const alloc of allocations) {
      toConsume.push({ buildItemId: alloc.id, quantity: toNumber(alloc.quantity) });
    }
  } else {
    if (hasItems) {
      const seenItems = new Set<number>();
      for (const item of data.items!) {
        const itemId = item.build_item ?? item.id;
        if (!itemId) throw new BuildError('build_item is required', 400);
        if (seenItems.has(itemId)) {
          throw new BuildError('Duplicate build item in request', 400);
        }
        seenItems.add(itemId);

        const bi = await prisma.builditem.findUnique({
          where: { id: itemId },
          include: { buildLine: true }
        });
        if (!bi) throw new BuildError('Build item does not exist', 400);
        if (bi.buildLine && bi.buildLine.buildId !== build.id) {
          throw new BuildError('Build item does not match parent build', 400);
        }

        const qty = item.quantity !== undefined ? Number(item.quantity) : toNumber(bi.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new BuildError('Quantity must be greater than zero', 400);
        }
        if (qty > toNumber(bi.quantity)) {
          throw new BuildError('Quantity cannot be greater than the allocated quantity', 400);
        }
      }
    }

    if (hasLines) {
      const seenLines = new Set<number>();
      for (const line of data.lines!) {
        const lineId = line.build_line ?? line.id;
        if (!lineId) throw new BuildError('build_line is required', 400);
        if (seenLines.has(lineId)) {
          throw new BuildError('Duplicate build line in request', 400);
        }
        seenLines.add(lineId);

        const bl = await prisma.buildline.findUnique({ where: { id: lineId } });
        if (!bl) throw new BuildError('Build line does not exist', 400);
        if (bl.buildId !== build.id) {
          throw new BuildError('Build line does not match parent build', 400);
        }
      }
    }

    if (hasLines) {
      for (const line of data.lines!) {
        const lineId = (line.build_line ?? line.id)!;
        const allocs = await prisma.builditem.findMany({ where: { buildLineId: lineId } });
        for (const alloc of allocs) {
          toConsume.push({ buildItemId: alloc.id, quantity: toNumber(alloc.quantity) });
        }
      }
    }

    if (hasItems) {
      for (const item of data.items!) {
        const itemId = (item.build_item ?? item.id)!;
        const bi = (await prisma.builditem.findUnique({ where: { id: itemId } }))!;
        const qty = item.quantity !== undefined ? Number(item.quantity) : toNumber(bi.quantity);
        const existingIdx = toConsume.findIndex(c => c.buildItemId === itemId);
        if (existingIdx >= 0) {
          toConsume[existingIdx].quantity = qty;
        } else {
          toConsume.push({ buildItemId: itemId, quantity: qty });
        }
      }
    }
  }

  // Remainder of execution loop: split/delete stock, belongsToId, tracking, buildline.consumed increment
  // (Retain existing loop logic)
  return { success: true };
}
```

---

### B. Modifications to `src/backend/src/modules/build/build.routes.ts`

In `build.routes.ts`, ensure `body` parsing gracefully handles empty or malformed JSON:
```typescript
buildRouter.post('/api/build/:pk/scrap-outputs', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await scrapBuildOutputs(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/auto-allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoAllocateBuild(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await allocateStockToBuild(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/unallocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await unallocateBuildStock(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/consume', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await consumeBuildStock(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});
```

---

## 4. Verification & Testing Method

To independently verify the Build Order remediation:
1. Run Build unit tests:
   ```bash
   npx vitest run src/modules/build/build.service.test.ts
   ```
2. Run Tier 1 Build Feature tests:
   ```bash
   npx vitest run src/test/e2e/tier1_features/tier1_build_features.test.ts
   ```
3. Run Tier 2 Build Boundary tests:
   ```bash
   npx vitest run src/test/e2e/tier2_boundaries/tier2_build_boundaries.test.ts
   ```
4. Run Tier 3 Build Interactions and Cross-Subsystem tests:
   ```bash
   npx vitest run src/test/e2e/tier3_interactions/tier3_build_stock.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_cross_subsystem.test.ts
   ```
5. Run Tier 4 Real-World Manufacturing Scenario test:
   ```bash
   npx vitest run src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts
   ```
6. Verify 100% test pass rate across all 5 test files.
