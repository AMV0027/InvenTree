import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 3: Build ↔ Stock Subsystem Interactions', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('3.1 Interaction: Auto-allocate component stock -> Manual adjustment -> Consumption -> Stock Install into finished assembly', async () => {
    // Setup assembly hierarchy
    const chassis = fixtures.seedPart({ name: 'Robotic Chassis', assembly: true, trackable: true });
    const motor = fixtures.seedPart({ name: 'Servo Motor 24V', component: true, trackable: true });
    const bom = fixtures.seedBomItem({ partId: chassis.id, subPartId: motor.id, quantity: 2 });
    
    // Seed warehouse stock
    const motorStock1 = fixtures.seedStockItem({ partId: motor.id, quantity: 1, serial: 'MTR-001' });
    const motorStock2 = fixtures.seedStockItem({ partId: motor.id, quantity: 1, serial: 'MTR-002' });

    // Step 1: Create Build Order
    const build = fixtures.seedBuildOrder({ partId: chassis.id, quantity: 1, status: '20' });
    const buildLine = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });

    // Step 2: Auto-allocate
    const autoAllocRes = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
    expect(autoAllocRes.status).toBe(200);

    // Step 3: Create Build Output
    const output = fixtures.seedStockItem({
      partId: chassis.id,
      quantity: 1,
      isBuilding: true,
      buildId: build.id,
      serial: 'CHAS-900',
    });

    // Step 4: Manually allocate specific serials to output
    const allocRes = await api.post(app, `/api/build/${build.id}/allocate`, {
      items: [
        { build_line: buildLine.id, stock_item: motorStock1.id, quantity: 1, install_into: output.id },
        { build_line: buildLine.id, stock_item: motorStock2.id, quantity: 1, install_into: output.id },
      ],
    });
    expect(allocRes.status).toBe(200);

    // Step 5: Consume allocations
    const consumeRes = await api.post(app, `/api/build/${build.id}/consume`, {});
    expect(consumeRes.status).toBe(200);

    // Step 6: Verify Stock Install into output
    const installRes = await api.post(app, `/api/stock/${motorStock1.id}/install`, {
      target: output.id,
      quantity: 1,
    });
    expect(installRes.status).toBe(200);
  });

  it('3.2 Interaction: Build Output Creation -> Partial Scrap Output Split -> Remainder Completed', async () => {
    const pcbPart = fixtures.seedPart({ name: 'Mainboard Rev C', assembly: true });
    const scrapLoc = fixtures.seedLocation({ name: 'Scrap & Defect Bin' });
    const build = fixtures.seedBuildOrder({ partId: pcbPart.id, quantity: 10, status: '20' });

    // Step 1: Create 10 build outputs in batch
    const output = fixtures.seedStockItem({
      partId: pcbPart.id,
      quantity: 10,
      isBuilding: true,
      buildId: build.id,
      batch: 'BATCH-2026-X',
    });

    // Step 2: Scrap 2 defective units
    const scrapRes = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
      location: scrapLoc.id,
      outputs: [{ output: output.id, quantity: 2, notes: 'Failed voltage regulator check' }],
    });
    expect(scrapRes.status).toBe(200);

    // Step 3: Complete Build Order
    const completeRes = await api.post(app, `/api/build/${build.id}/complete`, {});
    expect(completeRes.status).toBe(200);
  });

  it('3.3 Interaction: Unallocate Stock -> Convert Variant Part -> Re-allocate Converted Stock to Build', async () => {
    const parentPart = fixtures.seedPart({ name: 'Processor Generic', isTemplate: true });
    const specA = fixtures.seedPart({ name: 'Processor 2.0GHz', variantOfId: parentPart.id });
    const specB = fixtures.seedPart({ name: 'Processor 2.4GHz Overclocked', variantOfId: parentPart.id });
    const system = fixtures.seedPart({ name: 'Gaming PC', assembly: true });
    const bom = fixtures.seedBomItem({ partId: system.id, subPartId: specB.id, quantity: 1, allowVariants: true });

    const stockItem = fixtures.seedStockItem({ partId: specA.id, quantity: 1 });
    const build = fixtures.seedBuildOrder({ partId: system.id, quantity: 1, status: '20' });
    const buildLine = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });

    // Step 1: Initial unallocation cleanup
    const unallocRes = await api.post(app, `/api/build/${build.id}/unallocate`, {});
    expect(unallocRes.status).toBe(200);

    // Step 2: Convert stock from specA to specB
    const convertRes = await api.post(app, `/api/stock/${stockItem.id}/convert`, {
      part: specB.id,
    });
    expect(convertRes.status).toBe(200);

    // Step 3: Allocate converted stock to build line
    const allocRes = await api.post(app, `/api/build/${build.id}/allocate`, {
      items: [{ build_line: buildLine.id, stock_item: stockItem.id, quantity: 1 }],
    });
    expect(allocRes.status).toBe(200);
  });
});
