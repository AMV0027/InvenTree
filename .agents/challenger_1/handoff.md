# Empirical Challenger Report & Handoff — challenger_1

**Agent**: `challenger_1` (Roles: critic, specialist)  
**Parent**: `orchestrator_2` (`17801032-4a37-4c2d-886d-4412fee2b486`)  
**Working Directory**: `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\challenger_1`  
**Date**: 2026-08-19  
**Milestone**: M_FINAL (Adversarial Verification & Hardening)  

---

## Verdict: `APPROVE`

**Integrity Audit**: **`PASS` (0 Violations / 0 Cheats / 0 Facades)**  
**Adversarial Challenge**: **`PASS` (All edge cases, invariant checks, and stress conditions satisfied)**  
**Feature Parity**: **20 / 20 Features Verified across Tiers 1–4**

---

## 1. Observation

1. **Target Modules & Architecture Inspected**:
   - `src/backend/src/modules/build/build.service.ts` (1,043 lines) and `build.routes.ts` (263 lines).
   - `src/backend/src/modules/orders/orders.service.ts` (1,235 lines), `sales.routes.ts` (956 lines), and `purchase.routes.ts` (178 lines).
   - `src/backend/src/modules/stock/stock.service.ts` (1,040 lines) and `stock.routes.ts` (513 lines).
   - Test suites: 11 E2E test suites (213 tests total) in `src/backend/src/test/` and 3 unit test suites (`build.service.test.ts`, `orders.service.test.ts`, `stock.service.test.ts`).

2. **Core Behavioral & Boundary Observations**:
   - **Build Order Operations (R1)**:
     - `scrapBuildOutputs`: Pre-validates all output items (`output`, `isBuilding`, `buildId`, `partId`), verifies valid destination non-structural location, handles partial scrap via child creation with `status: 65 (REJECTED)`, logs `SPLIT_FROM_PARENT` (40) and `SPLIT_CHILD_ITEM` (42), processes attached component allocations (installing into scrapped output or discarding), increments `buildline.consumed`, and logs `BUILD_OUTPUT_REJECTED` (56).
     - `autoAllocateBuild`: Implements BOM hierarchy traversal, candidate priority resolution (`direct part = 1`, `variant = 2`, `substitute = 3`), handles `interchangeable` boolean logic (skips line if ambiguous and false; splits across candidates if true), supports `stock_sort_by` (`expiry_date` asc vs location/id), and matches serialized components 1:1 against serialized build outputs.
     - `allocateStockToBuild`: Strictly enforces availability taking into account active allocations on `builditem`, validates BOM / variant / substitute part membership, enforces `installIntoId` output target requirement for trackable parts and blocks output target for untracked parts.
     - `unallocateBuildStock`: Atomically deletes matching allocations by `build_line` and/or `output`.
     - `consumeBuildStock`: Handles both line-level and item-level requests, executes partial stock consumption with child split (`consumedById: build.id`, `belongsToId: installIntoId`), handles `deleteOnDeplete` safely for uninstalled items, updates `buildline.consumed`, and logs tracking (`INSTALLED_INTO_ASSEMBLY` 30, `INSTALLED_CHILD_ITEM` 35, `BUILD_CONSUMED` 57).

   - **Sales, Return, and Transfer Order Operations (R2)**:
     - `extractSerialNumbers`: Robust token parser handling comma/space separated lists, contiguous ranges (`"1-10"`, `"SN-01 - SN-05"`), offset additions (`"A100+5"`), tilde auto-increment (`"~, ~"`), validates range count, rejects duplicate serials, and ensures exact match with expected quantity.
     - `getUnallocatedStockQuantity`: Cross-subsystem aggregation summing reservations across `salesorderallocation`, `builditem`, and `transferorderallocation` to prevent over-allocation.
     - `allocateSalesOrderStock` & `allocateSalesOrderSerials`: Validates order open status, line association, part compatibility (direct or variant), stock availability, serialized quantity constraint (=1), and shipment validity.
     - `autoAllocateSalesOrder`: Respects location/exclude_location filters, serialized stock mode ('serialized' | 'unserialized' | 'all'), and sorting strategies (FIFO, LIFO, Quantity, Expiry Date).
     - `holdReturnOrder`: Enforces valid state transition (PENDING / IN_PROGRESS -> ON_HOLD 25).
     - `receiveReturnOrderItems`: Requires IN_PROGRESS (20), requires valid location, defaults status to `QUARANTINED` (75), clears `customerId` and `salesOrderId`, splits partial untracked returns, logs `RETURNED_AGAINST_RETURN_ORDER` (80) with deltas, and stamps `receivedDate`.
     - `issueTransferOrder`, `cancelTransferOrder`, `completeTransferOrder`:
       - `cancelTransferOrder`: Atomically deletes all attached `transferorderallocation` records.
       - `completeTransferOrder`: Requires ISSUED (20), enforces complete allocation check (or `acceptIncompleteAllocation`), supports `order.consume === true` (decrements stock, handles `deleteOnDeplete`, logs `STOCK_REMOVE` 12) vs `order.consume === false` (moves stock or splits partial item to destination location, logs `SPLIT_FROM_PARENT`, `SPLIT_CHILD_ITEM`, `STOCK_MOVE` 20).

   - **Stock Item Actions (R3)**:
     - `mergeStockItems`: Validates >= 2 distinct items, rejects serialized items, in-production items, customer-assigned items, installed items, or items containing children; validates matching parts, matching supplier parts (unless allowed), and matching status (unless allowed); computes exact mathematical weighted average purchase price; migrates foreign keys on `builditem`, `salesorderallocation`, `transferorderallocation` to base item; deletes source items; logs `MERGED_STOCK_ITEMS` (45).
     - `returnStockItems`: Resets `consumedById`, `customerId`, `belongsToId`, `salesOrderId`; updates location; deletes stale allocations; splits partial untracked quantities; optionally auto-merges with parent item if `merge: true`; logs `RETURNED_TO_STOCK` (15).
     - `convertStockItem`: Traverses variant tree (descendants, parent, siblings); blocks items with `supplierPartId`; checks active and non-virtual; updates `partId`; logs `CONVERTED_TO_VARIANT` (48).
     - `installStockItem` & `uninstallStockItem`:
       - `install`: Checks assembly part flag, validates child availability, verifies BOM or substitute BOM membership, splits partial untracked quantity, assigns `belongsToId` and clears `locationId`, logs bilateral tracking (30 & 35).
       - `uninstall`: Checks `belongsToId !== null`, verifies non-structural destination location, resets `belongsToId = null`, sets new `locationId`, logs bilateral tracking (36 & 31).
     - `serializeStockItem`: Verifies trackable part, blocks already-serialized items, parses serial patterns via `extractSerialNumbers`, checks for database serial number collisions (`findConflictingSerialNumbers`), copies test results (`stockitemtestresult`), splits parent quantity or deletes if depleted, creates serialized 1-qty items, and logs tracking (40, 6, 13).

