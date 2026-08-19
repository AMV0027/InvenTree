# Comprehensive Prisma Schema Specification Report

**Author:** explorer_m1_2 (teamwork_investigator)  
**Date:** 2026-08-18  
**Scope:** Investigation of Prisma Schema (`src/backend/prisma/schema.prisma`) for Build Orders, Stock Items, Parts, and BOM Modules in InvenTree.

---

## 1. Executive Summary

This report documents the exact database schema, model names, field names, data types, nullability, relation mappings, and status code / tracking code representations in `src/backend/prisma/schema.prisma`.

### Key Findings & High-Impact Insights for Implementation
1. **Model Capitalization**: Prisma model names use PascalCase with single capitalized words:
   - `Build`, `Buildline` (not `BuildLine`), `Builditem` (not `BuildItem`)
   - `Stockitem` (not `StockItem`), `Stocklocation` (not `StockLocation`), `Stockitemtracking` (not `StockItemTracking`)
   - `Part`, `Bomitem` (not `BomItem`), `Bomitemsubstitute` (not `BomItemSubstitute`), `Partcategory` (not `PartCategory`)
   - Prisma Client properties are strictly lowercase: `prisma.build`, `prisma.buildline`, `prisma.builditem`, `prisma.stockitem`, `prisma.stocklocation`, `prisma.stockitemtracking`, `prisma.part`, `prisma.bomitem`, `prisma.bomitemsubstitute`, `prisma.partcategory`.
2. **Field Casing**: All Prisma field names are **camelCase** (e.g. `deleteOnDeplete`, `isBuilding`, `belongsToId`, `consumedById`, `installIntoId`, `buildLineId`, `stockItemId`, `subPartId`, `allowVariants`).
   - Incoming REST API payloads use **snake_case** (e.g. `delete_on_deplete`, `is_building`, `build_line`, `stock_item`, `install_into`, `sub_part`). Implementers must map snake_case to camelCase when querying or mutating Prisma models.
3. **Types & Units**:
   - `Build.quantity` & `Build.completed` are **`Int`** (non-nullable).
   - `Buildline.quantity`, `Buildline.consumed`, `Builditem.quantity`, and `Stockitem.quantity` are **`Decimal`** (Prisma `Decimal`, requiring `Decimal.js` or `.toNumber()` / `toFloat()`).
   - `Stockitem.serialInt` is **`Int`** (non-nullable).
   - `Build.status` and `Stockitem.status` are stored as **`String`** (e.g. `'10'`, `'20'`, `'30'`, `'40'`, `'65'`), NOT as Prisma enums or database integers.
   - `Stockitemtracking.trackingType` is stored as an **`Int`** (e.g. `56` for `BUILD_OUTPUT_REJECTED`, `57` for `BUILD_CONSUMED`, `30` for `INSTALLED_INTO_ASSEMBLY`, `35` for `INSTALLED_CHILD_ITEM`, `40` for `SPLIT_FROM_PARENT`, `42` for `SPLIT_CHILD_ITEM`).
   - `Stockitemtracking.deltas` is stored as **`Json?`** (nullable Prisma JSON).

---

## 2. Model Casing & Naming Summary

| Logical Concept | Prisma Model Name in `schema.prisma` | Prisma Client Accessor (`prisma.<name>`) | Underlying SQL Table (`@@map`) |
| :--- | :--- | :--- | :--- |
| **Build Order** | `Build` | `prisma.build` | `build_build` |
| **Build Line** | `Buildline` | `prisma.buildline` | `build_build_line` |
| **Build Item Allocation** | `Builditem` | `prisma.builditem` | `build_build_item` |
| **Stock Item** | `Stockitem` | `prisma.stockitem` | `stock_stock_item` |
| **Stock Location** | `Stocklocation` | `prisma.stocklocation` | `stock_stock_location` |
| **Stock Item Tracking** | `Stockitemtracking` | `prisma.stockitemtracking` | `stock_stock_item_tracking` |
| **Stock Location Type** | `Stocklocationtype` | `prisma.stocklocationtype` | `stock_stock_location_type` |
| **Stock Item Test Result** | `Stockitemtestresult` | `prisma.stockitemtestresult` | `stock_stock_item_test_result` |
| **Part** | `Part` | `prisma.part` | `part_part` |
| **BOM Item** | `Bomitem` | `prisma.bomitem` | `part_bom_item` |
| **BOM Item Substitute** | `Bomitemsubstitute` | `prisma.bomitemsubstitute` | `part_bom_item_substitute` |
| **Part Category** | `Partcategory` | `prisma.partcategory` | `part_part_category` |

