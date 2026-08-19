# BRIEFING — 2026-08-18T18:22:50Z

## Mission
Probe and document the authoritative specification and current implementation for Stock Item Actions & Test Infrastructure (R3): /api/stock/merge, /api/stock/return, /api/stock/:pk/convert, /api/stock/:pk/install, /api/stock/:pk/uninstall, /api/stock/:pk/serialize, and overall Vitest test harness in src/backend.

## 🔒 My Identity
- Archetype: teamwork_preview_spec_miner
- Roles: Specification Miner
- Working directory: c:\Companies\BloomBig\saas_applications\InvenTree\.agents\survey_explorer_3
- Original parent: f65f6a9c-b007-4622-a87a-1a9890a76837
- Milestone: Survey & Spec Mining

## 🔒 Key Constraints
- Read-only on implementation; do not implement or modify production code.
- Probe authoritative Python reference implementation and current TypeScript backend.
- Enumerate precise interfaces, validation rules, error formats, serialization/merge mechanics, tracking logs, test harness setup.
- Document in report.md and handoff.md; notify parent when done.

## Current Parent
- Conversation ID: f65f6a9c-b007-4622-a87a-1a9890a76837
- Updated: 2026-08-18T18:22:50Z

## Task Summary
- **What to build**: Specification report on Stock Item Actions & Test Infrastructure
- **Success criteria**: Exhaustive catalog of endpoints, request/response schemas, error handling, status codes, business rules (merge, return, convert, install, uninstall, serialize), tracking logging, and complete Vitest test infrastructure analysis.
- **Status**: Completed.

## Key Decisions Made
- Extracted comprehensive specifications from authoritative Python implementation (`src/backend_backup/InvenTree/stock`) and mapped against TypeScript Hono/Prisma codebase.
- Documented full table of Features Discovered and Edge Cases.
- Verified existing Vitest test suite (`npm test`, 28/28 tests passing).

## Artifact Index
- `.agents/survey_explorer_3/DISPATCH.md` — Initial dispatch prompt
- `.agents/survey_explorer_3/BRIEFING.md` — Persistent working memory
- `.agents/survey_explorer_3/progress.md` — Liveness & progress tracking
- `.agents/survey_explorer_3/report.md` — Comprehensive findings & spec tables
- `.agents/survey_explorer_3/handoff.md` — Handoff report with 5 components
