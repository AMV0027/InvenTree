## 2026-08-19T06:16:55Z

You are worker_m2_1.
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m2_1
Your parent is orchestrator_2 (conversation ID: 17801032-4a37-4c2d-886d-4412fee2b486).

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Context & References to Read First:
1. `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md` (MANDATORY)
2. `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
3. `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md` (Contains full specification and Python reference behaviors for Sales, Return, and Transfer Orders)
4. Existing files in `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\`

### Assigned Mission:
Implement the complete, genuine business logic for Milestone M2 (Requirement R2: Sales, Return, and Transfer Order Operations) in:
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\sales.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\purchase.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\order.service.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\orders\orders.test.ts` (or relevant unit test files)

Endpoints and Operations to implement:
1. Sales Orders:
   - `/api/order/so/:pk/allocate`: Allocate available stock items to sales order lines.
   - `/api/order/so/:pk/allocate-serials`: Parse serial expressions (ranges, lists) and allocate specific serialized stock items.
   - `/api/order/so/:pk/auto-allocate`: Automatically allocate stock items to SO lines based on strategy (FIFO, LIFO, Quantity, Expiry).
2. Return Orders:
   - `/api/order/ro/:pk/hold`: Place Return Order on hold (`status = ON_HOLD (25)`).
   - `/api/order/ro/:pk/receive`: Receive items against Return Order, update location, reset customerId, set QUARANTINED (75), log tracking (80).
3. Transfer Orders:
   - `/api/order/transfer-order/:pk/allocate`: Allocate available unreserved stock to Transfer Order lines.
   - `/api/order/transfer-order/:pk/issue`: Issue Transfer Order (`status = ISSUED (20)`), stamp `issueDate`.
   - `/api/order/transfer-order/:pk/cancel`: Cancel Transfer Order (`status = CANCELLED (40)`), atomically delete all attached allocations.
   - `/api/order/transfer-order/:pk/complete`: Complete Transfer Order (`status = COMPLETE (30)`), move or split stock to destination or consume stock, log tracking.

### Exclusive Write Boundaries:
You ONLY modify files in `src/backend/src/modules/orders/`. Do NOT touch files in other modules.

### Verification:
Run test commands (e.g. `npx vitest run src/modules/orders` or `npm test`) inside `src/backend` to verify all unit tests pass with 0 errors.

Write your final report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m2_1\handoff.md` and send a message back to parent with the summary and test results.
