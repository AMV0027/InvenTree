## 2026-08-19T06:16:55Z
You are worker_m3_1.
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m3_1
Your parent is orchestrator_2 (conversation ID: 17801032-4a37-4c2d-886d-4412fee2b486).

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Context & References to Read First:
1. `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md` (MANDATORY)
2. `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
3. `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md` (Contains full specification and Python reference behaviors for Stock Actions)
4. Existing files in `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\`

### Assigned Mission:
Implement the complete, genuine business logic for Milestone M3 (Requirement R3: Stock Item Actions) in:
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.service.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\stock\stock.service.test.ts` (or relevant unit test files)

Endpoints and Operations to implement:
1. `/api/stock/merge`: Merge multiple compatible stock items into target item, sum quantities, move allocations, compute weighted purchase price, log tracking (45 STOCK_MERGED), delete source items.
2. `/api/stock/return`: Return stock items to active inventory from customer/consumed/belongs_to, log tracking (15 STOCK_RETURNED), handle partial splits.
3. `/api/stock/:pk/convert`: Convert stock item to valid variant part in family tree (descendant/parent/sibling), validate non-virtual & active, log tracking (48 STOCK_CONVERTED).
4. `/api/stock/:pk/install`: Install component item into assembly item, validate BOM membership, set `belongsToId`, clear location, log tracking (30/35).
5. `/api/stock/:pk/uninstall`: Uninstall component item from assembly into specified location, set `belongsToId = null`, log tracking (31/36).
6. `/api/stock/:pk/serialize`: Serialize a bulk stock item into individual serialized single-quantity items with parsed serial numbers, copy test results, log tracking (40/6/13).

### Exclusive Write Boundaries:
You ONLY modify files in `src/backend/src/modules/stock/`. Do NOT touch files in other modules.

### Verification:
Run test commands (e.g. `npx vitest run src/modules/stock` or `npm test`) inside `src/backend` to verify all unit tests pass with 0 errors.

Write your final report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m3_1\handoff.md` and send a message back to parent with the summary and test results.
