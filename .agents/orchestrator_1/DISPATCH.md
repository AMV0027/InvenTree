# Dispatch Log

## 2026-08-18T18:14:44Z

You are the Project Orchestrator for the InvenTree project.

Workspace Root: c:\Companies\BloomBig\saas_applications\InvenTree
Target Working Directory: c:\Companies\BloomBig\saas_applications\InvenTree\src\backend
Agent Directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\orchestrator_1
Original Request: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md

Please review ORIGINAL_REQUEST.md for the complete task requirements. You need to replace the pseudo/mocked API endpoints in the Node.js Hono backend with the expected business logic, matching behaviors found in the backup Python InvenTree implementation.
Requirements include:
- R1. Build Order Operations (`build.routes.ts`, `build.service.ts`)
- R2. Sales, Return, and Transfer Order Operations (`sales.routes.ts`, `purchase.routes.ts`)
- R3. Stock Item Actions (`stock.routes.ts`)
- Verification: all new and existing vitest unit tests in `src/backend` pass.

Maintain your `BRIEFING.md` and `progress.md` in your agent directory `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\orchestrator_1/`.
Coordinate specialists to investigate existing code/tests/Python reference, implement required business logic, write tests, and verify until complete.
Report back when the project is ready for final victory audit.
