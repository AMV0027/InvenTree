# Authoritative Specification Report: R1. Build Order Operations

**Author:** survey_explorer_1 (teamwork_preview_spec_miner)  
**Date:** 2026-08-18  
**Scope:** R1. Build Order Operations in InvenTree (Hono / Prisma TypeScript Backend vs Authoritative Python Reference)

---

## 1. Executive Summary

This report delivers the complete, authoritative specification for implementing the business logic of the five currently mocked Build Order endpoints in `src/backend`:
1. `POST /api/build/:pk/scrap-outputs`
2. `POST /api/build/:pk/auto-allocate`
3. `POST /api/build/:pk/allocate`
4. `POST /api/build/:pk/unallocate`
5. `POST /api/build/:pk/consume`

All behaviors, validations, edge cases, error messages, tracking codes, and database state transitions documented here were extracted directly from the authoritative Python reference implementation in `src/backend_backup/InvenTree` (specifically `build/api.py`, `build/models.py`, `build/serializers.py`, `build/tasks.py`, `build/status_codes.py`, `stock/models.py`, and `stock/status_codes.py`) and verified against test suites in `build/test_api.py` and `build/test_build.py`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Scrap Outputs | Output Scrapping & Rejection | Marks build output(s) in production as rejected/scrapped, updates stock location, splits stock if quantity is partial, completes or discards allocated components, and creates tracking entry without advancing completed build count. | `pk` (build ID in URL), JSON body: `{ outputs: [{ output: number, quantity?: number }], location: number, notes: string, discard_allocations?: boolean }` | `{ success: true }` (200/201) | 404 if build not found; 400 if outputs empty, location missing, notes missing/blank, output not in build, output part mismatch, output not `is_building`, quantity <= 0, or quantity > output.quantity. | `build/api.py:774`, `build/serializers.py:503`, `build/models.py:1298`, `build/tasks.py:132` |
| 2 | Auto-Allocate | Untracked Component Auto-Allocation | Automatically allocates unallocated untracked BOM items against available in-stock items matching BOM line (direct parts, variants, substitutes) with optional location filtering, sort ordering, and interchangeable stock logic. | `pk` (build ID in URL), JSON body: `{ location?: number, exclude_location?: number, interchangeable?: boolean, substitutes?: boolean, optional_items?: boolean, item_type?: 'untracked'\|'tracked'\|'all', stock_sort_by?: string, build_lines?: number[] }` | `{ success: true }` (200/201) | 404 if build not found; 400 if invalid location/lines. Skips fully allocated lines, consumable parts, or lines with multiple non-interchangeable stock items. | `build/api.py:910`, `build/serializers.py:1042`, `build/models.py:1752`, `build/tasks.py:28` |
| 3 | Auto-Allocate | Tracked Component Serial Matching | Automatically matches serialized tracked component stock items to serialized build outputs having the exact same serial number, creating allocations targeting the specific output assembly (`install_into`). | Same as auto-allocate endpoint with `item_type: 'tracked'` or `'all'` | `{ success: true }` (200/201) | 404 if build not found. Skips outputs without serials, already allocated lines, or when multiple/zero matching serials exist. | `build/api.py:910`, `build/models.py:1642`, `build/models.py:1733`, `build/tasks.py:28` |
| 4 | Allocate | Manual Stock Allocation | Manually allocates specified quantities of stock items against specific build lines and optional target build outputs (`install_into`), verifying BOM compatibility, variant/substitute rules, tracking requirements, and available unallocated stock quantity. Merges duplicate allocations into existing records. | `pk` (build ID in URL), JSON body: `{ items: [{ build_line: number, stock_item: number, quantity: number, output?: number }] }` | `{ success: true }` (200/201) | 404 if build not found; 400 if items empty/missing, quantity <= 0, stock item not in stock, part not matching BOM line, quantity > unallocated stock, missing output for tracked parts, or output specified for untracked parts. | `build/api.py:958`, `build/serializers.py:858`, `build/serializers.py:987`, `build/models.py:1511` |
| 5 | Unallocate | Stock Deallocation / Unallocation | Removes stock allocations (`Builditem` records) from a build order, with optional filtering by build line or build output. | `pk` (build ID in URL), JSON body: `{ build_line?: number, output?: number }` | `{ success: true }` (200) | 404 if build not found; 400 if specified output does not point to the same build order. | `build/api.py:423`, `build/serializers.py:805`, `build/models.py:1081` |
| 6 | Consume | Stock Consumption & Output Assembly | Consumes allocated stock items against the build order, reducing stock quantities (with child item splitting if partial), installing tracked components into target assemblies (`belongsToId`), updating `buildline.consumed`, deleting depleted/exhausted allocations, logging tracking history (`BUILD_CONSUMED`, `INSTALLED_INTO_ASSEMBLY`, `INSTALLED_CHILD_ITEM`), and enforcing `deleteOnDeplete`. | `pk` (build ID in URL), JSON body: `{ items?: [{ build_item: number, quantity: number }], lines?: [{ build_line: number }], notes?: string }` | `{ success: true }` (200) | 404 if build not found; 400 if neither items nor lines provided, duplicate items/lines, item/line not belonging to build, quantity <= 0, or quantity > build_item.quantity. | `build/api.py:973`, `build/serializers.py:1707`, `build/serializers.py:1758`, `build/models.py:663`, `build/tasks.py:38` |
| 7 | Build Line | Consumable BOM Item Bypass | Consumable BOM items (`bom_item.consumable == true` or `sub_part.consumable == true`) must not have allocated stock and are skipped during manual allocation, auto-allocation, and trim calculations. | Allocation/auto-allocation payloads referencing consumable BOM items | Skipped in allocation | Validation or silent bypass in allocation algorithm. | `build/models.py:1559`, `build/models.py:1811` |
| 8 | Stock Splitting | Partial Stock Consumption & Scrap Splitting | When a stock item is partially consumed or partially scrapped, the exact consumed/scrapped quantity is split into a new child `Stockitem` record (`parentId = original.id`), preserving metadata, while decrementing parent stock quantity and recording `SPLIT_FROM_PARENT` (40) and `SPLIT_CHILD_ITEM` (42) tracking entries. | Partial quantity < stock_item.quantity in consume/scrap | New child `StockItem` created, parent `StockItem` decremented | N/A (atomic transaction) | `build/models.py:764`, `build/models.py:1337`, `stock/models.py:3200` |
| 9 | Lifecycle | Delete On Deplete Handling | When a stock item quantity reaches 0 during consumption, if `deleteOnDeplete == true` and `canDelete() == true` (no installed child items, no active SO/TO/RO allocations), the stock item is deleted. Otherwise it remains with quantity = 0 and location = null. | Stock depletion to 0 | Item deleted or updated to 0 qty | N/A | `stock/models.py:1819`, `stock/models.py:3208` |
| 10 | Status Codes | Status Alignment | Standardizes BuildStatus (`PENDING: '10'`, `PRODUCTION: '20'`, `ON_HOLD: '25'`, `CANCELLED: '30'`, `COMPLETE: '40'`) and StockStatus (`OK: '10'`, `REJECTED: '65'`) and StockHistoryCode tracking constants. | Status fields across modules | Consistent integer/string values | Prevents enum mismatch errors. | `build/status_codes.py`, `stock/status_codes.py` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Scrap Outputs | Partial scrap quantity (`quantity < output.quantity`) | Original output is reduced to `output.quantity - quantity` and remains `isBuilding = true`. A new child stock item is created with the scrapped quantity, `isBuilding = false`, `status = StockStatus.REJECTED` ('65'), `locationId = location`, and split tracking entries are recorded. |
| 2 | Scrap Outputs | Output already completed (`isBuilding == false`) | Rejects with 400: `"This build output has already been completed"`. |
| 3 | Scrap Outputs | Output from different build order | Rejects with 400: `"Build output does not match the parent build"`. |
| 4 | Scrap Outputs | `discard_allocations == false` | Component stock allocated to the scrapped output is consumed (`complete_allocations`) rather than returned to general stock, then the `Builditem` allocation records are deleted. |
| 5 | Scrap Outputs | `discard_allocations == true` | Component stock allocated to the scrapped output is not consumed; the `Builditem` allocation records are directly deleted, leaving the component stock items unallocated. |
| 6 | Scrap Outputs | Empty outputs list or invalid location | Rejects with 400: `"A list of build outputs must be provided"` or location required validation error. |
| 7 | Allocate | Re-allocating same stock item to same line (`duplicate key`) | Instead of failing or creating a duplicate row, the existing `Builditem` quantity is incremented by the new quantity (`builditem.quantity += quantity`). |
| 8 | Allocate | Allocation quantity exceeds unallocated stock | Rejects with 400: `"Available quantity (<unallocated>) exceeded"`. |
| 9 | Allocate | Tracked component allocated without `output` | Rejects with 400: `"Build output must be specified for allocation of tracked parts"`. |
| 10 | Allocate | Untracked component allocated with `output` | Rejects with 400: `"Build output cannot be specified for allocation of untracked parts"`. |
| 11 | Allocate | Stock item part is substitute or variant of BOM part | If part matches an allowed `Bomitemsubstitute` or descendant variant (when `allowVariants == true`), allocation succeeds; otherwise rejects with 400: `"Selected stock item does not match BOM line"`. |
| 12 | Auto-Allocate | Multiple non-interchangeable stock items available | When `interchangeable == false` and more than 1 candidate stock item exists for the BOM line, auto-allocation skips the line and requires user manual allocation. When `interchangeable == true`, it consumes across multiple stock items in sorted order. |
| 13 | Auto-Allocate | Variant vs Direct part priority | Direct part matches are prioritized first (priority 1), followed by variants (priority 2), followed by substitute parts (priority 3), with secondary ordering by `stock_sort_by` (e.g. earliest expiry or location). |
| 14 | Auto-Allocate | Serial matching for tracked parts (`item_type == 'tracked'`) | Matches candidate stock item having `serial == output.serial`. Only allocates if exactly 1 matching stock item is found. |
| 15 | Consume | Consuming by `lines` vs `items` | If `lines` is provided, all `Builditem` allocations for each specified `build_line` are consumed in full. If `items` is provided, only the specified `Builditem`s are consumed with their given quantities (up to `build_item.quantity`). Both can be combined in a single request. |
| 16 | Consume | Partial consumption of an allocation (`quantity < build_item.quantity`) | `build_item.quantity` is decremented by `quantity`, the consumed quantity is split from the stock item (or depleted), `buildline.consumed` is incremented by `quantity`, and the `Builditem` record remains with the remaining unconsumed quantity. |
| 17 | Consume | Consuming trackable item installed into build output | Stock item is set to `belongsToId = output.id`, `consumedById = build.id`, `locationId = null`. Tracking code `INSTALLED_INTO_ASSEMBLY` (30) is logged on the component and `INSTALLED_CHILD_ITEM` (35) is logged on the assembly output. |
| 18 | Consume | Stock item depleted with `deleteOnDeplete == true` | If `stockItem.quantity` reaches 0 and the item has no installed children and no active allocations, it is deleted from the database. |
| 19 | Unallocate | Unallocating with no params (`{}`) | Deallocates all untracked allocations (`installIntoId == null`) across all build lines of the build order. |
| 20 | Unallocate | Unallocating with specific `build_line` and/or `output` | Scopes deallocation strictly to `Builditem` records matching the given `buildLineId` and/or `installIntoId`. |

