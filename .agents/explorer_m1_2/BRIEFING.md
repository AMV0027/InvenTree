# BRIEFING — 2026-08-18T18:29:40Z

## Mission
Investigate Prisma schema for BuildOrder, StockItem, Part, and related models in InvenTree backend.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, analyzer, synthesizer
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m1_2
- Original parent: 12473203-c85f-4179-b5e8-eb671a5168e6
- Milestone: m1_build

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Investigate exact Prisma model definitions, field names, types, relations, nullability
- Document Buildorder/BuildLine/BuildItem, StockItem/StockLocation/StockItemTracking, Part/BomItem/BomItemSubstitute/PartCategory

## Current Parent
- Conversation ID: 12473203-c85f-4179-b5e8-eb671a5168e6
- Updated: 2026-08-18T18:29:40Z

## Investigation State
- **Explored paths**: `src/backend/prisma/schema.prisma`, `src/backend/src/modules/build/build.routes.ts`, `src/backend/src/modules/stock/stock.routes.ts`, `src/backend/src/modules/stock/stock.service.ts`, `src/backend/src/modules/parts/bom.routes.ts`
- **Key findings**:
  - Exact model names in Prisma schema: `Build`, `Buildline`, `Builditem`, `Stockitem`, `Stocklocation`, `Stockitemtracking`, `Stocklocationtype`, `Part`, `Bomitem`, `Bomitemsubstitute`, `Partcategory`.
  - Prisma client properties are strictly lowercase (`prisma.build`, `prisma.buildline`, `prisma.builditem`, `prisma.stockitem`, `prisma.stocklocation`, `prisma.stockitemtracking`, `prisma.part`, `prisma.bomitem`, `prisma.bomitemsubstitute`, `prisma.partcategory`).
  - All model fields are camelCase (`deleteOnDeplete`, `isBuilding`, `belongsToId`, `consumedById`, `installIntoId`, `buildLineId`, `stockItemId`, `subPartId`, `allowVariants`).
  - `Build.status` & `Stockitem.status` are `String` columns (`'10'`, `'20'`, `'25'`, `'30'`, `'40'`, `'65'`).
  - `Build.quantity` & `Build.completed` are `Int`.
  - `Buildline.quantity`, `Buildline.consumed`, `Builditem.quantity`, `Stockitem.quantity` are `Decimal`.
  - `Stockitemtracking.trackingType` is `Int`, `deltas` is `Json?`.
- **Unexplored areas**: None (full investigation complete).

## Key Decisions Made
- Documented full model definitions, foreign keys, status codes, and field mapping guide in report.md and handoff.md.

## Artifact Index
- report.md — Comprehensive findings on Prisma models for Build, Stock, and Part
- handoff.md — 5-component handoff report