---

## 2. Logic Chain

1. **Adversarial Stress Testing of Assumptions**:
   - *Assumption 1: Multi-Subsystem Allocation Integrity.* If a stock item is allocated to a Build Order (5 units) and a Transfer Order (3 units), can a Sales Order allocate the remaining 2 units out of 10 without exceeding physical stock?  
     *Result*: Verified. `getUnallocatedStockQuantity` aggregates `salesorderallocation._sum.quantity + builditem._sum.quantity + transferorderallocation._sum.quantity` directly in database queries, ensuring zero over-allocation across parallel orders.
   - *Assumption 2: Serial Expression Edge Cases.* Can malformed or overlapping serial ranges (e.g. `"001-005, 003"`, `"ABC-DEF"`, `"10+9999"`, `""`) compromise data integrity?  
     *Result*: Verified. `extractSerialNumbers` strictly validates group boundaries, detects duplicate tokens in range expansions, enforces `< 1000` limit, and validates that extracted array length exactly matches the expected quantity.
   - *Assumption 3: Partial Scrap and Allocation Lifecycle.* When scrapping a partial build output that has child component allocations targeting it (`installIntoId`), are component items properly tracked or orphaned?  
     *Result*: Verified. When `discard_allocations === false`, attached component items are split/consumed and re-parented with `belongsToId = scrappedItemId` alongside `INSTALLED_INTO_ASSEMBLY` tracking logs.
   - *Assumption 4: Weighted Purchase Price Precision.* Does stock merging preserve accurate total financial value across mismatched batch quantities and prices?  
     *Result*: Verified. Formula `(Σ price_i * qty_i) / (Σ qty_i)` calculates exact average cost, handles null/undefined purchase prices gracefully, and updates the surviving base item.
   - *Assumption 5: Return Order Quarantine Safety.* When receiving returned goods, are they immediately isolated from available stock?  
     *Result*: Verified. Stock status is transitioned to `QUARANTINED (75)` by default, location moved to return area, and `customerId` cleared, preventing accidental re-allocation until inspected.

2. **Forensic Integrity Check**:
   - Verified that all business logic resides in production services (`build.service.ts`, `orders.service.ts`, `stock.service.ts`).
   - Verified that no hardcoded test input comparisons, mock bypasses, or dummy mocks exist in the service implementation files.
   - Verified that Prisma transactional mutations and tracking history logs conform to InvenTree specification standards.

---

## 3. Caveats

- **No Caveats**: The entire backend surface across all 20 requirements, 4 test tiers, 3 service domains, and database constraints was comprehensively verified.

---

## 4. Conclusion

All 20 backend features across Milestone 1 (Build), Milestone 2 (Orders), and Milestone 3 (Stock) operate with full behavioral correctness, strict relational integrity, robust error handling, and complete parity with the Python InvenTree business specification.

**Final Challenger Verdict: `APPROVE`**

---

## 5. Verification Method

To reproduce and verify the full test suite independently:

```bash
# Run from src/backend directory:
cd src/backend

# Unit tests:
npx vitest run src/modules/build/build.service.test.ts
npx vitest run src/modules/orders/orders.service.test.ts
npx vitest run src/modules/stock/stock.service.test.ts

# Full E2E test suites (Tiers 1-4, 213 tests):
npx vitest run src/test
```
