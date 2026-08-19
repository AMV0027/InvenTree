# R2 Specification Report: Sales, Return, and Transfer Order Operations

**Investigator**: `survey_explorer_2` (role: `teamwork_preview_spec_miner`)  
**Scope**: R2 — Sales, Return, and Transfer Order Operations  
**Specification Source**:
- Authoritative Python Reference: `src/backend_backup/InvenTree/order/` (`api.py`, `serializers.py`, `models.py`, `status_codes.py`, `tasks.py`, `test_api.py`, `test_sales_order.py`) and `src/backend_backup/InvenTree/stock/` (`models.py`, `status_codes.py`)
- Target Implementation: `src/backend/src/modules/orders/sales.routes.ts`, `orders.service.ts`, `src/backend/prisma/schema.prisma`

---

## 1. Executive Summary

This report documents the precise operational behavior, payload schemas, validation rules, state transitions, atomic stock manipulations, and audit logging required to implement and verify **R2 (Sales, Return, and Transfer Order Operations)**.

The current TypeScript implementation in `src/backend/src/modules/orders/sales.routes.ts` contains empty stubs returning `c.json({ success: true })` for action endpoints, and contains status code enum values that diverge from the reference schema. This specification details the authoritative mechanics extracted from the reference implementation to guide the implementation and testing phases.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Sales Order | `POST /api/order/so/:pk/allocate` | Allocate stock items (or variants) to specific Sales Order line items, optionally assigning them to an unshipped shipment. | `{ items: [{ line_item: int, stock_item: int, quantity: decimal }], shipment?: int }` | `201 Created` with allocation records or `{ success: true }` | `400 Bad Request` if line item does not belong to SO, quantity > unallocated stock, serialized item qty != 1, shipment already shipped, or tests not passed. `404` if SO not found. | `order/api.py`, `order/serializers.py` |
| 2 | Sales Order | `POST /api/order/so/:pk/allocate-serials` | Bulk-allocate serialized stock items to a single line item using range or comma-separated serial expressions. | `{ line_item: int, quantity: int, serial_numbers: string, shipment?: int }` | `201 Created` with allocation records or `{ success: true }` | `400 Bad Request` if serial count != quantity, any serial not found, serial already allocated, or shipment shipped. `404` if SO not found. | `order/api.py`, `order/serializers.py`, `test_api.py` |
| 3 | Sales Order | `POST /api/order/so/:pk/auto-allocate` | Automatically find, sort, and greedily allocate available stock items across unallocated lines in a Sales Order. | `{ location?: int, exclude_location?: int, shipment?: int, interchangeable?: bool, stock_sort_by?: string, serialized_stock?: string, line_items?: int[] }` | `200 OK` with task/allocation summary `{ complete: true, success: true }` | `400 Bad Request` if invalid sort field, invalid serialized_stock filter, foreign line items, or shipped shipment. `404` if SO not found. | `order/api.py`, `order/models.py`, `test_api.py` |
| 4 | Return Order | `POST /api/order/ro/:pk/hold` | Place a pending or in-progress Return Order on hold. | `{}` (empty payload) | `200 OK` with `{ success: true }` | `400 Bad Request` if order is complete or cancelled. `404` if RO not found. | `order/api.py`, `order/serializers.py` |
| 5 | Return Order | `POST /api/order/ro/:pk/receive` | Receive physical stock items against Return Order line items into a stock location, resetting customer ownership, splitting untracked items if needed, and setting stock status. | `{ items: [{ item: int, status?: string\|int }], location: int, note?: string }` | `201 Created` / `200 OK` with `{ success: true }` | `400 Bad Request` if order not in progress (status != 20), location missing/invalid, items empty, line item does not belong to RO, or line already received. `404` if RO not found. | `order/api.py`, `order/models.py`, `test_api.py` |
| 6 | Transfer Order | `POST /api/order/transfer-order/:pk/issue` | Move a Transfer Order from PENDING or ON_HOLD to ISSUED status to enable fulfillment. | `{}` (empty payload) | `200 OK` / `201 Created` with `{ success: true }` | `400 Bad Request` if order is already ISSUED, COMPLETE, or CANCELLED. `404` if TO not found. | `order/api.py`, `order/models.py`, `test_api.py` |
| 7 | Transfer Order | `POST /api/order/transfer-order/:pk/cancel` | Cancel an open Transfer Order, automatically removing all pending stock allocations. | `{}` (empty payload) | `200 OK` / `201 Created` with `{ success: true }` | `400 Bad Request` if order is already COMPLETE or CANCELLED. `404` if TO not found. | `order/api.py`, `order/models.py`, `test_api.py` |
| 8 | Transfer Order | `POST /api/order/transfer-order/:pk/complete` | Complete an ISSUED Transfer Order: move or split allocated stock to destination location, or consume stock if `consume=true`, and update line transferred totals. | `{ accept_incomplete_allocation?: bool }` | `200 OK` / `201 Created` with `{ success: true }` | `400 Bad Request` if order status != ISSUED (20), destination location not set (and consume=false), or order not fully allocated (when accept_incomplete_allocation=false). `404` if TO not found. | `order/api.py`, `order/models.py`, `test_api.py` |
| 9 | Transfer Order | `POST /api/order/transfer-order/:pk/allocate` | Allocate available stock items to Transfer Order line items. | `{ items: [{ line_item: int, stock_item: int, quantity: decimal }] }` | `201 Created` with allocation records or `{ success: true }` | `400 Bad Request` if line item does not belong to TO, quantity > available unallocated stock, serialized item qty != 1, or order is closed. `404` if TO not found. | `order/api.py`, `order/serializers.py`, `test_api.py` |
| 10 | Transfer Order | `POST /api/order/transfer-order/:pk/allocate-serials` | Bulk-allocate serialized stock items to Transfer Order lines using serial expressions. | `{ line_item: int, quantity: int, serial_numbers: string }` | `201 Created` with allocation records or `{ success: true }` | `400 Bad Request` if serial count != quantity, serial not found, serial already allocated. `404` if TO not found. | `order/api.py`, `test_api.py` |
| 11 | Transfer Order | `POST /api/order/transfer-order/:pk/hold` | Place an open Transfer Order on hold. | `{}` | `200 OK` with `{ success: true }` | `400 Bad Request` if order is COMPLETE or CANCELLED. `404` if TO not found. | `order/api.py`, `test_api.py` |