---

## 2. Detailed Endpoint Specifications

### 2.1 `POST /api/build/:pk/scrap-outputs`

#### Route & URL Parameters
- **Path:** `/api/build/:pk/scrap-outputs`
- **Params:** `pk` (integer, required) - Build order primary key.

#### Request Headers & Body Schema
- **Content-Type:** `application/json`
- **Body:**
```typescript
interface ScrapOutputsRequest {
  outputs: Array<{
    output: number;      // StockItem ID (required)
    quantity?: number;   // Quantity to scrap (optional, default: output.quantity)
  }>;
  location: number;      // StockLocation ID where scrapped items are moved (required)
  discard_allocations?: boolean; // Default false. If false, completes/consumes allocations. If true, discards allocations.
  notes: string;         // Required scrap reason / tracking note (non-empty)
}
```

#### Validation Steps
1. Fetch Build by `pk`. If not found, return `404 Not Found`.
2. Ensure `outputs` is an array with `length > 0`. If empty/missing, return `400 Bad Request` (`"A list of build outputs must be provided"`).
3. Ensure `location` exists in `stocklocation`. If not found, return `400 Bad Request`.
4. Ensure `notes` is provided and trimmed length > 0. If empty, return `400 Bad Request` (`"notes required"`).
5. For each entry in `outputs`:
   - Fetch `StockItem` by `output` ID. If not found, return `400 Bad Request` (`"Stock item does not exist"`).
   - Verify `output.buildId === build.id`. If not, return `400 Bad Request` (`"Build output does not match the parent build"`).
   - Verify `output.partId === build.partId`. If not, return `400 Bad Request` (`"Output part does not match BuildOrder part"`).
   - Verify `output.isBuilding === true`. If false, return `400 Bad Request` (`"This build output has already been completed"`).
   - If `quantity` is specified:
     - Verify `quantity > 0` (`"Quantity must be greater than zero"`).
     - Verify `quantity <= output.quantity` (`"Quantity cannot be greater than the output quantity"`).

