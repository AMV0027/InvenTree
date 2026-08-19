import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 3: Cross-Subsystem Combinations (Build + Orders + Stock)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('3.7 Combination: Multi-Subsystem Build-to-Order Pipeline (SO Creation -> Build Order -> Stock Consumption -> SO Allocation -> Shipment)', async () => {
    // Setup parts
    const finishedProduct = fixtures.seedPart({ name: 'Custom Industrial Drone', assembly: true, salable: true });
    const battery = fixtures.seedPart({ name: 'High Capacity LiPo Battery', component: true });
    const controller = fixtures.seedPart({ name: 'Flight Controller', component: true });
    const bom1 = fixtures.seedBomItem({ partId: finishedProduct.id, subPartId: battery.id, quantity: 1 });
    const bom2 = fixtures.seedBomItem({ partId: finishedProduct.id, subPartId: controller.id, quantity: 1 });

    // Seed raw component stock
    const batteryStock = fixtures.seedStockItem({ partId: battery.id, quantity: 10 });
    const controllerStock = fixtures.seedStockItem({ partId: controller.id, quantity: 10 });

    // Step 1: Customer places Sales Order
    const customer = fixtures.seedCompany({ name: 'AeroTech Solutions', isCustomer: true });
    const so = fixtures.seedSalesOrder({ customerId: customer.id, status: '10' });
    const soLine = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: finishedProduct.id });

    // Step 2: Create linked Build Order to fulfill SO
    const build = fixtures.seedBuildOrder({
      partId: finishedProduct.id,
      salesOrderId: so.id,
      quantity: 1,
      status: '20',
    });
    const buildLine1 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom1.id, quantity: 1 });
    const buildLine2 = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom2.id, quantity: 1 });

    // Step 3: Auto-allocate components to build
    const autoAllocRes = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
    expect(autoAllocRes.status).toBe(200);

    // Step 4: Create Build Output
    const droneOutput = fixtures.seedStockItem({
      partId: finishedProduct.id,
      quantity: 1,
      isBuilding: true,
      buildId: build.id,
      serial: 'DRONE-2026-001',
    });

    // Step 5: Consume components and complete build
    const consumeRes = await api.post(app, `/api/build/${build.id}/consume`, {});
    expect(consumeRes.status).toBe(200);

    const finishBuildRes = await api.post(app, `/api/build/${build.id}/complete`, {});
    expect(finishBuildRes.status).toBe(200);

    // Step 6: Allocate finished drone output to Sales Order
    const soAllocRes = await api.post(app, `/api/order/so/${so.id}/allocate`, {
      items: [{ line: soLine.id, stock_item: droneOutput.id, quantity: 1 }],
    });
    expect(soAllocRes.status).toBe(200);

    // Step 7: Issue & Ship Sales Order
    const issueSoRes = await api.post(app, `/api/order/so/${so.id}/issue`, {});
    expect(issueSoRes.status).toBe(200);

    const shipSoRes = await api.post(app, `/api/order/so/${so.id}/ship`, {});
    expect(shipSoRes.status).toBe(200);
  });

  it('3.8 Combination: Transfer Order supply replenish -> Auto-allocate to Build -> Partial Scrap -> Output Serialized', async () => {
    const rawLoc = fixtures.seedLocation({ name: 'Central Receiving Depot' });
    const factoryLoc = fixtures.seedLocation({ name: 'Assembly Line Station' });
    const widget = fixtures.seedPart({ name: 'Widget Assembly', assembly: true, trackable: true });
    const fastener = fixtures.seedPart({ name: 'Titanium Bolt', component: true });
    const bom = fixtures.seedBomItem({ partId: widget.id, subPartId: fastener.id, quantity: 4 });

    // Central depot stock
    const centralStock = fixtures.seedStockItem({ partId: fastener.id, locationId: rawLoc.id, quantity: 100 });

    // 1. Transfer fastener stock to assembly line station
    const to = fixtures.seedTransferOrder({ status: '10', takeFromId: rawLoc.id, destinationId: factoryLoc.id });
    const toLine = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: fastener.id });
    await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
      items: [{ line: toLine.id, stock_item: centralStock.id, quantity: 40 }],
    });
    await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
    await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});

    // 2. Build order on assembly line
    const build = fixtures.seedBuildOrder({ partId: widget.id, quantity: 5, status: '20', destinationId: factoryLoc.id });
    fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 20 });
    await api.post(app, `/api/build/${build.id}/auto-allocate`, {});

    // 3. Create 5 outputs
    const outputStock = fixtures.seedStockItem({
      partId: widget.id,
      quantity: 5,
      isBuilding: true,
      buildId: build.id,
      locationId: factoryLoc.id,
    });

    // 4. Scrap 1 defective output
    await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
      outputs: [{ output: outputStock.id, quantity: 1, notes: 'Defective frame thread' }],
    });

    // 5. Consume components & complete build
    await api.post(app, `/api/build/${build.id}/consume`, {});
    await api.post(app, `/api/build/${build.id}/complete`, {});

    // 6. Serialize the remaining 4 outputs
    const serializeRes = await api.post(app, `/api/stock/${outputStock.id}/serialize`, {
      quantity: 4,
      serial_numbers: 'WID-01, WID-02, WID-03, WID-04',
    });
    expect(serializeRes.status).toBe(200);
  });
});