---

## 3. Edge Cases & Concurrency

| # | Feature | Input / Scenario | Observed Behavior |
|---|---------|------------------|-------------------|
| 1 | `so/:pk/allocate` | Allocate variant part stock item to template part SO line item | **Allowed**: Variant of the requested part is permitted if salable and in-stock. |
| 2 | `so/:pk/allocate` | Allocate serialized stock item with `quantity: 2` | **Rejected (400)**: Serialized items must strictly be allocated with `quantity: 1`. |
| 3 | `so/:pk/allocate` | Allocate to a shipment whose `shipment_date` is already set | **Rejected (400)**: Allocations cannot be attached to completed/shipped shipments. |
| 4 | `so/:pk/allocate-serials` | Input `serial_numbers: "1-5"`, `quantity: 3` | **Rejected (400)**: Range expands to 5 serials, which mismatches expected quantity of 3. |
| 5 | `so/:pk/allocate-serials` | Concurrent requests allocating the same serial | **Serialized via row-lock (`select_for_update`)**: First request locks and acquires; second request re-checks unallocated qty under lock, sees 0 available, and returns 400. |
| 6 | `so/:pk/auto-allocate` | `interchangeable: false` with requirement `qty: 50` and lots `[20, 20, 20]` | **Skipped line without error**: When not interchangeable, only items that can fulfill the entire requirement in a single lot are selected. |
| 7 | `so/:pk/auto-allocate` | `serialized_stock: "serialized"` | **Filtered**: Ignores bulk stock, allocates only serialized (`quantity: 1`, `serial != null`) stock items. |
| 8 | `ro/:pk/receive` | Untracked stock item with `quantity: 10`, returning line `quantity: 4` | **Automatic Stock Split**: Splits 4 into a new `StockItem` assigned to destination location; remaining 6 stays with customer. |
| 9 | `ro/:pk/receive` | Double receive attempt on already received line item | **No-Op / 400**: Line item is locked and checked (`received_date != null`); duplicate receipt is prevented. |
| 10 | `transfer-order/:pk/complete` | Stock item allocated quantity (10) reduced to 6 before completion | **Partial Transfer Graceful Handling**: Locks stock item, transfers available 6 units (`transferred += 6`), leaves remaining unfulfilled. |
| 11 | `transfer-order/:pk/complete` | `to.consume: true` | **Stock Depletion**: Reduces stock quantity on source item; logs `StockHistoryCode.STOCK_REMOVE (12)` tracking with `transferorder: to.id`; does NOT move to destination location. |
| 12 | `transfer-order/:pk/cancel` | Cancel order with existing active allocations | **Atomic Cleanup**: Deletes all `TransferOrderAllocation` rows belonging to this order's lines before setting status to `CANCELLED (40)`. |

