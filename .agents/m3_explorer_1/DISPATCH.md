## 2026-08-18T18:28:00Z
You are m3_explorer_1 (teamwork_preview_explorer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m3_explorer_1

Read:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\sub_orch_m3_stock\SCOPE.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md

Investigate:
1. Examine existing backend codebase in `src/backend/` particularly `src/backend/src/modules/stock/`, `src/backend/src/modules/part/`, Prisma schema / DB schema, models, and types.
2. Specifically analyze `POST /api/stock/merge` and `POST /api/stock/return`.
3. Determine how allocations (build order allocations, sales order allocations) work, how they should transfer during merge, how stock tracking / history logging should be structured, and how return logic should handle location, status, quantity, and notes.
4. Detail the exact signatures, validation rules, error handling, and Prisma queries needed.

Write your report to: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m3_explorer_1\report.md`
And write `handoff.md` in your directory.
Send a message to parent when done.
