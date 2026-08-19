# Dispatch for explorer_m3_remediation

**Agent**: `explorer_m3_remediation`
**Role**: teamwork_preview_explorer
**Mission**: Investigate Stock Item Actions & Test Harness failures in `src/backend/src/modules/stock/` and `src/backend/src/test/`.

## Context Files
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\reviewer_1\handoff.md`

## Instructions
1. Inspect `src/backend/src/modules/stock/stock.routes.ts`, `stock.service.ts`, `stock.service.test.ts`, and `src/backend/src/test/`.
2. Analyze all failing tests related to:
   - `/api/stock/merge` (location parameter requirements, target vs items)
   - `/api/stock/return` (top-level vs nested location)
   - `/api/stock/:pk/convert`
   - `/api/stock/:pk/install` (assembly vs child `pk` direction, `stock_item` vs `target` aliasing)
   - `/api/stock/:pk/uninstall`
   - `/api/stock/:pk/serialize` (quantity derivation from serial expressions)
   - Global test harness / mockDb / testApp configuration if applicable.
3. Propose exact line-by-line / function-by-function fix blueprint in `report.md` and deliver `handoff.md`.

## 2026-08-19T07:07:08Z
Received invocation:
Investigate all failing tests in `src/backend` related to Stock Item Actions (Requirement R3) & Test Harness:
- `/api/stock/merge` (location parameter requirements, target vs items)
- `/api/stock/return` (top-level vs nested location)
- `/api/stock/:pk/convert`
- `/api/stock/:pk/install` (assembly vs child `pk` direction, `stock_item` vs `target` aliasing)
- `/api/stock/:pk/uninstall`
- `/api/stock/:pk/serialize` (quantity derivation from serial expressions)
- Global test harness / mockDb / testApp configuration if applicable.