---

## 3. Detailed Model Definitions & Field Specifications

### 3.1 Build Order Module

#### `Build` (`build_build`)
```prisma
model Build {
  id              Int            @id @default(autoincrement())
  reference       String
  title           String?
  external        Boolean
  quantity        Int
  completed       Int
  status          String
  batch           String?
  creationDate    DateTime
  startDate       DateTime?
  targetDate      DateTime?
  completionDate  DateTime?
  link            String?
  priority        Int
  parentId        Int?
  parent          Build?         @relation("Build_Build_1", fields: [parentId], references: [id])
  partId          Int
  part            Part           @relation("Build_Part_1", fields: [partId], references: [id])
  salesOrderId    Int?
  salesOrder      Salesorder?    @relation("Build_Salesorder_1", fields: [salesOrderId], references: [id])
  takeFromId      Int?
  takeFrom        Stocklocation? @relation("Build_Stocklocation_1", fields: [takeFromId], references: [id])
  destinationId   Int?
  destination     Stocklocation? @relation("Build_Stocklocation_2", fields: [destinationId], references: [id])
  completedById   Int?
  completedBy     User?          @relation("Build_User_1", fields: [completedById], references: [id])
  issuedById      Int?
  issuedBy        User?          @relation("Build_User_2", fields: [issuedById], references: [id])
  responsibleId   Int?
  responsible     Owner?         @relation("Build_Owner_1", fields: [responsibleId], references: [id])
  projectCodeId   Int?
  projectCode     Projectcode?   @relation("Build_Projectcode_1", fields: [projectCodeId], references: [id])
  
  // Reverse Relations
  build_parents                      Build[]                 @relation("Build_Build_1")
  buildline_builds                   Buildline[]             @relation("Buildline_Build_1")
  purchaseorderlineitem_buildOrders  Purchaseorderlineitem[] @relation("Purchaseorderlineitem_Build_1")
  stockitem_builds                   Stockitem[]             @relation("Stockitem_Build_1")
  stockitem_consumedBys              Stockitem[]             @relation("Stockitem_Build_2")
  @@map("build_build")
}
```

#### `Buildline` (`build_build_line`)
```prisma
model Buildline {
  id                   Int          @id @default(autoincrement())
  quantity             Decimal
  consumed             Decimal
  buildId              Int
  build                Build        @relation("Buildline_Build_1", fields: [buildId], references: [id])
  bomItemId            Int
  bomItem              Bomitem      @relation("Buildline_Bomitem_1", fields: [bomItemId], references: [id])
  
  // Reverse Relations
  builditem_buildLines Builditem[]  @relation("Builditem_Buildline_1")
  @@map("build_build_line")
}
```

#### `Builditem` (`build_build_item`)
```prisma
model Builditem {
  id            Int        @id @default(autoincrement())
  quantity      Decimal
  buildLineId   Int?
  buildLine     Buildline? @relation("Builditem_Buildline_1", fields: [buildLineId], references: [id])
  stockItemId   Int
  stockItem     Stockitem  @relation("Builditem_Stockitem_1", fields: [stockItemId], references: [id])
  installIntoId Int?
  installInto   Stockitem? @relation("Builditem_Stockitem_2", fields: [installIntoId], references: [id])
  @@map("build_build_item")
}
```

---

### 3.2 Stock Module

