# Remediation Blueprint: Sales, Return, and Transfer Order Operations (R2 / Milestone M2)

**Agent**: `explorer_m2_remediation` (Role: teamwork_preview_explorer)  
**Target Module**: `src/backend/src/modules/orders/` (`sales.routes.ts`, `orders.service.ts`, `purchase.routes.ts`)  
**Target Test Suites**: `src/backend/src/test/e2e/` (`tier1_orders_features.test.ts`, `tier2_orders_boundaries.test.ts`, `tier3_orders_stock.test.ts`, `tier3_cross_subsystem.test.ts`, `scenario2_return_inspection_restock.test.ts`, `scenario3_warehouse_transfer.test.ts`, `scenario4_sales_order_serials.test.ts`), `orders.service.test.ts`  
**Date**: 2026-08-19

---

## Executive Summary

A comprehensive, static relational contract trace was conducted across the 9 Order endpoints required by Requirement R2.
The underlying business logic implementation in `orders.service.ts` is genuine, robust, and correctly models the Python InvenTree relational logic (including multi-system allocation deduplication, serial range expansions, state transitions, and audit tracking history codes).

However, test execution failures against the E2E test suite (`src/backend/src/test/`) stem from **three primary integration discrepancies**:
1. **Payload Field Naming & Nesting Mismatches**: Route handlers and service methods strictly expect specific snake_case or legacy properties (`line_item`, `serial_numbers`, top-level `location`), whereas E2E tests provide alternate aliases (`line`, `serials`, per-item `location`, `destination`).
2. **Missing Auto-Derivation of Quantity for Serialized Allocations**: E2E test suites supply serial expressions without an explicit `quantity` field, causing `toInt(body.quantity)!` to evaluate to `NaN` and failing with a 400 error.
3. **HTTP Status Code Divergence (201 Created vs 200 OK)**: Resource action endpoints (`/allocate`, `/allocate-serials`, `/receive`, etc.) return `201 Created` in `sales.routes.ts`, whereas Vitest E2E test suites strictly assert `expect(res.status).toBe(200)`.

This blueprint provides an exact, line-by-line remediation plan and code diffs for all affected files.

---

## Detailed Endpoint Breakdown & Remediation Plan

### 1. Sales Order Allocate (`POST /api/order/so/:pk/allocate`)

- **Current Implementation**:
  - `sales.routes.ts:318-327`: Extracts `body.items` directly, calls `allocateSalesOrderStock(id, body.items, toInt(body.shipment))`, and returns `201`.
  - `orders.service.ts:334-335`: Looks up line item using `entry.line_item`.
- **Observed Failures**:
  - E2E tests (`tier1_orders_features.test.ts:32`, `tier2_orders_boundaries.test.ts:32`, `tier3_cross_subsystem.test.ts:71`) send `items: [{ line, stock_item, quantity }]` (using `line` instead of `line_item`).
  - E2E tests assert `expect(res.status).toBe(200)`.
  - Single allocation payloads without `items` array wrapper fail validation.
- **Required Remediation**:
  1. In `sales.routes.ts`:
     - Normalize payload: `const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);`
     - Change response code from `201` to `200`.
  2. In `orders.service.ts`:
     - Normalize line ID: `const lineId = toInt(entry.line_item ?? entry.line ?? entry.lineItemId);`
     - Normalize stock item ID: `const stockItemId = toInt(entry.stock_item ?? entry.item ?? entry.stockItemId ?? entry.stockItem);`
     - Normalize shipment ID: check per-item `entry.shipment ?? entry.shipmentId` or fallback to top-level `shipmentId`.
     - Check variant matching: `(stockItem.part as any)?.variantOf === line.partId || (stockItem.part as any)?.variantOfId === line.partId`.

---

### 2. Sales Order Allocate Serials (`POST /api/order/so/:pk/allocate-serials`)

- **Current Implementation**:
  - `sales.routes.ts:329-344`: Extracts `body.line_item`, `body.quantity`, `body.serial_numbers`, and returns `201`.
  - `orders.service.ts:387-430`: Calls `extractSerialNumbers(serialNumbers, qty)` requiring mandatory `qty`.
- **Observed Failures**:
  - E2E tests (`tier1_orders_features.test.ts:114`, `scenario4_sales_order_serials.test.ts:69`, `tier3_orders_stock.test.ts:37`) send `{ line, serials, shipment }` without a `quantity` parameter.
  - `body.line_item` is `undefined` (because payload uses `line`).
  - `body.serial_numbers` is `undefined` (because payload uses `serials`).
  - `body.quantity` is `undefined` -> `toInt(body.quantity)` is `NaN` -> throws 400.
  - E2E tests assert `expect(res.status).toBe(200)`.
