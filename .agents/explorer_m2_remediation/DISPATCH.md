# Dispatch for explorer_m2_remediation

**Agent**: `explorer_m2_remediation`
**Role**: teamwork_preview_explorer
**Mission**: Investigate Sales, Return, and Transfer Order test failures and parameter discrepancies in `src/backend/src/modules/orders/` and related E2E tests (`src/backend/src/test/`).

## Context Files
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\reviewer_1\handoff.md`

## Instructions
1. Inspect `src/backend/src/modules/orders/sales.routes.ts`, `purchase.routes.ts`, `orders.service.ts`, `orders.service.test.ts`, `orders.test.ts`, and related tests in `src/backend/src/test/`.
2. Analyze all failing tests related to:
   - `/api/order/so/:pk/allocate` (`line_item` vs `line` aliasing)
   - `/api/order/so/:pk/allocate-serials` (`line` vs `line_item`, `serials` vs `serial_numbers`, deriving quantity from serial list)
   - `/api/order/so/:pk/auto-allocate` (sorting, location filters)
   - `/api/order/ro/:pk/hold` (status transitions)
   - `/api/order/ro/:pk/receive` (top-level vs nested `location`, item vs line_item)
   - `/api/order/transfer-order/:pk/issue`
   - `/api/order/transfer-order/:pk/cancel`
   - `/api/order/transfer-order/:pk/complete`
   - `/api/order/transfer-order/:pk/allocate`
3. Propose exact line-by-line / function-by-function fix blueprint in `report.md` and deliver `handoff.md`.
