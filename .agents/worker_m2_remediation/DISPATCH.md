# Worker Dispatch: Orders Operations Remediation (M2_ORDERS)

**Agent**: `worker_m2_remediation`
**Role**: teamwork_preview_worker
**Working Directory**: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m2_remediation`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Write Ownership
You EXCLUSIVELY own and may modify:
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\sales.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\purchase.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\orders.service.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\orders.service.test.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\orders.test.ts`

## Input Blueprints & Context
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m2_remediation\report.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m2_remediation\handoff.md`

## Instructions
1. Read the blueprint in `.agents/explorer_m2_remediation/report.md` carefully.
2. Implement the parameter normalizations, lifecycle checks, auto-derived quantities, and status code alignments in `src/backend/src/modules/orders/sales.routes.ts` and `orders.service.ts`:
   - `/api/order/so/:pk/allocate`: Support `line` alias for `line_item`, return 200 OK.
   - `/api/order/so/:pk/allocate-serials`: Support `line` alias for `line_item`, `serials` alias for `serial_numbers`, auto-derive `quantity` from serial count when omitted, return 200 OK.
   - `/api/order/so/:pk/auto-allocate`: Support `strategy` alias for `stock_sort_by`, return 200 OK.
   - `/api/order/ro/:pk/hold`: Return 200 OK.
   - `/api/order/ro/:pk/receive`: Support per-item `location` in `items` array, support `line_item` alias for `item`, fallback to stock location, return 200 OK.
   - `/api/order/transfer-order/:pk/issue`: Stamp `issueDate: new Date()`, return 200 OK.
   - `/api/order/transfer-order/:pk/cancel`: Allow idempotent cancellation (200 OK when already CANCELLED), return 200 OK.
   - `/api/order/transfer-order/:pk/complete`: Handle omitted `destinationId` gracefully when completing, return 200 OK.
   - `/api/order/transfer-order/:pk/allocate`: Support `line` alias for `line_item`, support `serials` alias for serial allocation, return 200 OK.
3. Run the unit and E2E orders tests using your command execution tools:
   ```bash
   npx vitest run src/modules/orders/orders.service.test.ts
   npx vitest run src/test/e2e/tier1_features/tier1_orders_features.test.ts
   npx vitest run src/test/e2e/tier2_boundaries/tier2_orders_boundaries.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_orders_stock.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_cross_subsystem.test.ts
   ```
4. Write your completion report in `handoff.md` and update `progress.md`.
5. Send completion message to orchestrator_3.