#### `Stockitem` (`stock_stock_item`)
```prisma
model Stockitem {
  id                            Int                     @id @default(autoincrement())
  packaging                     String?
  serial                        String?
  serialInt                     Int
  link                          String?
  batch                         String?
  quantity                      Decimal
  isBuilding                    Boolean
  expiryDate                    DateTime?
  stocktakeDate                 DateTime?
  creationDate                  DateTime?
  deleteOnDeplete               Boolean
  status                        String
  purchasePrice                 Decimal?
  owner                         Int?
  parentId                      Int?
  parent                        Stockitem?              @relation("Stockitem_Stockitem_1", fields: [parentId], references: [id])
  partId                        Int
  part                          Part                    @relation("Stockitem_Part_1", fields: [partId], references: [id])
  supplierPartId                Int?
  supplierPart                  Supplierpart?           @relation("Stockitem_Supplierpart_1", fields: [supplierPartId], references: [id])
  locationId                    Int?
  location                      Stocklocation?          @relation("Stockitem_Stocklocation_1", fields: [locationId], references: [id])
  belongsToId                   Int?
  belongsTo                     Stockitem?              @relation("Stockitem_Stockitem_2", fields: [belongsToId], references: [id])
  customerId                    Int?
  customer                      Company?                @relation("Stockitem_Company_1", fields: [customerId], references: [id])
  buildId                       Int?
  build                         Build?                  @relation("Stockitem_Build_1", fields: [buildId], references: [id])
  consumedById                  Int?
  consumedBy                    Build?                  @relation("Stockitem_Build_2", fields: [consumedById], references: [id])
  purchaseOrderId               Int?
  purchaseOrder                 Purchaseorder?          @relation("Stockitem_Purchaseorder_1", fields: [purchaseOrderId], references: [id])
  salesOrderId                  Int?
  salesOrder                    Salesorder?             @relation("Stockitem_Salesorder_1", fields: [salesOrderId], references: [id])
  stocktakeUserId               Int?
  stocktakeUser                 User?                   @relation("Stockitem_User_1", fields: [stocktakeUserId], references: [id])
  
  // Reverse Relations
  builditem_stockItems          Builditem[]             @relation("Builditem_Stockitem_1")
  builditem_installIntos        Builditem[]             @relation("Builditem_Stockitem_2")
  salesorderallocation_items    Salesorderallocation[]  @relation("Salesorderallocation_Stockitem_1")
  returnorderlineitem_items     Returnorderlineitem[]   @relation("Returnorderlineitem_Stockitem_1")
  transferorderallocation_items Transferorderallocation[] @relation("Transferorderallocation_Stockitem_1")
  stockitem_parents             Stockitem[]             @relation("Stockitem_Stockitem_1")
  stockitem_belongsTos          Stockitem[]             @relation("Stockitem_Stockitem_2")
  stockitemtracking_items       Stockitemtracking[]     @relation("Stockitemtracking_Stockitem_1")
  stockitemtestresult_stockItems Stockitemtestresult[]  @relation("Stockitemtestresult_Stockitem_1")
  @@map("stock_stock_item")
}
```

#### `Stocklocation` (`stock_stock_location`)
```prisma
model Stocklocation {
  id                                 Int                     @id @default(autoincrement())
  customIcon                         String?
  owner                              Int?
  structural                         Boolean
  external                           Boolean
  locationTypeId                     Int?
  locationType                       Stocklocationtype?      @relation("Stocklocation_Stocklocationtype_1", fields: [locationTypeId], references: [id])
  
  // Reverse Relations
  build_takeFroms                    Build[]                 @relation("Build_Stocklocation_1")
  build_destinations                 Build[]                 @relation("Build_Stocklocation_2")
  purchaseorder_destinations         Purchaseorder[]         @relation("Purchaseorder_Stocklocation_1")
  purchaseorderlineitem_destinations Purchaseorderlineitem[] @relation("Purchaseorderlineitem_Stocklocation_1")
  transferorder_takeFroms            Transferorder[]         @relation("Transferorder_Stocklocation_1")
  transferorder_destinations         Transferorder[]         @relation("Transferorder_Stocklocation_2")
  partcategory_defaultLocations      Partcategory[]          @relation("Partcategory_Stocklocation_1")
  part_defaultLocations              Part[]                  @relation("Part_Stocklocation_1")
  stockitem_locations                Stockitem[]             @relation("Stockitem_Stocklocation_1")
  @@map("stock_stock_location")
}
```

#### `Stockitemtracking` (`stock_stock_item_tracking`)
```prisma
model Stockitemtracking {
  id           Int        @id @default(autoincrement())
  trackingType Int
  date         DateTime
  notes        String?
  deltas       Json?
  itemId       Int?
  item         Stockitem? @relation("Stockitemtracking_Stockitem_1", fields: [itemId], references: [id])
  partId       Int?
  part         Part?      @relation("Stockitemtracking_Part_1", fields: [partId], references: [id])
  userId       Int?
  user         User?      @relation("Stockitemtracking_User_1", fields: [userId], references: [id])
  @@map("stock_stock_item_tracking")
}
```

