## 2026-08-18T18:28:01Z
You are explorer_m1_2.
Your working directory is: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m1_2

Read:
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\ORIGINAL_REQUEST.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\sub_orch_m1_build\SCOPE.md
- c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1\report.md

Task:
Investigate Prisma schema:
- c:\Companies\BloomBig\saas_applications\InvenTree\src\backend\prisma\schema.prisma

Document the exact Prisma model definitions, field names (camelCase vs snake_case, exact types, relations, nullability) for:
- Buildorder / BuildLine / BuildItem
- StockItem / StockLocation / StockItemTracking
- Part / BomItem / BomItemSubstitute / PartCategory
Verify exact model names (e.g. `buildorder` or `BuildOrder` or `Buildorder`), field names (e.g. `deleteOnDeplete`, `isBuilding`, `belongsToId`, `consumedById`, `installIntoId`), and enum/int mappings.

Write your findings to:
c:\Companies\BloomBig\saas_applications\InvenTree\.agents\explorer_m1_2\report.md
and send a completion message back to parent.
