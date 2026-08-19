# Specification Mining Report: Stock Item Actions & Test Infrastructure (R3)

**Author**: survey_explorer_3 (role: teamwork_preview_spec_miner)  
**Date**: 2026-08-18  
**Scope**: Stock Item Actions (`/api/stock/merge`, `/api/stock/return`, `/api/stock/:pk/convert`, `/api/stock/:pk/install`, `/api/stock/:pk/uninstall`, `/api/stock/:pk/serialize`), Tracking History & Status Codes, and Vitest Test Infrastructure.  
**Authoritative Sources**:
- Python Reference: `src/backend_backup/InvenTree/stock/api.py`, `serializers.py`, `models.py`, `status_codes.py`, `test_api.py`, `tests.py`
- Python Helpers: `src/backend_backup/InvenTree/InvenTree/helpers.py`, `part/models.py`
- Current TypeScript Implementation: `src/backend/src/modules/stock/stock.routes.ts`, `stock.service.ts`, `stock.service.test.ts`, `prisma/schema.prisma`

---

## Executive Summary

The InvenTree stock management subsystem supports fine-grained stock lifecycle operations including bulk operations (merging, returning to stock) and single-item lifecycle actions (variant conversion, assembly installation/uninstallation, and unit serialization).

In the Node.js / Hono backend (`src/backend`), several endpoints are currently stubs returning `{ success: true }`. This report provides the authoritative specification, data contracts, validation rules, state transitions, tracking logs, error formats, and test harness setup needed to implement the complete business logic.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Stock Merge | POST `/api/stock/merge` | Merge $\ge 2$ stock items into a base item (`items[0]`), summing quantities, moving allocations, calculating weighted price, and deleting consumed items. | `items` (array of `{"item": pk}`), `location` (int), `notes` (str, opt), `allow_mismatched_suppliers` (bool, opt), `allow_mismatched_status` (bool, opt) | HTTP 201 Created (`{ success: true }`) | 400 if $<2$ items, duplicate items, structural location, serialized item, assigned to sales/customer/in production, part mismatch, supplier mismatch (if not allowed), status mismatch (if not allowed). | `src/backend_backup/InvenTree/stock/api.py:290`, `serializers.py:1725`, `models.py:2614,2709` |
| 2 | Stock Return | POST `/api/stock/return` | Return un-stocked items (e.g. from customer, build consumption, sales allocation) back into stock at a designated location, clearing assignments and optionally merging into parent item. | `items` (array of `{"pk": int, "quantity": num, ...}`), `location` (int), `merge` (bool, opt), `notes` (str, opt) | HTTP 201 Created (`{ success: true }`) | 400 if empty items, zero/negative quantity, quantity $>$ available, structural location. | `src/backend_backup/InvenTree/stock/api.py:265`, `serializers.py:2239`, `models.py:1567` |
| 3 | Stock Convert | POST `/api/stock/:pk/convert` | Convert a StockItem to a valid variant part within the same part template/variant tree hierarchy. | URL param `:pk` (int), JSON `part` (int, target part ID) | HTTP 201 Created (`{ success: true }`) | 404 if stock item not found; 400 if supplier part is assigned, target part does not exist, or target part is not in valid conversion options (descendants, parent, siblings; must be active & non-virtual). | `src/backend_backup/InvenTree/stock/api.py:178`, `serializers.py:1188`, `models.py:1362`, `part/models.py:2510` |
| 4 | Stock Install | POST `/api/stock/:pk/install` | Install a component stock item into an assembly stock item (`:pk`), setting `belongsToId = :pk` and clearing its location. | URL param `:pk` (int), JSON `stock_item` (int), `quantity` (int, default 1), `note` (str, opt) | HTTP 201 Created (`{ success: true }`) | 404 if assembly not found; 400 if child item unavailable (not in stock / installed / building / customer), child part not in parent's BOM, quantity $< 1$ or $>$ available. | `src/backend_backup/InvenTree/stock/api.py:161`, `serializers.py:834`, `models.py:1886` |
| 5 | Stock Uninstall | POST `/api/stock/:pk/uninstall` | Uninstall a previously installed component stock item (`:pk`) from its parent assembly and assign it to a physical location. | URL param `:pk` (int), JSON `location` (int, dest location), `note` (str, opt) | HTTP 201 Created (`{ success: true }`) | 404 if stock item not found; 400 if destination location is structural, or if item is not currently installed (`belongsToId == null`). | `src/backend_backup/InvenTree/stock/api.py:172`, `serializers.py:917`, `models.py:1952` |
| 6 | Stock Serialize | POST `/api/stock/:pk/serialize` | Split a bulk quantity stock item into $N$ individual serialized stock items (`quantity = 1`, unique `serial`), decrementing or deleting the source stock item. | URL param `:pk` (int), JSON `quantity` (int), `serial_numbers` (str), `destination` (int), `notes` (str, opt) | HTTP 201 Created (`StockItem[]` array of created items) | 404 if item not found; 400 if part is not trackable, item is already serialized, quantity $\le 0$, quantity $>$ item quantity, destination is structural, serial parsing count mismatch, duplicate or conflicting serials exist. | `src/backend_backup/InvenTree/stock/api.py:130`, `serializers.py:693`, `models.py:2402,737`, `InvenTree/helpers.py:599` |
| 7 | Stock Tracking | Automatic Logging | Create audit log entries in `Stockitemtracking` for all stock operations with specific tracking codes and structured JSON deltas. | Triggered by all stock operations | Creates row in `stock_stock_item_tracking` | Handled silently or bubbles DB error on failure. | `src/backend_backup/InvenTree/stock/status_codes.py:41`, `models.py:1450` |
| 8 | Stock Status Tracking | Stock Status Codes | Track stock status codes (`OK=10`, `ATTENTION=50`, `DAMAGED=55`, `DESTROYED=60`, `REJECTED=65`, `LOST=70`, `QUARANTINED=75`, `RETURNED=85`). | Request payloads or internal transitions | Updates `status` field on `Stockitem` | 400 on invalid status code. | `src/backend_backup/InvenTree/stock/status_codes.py:8` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Stock Merge | Merge items where one item is the `parent` of the base item (`baseItem.parentId == other.id`) | `baseItem.parentId` is reset to `null` before deleting `other` to prevent foreign key constraint violations. |
| 2 | Stock Merge | Merge items with different purchase prices (e.g. 10 units @ \$5, 25 units @ \$10, 5 units @ \$75) | Weighted average price is calculated: $(10\times5 + 25\times10 + 5\times75)/40 = 675/40 = \$16.875$. |
| 3 | Stock Merge | Merge items having build order or sales order allocations | Allocations (`Builditem`, `Salesorderallocation`, `Transferorderallocation`) are updated to point to `baseItem.id` before `other` is deleted. |
| 4 | Stock Merge | Merge request containing duplicate item PKs (e.g. `[11, 11]`) | Rejected with 400 `Duplicate stock items`. |
| 5 | Stock Return | Return partial quantity of bulk item (`quantity < item.quantity`) | Original item is split: a new item is created with the returned quantity, tracking entry created, un-stocked flags cleared, and original item quantity decremented. |
| 6 | Stock Return | Return serialized item with quantity specified | `quantity` parameter is ignored/must match 1 for serialized items; serialized item is moved to destination location and un-stocked flags cleared. |
| 7 | Stock Return | `merge: true` when returned item's `parentId` exists and is in the same location | Automatically merges returned item back into `parent` item using `merge_stock_items([item])`. |
| 8 | Stock Convert | Attempt to convert item with `supplierPartId != null` | Rejected with 400 `Cannot convert stock item with assigned SupplierPart`. |
| 9 | Stock Convert | Attempt to convert item to a virtual or inactive variant | Excluded from conversion options; rejected with 400 `Selected part is not a valid option for conversion`. |
| 10 | Stock Install | Install item into assembly where child part is not in assembly BOM | Rejected with 400 `Selected part is not in the Bill of Materials`. |
| 11 | Stock Install | Install item that is currently assigned to a customer or sales order | Rejected with 400 `Stock item is unavailable`. |
| 12 | Stock Install | Install partial quantity of non-serialized item (`quantity < child.quantity`) | Child item is split: new item with requested quantity is created and installed into assembly (`belongsToId = parent.id`), parent quantity decremented. |
| 13 | Stock Uninstall | Attempt to uninstall an item into a structural location (`structural: true`) | Rejected with 400 `Structural locations cannot be assigned stock items`. |
| 14 | Stock Uninstall | Uninstall item from assembly | `belongsToId` and `consumedById` are set to `null`; `locationId` set to target; tracking logged on both assembly (`REMOVED_CHILD_ITEM=36`) and item (`REMOVED_FROM_ASSEMBLY=31`). |
| 15 | Stock Serialize | Serial string range syntax: `'1-5'` with quantity 5 | Extracted to `['1', '2', '3', '4', '5']`. |
| 16 | Stock Serialize | Serial string plus syntax: `'SN-100+3'` with quantity 3 | Extracted to `['SN-100', 'SN-101', 'SN-102']`. |
| 17 | Stock Serialize | Serial string tilde syntax: `'~, ~'` with quantity 2 | Looks up latest serial number for part and increments sequentially. |
| 18 | Stock Serialize | Serial number that already exists for that `partId` | Rejected with 400 `Serial numbers already exist: <existing_serials>`. |
| 19 | Stock Serialize | Serialize entire remaining stock of bulk item with `deleteOnDeplete = true` | All quantity is split into serialized items; source bulk item quantity reaches 0 and source item is deleted. |
| 20 | Stock Serialize | Source bulk item has test results (`Stockitemtestresult`) | All test results are copied to each newly created serialized stock item. |

