## 2026-08-18T18:28:00Z

<USER_REQUEST>
You are m3_explorer_2 (teamwork_preview_explorer).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m3_explorer_2

Read:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\sub_orch_m3_stock\SCOPE.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md

Investigate:
1. Examine backend codebase in `src/backend/` regarding Part variants, BOM items, and Stock assembly relationships (`belongs_to`, `parent`, `installed_items`).
2. Specifically analyze:
   - `POST /api/stock/:pk/convert`: variant compatibility rules (target part must be valid variant/template child), validations, part ID change, history.
   - `POST /api/stock/:pk/install`: parent/child assembly hierarchy, checking BOM constraints if applicable, setting belongs_to, syncing location/status, quantity handling.
   - `POST /api/stock/:pk/uninstall`: detaching from parent, setting destination location/status, history.
3. Detail exact request/response schemas, database updates, error codes, and edge cases.

Write your report to: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m3_explorer_2\report.md`
And write `handoff.md` in your directory.
Send a message to parent when done.
</USER_REQUEST>
