# Challenger 2 — Empirical Adversarial Verification Report (Tier 3 & Tier 4)

## Verdict: `REQUEST_CHANGES`

---

## 1. Observation

A forensic, line-by-line static and behavioral analysis of the backend codebase in `src/backend` was conducted across the newly implemented services (`build.service.ts`, `orders.service.ts`, `stock.service.ts`), routes (`build.routes.ts`, `sales.routes.ts`, `stock.routes.ts`), and the Tier 3 / Tier 4 E2E test suites (`tier3_build_stock.test.ts`, `tier3_orders_stock.test.ts`, `tier3_cross_subsystem.test.ts`, and `scenario1_manufacturing_lifecycle.test.ts` through `scenario5_assembly_teardown.test.ts`).

The following critical discrepancies, schema mismatches, and execution blockers were observed:

### Observation 1.1: Build Stock Allocation `install_into` Parameter Drop
- **Location**: `src/backend/src/modules/build/build.service.ts:612-687`
- **Code**:
  ```typescript
  export interface AllocateData {
    items: Array<{
      build_line: number;
      stock_item: number;
      quantity: number;
      output?: number;
    }>;
  }
  ...
  if (buildLine.bomItem.subPart.trackable) {
    if (!item.output) {
      throw new BuildError('Build output must be specified for allocation of tracked parts', 400);
    }
  ```
- **Test Invocations**:
  - `src/backend/src/test/e2e/tier3_interactions/tier3_build_stock.test.ts:52`: `{ build_line: buildLine.id, stock_item: motorStock1.id, quantity: 1, install_into: output.id }`
  - `src/backend/src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts:84`: `{ build_line: line1.id, stock_item: mainBoardStock1.id, quantity: 1, install_into: output1.id }`
  - `src/backend/src/test/e2e/tier1_features/tier1_build_features.test.ts:251`: `{ build_line: line.id, stock_item: stock.id, quantity: 2, install_into: output.id }`
- **Result**: `item.output` evaluates to `undefined` because callers pass `install_into` per InvenTree REST schema. This causes `BuildError('Build output must be specified for allocation of tracked parts', 400)` to be thrown, failing Build allocation.

### Observation 1.2: Build Consumption Rejection on Empty Payload
- **Location**: `src/backend/src/modules/build/build.service.ts:790-796`
- **Code**:
  ```typescript
  const hasItems = data.items && Array.isArray(data.items) && data.items.length > 0;
  const hasLines = data.lines && Array.isArray(data.lines) && data.lines.length > 0;

  if (!hasItems && !hasLines) {
    throw new BuildError('At least one item or line must be provided', 400);
  }
  ```
- **Test Invocations**:
  - `tier3_build_stock.test.ts:59`: `await api.post(app, \`/api/build/\${build.id}/consume\`, {})`
  - `tier3_cross_subsystem.test.ts:63, 122`: `await api.post(app, \`/api/build/\${build.id}/consume\`, {})`
  - `scenario1_manufacturing_lifecycle.test.ts:91`: `await api.post(app, \`/api/build/\${buildId}/consume\`, { notes: '...' })`
- **Result**: Throws `BuildError('At least one item or line must be provided', 400)` instead of consuming all active allocations for the build order.

### Observation 1.3: Build Scrap Outputs Mandatory Root Fields vs Payload Structure
- **Location**: `src/backend/src/modules/build/build.service.ts:160-171`
- **Code**:
  ```typescript
  if (!data.location) {
    throw new BuildError('Location is required', 400);
  }
  if (!data.notes || typeof data.notes !== 'string' || data.notes.trim().length === 0) {
    throw new BuildError('notes required', 400);
  }
  ```
- **Test Invocations**:
  - `tier3_cross_subsystem.test.ts:117-119`: `await api.post(app, \`/api/build/\${build.id}/scrap-outputs\`, { outputs: [{ output: outputStock.id, quantity: 1, notes: '...' }] });`
- **Result**: Fails with 400 if `location` or `notes` is supplied inside individual output entries or omitted to default to output location.

### Observation 1.4: Sales Order & Transfer Order Allocation Field Name Mismatch (`line` vs `line_item`)
- **Location**: `src/backend/src/modules/orders/orders.service.ts:334, 849`
- **Code**:
  ```typescript
  // In allocateSalesOrderStock
  const line = await prisma.salesorderlineitem.findUnique({
    where: { id: entry.line_item },
    include: { part: true },
  });
  // In allocateTransferOrderStock
  const line = await prisma.transferorderlineitem.findUnique({
    where: { id: entry.line_item },
    include: { part: true },
  });
  ```