- **Required Remediation**:
  1. In `sales.routes.ts`:
     - Extract `lineItemId`: `toInt(body.line_item ?? body.line ?? body.lineItemId)!`
     - Extract `serialNumbers`: `body.serial_numbers ?? body.serials ?? body.serial_list ?? body.serialNumbers`
     - Extract `quantity`: `toInt(body.quantity)` (optional / undefined if omitted)
     - Extract `shipmentId`: `toInt(body.shipment ?? body.shipmentId)`
     - Change response code from `201` to `200`.
  2. In `orders.service.ts`:
     - Update `extractSerialNumbers(inputString, expectedQuantity?)`: when `expectedQuantity` is omitted, dynamically parse and return all expanded serial numbers from ranges (`101-105`), counts (`100+3`), and comma lists (`SN-01, SN-02`).
     - In `allocateSalesOrderSerials`: derive `const qty = quantity ?? parsedSerials.length`.

---

### 3. Sales Order Auto-Allocate (`POST /api/order/so/:pk/auto-allocate`)

- **Current Implementation**:
  - `sales.routes.ts:346-363`: Reads `body.stock_sort_by`.
  - `orders.service.ts:535, 571`: Matches strict string `'updated'`, `'FIFO'`, `'LIFO'`, etc.
- **Observed Failures**:
  - E2E tests (`tier1_orders_features.test.ts:200, 215, 230`) send `strategy: 'FIFO'`, `strategy: 'LIFO'`, `strategy: 'EXPIRY'`.
  - `tier2_orders_boundaries.test.ts:181` sends `strategy: 'INVALID_STRATEGY'`.
- **Required Remediation**:
  1. In `sales.routes.ts`:
     - Normalize strategy: `const sortStrategy = body.stock_sort_by ?? body.strategy ?? body.sort_by ?? body.sort;`
     - Normalize location: `toInt(body.location ?? body.location_id)`
     - Normalize exclude_location: `toInt(body.exclude_location ?? body.exclude_location_id)`
     - Normalize lines: `body.line_items ?? body.lines ?? (body.line ? [body.line] : undefined)`
  2. In `orders.service.ts`:
     - Convert `sortMode` to uppercase for case-insensitive matching (`FIFO`, `LIFO`, `EXPIRY`, `EXPIRY_DATE`, `QUANTITY`).
     - Gracefully fallback to default `FIFO` if an unrecognized strategy is provided, preventing unhandled exceptions.

---

### 4. Return Order Hold (`POST /api/order/ro/:pk/hold`)

- **Current Implementation**:
  - `sales.routes.ts:574-582`: Calls `holdReturnOrder(id)` and returns `200`.
  - `orders.service.ts:629-642`: Sets `status = ROStatus.ON_HOLD` ('25').
- **Observed Failures**:
  - Idempotency check: If return order is already `ON_HOLD` ('25'), repeated hold request should return 200 cleanly.
  - Body handling: `tier2_orders_boundaries.test.ts:214` passes `null` body.
- **Required Remediation**:
  1. In `orders.service.ts:holdReturnOrder`:
     - Allow transitions from `PENDING` ('10'), `IN_PROGRESS` ('20'), and `ON_HOLD` ('25').
     - Reject with 400 only if already `COMPLETE` ('30') or `CANCELLED` ('40').

---

### 5. Return Order Receive (`POST /api/order/ro/:pk/receive`)

- **Current Implementation**:
  - `sales.routes.ts:584-598`: Expects top-level `body.location`, passes `body.items`, returns `201`.
  - `orders.service.ts:644-766`: Strictly checks `if (!locationId) throw new OrderServiceError('Location required', 400)`, and expects `entry.item`.
- **Observed Failures**:
  - E2E tests (`tier1_orders_features.test.ts:319`, `scenario2_return_inspection_restock.test.ts:69`, `tier3_orders_stock.test.ts:69`) pass `items: [{ line_item, location, quantity, status }]` with `location` nested inside each item of `items`. Top-level `body.location` is undefined.
  - Tests pass `line_item` instead of `item`.
  - Tests 10.2, 10.3, 10.4 omit `location` entirely; the stock item's current location should be used as fallback.
  - Tests pass `notes` inside the item object (`entry.notes`).
  - Tests assert `expect(res.status).toBe(200)`.
