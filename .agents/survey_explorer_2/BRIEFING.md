# BRIEFING — 2026-08-18T18:28:00Z

## Mission
Probe and document authoritative specification for R2: Sales, Return, and Transfer Order Operations.

## 🔒 My Identity
- Archetype: spec_miner
- Roles: teamwork_preview_spec_miner
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2
- Original parent: f65f6a9c-b007-4622-a87a-1a9890a76837
- Milestone: Discovery / Specification Mining

## 🔒 Key Constraints
- Read-only on production source code (no implementation)
- Output findings to `report.md` and `handoff.md`
- Subagent must notify parent via `send_message`

## Current Parent
- Conversation ID: f65f6a9c-b007-4622-a87a-1a9890a76837
- Updated: 2026-08-18T18:28:00Z

## Task Summary
- **What to build/probe**: Specification mining for R2 endpoints (`so/:pk/allocate`, `so/:pk/allocate-serials`, `so/:pk/auto-allocate`, `ro/:pk/hold`, `ro/:pk/receive`, `transfer-order/:pk/issue`, `transfer-order/:pk/cancel`, `transfer-order/:pk/complete`, `transfer-order/:pk/allocate`).
- **Success criteria**: Comprehensive `report.md` and `handoff.md` created; parent notified.
- **Interface contracts**: Authoritative Python DRF API views, serializers, models in `src/backend_backup/InvenTree/order/` and `stock/`.

## Key Decisions Made
- Extracted exact status code definitions and discrepancies in TS backend.
- Documented complete payload schemas, validation rules, stock splitting, stock consumption, location updates, and `StockItemTracking` entries for all 9 target endpoints plus related action endpoints.
- Provided Prisma schema mapping for all affected models.

## Artifact Index
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\report.md` — Detailed R2 Specification Report
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\handoff.md` — 5-Component Handoff Report
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\progress.md` — Progress tracker
- `c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_2\DISPATCH.md` — Dispatch record
