# Scope: Milestone M1 — Build Order Operations (R1)

## Architecture
- Module: `src/backend/src/modules/build/`
- Files:
  - `src/backend/src/modules/build/build.routes.ts`
  - `src/backend/src/modules/build/build.service.ts`
  - `src/backend/src/modules/build/build.service.test.ts`
- Database Models: `buildorder`, `buildline`, `builditem`, `stockitem`, `stocklocation`, `stockitemtracking`, `part`, `bomitem`, `bomitemsubstitute`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Scrap Outputs (`/api/build/:pk/scrap-outputs`) | Scrap specified build outputs, mark REJECTED (65), split partial stock, log tracking (56), handle allocations | M1_BUILD | survey_explorer_1 |
| 2 | Auto-Allocate (`/api/build/:pk/auto-allocate`) | Auto-allocate available component stock against build lines via BOM data | M1_BUILD | survey_explorer_1 |
| 3 | Allocate (`/api/build/:pk/allocate`) | Manually allocate specific stock items to build lines with defined quantities & optional output tracking | M1_BUILD | survey_explorer_1 |
| 4 | Unallocate (`/api/build/:pk/unallocate`) | Deallocate stock items from build lines and/or specific build outputs | M1_BUILD | survey_explorer_1 |
| 5 | Consume (`/api/build/:pk/consume`) | Consume allocated stock items, decrement stock quantity, handle `deleteOnDeplete`, update `belongsToId`, log tracking (57/30/35/40) | M1_BUILD | survey_explorer_1 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1.1 | Investigation & Strategy | Inspect existing routes, service, tests, and prisma schema | none | IN_PROGRESS |
| M1.2 | Implementation & Unit Testing | Implement 5 operations, fix status codes, write comprehensive unit tests | M1.1 | PLANNED |
| M1.3 | Review & Challenge | Review code and run stress/adversarial checks | M1.2 | PLANNED |
| M1.4 | Integrity Audit & Gate | Run forensic audit and evaluate gate criteria | M1.3 | PLANNED |

## Interface Contracts
### Build ↔ Stock
- `scrapOutputs`: Updates `Stockitem` status to 65 (REJECTED), location to scrap destination, logs `Stockitemtracking` (56).
- `consume`: Decrements `Stockitem.quantity`. If quantity reaches 0 and `deleteOnDeplete === true`, deletes `Stockitem`. If trackable, sets `belongsToId = build.partId` or installInto target.
- Status Codes: `CANCELLED = '30'`, `COMPLETE = '40'`.