#### Business Logic & Database Mutations (Atomic Transaction)
1. For each item in `outputs`:
   - Fetch `StockItem` row.
   - If `quantity < output.quantity`:
     - Decrement original `output.quantity -= quantity`.
     - Create new child `StockItem` with:
       - `partId = output.partId`
       - `quantity = quantity`
       - `batch = output.batch`
       - `locationId = location`
       - `status = '65'` (`StockStatus.REJECTED`)
       - `isBuilding = false`
       - `parentId = output.id`
       - `buildId = build.id`
       - `deleteOnDeplete = output.deleteOnDeplete`
     - Record tracking: `SPLIT_FROM_PARENT` (40) on child, `SPLIT_CHILD_ITEM` (42) on parent.
     - Scrapped item reference becomes the new child.
   - Else (full scrap):
     - Update `output`: `isBuilding = false`, `status = '65'` (`StockStatus.REJECTED`), `locationId = location`.
     - Scrapped item reference is `output`.
2. Allocations handling on scrapped item:
   - Find all `Builditem` records where `installIntoId == scrapped_item.id`.
   - If `discard_allocations === false`:
     - Complete/consume allocations: decrement component stock quantities (or split), increment `buildline.consumed`, log tracking.
   - Delete all `Builditem` allocation records for `installIntoId == scrapped_item.id`.
