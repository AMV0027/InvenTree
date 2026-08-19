# BRIEFING — 2026-08-18T18:28:35Z

## Mission
Write comprehensive E2E test suite for Sales, Return, and Transfer Order Operations in `src/backend/src/test/e2e/orders_e2e.test.ts` covering Features 6-14 with Tier 1, Tier 2, and Tier 3 tests.

## 🔒 My Identity
- Archetype: teamwork_preview_test_writer
- Roles: specialist, qa
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_orders
- Original parent: 431d878d-9481-4914-8b2b-363221614830
- Milestone: E2E Orders Test Suite (Features 6-14)

## 🔒 Key Constraints
- Test code only — never modify implementation code.
- Write tests in `src/backend/src/test/e2e/orders_e2e.test.ts`.
- Coverage requirements:
  - Tier 1: Feature Coverage (>=5 test cases per feature = >=45 tests)
  - Tier 2: Boundary & Corner Cases (>=5 test cases per feature = >=45 tests)
  - Tier 3: Cross-Feature Combinations (Pairwise workflows)
  - Total tests >= 100 tests.
- Vitest (`npm test` in `src/backend`).
- Must pass cleanly.

## Current Parent
- Conversation ID: 431d878d-9481-4914-8b2b-363221614830
- Updated: 2026-08-18T18:28:35Z

## Task Summary
- **What to build**: Comprehensive Vitest E2E tests for features 6-14:
  6. Sales Order Allocate (`POST /api/order/so/:pk/allocate`)
  7. Sales Order Allocate Serials (`POST /api/order/so/:pk/allocate-serials`)
  8. Sales Order Auto-Allocate (`POST /api/order/so/:pk/auto-allocate`)
  9. Return Order Hold (`POST /api/order/ro/:pk/hold`)
  10. Return Order Receive (`POST /api/order/ro/:pk/receive`)
  11. Transfer Order Issue (`POST /api/order/transfer-order/:pk/issue`)
  12. Transfer Order Cancel (`POST /api/order/transfer-order/:pk/cancel`)
  13. Transfer Order Complete (`POST /api/order/transfer-order/:pk/complete`)
  14. Transfer Order Allocate (`POST /api/order/transfer-order/:pk/allocate`)
- **Success criteria**: All tests execute and pass cleanly via `npm test` in `src/backend`.
- **Interface contracts**: `PROJECT.md`, `TEST_INFRA.md`, `.agents/ORIGINAL_REQUEST.md`, `.agents/survey_explorer_2/report.md`.

## Loaded Skills
- None specified in dispatch.

## Quality Status
- **Build/test result**: Initial state - pending inspection
- **Lint status**: Pending
- **Tests added/modified**: `src/backend/src/test/e2e/orders_e2e.test.ts` (to be created)

## Key Decisions Made
- [Initial] Follow existing backend E2E / integration test structure using Prisma mocking / Hono request test harness.

## Artifact Index
- `src/backend/src/test/e2e/orders_e2e.test.ts` — E2E test file for Features 6-14
- `.agents/test_writer_orders/handoff.md` — Final handoff report
