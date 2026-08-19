# Project: InvenTree Node.js Hono Backend Migration

## Architecture
- **Framework**: Node.js, Hono, TypeScript, Prisma ORM, PostgreSQL / SQLite (test db)
- **Root Directory**: `src/backend`
- **Module Boundaries**:
  - `src/backend/src/modules/build/`: Build Order business logic and routes (`build.service.ts`, `build.routes.ts`, `build.service.test.ts`)
  - `src/backend/src/modules/orders/`: Sales, Return, Purchase, and Transfer Order business logic and routes (`sales.routes.ts`, `purchase.routes.ts`, `order.service.ts`, `orders.test.ts`)
  - `src/backend/src/modules/stock/`: Stock item operations (`stock.service.ts`, `stock.routes.ts`, `stock.service.test.ts`)
  - `src/backend/src/test/`: Global test helpers, mocks, test harnesses
- **Data Flow**:
  - HTTP Request -> Hono Route Handler -> Validation & Business Service -> Prisma Transaction -> DB Mutation & Stock Tracking History Logs -> JSON Response.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Build Scrap Outputs (`/api/build/:pk/scrap-outputs`) | Scrap specified build outputs, mark REJECTED (65), split partial stock, log tracking (56), handle allocations | M1_BUILD | survey_explorer_1 |
| 2 | Build Auto-Allocate (`/api/build/:pk/auto-allocate`) | Auto-allocate available component stock against build lines via BOM data, supporting filters & priority sorting | M1_BUILD | survey_explorer_1 |
| 3 | Build Allocate (`/api/build/:pk/allocate`) | Manually allocate specific stock items to build lines with defined quantities & optional output tracking | M1_BUILD | survey_explorer_1 |
| 4 | Build Unallocate (`/api/build/:pk/unallocate`) | Deallocate stock items from build lines and/or specific build outputs | M1_BUILD | survey_explorer_1 |
| 5 | Build Consume (`/api/build/:pk/consume`) | Consume allocated stock items, decrement stock quantity, handle `deleteOnDeplete`, update `belongsToId`, log tracking (57/30/35/40) | M1_BUILD | survey_explorer_1 |
| 6 | Sales Order Allocate (`/api/order/so/:pk/allocate`) | Allocate stock items to sales order lines, checking line ownership, variant compatibility, and availability | M2_ORDERS | survey_explorer_2 |
| 7 | Sales Order Allocate Serials (`/api/order/so/:pk/allocate-serials`) | Parse serial expressions (ranges, lists) and allocate specific serialized stock items to SO lines | M2_ORDERS | survey_explorer_2 |
| 8 | Sales Order Auto-Allocate (`/api/order/so/:pk/auto-allocate`) | Auto-allocate matching stock items to unallocated SO lines by strategy (FIFO, LIFO, Quantity, Expiry) | M2_ORDERS | survey_explorer_2 |
| 9 | Return Order Hold (`/api/order/ro/:pk/hold`) | Place Return Order on hold (`status = ON_HOLD (25)`) from PENDING or IN_PROGRESS | M2_ORDERS | survey_explorer_2 |
| 10 | Return Order Receive (`/api/order/ro/:pk/receive`) | Receive items against Return Order when IN_PROGRESS, move location, reset customerId, set QUARANTINED, log tracking (80) | M2_ORDERS | survey_explorer_2 |
| 11 | Transfer Order Issue (`/api/order/transfer-order/:pk/issue`) | Issue Transfer Order (`status = ISSUED (20)`), stamp `issueDate` | M2_ORDERS | survey_explorer_2 |
| 12 | Transfer Order Cancel (`/api/order/transfer-order/:pk/cancel`) | Cancel Transfer Order (`status = CANCELLED (40)`), atomically delete all attached allocations | M2_ORDERS | survey_explorer_2 |
| 13 | Transfer Order Complete (`/api/order/transfer-order/:pk/complete`) | Complete Transfer Order (`status = COMPLETE (30)`), move or split stock to destination or consume stock, log tracking (20/40/12) | M2_ORDERS | survey_explorer_2 |
| 14 | Transfer Order Allocate (`/api/order/transfer-order/:pk/allocate`) | Allocate available unreserved stock to Transfer Order line items | M2_ORDERS | survey_explorer_2 |
| 15 | Stock Merge (`/api/stock/merge`) | Merge >=2 compatible stock items into target item, sum quantities, move allocations, compute weighted price, log tracking (45), delete merged items | M3_STOCK | survey_explorer_3 |
| 16 | Stock Return (`/api/stock/return`) | Return stock items to active inventory, clear customer/consumed/belongs_to, log tracking (15), handle partial split | M3_STOCK | survey_explorer_3 |
| 17 | Stock Convert (`/api/stock/:pk/convert`) | Convert stock item to valid variant part in family tree (descendant/parent/sibling), validate non-virtual & active, log tracking (48) | M3_STOCK | survey_explorer_3 |
| 18 | Stock Install (`/api/stock/:pk/install`) | Install component item into assembly item, validate BOM membership, set `belongsToId`, clear location, log tracking (30, 35) | M3_STOCK | survey_explorer_3 |
| 19 | Stock Uninstall (`/api/stock/:pk/uninstall`) | Uninstall component item from assembly into specified location, set `belongsToId = null`, log tracking (31, 36) | M3_STOCK | survey_explorer_3 |
| 20 | Stock Serialize (`/api/stock/:pk/serialize`) | Split bulk stock item into individual serialized single-quantity items with parsed serial numbers, copy test results, log tracking (40, 6, 13) | M3_STOCK | survey_explorer_3 |
| 21 | E2E & Unit Test Infrastructure | Comprehensive test harness covering Tiers 1-4 (Features, Boundaries, Combinations, Real-World) and full test runner | M_TEST_TRACK | survey_explorer_3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M_TEST_TRACK | E2E Testing Track | Test harness, Tiers 1-4 tests for all 20 features, `TEST_READY.md` | none | DONE |
| M1_BUILD | Build Order Operations (R1) | Features 1-5 in `build.service.ts` & `build.routes.ts` + unit tests | none | DONE |
| M2_ORDERS | Sales, Return, Transfer Orders (R2) | Features 6-14 in `sales.routes.ts`, `purchase.routes.ts`, `orders.service.ts` + unit tests | none | DONE |
| M3_STOCK | Stock Item Actions (R3) | Features 15-20 in `stock.service.ts` & `stock.routes.ts` + unit tests | none | DONE |
| M_FINAL | Full Verification & Hardening | 100% pass on all test suites, Tier 5 adversarial coverage hardening, and Forensic Integrity Audit | M_TEST_TRACK, M1_BUILD, M2_ORDERS, M3_STOCK | DONE |