3. Create rejection tracking entry:
   - `trackingType = 56` (`BUILD_OUTPUT_REJECTED`)
   - `notes = notes`
   - `deltas = { quantity: scrapQty, location: location, status: '65', buildorder: build.id }`
4. Do NOT increment `build.completed` count.

---

### 2.2 `POST /api/build/:pk/auto-allocate`

#### Route & URL Parameters
- **Path:** `/api/build/:pk/auto-allocate`
- **Params:** `pk` (integer, required) - Build order primary key.

#### Request Headers & Body Schema
- **Content-Type:** `application/json`
- **Body:**
```typescript
interface AutoAllocateRequest {
  location?: number | null;          // Optional filter to stock items under this location
  exclude_location?: number | null;  // Optional filter to exclude stock items under this location
  interchangeable?: boolean;         // Default false. If true, allows pulling from multiple stock items
  substitutes?: boolean;             // Default true. If true, allows allocating substitute parts
  optional_items?: boolean;          // Default false. If true, allocates optional BOM items
  item_type?: 'untracked' | 'tracked' | 'all'; // Default 'untracked'
  stock_sort_by?: string;            // Default 'location' or 'expiry_date'
  build_lines?: number[];            // Optional list of BuildLine IDs to restrict auto-allocation
}
```

#### Algorithm & Validation
- **Untracked items:**
  1. Filter untracked build lines (`bomItem.subPart.trackable == false`).
  2. Skip consumable lines (`bomItem.consumable == true` or `subPart.consumable == true`).
  3. Skip optional lines if `!optional_items`.
  4. Calculate unallocated line quantity: `max(line.quantity - sum(allocated), 0)`. Skip if 0.
  5. Collect candidate parts: direct `subPartId`, variants (descendants where `variantOfId == subPartId`), substitutes (from `Bomitemsubstitute` if `substitutes == true`).
  6. Fetch in-stock available items (`quantity > 0, isBuilding == false, serial == null`, filtered by location / exclude_location).
  7. Calculate unallocated available per stock item: `stock.quantity - sum(existing_builditem_allocations)`.
  8. Sort candidates:
     - Group 1: Direct part matches (priority 1)
     - Group 2: Variant part matches (priority 2)
     - Group 3: Substitute part matches (priority 3)
     - Secondary sort: `locationId` or `expiryDate` (ascending, nulls last)
  9. If multiple candidate items exist and `!interchangeable`, skip line (user manual intervention needed).
  10. Otherwise, allocate stock up to `unallocated_quantity`, merging into existing `Builditem` for `(buildLineId, stockItemId, installIntoId: null)` or creating a new `Builditem`.
