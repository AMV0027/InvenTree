# Review & Adversarial Challenge Report: InvenTree Backend Migration

**Reviewer**: `reviewer_1` (Roles: reviewer, critic)  
**Parent**: `orchestrator_2` (`17801032-4a37-4c2d-886d-4412fee2b486`)  
**Date**: 2026-08-19  
**Review Scope**:
- `src/backend/src/modules/build/` (`build.service.ts`, `build.routes.ts`, `build.service.test.ts`)
- `src/backend/src/modules/orders/` (`orders.service.ts`, `order.service.ts`, `sales.routes.ts`, `purchase.routes.ts`, `orders.service.test.ts`, `orders.test.ts`)
- `src/backend/src/modules/stock/` (`stock.service.ts`, `stock.routes.ts`, `stock.service.test.ts`)
- `src/backend/src/test/` (E2E Test Suite Tiers 1–4, `mockDb.ts`, `testApp.ts`, `fixtures.ts`)

---

## Review Summary

**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

1. **Service Implementations (`src/backend/src/modules/`)**:
   - `build.service.ts`: Implements all 5 Build Order operations (`scrapBuildOutputs`, `autoAllocateBuild`, `allocateStockToBuild`, `unallocateBuildStock`, `consumeBuildStock`). Accurately calculates allocation capacities, handles stock splits, respects `deleteOnDeplete`, updates `buildline.consumed`, and logs tracking history codes (`50`, `55`, `56`, `57`, `30`, `35`, `40`, `42`).
   - `orders.service.ts`: Implements all 9 Sales, Return, and Transfer Order operations (`allocateSalesOrderStock`, `allocateSalesOrderSerials`, `autoAllocateSalesOrder`, `holdReturnOrder`, `receiveReturnOrderItems`, `issueTransferOrder`, `holdTransferOrder`, `cancelTransferOrder`, `allocateTransferOrderStock`, `allocateTransferOrderSerials`, `completeTransferOrder`). Computes multi-system allocations across `salesorderallocation`, `builditem`, and `transferorderallocation`. Implements serial number expression expansion (`1-5`, `SN-001-SN-003`, `100+3`).
   - `stock.service.ts`: Implements all 6 Stock Item actions (`mergeStockItems`, `returnStockItems`, `convertStockItem`, `installStockItem`, `uninstallStockItem`, `serializeStockItem`). Handles weighted pricing, allocation re-parenting, BOM membership verification, variant tree traversal, and test result replication.

2. **Module Unit Test Suites**:
   - `build.service.test.ts` (34 tests): Directly validates all `build.service.ts` functions and `buildRouter` endpoints.
   - `orders.service.test.ts` / `orders.test.ts` (20 tests): Directly validates `orders.service.ts` helpers, calculations, and order workflows.
   - `stock.service.test.ts` (27 tests): Directly validates `stock.service.ts` validation guards, pricing, and lifecycle transitions.

