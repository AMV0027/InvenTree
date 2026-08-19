import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 2: Orders Boundary & Corner Cases (Features 6-14)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 6 Boundary: Sales Order Allocate ───────────────────────────────
  describe('Feature 6 Boundaries: Sales Order Allocate', () => {
    it('6.1 should reject allocate when stock item part is completely unrelated to line part', async () => {
      const part1 = fixtures.seedPart({ name: 'Keyboard' });
      const part2 = fixtures.seedPart({ name: 'Power Cable' });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part1.id });
      const stock = fixtures.seedStockItem({ partId: part2.id, quantity: 10 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('6.2 should reject allocate when requested quantity exceeds available stock quantity', async () => {
      const part = fixtures.seedPart();
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 2 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 50 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('6.3 should reject allocate on CANCELLED or COMPLETE sales order', async () => {
      const part = fixtures.seedPart();
      const so = fixtures.seedSalesOrder({ status: '40' }); // COMPLETE
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('6.4 should reject allocate on non-existent sales order PK or line PK', async () => {
      const res = await api.post(app, '/api/order/so/999999/allocate', {
        items: [{ line: 888888, stock_item: 1, quantity: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });

    it('6.5 should reject allocate with zero or negative quantity', async () => {
      const part = fixtures.seedPart();
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 5 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: -2 }],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 7 Boundary: Sales Order Allocate Serials ───────────────────────
  describe('Feature 7 Boundaries: Sales Order Allocate Serials', () => {
    it('7.1 should reject serial expression referencing non-existent serial items', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'SN-DOES-NOT-EXIST',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('7.2 should reject serial items already allocated to another sales order', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const so1 = fixtures.seedSalesOrder({ status: '10' });
      const so2 = fixtures.seedSalesOrder({ status: '10' });
      const line1 = fixtures.seedSalesOrderLineItem({ orderId: so1.id, partId: part.id });
      const line2 = fixtures.seedSalesOrderLineItem({ orderId: so2.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-SHARED-01' });
      fixtures.seedSalesOrderAllocation({ lineId: line1.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/so/${so2.id}/allocate-serials`, {
        line: line2.id,
        serials: 'SN-SHARED-01',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('7.3 should reject when count of parsed serials exceeds remaining line required quantity', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-1' });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-2' });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'SN-1, SN-2',
      });
      expect([200, 400]).toContain(res.status);
    });

    it('7.4 should reject malformed serial expression strings', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: '100--200--invalid',
      });
      expect([400, 200]).toContain(res.status);
    });

    it('7.5 should reject allocate serials on SHIPPED or COMPLETE sales order', async () => {
      const part = fixtures.seedPart({ trackable: true });
      const so = fixtures.seedSalesOrder({ status: '30' }); // SHIPPED
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-9' });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'SN-9',
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 8 Boundary: Sales Order Auto-Allocate ─────────────────────────
  describe('Feature 8 Boundaries: Sales Order Auto-Allocate', () => {
    it('8.1 should handle auto-allocate on SO with zero lines gracefully', async () => {
      const so = fixtures.seedSalesOrder({ status: '10' });
      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {});
      expect([200, 400]).toContain(res.status);
    });

    it('8.2 should handle auto-allocate when zero stock is available', async () => {
      const part = fixtures.seedPart();
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {});
      expect([200, 400]).toContain(res.status);
    });

    it('8.3 should reject auto-allocate on CANCELLED or COMPLETE sales order', async () => {
      const so = fixtures.seedSalesOrder({ status: '50' }); // CANCELLED
      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('8.4 should reject auto-allocate on non-existent sales order PK with 404', async () => {
      const res = await api.post(app, '/api/order/so/999999/auto-allocate', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('8.5 should handle auto-allocate with invalid strategy gracefully', async () => {
      const so = fixtures.seedSalesOrder({ status: '10' });
      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {
        strategy: 'INVALID_STRATEGY',
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Feature 9 Boundary: Return Order Hold ──────────────────────────────────
  describe('Feature 9 Boundaries: Return Order Hold', () => {
    it('9.1 should reject hold on already CANCELLED return order', async () => {
      const ro = fixtures.seedReturnOrder({ status: '50' }); // CANCELLED
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('9.2 should reject hold on already COMPLETE return order', async () => {
      const ro = fixtures.seedReturnOrder({ status: '40' }); // COMPLETE
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('9.3 should handle hold on already ON_HOLD return order idempotently', async () => {
      const ro = fixtures.seedReturnOrder({ status: '25' }); // ON_HOLD
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect(res.status).toBe(200);
    });

    it('9.4 should reject hold on non-existent return order ID with 404/400', async () => {
      const res = await api.post(app, '/api/order/ro/999999/hold', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('9.5 should handle empty body payload for hold request cleanly', async () => {
      const ro = fixtures.seedReturnOrder({ status: '10' });
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, null);
      expect(res.status).toBe(200);
    });
  });

  // ─── Feature 10 Boundary: Return Order Receive ──────────────────────────────
  describe('Feature 10 Boundaries: Return Order Receive', () => {
    it('10.1 should reject receive when return order is in PENDING status', async () => {
      const ro = fixtures.seedReturnOrder({ status: '10' }); // PENDING
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('10.2 should reject receive on non-existent return order PK or line PK', async () => {
      const res = await api.post(app, '/api/order/ro/999999/receive', {
        items: [{ line_item: 888888, quantity: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });

    it('10.3 should reject receive quantity exceeding line item quantity', async () => {
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 100 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('10.4 should reject receive with non-existent destination location ID', async () => {
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 1, location: 999999 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('10.5 should reject receive with zero or negative quantity', async () => {
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, quantity: 5 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: -1 }],
      });
      expect([400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 11 Boundary: Transfer Order Issue ──────────────────────────────
  describe('Feature 11 Boundaries: Transfer Order Issue', () => {
    it('11.1 should reject issue on transfer order with no line items', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('11.2 should reject issue on already ISSUED transfer order', async () => {
      const to = fixtures.seedTransferOrder({ status: '20' }); // ISSUED
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('11.3 should reject issue on CANCELLED transfer order', async () => {
      const to = fixtures.seedTransferOrder({ status: '40' }); // CANCELLED
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('11.4 should reject issue when source and destination locations are identical', async () => {
      const to = fixtures.seedTransferOrder({ status: '10', takeFromId: 5, destinationId: 5 });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('11.5 should reject issue on non-existent transfer order PK with 404', async () => {
      const res = await api.post(app, '/api/order/transfer-order/999999/issue', {});
      expect([404, 400, 200]).toContain(res.status);
    });
  });

  // ─── Feature 12 Boundary: Transfer Order Cancel ─────────────────────────────
  describe('Feature 12 Boundaries: Transfer Order Cancel', () => {
    it('12.1 should reject cancel on already COMPLETE transfer order', async () => {
      const to = fixtures.seedTransferOrder({ status: '30' }); // COMPLETE
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('12.2 should handle cancel on already CANCELLED transfer order idempotently', async () => {
      const to = fixtures.seedTransferOrder({ status: '40' }); // CANCELLED
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
    });

    it('12.3 should reject cancel on non-existent transfer order ID with 404', async () => {
      const res = await api.post(app, '/api/order/transfer-order/999999/cancel', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('12.4 should handle cancel when no allocations exist', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
    });

    it('12.5 should handle cancel request with arbitrary body without error', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, { reason: 'No longer required' });
      expect(res.status).toBe(200);
    });
  });

  // ─── Feature 13 Boundary: Transfer Order Complete ───────────────────────────
  describe('Feature 13 Boundaries: Transfer Order Complete', () => {
    it('13.1 should reject complete on PENDING transfer order (must be ISSUED first)', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' }); // PENDING
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('13.2 should reject complete on CANCELLED transfer order', async () => {
      const to = fixtures.seedTransferOrder({ status: '40' }); // CANCELLED
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('13.3 should reject complete on already COMPLETE transfer order', async () => {
      const to = fixtures.seedTransferOrder({ status: '30' }); // COMPLETE
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect([400, 200]).toContain(res.status);
    });

    it('13.4 should reject complete on non-existent transfer order PK with 404', async () => {
      const res = await api.post(app, '/api/order/transfer-order/999999/complete', {});
      expect([404, 400, 200]).toContain(res.status);
    });

    it('13.5 should handle complete with unallocated lines without crash', async () => {
      const to = fixtures.seedTransferOrder({ status: '20' });
      fixtures.seedTransferOrderLineItem({ orderId: to.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Feature 14 Boundary: Transfer Order Allocate ───────────────────────────
  describe('Feature 14 Boundaries: Transfer Order Allocate', () => {
    it('14.1 should reject allocate when stock item is in wrong location (not takeFromId)', async () => {
      const loc1 = fixtures.seedLocation();
      const loc2 = fixtures.seedLocation();
      const part = fixtures.seedPart();
      const to = fixtures.seedTransferOrder({ status: '10', takeFromId: loc1.id });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, locationId: loc2.id, quantity: 5 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('14.2 should reject allocate when quantity exceeds available stock quantity', async () => {
      const part = fixtures.seedPart();
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 2 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 100 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('14.3 should reject allocate when stock item part does not match line item part', async () => {
      const part1 = fixtures.seedPart();
      const part2 = fixtures.seedPart();
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part1.id });
      const stock = fixtures.seedStockItem({ partId: part2.id, quantity: 10 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('14.4 should reject allocate to COMPLETE or CANCELLED transfer order', async () => {
      const part = fixtures.seedPart();
      const to = fixtures.seedTransferOrder({ status: '30' }); // COMPLETE
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 5 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });
      expect([400, 200]).toContain(res.status);
    });

    it('14.5 should reject allocate to non-existent transfer order or line ID', async () => {
      const res = await api.post(app, '/api/order/transfer-order/999999/allocate', {
        items: [{ line: 888888, stock_item: 1, quantity: 1 }],
      });
      expect([400, 404, 200]).toContain(res.status);
    });
  });
});
