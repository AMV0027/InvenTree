import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 4 — Scenario 5: Modular Assembly, Scrap & Teardown Lifecycle', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('executes variant conversion, assembly installation, scrap handling, and modular component teardown recovery', async () => {
    // 1. Define modular system hierarchy
    const chassisTemplate = fixtures.seedPart({ name: 'Chassis Base Plate', isTemplate: true });
    const reinforcedChassis = fixtures.seedPart({ name: 'Reinforced Rugged Chassis', variantOfId: chassisTemplate.id, assembly: true });
    const moduleCard = fixtures.seedPart({ name: 'DSP Expansion Card', component: true, trackable: true });

    const bom = fixtures.seedBomItem({ partId: reinforcedChassis.id, subPartId: moduleCard.id, quantity: 1 });

    const locWarehouse = fixtures.seedLocation({ name: 'Main Warehouse' });
    const locScrap = fixtures.seedLocation({ name: 'Scrap/Recycling Bin' });
    const locSpares = fixtures.seedLocation({ name: 'Recovered Spare Parts Shelf' });

    // 2. Base chassis stock in warehouse
    const chassisStock = fixtures.seedStockItem({
      partId: chassisTemplate.id,
      locationId: locWarehouse.id,
      quantity: 1,
    });
    const dspStock = fixtures.seedStockItem({
      partId: moduleCard.id,
      locationId: locWarehouse.id,
      quantity: 1,
      serial: 'DSP-9901',
    });

    // 3. Convert chassis base stock to Reinforced Rugged variant
    const convertRes = await api.post(app, `/api/stock/${chassisStock.id}/convert`, {
      part: reinforcedChassis.id,
      notes: 'Upgraded with structural reinforcement bars',
    });
    expect(convertRes.status).toBe(200);

    // 4. Install DSP module into reinforced chassis
    const installRes = await api.post(app, `/api/stock/${dspStock.id}/install`, {
      target: chassisStock.id,
      quantity: 1,
      notes: 'Installed DSP card into slot 1',
    });
    expect(installRes.status).toBe(200);

    // 5. Create Build Order representing sub-assembly production
    const build = fixtures.seedBuildOrder({ partId: reinforcedChassis.id, status: '20', quantity: 1 });
    const output = fixtures.seedStockItem({
      partId: reinforcedChassis.id,
      quantity: 1,
      isBuilding: true,
      buildId: build.id,
    });

    // 6. Quality test fails on outer chassis during manufacturing -> Scrap output frame
    const scrapRes = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
      location: locScrap.id,
      outputs: [{ output: output.id, quantity: 1, notes: 'Chassis cracked in stress testing' }],
    });
    expect(scrapRes.status).toBe(200);

    // 7. Recover / Uninstall the valuable DSP expansion card back into spare parts inventory
    const uninstallRes = await api.post(app, `/api/stock/${dspStock.id}/uninstall`, {
      location: locSpares.id,
      notes: 'Teardown salvage: recovered functioning DSP card for future builds',
    });
    expect(uninstallRes.status).toBe(200);

    // 8. Return salvaged component to active stock
    const returnStockRes = await api.post(app, '/api/stock/return', {
      items: [{ pk: dspStock.id, location: locSpares.id, status: '10' }],
      notes: 'Returned salvaged card to stockroom',
    });
    expect(returnStockRes.status).toBe(200);
  });
});
