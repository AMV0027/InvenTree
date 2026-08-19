# Scope: Milestone M3 — Stock Item Actions (R3)

## Architecture
- Module: `src/backend/src/modules/stock`
- Routes: `src/backend/src/modules/stock/stock.routes.ts`
- Service: `src/backend/src/modules/stock/stock.service.ts`
- Tests: `src/backend/src/modules/stock/stock.service.test.ts`

## Target Endpoints & Operations
1. `POST /api/stock/merge`
   - Merge multiple stock items into a single target stock item or create a merged stock item.
   - Requirements: All items must have same part; handle allocation transfer (transfer existing build/sales order allocations to merged item or reallocate appropriately); update quantities; delete or mark merged items; audit/history logging.
2. `POST /api/stock/return`
   - Return stock item from customer or internal location.
   - Requirements: Update status, location, notes, quantity, and tracking records.
3. `POST /api/stock/:pk/convert`
   - Convert stock item to a variant part.
   - Requirements: Validate variant compatibility (target part must be a valid variant/child or template-compatible variant of source part); update part reference; log conversion.
4. `POST /api/stock/:pk/install`
   - Install a stock item into a parent stock item (assembly/sub-assembly relationship).
   - Requirements: Validate part assembly BOM rules; set `belongs_to` / `parent` relationship; update location/status to match parent; handle quantity constraints (usually quantity 1 for serialized, or decrement quantity and attach).
5. `POST /api/stock/:pk/uninstall`
   - Remove/uninstall a stock item from parent assembly.
   - Requirements: Detach from parent (`belongs_to` = null); set destination location/status; log history.
6. `POST /api/stock/:pk/serialize`
   - Convert bulk quantity stock item into N serialized stock items with serial numbers.
   - Requirements: Validate serial number range/availability; create individual stock items each with quantity 1 (or configured unit); copy relevant test results, parameters, and metadata; reduce bulk item quantity or delete if fully serialized.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M3 | Stock Item Actions | merge, return, convert, install, uninstall, serialize | M1 (Part Model), M2 (Stock Core) | IN_PROGRESS |

## Exclusive Write Files
- `src/backend/src/modules/stock/stock.routes.ts`
- `src/backend/src/modules/stock/stock.service.ts`
- `src/backend/src/modules/stock/stock.service.test.ts`
