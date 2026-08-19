# E2E Test Infra: InvenTree Node.js Hono Backend

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from `ORIGINAL_REQUEST.md` and Python reference specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Interaction) | Tier 4 (Scenario) |
|---|---------|-------------------|:----------------:|:-----------------:|:--------------------:|:-----------------:|
| 1 | Build Scrap Outputs | ORIGINAL_REQUEST R1 | >=5 | >=5 | ✓ | ✓ |
| 2 | Build Auto-Allocate | ORIGINAL_REQUEST R1 | >=5 | >=5 | ✓ | ✓ |
| 3 | Build Allocate | ORIGINAL_REQUEST R1 | >=5 | >=5 | ✓ | ✓ |
| 4 | Build Unallocate | ORIGINAL_REQUEST R1 | >=5 | >=5 | ✓ | ✓ |
| 5 | Build Consume | ORIGINAL_REQUEST R1 | >=5 | >=5 | ✓ | ✓ |
| 6 | Sales Order Allocate | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 7 | Sales Order Allocate Serials | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 8 | Sales Order Auto-Allocate | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 9 | Return Order Hold | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 10 | Return Order Receive | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 11 | Transfer Order Issue | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 12 | Transfer Order Cancel | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 13 | Transfer Order Complete | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 14 | Transfer Order Allocate | ORIGINAL_REQUEST R2 | >=5 | >=5 | ✓ | ✓ |
| 15 | Stock Merge | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |
| 16 | Stock Return | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |
| 17 | Stock Convert | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |
| 18 | Stock Install | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |
| 19 | Stock Uninstall | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |
| 20 | Stock Serialize | ORIGINAL_REQUEST R3 | >=5 | >=5 | ✓ | ✓ |

## Test Architecture
- **Runner**: Vitest (v4.1.11)
- **Command**: `npm test` inside `src/backend`
- **Location**:
  - `src/backend/src/modules/build/*.test.ts`
  - `src/backend/src/modules/orders/*.test.ts`
  - `src/backend/src/modules/stock/*.test.ts`
  - `src/backend/src/test/e2e/*.test.ts` (Tiers 1-4)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Manufacturing Lifecycle | Build Auto-Allocate -> Manual Adjust -> Consume (Deplete & Split) -> Stock Install -> Build Complete | High |
| 2 | Customer Return, Inspection & Re-Stock | Return Order Issue -> Hold -> Receive into Quarantine -> Stock Return / Conversion | High |
| 3 | Multi-Location Warehouse Transfer | Stock Serialize -> Transfer Order Allocate -> Issue -> Complete (Move location) -> Stock Merge | High |
| 4 | Sales Order Fulfillment with Serial Tracking | Bulk Stock Serialization -> SO Serial Allocation -> Auto-Allocate balance -> Order Shipment | High |
| 5 | Modular Assembly & Teardown Lifecycle | Stock Conversion -> Stock Install to Assembly -> Build Output Scrap -> Stock Uninstall back to Warehouse | High |

## Coverage Thresholds
- Tier 1: >=5 test cases per feature (>=100 tests)
- Tier 2: >=5 boundary/error cases per feature (>=100 tests)
- Tier 3: Pairwise combinations across major subsystems
- Tier 4: >=5 realistic full-lifecycle application workflows
- **Acceptance**: 100% of tests passing with exit code 0