---

## Detailed Endpoint Specifications

### 1. Stock Merge: `POST /api/stock/merge`

**Handler**: `stockRouter.post('/api/stock/merge', ...)`  
**Service Method**: `mergeStockItems(...)`

#### Request Payload
```json
{
  "items": [
    { "item": 101 },
    { "item": 102 },
    { "item": 103 }
  ],
  "location": 5,
  "notes": "Consolidating batch stock",
  "allow_mismatched_suppliers": false,
  "allow_mismatched_status": false
}
```

#### Validation Steps
1. `items` must be an array of length $\ge 2$.
2. All item IDs in `items` must be distinct.
3. Destination `location` must exist and `structural == false`.
4. Base item is `items[0]`.
5. For base item and each secondary item (`can_merge` checks):
   - `salesOrderId == null` (not assigned to SO)
   - `belongsToId == null` (not installed in another item)
   - `customerId == null` (not assigned to customer)
   - `isBuilding == false` (not in production)
   - `serial == null || serial == ''` (not serialized)
   - Must have no installed child items (`prisma.stockitem.count({ where: { belongsToId: item.id } }) == 0`)
6. Compatibility with base item:
   - `item.partId === baseItem.partId`
   - If `!allow_mismatched_suppliers`: `item.supplierPartId === baseItem.supplierPartId`
   - If `!allow_mismatched_status`: `item.status === baseItem.status`