---

## 4. State Machines and Enumerations

### A. Sales Order Status (`SalesOrderStatus`)
- `10` = `PENDING` (Initial state)
- `15` = `IN_PROGRESS` (Issued; stock can be allocated & packed)
- `20` = `SHIPPED` (All shipments dispatched)
- `25` = `ON_HOLD` (Paused)
- `30` = `COMPLETE` (Delivered / Finalized)
- `40` = `CANCELLED` (Terminated)
- `50` = `LOST`
- `60` = `RETURNED`
- **Open Status Group**: `[10, 15, 20, 25]`

> **Discrepancy Note**: The current TypeScript backend in `src/backend/src/modules/orders/sales.routes.ts` defined `IN_PROGRESS = 20`, `SHIPPED = 30`, `COMPLETE = 40`, `CANCELLED = 50`. The authoritative Python values are `10` (PENDING), `15` (IN_PROGRESS), `20` (SHIPPED), `25` (ON_HOLD), `30` (COMPLETE), `40` (CANCELLED).

### B. Return Order Status (`ReturnOrderStatus`)
- `10` = `PENDING`
- `20` = `IN_PROGRESS` (Issued; items can be physically received)
- `25` = `ON_HOLD`
- `30` = `COMPLETE`
- `40` = `CANCELLED`
- **Open Status Group**: `[10, 20, 25]`

### C. Return Order Line Outcome (`ReturnOrderLineStatus`)
- `10` = `PENDING`
- `20` = `RETURN`
- `30` = `REPAIR`
- `40` = `REPLACE`
- `50` = `REFUND`
- `60` = `REJECT`

### D. Transfer Order Status (`TransferOrderStatus`)
- `10` = `PENDING`
- `20` = `ISSUED` (Allocations allowed, ready to transfer)
- `25` = `ON_HOLD`
- `30` = `COMPLETE` (Transferred / Consumed)
- `40` = `CANCELLED`
- **Open Status Group**: `[10, 20, 25]`

### E. Stock Status (`StockStatus`)
- `10` = `OK`
- `50` = `ATTENTION`
- `55` = `DAMAGED`
- `60` = `DESTROYED`
- `65` = `REJECTED`
- `70` = `LOST`
- `75` = `QUARANTINED` (Default status when stock is received on Return Order)
- `85` = `RETURNED`
- **Available / In-Stock Status Codes**: `[10, 50, 55, 85]`

### F. Stock History Tracking Codes (`StockHistoryCode`)
- `1` = `CREATED`
- `5` = `EDITED`
- `10` = `STOCK_COUNT`
- `11` = `STOCK_ADD`
- `12` = `STOCK_REMOVE`
- `20` = `STOCK_MOVE` (Location change)
- `25` = `STOCK_UPDATE` (Same location property change)
- `40` = `SPLIT_FROM_PARENT`
- `42` = `SPLIT_CHILD_ITEM`
- `60` = `SHIPPED_AGAINST_SALES_ORDER`
- `70` = `RECEIVED_AGAINST_PURCHASE_ORDER`
- `80` = `RETURNED_AGAINST_RETURN_ORDER`

