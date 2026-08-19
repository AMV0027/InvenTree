## 2026-08-18T18:15:28Z
You are survey_explorer_2 (role: teamwork_preview_spec_miner).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2

Read ORIGINAL_REQUEST.md located at: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md

Your scope is: R2. Sales, Return, and Transfer Order Operations
Endpoints to investigate:
- /api/order/so/:pk/allocate
- /api/order/so/:pk/allocate-serials
- /api/order/so/:pk/auto-allocate
- /api/order/ro/:pk/hold
- /api/order/ro/:pk/receive
- /api/order/transfer-order/:pk/issue
- /api/order/transfer-order/:pk/cancel
- /api/order/transfer-order/:pk/complete
- /api/order/transfer-order/:pk/allocate

Investigate:
1. Current implementation in src/backend (src/modules/orders/sales.routes.ts, purchase.routes.ts, transfer routes/services, database models/ORM).
2. Existing tests in src/backend for orders.
3. The authoritative Python reference implementation in the repo (search for order models, views, api in the Python InvenTree backup).
4. Extract precise behavior: payload schemas, validation rules, stock allocations to SO lines, serial allocation, auto-allocation for SO, return order hold & receive logic, transfer order lifecycle (issue, cancel, complete, allocate), stock location updates, tracking/history entries, response formats, error handling.

Write your comprehensive findings and specification report to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md
and a handoff summary to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\handoff.md

Update your progress.md regularly with timestamps. Send a message to parent when done.