#### Execution Steps (Transaction)
1. Fetch and lock all items in ID order.
2. Sum quantities: `totalAdded = sum(other.quantity)`, `newQuantity = baseItem.quantity + totalAdded`.
3. Compute weighted average purchase price if any item has `purchasePrice`:
   $$\text{newPrice} = \frac{\sum (\text{item.purchasePrice} \times \text{item.quantity})}{\sum \text{item.quantity (where purchasePrice is present)}}$$
4. Re-parent allocations for each secondary item:
   - `Builditem`: `updateMany({ where: { stockItemId: other.id }, data: { stockItemId: baseItem.id } })`
   - `Salesorderallocation`: `updateMany({ where: { itemId: other.id }, data: { itemId: baseItem.id } })`
   - `Transferorderallocation`: `updateMany({ where: { itemId: other.id }, data: { itemId: baseItem.id } })`
5. If `baseItem.parentId === other.id`, set `baseItem.parentId = null`.
6. Delete secondary items (`prisma.stockitem.delete({ where: { id: other.id } })`).
7. Update base item: `quantity = newQuantity`, `locationId = location`, `purchasePrice = newPrice`.
8. Create tracking entry:
   - `itemId`: `baseItem.id`
   - `trackingType`: `StockHistoryCode.MERGED_STOCK_ITEMS` (`45`)
   - `notes`: `notes ?? ''`
   - `deltas`: `{ quantity: Number(newQuantity), added: Number(totalAdded) }`
   - `userId`: `userId`

#### Response
- Status: `201 Created`
- Body: `{ "success": true }`

---

### 2. Stock Return: `POST /api/stock/return`

**Handler**: `stockRouter.post('/api/stock/return', ...)`  
**Service Method**: `returnStockItems(...)`

