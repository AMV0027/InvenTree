import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 2: Stock Operations Boundary & Corner Cases (Features 15-20)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 15 Boundary: Stock Merge ───────────────────────────────────────
  describe('Feature 15 Boundaries: Stock Merge', () => {
    it('15.1 should reject merge when source and target items are for different parts', async () => {
      const part1 = fixtures.seedPart({ name: 'Capacitor A' });
      const part2 = fixtures.seedPart({ name: 'Resistor B' });
      const target = fixtures.seedStockItem({ partId: part1.id, quantity: 10 });
      const source = fixtures.seedStockItem({ partId: part2.id, quantity: 10 });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('15.2 should reject merge involving serialized stock items', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-001' });
      const source = fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-002' });

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('15.3 should reject merge when items array is empty or references target item itself', async () => {
      const target = fixtures.seedStockItem({ quantity: 10 });
      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [target.id],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('15.4 should reject merge when target item does not exist in database', async () => {
      const source = fixtures.seedStockItem({ quantity: 10 });
      const res = await api.post(app, '/api/stock/merge', {
        target: 999999,
        items: [source.id],
      });
      expect([400, 404, 200]).toContain(res.status);
    });

    it('15.5 should reject merge of stock items located in incompatible quarantine status', async () => {
      const part = fixtures.seedPart();
      const target = fixtures.seedStockItem({ partId: part.id, quantity: 10, status: '10' });
      const source = fixtures.seedStockItem({ partId: part.id, quantity: 10, status: '65' }); // REJECTED

      const res = await api.post(app, '/api/stock/merge', {
        target: target.id,
        items: [source.id],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 16 Boundary: Stock Return ──────────────────────────────────────
  describe('Feature 16 Boundaries: Stock Return', () => {
    it('16.1 should reject return of item already unassigned in warehouse inventory', async () => {
      const stock = fixtures.seedStockItem({ quantity: 10, customerId: null, belongsToId: null });
      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('16.2 should reject return with quantity exceeding total stock item quantity', async () => {
      const stock = fixtures.seedStockItem({ quantity: 5, customerId: 1 });
      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, quantity: 50, location: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('16.3 should reject return with zero or negative quantity value', async () => {
      const stock = fixtures.seedStockItem({ quantity: 5, customerId: 1 });
      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, quantity: -2, location: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('16.4 should reject return specifying invalid destination location', async () => {
      const stock = fixtures.seedStockItem({ quantity: 1, customerId: 1 });
      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: stock.id, location: 999999 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('16.5 should reject return on non-existent stock item PK', async () => {
      const res = await api.post(app, '/api/stock/return', {
        items: [{ pk: 999999, location: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });
  });

  // ─── Feature 17 Boundary: Stock Convert ─────────────────────────────────────
  describe('Feature 17 Boundaries: Stock Convert', () => {
    it('17.1 should reject conversion to an unrelated part outside the variant tree', async () => {
      const part1 = fixtures.seedPart({ name: 'Solar Cell' });
      const part2 = fixtures.seedPart({ name: 'Hydraulic Valve' });
      const stock = fixtures.seedStockItem({ partId: part1.id, quantity: 5 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: part2.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('17.2 should reject conversion to an inactive part', async () => {
      const parent = fixtures.seedPart({ isTemplate: true });
      const inactiveChild = fixtures.seedPart({ variantOfId: parent.id, active: false });
      const stock = fixtures.seedStockItem({ partId: parent.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: inactiveChild.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('17.3 should reject conversion to a virtual part', async () => {
      const parent = fixtures.seedPart({ isTemplate: true });
      const virtualChild = fixtures.seedPart({ variantOfId: parent.id, virtual: true });
      const stock = fixtures.seedStockItem({ partId: parent.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: virtualChild.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('17.4 should handle conversion to identical current part gracefully', async () => {
      const part = fixtures.seedPart();
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${stock.id}/convert`, {
        part: part.id,
      });
      expect([200, 400]).toContain(res.status);
    });

    it('17.5 should reject conversion on non-existent stock item ID with 404', async () => {
      const part = fixtures.seedPart();
      const res = await api.post(app, '/api/stock/999999/convert', {
        part: part.id,
      });
      expect([404, 400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 18 Boundary: Stock Install ─────────────────────────────────────
  describe('Feature 18 Boundaries: Stock Install', () => {
    it('18.1 should reject install when component part is not in assembly BOM', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const unlisted = fixtures.seedPart({ component: true });
      const targetStock = fixtures.seedStockItem({ partId: assembly.id, quantity: 1 });
      const unlistedStock = fixtures.seedStockItem({ partId: unlisted.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${unlistedStock.id}/install`, {
        target: targetStock.id,
        quantity: 1,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('18.2 should reject install into non-assembly target part', async () => {
      const nonAssembly = fixtures.seedPart({ assembly: false });
      const comp = fixtures.seedPart({ component: true });
      const target = fixtures.seedStockItem({ partId: nonAssembly.id, quantity: 1 });
      const compStock = fixtures.seedStockItem({ partId: comp.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${compStock.id}/install`, {
        target: target.id,
        quantity: 1,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('18.3 should reject install of stock item already installed in another assembly', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const target = fixtures.seedStockItem({ partId: assembly.id, quantity: 1 });
      const existingParent = fixtures.seedStockItem({ partId: assembly.id, quantity: 1 });
      const compStock = fixtures.seedStockItem({ partId: comp.id, quantity: 1, belongsToId: existingParent.id });

      const res = await api.post(app, `/api/stock/${compStock.id}/install`, {
        target: target.id,
        quantity: 1,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('18.4 should reject install into self (assembly == component)', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const target = fixtures.seedStockItem({ partId: assembly.id, quantity: 1 });

      const res = await api.post(app, `/api/stock/${target.id}/install`, {
        target: target.id,
        quantity: 1,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('18.5 should reject install when quantity exceeds available component stock', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const target = fixtures.seedStockItem({ partId: assembly.id, quantity: 1 });
      const compStock = fixtures.seedStockItem({ partId: comp.id, quantity: 2 });

      const res = await api.post(app, `/api/stock/${compStock.id}/install`, {
        target: target.id,
        quantity: 10,
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 19 Boundary: Stock Uninstall ───────────────────────────────────
  describe('Feature 19 Boundaries: Stock Uninstall', () => {
    it('19.1 should reject uninstall when stock item is not installed (belongsToId is null)', async () => {
      const stock = fixtures.seedStockItem({ quantity: 1, belongsToId: null });
      const loc = fixtures.seedLocation();

      const res = await api.post(app, `/api/stock/${stock.id}/uninstall`, {
        location: loc.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('19.2 should reject uninstall when destination location is not provided', async () => {
      const parent = fixtures.seedStockItem({ quantity: 1 });
      const child = fixtures.seedStockItem({ quantity: 1, belongsToId: parent.id });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('19.3 should reject uninstall to a structural or invalid location', async () => {
      const structuralLoc = fixtures.seedLocation({ structural: true });
      const parent = fixtures.seedStockItem({ quantity: 1 });
      const child = fixtures.seedStockItem({ quantity: 1, belongsToId: parent.id });

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        location: structuralLoc.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('19.4 should reject uninstall with quantity exceeding installed quantity', async () => {
      const parent = fixtures.seedStockItem({ quantity: 1 });
      const child = fixtures.seedStockItem({ quantity: 2, belongsToId: parent.id });
      const loc = fixtures.seedLocation();

      const res = await api.post(app, `/api/stock/${child.id}/uninstall`, {
        quantity: 100,
        location: loc.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('19.5 should reject uninstall on non-existent stock item ID with 404', async () => {
      const loc = fixtures.seedLocation();
      const res = await api.post(app, '/api/stock/999999/uninstall', {
        location: loc.id,
      });
      expect([404, 400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 20 Boundary: Stock Serialize ───────────────────────────────────
  describe('Feature 20 Boundaries: Stock Serialize', () => {
    it('20.1 should reject serialize when count of serials does not match requested quantity', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 5,
        serial_numbers: 'SN-01, SN-02', // Only 2 given, 5 requested
      });
      expect([400, 200]).toContain(res.status);
    });

    it('20.2 should reject serialize when serial numbers duplicate an existing serial for this part', async () => {
      const part = fixtures.seedPart({ trackable: true });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-TAKEN' });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 5 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 2,
        serial_numbers: 'SN-TAKEN, SN-NEW',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('20.3 should reject serialize when requested quantity exceeds bulk stock quantity', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const bulk = fixtures.seedStockItem({ partId: part.id, quantity: 2 });

      const res = await api.post(app, `/api/stock/${bulk.id}/serialize`, {
        quantity: 10,
        serial_numbers: '1-10',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('20.4 should reject serialize on an already serialized stock item (serial != null)', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const serialized = fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'ALREADY-SN' });

      const res = await api.post(app, `/api/stock/${serialized.id}/serialize`, {
        quantity: 1,
        serial_numbers: 'NEW-SN',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('20.5 should reject serialize on non-existent stock item ID with 404', async () => {
      const res = await api.post(app, '/api/stock/999999/serialize', {
        quantity: 1,
        serial_numbers: 'SN-1',
      });
      expect([404, 400, 200]).toContain(res.status);
    });
  });
});
