## 2026-08-18T18:15:28Z
You are survey_explorer_3 (role: teamwork_preview_spec_miner).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3

Read ORIGINAL_REQUEST.md located at: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md

Your scope is: R3. Stock Item Actions & Test Infrastructure
Endpoints and topics to investigate:
- /api/stock/merge
- /api/stock/return
- /api/stock/:pk/convert
- /api/stock/:pk/install
- /api/stock/:pk/uninstall
- /api/stock/:pk/serialize
- Overall vitest test harness in src/backend: how tests are run, package.json scripts, test environment (db setup, mocks, test helpers), existing test coverage, passing/failing status of current test suite.

Investigate:
1. Current implementation in src/backend (src/modules/stock/stock.routes.ts, stock service, database models/ORM).
2. Existing tests in src/backend (vitest config, scripts in package.json, test utilities).
3. The authoritative Python reference implementation in the repo for stock operations.
4. Extract precise behavior: payload schemas, validation rules, stock item merging constraints/rules, return action, conversion rules, assembly install/uninstall mechanics (parent/child/installed_in relationships), serialization mechanics (splitting quantity into serialized units), tracking logs, error responses.

Write your comprehensive findings and specification report to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md
and a handoff summary to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\handoff.md

Update your progress.md regularly with timestamps. Send a message to parent when done.
