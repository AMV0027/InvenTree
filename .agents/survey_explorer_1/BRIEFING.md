# BRIEFING — 2026-08-18T18:27:00Z

## Mission
Discover and document complete specifications for Build Order Operations (R1) by probing the authoritative Python reference implementation and current Node.js backend.

## 🔒 My Identity
- Archetype: teamwork_preview_spec_miner
- Roles: Teamwork specialist, Specification Miner
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_1
- Original parent: f65f6a9c-b007-4622-a87a-1a9890a76837
- Milestone: M1 - Exploration & Specification Mining

## 🔒 Key Constraints
- Read-only exploration: Do NOT implement code changes.
- Prioritize authoritative sources (Python InvenTree codebase/tests/models) over LLM prior knowledge.
- Fully probe all discovered features and edge cases.
- Write report to .agents/survey_explorer_1/report.md and handoff to .agents/survey_explorer_1/handoff.md.

## Current Parent
- Conversation ID: f65f6a9c-b007-4622-a87a-1a9890a76837
- Updated: 2026-08-18T18:27:00Z

## Task Summary
- **What to build**: Specification discovery for Build Order Operations:
  - `/api/build/:pk/scrap-outputs`
  - `/api/build/:pk/auto-allocate`
  - `/api/build/:pk/allocate`
  - `/api/build/:pk/unallocate`
  - `/api/build/:pk/consume`
- **Success criteria**: Exhaustive extraction of schemas, business logic, DB models, BOM relations, allocation algorithms, stock consumption, deleteOnDeplete, tracking/history, statuses, responses, and error handling.
- **Interface contracts**: ORIGINAL_REQUEST.md
- **Code layout**: `src/backend/src/modules/build/*` and Python reference files `src/backend_backup/InvenTree/*`

## Key Decisions Made
- Discovered and documented the complete specification, schemas, validation rules, stock splitting mechanics, deleteOnDeplete rules, and tracking codes for all 5 Build Order endpoints.
- Documented status enum correction (`CANCELLED: '30'`, `COMPLETE: '40'`).
- Produced comprehensive `report.md` and 5-component `handoff.md`.

## Artifact Index
- `report.md` — Full specification discovery report
- `handoff.md` — 5-component handoff report
- `progress.md` — Heartbeat and progress tracker
- `DISPATCH.md` — Dispatch record