---

## 5. Detailed Endpoint Specifications

### 1. `POST /api/order/so/:pk/allocate`

#### Purpose
Allocates specific physical `StockItem` inventory against `SalesOrderLineItem` rows of a Sales Order.

#### Request Headers & Path
- `POST /api/order/so/:pk/allocate`
- Content-Type: `application/json`

#### Request Payload Schema
```typescript
interface SalesOrderAllocatePayload {
  items: {
    line_item: number;   // SalesOrderLineItem PK (required)
    stock_item: number;  // StockItem PK (required)
    quantity: number;    // Quantity to allocate (required, > 0)
  }[];
  shipment?: number;     // Optional SalesOrderShipment PK
}
```

#### Validation Rules
1. **Sales Order Existence & Status**: Order `:pk` must exist. Order must not be `COMPLETE (30)` or `CANCELLED (40)`.
2. **Items Array**: Must be a non-empty array (`items.length > 0`). If empty, return `400 Bad Request` with `{ items: "This field is required" }` or `{ error: "Allocation items must be provided" }`.
3. **Shipment Validation**:
   - If `shipment` is provided, must exist in DB.
   - `shipment.orderId` must equal `so.id` (error: `"Shipment is not associated with this order"`).
   - `shipment.shipmentDate` must be null (error: `"Shipment has already been shipped"`).
4. **Line Item Validation**:
   - For each item, `line_item` must exist and `line_item.orderId === so.id` (error: `"Line item is not associated with this order"`).
5. **Stock Item Validation**:
   - `stock_item` must exist.
   - `stock_item.in_stock` must be true (quantity > 0, belongsTo=null, customer=null, consumedBy=null, isBuilding=false, status in available codes `[10, 50, 55, 85]`).
   - Part compatibility: `stock_item.partId === line_item.partId` OR `stock_item.part` is a descendant variant of `line_item.part` (where `line_item.part.isTemplate === true` and `variantOf === line_item.partId`).
   - Serial constraint: If `stock_item.serial` is set and `stock_item.quantity === 1`, allocation `quantity` MUST equal `1` (error: `"Quantity must be 1 for serialized stock item"`).
   - Quantity bounds: `quantity > 0`.
   - Available capacity check:
     $$\text{Unallocated} = \text{stock\_item.quantity} - \sum(\text{build\_allocations}) - \sum(\text{so\_allocations}) - \sum(\text{to\_allocations})$$
     If $\text{quantity} > \text{Unallocated}$, return `400 Bad Request` with `"Available quantity exceeded"`.

#### Execution & Database Mutations (Prisma Transaction)
1. Lock stock item rows (`FOR UPDATE`).
2. Insert rows into `Salesorderallocation` table:
   ```typescript
   await prisma.salesorderallocation.create({
     data: {
       lineId: item.line_item,
       itemId: item.stock_item,
       quantity: item.quantity,
       shipmentId: payload.shipment ?? null,
     }
   });
   ```
3. Return `201 Created`.

---

### 2. `POST /api/order/so/:pk/allocate-serials`

#### Purpose
Convenience endpoint to allocate multiple serialized units to a single Sales Order line item by parsing comma-delimited strings, ranges, or plus-notations.

#### Request Payload Schema
```typescript
interface SalesOrderSerialAllocatePayload {
  line_item: number;          // SalesOrderLineItem PK (required)
  quantity: number;           // Quantity to allocate (integer, >= 1)
  serial_numbers: string;     // Serial expression e.g. "1,2,3" or "101-105" or "100+5"
  shipment?: number;          // Optional SalesOrderShipment PK
}
```

