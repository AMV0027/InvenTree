## 2026-08-18T18:28:22Z
You are test_writer_orders (archetype: teamwork_preview_test_writer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_orders

Read these authoritative specification files before starting:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\TEST_INFRA.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Write the complete E2E test suite for Sales, Return, and Transfer Order Operations in `src/backend/src/test/e2e/orders_e2e.test.ts`.
Features to test (Features 6-14):
6. Sales Order Allocate (`POST /api/order/so/:pk/allocate`)
7. Sales Order Allocate Serials (`POST /api/order/so/:pk/allocate-serials`)
8. Sales Order Auto-Allocate (`POST /api/order/so/:pk/auto-allocate`)
9. Return Order Hold (`POST /api/order/ro/:pk/hold`)
10. Return Order Receive (`POST /api/order/ro/:pk/receive`)
11. Transfer Order Issue (`POST /api/order/transfer-order/:pk/issue`)
12. Transfer Order Cancel (`POST /api/order/transfer-order/:pk/cancel`)
13. Transfer Order Complete (`POST /api/order/transfer-order/:pk/complete`)
14. Transfer Order Allocate (`POST /api/order/transfer-order/:pk/allocate`)

Coverage requirements:
- Tier 1: Feature Coverage (>=5 test cases per feature = >=45 tests)
- Tier 2: Boundary & Corner Cases (>=5 test cases per feature = >=45 tests)
- Tier 3: Cross-Feature Combinations (Pairwise workflows: e.g. SO auto-allocate -> serial allocate -> shipment assignment; TO issue -> allocate -> complete with stock move vs consume; RO hold -> receive with stock split)

Test framework:
- Vitest (`npm test` in `src/backend`).
- Write high-quality, comprehensive tests mocking prisma appropriately or using Hono app test harness (`salesRouter`, `returnRouter`, `transferRouter` / `app.request`).
- Ensure all tests run and pass cleanly with `npm test`.

When done:
1. Run `npm test` to verify.
2. Write your handoff report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_orders\handoff.md`.
3. Send a message to parent with completion summary.
