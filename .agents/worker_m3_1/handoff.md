# Handoff Report — Milestone M3: Stock Item Actions (R3)

**Agent**: worker_m3_1 (Roles: implementer, qa, specialist)  
**Parent**: orchestrator_2 (`17801032-4a37-4c2d-886d-4412fee2b486`)  
**Date**: 2026-08-19  
**Scope**: Implementation of Stock Item Actions in `src/backend/src/modules/stock/`

---

## 1. Observation

1. **Previous Codebase State**:
   - `stock.routes.ts`: Endpoints `POST /api/stock/merge`, `POST /api/stock/return`, `POST /api/stock/:pk/convert`, `POST /api/stock/:pk/install`, `POST /api/stock/:pk/uninstall`, `POST /api/stock/:pk/serialize` were stubs returning `{ success: true }`.
   - `stock.service.ts`: Contained only `validateStockItem` and `handleStockItemUpdate`.
   - `stock.service.test.ts`: Contained 7 tests testing basic item validation and status update tracking.

2. **Authoritative Python Reference (`src/backend_backup/InvenTree/stock/`) & Spec Mining (`survey_explorer_3/report.md`)**:
   - `merge_stock_items` (`models.py:2709`): Validates $\ge 2$ items, non-structural location, uniqueness, non-serialized, unassigned (SO/customer/belongsTo/production), matching part & supplier & status, computes weighted purchase price, re-parents allocations (`Builditem`, `Salesorderallocation`, `Transferorderallocation`), cleans `parentId`, deletes secondary items, logs tracking code `45` (`MERGED_STOCK_ITEMS`) with `{ quantity, added }`.
   - `return_to_stock` (`models.py:1567`): Validates items & non-structural location, handles partial quantity split into parent-child relationship, clears `consumedById`, `customerId`, `belongsToId`, `salesOrderId`, removes allocations, logs tracking code `15` (`RETURNED_TO_STOCK`), and auto-merges into parent if `merge: true`.
   - `convert_to_variant` (`models.py:1362`, `serializers.py:1188`, `part/models.py:2510`): Validates no assigned `supplierPartId`, checks target part in valid conversion options (descendants, immediate parent, siblings; active & non-virtual), updates `partId`, logs tracking code `48` (`CONVERTED_TO_VARIANT`).
   - `installStockItem` (`models.py:1886`, `serializers.py:834`): Validates parent assembly, child availability, BOM membership via `Bomitem` or `Bomitemsubstitute`, handles partial splits, sets `belongsToId`, clears location, logs tracking codes `30` (`INSTALLED_INTO_ASSEMBLY`) on child and `35` (`INSTALLED_CHILD_ITEM`) on assembly.
   - `uninstall_into_location` (`models.py:1952`, `serializers.py:917`): Validates installed status, non-structural destination location, sets `belongsToId = null`, `consumedById = null`, sets `locationId`, logs tracking codes `36` (`REMOVED_CHILD_ITEM`) on parent and `31` (`REMOVED_FROM_ASSEMBLY`) on child item.
   - `serializeStock` (`models.py:2402`, `InvenTree/helpers.py:599`): Validates trackable part, non-serialized status, quantity bounds ($1 \le Q \le 1000$), non-structural destination location, parses serial expressions (ranges `1-5`, plus `100+3`, comma lists, tilde `~`), checks DB uniqueness/conflicts, creates $N$ individual items with quantity 1, copies test results (`Stockitemtestresult`), logs tracking codes `40` (`SPLIT_FROM_PARENT`) & `6` (`ASSIGNED_SERIAL`) on each new item, logs tracking code `13` (`STOCK_SERIALIZED`) on parent, and decrements or deletes depleted parent if `deleteOnDeplete: true`.

---

## 2. Logic Chain

1. **`stock.service.ts` Enhancements**:
   - Implemented constants `StockStatus` and `StockHistoryCode` with authoritative InvenTree integer and string codes.
   - Implemented serial number helpers `increment()` and `extractSerialNumbers()` supporting exact string parsing rules including hyphen ranges, plus offsets, comma delimiters, and tilde auto-increment.
   - Implemented DB query helpers `getLatestSerialNumber()`, `findConflictingSerialNumbers()`, `getConversionOptions()`, and `checkIfPartInBom()`.
   - Implemented full business logic services:
     - `mergeStockItems(params)`
     - `returnStockItems(params)`
     - `convertStockItem(pk, targetPartId, userId)`
     - `installStockItem(params)`
     - `uninstallStockItem(params)`
     - `serializeStockItem(params)`
   - Every service enforces all validation invariants, performs required state transitions, manipulates associated allocations and test results, and emits proper `Stockitemtracking` entries.

2. **`stock.routes.ts` Wiring**:
   - Replaced stubs with calls to `mergeStockItems`, `returnStockItems`, `convertStockItem`, `installStockItem`, `uninstallStockItem`, and `serializeStockItem`.
   - Mapped inputs, URL parameters, body fields, and error codes (400 for validation errors, 404 for missing items/parts/locations, 201 for successful creations).

3. **`stock.service.test.ts` Unit Test Suite**:
   - Expanded unit test coverage from 7 tests to 27 unit tests.
   - Thoroughly tested every validation guard, calculation, edge case, and tracking entry creation for all 6 operations.

---

## 3. Caveats

- **External write boundary**: All changes were strictly confined to `src/backend/src/modules/stock/`.
- **Database constraints**: For unit tests, Prisma Client is mocked via `vi.mock('../../utils/db.js')` in alignment with the existing project pattern.

---

## 4. Conclusion

Milestone M3 (Stock Item Actions) is fully implemented with genuine, complete business logic matching the InvenTree reference behavior. All 6 endpoints correctly handle validation, state transitions, weighted calculations, foreign-key reassignments, tracking history creation, and edge case splits.

---

## 5. Verification Method

- **Unit Test Command**:
  ```bash
  npm test
  # or
  npx vitest run src/modules/stock/stock.service.test.ts
  ```
- **Affected Files**:
  - `src/backend/src/modules/stock/stock.service.ts`
  - `src/backend/src/modules/stock/stock.routes.ts`
  - `src/backend/src/modules/stock/stock.service.test.ts`
- **Test Scenarios Covered**:
  - `mergeStockItems`: Minimum item count, duplicate PKs, structural locations, serialized rejection, SO rejection, mismatched part/supplier/status, weighted pricing, allocation re-parenting, parentId cleanup, tracking code `45`.
  - `returnStockItems`: Empty item validation, structural location rejection, negative/excess quantity rejection, partial split logic, unstocking state reset, allocation deletion, tracking code `15`, auto-merge into parent.
  - `convertStockItem`: Missing stock/part rejection, supplierPart constraint, variant tree validation (descendants/parent/siblings), active/virtual filtering, tracking code `48`.
  - `installStockItem`: Assembly validation, child availability, BOM item & substitute validation, quantity bounds, partial split, belongsToId assignment, tracking codes `30` & `35`.
  - `uninstallStockItem`: Non-installed rejection, structural location rejection, location assignment, tracking codes `36` & `31`.
  - `serializeStockItem`: Trackable part check, already serialized rejection, quantity limits, range/plus/tilde syntax parsing, duplicate & conflicting serial rejection, test result replication, tracking codes `40`, `6`, and `13`, depleted parent deletion (`deleteOnDeplete`).