- **Required Remediation**:
  1. In `sales.routes.ts`:
     - Normalize items: `const items = Array.isArray(body.items) ? body.items : (body.line_item || body.item ? [body] : []);`
     - Extract top-level location: `toInt(body.location ?? body.location_id ?? body.destination)`
     - Change response status from `201` to `200`.
  2. In `orders.service.ts`:
     - Resolve line ID: `const lineId = toInt(entry.item ?? entry.line_item ?? entry.line ?? entry.id);`
     - Resolve destination location per item: `const targetLoc = toInt(entry.location ?? entry.location_id) || locationId || stockItem.locationId || 1;`
     - Resolve notes per item: `entry.notes ?? entry.note ?? note ?? 'Returned against Return Order'`
     - Check quantity validation: positive, <= line item quantity.
     - Update stock item status to `QUARANTINED` ('75') or specified status, set `customerId = null`, `salesOrderId = null`, log tracking code `80`, mark `receivedDate = new Date()`.

---

### 6. Transfer Order Issue (`POST /api/order/transfer-order/:pk/issue`)

- **Current Implementation**:
  - `sales.routes.ts:889-897`: Calls `issueTransferOrder(id)`, returns `200`.
  - `orders.service.ts:770-785`: Updates `status = TOStatus.ISSUED`.
- **Observed Failures**:
  - `tier1_orders_features.test.ts:393` explicitly tests that `issueDate` is stamped with the current timestamp upon issuing.
  - `orders.service.ts` was not setting `issueDate: new Date()`.
- **Required Remediation**:
  - In `orders.service.ts:issueTransferOrder`:
    ```typescript
    await prisma.transferorder.update({
      where: { id: toId },
      data: {
        status: TOStatus.ISSUED,
        issueDate: new Date(),
      },
    });
    ```

---

### 7. Transfer Order Cancel (`POST /api/order/transfer-order/:pk/cancel`)

- **Current Implementation**:
  - `sales.routes.ts:909-917`: Calls `cancelTransferOrder(id)`, returns `200`.
  - `orders.service.ts:802-822`: Deletes attached allocations and sets `status = CANCELLED`.
- **Observed Failures**:
  - `tier2_orders_boundaries.test.ts:310` tests idempotent cancellation of already cancelled transfer orders.
  - `orders.service.ts:807` currently throws if `order.status === TOStatus.CANCELLED`.
- **Required Remediation**:
  - In `orders.service.ts:cancelTransferOrder`:
    ```typescript
    if (order.status === TOStatus.CANCELLED || order.status === '40') {
      return { success: true };
    }
    ```

---

### 8. Transfer Order Complete (`POST /api/order/transfer-order/:pk/complete`)

- **Current Implementation**:
  - `sales.routes.ts:919-928`: Calls `completeTransferOrder(id, Boolean(body.accept_incomplete_allocation))`, returns `200`.
  - `orders.service.ts:993-1169`: Moves stock to `destinationId` or consumes if `consume = true`.
- **Observed Failures**:
  - `orders.service.ts:1017` threw `Order cannot be completed until a destination location is set` when `destinationId` was null. However, test 13.4 and 13.5 seed transfer orders without specifying destination location.
  - When completing without a `destinationId`, stock items should remain at their current location instead of throwing an error.
- **Required Remediation**:
  - In `orders.service.ts:completeTransferOrder`:
    - Remove hard requirement on `destinationId` if `consume === false`; fallback to keeping current stock item location or updating if `destinationId` is truthy.
    - Set `completeDate: new Date()` and `status = TOStatus.COMPLETE`.

---

### 9. Transfer Order Allocate (`POST /api/order/transfer-order/:pk/allocate`)

- **Current Implementation**:
  - `sales.routes.ts:930-939`: Calls `allocateTransferOrderStock(id, body.items)`, returns `201`.
  - `orders.service.ts:824-898`: Expects `entry.line_item`.
- **Observed Failures**:
  - E2E tests (`tier1_orders_features.test.ts:544, 589`, `tier3_orders_stock.test.ts:97`, `scenario3_warehouse_transfer.test.ts:61`) pass `items: [{ line, stock_item, quantity }]` (using `line` instead of `line_item`).
  - E2E tests assert `expect(res.status).toBe(200)`.
- **Required Remediation**:
  1. In `sales.routes.ts`:
     - Normalize items: `const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);`
     - Change response code from `201` to `200`.
  2. In `orders.service.ts`:
     - Normalize line ID: `const lineId = toInt(entry.line_item ?? entry.line ?? entry.lineItemId);`
     - Normalize stock item ID: `const stockItemId = toInt(entry.stock_item ?? entry.item ?? entry.stockItemId);`
     - Normalize quantity: `Number(entry.quantity ?? 1)`

---

## Line-by-Line Code Remediation Specification

### A. Modifications in `src/backend/src/modules/orders/sales.routes.ts`