- **Tracked items:**
  1. Query incomplete serialized build outputs (`isBuilding == true, serial != null`).
  2. For each output and each unallocated tracked line, find candidate component stock item with `serial == output.serial && quantity == 1 && isBuilding == false`.
  3. If exactly 1 match found, create `Builditem({ buildLineId: line.id, stockItemId: match.id, quantity: 1, installIntoId: output.id })`.

---

### 2.3 `POST /api/build/:pk/allocate`

#### Route & URL Parameters
- **Path:** `/api/build/:pk/allocate`
- **Params:** `pk` (integer, required) - Build order primary key.

#### Request Headers & Body Schema
- **Content-Type:** `application/json`
- **Body:**
```typescript
interface AllocateRequest {
  items: Array<{
    build_line: number;  // BuildLine ID (required)
    stock_item: number;  // StockItem ID (required)
    quantity: number;    // Quantity to allocate (required, > 0)
    output?: number;     // StockItem ID (build output) - required for tracked parts, forbidden for untracked
  }>;
}
```

#### Validation Rules
1. Build Order must exist (404).
2. `items` array must be non-empty (400 `"Allocation items must be provided"`).
3. For each item:
   - `build_line`, `stock_item`, `quantity` are required.
   - `quantity > 0` (400 `"Quantity must be greater than zero"`).
   - `build_line.buildId === build.id` (400 `"bom_item.part must point to the same part as the build order"`).
   - `stock_item` must exist and be in stock (400 `"Item must be in stock"`).
   - `stock_item.partId` must match BOM line part, variant, or valid substitute (400 `"Selected stock item does not match BOM line"`).
   - Available unallocated quantity check: `quantity <= stockItem.quantity - currentAllocations` (400 `"Available quantity (<unallocated>) exceeded"`).
   - Tracked part rule: If `bomItem.subPart.trackable == true`, `output` is required (400 `"Build output must be specified for allocation of tracked parts"`).
   - Untracked part rule: If `bomItem.subPart.trackable == false`, `output` must not be specified (400 `"Build output cannot be specified for allocation of untracked parts"`).

#### Execution
- Skip consumable BOM lines (`bomItem.consumable == true`).
- Find existing `Builditem` for `(buildLineId, stockItemId, installIntoId)`.
- If exists, update `quantity += item.quantity`.
- Else create new `Builditem`.

---

### 2.4 `POST /api/build/:pk/unallocate`

#### Route & URL Parameters
- **Path:** `/api/build/:pk/unallocate`
- **Params:** `pk` (integer, required) - Build order primary key.

#### Request Headers & Body Schema
- **Content-Type:** `application/json`
- **Body:**
```typescript
interface UnallocateRequest {
  build_line?: number;  // Optional BuildLine ID filter
  output?: number;      // Optional StockItem ID (build output) filter
}
```

#### Execution
- Delete matching `Builditem` records belonging to this build:
  - If `output` specified: `installIntoId == output`. If omitted: `installIntoId == null`.
  - If `build_line` specified: `buildLineId == build_line`.

---

### 2.5 `POST /api/build/:pk/consume`

#### Route & URL Parameters
- **Path:** `/api/build/:pk/consume`
- **Params:** `pk` (integer, required) - Build order primary key.

#### Request Headers & Body Schema
- **Content-Type:** `application/json`
- **Body:**
```typescript
interface ConsumeRequest {
  items?: Array<{
    build_item: number;  // BuildItem ID (required)
    quantity: number;    // Quantity to consume (required, > 0)
  }>;
  lines?: Array<{
    build_line: number;  // BuildLine ID (required) - consumes all allocations for line
  }>;
  notes?: string;        // Optional notes for consumption tracking
}
```

#### Validation Rules
1. Build Order must exist (404).
2. Either `items` or `lines` must be non-empty (400 `"At least one item or line must be provided"`).
3. For `items`: each `build_item` must belong to build, no duplicates, `0 < quantity <= build_item.quantity`.
4. For `lines`: each `build_line` must belong to build, no duplicates.