#### Request Payload
```json
{
  "items": [
    {
      "pk": 101,
      "quantity": 10,
      "status": "10"
    }
  ],
  "location": 3,
  "merge": false,
  "notes": "Returned from customer warranty claim"
}
```

#### Validation Steps
1. `items` must be non-empty array.
2. Destination `location` must exist and `structural == false`.
3. For each item in `items`:
   - Item must exist in DB.
   - If `quantity` is specified: `quantity > 0` and `quantity <= item.quantity`.

#### Execution Steps (Transaction)
For each item:
1. If `quantity` specified and `quantity < item.quantity` and `item.serial == null`:
   - Split item: create new `Stockitem` with `quantity`, `parentId = item.id`, and decrement source item quantity.
   - Operate on the newly split item.
2. Build tracking deltas:
   - `deltas.quantity = quantity ?? item.quantity`
   - `deltas.location = location`
   - If `item.customerId`: `deltas.customer = item.customerId`
   - If `item.consumedById`: `deltas.build_order = item.consumedById`
   - If status changed: `deltas.status = newStatus`, `deltas.old_status = item.status`
3. Clear un-stocked assignments on item:
   - `consumedById = null`
   - `customerId = null`
   - `belongsToId = null`
   - `salesOrderId = null`
   - `locationId = location`
   - If `status` specified: `status = status`
4. Clear allocations:
   - `Salesorderallocation.deleteMany({ where: { itemId: item.id } })`
   - `Builditem.deleteMany({ where: { stockItemId: item.id } })`
   - `Transferorderallocation.deleteMany({ where: { itemId: item.id } })`
5. Create tracking entry:
   - `itemId`: `item.id`
   - `trackingType`: `StockHistoryCode.RETURNED_TO_STOCK` (`15`)
   - `notes`: `notes ?? ''`
   - `deltas`: `deltas`
   - `userId`: `userId`
6. If `merge === true` AND `item.serial == null` AND `item.parentId != null`:
   - Fetch parent item. If `parent.locationId === location`:
     - Merge `item` into `parent` using merge logic.

#### Response
- Status: `201 Created`
- Body: `{ "success": true }`

---

### 3. Stock Convert: `POST /api/stock/:pk/convert`

**Handler**: `stockRouter.post('/api/stock/:pk/convert', ...)`  
**Service Method**: `convertStockItem(...)`

#### Request Payload
```json
{
  "part": 42
}
```

#### Validation Steps
1. Stock item `:pk` must exist.
2. Target `part` must exist.
3. Item must NOT have `supplierPartId` (`if (item.supplierPartId) throw new Error('Cannot convert stock item with assigned SupplierPart')`).
4. Validate conversion hierarchy:
   - Current part: `sourcePart = item.part`.
   - Conversion options are:
     a) Children/Descendants: parts where `variantOfId == sourcePart.id` (recursively or direct descendants).
     b) Immediate parent: part where `id == sourcePart.variantOfId`.
     c) Siblings: parts where `variantOfId == sourcePart.variantOfId && id != sourcePart.id`.
   - All options must satisfy: `active == true` and `virtual == false`.
   - Target `part` ID must be present in the computed conversion options. If not, return 400 `Selected part is not a valid option for conversion`.

#### Execution Steps (Transaction)
1. If `targetPart.id === item.partId`, return `{ success: true }` (no-op).
2. Update item: `prisma.stockitem.update({ where: { id: item.id }, data: { partId: targetPart.id } })`.
3. Create tracking entry:
   - `itemId`: `item.id`
   - `trackingType`: `StockHistoryCode.CONVERTED_TO_VARIANT` (`48`)
   - `notes`: `Converted to part: ${targetPart.name}`
   - `deltas`: `{ part: targetPart.id }`
   - `userId`: `userId`

#### Response
- Status: `201 Created`
- Body: `{ "success": true }`

---

### 4. Stock Install: `POST /api/stock/:pk/install`

**Handler**: `stockRouter.post('/api/stock/:pk/install', ...)`  
**Service Method**: `installStockItem(...)`

#### Request Payload
```json
{
  "stock_item": 205,
  "quantity": 1,
  "note": "Installed into main chassis"
}
```

