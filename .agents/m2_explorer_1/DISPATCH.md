## 2026-08-18T18:28:00Z
You are m2_explorer_1 (Spec & Requirement Miner).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m2_explorer_1

You MUST read:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\sub_orch_m2_orders\SCOPE.md

Your task:
Analyze and document the full specification requirements for Milestone M2:
1. Sales Orders:
   - /api/order/so/:pk/allocate (allocating stock items/batches to SO lines)
   - /api/order/so/:pk/allocate-serials (parsing serial expressions e.g. "1-5, 8, 10-12", matching stock items with serial numbers, allocating)
   - /api/order/so/:pk/auto-allocate (auto-allocation heuristics: FIFO order, location preference, batch/expiry priority)
2. Return Orders:
   - /api/order/ro/:pk/hold (holding order, updating status, restrictions)
   - /api/order/ro/:pk/receive (receiving returned stock items, handling quarantine location assignment, tracking status)
3. Transfer Orders:
   - /api/order/transfer-order/:pk/allocate (allocating stock items to transfer order lines)
   - /api/order/transfer-order/:pk/issue (issuing transfer order, transitioning status to IN_PROGRESS/SHIPPED)
   - /api/order/transfer-order/:pk/cancel (cancelling order, releasing/reverting allocations and stock)
   - /api/order/transfer-order/:pk/complete (completing transfer, updating location of stock items to destination location)
4. Status Code Enums:
   - Detail exact integer status codes for SOStatus, ROStatus, TOStatus, POStatus according to InvenTree specification.

Write your findings and comprehensive specification to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m2_explorer_1\analysis.md
and handoff report to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\m2_explorer_1\handoff.md
Send a completion message back to parent when done.