#### `Stocklocationtype` (`stock_stock_location_type`)
```prisma
model Stocklocationtype {
  id                          Int             @id @default(autoincrement())
  name                        String
  description                 String?
  icon                        String?
  stocklocation_locationTypes Stocklocation[] @relation("Stocklocation_Stocklocationtype_1")
  @@map("stock_stock_location_type")
}
```

---

### 3.3 Part & BOM Module

#### `Part` (`part_part`)
```prisma
model Part {
  id                           Int                     @id @default(autoincrement())
  name                         String
  isTemplate                   Boolean
  description                  String?
  keywords                     String?
  ipn                          String?
  revision                     String?
  link                         String?
  defaultExpiry                Int
  minimumStock                 Decimal
  maximumStock                 Decimal
  units                        String?
  assembly                     Boolean
  component                    Boolean
  trackable                    Boolean
  testable                     Boolean
  purchaseable                 Boolean
  salable                      Boolean
  active                       Boolean
  locked                       Boolean
  virtual                      Boolean
  consumable                   Boolean
  bomValidated                 Boolean
  bomChecksum                  String?
  bomCheckedDate               DateTime?
  creationDate                 DateTime?
  baseCost                     Decimal
  multiple                     Int
  variantOfId                  Int?
  variantOf                    Part?                   @relation("Part_Part_1", fields: [variantOfId], references: [id])
  categoryId                   Int?
  category                     Partcategory?           @relation("Part_Partcategory_1", fields: [categoryId], references: [id])
  revisionOfId                 Int?
  revisionOf                   Part?                   @relation("Part_Part_2", fields: [revisionOfId], references: [id])
  defaultLocationId            Int?
  defaultLocation              Stocklocation?          @relation("Part_Stocklocation_1", fields: [defaultLocationId], references: [id])
  bomCheckedById               Int?
  bomCheckedBy                 User?                   @relation("Part_User_1", fields: [bomCheckedById], references: [id])
  creationUserId               Int?
  creationUser                 User?                   @relation("Part_User_2", fields: [creationUserId], references: [id])
  responsibleOwnerId           Int?
  responsibleOwner             Owner?                  @relation("Part_Owner_1", fields: [responsibleOwnerId], references: [id])

  // Reverse Relations
  build_parts                  Build[]                 @relation("Build_Part_1")
  manufacturerpart_parts       Manufacturerpart[]      @relation("Manufacturerpart_Part_1")
  supplierpart_parts           Supplierpart[]          @relation("Supplierpart_Part_1")
  salesorderlineitem_parts     Salesorderlineitem[]    @relation("Salesorderlineitem_Part_1")
  transferorderlineitem_parts  Transferorderlineitem[] @relation("Transferorderlineitem_Part_1")
  part_variantOfs              Part[]                  @relation("Part_Part_1")
  part_revisionOfs             Part[]                  @relation("Part_Part_2")
  partpricing_parts            Partpricing[]           @relation("Partpricing_Part_1")
  partstocktake_parts          Partstocktake[]         @relation("Partstocktake_Part_1")
  partsellpricebreak_parts     Partsellpricebreak[]    @relation("Partsellpricebreak_Part_1")
  partinternalpricebreak_parts Partinternalpricebreak[] @relation("Partinternalpricebreak_Part_1")
  partstar_parts               Partstar[]              @relation("Partstar_Part_1")
  parttesttemplate_parts       Parttesttemplate[]      @relation("Parttesttemplate_Part_1")
  bomitem_parts                Bomitem[]               @relation("Bomitem_Part_1")
  bomitem_subParts             Bomitem[]               @relation("Bomitem_Part_2")
  bomitemsubstitute_parts      Bomitemsubstitute[]     @relation("Bomitemsubstitute_Part_1")
  partrelated_part1s           Partrelated[]           @relation("Partrelated_Part_1")
  partrelated_part2s           Partrelated[]           @relation("Partrelated_Part_2")
  stockitem_parts              Stockitem[]             @relation("Stockitem_Part_1")
  stockitemtracking_parts      Stockitemtracking[]     @relation("Stockitemtracking_Part_1")
  @@map("part_part")
}
```