```diff
--- a/src/backend/src/modules/orders/sales.routes.ts
+++ b/src/backend/src/modules/orders/sales.routes.ts
@@ -318,9 +318,10 @@ salesRouter.post('/api/order/so/:pk/hold', async (c) => {
 salesRouter.post('/api/order/so/:pk/allocate', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json();
-    const result = await allocateSalesOrderStock(id, body.items, toInt(body.shipment));
-    return c.json(result, 201);
+    const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);
+    const result = await allocateSalesOrderStock(id, items, toInt(body.shipment ?? body.shipmentId));
+    return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
   }
@@ -330,13 +331,14 @@ salesRouter.post('/api/order/so/:pk/allocate-serials', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json();
+    const lineItemId = toInt(body.line_item ?? body.line ?? body.lineItemId);
     const result = await allocateSalesOrderSerials(
       id,
-      toInt(body.line_item)!,
-      toInt(body.quantity)!,
-      body.serial_numbers,
-      toInt(body.shipment)
+      lineItemId!,
+      body.quantity !== undefined ? toInt(body.quantity) : undefined,
+      body.serial_numbers ?? body.serials ?? body.serial_list ?? body.serialNumbers,
+      toInt(body.shipment ?? body.shipmentId)
     );
-    return c.json(result, 201);
+    return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
   }
@@ -347,15 +349,16 @@ salesRouter.post('/api/order/so/:pk/auto-allocate', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json().catch(() => ({}));
+    const sortStrategy = body.stock_sort_by ?? body.strategy ?? body.sort_by ?? body.sort;
     const result = await autoAllocateSalesOrder(id, {
-      location: toInt(body.location),
-      exclude_location: toInt(body.exclude_location),
-      shipment: toInt(body.shipment),
-      interchangeable: body.interchangeable,
-      stock_sort_by: body.stock_sort_by,
+      location: toInt(body.location ?? body.location_id),
+      exclude_location: toInt(body.exclude_location ?? body.exclude_location_id),
+      shipment: toInt(body.shipment ?? body.shipment_id),
+      interchangeable: body.interchangeable !== undefined ? Boolean(body.interchangeable) : true,
+      stock_sort_by: sortStrategy ? String(sortStrategy) : undefined,
       serialized_stock: body.serialized_stock,
-      line_items: body.line_items,
+      line_items: Array.isArray(body.line_items) ? body.line_items.map(Number) : Array.isArray(body.lines) ? body.lines.map(Number) : body.line ? [Number(body.line)] : undefined,
     });
     return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
@@ -584,12 +587,13 @@ returnRouter.post('/api/order/ro/:pk/hold', async (c) => {
 returnRouter.post('/api/order/ro/:pk/receive', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json();
+    const items = Array.isArray(body.items) ? body.items : (body.line_item || body.item ? [body] : []);
     const result = await receiveReturnOrderItems(
       id,
-      body.items,
-      toInt(body.location)!,
-      body.note
+      items,
+      toInt(body.location ?? body.location_id ?? body.destination),
+      body.note ?? body.notes
     );
-    return c.json(result, 201);
+    return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
   }
@@ -930,9 +934,10 @@ transferRouter.post('/api/order/transfer-order/:pk/complete', async (c) => {
 transferRouter.post('/api/order/transfer-order/:pk/allocate', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json();
-    const result = await allocateTransferOrderStock(id, body.items);
-    return c.json(result, 201);
+    const items = Array.isArray(body.items) ? body.items : (body.line || body.line_item ? [body] : []);
+    const result = await allocateTransferOrderStock(id, items);
+    return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
   }
@@ -941,12 +946,13 @@ transferRouter.post('/api/order/transfer-order/:pk/allocate', async (c) => {
 transferRouter.post('/api/order/transfer-order/:pk/allocate-serials', async (c) => {
   const id = parseInt(c.req.param('pk'), 10);
   try {
     const body = await c.req.json();
+    const lineItemId = toInt(body.line_item ?? body.line ?? body.lineItemId);
     const result = await allocateTransferOrderSerials(
       id,
-      toInt(body.line_item)!,
-      toInt(body.quantity)!,
-      body.serial_numbers
+      lineItemId!,
+      body.quantity !== undefined ? toInt(body.quantity) : undefined,
+      body.serial_numbers ?? body.serials ?? body.serial_list
     );
-    return c.json(result, 201);
+    return c.json(result, 200);
   } catch (err: any) {
     return handleOrderError(c, err);
   }
```

---

### B. Modifications in `src/backend/src/modules/orders/orders.service.ts`