#### Validation Steps
1. Assembly item `:pk` must exist.
2. Assembly part must be an assembly: `assemblyPart.assembly === true`.
3. Child `stock_item` must exist.
4. Child item must be in stock:
   - `belongsToId == null && customerId == null && consumedById == null && salesOrderId == null && isBuilding == false`.
   - If unavailable -> 400 `Stock item is unavailable`.
5. BOM validation:
   - Child item's part must be present in the BOM of the assembly part:
     `prisma.bomitem.findFirst({ where: { partId: assembly.partId, subPartId: child.partId } })`.
   - (Or substitute BOM item via `bomitemsubstitute`).
   - If not in BOM -> 400 `Selected part is not in the Bill of Materials`.
6. Quantity validation:
   - `quantity >= 1`
   - `quantity <= child.quantity` (if $> child.quantity$ -> 400 `Quantity to install must not exceed available quantity`).

#### Execution Steps (Transaction)
1. If `quantity < child.quantity` and `child.serial == null`:
   - Split child item: create new child stock item with `quantity`, decrement source child item quantity.
   - Use the new child item for installation.
2. Update child item:
   - `belongsToId = assembly.id`
   - `locationId = null` (installed items have no separate location)
3. Create tracking entry on child item:
   - `itemId`: `child.id`
   - `trackingType`: `StockHistoryCode.INSTALLED_INTO_ASSEMBLY` (`30`)
   - `notes`: `note ?? ''`
   - `deltas`: `{ stockitem: assembly.id, quantity: Number(quantity) }`
   - `userId`: `userId`
4. Create tracking entry on assembly item:
   - `itemId`: `assembly.id`
   - `trackingType`: `StockHistoryCode.INSTALLED_CHILD_ITEM` (`35`)
   - `notes`: `note ?? ''`
   - `deltas`: `{ stockitem: child.id, quantity: Number(quantity) }`
   - `userId`: `userId`

#### Response
- Status: `201 Created`
- Body: `{ "success": true }`

---

### 5. Stock Uninstall: `POST /api/stock/:pk/uninstall`

**Handler**: `stockRouter.post('/api/stock/:pk/uninstall', ...)`  
**Service Method**: `uninstallStockItem(...)`

#### Request Payload
```json
{
  "location": 2,
  "note": "Removed for maintenance"
}
```

#### Validation Steps
1. Target item `:pk` must exist.
2. Target item must currently be installed in an assembly (`belongsToId != null`).
3. Destination `location` must exist and `structural == false`.

#### Execution Steps (Transaction)
1. Record parent assembly ID: `parentAssemblyId = item.belongsToId`.
2. Update item:
   - `belongsToId = null`
   - `consumedById = null`
   - `locationId = location`
3. Create tracking entry on parent assembly:
   - `itemId`: `parentAssemblyId`
   - `trackingType`: `StockHistoryCode.REMOVED_CHILD_ITEM` (`36`)
   - `notes`: `note ?? ''`
   - `deltas`: `{ stockitem: item.id, quantity: Number(item.quantity) }`
   - `userId`: `userId`
4. Create tracking entry on uninstalled item:
   - `itemId`: `item.id`
   - `trackingType`: `StockHistoryCode.REMOVED_FROM_ASSEMBLY` (`31`)
   - `notes`: `note ?? ''`
   - `deltas`: `{ stockitem: parentAssemblyId, quantity: Number(item.quantity) }`
   - `userId`: `userId`

#### Response
- Status: `201 Created`
- Body: `{ "success": true }`

---

### 6. Stock Serialize: `POST /api/stock/:pk/serialize`

**Handler**: `stockRouter.post('/api/stock/:pk/serialize', ...)`  
**Service Method**: `serializeStockItem(...)`

#### Request Payload
```json
{
  "quantity": 3,
  "serial_numbers": "101, 102, 103",
  "destination": 4,
  "notes": "Serialized initial batch"
}
```

#### Validation Steps
1. Source stock item `:pk` must exist.
2. Part must be trackable: `part.trackable === true`. If false -> 400 `Serial numbers cannot be assigned to this part` / `Part is not set as trackable`.
3. Item must NOT already be serialized (`item.serial == null || item.serial === ''`).
4. `quantity` must be integer $\ge 1$ and $\le 1000$.
5. `quantity <= item.quantity`. If $> item.quantity$ -> 400 `Quantity must not exceed available stock quantity (<item.quantity>)`.
6. Destination `destination` must exist and `structural == false`.
7. Parse serial numbers from `serial_numbers` string (supporting comma-separated, hyphen ranges `1-5`, plus syntax `100+3`, tilde `~`):
   - Number of parsed serials must exactly equal `quantity`.
   - All serials in list must be distinct.
   - For each serial, verify no existing `Stockitem` has `partId === item.partId && serial === serialStr`. If conflict exists -> 400 `Serial numbers already exist: <conflict_list>`.

