## 2026-08-18T18:28:23Z

You are test_writer_stock (archetype: teamwork_preview_test_writer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_stock

Read these authoritative specification files before starting:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\TEST_INFRA.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Write the complete E2E test suite for Stock Item Actions in `src/backend/src/test/e2e/stock_e2e.test.ts`.
Features to test (Features 15-20):
15. Stock Merge (`POST /api/stock/merge`)
16. Stock Return (`POST /api/stock/return`)
17. Stock Convert (`POST /api/stock/:pk/convert`)
18. Stock Install (`POST /api/stock/:pk/install`)
19. Stock Uninstall (`POST /api/stock/:pk/uninstall`)
20. Stock Serialize (`POST /api/stock/:pk/serialize`)

Coverage requirements:
- Tier 1: Feature Coverage (>=5 test cases per feature = >=30 tests)
- Tier 2: Boundary & Corner Cases (>=5 test cases per feature = >=30 tests: e.g., merge <2 items / mismatched status / structural location; serialize duplicate serials / non-trackable; install unavailable / non-BOM; uninstall uninstalled; convert invalid variant)
- Tier 3: Cross-Feature Combinations (Pairwise workflows: e.g. Serialize bulk stock -> Convert variant -> Install into assembly -> Uninstall -> Merge back into stock)

Test framework:
- Vitest (`npm test` in `src/backend`).
- Write high-quality, comprehensive tests mocking prisma appropriately or using Hono app test harness (`stockRouter` / `app.request`).
- Ensure all tests run and pass cleanly with `npm test`.

When done:
1. Run `npm test` to verify.
2. Write your handoff report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_stock\handoff.md`.
3. Send a message to parent with completion summary.
