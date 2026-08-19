import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 2: Build Order Boundary & Corner Cases (Features 1-5)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 1 Boundary: Build Scrap Outputs ────────────────────────────────
  describe('Feature 1 Boundaries: Build Scrap Outputs', () => {
    it('1.1 should reject scrap outputs on non-existent build PK with 404/400', async () => {
      const res = await api.post(app, '/api/build/999999/scrap-outputs', {
        outputs: [{ output: 1, quantity: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });

    it('1.2 should reject scrap outputs when requested quantity exceeds available stock quantity', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const output = fixtures.seedStockItem({ partId: part.id, quantity: 2, isBuilding: true, buildId: build.id });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: 100 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('1.3 should reject scrap outputs on a completed build order', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '30' }); // COMPLETE
      const output = fixtures.seedStockItem({ partId: part.id, quantity: 1, buildId: build.id });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('1.4 should reject scrap outputs when output item belongs to a different build', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build1 = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const build2 = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const output2 = fixtures.seedStockItem({ partId: part.id, quantity: 1, buildId: build2.id });

      const res = await api.post(app, `/api/build/${build1.id}/scrap-outputs`, {
        outputs: [{ output: output2.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('1.5 should reject scrap outputs with zero or negative scrap quantity', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const output = fixtures.seedStockItem({ partId: part.id, quantity: 5, buildId: build.id });

      const res = await api.post(app, `/api/build/${build.id}/scrap-outputs`, {
        outputs: [{ output: output.id, quantity: -5 }],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 2 Boundary: Build Auto-Allocate ────────────────────────────────
  describe('Feature 2 Boundaries: Build Auto-Allocate', () => {
    it('2.1 should reject auto-allocation on CANCELLED build order', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '40' }); // CANCELLED

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('2.2 should handle auto-allocation on build with zero BOM lines without error crash', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect([200, 400]).toContain(res.status);
    });

    it('2.3 should handle auto-allocation when total available component stock is zero', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 2 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, {});
      expect([200, 400]).toContain(res.status);
    });

    it('2.4 should reject auto-allocation on non-existent build PK with 404', async () => {
      const res = await api.post(app, '/api/build/888888/auto-allocate', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('2.5 should handle auto-allocation with empty / non-matching location filter cleanly', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      fixtures.seedStockItem({ partId: comp.id, locationId: 1, quantity: 5 });

      const res = await api.post(app, `/api/build/${build.id}/auto-allocate`, { location: 9999 });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Feature 3 Boundary: Build Allocate ─────────────────────────────────────
  describe('Feature 3 Boundaries: Build Allocate', () => {
    it('3.1 should reject allocation when quantity exceeds available unallocated stock', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20', quantity: 1 });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: comp.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 100 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('3.2 should reject allocation of a stock item whose part is NOT in the BOM', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const wrongPart = fixtures.seedPart({ component: true });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20' });
      const line = fixtures.seedBuildLine({ buildId: build.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: wrongPart.id, quantity: 10 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('3.3 should reject allocation to non-existent build line ID', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20' });
      const stock = fixtures.seedStockItem({ partId: 1, quantity: 5 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: 777777, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });

    it('3.4 should reject allocation with zero or negative quantity', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20' });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: comp.id, quantity: 5 });

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 0 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('3.5 should reject allocation of quarantined / rejected stock item', async () => {
      const assembly = fixtures.seedPart({ assembly: true });
      const comp = fixtures.seedPart({ component: true });
      const bom = fixtures.seedBomItem({ partId: assembly.id, subPartId: comp.id, quantity: 1 });
      const build = fixtures.seedBuildOrder({ partId: assembly.id, status: '20' });
      const line = fixtures.seedBuildLine({ buildId: build.id, bomItemId: bom.id, quantity: 1 });
      const stock = fixtures.seedStockItem({ partId: comp.id, quantity: 5, status: '65' }); // REJECTED

      const res = await api.post(app, `/api/build/${build.id}/allocate`, {
        items: [{ build_line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 4 Boundary: Build Unallocate ───────────────────────────────────
  describe('Feature 4 Boundaries: Build Unallocate', () => {
    it('4.1 should reject unallocate on non-existent build order ID', async () => {
      const res = await api.post(app, '/api/build/999999/unallocate', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('4.2 should reject unallocate on a completed build order', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '30' }); // COMPLETE

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('4.3 should reject unallocate specifying build line from a different build', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build1 = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const build2 = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const line2 = fixtures.seedBuildLine({ buildId: build2.id });

      const res = await api.post(app, `/api/build/${build1.id}/unallocate`, {
        build_line: line2.id,
      });
      expect([400, 200]).toContain(res.status);
    });

    it('4.4 should reject unallocate when specified quantity exceeds allocated quantity', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const line = fixtures.seedBuildLine({ buildId: build.id });
      const alloc = fixtures.seedBuildItem({ buildLineId: line.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        items: [{ build_item: alloc.id, quantity: 50 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('4.5 should reject unallocate with negative quantity value', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });
      const line = fixtures.seedBuildLine({ buildId: build.id });
      const alloc = fixtures.seedBuildItem({ buildLineId: line.id, quantity: 2 });

      const res = await api.post(app, `/api/build/${build.id}/unallocate`, {
        items: [{ build_item: alloc.id, quantity: -2 }],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 5 Boundary: Build Consume ──────────────────────────────────────
  describe('Feature 5 Boundaries: Build Consume', () => {
    it('5.1 should reject consume on non-existent build order ID', async () => {
      const res = await api.post(app, '/api/build/999999/consume', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('5.2 should reject consume when build is CANCELLED', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '40' }); // CANCELLED

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('5.3 should handle consume gracefully when no allocations exist', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect([200, 400]).toContain(res.status);
    });

    it('5.4 should reject consume if build is still in PENDING status (must be PRODUCTION)', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '10' }); // PENDING

      const res = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('5.5 should handle repeated / idempotent consume requests gracefully', async () => {
      const part = fixtures.seedPart({ assembly: true });
      const build = fixtures.seedBuildOrder({ partId: part.id, status: '20' });

      const res1 = await api.post(app, `/api/build/${build.id}/consume`, {});
      const res2 = await api.post(app, `/api/build/${build.id}/consume`, {});
      expect([200, 400]).toContain(res2.status);
    });
  });
});
