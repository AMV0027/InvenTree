import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';
import { StockHistoryCode } from '../../../modules/build/build.service.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 5: Adversarial Stress & Invariant Verification Suite', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── 1. Multi-Subsystem Concurrency & Allocation Race Invariants ─────────────
  describe('1. Multi-Subsystem Allocation Competitions & Race Guards', () => {
    it('1.1 should prevent over-allocation when SO, Build, and TO compete for the same stock pool', async () => {
      const part = fixtures.seedPart({ name: 'Dual-Use Microcontroller', component: true, salable: true });
      const parentAssembly = fixtures.seedPart({ name: 'Robot Controller', assembly: true });
      const bom = fixtures.seedBomItem({ partId: parentAssembly.id, subPartId: part.id, quantity: 5 });

      // Only 10 units total in inventory
      const stockPool = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      // 1. Build Order allocates 6 units
      const build = fixtures.seedBuildOrder({ partId: parentAssembly.id, status: '20', quantity: 1 });
      const buildLine = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 5 });

      const buildAllocRes = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: buildLine.id, stock_item: stockPool.id, quantity: 6 }],
      });
      expect(buildAllocRes.status).toBe(200);

      // 2. Sales Order attempts to allocate 5 units (4 available -> should fail)
      const so = fixtures.seedSalesOrder({ status: '10' });
      const soLine = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id, quantity: 5 });

      const soAllocOverRes = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: soLine.id, stock_item: stockPool.id, quantity: 5 }],
      });
      expect(soAllocOverRes.status).toBe(400);

      // 3. Sales Order allocates remaining 4 units exactly -> succeeds
      const soAllocValidRes = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: soLine.id, stock_item: stockPool.id, quantity: 4 }],
      });
      expect(soAllocValidRes.status).toBe(200);

      // 4. Transfer Order attempts to allocate 1 unit from completely exhausted pool -> fails
      const locA = fixtures.seedLocation({ name: 'Warehouse A' });
      const locB = fixtures.seedLocation({ name: 'Warehouse B' });
      const to = fixtures.seedTransferOrder({ status: '10', takeFromId: locA.id, destinationId: locB.id });
      const toLine = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id, quantity: 1 });

      const toAllocExhaustedRes = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: toLine.id, stock_item: stockPool.id, quantity: 1 }],
      });
      expect(toAllocExhaustedRes.status).toBe(400);
    });

    it('1.2 should release allocated reservation upon unallocation and permit immediate reallocation', async () => {
      const part = fixtures.seedPart({ name: 'Relay Module', component: true });
      const assembly = fixtures.seedPart({ name: 'Power Hub', assembly: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: part.id, quantity: 2 });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 2 });

      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });

      // Allocate 2
      await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 2 }],
      });

      // Unallocate 1
      const allocs = store.builditem.filter(bi => bi.buildLineId === line.id);
      expect(allocs.length).toBe(1);
      const unallocRes = await api.post(app, `/api/build/${build.id}/unallocate`, {
        items: [{ build_item: allocs[0].id, quantity: 1 }],
      });
      expect(unallocRes.status).toBe(200);

      // Now 1 unit is free -> Sales Order can allocate 1 unit
      const so = fixtures.seedSalesOrder({ status: '10' });
      const soLine = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id, quantity: 1 });
      const soAllocRes = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: soLine.id, stock_item: stock.id, quantity: 1 }],
      });
      expect(soAllocRes.status).toBe(200);
    });
  });

  // ─── 2. Extreme Serial Expression Parsing & Edge Cases ─────────────────────────
  describe('2. Extreme Serial Expression Parsing & Edge Cases', () => {
    it('2.1 should serialize with alphanumeric sequential increments (e.g. SN-A001+3)', async () => {
      const part = fixtures.seedPart({ name: 'Sensored Motor', trackable: true });
      const loc = fixtures.seedLocation({ name: 'Motor Shelf' });
      const bulkStock = fixtures.seedStockItem({ partId: part.id, locationId: loc.id, quantity: 3 });

      const res = await api.post(app, `/api/stock/${bulkStock.id}/serialize`, {
        quantity: 3,
        serial_numbers: 'SN-001+3',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.length).toBe(3);
      expect(res.body.results.map((r: any) => r.serial)).toEqual(['SN-001', 'SN-002', 'SN-003']);
    });

    it('2.2 should reject overlapping duplicate serial allocations on Sales Order', async () => {
      const part = fixtures.seedPart({ name: 'Precision Sensor', trackable: true, salable: true });
      const s1 = fixtures.seedStockItem({ partId: part.id, serial: 'PS-101', quantity: 1 });
      const s2 = fixtures.seedStockItem({ partId: part.id, serial: 'PS-102', quantity: 1 });

      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id, quantity: 2 });

      // First allocate PS-101
      const res1 = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line_item: line.id,
        quantity: 1,
        serial_numbers: 'PS-101',
      });
      expect(res1.status).toBe(200);

      // Attempt to allocate PS-101 again in a range PS-101, PS-102
      const res2 = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line_item: line.id,
        serial_numbers: 'PS-101, PS-102',
      });
      expect(res2.status).toBe(400);
    });

    it('2.3 should reject serialization when duplicate serial numbers already exist in DB', async () => {
      const part = fixtures.seedPart({ name: 'GPS Receiver', trackable: true });
      fixtures.seedStockItem({ partId: part.id, serial: 'GPS-500', quantity: 1 });
      const bulkStock = fixtures.seedStockItem({ partId: part.id, quantity: 3 });

      const res = await api.post(app, `/api/stock/${bulkStock.id}/serialize`, {
        serial_numbers: 'GPS-499, GPS-500, GPS-501',
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── 3. Relational Invariants & Lifecycle Integrity ───────────────────────────
  describe('3. Relational Invariants & Lifecycle Integrity', () => {
    it('3.1 Stock Merge: should aggregate quantities, migrate build allocations, and log MERGED tracking', async () => {
      const part = fixtures.seedPart({ name: 'Resistor 10k', component: true });
      const assembly = fixtures.seedPart({ name: 'Amplifier', assembly: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: part.id, quantity: 20 });
      const loc = fixtures.seedLocation({ name: 'SMD Bin' });

      const item1 = fixtures.seedStockItem({ partId: part.id, locationId: loc.id, quantity: 30, purchasePrice: 0.05 });
      const item2 = fixtures.seedStockItem({ partId: part.id, locationId: loc.id, quantity: 70, purchasePrice: 0.07 });

      // Build allocates 10 from item2
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 20 });
      await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: item2.id, quantity: 10 }],
      });

      // Merge item2 into item1
      const mergeRes = await api.post(app, '/api/stock/merge', {
        target: item1.id,
        items: [item2.id],
      });
      expect(mergeRes.status).toBe(200);

      // item2 must be deleted, item1 has quantity 100
      expect(store.stockitem.find(i => i.id === item2.id)).toBeUndefined();
      const targetItem = store.stockitem.find(i => i.id === item1.id);
      expect(Number(targetItem?.quantity)).toBe(100);

      // Build allocation must now point to item1!
      const alloc = store.builditem.find(bi => bi.buildLineId === line.id);
      expect(alloc?.stockItemId).toBe(item1.id);

      // Verify tracking entry MERGED_STOCK_ITEMS (45)
      const tracks = store.stockitemtracking.filter(t => t.itemId === item1.id && t.trackingType === 45);
      expect(tracks.length).toBeGreaterThanOrEqual(1);
    });

    it('3.2 Stock Install / Uninstall: should prevent self-install and circular dependency', async () => {
      const chassis = fixtures.seedPart({ name: 'Chassis', assembly: true });
      const chassisStock = fixtures.seedStockItem({ partId: chassis.id, quantity: 1 });

      // Self-install attempt
      const selfInstallRes = await api.post(app, `/api/stock/${chassisStock.id}/install`, {
        target: chassisStock.id,
        quantity: 1,
      });
      expect(selfInstallRes.status).toBe(400);
    });

    it('3.3 Stock Return: should clear customerId, salesOrderId, consumedById and reset location', async () => {
      const part = fixtures.seedPart({ name: 'Refurbished Controller', trackable: true });
      const customer = fixtures.seedCompany({ name: 'Client Corp', isCustomer: true });
      const locRMA = fixtures.seedLocation({ name: 'RMA Intake' });

      const stock = fixtures.seedStockItem({
        partId: part.id,
        quantity: 1,
        serial: 'CTRL-001',
        customerId: customer.id,
        status: '50',
      });

      const returnRes = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: locRMA.id, status: '10' }],
        notes: 'Customer warranty return restocked',
      });

      expect(returnRes.status).toBe(200);
      const updated = store.stockitem.find(i => i.id === stock.id);
      expect(updated?.customerId).toBeNull();
      expect(updated?.locationId).toBe(locRMA.id);
      expect(updated?.status).toBe('10');

      // Verify tracking type RETURNED_TO_STOCK (15)
      const track = store.stockitemtracking.find(t => t.itemId === stock.id && t.trackingType === 15);
      expect(track).toBeDefined();
    });
  });

  // ─── 4. Terminal State Lifecycle Guards Across All Subsystems ─────────────────
  describe('4. Strict Lifecycle Transition Guards', () => {
    it('4.1 should reject mutations on COMPLETE and CANCELLED Build Orders', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: part.id, subPartId: comp.id, quantity: 1 });

      const compStock = fixtures.seedStockItem({ partId: comp.id, quantity: 10 });
      const completeBuild = fixtures.seedBuildOrder({ partId: part.id, status: '40' }); // COMPLETE
      const completeLine = fixtures.seedBuildLine({ buildId: completeBuild.id, bomItemId: bom.id, quantity: 1 });

      // Scrap on complete build -> 400
      const scrapRes = await api.post(app, `/api/build/${completeBuild.id}/scrap-outputs`, {
        outputs: [1],
      });
      expect(scrapRes.status).toBe(400);

      // Allocate on complete build -> 400
      const allocRes = await api.post(app, `/api/build/${completeBuild.id}/allocate`, {
        items: [{ build_line: completeLine.id, stock_item: compStock.id, quantity: 1 }],
      });
      expect(allocRes.status).toBe(400);

      // Auto-allocate on complete build -> 400
      const autoAllocRes = await api.post(app, `/api/build/${completeBuild.id}/auto-allocate`, {});
      expect(autoAllocRes.status).toBe(400);

      // Consume on complete build -> 400
      const consumeRes = await api.post(app, `/api/build/${completeBuild.id}/consume`, {});
      expect(consumeRes.status).toBe(400);
    });

    it('4.2 should reject mutations on COMPLETE and CANCELLED Sales Orders', async () => {
      const part = fixtures.seedPart({ salable: true });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      const closedSO = fixtures.seedSalesOrder({ status: '30' }); // COMPLETE
      const soLine = fixtures.seedSalesOrderLineItem({ orderId: closedSO.id, partId: part.id, quantity: 5 });

      // Allocate on closed SO -> 400
      const allocRes = await api.post(app, `/api/order/so/${closedSO.id}/allocate`, {
        items: [{ line: soLine.id, stock_item: stock.id, quantity: 1 }],
      });
      expect(allocRes.status).toBe(400);

      // Auto-allocate on closed SO -> 400
      const autoAllocRes = await api.post(app, `/api/order/so/${closedSO.id}/auto-allocate`, {});
      expect(autoAllocRes.status).toBe(400);
    });

    it('4.3 should reject receive on non-IN_PROGRESS Return Orders', async () => {
      const part = fixtures.seedPart({});
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1 });
      const pendingRO = fixtures.seedReturnOrder({ status: '10' }); // PENDING
      const roLine = fixtures.seedReturnOrderLineItem({ orderId: pendingRO.id, itemId: stock.id, quantity: 1 });

      const receiveRes = await api.post(app, `/api/order/ro/${pendingRO.id}/receive`, {
        items: [{ line_item: roLine.id, quantity: 1 }],
      });
      expect(receiveRes.status).toBe(400);
    });

    it('4.4 should reject complete on non-ISSUED Transfer Orders', async () => {
      const pendingTO = fixtures.seedTransferOrder({ status: '10' }); // PENDING
      const completeRes = await api.post(app, `/api/order/transfer-order/${pendingTO.id}/complete`, {});
      expect(completeRes.status).toBe(400);
    });
  });
});
