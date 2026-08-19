## 2026-08-18T18:28:22Z

You are test_writer_build (archetype: teamwork_preview_test_writer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_build

Read these authoritative specification files before starting:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\TEST_INFRA.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Write the complete E2E test suite for Build Order Operations in `src/backend/src/test/e2e/build_e2e.test.ts`.
Features to test (Features 1-5):
1. Build Scrap Outputs (`POST /api/build/:pk/scrap-outputs`)
2. Build Auto-Allocate (`POST /api/build/:pk/auto-allocate`)
3. Build Allocate (`POST /api/build/:pk/allocate`)
4. Build Unallocate (`POST /api/build/:pk/unallocate`)
5. Build Consume (`POST /api/build/:pk/consume`)

Coverage requirements:
- Tier 1: Feature Coverage (>=5 test cases per feature covering happy paths, required params, default behavior)
- Tier 2: Boundary & Corner Cases (>=5 test cases per feature covering 400 bad requests, 404 missing builds, invalid quantities, unavailable stock, consumable bypass, duplicate allocations, partial split handling)
- Tier 3: Cross-Feature Combinations (Pairwise workflows: e.g., Auto-allocate -> Manual Allocate -> Partial Unallocate -> Consume -> Scrap remaining output)

Test framework:
- Vitest (`npm test` in `src/backend`).
- Write high-quality, comprehensive tests mocking prisma appropriately or using Hono app test harness (`buildRouter` / `app.request`).
- Ensure all tests run and pass cleanly with `npm test`.

When done:
1. Run `npm test` to verify.
2. Write your handoff report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_build\handoff.md`.
3. Send a message to parent with completion summary.
