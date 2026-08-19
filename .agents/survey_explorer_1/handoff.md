# Handoff Report: R1. Build Order Operations Specification

**Author:** survey_explorer_1 (teamwork_preview_spec_miner)  
**Date:** 2026-08-18  
**Scope:** M1 - Exploration & Specification Mining for Build Order Operations (R1)

---

## 1. Observation

1. **Node.js Hono Backend Current State (`src/backend/src/modules/build/build.routes.ts:122-126`):**
   ```typescript
   buildRouter.post('/api/build/:pk/scrap-outputs', (c) => c.json({ success: true }));
   buildRouter.post('/api/build/:pk/auto-allocate', (c) => c.json({ success: true }));
   buildRouter.post('/api/build/:pk/allocate', (c) => c.json({ success: true }));
   buildRouter.post('/api/build/:pk/unallocate', (c) => c.json({ success: true }));
   buildRouter.post('/api/build/:pk/consume', (c) => c.json({ success: true }));
   ```
   All five target endpoints currently return mocked `{ success: true }` responses without validation, database mutations, stock decrements, or tracking logs.
   Also observed status enum misalignment in `build.routes.ts:8`:
   `const BuildStatus = { PENDING: '10', PRODUCTION: '20', ON_HOLD: '25', COMPLETE: '30', CANCELLED: '40' } as const;`

2. **Authoritative Python Implementation (`src/backend_backup/InvenTree/build/api.py` and `build/status_codes.py`):**
   - `build/status_codes.py:11-15`:
     - `PENDING = 10`
     - `PRODUCTION = 20`
     - `ON_HOLD = 25`
     - `CANCELLED = 30`
     - `COMPLETE = 40`
   - `build/api.py:774-819`: `BuildOutputScrap` accepts `outputs`, `location`, `notes`, `discard_allocations`.
   - `build/api.py:910-957`: `BuildAutoAllocate` accepts `location`, `exclude_location`, `interchangeable`, `substitutes`, `optional_items`, `item_type`, `stock_sort_by`, `build_lines`.
   - `build/api.py:958-972`: `BuildAllocate` accepts `items: [{ build_line, stock_item, quantity, output }]`.
   - `build/api.py:423-448`: `BuildUnallocate` accepts `build_line`, `output`.
   - `build/api.py:973-1012`: `BuildConsume` accepts `items: [{ build_item, quantity }]`, `lines: [{ build_line }]`, `notes`.

3. **Core Business Logic in Python Models (`src/backend_backup/InvenTree/build/models.py` & `stock/models.py`):**
   - `build/models.py:1298`: `scrap_build_output` validates `is_building == true`, output build match, splits stock if quantity is partial, moves to scrap location with `status = StockStatus.REJECTED` (65), handles component allocations (complete vs discard), and adds tracking code `BUILD_OUTPUT_REJECTED` (56).
   - `build/models.py:1752`: `auto_allocate_untracked_stock` skips consumable parts and optional parts, finds direct/variant/substitute parts, filters available in-stock untracked items, applies priority sorting (direct > variant > substitute), and skips ambiguous allocations if `interchangeable == false`.
   - `build/models.py:1642`: `auto_allocate_tracked_output` matches serialized tracked component parts having matching serial numbers (`item.serial == output.serial`) to build outputs.
   - `build/models.py:1511`: `allocate_stock` merges duplicate allocations into existing `BuildItem`s, validates against unallocated available stock, and requires `output` for trackable parts.
   - `build/models.py:1081`: `deallocate_stock` removes `BuildItem` records matching `build_line` and/or `output`.
   - `build/models.py:663`: `complete_allocations` calculates consumed quantities, splits stock items when consuming partial quantity, updates `belongs_to` for trackable parts, logs tracking (`BUILD_CONSUMED: 57`, `INSTALLED_INTO_ASSEMBLY: 30`, `INSTALLED_CHILD_ITEM: 35`, `SPLIT_FROM_PARENT: 40`, `SPLIT_CHILD_ITEM: 42`), increments `buildline.consumed`, and updates/deletes `BuildItem`s.
   - `stock/models.py:3208`: `setQuantity` deletes depleted stock items when `delete_on_deplete == true` and `can_delete() == true`.

4. **Prisma Database Schema (`src/backend/prisma/schema.prisma`):**
   - `Build`: `build_build` table
   - `Buildline`: `build_build_line` table
   - `Builditem`: `build_build_item` table (`buildLineId`, `stockItemId`, `quantity`, `installIntoId`)
   - `Stockitem`: `stock_stock_item` table (`quantity`, `isBuilding`, `status`, `locationId`, `belongsToId`, `consumedById`, `deleteOnDeplete`, `parentId`)
   - `Stockitemtracking`: `stock_stock_item_tracking` table (`trackingType`, `date`, `notes`, `deltas`, `itemId`, `userId`)
   - `Bomitem` & `Bomitemsubstitute`: `part_bom_item` & `part_bom_item_substitute` tables.

5. **Existing Unit Tests in `src/backend` (`src/backend/src/modules/build/build.service.test.ts`):**
   - 6 existing validation unit tests for `validateBuildOrder` and `validateBuildItemAllocation`. All 28 tests in vitest pass.

---

## 2. Logic Chain

1. From Observation 1, the Hono routes for the 5 build operations are stubs returning `{ success: true }` without executing any business rules.
2. From Observation 2 & 3, the Python reference implementation specifies complete validation requirements, payload schemas, error status codes (400 / 404), and exact stock alteration semantics.
3. From Observation 3 & 4, all necessary relational models (`Build`, `Buildline`, `Builditem`, `Stockitem`, `Stockitemtracking`, `Bomitem`, `Bomitemsubstitute`, `Part`) already exist in Prisma schema with full mapping to the underlying SQLite/Postgres tables.
4. From Observation 1 & 2, `BuildStatus` in `src/modules/build/build.routes.ts` has inverted values for `COMPLETE` and `CANCELLED`, which must be corrected (`COMPLETE = '40'`, `CANCELLED = '30'`).
5. Therefore, the implementation in `src/backend/src/modules/build/build.service.ts` can be constructed with complete fidelity to the reference specification, supported by comprehensive unit and integration tests.

---

## 3. Caveats

- Background task queuing (Celery/Django Q offload) in the Python codebase is executed asynchronously for bulk operations, whereas in the Node.js TypeScript backend these operations run synchronously within Prisma database transactions.
- Plugin event hooks (e.g. `trigger_event(BuildEvents.COMPLETED)`) can be triggered synchronously or omitted if the plugin subsystem is not active in demo mode.
- Location hierarchy traversal in auto-allocation (`location.get_descendants()`) can be implemented by querying child locations or matching `locationId`.

---

## 4. Conclusion

The specification mining for R1 (Build Order Operations) is complete. The exact payload formats, validation rules, stock splitting algorithms, tracking codes, and edge case behaviors have been fully discovered and documented in `.agents/survey_explorer_1/report.md`.

---

## 5. Verification Method

To verify the findings and authoritative specifications:
1. Inspect the full specification report in `.agents/survey_explorer_1/report.md`.
2. Cross-reference endpoints in `src/backend_backup/InvenTree/build/api.py` and serializers in `src/backend_backup/InvenTree/build/serializers.py`.
3. Inspect model logic in `src/backend_backup/InvenTree/build/models.py` (lines 663-930, 1081-1094, 1298-1369, 1511-1640, 1752-1947).
4. Run the current unit tests in the Node backend: `npm test` in `src/backend`.