#### `Bomitem` (`part_bom_item`)
```prisma
model Bomitem {
  id                         Int                 @id @default(autoincrement())
  rawAmount                  String
  quantity                   Decimal
  optional                   Boolean
  consumable                 Boolean
  setupQuantity              Decimal
  attrition                  Decimal
  roundingMultiple           Decimal?
  pieceCount                 Int
  reference                  String?
  note                       String?
  checksum                   String?
  validated                  Boolean
  inherited                  Boolean
  allowVariants              Boolean
  partId                     Int
  part                       Part                @relation("Bomitem_Part_1", fields: [partId], references: [id])
  subPartId                  Int
  subPart                    Part                @relation("Bomitem_Part_2", fields: [subPartId], references: [id])

  // Reverse Relations
  buildline_bomItems         Buildline[]         @relation("Buildline_Bomitem_1")
  bomitemsubstitute_bomItems Bomitemsubstitute[] @relation("Bomitemsubstitute_Bomitem_1")
  @@map("part_bom_item")
}
```

#### `Bomitemsubstitute` (`part_bom_item_substitute`)
```prisma
model Bomitemsubstitute {
  id        Int     @id @default(autoincrement())
  bomItemId Int
  bomItem   Bomitem @relation("Bomitemsubstitute_Bomitem_1", fields: [bomItemId], references: [id])
  partId    Int
  part      Part    @relation("Bomitemsubstitute_Part_1", fields: [partId], references: [id])
  @@map("part_bom_item_substitute")
}
```

#### `Partcategory` (`part_part_category`)
```prisma
model Partcategory {
  id                                      Int                             @id @default(autoincrement())
  structural                              Boolean
  defaultKeywords                         String?
  icon                                    String?
  defaultLocationId                       Int?
  defaultLocation                         Stocklocation?                  @relation("Partcategory_Stocklocation_1", fields: [defaultLocationId], references: [id])

  // Reverse Relations
  partcategoryparametertemplate_categorys Partcategoryparametertemplate[] @relation("Partcategoryparametertemplate_Partcategory_1")
  part_categorys                          Part[]                          @relation("Part_Partcategory_1")
  partcategorystar_categorys              Partcategorystar[]              @relation("Partcategorystar_Partcategory_1")
  @@map("part_part_category")
}
```

---

## 4. Relations & Foreign Keys Reference Map

### Critical Foreign Keys for Build Order & Stock Operations

| Source Model | Field Name | Foreign Model | Relation Meaning |
| :--- | :--- | :--- | :--- |
| **`Build`** | `partId` | `Part` | The assembly part being produced by this Build Order. |
| **`Build`** | `takeFromId` | `Stocklocation` | Location from which component stock is drawn. |
| **`Build`** | `destinationId` | `Stocklocation` | Location where completed build outputs are placed. |
| **`Build`** | `parentId` | `Build` | Parent build order if this build is a sub-build. |
| **`Buildline`** | `buildId` | `Build` | The parent Build order owning this BOM requirement line. |
| **`Buildline`** | `bomItemId` | `Bomitem` | The BOM item specification linked to this build line. |
| **`Builditem`** | `buildLineId` | `Buildline` | The build line for which stock is allocated. |
| **`Builditem`** | `stockItemId` | `Stockitem` | The stock item allocated to satisfy the build line. |
| **`Builditem`** | `installIntoId` | `Stockitem` | (Tracked only) The specific build output stock item this part is installed into. |
| **`Stockitem`** | `partId` | `Part` | The Part definition of this physical stock item. |
| **`Stockitem`** | `locationId` | `Stocklocation` | Current storage location (null if installed/consumed). |
| **`Stockitem`** | `buildId` | `Build` | The Build order that **created** this stock item (output). |
| **`Stockitem`** | `consumedById` | `Build` | The Build order that **consumed** this stock item. |
| **`Stockitem`** | `belongsToId` | `Stockitem` | The parent assembly StockItem this item is installed into. |
| **`Stockitem`** | `parentId` | `Stockitem` | The original parent StockItem from which this item was split. |
| **`Bomitem`** | `partId` | `Part` | The parent assembly Part. |
| **`Bomitem`** | `subPartId` | `Part` | The child component Part. |
| **`Bomitemsubstitute`** | `bomItemId` | `Bomitem` | The BOM item definition allowing this substitute. |
| **`Bomitemsubstitute`** | `partId` | `Part` | The alternative component Part allowed as a substitute. |
| **`Part`** | `variantOfId` | `Part` | The template/parent part this variant is derived from. |
| **`Stockitemtracking`** | `itemId` | `Stockitem` | The stock item whose history is recorded. |
| **`Stockitemtracking`** | `partId` | `Part` | Optional direct reference to the part. |

