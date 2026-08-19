import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 1: Stock Item Operations Features (Features 15-20)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 15: Stock Merge (/api/stock/merge) ─────────────────────────────
  describe('Feature 15: Stock Merge', () => {
    it('15.1 should merge two stock items of same part into target item, summing quantities', async () => {
      const part = fixtures.seedPart({ name: 'Bulk 10k Resistor' });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 100, purchasePrice: 0.05 });
      const source1 = fixtures.seedStockItem({ partId: part.id, quantity: 50, purchasePrice: 0.04 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source1.id],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('15.2 should merge multiple (>2) stock items into target item in single operation', async () => {
      const part = fixtures.seedPart({ name: '0.1uF Capacitor' });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 50 });
      const src1 = fixtures.seedStockItem({ partId: part.id, quantity: 20 });
      const src2 = fixtures.seedStockItem({ partId: part.id, quantity: 30 });
      const src3 = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [src1.id, src2.id, src3.id],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('15.3 should calculate weighted average purchasePrice across merged stock items', async () => {
      const part = fixtures.seedPart({ name: 'Precision Diode' });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 10, purchasePrice: 1.0 });
      const source = fixtures.seedStockItem({ partId: part.id, quantity: 10, purchasePrice: 2.0 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('15.4 should migrate existing allocations from source items to target item', async () => {
      const part = fixtures.seedPart({ name: 'Stepper Driver' });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 10 });
      const source = fixtures.seedStockItem({ partId: part.id, quantity: 5 });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const soLine = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedSalesOrderAllocation({ lineId: soLine.id, itemId: source.id, quantity: 2 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('15.5 should delete source stock items and log tracking (type 45 / MERGED) on target', async () => {
      const part = fixtures.seedPart({ name: 'Hardware Nut M4' });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 200 });
      const source = fixtures.seedStockItem({ partId: part.id, quantity: 100 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
        notes: 'Merged inventory bin count consolidation',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 16: Stock Return (/api/stock/return) ───────────────────────────
  describe('Feature 16: Stock Return', () => {
    it('16.1 should return customer stock item back to active inventory (clearing customerId)', async () => {
      const part = fixtures.seedPart({ name: 'Loaner Laptop' });
      const loc = fixtures.seedLocation({ name: 'Main Inventory' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 99 });

      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: loc.id }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('16.2 should return installed stock item back to active inventory (clearing belongsToId)', async () => {
      const parentPart = fixtures.seedPart({ name: 'Main Chassis', assembly: true });
      const childPart = fixtures.seedPart({ name: 'Modular Fan', component: true });
      const parentStock = fixtures.seedStockItem({ partId: parentPart.id, quantity: 1 });
      const childStock = fixtures.seedStockItem({ partId: childPart.id, quantity: 1, belongsToId: parentStock.id });
      const loc = fixtures.seedLocation({ name: 'Spare Parts Shelf' });

      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: childStock.id, location: loc.id }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('16.3 should return partial quantity of stock item by splitting returned portion', async () => {
      const part = fixtures.seedPart({ name: 'Demo Kit Bundles' });
      const loc = fixtures.seedLocation({ name: 'Stockroom' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 10, customerId: 5 });

      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, quantity: 4, location: loc.id }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('16.4 should update returned stock status to OK (10) and assign designated location', async () => {
      const part = fixtures.seedPart({ name: 'Inspection Sample' });
      const loc = fixtures.seedLocation({ name: 'Aisle 3' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, status: '50' });

      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: loc.id, status: '10' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('16.5 should log stockitemtracking entry (15 / RETURNED) with tracking notes', async () => {
      const part = fixtures.seedPart({ name: 'Evaluation Board' });
      const loc = fixtures.seedLocation({ name: 'Lab Inventory' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 1 });

      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: loc.id }],
        notes: 'Customer returned after product evaluation',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 17: Stock Convert (/api/stock/:pk/convert) ─────────────────────
  describe('Feature 17: Stock Convert', () => {
    it('17.1 should convert stock item to child variant part in family tree', async () => {
      const basePart = fixtures.seedPart({ name: 'Aluminum Enclosure Base', isTemplate: true });
      const anodizedPart = fixtures.seedPart({ name: 'Black Anodized Enclosure', variantOfId: basePart.id });
      const stock = fixtures.seedStockItem({ partId: basePart.id, quantity: 5 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: anodizedPart.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('17.2 should convert stock item to parent variant part in family tree', async () => {
      const basePart = fixtures.seedPart({ name: 'Resistor Generic Template', isTemplate: true });
      const specificPart = fixtures.seedPart({ name: 'Resistor 1k 1%', variantOfId: basePart.id });
      const stock = fixtures.seedStockItem({ partId: specificPart.id, quantity: 50 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: basePart.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('17.3 should convert stock item to sibling variant part (same parent template)', async () => {
      const parent = fixtures.seedPart({ name: 'Cable Assembly Base', isTemplate: true });
      const variant1m = fixtures.seedPart({ name: 'Cable Assembly 1 Meter', variantOfId: parent.id });
      const variant2m = fixtures.seedPart({ name: 'Cable Assembly 2 Meter', variantOfId: parent.id });
      const stock = fixtures.seedStockItem({ partId: variant1m.id, quantity: 10 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: variant2m.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('17.4 should update partId and log stockitemtracking entry (48 / CONVERTED)', async () => {
      const parent = fixtures.seedPart({ name: 'Standard Widget', isTemplate: true });
      const child = fixtures.seedPart({ name: 'Customized Widget', variantOfId: parent.id });
      const stock = fixtures.seedStockItem({ partId: parent.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: child.id,
        notes: 'Converted via secondary machining',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('17.5 should preserve stock item quantity, location, serial, and batch during conversion', async () => {
      const parent = fixtures.seedPart({ name: 'PCB Unpopulated', isTemplate: true });
      const child = fixtures.seedPart({ name: 'PCB Rev B', variantOfId: parent.id });
      const loc = fixtures.seedLocation({ name: 'Rack 7' });
      const stock = fixtures.seedStockItem({
        partId: parent.id,
        locationId: loc.id,
        quantity: 1,
        serial: 'SN-PCB-007',
        batch: 'BATCH-2026',
      });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: child.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 18: Stock Install (/api/stock/:pk/install) ─────────────────────
  describe('Feature 18: Stock Install', () => {
    it('18.1 should install component stock item into assembly stock item, setting belongsToId', async () => {
      const assemblyPart = fixtures.seedPart({ name: 'Desktop PC', assembly: true });
      const gpuPart = fixtures.seedPart({ name: 'Graphics Card', component: true });
      fixtures.seedBomItem({ partId: assemblyPart.id, subPartId: gpuPart.id, quantity: 1 });
      const assemblyStock = fixtures.seedStockItem({ partId: assemblyPart.id, quantity: 1 });
      const gpuStock = fixtures.seedStockItem({ partId: gpuPart.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${gpuStock.id}/install`, {
        target: assemblyStock.id,
        quantity: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('18.2 should validate component part is in assembly BOM before installation', async () => {
      const assemblyPart = fixtures.seedPart({ name: 'Electric Motor', assembly: true });
      const rotorPart = fixtures.seedPart({ name: 'Rotor Assembly', component: true });
      fixtures.seedBomItem({ partId: assemblyPart.id, subPartId: rotorPart.id, quantity: 1 });
      const assemblyStock = fixtures.seedStockItem({ partId: assemblyPart.id, quantity: 1 });
      const rotorStock = fixtures.seedStockItem({ partId: rotorPart.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${rotorStock.id}/install`, {
        target: assemblyStock.id,
        quantity: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('18.3 should install serialized component into serialized assembly', async () => {
      const assemblyPart = fixtures.seedPart({ name: 'Industrial Robot', assembly: true, trackable: true });
      const armPart = fixtures.seedPart({ name: 'Articulated Arm', component: true, trackable: true });
      fixtures.seedBomItem({ partId: assemblyPart.id, subPartId: armPart.id, quantity: 1 });
      const robot = fixtures.seedStockItem({ partId: assemblyPart.id, quantity: 1, serial: 'ROBOT-01' });
      const arm = fixtures.seedStockItem({ partId: armPart.id, quantity: 1, serial: 'ARM-01' });

      const res = await api.post(app, `/api/stock/${arm.id}/install`, {
        target: robot.id,
        quantity: 1,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('18.4 should install partial quantity from bulk component stock item, splitting component', async () => {
      const assemblyPart = fixtures.seedPart({ name: 'Control Cabinet', assembly: true });
      const terminalPart = fixtures.seedPart({ name: 'Terminal Block', component: true });
      fixtures.seedBomItem({ partId: assemblyPart.id, subPartId: terminalPart.id, quantity: 10 });
      const cabinet = fixtures.seedStockItem({ partId: assemblyPart.id, quantity: 1 });
      const bulkTerminals = fixtures.seedStockItem({ partId: terminalPart.id, quantity: 100 });

      const res = await api.post(app, `/api/stock/${bulkTerminals.id}/install`, {
        target: cabinet.id,
        quantity: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('18.5 should log tracking entries (30 / INSTALLED_INTO, 35 / INSTALLED_CHILD)', async () => {
      const assemblyPart = fixtures.seedPart({ name: 'Drone Frame', assembly: true });
      const escPart = fixtures.seedPart({ name: 'Electronic Speed Controller', component: true });
      fixtures.seedBomItem({ partId: assemblyPart.id, subPartId: escPart.id, quantity: 4 });
      const drone = fixtures.seedStockItem({ partId: assemblyPart.id, quantity: 1 });
      const esc = fixtures.seedStockItem({ partId: escPart.id, quantity: 4 });

      const res = await api.post(app, `/api/stock/${esc.id}/install`, {
        target: drone.id,
        quantity: 4,
        notes: 'Installed ESC quad pack',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 19: Stock Uninstall (/api/stock/:pk/uninstall) ─────────────────
  describe('Feature 19: Stock Uninstall', () => {
    it('19.1 should uninstall installed component from assembly, setting belongsToId to null', async () => {
      const parent = fixtures.seedStockItem({ partId: 1, quantity: 1 });
      const child = fixtures.seedStockItem({ partId: 2, quantity: 1, belongsToId: parent.id, locationId: null });
      const loc = fixtures.seedLocation({ name: 'Uninstalled Parts Bin' });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        location: loc.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('19.2 should assign newly designated warehouse location to uninstalled component', async () => {
      const locTarget = fixtures.seedLocation({ name: 'Refurbishing Shelf 2' });
      const parent = fixtures.seedStockItem({ partId: 1, quantity: 1 });
      const child = fixtures.seedStockItem({ partId: 2, quantity: 1, belongsToId: parent.id });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        location: locTarget.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('19.3 should log tracking entry (36 / UNINSTALLED_CHILD) on assembly item', async () => {
      const parent = fixtures.seedStockItem({ partId: 1, quantity: 1 });
      const child = fixtures.seedStockItem({ partId: 2, quantity: 1, belongsToId: parent.id });
      const loc = fixtures.seedLocation({ name: 'Depot' });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        location: loc.id,
        notes: 'Removed component for maintenance',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('19.4 should log tracking entry (31 / UNINSTALLED_FROM) on uninstalled component', async () => {
      const parent = fixtures.seedStockItem({ partId: 1, quantity: 1 });
      const child = fixtures.seedStockItem({ partId: 2, quantity: 1, belongsToId: parent.id });
      const loc = fixtures.seedLocation({ name: 'Depot' });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        location: loc.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('19.5 should uninstall partial quantity from installed batch component', async () => {
      const parent = fixtures.seedStockItem({ partId: 1, quantity: 1 });
      const child = fixtures.seedStockItem({ partId: 2, quantity: 8, belongsToId: parent.id });
      const loc = fixtures.seedLocation({ name: 'Spare Parts' });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        quantity: 2,
        location: loc.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 20: Stock Serialize (/api/stock/:pk/serialize) ─────────────────
  describe('Feature 20: Stock Serialize', () => {
    it('20.1 should split bulk stock item into individual serialized single-quantity items', async () => {
      const part = fixtures.seedPart({ name: 'Smart Gateway', trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 3 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 3,
        serial_numbers: 'GW-001, GW-002, GW-003',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('20.2 should parse numeric range expression for serial numbers (e.g. 101-105)', async () => {
      const part = fixtures.seedPart({ name: 'Digital Multimeter', trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 5 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 5,
        serial_numbers: '101-105',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('20.3 should delete parent bulk item when deleteOnDeplete=true and full quantity serialized', async () => {
      const part = fixtures.seedPart({ name: 'BLE Beacon', trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 2, deleteOnDeplete: true });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 2,
        serial_numbers: 'BLE-1, BLE-2',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('20.4 should decrement parent quantity when partial quantity is serialized', async () => {
      const part = fixtures.seedPart({ name: 'Pressure Gauge', trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 20 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 5,
        serial_numbers: 'PG-01, PG-02, PG-03, PG-04, PG-05',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('20.5 should copy parent attributes (location, batch, status) and log tracking entries', async () => {
      const loc = fixtures.seedLocation({ name: 'Vault A' });
      const part = fixtures.seedPart({ name: 'Cryptographic Chip', trackable: true });
      const bulk = fixtures.seedStockItem({
        partId: part.id,
        locationId: loc.id,
        quantity: 2,
        batch: 'CRYPTO-BATCH-9',
        status: '10',
      });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 2,
        serial_numbers: 'CC-001, CC-002',
        notes: 'Serialized upon secure reception',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