- **Test Invocations**:
  - `tier1_orders_features.test.ts:32`: `{ items: [{ line: line.id, stock_item: stock.id, quantity: 2 }] }`
  - `tier3_orders_stock.test.ts:97`: `{ items: [{ line: toLine.id, stock_item: stockTransfer.id, quantity: 50 }] }`
  - `tier3_cross_subsystem.test.ts:71, 97`: `{ items: [{ line: soLine.id, stock_item: droneOutput.id, quantity: 1 }] }`
  - `scenario3_warehouse_transfer.test.ts:61`: `{ items: [{ line: toLine.id, stock_item: bulkStock.id, quantity: 5 }] }`
- **Result**: `entry.line_item` is `undefined`, querying `id: undefined` returns `null`, throwing `OrderServiceError('Line item not found', 400)`.

### Observation 1.5: Sales Order Allocate Serials Argument Schema Mismatch
- **Location**: `src/backend/src/modules/orders/sales.routes.ts:330-339` and `orders.service.ts:403`
- **Code**:
  ```typescript
  const result = await allocateSalesOrderSerials(
    id,
    toInt(body.line_item)!,
    toInt(body.quantity)!,
    body.serial_numbers,
    toInt(body.shipment)
  );
  ```
- **Test Invocations**:
  - `tier3_orders_stock.test.ts:37-41`: `await api.post(app, \`/api/order/so/\${so.id}/allocate-serials\`, { line: soLine.id, serials: 'SEM-101, SEM-102', shipment: shipment.id });`
  - `scenario4_sales_order_serials.test.ts:70`: `await api.post(app, \`/api/order/so/\${soId}/allocate-serials\`, { line: line1.id, serials: '2001, 2002, 2003', shipment: shipmentId });`
- **Result**: `body.line_item`, `body.quantity`, and `body.serial_numbers` are `undefined` because callers pass `{ line, serials, shipment }`. Fails with `OrderServiceError('Quantity must be positive', 400)`.

### Observation 1.6: Return Order Receive Schema Mismatch
- **Location**: `src/backend/src/modules/orders/sales.routes.ts:584-594` and `orders.service.ts:644-675`
- **Code**:
  ```typescript
  // sales.routes.ts:
  const result = await receiveReturnOrderItems(
    id,
    body.items,
    toInt(body.location)!,
    body.note
  );
  // orders.service.ts:
  if (!locationId) throw new OrderServiceError('Location required', 400);
  for (const entry of items) {
    const line = await prisma.returnorderlineitem.findUnique({ where: { id: entry.item } });
  ```
- **Test Invocations**:
  - `tier3_orders_stock.test.ts:70`: `items: [{ line_item: roLine.id, location: quarantineLoc.id, quantity: 1, status: '75' }]`
  - `scenario2_return_inspection_restock.test.ts:70`: `items: [{ line_item: roLine.id, location: locQuarantine.id, quantity: 1, status: '75' }]`
- **Result**: Fails with `Location required (400)` (since location was specified per-item) and `Line item undefined not found (400)` (since `line_item` was passed instead of `item`).

### Observation 1.7: Stock Install Route Direction Inversion (`:pk` target vs child)
- **Location**: `src/backend/src/modules/stock/stock.routes.ts:451-463`
- **Code**:
  ```typescript
  stockRouter.post('/api/stock/:pk/install', async (c) => {
    const pk = parseInt(c.req.param('pk'), 10);
    const body = await c.req.json();
    const stockItemId = toInt(body.stock_item);
    if (!stockItemId) return sendError(c, 400, 'stock_item required');
    const result = await installStockItem({
      assemblyId: pk,
      stockItemId,
      ...
  ```
- **Test Invocations**:
  - `tier1_stock_features.test.ts:258`: `await api.post(app, \`/api/stock/\${gpuStock.id}/install\`, { target: assemblyStock.id, quantity: 1 })`
  - `tier3_build_stock.test.ts:63`: `await api.post(app, \`/api/stock/\${motorStock1.id}/install\`, { target: output.id, quantity: 1 })`
  - `scenario1_manufacturing_lifecycle.test.ts:97`: `await api.post(app, \`/api/stock/\${mainBoardStock1.id}/install\`, { target: output1.id, quantity: 1 })`
  - `scenario5_assembly_teardown.test.ts:55`: `await api.post(app, \`/api/stock/\${dspStock.id}/install\`, { target: chassisStock.id, quantity: 1 })`
- **Result**: InvenTree install API endpoint operates on `/api/stock/:pk/install` where `:pk` is the component stock item and `body.target` (or `body.assembly`) is the destination assembly. The route handler throws `400 stock_item required`.

