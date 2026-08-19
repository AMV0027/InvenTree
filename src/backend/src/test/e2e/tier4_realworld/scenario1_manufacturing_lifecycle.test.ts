import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 4 — Scenario 1: Full Manufacturing Lifecycle', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('executes full end-to-end manufacturing workflow from BOM through finished assembly', async () => {
    // 1. Define BOM and Part Master
    const finishedPart = fixtures.seedPart({ name: 'Smart IoT Gateway Unit', assembly: true, trackable: true });
    const mainBoard = fixtures.seedPart({ name: 'Mainboard v3.2', component: true, trackable: true });
    const powerUnit = fixtures.seedPart({ name: '24V PSU Module', component: true });
    const casing = fixtures.seedPart({ name: 'IP67 Aluminum Enclosure', component: true });

    const bom1 = fixtures.seedBomItem({ partId: finishedPart.id, subPartId: mainBoard.id, quantity: 1 });
    const bom2 = fixtures.seedBomItem({ partId: finishedPart.id, subPartId: powerUnit.id, quantity: 1 });
    const bom3 = fixtures.seedBomItem({ partId: finishedPart.id, subPartId: casing.id, quantity: 1 });

    // 2. Inventory initialization in warehouse
    const locMain = fixtures.seedLocation({ name: 'Factory Production Floor' });
    const mainBoardStock1 = fixtures.seedStockItem({ partId: mainBoard.id, locationId: locMain.id, quantity: 1, serial: 'MB-001' });
    const mainBoardStock2 = fixtures.seedStockItem({ partId: mainBoard.id, locationId: locMain.id, quantity: 1, serial: 'MB-002' });
    const psuStock = fixtures.seedStockItem({ partId: powerUnit.id, locationId: locMain.id, quantity: 10 });
    const casingStock = fixtures.seedStockItem({ partId: casing.id, locationId: locMain.id, quantity: 10, deleteOnDeplete: true });

    // 3. Create Build Order for 2 units
    const createBuildRes = await api.post(app, '/api/build', {
      reference: 'BO-IOT-2026-001',
      title: 'Batch 1 IoT Gateways',
      part: finishedPart.id,
      quantity: 2,
    });
    expect(createBuildRes.status).toBe(201);
    const buildId = createBuildRes.body.id;

    // Create lines for BOM items
    const line1 = fixtures.seedBuildLine({ buildId, bomItemId: bom1.id, quantity: 2 });
    const line2 = fixtures.seedBuildLine({ buildId, bomItemId: bom2.id, quantity: 2 });
    const line3 = fixtures.seedBuildLine({ buildId, bomItemId: bom3.id, quantity: 2 });

    // 4. Issue Build Order to PRODUCTION
    const issueRes = await api.post(app, `/api/build/${buildId}/issue`, {});
    expect(issueRes.status).toBe(200);

    // 5. Auto-allocate standard bulk components (PSU, Enclosure)
    const autoAllocRes = await api.post(app, `/api/build/${buildId}/auto-allocate`, {});
    expect(autoAllocRes.status).toBe(200);

    // 6. Create discrete build outputs for serialized finished units
    const output1 = fixtures.seedStockItem({
      partId: finishedPart.id,
      quantity: 1,
      isBuilding: true,
      buildId,
      serial: 'IOT-GATEWAY-1001',
      locationId: locMain.id,
    });
    const output2 = fixtures.seedStockItem({
      partId: finishedPart.id,
      quantity: 1,
      isBuilding: true,
      buildId,
      serial: 'IOT-GATEWAY-1002',
      locationId: locMain.id,
    });

    // 7. Manually allocate specific serialized mainboards to specific output units
    const manualAllocRes = await api.post(app, `/api/build/${buildId}/allocate`, {
      items: [
        { build_line: line1.id, stock_item: mainBoardStock1.id, quantity: 1, install_into: output1.id },
        { build_line: line1.id, stock_item: mainBoardStock2.id, quantity: 1, install_into: output2.id },
      ],
    });
    expect(manualAllocRes.status).toBe(200);

    // 8. Consume all allocated components
    const consumeRes = await api.post(app, `/api/build/${buildId}/consume`, {
      notes: 'Final assembly and functional testing complete',
    });
    expect(consumeRes.status).toBe(200);

    // 9. Stock install trackable components into final assembly
    const install1 = await api.post(app, `/api/stock/${mainBoardStock1.id}/install`, {
      target: output1.id,
      quantity: 1,
    });
    expect(install1.status).toBe(200);

    const install2 = await api.post(app, `/api/stock/${mainBoardStock2.id}/install`, {
      target: output2.id,
      quantity: 1,
    });
    expect(install2.status).toBe(200);

    // 10. Complete the Build Order
    const finishRes = await api.post(app, `/api/build/${buildId}/complete`, {});
    expect(finishRes.status).toBe(200);
  });
});