---

## 5. Enum / Integer / String Status Code Mappings

### 5.1 Build Order Status (`BuildStatus`)
In Prisma schema, `Build.status` is type `String`.
```typescript
export const BuildStatus = {
  PENDING: '10',     // Build order created, not yet in production
  PRODUCTION: '20',  // Build order issued / currently in production
  ON_HOLD: '25',     // Build order on hold
  CANCELLED: '30',   // Build order cancelled
  COMPLETE: '40',    // Build order completed
} as const;
```
> ⚠️ **Critical Bug Note**: In the original mock `src/modules/build/build.routes.ts`, `COMPLETE` was set to `'30'` and `CANCELLED` was set to `'40'`. In Python InvenTree and the authoritative spec, `CANCELLED = '30'` and `COMPLETE = '40'`. The router must use `'30'` for CANCELLED and `'40'` for COMPLETE.

---

### 5.2 Stock Item Status (`StockStatus`)
In Prisma schema, `Stockitem.status` is type `String`.
```typescript
export const StockStatus = {
  OK: '10',          // Normal stock in good condition
  ATTENTION: '50',   // Requires attention
  DAMAGED: '55',     // Damaged
  DESTROYED: '60',   // Destroyed
  REJECTED: '65',    // Rejected / Scrapped (used for scrapped build outputs)
  LOST: '70',        // Lost
  QUARANTINED: '75', // Quarantined
  RETURNED: '85',    // Returned
} as const;
```

---

### 5.3 Stock Item Tracking Codes (`StockHistoryCode` / `TrackingType`)
In Prisma schema, `Stockitemtracking.trackingType` is type `Int`.
```typescript
export const StockHistoryCode = {
  CREATED: 1,
  EDITED: 5,
  ASSIGNED_SERIAL: 6,
  STOCK_COUNT: 10,
  STOCK_ADD: 11,
  STOCK_REMOVE: 12,
  STOCK_SERIALIZED: 13,
  RETURNED_TO_STOCK: 15,
  STOCK_MOVE: 20,
  STOCK_UPDATE: 25,
  INSTALLED_INTO_ASSEMBLY: 30,  // Component installed into assembly
  REMOVED_FROM_ASSEMBLY: 31,
  INSTALLED_CHILD_ITEM: 35,     // Assembly received child item
  REMOVED_CHILD_ITEM: 36,
  SPLIT_FROM_PARENT: 40,        // Logged on newly split child item
  SPLIT_CHILD_ITEM: 42,         // Logged on parent item after split
  MERGED_STOCK_ITEMS: 45,
  DISASSEMBLED: 46,
  CREATED_FROM_DISASSEMBLY: 47,
  CONVERTED_TO_VARIANT: 48,
  BUILD_OUTPUT_CREATED: 50,
  BUILD_OUTPUT_COMPLETED: 55,
  BUILD_OUTPUT_REJECTED: 56,    // Logged when build output is scrapped
  BUILD_CONSUMED: 57,           // Logged when stock item is consumed in build
  SHIPPED_AGAINST_SALES_ORDER: 60,
  RECEIVED_AGAINST_PURCHASE_ORDER: 70,
  RETURNED_AGAINST_RETURN_ORDER: 80,
} as const;
```

---

## 6. Data Types & Nullability Gotchas for Implementers

