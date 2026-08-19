import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 4 — Scenario 2: Customer Return, Inspection & Re-Stock Lifecycle', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('executes RMA return, inspection hold, quarantine receipt, and variant conversion restock', async () => {
    // 1. Customer and Parts setup
    const customer = fixtures.seedCompany({ name: 'Nordic Electronics AS', isCustomer: true });
    const standardUnit = fixtures.seedPart({ name: 'Commercial Thermostat Base', isTemplate: true, trackable: true });
    const refurbUnit = fixtures.seedPart({ name: 'Refurbished Grade-A Thermostat', variantOfId: standardUnit.id, trackable: true });

    const locQuarantine = fixtures.seedLocation({ name: 'RMA Intake & Quarantine' });
    const locRefurbWarehouse = fixtures.seedLocation({ name: 'Refurbished Goods Warehouse' });

    // Stock currently with customer
    const returnedStock = fixtures.seedStockItem({
      partId: standardUnit.id,
      quantity: 1,
      serial: 'THERMO-SN-8821',
      customerId: customer.id,
      status: '10',
    });

    // 2. Create Return Order
    const createRoRes = await api.post(app, '/api/order/ro', {
      reference: 'RMA-2026-0042',
      customer: customer.id,
      customer_reference: 'NORDIC-CLAIM-99',
    });
    expect(createRoRes.status).toBe(201);
    const roId = createRoRes.body.id;

    // Attach return line
    const roLine = fixtures.seedReturnOrderLineItem({
      orderId: roId,
      itemId: returnedStock.id,
      quantity: 1,
    });

    // 3. Issue Return Order to IN_PROGRESS
    const issueRes = await api.post(app, `/api/order/ro/${roId}/issue`, {});
    expect(issueRes.status).toBe(200);

    // 4. Place on temporary HOLD while awaiting warranty paperwork
    const holdRes = await api.post(app, `/api/order/ro/${roId}/hold`, {});
    expect(holdRes.status).toBe(200);

    // 5. Paperwork verified -> Re-issue Return Order to IN_PROGRESS
    const resumeRes = await api.post(app, `/api/order/ro/${roId}/issue`, {});
    expect(resumeRes.status).toBe(200);

    // 6. Receive unit into Quarantine Inspection Bay
    const receiveRes = await api.post(app, `/api/order/ro/${roId}/receive`, {
      items: [{ line_item: roLine.id, location: locQuarantine.id, quantity: 1, status: '75' }],
    });
    expect(receiveRes.status).toBe(200);

    // 7. Complete the Return Order
    const completeRoRes = await api.post(app, `/api/order/ro/${roId}/complete`, {});
    expect(completeRoRes.status).toBe(200);

    // 8. Quality inspection passes -> Return item to active warehouse inventory
    const returnStockRes = await api.post(app, '/api/stock/return', {
      items: [{ pk: returnedStock.id, location: locRefurbWarehouse.id, status: '10' }],
      notes: 'Passed hardware inspection and burn-in test',
    });
    expect(returnStockRes.status).toBe(200);

    // 9. Convert the stock item to Refurbished variant part
    const convertRes = await api.post(app, `/api/stock/${returnedStock.id}/convert`, {
      part: refurbUnit.id,
      notes: 'Repackaged as Grade-A Certified Refurbished',
    });
    expect(convertRes.status).toBe(200);
  });
});