#### Serial Parsing Rules (`extract_serial_numbers`)
1. **Range (`-`)**: `"1-3"` $\rightarrow$ `["1", "2", "3"]`.
2. **Comma / Whitespace**: `"101, 102, 103"` or `"101 102 103"` $\rightarrow$ `["101", "102", "103"]`.
3. **Plus (`+`)**: `"100+3"` $\rightarrow$ `["100", "101", "102"]`.
4. Validate that `unique_serials.length === quantity`. If not, return `400 Bad Request` (`"Number of unique serial numbers ({n}) must match quantity ({q})"`).

#### Validation Rules
1. `line_item` must belong to Sales Order `:pk`.
2. `shipment` (if provided) must belong to Sales Order and have `shipmentDate === null`.
3. For each serial in parsed list:
   - Must find a matching `StockItem` where `partId === line_item.partId` (or variant) AND `serial === s` AND `quantity === 1`.
   - If any serial is missing in DB: return `400 Bad Request` with `"No match found for the following serial numbers: ..."`.
   - If any stock item is already allocated or not in stock: return `400 Bad Request` with `"The following serial numbers are unavailable: ..."`.

#### Execution & Database Mutations (Prisma Transaction)
1. For each resolved `StockItem`:
   ```typescript
   await prisma.salesorderallocation.create({
     data: {
       lineId: payload.line_item,
       itemId: stockItem.id,
       quantity: 1,
       shipmentId: payload.shipment ?? null,
     }
   });
   ```
2. Return `201 Created`.

---

### 3. `POST /api/order/so/:pk/auto-allocate`

#### Purpose
Automates warehouse stock picking by searching all available stock in the inventory matching unallocated line items, sorting them by a chosen heuristic, and allocating up to line item quantities.

#### Request Payload Schema
```typescript
interface SalesOrderAutoAllocatePayload {
  location?: number;           // Filter stock located within StockLocation subtree
  exclude_location?: number;   // Exclude stock located within StockLocation subtree
  shipment?: number;           // Assign all created allocations to this shipment
  interchangeable?: boolean;   // Default: true. If false, only allocate if single lot satisfies line
  stock_sort_by?: string;      // Choices: 'updated' (FIFO), '-updated' (LIFO), 'quantity' (asc), '-quantity' (desc), 'expiry_date' (soonest first)
  serialized_stock?: string;   // Choices: 'all' (default), 'serialized', 'unserialized'
  line_items?: number[];       // Optional subset of SalesOrderLineItem PKs to allocate
}
```

#### Algorithm Steps
1. Find all line items for Sales Order `:pk`:
   - If `payload.line_items` provided: filter by IDs and ensure all IDs belong to this order.
   - Ignore line items where `part.virtual === true`.
2. For each line item:
   - Compute `needed = line.quantity - line.allocated_quantity`.
   - If `needed <= 0`, continue to next line.
   - Fetch candidate `StockItem` records:
     - `partId === line.partId` (and optionally compatible variants).
     - Filter `in_stock = true`.
     - Location filter: `locationId IN subtree(location)` (if specified).
     - Exclude location: `locationId NOT IN subtree(exclude_location)` (if specified).
     - Serialized stock filter:
       - If `serialized`: `serial IS NOT NULL AND serial != '' AND quantity == 1`.
       - If `unserialized`: `serial IS NULL OR serial == ''`.
     - Order results by `stock_sort_by`:
       - `'updated'`: `creationDate ASC` (FIFO).
       - `'-updated'`: `creationDate DESC` (LIFO).
       - `'quantity'`: `quantity ASC`.
       - `'-quantity'`: `quantity DESC`.
       - `'expiry_date'`: `expiryDate ASC NULLS LAST`.
   - If `interchangeable === false`:
     - Check if any candidate has `unallocated_quantity >= needed`. If not, skip this line item entirely.
   - Iterate through candidate stock items:
     - `available = candidate.unallocated_quantity`.
     - If `available <= 0`, skip candidate.
     - `alloc_qty = Math.min(needed, available)`.
     - Create `Salesorderallocation` record: `{ lineId: line.id, itemId: candidate.id, quantity: alloc_qty, shipmentId: payload.shipment ?? null }`.
     - `needed -= alloc_qty`.
     - If `needed <= 0`, break candidate loop.