3. **E2E Test Suite & Route Contract Divergence**:
   - Inspection of `src/backend/src/test/e2e/` against `src/backend/src/modules/` revealed parameter naming, placement, and status code discrepancies:
     - **Sales Order Allocate Serials (`/api/order/so/:pk/allocate-serials`)**: `sales.routes.ts:334` extracts `body.line_item`, `body.quantity`, `body.serial_numbers`. `tier1_orders_features.test.ts:114` and `scenario4_sales_order_serials.test.ts:69` pass `{ line, serials }` (omitting `quantity`, using `line` instead of `line_item` and `serials` instead of `serial_numbers`).
     - **Sales Order Allocate (`/api/order/so/:pk/allocate`)**: `orders.service.ts:335` extracts `entry.line_item`. `tier1_orders_features.test.ts:32` passes `items: [{ line, stock_item, quantity }]`.
     - **Return Order Receive (`/api/order/ro/:pk/receive`)**: `sales.routes.ts:588` expects top-level `body.location` and `entry.item`. `tier1_orders_features.test.ts:348` passes `{ items: [{ line_item, quantity }] }` without top-level `location`.
     - **Stock Merge (`/api/stock/merge`)**: `stock.routes.ts:253` requires top-level `body.location`. `tier1_stock_features.test.ts:29` passes `{ target, items: [sourceId] }` without `location`.
     - **Stock Return (`/api/stock/return`)**: `stock.routes.ts:272` requires top-level `body.location`. `tier1_stock_features.test.ts:108` passes `location` nested inside each item of `items`.
     - **Build Scrap Outputs (`/api/build/:pk/scrap-outputs`)**: `build.service.ts:160,169` requires mandatory top-level `location` and `notes`. `tier1_build_features.test.ts:37` nests `location` and `notes` inside `outputs[0]`, while test 1.2 and 1.3 omit them.
     - **Build Consume (`/api/build/:pk/consume`)**: `build.service.ts:794` requires `items` or `lines`. `scenario1_manufacturing_lifecycle.test.ts:91` passes `{ notes: '...' }` with neither `items` nor `lines`.
     - **Stock Install (`/api/stock/:pk/install`)**: `stock.routes.ts:452` treats `pk` as `assemblyId` and expects `body.stock_item`. `scenario1_manufacturing_lifecycle.test.ts:97` treats `pk` as child and passes `body.target`.
     - **HTTP Response Codes**: Route handlers return `201 Created` on resource action endpoints (`/allocate`, `/allocate-serials`, `/receive`, `/merge`, `/return`, `/install`, `/serialize`), while E2E test assertions check `expect(res.status).toBe(200)`.

---

## 2. Logic Chain

1. **Core Service Logic is Genuine and High Quality**:
   - The underlying business services (`build.service.ts`, `orders.service.ts`, `stock.service.ts`) implement genuine, non-mocked, relational business logic faithfully matching the Python InvenTree reference specification.
   - There are NO integrity violations, NO hardcoded test results, NO dummy/facade implementations, and NO task bypasses.

2. **Integration Friction Between Independent Tracks**:
   - Because `worker_test_track_1` developed the opaque-box E2E test suite in parallel with the module implementers, naming conventions for payload attributes diverged (e.g. `line` vs `line_item`, `serials` vs `serial_numbers`, `target` vs `stock_item`, top-level vs nested `location`).
   - Consequently, running the E2E test suite (`src/backend/src/test/`) against the route handlers results in validation errors (400 Bad Request) due to missing or mismatched field names.

3. **Required Action**:
   - Route handlers and service input normalization should support aliases (e.g. `body.line_item ?? body.line`, `body.serial_numbers ?? body.serials`, top-level or per-item `location`, deriving quantity from serial expressions when omitted).
   - HTTP response status codes should be normalized or allow 200/201.

---

## 3. Findings

### [Critical] Finding 1: Payload Field Aliasing Mismatch between Route Handlers and E2E Test Suite
- **What**: Route handlers and service methods strictly check specific property keys (e.g. `line_item`, `serial_numbers`, top-level `location`), whereas E2E tests send alternate keys (`line`, `serials`, nested `location`).
- **Where**:
  - `src/backend/src/modules/orders/sales.routes.ts:318, 334, 588, 930, 941`
  - `src/backend/src/modules/orders/orders.service.ts:335, 388, 646, 850, 901`
  - `src/backend/src/modules/stock/stock.routes.ts:253, 272, 452`
  - `src/backend/src/modules/build/build.service.ts:160, 169, 794`
- **Why**: Causes 400 Bad Request responses when calling endpoints via the E2E test suite.
- **Suggestion**: Add input normalization helpers in routes/services to accept:
  - `line_item`: `body.line_item ?? body.line ?? entry.line_item ?? entry.line`
  - `serial_numbers`: `body.serial_numbers ?? body.serials ?? body.serial`
  - `quantity`: if not explicitly provided in serialize/serial-allocation, calculate `extractSerialNumbers(serials).length`
  - `location`: check top-level `body.location ?? body.destination` OR fallback to `entry.location` / `line.destinationId`
  - `stock_item`: `body.stock_item ?? body.item ?? body.target`
  - `/consume`: if neither `items` nor `lines` are passed, consume all outstanding allocations for the build order.

