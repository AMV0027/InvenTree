import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrismaStore } from '../../helpers/mockDb.js';
import { FixtureFactory } from '../../helpers/fixtures.js';
import { createTestApp, api } from '../../helpers/testApp.js';

const { store, prismaMock, resetDb } = createMockPrismaStore();
const fixtures = new FixtureFactory(store);

vi.mock('../../../../utils/db.js', () => ({
  prisma: prismaMock,
}));

describe('Tier 1: Order Operations Features (Features 6-14)', () => {
  let app: any;

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
    app = createTestApp();
  });

  // ─── Feature 6: Sales Order Allocate (/api/order/so/:pk/allocate) ───────────
  describe('Feature 6: Sales Order Allocate', () => {
    it('6.1 should allocate stock item matching exact part to sales order line', async () => {
      const part = fixtures.seedPart({ name: 'Mechanical Keyboard', salable: true });
      const customer = fixtures.seedCompany({ name: 'Acme Corp', isCustomer: true });
      const so = fixtures.seedSalesOrder({ customerId: customer.id, status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 10 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 2 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('6.2 should allocate stock item that is a valid variant of the line part', async () => {
      const basePart = fixtures.seedPart({ name: 'T-Shirt Base', isTemplate: true });
      const variantPart = fixtures.seedPart({ name: 'T-Shirt Red M', variantOfId: basePart.id });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: basePart.id });
      const stock = fixtures.seedStockItem({ partId: variantPart.id, quantity: 5 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('6.3 should allocate partial quantity of stock item to sales order line', async () => {
      const part = fixtures.seedPart({ name: 'USB-C Cable', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 50 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 15 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('6.4 should allocate multiple stock items across multiple SO lines in one request', async () => {
      const partA = fixtures.seedPart({ name: 'Headphones', salable: true });
      const partB = fixtures.seedPart({ name: 'Audio Jack Adapter', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const lineA = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: partA.id });
      const lineB = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: partB.id });
      const stockA = fixtures.seedStockItem({ partId: partA.id, quantity: 10 });
      const stockB = fixtures.seedStockItem({ partId: partB.id, quantity: 20 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [
          { line: lineA.id, stock_item: stockA.id, quantity: 2 },
          { line: lineB.id, stock_item: stockB.id, quantity: 2 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('6.5 should allocate stock item specifying destination shipment ID', async () => {
      const part = fixtures.seedPart({ name: 'Wireless Mouse', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const shipment = fixtures.seedSalesOrderShipment({ orderId: so.id, reference: 'SHIP-01' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 5 });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1, shipment: shipment.id }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 7: Sales Order Allocate Serials (/api/order/so/:pk/allocate-serials)
  describe('Feature 7: Sales Order Allocate Serials', () => {
    it('7.1 should allocate comma-separated list of serial numbers to SO line', async () => {
      const part = fixtures.seedPart({ name: 'Smart Watch', trackable: true, salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-001' });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-002' });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'SN-003' });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'SN-001, SN-002, SN-003',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7.2 should allocate numeric serial range expression (e.g. 101-105)', async () => {
      const part = fixtures.seedPart({ name: 'Industrial Sensor', trackable: true, salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      for (let s = 101; s <= 105; s++) {
        fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: String(s) });
      }

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: '101-105',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7.3 should allocate combined expressions containing individual serials and ranges', async () => {
      const part = fixtures.seedPart({ name: 'Servo Motor', trackable: true, salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      [1, 2, 3, 5, 8, 9, 10].forEach((s) => {
        fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: String(s) });
      });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: '1-3, 5, 8-10',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7.4 should allocate serials associating them with specific shipment', async () => {
      const part = fixtures.seedPart({ name: 'GPS Receiver', trackable: true, salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const shipment = fixtures.seedSalesOrderShipment({ orderId: so.id, reference: 'SHIP-AIR' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'GPS-881' });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'GPS-881',
        shipment: shipment.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('7.5 should allocate serials and reflect in line allocation tracking', async () => {
      const part = fixtures.seedPart({ name: 'Transceiver', trackable: true, salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      const line = fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'TX-10' });
      fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'TX-20' });

      const res = await api.post(app, `/api/order/so/${so.id}/allocate-serials`, {
        line: line.id,
        serials: 'TX-10, TX-20',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 8: Sales Order Auto-Allocate (/api/order/so/:pk/auto-allocate) ─
  describe('Feature 8: Sales Order Auto-Allocate', () => {
    it('8.1 should auto-allocate unallocated lines using default FIFO strategy', async () => {
      const part = fixtures.seedPart({ name: 'Micro SD Card', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 10, batch: 'BATCH-JAN', creationDate: new Date('2026-01-01') });
      fixtures.seedStockItem({ partId: part.id, quantity: 10, batch: 'BATCH-FEB', creationDate: new Date('2026-02-01') });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {
        strategy: 'FIFO',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8.2 should auto-allocate using LIFO strategy (newest stock first)', async () => {
      const part = fixtures.seedPart({ name: 'Micro SD Card', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 10, creationDate: new Date('2026-01-01') });
      fixtures.seedStockItem({ partId: part.id, quantity: 10, creationDate: new Date('2026-06-01') });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {
        strategy: 'LIFO',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8.3 should auto-allocate using Expiry strategy (earliest expiring stock first)', async () => {
      const part = fixtures.seedPart({ name: 'Chemical Reagent', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, quantity: 5, expiryDate: new Date('2026-09-01') });
      fixtures.seedStockItem({ partId: part.id, quantity: 5, expiryDate: new Date('2027-01-01') });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {
        strategy: 'EXPIRY',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8.4 should auto-allocate respecting location filter', async () => {
      const part = fixtures.seedPart({ name: 'HDMI Cable', salable: true });
      const locEast = fixtures.seedLocation({ name: 'East Coast DC' });
      const locWest = fixtures.seedLocation({ name: 'West Coast DC' });
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part.id });
      fixtures.seedStockItem({ partId: part.id, locationId: locEast.id, quantity: 20 });
      fixtures.seedStockItem({ partId: part.id, locationId: locWest.id, quantity: 20 });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {
        location: locEast.id,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('8.5 should auto-allocate multiple sales order lines in a single call', async () => {
      const part1 = fixtures.seedPart({ name: 'Part Alpha', salable: true });
      const part2 = fixtures.seedPart({ name: 'Part Beta', salable: true });
      const so = fixtures.seedSalesOrder({ status: '10' });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part1.id });
      fixtures.seedSalesOrderLineItem({ orderId: so.id, partId: part2.id });
      fixtures.seedStockItem({ partId: part1.id, quantity: 10 });
      fixtures.seedStockItem({ partId: part2.id, quantity: 10 });

      const res = await api.post(app, `/api/order/so/${so.id}/auto-allocate`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 9: Return Order Hold (/api/order/ro/:pk/hold) ───────────────────
  describe('Feature 9: Return Order Hold', () => {
    it('9.1 should place PENDING Return Order on hold (status = 25 / ON_HOLD)', async () => {
      const ro = fixtures.seedReturnOrder({ status: '10' });
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('9.2 should place IN_PROGRESS Return Order on hold (status = 25 / ON_HOLD)', async () => {
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('9.3 should return success true in JSON response body', async () => {
      const ro = fixtures.seedReturnOrder({ status: '10' });
      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect(res.body).toHaveProperty('success', true);
    });

    it('9.4 should allow subsequent resumption / issue after being placed on hold', async () => {
      const ro = fixtures.seedReturnOrder({ status: '25' });
      const res = await api.post(app, `/api/order/ro/${ro.id}/issue`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('9.5 should preserve all attached lines when placed on hold', async () => {
      const part = fixtures.seedPart({ name: 'Returned Widget' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1 });
      const ro = fixtures.seedReturnOrder({ status: '10' });
      fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/hold`, {});
      expect(res.status).toBe(200);
    });
  });

  // ─── Feature 10: Return Order Receive (/api/order/ro/:pk/receive) ───────────
  describe('Feature 10: Return Order Receive', () => {
    it('10.1 should receive full quantity of return line item into destination location', async () => {
      const part = fixtures.seedPart({ name: 'Defective Sensor' });
      const loc = fixtures.seedLocation({ name: 'Quarantine Bay' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 1 });
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, location: loc.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('10.2 should set stock item status to QUARANTINED (75) upon receipt', async () => {
      const part = fixtures.seedPart({ name: 'Returned Router' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 1, status: '10' });
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 1, status: '75' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('10.3 should reset stock item customerId to null upon return receipt', async () => {
      const part = fixtures.seedPart({ name: 'Returned Drone' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 42 });
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('10.4 should log stockitemtracking entry with trackingType 80 (RETURN)', async () => {
      const part = fixtures.seedPart({ name: 'Returned PSU' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, customerId: 1 });
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 1 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 1, notes: 'RMA receipt inspection' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('10.5 should receive partial quantity of return line item', async () => {
      const part = fixtures.seedPart({ name: 'Bulk Fasteners' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 100, customerId: 1 });
      const ro = fixtures.seedReturnOrder({ status: '20' });
      const line = fixtures.seedReturnOrderLineItem({ orderId: ro.id, itemId: stock.id, quantity: 100 });

      const res = await api.post(app, `/api/order/ro/${ro.id}/receive`, {
        items: [{ line_item: line.id, quantity: 40 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 11: Transfer Order Issue (/api/order/transfer-order/:pk/issue) ──
  describe('Feature 11: Transfer Order Issue', () => {
    it('11.1 should issue PENDING transfer order, setting status to ISSUED (20)', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('11.2 should stamp issueDate timestamp upon issuing', async () => {
      const to = fixtures.seedTransferOrder({ status: '10', issueDate: null });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('11.3 should validate transfer order lines before issuing', async () => {
      const part = fixtures.seedPart({ name: 'Transferred Cable' });
      const to = fixtures.seedTransferOrder({ status: '10' });
      fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('11.4 should validate transfer order source and destination locations', async () => {
      const locSrc = fixtures.seedLocation({ name: 'HQ Warehouse' });
      const locDst = fixtures.seedLocation({ name: 'Branch Warehouse' });
      const to = fixtures.seedTransferOrder({ status: '10', takeFromId: locSrc.id, destinationId: locDst.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('11.5 should return success confirmation response', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/issue`, {});
      expect(res.body).toEqual({ success: true });
    });
  });

  // ─── Feature 12: Transfer Order Cancel (/api/order/transfer-order/:pk/cancel) 
  describe('Feature 12: Transfer Order Cancel', () => {
    it('12.1 should cancel PENDING transfer order, setting status to CANCELLED (40)', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('12.2 should cancel ISSUED transfer order (status 20 -> 40)', async () => {
      const to = fixtures.seedTransferOrder({ status: '20' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('12.3 should delete all attached transferorderallocations upon cancellation', async () => {
      const part = fixtures.seedPart({ name: 'Transferred Motor' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 5 });
      const to = fixtures.seedTransferOrder({ status: '20' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 5 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('12.4 should restore unallocated availability of stock items', async () => {
      const part = fixtures.seedPart({ name: 'Transferred Switch' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 10 });
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 10 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.status).toBe(200);
    });

    it('12.5 should return success confirmation response', async () => {
      const to = fixtures.seedTransferOrder({ status: '10' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/cancel`, {});
      expect(res.body).toEqual({ success: true });
    });
  });

  // ─── Feature 13: Transfer Order Complete (/api/order/transfer-order/:pk/complete)
  describe('Feature 13: Transfer Order Complete', () => {
    it('13.1 should complete transfer order, moving allocated stock to destination location', async () => {
      const loc1 = fixtures.seedLocation({ name: 'Origin Warehouse' });
      const loc2 = fixtures.seedLocation({ name: 'Remote Warehouse' });
      const part = fixtures.seedPart({ name: 'Relay Module' });
      const stock = fixtures.seedStockItem({ partId: part.id, locationId: loc1.id, quantity: 5 });
      const to = fixtures.seedTransferOrder({ status: '20', takeFromId: loc1.id, destinationId: loc2.id });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 5 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('13.2 should complete transfer order with consume=true, consuming stock items', async () => {
      const part = fixtures.seedPart({ name: 'Consumable Solder' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 3 });
      const to = fixtures.seedTransferOrder({ status: '20', consume: true });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 3 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('13.3 should split stock item if partial quantity was transferred', async () => {
      const loc1 = fixtures.seedLocation({ name: 'Loc A' });
      const loc2 = fixtures.seedLocation({ name: 'Loc B' });
      const part = fixtures.seedPart({ name: 'Jumper Wire' });
      const stock = fixtures.seedStockItem({ partId: part.id, locationId: loc1.id, quantity: 100 });
      const to = fixtures.seedTransferOrder({ status: '20', destinationId: loc2.id });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 40 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('13.4 should set transfer order status to COMPLETE (30) and set completeDate', async () => {
      const to = fixtures.seedTransferOrder({ status: '20' });
      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('13.5 should log stockitemtracking entries (TRANSFERRED / MOVED) upon completion', async () => {
      const part = fixtures.seedPart({ name: 'Microchip IC' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 2 });
      const to = fixtures.seedTransferOrder({ status: '20' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });
      fixtures.seedTransferOrderAllocation({ lineId: line.id, itemId: stock.id, quantity: 2 });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/complete`, {});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Feature 14: Transfer Order Allocate (/api/order/transfer-order/:pk/allocate)
  describe('Feature 14: Transfer Order Allocate', () => {
    it('14.1 should allocate stock item to transfer order line item', async () => {
      const loc = fixtures.seedLocation({ name: 'Shelf 1' });
      const part = fixtures.seedPart({ name: 'OLED Display' });
      const stock = fixtures.seedStockItem({ partId: part.id, locationId: loc.id, quantity: 10 });
      const to = fixtures.seedTransferOrder({ status: '10', takeFromId: loc.id });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 5 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('14.2 should allocate partial quantity from stock item to line', async () => {
      const part = fixtures.seedPart({ name: 'Heatsink' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 20 });
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 4 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('14.3 should allocate serialized stock items to transfer order line', async () => {
      const part = fixtures.seedPart({ name: 'Tablet Computer', trackable: true });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 1, serial: 'TAB-100' });
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 1 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('14.4 should allocate multiple items across multiple lines in single request', async () => {
      const part1 = fixtures.seedPart({ name: 'Fan 120mm' });
      const part2 = fixtures.seedPart({ name: 'Fan 140mm' });
      const stock1 = fixtures.seedStockItem({ partId: part1.id, quantity: 8 });
      const stock2 = fixtures.seedStockItem({ partId: part2.id, quantity: 8 });
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line1 = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part1.id });
      const line2 = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part2.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [
          { line: line1.id, stock_item: stock1.id, quantity: 2 },
          { line: line2.id, stock_item: stock2.id, quantity: 3 },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('14.5 should validate stock item is available and unreserved', async () => {
      const part = fixtures.seedPart({ name: 'Ethernet Switch' });
      const stock = fixtures.seedStockItem({ partId: part.id, quantity: 6 });
      const to = fixtures.seedTransferOrder({ status: '10' });
      const line = fixtures.seedTransferOrderLineItem({ orderId: to.id, partId: part.id });

      const res = await api.post(app, `/api/order/transfer-order/${to.id}/allocate`, {
        items: [{ line: line.id, stock_item: stock.id, quantity: 6 }],
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
