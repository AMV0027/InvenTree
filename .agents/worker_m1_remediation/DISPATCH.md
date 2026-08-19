# Worker Dispatch: Build Order Operations Remediation (M1_BUILD)

**Agent**: `worker_m1_remediation`
**Role**: teamwork_preview_worker
**Working Directory**: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\worker_m1_remediation`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Write Ownership
You EXCLUSIVELY own and may modify:
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\build\build.routes.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\build\build.service.ts`
- `c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\src\modules\build\build.service.test.ts`

## Input Blueprints & Context
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m1_remediation\report.md`
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m1_remediation\handoff.md`

## Instructions
1. Read the blueprint in `.agents/explorer_m1_remediation/report.md` carefully.
2. Implement the parameter normalizations, lifecycle checks, default values, and status code alignments in `src/backend/src/modules/build/build.routes.ts` and `build.service.ts`:
   - `/scrap-outputs`: Support nested `location`/`notes` in `outputs` array items, default notes, validate non-completed/non-cancelled build order status.
   - `/auto-allocate`: Default `interchangeable` to `true` to allow multi-batch allocation, support `allow_substitutes` alias, reject cancelled builds (400).
   - `/allocate`: Support `install_into` alias for `output`, allow trackable parts allocation without output if general allocation, reject quarantined/rejected stock.
   - `/unallocate`: Support `{ items: [...] }` array with both IDs and `{ build_item, quantity }` objects (partial unallocation), unallocate items with output assigned when build-level unallocation is requested, reject completed builds (400).
   - `/consume`: When body is `{}` or contains only `notes`, consume all outstanding build allocations for this build, reject PENDING builds (400), gracefully return 200 on 0 allocations.
   - Align HTTP status codes to 200 OK where appropriate.
3. Run the unit and E2E build tests using your command execution tools:
   ```bash
   npx vitest run src/modules/build/build.service.test.ts
   npx vitest run src/test/e2e/tier1_features/tier1_build_features.test.ts
   npx vitest run src/test/e2e/tier2_boundaries/tier2_build_boundaries.test.ts
   npx vitest run src/test/e2e/tier3_interactions/tier3_build_stock.test.ts
   npx vitest run src/test/e2e/tier4_realworld/scenario1_manufacturing_lifecycle.test.ts
   ```
4. Write your completion report in `handoff.md` and update `progress.md`.
5. Send completion message to orchestrator_3.
