## 2026-08-18T18:15:28Z

You are survey_explorer_1 (role: teamwork_preview_spec_miner).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1

Read ORIGINAL_REQUEST.md located at: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md

Your scope is: R1. Build Order Operations
Endpoints to investigate:
- /api/build/:pk/scrap-outputs
- /api/build/:pk/auto-allocate
- /api/build/:pk/allocate
- /api/build/:pk/unallocate
- /api/build/:pk/consume

Investigate:
1. Current implementation in src/backend (src/modules/build/build.routes.ts, build.service.ts, schemas, database models/migrations/ORM).
2. Existing tests in src/backend for build operations or related modules.
3. The authoritative Python reference implementation in the repo (search for python backend files, e.g. in src/backend, InvenTree/, src/, or wherever the Python InvenTree backup is located).
4. Extract precise behavior: payload schemas, validation rules, BOM association, stock allocation logic, auto-allocation algorithms, stock item quantity decrement, deleteOnDeplete handling, tracking/history logs, status updates, response formats, error codes and edge cases.

Write your comprehensive findings and specification report to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\report.md
and a handoff summary to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\handoff.md

Update your progress.md regularly with timestamps. Send a message to parent when done.
