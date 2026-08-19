import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 3: Orders ↔ Stock Subsystem Interactions', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  it('3.4 Interaction: Bulk Stock Serialization -> SO Serial Allocation -> Shipment Dispatch', async () => {
    const part = fixtures.seedPart({ name: 'Smart Energy Meter', trackable: true, salable: true });
    const bulkStock = fixtures.seedStockItem({ partId: part.id, quantity: 4 });
    const so = fixtures.seedSalesOrder({ status: '10' });
    const soLine = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
    const shipment = fixtures.seedSalesOrderShipment({ orderId: so.id, reference: 'FEDEX-EXPRESS' });

    // Step 1: Serialize bulk stock into 4 discrete serialized items
    const serializeRes = await api.post(app, `/api/stock/${bulkStock.id}/serialize`, {
      quantity: 4,
      serial_numbers: 'SEM-101, SEM-102, SEM-103, SEM-104',
    });
    expect(serializeRes.status).toBe(200);

    // Step 2: Allocate serials to Sales Order line with shipment assignment
    const allocSerialsRes = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
      line: soLine.id,
      serials: 'SEM-101, SEM-102',
      shipment: shipment.id,
    });
    expect(allocSerialsRes.status).toBe(200);

    // Step 3: Issue and Ship Sales Order
    const issueRes = await api.post(app, `/api/order/so/${so.id}/issue`, {});
    expect(issueRes.status).toBe(200);

    const shipRes = await api.post(app, `/api/order/so/${so.id}/ship`, {});
    expect(shipRes.status).toBe(200);
  });

  it('3.5 Interaction: Return Order Hold -> Quarantine Receive -> Warehouse Stock Return with Location Relocation', async () => {
    const part = fixtures.seedPart({ name: 'Returned Tablet' });
    const quarantineLoc = fixtures.seedLocation({ name: 'Quarantine Inspection Bay' });
    const warehouseLoc = fixtures.seedLocation({ name: 'Refurbished Goods Aisle' });
    const customerStock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 10 });
    const ro = fixtures.seedReturnOrder({ status: '10' });
    const roLine = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: customerStock.id, quantity: 1 });

    // Step 1: Put Return Order on hold pending customer RMA approval
    const holdRes = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
    expect(holdRes.status).toBe(200);

    // Step 2: Resume / Issue Return Order to IN_PROGRESS
    const issueRes = await api.post(app, `/api/order/ro/${ro.id}/issue`, {});
    expect(issueRes.status).toBe(200);

    // Step 3: Receive into Quarantine
    const recvRes = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
      items: [{ line_item: roLine.id, location: quarantineLoc.id, quantity: 1, status: '75' }],
    });
    expect(recvRes.status).toBe(200);

    // Step 4: After inspection, return stock item to active inventory in Refurbished aisle
    const returnStockRes = await api.post(app, '/api/stock/return', {
      items: [{ pk: customerStock.id, location: warehouseLoc.id, status: '10' }],
    });
    expect(returnStockRes.status).toBe(200);
  });

  it('3.6 Interaction: Transfer Order Allocation -> Order Issue -> Complete Move -> Stock Merge Consolidation', async () => {
    const locOrigin = fixtures.seedLocation({ name: 'Factory Floor Warehouse' });
    const locDest = fixtures.seedLocation({ name: 'Distribution Center Shelf 1' });
    const part = fixtures.seedPart({ name: 'Standard Fastener Pack' });

    // Stock in factory origin
    const stockTransfer = fixtures.seedStockItem({ partId: part.id, locationId: locOrigin.id, quantity: 50 });
    // Existing stock in destination
    const stockExisting = fixtures.seedStockItem({ partId: part.id, locationId: locDest.id, quantity: 100 });

    // Step 1: Create Transfer Order & Line
    const to = fixtures.seedTransferOrder({ status: '10', takeFromId: locOrigin.id, destinationId: locDest.id });
    const toLine = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

    // Step 2: Allocate transfer stock
    const allocRes = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
      items: [{ line: toLine.id, stock_item: stockTransfer.id, quantity: 50 }],
    });
    expect(allocRes.status).toBe(200);

    // Step 3: Issue Transfer Order
    const issueRes = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
    expect(issueRes.status).toBe(200);

    // Step 4: Complete Transfer Order
    const completeRes = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
    expect(completeRes.status).toBe(200);

    // Step 5: Merge transferred stock with existing destination stock
    const mergeRes = await api.post(app, '/api/stock/merge', {
      target: stockExisting.id,
      items: [stockTransfer.id],
      notes: 'Consolidating transfer lot into primary bin',
    });
    expect(mergeRes.status).toBe(200);
  });
});
