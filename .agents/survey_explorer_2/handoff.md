# Handoff Report — survey_explorer_2 (R2: Sales, Return, and Transfer Order Operations)

**Timestamp**: 2026-08-18T18:27:00Z  
**Type**: Hard (Task Complete)  
**Agent ID**: `d82d4a0f-5544-4733-9619-96ac42d90c57`  
**Parent Agent**: `parent` (`f65f6a9c-b007-4622-a87a-1a9890a76837`)  

---

## 1. Observation

1. **Current Codebase State**:
   - `src/backend/src/modules/orders/sales.routes.ts`: Action endpoints `/api/order/so/:pk/allocate`, `/api/order/so/:pk/allocate-serials`, `/api/order/so/:pk/auto-allocate`, `/api/order/ro/:pk/hold`, `/api/order/ro/:pk/receive`, `/api/order/transfer-order/:pk/issue`, `/api/order/transfer-order/:pk/cancel`, `/api/order/transfer-order/:pk/complete`, and `/api/order/transfer-order/:pk/allocate` were stubbed to return `(c) => c.json({ success: true })` or empty responses without body validation or database operations.
   - Status code enums in `sales.routes.ts` diverged from the authoritative model (e.g. `SOStatus.IN_PROGRESS` was `20` instead of `15`, `SHIPPED` was `30` instead of `20`, `COMPLETE` was `40` instead of `30`, `CANCELLED` was `50` instead of `40`).

2. **Authoritative Python Reference Implementation**:
   - Status codes: `src/backend_backup/InvenTree/order/status_codes.py` defines `SalesOrderStatus`, `ReturnOrderStatus`, `ReturnOrderLineStatus`, `TransferOrderStatus`, and `src/backend_backup/InvenTree/stock/status_codes.py` defines `StockStatus` and `StockHistoryCode`.
   - Views & API routing: `src/backend_backup/InvenTree/order/api.py` lines 1157-1241 (Sales Order action views), lines 1717-1746 (Return Order views), lines 2000-2040 (Transfer Order views).
   - Serializers: `src/backend_backup/InvenTree/order/serializers.py` lines 1699-2118 (`SalesOrderShipmentAllocationSerializer`, `SalesOrderSerialAllocationSerializer`, `SalesOrderAutoAllocationSerializer`), lines 2216-2345 (`ReturnOrderReceiveSerializer`), lines 2525-3077 (`TransferOrderCompleteSerializer`, `TransferOrderLineItemAllocationSerializer`).
   - Business Logic & Models: `src/backend_backup/InvenTree/order/models.py` lines 1500-1950 (`SalesOrder.auto_allocate_stock()`), lines 3211-3535 (`ReturnOrder.receive_line_item()`), lines 3650-4269 (`TransferOrder.complete_order()`, `TransferOrderAllocation.complete_allocation()`).
   - Test suites: `src/backend_backup/InvenTree/order/test_api.py` lines 2630-3150, 3307-3550, 4174-5005, 5110-5380.

3. **Prisma Models in Target Backend**:
   - `src/backend/prisma/schema.prisma` lines 773-967 and 1313-1377 contain the exact PostgreSQL tables: `salesorder`, `salesorderlineitem`, `salesordershipment`, `salesorderallocation`, `returnorder`, `returnorderlineitem`, `transferorder`, `transferorderlineitem`, `transferorderallocation`, `stockitem`, `stockitemtracking`.

---

## 2. Logic Chain

1. **Sales Order Stock Allocation**:
   - Users allocate inventory to Sales Order lines to fulfill demand before shipping.
   - Validation requires that stock item is `in_stock`, has unallocated capacity $\ge$ requested quantity, matches line part (or is a descendant variant), and is restricted to $1$ unit if serialized.
   - Allocations can be optionally grouped under an unshipped `SalesOrderShipment`.
   - Serial allocation extracts individual serial strings from formatted expressions (ranges `1-5`, lists `1,2,3`, or plus `1+4`), validates each against active inventory, and creates individual 1-unit allocations.
   - Auto-allocation searches candidate stock matching line items, sorts by specified heuristic (FIFO/LIFO/Quantity/Expiry), obeys lot isolation if `interchangeable=false`, and creates allocations greedily.

2. **Return Order Lifecycle & Receiving**:
   - Return Orders start at `PENDING (10)` and move to `IN_PROGRESS (20)` upon issue.
   - While in `PENDING` or `IN_PROGRESS`, they may be placed `ON_HOLD (25)`.
   - When items arrive from the customer, physical receipt is allowed strictly when `status === IN_PROGRESS (20)`.
   - Receiving updates `StockItem` location to destination, clears customer ownership (`customerId = null`), sets status (default `QUARANTINED = 75`), splits bulk stock items if quantity received is less than item quantity, records `StockItemTracking` with `trackingType = 80 (RETURNED_AGAINST_RETURN_ORDER)`, and stamps `receivedDate` on the line item.

3. **Transfer Order Lifecycle & Stock Movement**:
   - Transfer Orders start at `PENDING (10)`, can be placed `ON_HOLD (25)`, and move to `ISSUED (20)` when ready.
   - Allocations against open Transfer Orders reserve available stock without moving it.
   - Cancelling an order automatically cleans up all associated `TransferOrderAllocation` rows.
   - Completing an ISSUED Transfer Order executes the actual inventory movement:
     - If `order.consume === true`, stock quantity is decremented on source items and logged as `STOCK_REMOVE (12)`.
     - Else, if allocation quantity matches item quantity, `stock_item.locationId` is moved directly to `order.destinationId` and logged as `STOCK_MOVE (20)`.
     - If allocation quantity is a partial amount, the item is split to destination and logged as `SPLIT_FROM_PARENT (40)`.
     - Updates `line.transferred += transfer_qty`, updates order status to `COMPLETE (30)`, and sets `completeDate`.

---

## 3. Caveats

1. **Demo / Integrity Mode**:
   - In demo mode, background Celery tasks (e.g. `auto_allocate_sales_order`) are executed synchronously within the request-response cycle and return `{ complete: true, success: true }`.
2. **Plugin Custom Status Keys**:
   - The reference implementation supports custom string status codes via plugins; in standard deployments without custom plugins, standard integer status values are mapped directly.
3. **Out-of-Stock Transfers**:
   - Assumed default configuration `STOCK_ALLOW_OUT_OF_STOCK_TRANSFER = false`, meaning items must be in stock to be transferred.

---

## 4. Conclusion

The specification for R2 (Sales, Return, and Transfer Order Operations) is fully mined, verified against the authoritative Python implementation and test suites, and documented in detail in `report.md`.

All 9 assigned endpoints plus 2 discovered related endpoints (`transfer-order/:pk/allocate-serials` and `transfer-order/:pk/hold`) have explicit payload schemas, validation rules, state machine transitions, concurrency controls, stock splitting/movement rules, and Prisma database mutation blueprints ready for implementation.

---

## 5. Verification Method

1. **Inspect Report Artifact**:
   - View `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md` to review the granular endpoint specifications.
2. **Compare Against Reference Test Suites**:
   - Check test cases in `src/backend_backup/InvenTree/order/test_api.py` lines 2630-3150 (SO allocate), lines 3307-3550 (RO receive), lines 4174-5005 (TO complete & allocate), and lines 5110-5380 (SO auto-allocate).
3. **Verify Target Backend Test Suite**:
   - Run backend tests:
     ```powershell
     cd c:\Companies\BloomBig\saas_applications\InvenTree\src\backend
     npm test
     ```
