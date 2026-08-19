# BRIEFING — 2026-08-18T18:28:23Z

## Mission
Write Tier 4 Real-World Application Scenario E2E test suite in `src/backend/src/test/e2e/scenarios_e2e.test.ts`.

## 🔒 My Identity
- Archetype: teamwork_preview_test_writer
- Roles: specialist, qa
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_scenarios
- Original parent: 431d878d-9481-4914-8b2b-363221614830
- Milestone: Tier 4 Scenarios E2E Tests

## 🔒 Key Constraints
- Write comprehensive test code only (never dummy/facade implementations).
- All tests must test real cross-module business workflows.
- Must run and pass cleanly with `npm test` in `src/backend`.

## Current Parent
- Conversation ID: 431d878d-9481-4914-8b2b-363221614830
- Updated: not yet

## Task Summary
- **What to build**: 5 realistic multi-step business workflow scenarios E2E tests:
  1. Full Manufacturing Lifecycle (Auto-Allocate -> Manual Adjust -> Consume (Deplete & Split) -> Stock Install -> Build Complete)
  2. Customer Return, Inspection & Re-Stock (Return Order Issue -> Hold -> Receive into Quarantine -> Stock Return / Conversion)
  3. Multi-Location Warehouse Transfer (Stock Serialize -> Transfer Order Allocate -> Issue -> Complete (Move location) -> Stock Merge)
  4. Sales Order Fulfillment with Serial Tracking (Bulk Stock Serialization -> SO Serial Allocation -> Auto-Allocate balance -> Order Shipment)
  5. Modular Assembly & Teardown Lifecycle (Stock Conversion -> Stock Install to Assembly -> Build Output Scrap -> Stock Uninstall back to Warehouse)
- **Success criteria**: Tests compile, execute, verify state transitions, tracking logs, stock quantities, status codes, and all 5 scenarios pass cleanly.
- **Interface contracts**: PROJECT.md, TEST_INFRA.md, ORIGINAL_REQUEST.md
- **Code layout**: `src/backend/src/test/e2e/scenarios_e2e.test.ts`

## Key Decisions Made
- [TBD]

## Artifact Index
- DISPATCH.md — Initial task dispatch
- BRIEFING.md — Persistent situational awareness
- progress.md — Task liveness & progress tracking
- handoff.md — Handoff report upon completion

## Loaded Skills
- None

## Quality Status
- **Build/test result**: Not yet run
- **Lint status**: Outstanding violations: 0
- **Tests added/modified**: `src/backend/src/test/e2e/scenarios_e2e.test.ts`