#### Execution Steps (Transaction)
1. For each serial in parsed `serials`:
   - Create new `Stockitem`:
     - `partId`: `item.partId`
     - `locationId`: `destination`
     - `quantity`: 1
     - `serial`: `serial`
     - `serialInt`: `parseInt(serial, 10) || 0`
     - `batch`: `item.batch`
     - `purchasePrice`: `item.purchasePrice`
     - `expiryDate`: `item.expiryDate`
     - `link`: `item.link`
     - `status`: `item.status`
     - `parentId`: `item.id`
     - `isBuilding`: false
     - `deleteOnDeplete`: `item.deleteOnDeplete`
     - `creationDate`: `new Date()`
   - Create tracking entries for each new item:
     - Entry 1: `trackingType: StockHistoryCode.SPLIT_FROM_PARENT (40)`, `deltas: { quantity: 1, location: destination }`
     - Entry 2: `trackingType: StockHistoryCode.ASSIGNED_SERIAL (6)`, `deltas: { serial }`
   - Copy any test results (`Stockitemtestresult`) from source item to the new item.
2. On source item:
   - New quantity: `remQuantity = item.quantity - quantity`.
   - Create tracking entry on source item:
     - `trackingType`: `StockHistoryCode.STOCK_SERIALIZED` (`13`)
     - `notes`: `notes ?? ''`
     - `deltas`: `{ quantity: remQuantity, removed: quantity }`
     - `userId`: `userId`
   - If `remQuantity === 0` and `item.deleteOnDeplete === true`:
     - `prisma.stockitem.delete({ where: { id: item.id } })`
   - Else:
     - `prisma.stockitem.update({ where: { id: item.id }, data: { quantity: remQuantity } })`

#### Response
- Status: `201 Created`
- Body: Array of created `Stockitem` objects (matching `StockItemSerializer(many=True)`).

---

## Authoritative Status & Tracking Code Catalog

### Stock History Codes (`StockHistoryCode` / `trackingType`)

| Code Constant | Integer Value | Description |
|---------------|---------------|-------------|
| `LEGACY` | `0` | Legacy stock tracking entry |
| `CREATED` | `1` | Stock item created |
| `EDITED` | `5` | Edited stock item |
| `ASSIGNED_SERIAL` | `6` | Assigned serial number |
| `STOCK_COUNT` | `10` | Stock counted |
| `STOCK_ADD` | `11` | Stock manually added |
| `STOCK_REMOVE` | `12` | Stock manually removed |
| `STOCK_SERIALIZED` | `13` | Serialized stock items |
| `RETURNED_TO_STOCK` | `15` | Returned to stock |
| `STOCK_MOVE` | `20` | Location changed |
| `STOCK_UPDATE` | `25` | Stock updated |
| `INSTALLED_INTO_ASSEMBLY` | `30` | Installed into assembly |
| `REMOVED_FROM_ASSEMBLY` | `31` | Removed from assembly |
| `INSTALLED_CHILD_ITEM` | `35` | Installed component item |
| `REMOVED_CHILD_ITEM` | `36` | Removed component item |
| `SPLIT_FROM_PARENT` | `40` | Split from parent item |
| `SPLIT_CHILD_ITEM` | `42` | Split child item |
| `MERGED_STOCK_ITEMS` | `45` | Merged stock items |
| `DISASSEMBLED` | `46` | Disassembled into components |
| `CREATED_FROM_DISASSEMBLY` | `47` | Created from disassembly |
| `CONVERTED_TO_VARIANT` | `48` | Converted to variant |
| `BUILD_OUTPUT_CREATED` | `50` | Build order output created |
| `BUILD_OUTPUT_COMPLETED` | `55` | Build order output completed |
| `BUILD_OUTPUT_REJECTED` | `56` | Build order output rejected |
| `BUILD_CONSUMED` | `57` | Consumed by build order |
| `SHIPPED_AGAINST_SALES_ORDER` | `60` | Shipped against Sales Order |
| `RECEIVED_AGAINST_PURCHASE_ORDER` | `70` | Received against Purchase Order |
| `RETURNED_AGAINST_RETURN_ORDER` | `80` | Returned against Return Order |
| `SENT_TO_CUSTOMER` | `100` | Sent to customer |
| `RETURNED_FROM_CUSTOMER` | `105` | Returned from customer |