## Code Layout
- `src/backend/src/modules/build/build.routes.ts`: Build HTTP routing and input handling
- `src/backend/src/modules/build/build.service.ts`: Build business logic (scrap, allocate, auto-allocate, unallocate, consume)
- `src/backend/src/modules/build/build.service.test.ts`: Build order unit tests
- `src/backend/src/modules/orders/sales.routes.ts`: Sales, Return, Transfer HTTP routing
- `src/backend/src/modules/orders/purchase.routes.ts`: Purchase order routes
- `src/backend/src/modules/orders/orders.service.ts`: Orders business logic (allocations, serials, auto-allocation, RO receive, TO lifecycle)
- `src/backend/src/modules/orders/orders.service.test.ts`: Order operations unit tests
- `src/backend/src/modules/stock/stock.routes.ts`: Stock actions HTTP routing
- `src/backend/src/modules/stock/stock.service.ts`: Stock actions business logic (merge, return, convert, install, uninstall, serialize)
- `src/backend/src/modules/stock/stock.service.test.ts`: Stock actions unit tests
- `src/backend/src/test/`: Comprehensive E2E test suite (Tiers 1-5)

## Interface Contracts
### Build ↔ Stock
- `scrapOutputs`: Updates `Stockitem` status to 65 (REJECTED), location to scrap destination, logs `Stockitemtracking` (56).
- `consume`: Decrements `Stockitem.quantity`. If quantity reaches 0 and `deleteOnDeplete === true`, deletes `Stockitem`. If trackable, sets `belongsToId = build.partId` or installInto target.

### Orders ↔ Stock
- `salesOrderAllocate`: Creates `Salesorderallocation` linking `salesorderLineId` to `stockItemId`.
- `returnOrderReceive`: Updates `Stockitem.locationId`, clears `customerId = null`, sets `status = 75 (QUARANTINED)`, logs `Stockitemtracking` (80).
- `transferOrderComplete`: Updates `Stockitem.locationId` to `transferOrder.destinationId` or decrements quantity if `consume === true`.

### Stock Actions Integrity
- `merge`: Combines items with identical part & status, sums quantity, migrates `Builditem`/`Salesorderallocation`/`Transferorderallocation` foreign keys, deletes source items.
- `serialize`: Decrements parent quantity by N (or deletes if depleted), creates N distinct `Stockitem` rows with quantity=1, status=parent.status, locationId=parent.locationId, serial=serialNumbers[i].
