# Handoff Report: Stock Item Actions & Test Infrastructure (R3)

**Author**: survey_explorer_3 (role: teamwork_preview_spec_miner)  
**Date**: 2026-08-18  
**Scope**: R3. Stock Item Actions & Test Infrastructure (`/api/stock/merge`, `/api/stock/return`, `/api/stock/:pk/convert`, `/api/stock/:pk/install`, `/api/stock/:pk/uninstall`, `/api/stock/:pk/serialize`)

---

## 1. Observation

Direct code observations from the repository:
1. **Current TypeScript Implementation**:
   - In `src/backend/src/modules/stock/stock.routes.ts`:
     - Line 183: `stockRouter.post('/api/stock/merge', async (c) => c.json({ success: true }));`
     - Line 184: `stockRouter.post('/api/stock/return', async (c) => c.json({ success: true }));`
     - Line 310: `stockRouter.post('/api/stock/:pk/convert', (c) => c.json({ success: true }));`
     - Line 311: `stockRouter.post('/api/stock/:pk/install', (c) => c.json({ success: true }));`
     - Line 312: `stockRouter.post('/api/stock/:pk/uninstall', (c) => c.json({ success: true }));`
     - Line 313: `stockRouter.post('/api/stock/:pk/serialize', (c) => c.json({ success: true }));`
   - In `src/backend/src/modules/stock/stock.service.ts`:
     - Basic helpers `createTrackingEntry`, `validateStockItem`, `handleStockItemUpdate` exist, but service methods for `merge`, `return`, `convert`, `install`, `uninstall`, `serialize` are missing.
     - `TrackingType` enum in `stock.service.ts:3-11` uses non-authoritative values (e.g. `MOVED: 5`, `ADD: 10`) whereas Python authoritative codes in `src/backend_backup/InvenTree/stock/status_codes.py` are `STOCK_ADD: 11`, `STOCK_REMOVE: 12`, `STOCK_MOVE: 20`, `MERGED_STOCK_ITEMS: 45`, `RETURNED_TO_STOCK: 15`, `INSTALLED_INTO_ASSEMBLY: 30`, `REMOVED_FROM_ASSEMBLY: 31`, `CONVERTED_TO_VARIANT: 48`, `STOCK_SERIALIZED: 13`.
2. **Authoritative Python Reference**:
   - `src/backend_backup/InvenTree/stock/api.py`: Contains API views `StockMerge` (line 290), `StockReturn` (line 265), `StockItemConvert` (line 178), `StockItemInstall` (line 161), `StockItemUninstall` (line 172), `StockItemSerialize` (line 130).
   - `src/backend_backup/InvenTree/stock/serializers.py`: Defines `StockMergeSerializer` (line 1725), `StockReturnSerializer` (line 2239), `ConvertStockItemSerializer` (line 1188), `InstallStockItemSerializer` (line 834), `UninstallStockItemSerializer` (line 917), `SerializeStockItemSerializer` (line 693).
   - `src/backend_backup/InvenTree/stock/models.py`: Defines business logic `merge_stock_items` (line 2709), `can_merge` (line 2614), `return_to_stock` (line 1567), `convert_to_variant` (line 1362), `installStockItem` (line 1886), `uninstall_into_location` (line 1952), `serializeStock` (line 2402).
   - `src/backend_backup/InvenTree/InvenTree/helpers.py`: `extract_serial_numbers` (line 599) and `increment` (line 397) for parsing ranges (`1-5`), plus-notation (`SN-001+4`), and comma-separated serials.
3. **Vitest Test Infrastructure**:
   - `npm test` runs `vitest run`.
   - Executed `npm test` in `src/backend`: 4 test files, 28 tests passing in 441ms.
   - Tests isolate DB calls via `vi.mock('../../utils/db.js')` mocking Prisma models.

---

## 2. Logic Chain

1. **Endpoint Implementation Need**:
   - The user request requires full business logic replacing mock responses in `src/backend/src/modules/stock/stock.routes.ts` and `src/backend/src/modules/stock/stock.service.ts`.
2. **Data Consistency & Validation Rules**:
   - Every stock action requires transactional atomicity (`prisma.$transaction`) to keep item quantities, location IDs, allocation pointers, and tracking history consistent.
   - Business validations must precede mutations:
     - `merge`: $\ge 2$ unique items, non-structural location, items not serialized / in production / assigned to orders / containing children, matching parts and suppliers/statuses.
     - `return`: positive quantity $\le$ available, non-structural location, clears `customerId`, `consumedById`, `belongsToId`, `salesOrderId`, and handles optional parent merge.
     - `convert`: non-structural target part, part must belong to variant family tree (parent, sibling, descendant), stock item must NOT have `supplierPartId`.
     - `install`: assembly must have `assembly: true`, child part must exist in BOM, child must be available/in-stock, sets `belongsToId` and clears child `locationId`.
     - `uninstall`: item must have `belongsToId != null`, non-structural target location, clears `belongsToId` and sets `locationId`.
     - `serialize`: source part must be `trackable: true`, item must be non-serialized, quantity matches parsed serials, no existing conflicting serials, generates $N$ items of quantity 1 with parent ID, decrements/deletes source.
3. **Audit History Tracking**:
   - Authoritative tracking codes (`StockHistoryCode`) from `status_codes.py` should be used consistently with JSON deltas for full traceability.
4. **Test Infrastructure Alignment**:
   - All R3 functionality can be covered with fast unit tests in `src/modules/stock/stock.service.test.ts` mocking `prisma`, matching the established testing pattern of the codebase.

---

## 3. Caveats

- **Prisma Schema Differences**: In `prisma/schema.prisma`, model field names are camelCase (e.g. `partId`, `belongsToId`, `customerId`, `isBuilding`, `deleteOnDeplete`, `supplierPartId`) whereas Django models use snake_case (`part_id`, `belongs_to_id`, etc.). JSON request/response payloads follow snake_case (e.g. `stock_item`, `serial_numbers`, `allow_mismatched_suppliers`), so route handlers must map between snake_case payload keys and camelCase Prisma fields.
- **Serial Number Patterns**: Advanced serial number pattern plugins from Python are replaced in Node.js by standard range expansion (`X-Y`), plus-count (`X+N`), and comma-delimited lists.

---

## 4. Conclusion

The authoritative specification and implementation rules for R3 (Stock Item Actions & Test Infrastructure) have been thoroughly surveyed and documented in `.agents/survey_explorer_3/report.md`. The TypeScript backend has the necessary Prisma models (`Stockitem`, `Stockitemtracking`, `Stocklocation`, `Part`, `Bomitem`, `Builditem`, `Salesorderallocation`, `Transferorderallocation`) and a working Vitest test harness ready for implementation and verification.

---

## 5. Verification Method

To verify the test infrastructure and findings:
1. **Run Vitest Test Suite**:
   ```bash
   cd c:\Companies\BloomBig\saas_applications\InvenTree\src\backend
   npm test
   ```
   *Expected result*: 4 test files passed (28 tests passed).
2. **Inspect Specification Artifacts**:
   - `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\report.md`
   - `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3\handoff.md`
