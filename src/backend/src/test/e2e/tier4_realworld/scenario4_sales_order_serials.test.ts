import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 4 — Scenario 4: Sales Order Fulfillment with Serial Tracking', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('executes full sales fulfillment pipeline: bulk serialization, range allocation, auto-allocate balance, and dispatch', async () => {
    // 1. Setup customer and sellable products
    const customer = fixtures.seedCompany({ name: 'Global Telecom Ltd', isCustomer: true });
    const serializedProduct = fixtures.seedPart({ name: 'Cellular Basestation Unit', trackable: true, salable: true });
    const bulkAccessory = fixtures.seedPart({ name: 'Mounting Bracket Kit', component: true, salable: true });

    // 2. Initialize inventory
    const bulkUnits = fixtures.seedStockItem({
      partId: serializedProduct.id,
      quantity: 10,
      batch: 'BATCH-BASE-2026',
    });
    const accessoryStock = fixtures.seedStockItem({
      partId: bulkAccessory.id,
      quantity: 50,
      batch: 'BATCH-BRACKET',
    });

    // 3. Serialize 5 units using numeric range syntax
    const serializeRes = await api.post(app, `/api/stock/${bulkUnits.id}/serialize`, {
      quantity: 5,
      serial_numbers: '2001-2005',
    });
    expect(serializeRes.status).toBe(200);

    // 4. Create Sales Order for 3 serialized units and 3 accessory kits
    const createSoRes = await api.post(app, '/api/order/so', {
      reference: 'SO-TEL-2026-088',
      customer: customer.id,
      customer_reference: 'PO-GT-9920',
    });
    expect(createSoRes.status).toBe(201);
    const soId = createSoRes.body.id;

    const line1 = fixtures.seedSalesOrderLineItem({ orderId: soId, partId: serializedProduct.id });
    const line2 = fixtures.seedSalesOrderLineItem({ orderId: soId, partId: bulkAccessory.id });

    // 5. Create Shipment
    const shipmentRes = await api.post(app, '/api/order/so/shipment', {
      order: soId,
      reference: 'DHL-EXPRESS-1',
      tracking_number: 'DHL987654321',
    });
    expect(shipmentRes.status).toBe(201);
    const shipmentId = shipmentRes.body.id;

    // 6. Allocate specific serials (2001, 2002, 2003) to line 1 with shipment
    const serialAllocRes = await api.post(app, `/api/order/so/${soId}/allocate-serials`, {
      line: line1.id,
      serials: '2001, 2002, 2003',
      shipment: shipmentId,
    });
    expect(serialAllocRes.status).toBe(200);

    // 7. Auto-allocate remaining unallocated line (accessories)
    const autoAllocRes = await api.post(app, `/api/order/so/${soId}/auto-allocate`, {});
    expect(autoAllocRes.status).toBe(200);

    // 8. Issue Sales Order to IN_PROGRESS
    const issueRes = await api.post(app, `/api/order/so/${soId}/issue`, {});
    expect(issueRes.status).toBe(200);

    // 9. Dispatch shipment
    const shipShipmentRes = await api.post(app, `/api/order/so/shipment/${shipmentId}/ship`, {});
    expect(shipShipmentRes.status).toBe(200);

    // 10. Mark Sales Order as SHIPPED
    const shipOrderRes = await api.post(app, `/api/order/so/${soId}/ship`, {});
    expect(shipOrderRes.status).toBe(200);
  });
});