```diff
--- a/src/backend/src/modules/orders/orders.service.ts
+++ b/src/backend/src/modules/orders/orders.service.ts
@@ -109,10 +109,10 @@ export function incrementSerialNumber(serial: string | null | undefined): string {
 export function extractSerialNumbers(
   inputString: string | number | null | undefined,
-  expectedQuantity: number
+  expectedQuantity?: number
 ): string[] {
-  if (expectedQuantity <= 0) {
+  if (expectedQuantity !== undefined && expectedQuantity <= 0) {
     throw new OrderServiceError('Invalid quantity provided', 400);
   }
-  if (expectedQuantity > 1000) {
+  if (expectedQuantity !== undefined && expectedQuantity > 1000) {
     throw new OrderServiceError('Cannot serialize more than 1000 items at once', 400);
   }
@@ -143,7 +143,7 @@ export function extractSerialNumbers(
-  if (groups.length === expectedQuantity && !groups.some((g) => g.includes('-') || g.includes('+'))) {
+  if (expectedQuantity !== undefined && groups.length === expectedQuantity && !groups.some((g) => g.includes('-') || g.includes('+'))) {
     for (const g of groups) {
       addSerial(g);
     }
     if (errors.length > 0) throw new OrderServiceError(errors.join(', '), 400);
     return serials;
   }
@@ -151,7 +151,7 @@ export function extractSerialNumbers(
   for (const group of groups) {
-    const remaining = expectedQuantity - serials.length;
+    const remaining = expectedQuantity !== undefined ? expectedQuantity - serials.length : 1000;
     if (group.includes('-')) {
       const items = group.split('-');
       if (items.length === 2) {
@@ -172,7 +172,7 @@ export function extractSerialNumbers(
-        if (groupItems.length > remaining) {
+        if (expectedQuantity !== undefined && groupItems.length > remaining) {
           addError(`Group range ${group} exceeds allowed quantity (${expectedQuantity})`);
         } else if (groupItems.length > 0 && groupItems[0] === a && groupItems[groupItems.length - 1] === b) {
           for (const item of groupItems) addSerial(item);
@@ -188,7 +188,7 @@ export function extractSerialNumbers(
-      let sequenceCount = Math.max(0, expectedQuantity - serials.length);
+      let sequenceCount = expectedQuantity !== undefined ? Math.max(0, expectedQuantity - serials.length) : 1;
       if (items.length === 2 && items[1].trim() !== '') {
         const parsedCount = parseInt(items[1].trim(), 10);
         if (isNaN(parsedCount)) {
@@ -221,7 +221,7 @@ export function extractSerialNumbers(
-  if (serials.length !== expectedQuantity) {
+  if (expectedQuantity !== undefined && serials.length !== expectedQuantity) {
     throw new OrderServiceError(
       `Number of unique serial numbers (${serials.length}) must match quantity (${expectedQuantity})`,
       400
     );
   }
@@ -295,7 +295,7 @@ export async function checkOrderLocked(orderId: number, orderType: 'purchase' | 'sales' | 'return' | 'transfer') {
 export async function allocateSalesOrderStock(
   soId: number,
-  items: { line_item: number; stock_item: number; quantity: number }[],
+  items: any[],
   shipmentId?: number,
   userId?: number
 ) {
@@ -328,15 +328,29 @@ export async function allocateSalesOrderStock(
   for (const entry of items) {
-    const qty = Number(entry.quantity);
+    const lineId = Number(entry.line_item ?? entry.line ?? entry.lineItemId);
+    if (isNaN(lineId) || !lineId) {
+      throw new OrderServiceError('Line item required', 400);
+    }
+    const stockItemId = Number(entry.stock_item ?? entry.item ?? entry.stockItemId ?? entry.stockItem);
+    if (isNaN(stockItemId) || !stockItemId) {
+      throw new OrderServiceError('Stock item required', 400);
+    }
+    const qty = Number(entry.quantity !== undefined ? entry.quantity : 1);
     if (isNaN(qty) || qty <= 0) {
       throw new OrderServiceError('Quantity must be positive', 400);
     }
+    const itemShipmentId = entry.shipment ?? entry.shipmentId ? Number(entry.shipment ?? entry.shipmentId) : (shipmentId || null);
 
     const line = await prisma.salesorderlineitem.findUnique({
-      where: { id: entry.line_item },
+      where: { id: lineId },
       include: { part: true },
     });
     if (!line) {
       throw new OrderServiceError('Line item not found', 400);
     }
@@ -346,7 +360,7 @@ export async function allocateSalesOrderStock(
     const stockItem = await prisma.stockitem.findUnique({
-      where: { id: entry.stock_item },
+      where: { id: stockItemId },
       include: { part: true },
     });
     if (!stockItem) {
@@ -359,7 +373,7 @@ export async function allocateSalesOrderStock(
     const isDirectPart = stockItem.partId === line.partId;
-    const isVariant = (stockItem.part as any)?.variantOf === line.partId;
+    const isVariant = (stockItem.part as any)?.variantOf === line.partId || (stockItem.part as any)?.variantOfId === line.partId;
     if (!isDirectPart && !isVariant) {
       throw new OrderServiceError('Stock item part does not match line item part', 400);
     }
@@ -375,10 +389,10 @@ export async function allocateSalesOrderStock(
     const alloc = await prisma.salesorderallocation.create({
       data: {
-        lineId: entry.line_item,
-        itemId: entry.stock_item,
+        lineId: lineId,
+        itemId: stockItemId,
         quantity: qty,
-        shipmentId: shipmentId || null,
+        shipmentId: itemShipmentId,
       },
     });
     createdAllocations.push(alloc);
@@ -389,8 +403,8 @@ export async function allocateSalesOrderStock(
 export async function allocateSalesOrderSerials(
   soId: number,
   lineItemId: number,
-  quantity: number,
-  serialNumbers: string,
+  quantity?: number,
+  serialNumbers?: string,
   shipmentId?: number,
   userId?: number
 ) {
@@ -403,9 +417,11 @@ export async function allocateSalesOrderSerials(
-  const qty = parseInt(String(quantity), 10);
-  if (isNaN(qty) || qty <= 0) {
+  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) <= 0)) {
     throw new OrderServiceError('Quantity must be positive', 400);
   }
+  const parsedSerials = extractSerialNumbers(serialNumbers, quantity);
+  const qty = quantity !== undefined ? Number(quantity) : parsedSerials.length;
@@ -535,7 +551,7 @@ export async function autoAllocateSalesOrder(
-  const sortMode = options.stock_sort_by || 'updated';
+  const sortMode = (options.stock_sort_by || 'updated').toUpperCase();
@@ -571,15 +587,15 @@ export async function autoAllocateSalesOrder(
-    if (sortMode === 'updated' || sortMode === 'creationDate' || sortMode === 'FIFO') {
+    if (sortMode === 'FIFO' || sortMode === 'UPDATED' || sortMode === 'CREATIONDATE') {
       candidates.sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime() || a.id - b.id);
-    } else if (sortMode === '-updated' || sortMode === '-creationDate' || sortMode === 'LIFO') {
+    } else if (sortMode === 'LIFO' || sortMode === '-UPDATED' || sortMode === '-CREATIONDATE') {
       candidates.sort((a, b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime() || b.id - a.id);
-    } else if (sortMode === 'quantity') {
+    } else if (sortMode === 'QUANTITY') {
       candidates.sort((a, b) => Number(a.quantity) - Number(b.quantity));
-    } else if (sortMode === '-quantity') {
+    } else if (sortMode === '-QUANTITY') {
       candidates.sort((a, b) => Number(b.quantity) - Number(a.quantity));
-    } else if (sortMode === 'expiry_date' || sortMode === 'expiryDate') {
+    } else if (sortMode === 'EXPIRY' || sortMode === 'EXPIRY_DATE' || sortMode === 'EXPIRYDATE') {
       candidates.sort((a, b) => {
         if (!a.expiryDate) return 1;
         if (!b.expiryDate) return -1;
         return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
       });
+    } else {
+      candidates.sort((a, b) => new Date(a.creationDate || 0).getTime() - new Date(b.creationDate || 0).getTime() || a.id - b.id);
     }
@@ -634,6 +650,9 @@ export async function holdReturnOrder(roId: number) {
   if (ro.status === ROStatus.COMPLETE || ro.status === ROStatus.CANCELLED) {
     throw new OrderServiceError('Return Order cannot be placed on hold', 400);
   }
+  if (ro.status === ROStatus.ON_HOLD || ro.status === '25') {
+    return { success: true };
+  }
   await prisma.returnorder.update({
     where: { id: roId },
     data: { status: ROStatus.ON_HOLD },
@@ -645,8 +664,8 @@ export async function holdReturnOrder(roId: number) {
 export async function receiveReturnOrderItems(
   roId: number,
-  items: { item: number; status?: string | number }[],
-  locationId: number,
+  items: any[],
+  locationId?: number,
   note?: string,
   userId?: number
 ) {
@@ -658,9 +677,6 @@ export async function receiveReturnOrderItems(
   if (ro.status !== ROStatus.IN_PROGRESS) {
     throw new OrderServiceError('Items can only be received against orders which are in progress', 400);
   }
-  if (!locationId) {
-    throw new OrderServiceError('Location required', 400);
-  }
@@ -670,7 +686,8 @@ export async function receiveReturnOrderItems(
   for (const entry of items) {
-    const line = await prisma.returnorderlineitem.findUnique({
-      where: { id: entry.item },
+    const lineId = Number(entry.item ?? entry.line_item ?? entry.line ?? entry.id);
+    const line = await prisma.returnorderlineitem.findUnique({
+      where: { id: lineId },
       include: { item: true },
     });
     if (!line) {
-      throw new OrderServiceError(`Line item ${entry.item} not found`, 400);
+      throw new OrderServiceError(`Line item ${lineId} not found`, 400);
     }
@@ -688,7 +705,14 @@ export async function receiveReturnOrderItems(
     const targetStatus = entry.status ? String(entry.status) : StockStatus.QUARANTINED;
+    const targetLocationId = Number(entry.location ?? entry.location_id) || locationId || stockItem.locationId || 1;
+    const qtyToReceive = entry.quantity !== undefined ? Number(entry.quantity) : Number(line.quantity ?? 1);
+    if (isNaN(qtyToReceive) || qtyToReceive <= 0) {
+      throw new OrderServiceError('Quantity must be positive', 400);
+    }
+    if (qtyToReceive > Number(line.quantity ?? stockItem.quantity ?? 1)) {
+      throw new OrderServiceError('Received quantity cannot exceed line item quantity', 400);
+    }
     let targetStockItemId = stockItem.id;
 
-    if (!stockItem.serial && Number(line.quantity) < Number(stockItem.quantity)) {
+    if (!stockItem.serial && qtyToReceive < Number(stockItem.quantity)) {
       // Split untracked stock item
       const newStockItem = await prisma.stockitem.create({
         data: {
           partId: stockItem.partId,
           supplierPartId: stockItem.supplierPartId,
-          locationId: locationId,
-          quantity: line.quantity,
+          locationId: targetLocationId,
+          quantity: qtyToReceive,
           status: targetStatus,
           batch: stockItem.batch,
@@ -719,7 +743,7 @@ export async function receiveReturnOrderItems(
       await prisma.stockitem.update({
         where: { id: stockItem.id },
-        data: { quantity: { decrement: line.quantity } },
+        data: { quantity: { decrement: qtyToReceive } },
       });
@@ -732,7 +756,7 @@ export async function receiveReturnOrderItems(
       await prisma.stockitem.update({
         where: { id: stockItem.id },
         data: {
-          locationId: locationId,
+          locationId: targetLocationId,
           status: targetStatus,
           customerId: null,
           salesOrderId: null,
@@ -746,12 +770,12 @@ export async function receiveReturnOrderItems(
       data: {
         itemId: targetStockItemId,
         trackingType: StockHistoryCode.RETURNED_AGAINST_RETURN_ORDER,
         date: new Date(),
-        notes: note || 'Returned against Return Order',
+        notes: entry.notes ?? entry.note ?? note ?? 'Returned against Return Order',
         deltas: {
           status: Number(targetStatus),
           returnorder: roId,
-          location: locationId,
-          quantity: Number(line.quantity),
+          location: targetLocationId,
+          quantity: qtyToReceive,
           customer: stockItem.customerId ?? undefined,
         },
         userId: userId,
@@ -781,6 +805,7 @@ export async function issueTransferOrder(toId: number, userId?: number) {
     where: { id: toId },
     data: {
       status: TOStatus.ISSUED,
+      issueDate: new Date(),
     },
   });
   return { success: true };
@@ -806,6 +831,9 @@ export async function cancelTransferOrder(toId: number, userId?: number) {
   if (order.status === TOStatus.COMPLETE) {
     throw new OrderServiceError('Transfer Order is already closed', 400);
   }
+  if (order.status === TOStatus.CANCELLED || order.status === '40') {
+    return { success: true };
+  }
@@ -825,7 +853,7 @@ export async function cancelTransferOrder(toId: number, userId?: number) {
 export async function allocateTransferOrderStock(
   toId: number,
-  items: { line_item: number; stock_item: number; quantity: number }[],
+  items: any[],
   userId?: number
 ) {
@@ -844,14 +872,21 @@ export async function allocateTransferOrderStock(
   for (const entry of items) {
-    const qty = Number(entry.quantity);
+    const lineId = Number(entry.line_item ?? entry.line ?? entry.lineItemId);
+    if (isNaN(lineId) || !lineId) {
+      throw new OrderServiceError('Line item required', 400);
+    }
+    const stockItemId = Number(entry.stock_item ?? entry.item ?? entry.stockItemId);
+    if (isNaN(stockItemId) || !stockItemId) {
+      throw new OrderServiceError('Stock item required', 400);
+    }
+    const qty = Number(entry.quantity !== undefined ? entry.quantity : 1);
     if (isNaN(qty) || qty <= 0) {
       throw new OrderServiceError('Quantity must be positive', 400);
     }
 
     const line = await prisma.transferorderlineitem.findUnique({
-      where: { id: entry.line_item },
+      where: { id: lineId },
       include: { part: true },
     });
     if (!line) {
@@ -862,7 +897,7 @@ export async function allocateTransferOrderStock(
     const stockItem = await prisma.stockitem.findUnique({
-      where: { id: entry.stock_item },
+      where: { id: stockItemId },
       include: { part: true },
     });
@@ -873,7 +908,7 @@ export async function allocateTransferOrderStock(
     const isDirectPart = stockItem.partId === line.partId;
-    const isVariant = (stockItem.part as any)?.variantOf === line.partId;
+    const isVariant = (stockItem.part as any)?.variantOf === line.partId || (stockItem.part as any)?.variantOfId === line.partId;
     if (!isDirectPart && !isVariant) {
       throw new OrderServiceError('Stock item part does not match line item part', 400);
     }
@@ -889,8 +924,8 @@ export async function allocateTransferOrderStock(
     const alloc = await prisma.transferorderallocation.create({
       data: {
-        lineId: entry.line_item,
-        itemId: entry.stock_item,
+        lineId: lineId,
+        itemId: stockItemId,
         quantity: qty,
       },
     });
@@ -902,8 +937,8 @@ export async function allocateTransferOrderStock(
 export async function allocateTransferOrderSerials(
   toId: number,
   lineItemId: number,
-  quantity: number,
-  serialNumbers: string,
+  quantity?: number,
+  serialNumbers?: string,
   userId?: number
 ) {
@@ -915,9 +950,11 @@ export async function allocateTransferOrderSerials(
-  const qty = parseInt(String(quantity), 10);
-  if (isNaN(qty) || qty <= 0) {
+  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) <= 0)) {
     throw new OrderServiceError('Quantity must be positive', 400);
   }
+  const parsedSerials = extractSerialNumbers(serialNumbers, quantity);
+  const qty = quantity !== undefined ? Number(quantity) : parsedSerials.length;
@@ -1016,9 +1053,7 @@ export async function completeTransferOrder(
-  if (!order.consume && !order.destinationId) {
-    throw new OrderServiceError('Order cannot be completed until a destination location is set', 400);
-  }
+  const destinationLocationId = order.destinationId;
@@ -1072,7 +1107,7 @@ export async function completeTransferOrder(
         const splitItem = await prisma.stockitem.create({
           data: {
             partId: stockItem.partId,
             supplierPartId: stockItem.supplierPartId,
-            locationId: order.destinationId!,
+            locationId: destinationLocationId || stockItem.locationId,
             quantity: transferQty,
@@ -1136,7 +1171,9 @@ export async function completeTransferOrder(
       } else {
         // Full stock item move
-        await prisma.stockitem.update({
-          where: { id: stockItem.id },
-          data: { locationId: order.destinationId! },
-        });
+        if (destinationLocationId) {
+          await prisma.stockitem.update({
+            where: { id: stockItem.id },
+            data: { locationId: destinationLocationId },
+          });
+        }
```

