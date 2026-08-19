## 2026-08-18T18:27:25Z
Orchestrate Milestone M3: Stock Item Actions (R3).
Exclusive write files:
- src/backend/src/modules/stock/stock.routes.ts
- src/backend/src/modules/stock/stock.service.ts
- src/backend/src/modules/stock/stock.service.test.ts

Run the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor) or direct delegation:
1. Implement genuine business logic for:
   - /api/stock/merge
   - /api/stock/return
   - /api/stock/:pk/convert
   - /api/stock/:pk/install
   - /api/stock/:pk/uninstall
   - /api/stock/:pk/serialize
2. Handle allocation transfer on merge, variant validation on convert, parent/child relationships on install/uninstall, and serial splitting & test result copying on serialize.
3. Ensure unit tests pass.
4. Verify with Reviewer, Challenger, and Forensic Auditor.
5. Report completion to parent.
