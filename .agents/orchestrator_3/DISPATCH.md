# Orchestrator Dispatch Log

## 2026-08-19T07:05:35Z
You are orchestrator_3, the Project Orchestrator.
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\orchestrator_3
Your task is defined in: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md

Mission:
Fix the remaining test failures (currently ~185 failing tests) in the Node.js Hono backend (`src/backend`) by correcting the business logic in the recently implemented endpoints, ensuring they exactly match the behaviors found in the backup Python InvenTree implementation.

Key Requirements:
1. Build Order Operations (`src/modules/build/build.routes.ts`, `src/modules/build/build.service.ts`):
   - `/api/build/:pk/scrap-outputs`
   - `/api/build/:pk/auto-allocate`
   - `/api/build/:pk/allocate`
   - `/api/build/:pk/unallocate`
   - `/api/build/:pk/consume`
2. Sales, Return, and Transfer Order Operations (`src/modules/orders/sales.routes.ts`, `src/modules/orders/purchase.routes.ts`):
   - `/api/order/so/:pk/allocate`
   - `/api/order/so/:pk/allocate-serials`
   - `/api/order/so/:pk/auto-allocate`
   - `/api/order/ro/:pk/hold`
   - `/api/order/ro/:pk/receive`
   - `/api/order/transfer-order/:pk/issue`
   - `/api/order/transfer-order/:pk/cancel`
   - `/api/order/transfer-order/:pk/complete`
   - `/api/order/transfer-order/:pk/allocate`
3. Stock Item Actions (`src/modules/stock/stock.routes.ts`):
   - `/api/stock/merge`
   - `/api/stock/return`
   - `/api/stock/:pk/convert`
   - `/api/stock/:pk/install`
   - `/api/stock/:pk/uninstall`
   - `/api/stock/:pk/serialize`

Acceptance Criteria:
- All new and existing vitest unit tests in `src/backend` pass.
- Build & Order logic correctly handles BOM association, status transitions, stock location moves, and consumption/depletion.
- Stock actions correctly update database rows and integrity.
