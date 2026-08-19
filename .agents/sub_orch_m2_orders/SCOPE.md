# Scope: Milestone M2 - Sales, Return, and Transfer Order Operations (R2)

## Architecture
Order operations and lifecycle management:
- Sales Orders (SO): Stock allocation, serial parsing/allocation (`/allocate-serials`), auto-allocation (`/auto-allocate` sorting FIFO/location/expiry/batch)
- Return Orders (RO): Hold status (`/hold`), receive items with quarantine location tracking (`/receive`)
- Transfer Orders (TO): Allocate stock items (`/allocate`), Issue order (`/issue`), Cancel order (`/cancel` reverting stock), Complete order (`/complete` moving stock to destination location)
- Status Code enums: SOStatus, ROStatus, TOStatus, POStatus aligned with InvenTree standard integer codes

## Exclusive Write Files
- `src/backend/src/modules/orders/sales.routes.ts`
- `src/backend/src/modules/orders/purchase.routes.ts`
- `src/backend/src/modules/orders/order.service.ts`
- `src/backend/src/modules/orders/orders.test.ts`

## Iteration Plan
1. Exploration: 3 Explorers (1 spec miner, 2 codebase & test explorers)
2. Implementation: 1 Worker
3. Review & Verification: 2 Reviewers, 2 Challengers, 1 Forensic Auditor
4. Gate evaluation & Reporting to parent

## Status
- Milestone: IN_PROGRESS
- Iteration: 1
