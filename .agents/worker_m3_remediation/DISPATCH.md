# Worker Dispatch: Stock Item Actions & Test Harness Remediation (M3_STOCK)

**Agent**: `worker_m3_remediation`
**Role**: teamwork_preview_worker
**Working Directory**: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m3_remediation`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Write Ownership
You EXCLUSIVELY own and may modify:
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.service.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.service.test.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\test\helpers\mockDb.ts`

## Input Blueprints & Context
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m3_remediation\report.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m3_remediation\handoff.md`

## Instructions
1. Read the blueprint in `.agents/explorer_m3_remediation/report.md` carefully.
2. Implement the parameter normalizations, lifecycle checks, relation fallbacks, and status code alignments in `src/backend/src/modules/stock/stock.routes.ts`, `stock.service.ts`, and `mockDb.ts`:
   - `/api/stock/merge`: Default `location` to target item's `locationId` if not specified, return 200 OK with `{ success: true, ... }`.
   - `/api/stock/return`: Support per-item `location` in `items: [{ pk, location }]`, return 200 OK with `{ success: true, ... }`.
   - `/api/stock/:pk/convert`: Pass through `notes` from body to tracking entry, return 200 OK with `{ success: true, ... }`.
   - `/api/stock/:pk/install`: Support `:pk` as child component and `{ target: assemblyId }` in body, OR `:pk` as assembly and `{ stock_item: componentId }` in body. Return 200 OK with `{ success: true, ... }`.
   - `/api/stock/:pk/uninstall`: Support `quantity` parameter for partial uninstallation of untracked stock, return 200 OK with `{ success: true, ... }`.
   - `/api/stock/:pk/serialize`: Default `destination` to parent item's `locationId` if omitted, return 200 OK with `{ success: true, items: createdItems }`.
   - In `stock.service.ts`: Add fallback part loading (`item.part ?? await prisma.part.findUnique(...)`) so calls work under mockDb without pre-loaded relations.
3. Run the unit and E2E stock tests using your command execution tools:
   ```bash
   npx vitest run src/modules/stock/stock.service.test.ts
   npx vitest run src/test/e2e/tier1_features/tier1_stock_features.test.ts
   npx vitest run src/test/e2e/tier2_boundaries/tier2_stock_boundaries.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_build_stock.test.ts
   npx vitest run src/test/e2e/tier4_realworld/
   ```
4. Write your completion report in `handoff.md` and update `progress.md`.
5. Send completion message to orchestrator_3.