#### Execution Algorithm (Atomic Transaction)
1. Consolidate allocations: for each line in `lines`, consume full `build_item.quantity` for all allocations on that line. For each item in `items`, consume requested quantity.
2. For each allocation:
   - Calculate `consumeQty = min(requested, build_item.quantity, stock_item.quantity)`.
   - If `consumeQty < stock_item.quantity`: split stock. Decrement parent, create child with consumed quantity, `consumedById = build.id, locationId = null`. Log `SPLIT_FROM_PARENT` (40) and `SPLIT_CHILD_ITEM` (42).
   - If `consumeQty == stock_item.quantity`: decrement parent to 0, `consumedById = build.id, locationId = null`. If `deleteOnDeplete && canDelete()`, delete parent item.
   - If tracked install (`installIntoId != null`): set child/item `belongsToId = installIntoId`. Log `INSTALLED_INTO_ASSEMBLY` (30) on component and `INSTALLED_CHILD_ITEM` (35) on output assembly.
   - Else: log `BUILD_CONSUMED` (57) on component item.
   - Update `buildline.consumed += consumeQty`.
   - Decrement `builditem.quantity -= consumeQty`. If 0, delete `Builditem`.

---

## 3. Status Codes & Tracking Enums

### Build Status Codes (`BuildStatus`)
- `PENDING = '10'`
- `PRODUCTION = '20'`
- `ON_HOLD = '25'`
- `CANCELLED = '30'`
- `COMPLETE = '40'`

*Note:* In `src/modules/build/build.routes.ts`, `CANCELLED` and `COMPLETE` were inverted in the mock code (`CANCELLED: '40'`, `COMPLETE: '30'`). This must be corrected to match Python InvenTree (`CANCELLED: '30'`, `COMPLETE: '40'`).

### Stock Status Codes (`StockStatus`)
- `OK = '10'`
- `ATTENTION = '50'`
- `DAMAGED = '55'`
- `DESTROYED = '60'`
- `REJECTED = '65'` (used for scrapped build outputs)
- `LOST = '70'`
- `QUARANTINED = '75'`
- `RETURNED = '85'`

### Stock History Tracking Codes (`StockHistoryCode`)
- `CREATED = 1`
- `EDITED = 5`
- `ASSIGNED_SERIAL = 6`
- `STOCK_COUNT = 10`
- `STOCK_ADD = 11`
- `STOCK_REMOVE = 12`
- `STOCK_SERIALIZED = 13`
- `RETURNED_TO_STOCK = 15`
- `STOCK_MOVE = 20`
- `STOCK_UPDATE = 25`
- `INSTALLED_INTO_ASSEMBLY = 30`
- `REMOVED_FROM_ASSEMBLY = 31`
- `INSTALLED_CHILD_ITEM = 35`
- `REMOVED_CHILD_ITEM = 36`
- `SPLIT_FROM_PARENT = 40`
- `SPLIT_CHILD_ITEM = 42`
- `MERGED_STOCK_ITEMS = 45`
- `DISASSEMBLED = 46`
- `CREATED_FROM_DISASSEMBLY = 47`
- `CONVERTED_TO_VARIANT = 48`
- `BUILD_OUTPUT_CREATED = 50`
- `BUILD_OUTPUT_COMPLETED = 55`
- `BUILD_OUTPUT_REJECTED = 56`
- `BUILD_CONSUMED = 57`
- `SHIPPED_AGAINST_SALES_ORDER = 60`
- `RECEIVED_AGAINST_PURCHASE_ORDER = 70`
- `RETURNED_AGAINST_RETURN_ORDER = 80`

---

## 4. Architecture & Service Implementation Plan

1. **`src/modules/build/build.service.ts`**:
   - Implement `scrapBuildOutputs`, `autoAllocateBuild`, `allocateStockToBuild`, `unallocateBuildStock`, `consumeBuildStock`.
   - Implement helper functions: `getValidBomParts`, `getUnallocatedStockQuantity`, `splitStockItem`.
2. **`src/modules/build/build.routes.ts`**:
   - Connect the 5 endpoints to the service functions with proper error handling and status codes.
3. **`src/modules/build/build.service.test.ts`**:
   - Comprehensive test suite covering all 5 operations and edge cases with 100% vitest passing.
