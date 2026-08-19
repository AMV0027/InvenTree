# BRIEFING — 2026-08-18T18:30:00Z

## Mission
Write the complete E2E test suite for Stock Item Actions (Features 15-20: Merge, Return, Convert, Install, Uninstall, Serialize) in `src/backend/src/test/e2e/stock_e2e.test.ts`.

## 🔒 My Identity
- Archetype: teamwork_preview_test_writer
- Roles: specialist, qa
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_stock
- Original parent: 431d878d-9481-4914-8b2b-363221614830
- Milestone: E2E Test Suite - Stock Actions (Features 15-20)

## 🔒 Key Constraints
- Test code only — never modify implementation code. Escalate implementation bugs.
- Must cover Features 15-20:
  - 15: Stock Merge (POST /api/stock/merge)
  - 16: Stock Return (POST /api/stock/return)
  - 17: Stock Convert (POST /api/stock/:pk/convert)
  - 18: Stock Install (POST /api/stock/:pk/install)
  - 19: Stock Uninstall (POST /api/stock/:pk/uninstall)
  - 20: Stock Serialize (POST /api/stock/:pk/serialize)
- Tier 1: Feature Coverage (>=5 test cases per feature = >=30 tests)
- Tier 2: Boundary & Corner Cases (>=5 test cases per feature = >=30 tests)
- Tier 3: Cross-Feature Combinations (Pairwise workflows)
- Test framework: Vitest in `src/backend` (`npm test`)
- Mock prisma / use Hono app test harness (`stockRouter` / `app.request`)

## Current Parent
- Conversation ID: 431d878d-9481-4914-8b2b-363221614830
- Updated: not yet

## Task Summary
- **What to build**: Comprehensive Vitest E2E test suite in `src/backend/src/test/e2e/stock_e2e.test.ts` for Stock actions.
- **Success criteria**: All tests pass cleanly with `npm test`, covering >=30 tier 1, >=30 tier 2, plus tier 3 tests.
- **Interface contracts**: PROJECT.md, ORIGINAL_REQUEST.md, survey_explorer_3 report
- **Code layout**: `src/backend/src/test/e2e/stock_e2e.test.ts`

## Loaded Skills
- None

## Quality Status
- **Build/test result**: Not run yet
- **Lint status**: Clean
- **Tests added/modified**: `src/backend/src/test/e2e/stock_e2e.test.ts` [TBD]

## Key Decisions Made
- Use Vitest and Hono test harness (`app.request` with auth header and mock/real prisma context or following existing test patterns in `src/backend/src/test`).

## Artifact Index
- `src/backend/src/test/e2e/stock_e2e.test.ts` — E2E test suite for Stock Actions (Features 15-20)