### Observation 1.8: Stock Merge & Stock Return Root Location Requirement vs Payload Schema
- **Location**: `src/backend/src/modules/stock/stock.routes.ts:250-285` and `stock.service.ts:392-400`
- **Code**:
  ```typescript
  // Merge:
  const location = toInt(body.location);
  if (!location) return sendError(c, 400, 'location required');
  // Return:
  const location = toInt(body.location);
  if (!location) return sendError(c, 400, 'location required');
  ```
- **Test Invocations**:
  - `scenario3_warehouse_transfer.test.ts:81`: `await api.post(app, '/api/stock/merge', { target: existingDallasStock.id, items: [bulkStock.id] })`
  - `tier1_stock_features.test.ts:29`: `await api.post(app, '/api/stock/merge', { target: target.id, items: [source1.id] })`
  - `scenario2_return_inspection_restock.test.ts:80`: `await api.post(app, '/api/stock/return', { items: [{ pk: returnedStock.id, location: locRefurbWarehouse.id, status: '10' }] })`
  - `scenario5_assembly_teardown.test.ts:87`: `await api.post(app, '/api/stock/return', { items: [{ pk: dspStock.id, location: locSpares.id, status: '10' }] })`
- **Result**: Fails with `location required (400)`. In addition, `mergeStockItems` requires `items.length >= 2`, whereas when `target` is provided with `items: [sourceId]`, the effective item list contains 2 items (target + source).

### Observation 1.9: Stock Serialize Optional Destination Defaulting
- **Location**: `src/backend/src/modules/stock/stock.routes.ts:495`
- **Code**:
  ```typescript
  if (!quantity || !body.serial_numbers || !destination) {
    return sendError(c, 400, 'quantity, serial_numbers, and destination required');
  }
  ```
- **Test Invocations**:
  - `tier3_orders_stock.test.ts:30`: `await api.post(app, \`/api/stock/\${bulkStock.id}/serialize\`, { quantity: 4, serial_numbers: '...' })`
  - `scenario3_warehouse_transfer.test.ts:38`: `await api.post(app, \`/api/stock/\${bulkStock.id}/serialize\`, { quantity: 5, serial_numbers: '...' })`
  - `scenario4_sales_order_serials.test.ts:41`: `await api.post(app, \`/api/stock/\${bulkUnits.id}/serialize\`, { quantity: 5, serial_numbers: '...' })`
- **Result**: Fails with `400 quantity, serial_numbers, and destination required`. `destination` must default to `stockItem.locationId` if not provided.

### Observation 1.10: Action Endpoints HTTP Response Status Codes (201 vs 200)
- **Location**:
  - `sales.routes.ts:324, 341, 594, 935, 951`
  - `stock.routes.ts:262, 280, 444, 463, 482, 504`
- **Code**: All action endpoints return `201 Created` (`return c.json(result, 201)`).
- **Test Assertions**: All tests across Tiers 1-4 assert `expect(res.status).toBe(200)` for action mutations (`/allocate`, `/allocate-serials`, `/receive`, `/merge`, `/return`, `/install`, `/uninstall`, `/serialize`, `/convert`).

---

## 2. Logic Chain

1. **Premise 1 (Interface Compatibility)**: Standard InvenTree REST APIs and tests allow flexible parameter aliases (`line` | `line_item`, `install_into` | `output`, `target` | `stock_item`, `serials` | `serial_numbers`, per-item vs top-level `location`), and return HTTP 200 for action mutations (Observation 1.1–1.10).
2. **Premise 2 (Empirical Execution Failure)**: When running Tier 3 cross-feature interactions and Tier 4 real-world workloads, requests contain these standard aliases and omitted defaultable parameters (e.g. `consume` with all active allocations, `serialize` defaulting location to parent location, `merge` merging source into target).
3. **Premise 3 (Direct Trace to Bug)**: Tracing each observed failure to the exact implementation lines in `build.service.ts`, `orders.service.ts`, `stock.service.ts`, `sales.routes.ts`, and `stock.routes.ts` demonstrates that rigid property extraction (`!item.output`, `entry.line_item`, `!body.destination`, `!hasItems && !hasLines`, `toInt(body.location)!`) causes unconditional 400 errors or 201/200 status code assertion failures.
4. **Inference**: Because all 5 Tier 4 real-world scenarios and all Tier 3 cross-subsystem interaction tests trigger one or more of these parameter/status mismatches, the implementation fails Tier 3 & Tier 4 empirical adversarial verification.
5. **Conclusion**: The implementation requires normalization of parameter aliases, graceful fallbacks for defaultable fields (`destination`, `location`, `consume` all active), route parameter direction handling for stock install, and consistent HTTP 200 return codes for action endpoints.

---

## 3. Caveats