3. Return `200 OK` with `{ complete: true, success: true, task_id: null }`.

---

### 4. `POST /api/order/ro/:pk/hold`

#### Purpose
Transitions a Return Order to the `ON_HOLD` state.

#### Validation & Logic
1. Return Order `:pk` must exist.
2. Return Order status must be `PENDING (10)` or `IN_PROGRESS (20)`. If status is `COMPLETE (30)` or `CANCELLED (40)`, return `400 Bad Request` (`"Return Order cannot be placed on hold"`).
3. Update `returnorder.status = '25'`.
4. Return `200 OK` with `{ success: true }`.

---

### 5. `POST /api/order/ro/:pk/receive`

#### Purpose
Physically receives returned items from a customer against Return Order lines, places them into a warehouse location, resets customer associations, logs tracking records, and updates line item received dates.

#### Request Payload Schema
```typescript
interface ReturnOrderReceivePayload {
  items: {
    item: number;              // ReturnOrderLineItem PK (required)
    status?: string | number;  // StockStatus to assign (optional, default: 75 = QUARANTINED)
  }[];
  location: number;            // StockLocation PK where goods are placed (required)
  note?: string;               // Optional receiving note
}
```

#### Validation Rules
1. Return Order `:pk` must exist.
2. Return Order status MUST be `IN_PROGRESS (20)`. If not: return `400 Bad Request` (`"Items can only be received against orders which are in progress"`).
3. `location` is required and must exist in `StockLocation`.
4. `items` array must not be empty.
5. For each item:
   - `item` is `ReturnOrderLineItem` PK and must belong to this Return Order.
   - Line item must not have already been received (`line.receivedDate === null`).

#### Execution & Stock Mutations (Prisma Transaction)
For each line item:
1. Load `StockItem` associated with `line.itemId`.
2. **Untracked Stock Item Splitting**:
   - If `stock_item.serial === null` and `line.quantity < stock_item.quantity`:
     - Create a split `StockItem` record:
       ```typescript
       const newStockItem = await prisma.stockitem.create({
         data: {
           ...stock_item,
           id: undefined,
           quantity: line.quantity,
           locationId: payload.location,
           parentId: stock_item.id,
           status: item.status ? String(item.status) : '75', // QUARANTINED
           customerId: null,
           salesOrderId: null,
         }
       });
       // Decrement original stock item
       await prisma.stockitem.update({
         where: { id: stock_item.id },
         data: { quantity: stock_item.quantity - line.quantity }
       });
       // Point line item to split item
       await prisma.returnorderlineitem.update({
         where: { id: line.id },
         data: { itemId: newStockItem.id }
       });
       ```
3. **Full / Serialized Stock Item Update**:
   - If not split (entire item or serialized item):
     ```typescript
     await prisma.stockitem.update({
       where: { id: stock_item.id },
       data: {
         locationId: payload.location,
         status: item.status ? String(item.status) : '75', // QUARANTINED
         customerId: null,
         salesOrderId: null,
       }
     });
     ```
4. **Audit History & Tracking Entry**:
   - Create `Stockitemtracking` row:
     ```typescript
     await prisma.stockitemtracking.create({
       data: {
         itemId: targetStockItemId,
         trackingType: 80, // StockHistoryCode.RETURNED_AGAINST_RETURN_ORDER
         date: new Date(),
         notes: payload.note || 'Returned against Return Order',
         deltas: {
           status: item.status ? Number(item.status) : 75,
           returnorder: ro.id,
           location: payload.location,
           quantity: Number(line.quantity),
           customer: stock_item.customerId,
         },
         userId: user?.id,
       }
     });
     ```
5. **Mark Line Received**:
   ```typescript
   await prisma.returnorderlineitem.update({
     where: { id: line.id },
     data: { receivedDate: new Date() }
   });
   ```
6. Return `201 Created` with `{ success: true }`.

---

### 6. `POST /api/order/transfer-order/:pk/issue`

#### Purpose
Transitions a Transfer Order from `PENDING (10)` or `ON_HOLD (25)` to `ISSUED (20)`, recording the issue date.