### Stock Status Codes (`StockStatus`)

| Code Constant | Integer / String Value | Label | Available in Stock? |
|---------------|------------------------|-------|---------------------|
| `OK` | `'10'` (10) | OK | Yes |
| `ATTENTION` | `'50'` (50) | Attention needed | Yes |
| `DAMAGED` | `'55'` (55) | Damaged | Yes |
| `DESTROYED` | `'60'` (60) | Destroyed | No |
| `REJECTED` | `'65'` (65) | Rejected | No |
| `LOST` | `'70'` (70) | Lost | No |
| `QUARANTINED` | `'75'` (75) | Quarantined | No |
| `RETURNED` | `'85'` (85) | Returned | Yes |

---

## Test Infrastructure & Vitest Harness Analysis

### Test Environment Overview
- **Runner**: Vitest `v4.1.11` running with Node.js ESM.
- **Execution Command**: `npm test` (invokes `vitest run`).
- **Pass/Fail Status**: 4 test files, 28 tests, **100% passing** (0 failures).
- **Execution Time**: ~440ms.

### Existing Test Suite Breakdown
1. `src/modules/build/build.service.test.ts` (7 tests): Validates build order creation rules, part assembly checks, BOM item presence, and stock allocation limits.
2. `src/modules/orders/orders.service.test.ts` (5 tests): Validates order locking states (purchase, sales, return) and PO item receipt with tracking.
3. `src/modules/parts/parts.service.test.ts` (7 tests): Validates structural categories, part assignments, and recursive circular BOM detection.
4. `src/modules/stock/stock.service.test.ts` (9 tests): Validates serial uniqueness, single-quantity serialization constraint, and tracking entry creation on field deltas.

### Mocking Patterns & Conventions
- Unit tests mock Prisma Client:
  ```ts
  import { vi, describe, it, expect, beforeEach } from 'vitest';
  import { prisma } from '../../utils/db.js';

  vi.mock('../../utils/db.js', () => ({
    prisma: {
      stockitem: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
      stocklocation: { findUnique: vi.fn() },
      stockitemtracking: { create: vi.fn() },
      part: { findUnique: vi.fn(), findMany: vi.fn() },
      bomitem: { findFirst: vi.fn() }
    }
  }));

  beforeEach(() => {
    vi.clearAllMocks();
  });
  ```

### Test Coverage Recommendations for R3 Implementation
For R3 Stock Item Actions, unit tests in `src/modules/stock/stock.service.test.ts` should cover:
1. **Merge**:
   - Rejection on $<2$ items, duplicate items, or structural location.
   - Rejection on serialized item, sales order allocation, customer assignment, or in-production state.
   - Rejection on mismatched parts, suppliers (when disabled), or statuses (when disabled).
   - Successful merge with quantity summation, price weighting, allocation re-parenting, and tracking code `45`.
2. **Return**:
   - Rejection on invalid quantity or structural location.
   - Successful return clearing customer, build, sales order, and belongsTo references with tracking code `15`.
   - Automatic merge into parent if `merge === true` and locations match.
3. **Convert**:
   - Rejection if `supplierPartId` is present.
   - Rejection if target part is not in valid variant tree (ancestor/descendant/sibling) or is inactive/virtual.
   - Successful conversion updating `partId` with tracking code `48`.
4. **Install**:
   - Rejection if child is unavailable or not in parent BOM.
   - Successful install setting `belongsToId`, clearing location, and creating tracking codes `30` (child) and `35` (parent).
5. **Uninstall**:
   - Rejection if destination is structural or item not installed.
   - Successful uninstall setting `belongsToId = null`, assigning location, and creating tracking codes `31` (child) and `36` (parent).
6. **Serialize**:
   - Rejection if part not trackable, item already serialized, or serial numbers already in use.
   - Successful serialization generating $N$ items with quantity 1, updating parent quantity / deleteOnDeplete, copying test results, and logging tracking codes `40`, `6`, and `13`.