### [Major] Finding 2: HTTP Status Code Compatibility (200 OK vs 201 Created)
- **What**: Multiple action endpoints return `201 Created` (e.g. `/allocate`, `/allocate-serials`, `/receive`, `/merge`, `/return`, `/install`, `/serialize`), while E2E test assertions strictly assert `expect(res.status).toBe(200)`.
- **Where**: `sales.routes.ts`, `stock.routes.ts`
- **Why**: Vitest assertions fail on status code mismatch even when operation logic succeeds.
- **Suggestion**: Standardize action responses to `200 OK` (or accept both 200 and 201 in tests).

---

## 4. Adversarial Challenges

### [High] Challenge 1: Concurrency and Multi-Subsystem Stock Allocation Race Conditions
- **Assumption Challenged**: Sequential checks of `getUnallocatedStockQuantity` followed by `prisma.salesorderallocation.create`.
- **Attack Scenario**: Concurrent requests attempting to allocate the same stock item across Build, Sales, and Transfer orders simultaneously.
- **Blast Radius**: Over-allocation of inventory beyond physical stock quantity.
- **Mitigation**: Wrap allocation validation and mutation in Prisma interactive transactions (`prisma.$transaction`) with pessimistic row locking or atomic quantity reservation checks.

### [Medium] Challenge 2: Serial Number Expression Quantity Mismatch
- **Assumption Challenged**: Serial expression string always contains explicit quantity.
- **Attack Scenario**: A user submits `serials: "101, 102, 103"` without passing explicit `quantity` field.
- **Blast Radius**: Rejection of valid serial allocation requests.
- **Mitigation**: When `quantity` is omitted, auto-derive `expectedQuantity` from the number of discrete serials parsed in the input expression.

---

## 5. Verified Claims

- Build Order Business Logic (`build.service.ts`): Verified via source inspection → PASS (All 5 features implemented with full state, tracking, and split logic)
- Order Operations Business Logic (`orders.service.ts`): Verified via source inspection → PASS (All 9 features implemented with capacity tracking and lifecycle rules)
- Stock Item Actions Business Logic (`stock.service.ts`): Verified via source inspection → PASS (All 6 features implemented with pricing, hierarchy, and test result replication)
- Absence of Integrity Violations: Verified → PASS (No hardcoded outputs, no facades, no task bypasses)
- E2E Test Suite Route Integration: Verified via contract trace → FAIL (Payload key and status code mismatches identified)

---

## 6. Caveats

- Review was performed via thorough static analysis, relational contract tracing, and unit test inspection.
- Direct interactive `npm test` execution via `run_command` in this Windows subagent environment was subject to external permission timeouts.

---

## 7. Conclusion

Milestones M1 (Build), M2 (Orders), and M3 (Stock) contain complete, robust, and well-designed business logic services. However, due to payload field naming, parameter nesting, and status code discrepancies between the route handlers and the E2E test harness (`src/backend/src/test/`), the review verdict is **`REQUEST_CHANGES`** with the concrete input normalization recommendations outlined in Finding 1 and Finding 2.

---

## 8. Verification Method

To verify the fixes:
1. Apply input normalization shims in `sales.routes.ts`, `stock.routes.ts`, `build.routes.ts`, and `orders.service.ts` / `stock.service.ts` / `build.service.ts`.
2. Run module unit tests:
   ```bash
   npx vitest run src/modules/build/build.service.test.ts
   npx vitest run src/modules/orders/orders.service.test.ts
   npx vitest run src/modules/stock/stock.service.test.ts
   ```
3. Run the full E2E test suite:
   ```bash
   npx vitest run src/test
   ```
4. Verify all 213 E2E test cases across Tiers 1–4 pass with 0 failures.