#### Validation & Logic
1. Transfer Order `:pk` must exist.
2. Transfer Order status must be `PENDING (10)` or `ON_HOLD (25)`.
3. Update `transferorder.status = '20'` and `transferorder.issueDate = new Date()`.
4. Return `200 OK` (or `201 Created`) with `{ success: true }`.

---

### 7. `POST /api/order/transfer-order/:pk/cancel`

#### Purpose
Cancels an open Transfer Order and removes all allocated stock records.

#### Validation & Logic (Prisma Transaction)
1. Transfer Order `:pk` must exist.
2. Transfer Order status must be in `[10, 20, 25]` (PENDING, ISSUED, ON_HOLD). Cannot cancel if `COMPLETE (30)` or `CANCELLED (40)`.
3. Delete all `Transferorderallocation` rows attached to this order's lines:
   ```typescript
   await prisma.transferorderallocation.deleteMany({
     where: { line: { orderId: to.id } }
   });
   ```
4. Update `transferorder.status = '40'`.
5. Return `200 OK` (or `201 Created`) with `{ success: true }`.

---

### 8. `POST /api/order/transfer-order/:pk/complete`

#### Purpose
Fulfills an ISSUED Transfer Order: performs physical stock transfers (or stock consumption) and updates line item `transferred` quantities.

#### Request Payload Schema
```typescript
interface TransferOrderCompletePayload {
  accept_incomplete_allocation?: boolean; // Default: false
}
```

#### Validation Rules
1. Transfer Order `:pk` must exist.
2. Transfer Order status MUST be `ISSUED (20)`. If not: return `400 Bad Request` (`"Transfer Order must be in ISSUED state to complete"`).
3. If `to.consume === false`, `to.destinationId` MUST not be null (error: `"Order cannot be completed until a destination location is set"`).
4. Allocation Completeness:
   - Compute if all lines are fully allocated (`line.allocated >= line.quantity`).
   - If not fully allocated AND `payload.accept_incomplete_allocation !== true`: return `400 Bad Request` (`"Transfer Order has incomplete allocations"`).

#### Execution & Stock Movements (Prisma Transaction)
For each `Transferorderallocation` associated with the order lines:
1. Load `stock_item = alloc.item` (under row lock) and `line = alloc.line`.
2. Compute `transfer_qty = Math.min(alloc.quantity, stock_item.quantity)`.
3. If `transfer_qty <= 0`, skip allocation.
4. **Branch A: `to.consume === true` (Stock Consumption)**:
   - Decrement `stock_item.quantity -= transfer_qty`.
   - If `stock_item.quantity === 0` and `stock_item.deleteOnDeplete === true`: delete `stock_item`, else update quantity.
   - Record `Stockitemtracking` with `trackingType = 12 (STOCK_REMOVE)`, `deltas: { transferorder: to.id, removed: transfer_qty, quantity: stock_item.quantity }`.
5. **Branch B: `transfer_qty < stock_item.quantity` (Partial Stock Move / Split)**:
   - Create split `StockItem` located at `to.destinationId` with `quantity = transfer_qty`.
   - Decrement parent `stock_item.quantity -= transfer_qty`.
   - Point `alloc.itemId = newStockItem.id`.
   - Record tracking on new item (`SPLIT_FROM_PARENT (40)`) and on parent (`SPLIT_CHILD_ITEM (42)`).
6. **Branch C: `transfer_qty === stock_item.quantity` (Full Stock Move)**:
   - Update `stock_item.locationId = to.destinationId`.
   - Record `Stockitemtracking` with `trackingType = 20 (STOCK_MOVE)`, `deltas: { location: to.destinationId, transferorder: to.id, quantity: transfer_qty }`.
7. Increment `line.transferred += transfer_qty`.
8. Update `transferorder.status = '30'` (`COMPLETE`) and `transferorder.completeDate = new Date()`.
9. Return `200 OK` (or `201 Created`) with `{ success: true }`.

---