| Field | Schema Type | Gotcha / Implementation Requirement |
| :--- | :--- | :--- |
| `Stockitem.quantity` | `Decimal` | In Prisma JS client, returns a `Decimal` instance (from `decimal.js`). Always use `stockItem.quantity.toNumber()` or `toFloat(stockItem.quantity)` before math calculations, or pass `new Prisma.Decimal(qty)` / string / number to updates. |
| `Buildline.quantity` / `consumed` | `Decimal` | Same as above. `consumed` starts at 0 and increments with each stock consumption. |
| `Builditem.quantity` | `Decimal` | Represents allocated component quantity. Decrements upon partial consumption or is deleted upon complete consumption. |
| `Stockitem.serialInt` | `Int` | Non-nullable integer. When creating a stock item without an integer serial (bulk or untracked), default this to `0`. If serial is numeric (e.g. `"1005"`), set `serialInt = 1005`. |
| `Stockitem.isBuilding` | `Boolean` | Output items in production have `isBuilding = true`. Upon completion or scrap, `isBuilding` becomes `false`. Available component stock in inventory must have `isBuilding === false`. |
| `Stockitem.deleteOnDeplete` | `Boolean` | When stock reaches 0 during consumption, if `deleteOnDeplete === true` and the item has no installed children or active allocations, the row must be deleted (`prisma.stockitem.delete`). If false, it remains with `quantity = 0` and `locationId = null`. |
| `Stockitem.belongsToId` | `Int?` | Set to assembly `Stockitem.id` when a tracked component is consumed into a build output (`installIntoId`). |
| `Stockitem.consumedById` | `Int?` | Set to `Build.id` when a stock item is consumed against a build order. |
| `Builditem.installIntoId` | `Int?` | Nullable. Must be `null` for untracked parts and non-null (pointing to a build output `Stockitem.id`) for trackable parts. |
| `Bomitem.allowVariants` | `Boolean` | When true, stock items of descendant parts (`variantOfId`) can be allocated. |
| `Bomitem.consumable` / `Part.consumable` | `Boolean` | Consumable items do NOT require stock allocation and are bypassed in allocation logic. |
| `Stockitemtracking.deltas` | `Json?` | Expects JSON object detailing change deltas, e.g. `{ quantity: scrapQty, location: locationId, status: '65', buildorder: buildId }`. |

---

## 7. Request Body to Prisma Schema Translation Guide

| API Request Field (snake_case) | Prisma Model | Prisma Property (camelCase) | Type Conversion / Note |
| :--- | :--- | :--- | :--- |
| `output` (ID) | `Stockitem` | `id` | `toInt(body.output)` |
| `build_line` (ID) | `Buildline` | `buildLineId` | `toInt(body.build_line)` |
| `stock_item` (ID) | `Stockitem` | `stockItemId` | `toInt(body.stock_item)` |
| `discard_allocations` | N/A (logic flag) | N/A | `Boolean(body.discard_allocations)` |
| `substitutes` | N/A (logic flag) | N/A | `body.substitutes !== false` |
| `interchangeable` | N/A (logic flag) | N/A | `Boolean(body.interchangeable)` |
| `optional_items` | N/A (logic flag) | N/A | `Boolean(body.optional_items)` |
| `item_type` | N/A (logic filter) | N/A | `'untracked' \| 'tracked' \| 'all'` |
| `build_lines` | `Buildline` | `id in [...]` | `body.build_lines.map(toInt)` |
| `tracking_note` / `notes` | `Stockitemtracking`| `notes` | `String(body.notes)` |
| `location` | `Stocklocation` | `locationId` | `toInt(body.location)` |

---

## 8. Summary for Implementer (sub_orch_m1_build / implementer)

All 5 build operations in `src/modules/build/build.service.ts` can be cleanly implemented against the verified Prisma client models:
1. **`scrapBuildOutputs`**: Queries `prisma.build` (where `id`), `prisma.stockitem` (where `id`, `buildId`, `isBuilding: true`), updates or creates child `prisma.stockitem` with `status: '65'`, `isBuilding: false`, `parentId`, logs `prisma.stockitemtracking` (`trackingType: 56`, `deltas`), handles allocations in `prisma.builditem`.
2. **`autoAllocateBuild`**: Queries `prisma.buildline` (include `bomItem.subPart`, `builditem_buildLines`), matches against available `prisma.stockitem` (filtered by `partId`, variant, substitute, `isBuilding: false`, `quantity > 0`), creates or updates `prisma.builditem`.
3. **`allocateStockToBuild`**: Validates each item, checks unallocated quantity on `prisma.stockitem`, inserts/updates `prisma.builditem` records.
4. **`unallocateBuildStock`**: Deletes matching allocations from `prisma.builditem` (filtered by `buildLineId` or `installIntoId`).
5. **`consumeBuildStock`**: Consumes from `prisma.builditem` allocations, updates `prisma.buildline.consumed`, decrements `prisma.stockitem.quantity`, splits or deletes depleted items, updates `belongsToId` / `consumedById`, and logs `prisma.stockitemtracking` (`trackingType: 57` or `30`/`35`).
