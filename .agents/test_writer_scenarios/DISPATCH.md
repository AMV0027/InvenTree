## 2026-08-18T18:28:23Z
You are test_writer_scenarios (archetype: teamwork_preview_test_writer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_scenarios

Read these authoritative specification files before starting:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\TEST_INFRA.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\report.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
Write the complete Tier 4 Real-World Application Scenario E2E test suite in `src/backend/src/test/e2e/scenarios_e2e.test.ts`.
Scenarios to implement:
1. Scenario 1: Full Manufacturing Lifecycle (Build Auto-Allocate -> Manual Adjust -> Consume (Deplete & Split) -> Stock Install -> Build Complete)
2. Scenario 2: Customer Return, Inspection & Re-Stock (Return Order Issue -> Hold -> Receive into Quarantine -> Stock Return / Conversion)
3. Scenario 3: Multi-Location Warehouse Transfer (Stock Serialize -> Transfer Order Allocate -> Issue -> Complete (Move location) -> Stock Merge)
4. Scenario 4: Sales Order Fulfillment with Serial Tracking (Bulk Stock Serialization -> SO Serial Allocation -> Auto-Allocate balance -> Order Shipment)
5. Scenario 5: Modular Assembly & Teardown Lifecycle (Stock Conversion -> Stock Install to Assembly -> Build Output Scrap -> Stock Uninstall back to Warehouse)

Test framework:
- Vitest (`npm test` in `src/backend`).
- Multi-step realistic business workflows testing complex cross-module state transitions, stock splitting, tracking history deltas, and lifecycle consistency.
- Ensure all tests run and pass cleanly with `npm test`.

When done:
1. Run `npm test` to verify.
2. Write your handoff report to `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\test_writer_scenarios\handoff.md`.
3. Send a message to parent with completion summary.