### 9. `POST /api/order/transfer-order/:pk/allocate`

#### Purpose
Allocates inventory to Transfer Order line items.

#### Request Payload Schema
```typescript
interface TransferOrderAllocatePayload {
  items: {
    line_item: number;   // TransferOrderLineItem PK (required)
    stock_item: number;  // StockItem PK (required)
    quantity: number;    // Quantity to allocate (required, > 0)
  }[];
}
```

#### Validation Rules
1. Transfer Order `:pk` must exist and be in open status (`[10, 20, 25]`).
2. `items` array must be non-empty.
3. For each entry:
   - `line_item` must belong to this Transfer Order (`line.orderId === to.id`).
   - `stock_item` must be in stock, non-virtual, matching `line.partId` (or variant).
   - If `stock_item` is serialized: `quantity` must equal `1`.
   - `quantity` must be $> 0$ and $\le \text{unallocated\_quantity}(\text{stock\_item})$.
4. Insert into `Transferorderallocation`:
   ```typescript
   await prisma.transferorderallocation.create({
     data: {
       lineId: item.line_item,
       itemId: item.stock_item,
       quantity: item.quantity,
     }
   });
   ```
5. Return `201 Created` with `{ success: true }`.

---

## 6. Prisma ORM Entity Mapping Reference

| Python Model | Prisma Table | Key Foreign Keys & Fields |
|---|---|---|
| `SalesOrder` | `salesorder` | `id`, `reference`, `status`, `customerId`, `orderDate`, `targetDate`, `shipmentDate` |
| `SalesOrderLineItem` | `salesorderlineitem` | `id`, `orderId`, `partId`, `quantity`, `shipped` |
| `SalesOrderShipment` | `salesordershipment` | `id`, `orderId`, `reference`, `shipmentDate`, `deliveryDate`, `trackingNumber` |
| `SalesOrderAllocation` | `salesorderallocation` | `id`, `lineId`, `itemId`, `quantity`, `shipmentId` |
| `ReturnOrder` | `returnorder` | `id`, `reference`, `status`, `customerId`, `orderDate`, `issueDate`, `completeDate` |
| `ReturnOrderLineItem` | `returnorderlineitem` | `id`, `orderId`, `itemId`, `quantity`, `outcome`, `receivedDate` |
| `TransferOrder` | `transferorder` | `id`, `reference`, `status`, `locationId` (take_from), `destinationId`, `consume`, `issueDate`, `completeDate` |
| `TransferOrderLineItem` | `transferorderlineitem` | `id`, `orderId`, `partId`, `quantity`, `transferred` |
| `TransferOrderAllocation` | `transferorderallocation` | `id`, `lineId`, `itemId`, `quantity` |
| `StockItem` | `stockitem` | `id`, `partId`, `locationId`, `quantity`, `serial`, `batch`, `status`, `customerId`, `salesOrderId`, `deleteOnDeplete`, `parentId` |
| `StockItemTracking` | `stockitemtracking` | `id`, `itemId`, `date`, `trackingType`, `notes`, `deltas`, `userId` |

---

## 7. Verification and Testing Directives

When verifying and implementing these endpoints:
1. **Unit & Service Tests (`vitest`)**:
   - Write comprehensive tests in `src/backend/src/modules/orders/orders.service.test.ts` covering:
     - Allocation happy path and over-allocation rejection (400).
     - Serial expression parsing (`1,2,3`, `10-15`, `100+4`) and duplicate rejection.
     - Auto-allocation sorting (`FIFO`, `LIFO`, `QUANTITY_ASC`, `QUANTITY_DESC`, `EXPIRY_SOONEST`) and non-interchangeable lot isolation.
     - Return order hold transition and physical item receipt (stock split, location assignment, tracking delta verification).
     - Transfer order issue, cancel (with allocation cleanup), complete (with stock move vs stock consume), and allocate.
2. **Schema & Route Integration Tests**:
   - Verify that all endpoints respond with the exact status codes (`200`, `201`, `400`, `404`) and schemas expected by the frontend and Python API test parity suite.