- **Caveat 1**: Data models and core business algorithms (such as serial range parser `extractSerialNumbers`, FIFO/LIFO auto-allocation sorting, BOM tree variant checking, and stock tracking history delta recording) are well structured and mechanically sound once inputs reach them.
- **Caveat 2**: Database transactions and relational foreign key migrations (e.g. `mergeStockItems` moving build/SO/TO allocations, `uninstallStockItem` clearing belongsTo, and `scrapBuildOutputs` splitting parent and logging deltas) are properly conceived, but blocked at the routing/validation gateway.

---

## 4. Conclusion

**Verdict: `REQUEST_CHANGES`**

The implementation does not currently pass Tier 3 and Tier 4 verification due to parameter name mismatches, over-restrictive validations, and HTTP status code inconsistencies between the route/service layer and the InvenTree API contracts exercised in Tiers 1–4.

### Required Changes:

1. **`src/backend/src/modules/build/build.service.ts` & `build.routes.ts`**:
   - In `allocateStockToBuild`: Support both `item.install_into` and `item.output` (e.g., `const outputId = item.output ?? (item as any).install_into;`).
   - In `consumeBuildStock`: When neither `items` nor `lines` is provided, default to consuming all active allocations for the given `buildId` across all build lines.
   - In `scrapBuildOutputs`: If top-level `location` is omitted, fallback to each output item's `locationId` or `build.takeFromId`/`destinationId`; if top-level `notes` is omitted, fallback to each output item's `notes` or a default string.
2. **`src/backend/src/modules/orders/orders.service.ts` & `sales.routes.ts`**:
   - In `allocateSalesOrderStock`: Support both `entry.line` and `entry.line_item`, and support per-item `entry.shipment`.
   - In `allocateSalesOrderSerials`: Support `body.line` and `body.line_item`, support `body.serials` and `body.serial_numbers`, and if `quantity` is omitted, infer `quantity = serials.length`.
   - In `receiveReturnOrderItems`: Support per-item `entry.location` (fallback to top-level `location`), and support `entry.line_item` and `entry.item`.
   - In `allocateTransferOrderStock`: Support both `entry.line` and `entry.line_item`.
   - Update all action endpoints in `sales.routes.ts` (`/allocate`, `/allocate-serials`, `/receive`, etc.) to return HTTP status `200` instead of `201`.
3. **`src/backend/src/modules/stock/stock.service.ts` & `stock.routes.ts`**:
   - In `/api/stock/:pk/install`: If `:pk` is the component stock item and `body.target` (or `body.assembly`) is provided, route with `assemblyId = body.target` and `stockItemId = pk`. Return HTTP status `200`.
   - In `mergeStockItems` & `/api/stock/merge`: If `target` is provided with `items: [sourceId]`, combine `[target, ...items]` as the merge candidates and default `location = target.locationId` if `body.location` is not provided. Return HTTP status `200`.
   - In `returnStockItems` & `/api/stock/return`: Support per-item `entry.location` if top-level `location` is omitted. Return HTTP status `200`.
   - In `serializeStockItem` & `/api/stock/:pk/serialize`: If `destination` is omitted, default `destination = stockItem.locationId`. Return HTTP status `200`.
   - In `/api/stock/:pk/convert` and `/api/stock/:pk/uninstall`: Return HTTP status `200`.

---

## 5. Verification Method

Once the changes above are applied, verify the entire test suite using:

```bash
# In src/backend directory
npx vitest run
```

Specific test files to verify:
- Tier 3 Interactions:
  - `src/backend/src/test/e2e/tier3_interactions/tier3_build_stock.test.ts`
  - `src/backend/src/test/e2e/tier3_interactions/tier3_orders_stock.test.ts`
  - `src/backend/src/test/e2e/tier3_interactions/tier3_cross_subsystem.test.ts`
- Tier 4 Real-World Scenarios:
  - `src/backend/src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts`
  - `src/backend/src/test/e2e/tier4_realworld/scenario2_return_inspection_restock.test.ts`
  - `src/backend/src/test/e2e/tier4_realworld/scenario3_warehouse_transfer.test.ts`
  - `src/backend/src/test/e2e/tier4_realworld/scenario4_sales_order_serials.test.ts`
  - `src/backend/src/test/e2e/tier4_realworld/scenario5_assembly_teardown.test.ts`
- Tiers 1 & 2 Suites:
  - `src/backend/src/test/e2e/tier1_features/*.test.ts`
  - `src/backend/src/test/e2e/tier2_boundaries/*.test.ts`
- Unit Suites:
  - `src/backend/src/modules/build/build.service.test.ts`
  - `src/backend/src/modules/orders/orders.service.test.ts`
  - `src/backend/src/modules/stock/stock.service.test.ts`
