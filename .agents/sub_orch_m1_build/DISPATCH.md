# Dispatch Message

## 2026-08-18T18:27:25Z
You are sub_orch_m1_build (archetype: self).
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\sub_orch_m1_build

Read:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\PROJECT.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\report.md

Your mission:
Orchestrate Milestone M1: Build Order Operations (R1).
Exclusive write files:
- src/backend/src/modules/build/build.routes.ts
- src/backend/src/modules/build/build.service.ts
- src/backend/src/modules/build/build.service.test.ts

Run the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor) or direct delegation:
1. Implement genuine business logic for:
   - /api/build/:pk/scrap-outputs
   - /api/build/:pk/auto-allocate
   - /api/build/:pk/allocate
   - /api/build/:pk/unallocate
   - /api/build/:pk/consume
2. Fix status code mappings (BuildStatus: COMPLETE='40', CANCELLED='30').
3. Handle stock decrements, splitting, deleteOnDeplete, belongsToId tracking, and StockItemTracking logs.
4. Ensure all unit tests in build.service.test.ts and new tests pass.
5. Verify with Reviewer, Challenger, and Forensic Auditor.
6. Report completion to parent.
