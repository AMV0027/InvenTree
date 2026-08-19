import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 4 — Scenario 3: Multi-Location Warehouse Transfer & Consolidation', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('executes bulk serialization, multi-warehouse transfer order, and destination bin merge', async () => {
    // 1. Setup multi-location warehouse architecture
    const centralHub = fixtures.seedLocation({ name: 'Central Distribution Hub (Chicago)' });
    const satelliteWarehouse = fixtures.seedLocation({ name: 'Satellite Hub (Dallas)' });
    const part = fixtures.seedPart({ name: 'Optical Transceiver 10G', trackable: true, purchasePrice: 45.0 });

    // 2. Initial bulk stock received at Chicago Hub
    const bulkStock = fixtures.seedStockItem({
      partId: part.id,
      locationId: centralHub.id,
      quantity: 10,
      batch: 'BATCH-OPT-2026-A',
      purchasePrice: 45.0,
    });

    // 3. Serialize 5 units at Chicago for tracking
    const serializeRes = await api.post(app, `/api/stock/${bulkStock.id}/serialize`, {
      quantity: 5,
      serial_numbers: 'OPT-1001, OPT-1002, OPT-1003, OPT-1004, OPT-1005',
    });
    expect(serializeRes.status).toBe(200);

    // 4. Create Transfer Order to ship remaining 5 bulk units to Dallas Hub
    const createToRes = await api.post(app, '/api/order/transfer-order', {
      reference: 'TO-CHI-DAL-001',
      take_from: centralHub.id,
      destination: satelliteWarehouse.id,
    });
    const toId = createToRes.body.id || 1;
    const to = fixtures.seedTransferOrder({
      id: toId,
      status: '10',
      takeFromId: centralHub.id,
      destinationId: satelliteWarehouse.id,
    });
    const toLine = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

    // 5. Allocate remaining bulk stock to Transfer Order
    const allocRes = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
      items: [{ line: toLine.id, stock_item: bulkStock.id, quantity: 5 }],
    });
    expect(allocRes.status).toBe(200);

    // 6. Issue Transfer Order
    const issueRes = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
    expect(issueRes.status).toBe(200);

    // 7. Complete Transfer Order upon freight arrival in Dallas
    const completeRes = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
    expect(completeRes.status).toBe(200);

    // 8. Merge newly arrived stock with existing Dallas buffer stock
    const existingDallasStock = fixtures.seedStockItem({
      partId: part.id,
      locationId: satelliteWarehouse.id,
      quantity: 20,
      purchasePrice: 50.0,
    });

    const mergeRes = await api.post(app, '/api/stock/merge', {
      target: existingDallasStock.id,
      items: [bulkStock.id],
      notes: 'Consolidated inter-warehouse freight into primary Dallas bin',
    });
    expect(mergeRes.status).toBe(200);
  });
});
