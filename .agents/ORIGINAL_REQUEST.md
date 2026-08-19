# Original User Request

## 2026-08-18T18:14:23Z

Replace the pseudo/mocked API endpoints in the Node.js Hono backend with the expected business logic, matching the behaviors found in the backup Python InvenTree implementation.

Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\src\backend
Integrity mode: demo

## Requirements

### R1. Build Order Operations
Implement the complete business logic for Build Order actions in `src/modules/build/build.routes.ts` and `src/modules/build/build.service.ts`:
- `/api/build/:pk/scrap-outputs`: Scrap specified build outputs, update stock, log tracking.
- `/api/build/:pk/auto-allocate`: Automatically allocate stock items against build lines according to the BOM.
- `/api/build/:pk/allocate`: Manually allocate specific stock items to build lines with defined quantities.
- `/api/build/:pk/unallocate`: Unallocate stock items from the build order.
- `/api/build/:pk/consume`: Consume allocated stock items, updating stock levels and finishing the build outputs.

### R2. Sales, Return, and Transfer Order Operations
Implement the complete business logic in `src/modules/orders/sales.routes.ts` and `src/modules/orders/purchase.routes.ts`:
- `/api/order/so/:pk/allocate`: Allocate stock items to sales order lines.
- `/api/order/so/:pk/allocate-serials`: Allocate specific serialized stock items.
- `/api/order/so/:pk/auto-allocate`: Automatically allocate stock items to sales order lines.
- `/api/order/ro/:pk/hold`: Put a return order on hold.
- `/api/order/ro/:pk/receive`: Receive stock items against a return order.
- `/api/order/transfer-order/:pk/issue`: Issue transfer order.
- `/api/order/transfer-order/:pk/cancel`: Cancel transfer order.
- `/api/order/transfer-order/:pk/complete`: Complete transfer order and move stock.
- `/api/order/transfer-order/:pk/allocate`: Allocate stock to transfer order.

### R3. Stock Item Actions
Implement the complete business logic in `src/modules/stock/stock.routes.ts`:
- `/api/stock/merge`: Merge multiple stock items into a single stock item.
- `/api/stock/return`: Return stock item.
- `/api/stock/:pk/convert`: Convert a stock item to another part.
- `/api/stock/:pk/install`: Install a stock item into another assembly.
- `/api/stock/:pk/uninstall`: Uninstall a stock item from an assembly.
- `/api/stock/:pk/serialize`: Serialize a bulk stock item into individual serialized items.

## Acceptance Criteria

### Build & Order Logic
- [ ] Build allocations and auto-allocations correctly associate stock items with build lines using BOM data.
- [ ] Build stock consumption correctly decrements stock quantities, handles `deleteOnDeplete`, and logs transaction tracking history.
- [ ] Sales, return, and transfer order endpoints modify the statuses and move stock locations correctly in the database.
- [ ] Stock actions (merge, convert, install, uninstall, serialize) successfully update the database rows and integrity.

### Verification
- [ ] All new and existing vitest unit tests in `src/backend` pass.

## 2026-08-19T07:04:33Z

# Teamwork Project Prompt — Draft

> Status: Step 9 — Ready for launch — awaiting user approval
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team to fix all modules in parallel

Fix the remaining test failures (currently ~185 failing tests) in the Node.js Hono backend by correcting the business logic in the recently implemented endpoints, ensuring they exactly match the behaviors found in the backup Python InvenTree implementation.

Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\src\backend
Integrity mode: demo

## Requirements

### R1. Fix Build Order Operations
Debug and fix the business logic for Build Order actions in `src/modules/build/build.routes.ts` and `src/modules/build/build.service.ts`:
- `/api/build/:pk/scrap-outputs`
- `/api/build/:pk/auto-allocate`
- `/api/build/:pk/allocate`
- `/api/build/:pk/unallocate`
- `/api/build/:pk/consume`

### R2. Fix Sales, Return, and Transfer Order Operations
Debug and fix the business logic in `src/modules/orders/sales.routes.ts` and `src/modules/orders/purchase.routes.ts`:
- `/api/order/so/:pk/allocate`
- `/api/order/so/:pk/allocate-serials`
- `/api/order/so/:pk/auto-allocate`
- `/api/order/ro/:pk/hold`
- `/api/order/ro/:pk/receive`
- `/api/order/transfer-order/:pk/issue`
- `/api/order/transfer-order/:pk/cancel`
- `/api/order/transfer-order/:pk/complete`
- `/api/order/transfer-order/:pk/allocate`

### R3. Fix Stock Item Actions
Debug and fix the business logic in `src/modules/stock/stock.routes.ts`:
- `/api/stock/merge`
- `/api/stock/return`
- `/api/stock/:pk/convert`
- `/api/stock/:pk/install`
- `/api/stock/:pk/uninstall`
- `/api/stock/:pk/serialize`

## Acceptance Criteria

### Build & Order Logic
- [ ] Build allocations and auto-allocations correctly associate stock items with build lines using BOM data.
- [ ] Build stock consumption correctly decrements stock quantities, handles `deleteOnDeplete`, and logs transaction tracking history.
- [ ] Sales, return, and transfer order endpoints modify the statuses and move stock locations correctly in the database.
- [ ] Stock actions (merge, convert, install, uninstall, serialize) successfully update the database rows and integrity.

### Verification
- [ ] All new and existing vitest unit tests in `src/backend` pass.