---

## Verification Strategy

1. **Unit Test Verification (`src/modules/orders/orders.service.test.ts`)**:
   - Verify all 20 unit tests continue to pass with full mock assertions.
   - Specifically verify:
     - `incrementSerialNumber` (numeric & alphanumeric suffix)
     - `extractSerialNumbers` (comma-separated, range `-`, count `+`, and quantity-omitted cases)
     - `allocateSalesOrderStock`, `allocateSalesOrderSerials`, `autoAllocateSalesOrder`
     - `holdReturnOrder`, `receiveReturnOrderItems` (untracked split and full move)
     - `issueTransferOrder`, `cancelTransferOrder`, `allocateTransferOrderStock`, `completeTransferOrder` (split, move, consume)
2. **E2E Test Harness Verification (`src/test/e2e/`)**:
   - `tier1_orders_features.test.ts` (Features 6–14: 45 test cases)
   - `tier2_orders_boundaries.test.ts` (Features 6–14 boundaries: 45 test cases)
   - `tier3_orders_stock.test.ts` (Interactions 3.4, 3.5, 3.6: 3 multi-step lifecycle cases)
   - `tier3_cross_subsystem.test.ts` (Combinations 3.7, 3.8: 2 full pipeline cases)
   - `scenario2_return_inspection_restock.test.ts` (RMA workflow: 1 full lifecycle case)
   - `scenario3_warehouse_transfer.test.ts` (Transfer workflow: 1 full lifecycle case)
   - `scenario4_sales_order_serials.test.ts` (Sales & Serials workflow: 1 full lifecycle case)
3. **Outcome**:
   - Expected result: 100% of order-related unit and E2E test cases pass with 0 errors.
