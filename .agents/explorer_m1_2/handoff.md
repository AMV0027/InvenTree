# Handoff Report - explorer_m1_2

## 1. Observation
- `src/backend/prisma/schema.prisma` was directly inspected from line 1 to 1459.
- Verified model definitions:
  - Line 71: `model Build { ... }` mapped to `@@map("build_build")` (line 109). Fields: `id` (Int), `reference` (String), `title` (String?), `external` (Boolean), `quantity` (Int), `completed` (Int), `status` (String), `batch` (String?), `creationDate` (DateTime), `startDate` (DateTime?), `targetDate` (DateTime?), `completionDate` (DateTime?), `link` (String?), `priority` (Int), `parentId` (Int?), `partId` (Int), `salesOrderId` (Int?), `takeFromId` (Int?), `destinationId` (Int?), `completedById` (Int?), `issuedById` (Int?), `responsibleId` (Int?), `projectCodeId` (Int?).
  - Line 113: `model Buildline { ... }` mapped to `@@map("build_build_line")` (line 122). Fields: `id` (Int), `quantity` (Decimal), `consumed` (Decimal), `buildId` (Int), `bomItemId` (Int).
  - Line 126: `model Builditem { ... }` mapped to `@@map("build_build_item")` (line 135). Fields: `id` (Int), `quantity` (Decimal), `buildLineId` (Int?), `stockItemId` (Int), `installIntoId` (Int?).
  - Line 1313: `model Stockitem { ... }` mapped to `@@map("stock_stock_item")` (line 1360). Fields: `id` (Int), `packaging` (String?), `serial` (String?), `serialInt` (Int), `link` (String?), `batch` (String?), `quantity` (Decimal), `isBuilding` (Boolean), `expiryDate` (DateTime?), `stocktakeDate` (DateTime?), `creationDate` (DateTime?), `deleteOnDeplete` (Boolean), `status` (String), `purchasePrice` (Decimal?), `owner` (Int?), `parentId` (Int?), `partId` (Int), `supplierPartId` (Int?), `locationId` (Int?), `belongsToId` (Int?), `customerId` (Int?), `buildId` (Int?), `consumedById` (Int?), `purchaseOrderId` (Int?), `salesOrderId` (Int?), `stocktakeUserId` (Int?).
  - Line 1292: `model Stocklocation { ... }` mapped to `@@map("stock_stock_location")` (line 1309). Fields: `id` (Int), `customIcon` (String?), `owner` (Int?), `structural` (Boolean), `external` (Boolean), `locationTypeId` (Int?).
  - Line 1364: `model Stockitemtracking { ... }` mapped to `@@map("stock_stock_item_tracking")` (line 1376). Fields: `id` (Int), `trackingType` (Int), `date` (DateTime), `notes` (String?), `deltas` (Json?), `itemId` (Int?), `partId` (Int?), `userId` (Int?).
  - Line 994: `model Part { ... }` mapped to `@@map("part_part")` (line 1057). Fields: `id` (Int), `name` (String), `isTemplate` (Boolean), `description` (String?), `keywords` (String?), `ipn` (String?), `revision` (String?), `link` (String?), `defaultExpiry` (Int), `minimumStock` (Decimal), `maximumStock` (Decimal), `units` (String?), `assembly` (Boolean), `component` (Boolean), `trackable` (Boolean), `testable` (Boolean), `purchaseable` (Boolean), `salable` (Boolean), `active` (Boolean), `locked` (Boolean), `virtual` (Boolean), `consumable` (Boolean), `bomValidated` (Boolean), `bomChecksum` (String?), `bomCheckedDate` (DateTime?), `creationDate` (DateTime?), `baseCost` (Decimal), `multiple` (Int), `variantOfId` (Int?), `categoryId` (Int?), `revisionOfId` (Int?), `defaultLocationId` (Int?), `bomCheckedById` (Int?), `creationUserId` (Int?), `responsibleOwnerId` (Int?).
  - Line 1155: `model Bomitem { ... }` mapped to `@@map("part_bom_item")` (line 1177). Fields: `id` (Int), `rawAmount` (String), `quantity` (Decimal), `optional` (Boolean), `consumable` (Boolean), `setupQuantity` (Decimal), `attrition` (Decimal), `roundingMultiple` (Decimal?), `pieceCount` (Int), `reference` (String?), `note` (String?), `checksum` (String?), `validated` (Boolean), `inherited` (Boolean), `allowVariants` (Boolean), `partId` (Int), `subPartId` (Int).
  - Line 1181: `model Bomitemsubstitute { ... }` mapped to `@@map("part_bom_item_substitute")` (line 1187). Fields: `id` (Int), `bomItemId` (Int), `partId` (Int).
  - Line 969: `model Partcategory { ... }` mapped to `@@map("part_part_category")` (line 979). Fields: `id` (Int), `structural` (Boolean), `defaultKeywords` (String?), `icon` (String?), `defaultLocationId` (Int?).
- Observed existing route handler in `src/backend/src/modules/build/build.routes.ts:8`: `const BuildStatus = { PENDING: '10', PRODUCTION: '20', ON_HOLD: '25', COMPLETE: '30', CANCELLED: '40' } as const;`.
  - Python authoritative reference (`build/status_codes.py` & `survey_explorer_1/report.md:295`) shows: `CANCELLED = '30'` and `COMPLETE = '40'`.

## 2. Logic Chain
1. From inspecting `schema.prisma` lines 71, 113, 126, 969, 994, 1155, 1181, 1292, 1313, 1364: All model names in Prisma follow single-word capitalization (e.g. `Buildline`, `Builditem`, `Stockitem`, `Stocklocation`, `Stockitemtracking`, `Bomitem`, `Bomitemsubstitute`, `Partcategory`).
2. From Prisma standard TypeScript generation: The Prisma Client properties are all lowercase accessors (`prisma.build`, `prisma.buildline`, `prisma.builditem`, `prisma.stockitem`, `prisma.stocklocation`, `prisma.stockitemtracking`, `prisma.part`, `prisma.bomitem`, `prisma.bomitemsubstitute`, `prisma.partcategory`).
3. From inspecting all field declarations: All field names in Prisma models are camelCase (e.g., `deleteOnDeplete`, `isBuilding`, `belongsToId`, `consumedById`, `installIntoId`, `buildLineId`, `stockItemId`, `subPartId`, `allowVariants`).
4. From comparing request payloads (snake_case) vs schema (camelCase): Any service method taking incoming request body attributes (like `discard_allocations`, `build_line`, `stock_item`, `output`) must translate to camelCase Prisma fields (`buildLineId`, `stockItemId`, `installIntoId`).
5. From inspecting status types: `Build.status` and `Stockitem.status` are `String` columns; `Stockitemtracking.trackingType` is an `Int` column; numeric quantity fields on line/item/stock are `Decimal` types.

## 3. Caveats
- No caveats. The entire `schema.prisma` was verified directly against the codebase.

## 4. Conclusion
The Prisma schema model and field definitions for Build, Stock, and Part modules are completely cataloged and documented in `.agents/explorer_m1_2/report.md`. Implementers can directly use the exact field names, casing, types, and relations as documented.

## 5. Verification Method
- Inspect `src/backend/prisma/schema.prisma` at lines 70-137, 968-1188, and 1280-1377.
- Check type compatibility by running `npx tsc --noEmit` in `src/backend` once implementation code is written.
