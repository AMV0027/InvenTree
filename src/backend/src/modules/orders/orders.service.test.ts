import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkOrderLocked,
  receivePurchaseOrderItems,
  POStatus,
  SOStatus,
  ROStatus,
  TOStatus,
  StockStatus,
  StockHistoryCode,
  incrementSerialNumber,
  extractSerialNumbers,
  getUnallocatedStockQuantity,
  isStockItemInStock,
  allocateSalesOrderStock,
  allocateSalesOrderSerials,
  autoAllocateSalesOrder,
  holdReturnOrder,
  receiveReturnOrderItems,
  issueTransferOrder,
  holdTransferOrder,
  cancelTransferOrder,
  allocateTransferOrderStock,
  allocateTransferOrderSerials,
  completeTransferOrder,
} from './orders.service.js';
import { prisma } from '../../utils/db.js';

vi.mock('../../utils/db.js', () => ({
  prisma: {
    purchaseorder: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    purchaseorderlineitem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    salesorder: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    salesorderlineitem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    salesordershipment: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    salesorderallocation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    returnorder: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    returnorderlineitem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    transferorder: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    transferorderlineitem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    transferorderallocation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
    stockitem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    stocklocation: { findUnique: vi.fn(), findMany: vi.fn() },
    stockitemtracking: { create: vi.fn() },
    builditem: { aggregate: vi.fn() },
  },
}));

describe('Orders Service Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Helper & Utility Unit Tests ─────────────────────────────────────────

  describe('incrementSerialNumber', () => {
    it('increments standard numeric string', () => {
      expect(incrementSerialNumber('1')).toBe('2');
      expect(incrementSerialNumber('001')).toBe('002');
      expect(incrementSerialNumber('099')).toBe('100');
    });

    it('increments alphanumeric string suffix', () => {
      expect(incrementSerialNumber('SN-001')).toBe('SN-002');
      expect(incrementSerialNumber('BATCH-99')).toBe('BATCH-100');
    });

    it('returns default 1 for empty or null inputs', () => {
      expect(incrementSerialNumber('')).toBe('1');
      expect(incrementSerialNumber(null)).toBe('1');
    });

    it('returns string unchanged if no numeric portion exists', () => {
      expect(incrementSerialNumber('ABC')).toBe('ABC');
    });
  });

  describe('extractSerialNumbers', () => {
    it('parses comma and whitespace separated serials', () => {
      expect(extractSerialNumbers('101, 102, 103', 3)).toEqual(['101', '102', '103']);
      expect(extractSerialNumbers('101 102 103', 3)).toEqual(['101', '102', '103']);
    });

    it('parses hyphen range notation', () => {
      expect(extractSerialNumbers('1-4', 4)).toEqual(['1', '2', '3', '4']);
      expect(extractSerialNumbers('SN-001-SN-003', 3)).toEqual(['SN-001', 'SN-002', 'SN-003']);
    });

    it('parses plus count notation', () => {
      expect(extractSerialNumbers('100+3', 3)).toEqual(['100', '101', '102']);
    });

    it('auto-derives quantity when expectedQuantity is omitted', () => {
      expect(extractSerialNumbers('101, 102, 103')).toEqual(['101', '102', '103']);
      expect(extractSerialNumbers('1-4')).toEqual(['1', '2', '3', '4']);
      expect(extractSerialNumbers('SN-001-SN-003')).toEqual(['SN-001', 'SN-002', 'SN-003']);
      expect(extractSerialNumbers('100+3')).toEqual(['100', '101', '102']);
    });

    it('throws on duplicate serials', () => {
      expect(() => extractSerialNumbers('101, 101, 102', 3)).toThrow(/Duplicate serial/);
    });

    it('throws when serial count does not match expected quantity', () => {
      expect(() => extractSerialNumbers('1-3', 5)).toThrow(/must match quantity/);
    });

    it('throws on empty string or invalid quantity', () => {
      expect(() => extractSerialNumbers('', 2)).toThrow(/Empty serial number string/);
      expect(() => extractSerialNumbers('1,2', 0)).toThrow(/Invalid quantity/);
      expect(() => extractSerialNumbers('1,2', 1001)).toThrow(/Cannot serialize more than 1000/);
    });
  });

  describe('isStockItemInStock', () => {
    it('returns true for available in-stock item', () => {
      const item = {
        quantity: 10,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        isBuilding: false,
        status: StockStatus.OK,
      };
      expect(isStockItemInStock(item)).toBe(true);
    });

    it('returns false for quarantined, destroyed, or non-active item', () => {
      expect(isStockItemInStock({ quantity: 10, status: StockStatus.DESTROYED })).toBe(false);
      expect(isStockItemInStock({ quantity: 10, status: StockStatus.QUARANTINED })).toBe(false);
      expect(isStockItemInStock({ quantity: 0, status: StockStatus.OK })).toBe(false);
      expect(isStockItemInStock({ quantity: 5, isBuilding: true, status: StockStatus.OK })).toBe(false);
      expect(isStockItemInStock({ quantity: 5, customerId: 12, status: StockStatus.OK })).toBe(false);
    });
  });

  describe('getUnallocatedStockQuantity', () => {
    it('computes unallocated stock accurately across all allocation types', async () => {
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 3 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 2 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 1 } } as any);

      const stockItem = { id: 10, quantity: 10 };
      const unallocated = await getUnallocatedStockQuantity(stockItem);
      expect(unallocated).toBe(4);
    });
  });

  describe('checkOrderLocked', () => {
    it('should throw if purchase order is not PENDING', async () => {
      vi.mocked(prisma.purchaseorder.findUnique).mockResolvedValue({ status: POStatus.PLACED } as any);
      await expect(checkOrderLocked(1, 'purchase')).rejects.toThrow('This order is locked and cannot be modified');
    });

    it('should pass if purchase order is PENDING', async () => {
      vi.mocked(prisma.purchaseorder.findUnique).mockResolvedValue({ status: POStatus.PENDING } as any);
      await expect(checkOrderLocked(1, 'purchase')).resolves.not.toThrow();
    });

    it('should throw if sales order is not PENDING', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ status: SOStatus.IN_PROGRESS } as any);
      await expect(checkOrderLocked(1, 'sales')).rejects.toThrow('This order is locked and cannot be modified');
    });

    it('should throw if transfer order is not PENDING', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({ status: TOStatus.ISSUED } as any);
      await expect(checkOrderLocked(1, 'transfer')).rejects.toThrow('This order is locked and cannot be modified');
    });
  });

  // ─── 2. Sales Order Operations ──────────────────────────────────────────────

  describe('Sales Order Allocations', () => {
    it('allocates available stock item to sales order line', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findUnique).mockResolvedValue({
        id: 10,
        orderId: 1,
        partId: 5,
        part: { id: 5 },
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 100,
        partId: 5,
        quantity: 10,
        status: StockStatus.OK,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        isBuilding: false,
      } as any);
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.salesorderallocation.create).mockResolvedValue({ id: 50, lineId: 10, itemId: 100, quantity: 4 } as any);

      const res = await allocateSalesOrderStock(1, [{ line_item: 10, stock_item: 100, quantity: 4 }]);
      expect(res.success).toBe(true);
      expect(prisma.salesorderallocation.create).toHaveBeenCalledWith({
        data: { lineId: 10, itemId: 100, quantity: 4, shipmentId: null },
      });
    });

    it('rejects allocation when available quantity is exceeded', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findUnique).mockResolvedValue({ id: 10, orderId: 1, partId: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 100,
        partId: 5,
        quantity: 10,
        status: StockStatus.OK,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        isBuilding: false,
      } as any);
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 8 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);

      await expect(
        allocateSalesOrderStock(1, [{ line_item: 10, stock_item: 100, quantity: 5 }])
      ).rejects.toThrow(/Available quantity \(2\) exceeded/);
    });

    it('rejects serialized stock item when allocation quantity is not 1', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findUnique).mockResolvedValue({ id: 10, orderId: 1, partId: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 100,
        partId: 5,
        quantity: 1,
        serial: 'SN-001',
        status: StockStatus.OK,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        isBuilding: false,
      } as any);

      await expect(
        allocateSalesOrderStock(1, [{ line_item: 10, stock_item: 100, quantity: 2 }])
      ).rejects.toThrow(/Quantity must be 1 for serialized stock item/);
    });

    it('bulk allocates serialized stock items via allocateSalesOrderSerials', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findUnique).mockResolvedValue({ id: 10, orderId: 1, partId: 5 } as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        {
          id: 101,
          serial: 'SN-01',
          partId: 5,
          quantity: 1,
          status: StockStatus.OK,
          belongsToId: null,
          customerId: null,
          consumedById: null,
          isBuilding: false,
        },
        {
          id: 102,
          serial: 'SN-02',
          partId: 5,
          quantity: 1,
          status: StockStatus.OK,
          belongsToId: null,
          customerId: null,
          consumedById: null,
          isBuilding: false,
        },
      ] as any);
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);

      const res = await allocateSalesOrderSerials(1, 10, 2, 'SN-01, SN-02');
      expect(res.success).toBe(true);
      expect(prisma.salesorderallocation.create).toHaveBeenCalledTimes(2);
    });

    it('rejects allocateSalesOrderSerials if a serial number is missing or unavailable', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findUnique).mockResolvedValue({ id: 10, orderId: 1, partId: 5 } as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { id: 101, serial: 'SN-01', partId: 5, quantity: 1, status: StockStatus.OK },
      ] as any);

      await expect(allocateSalesOrderSerials(1, 10, 2, 'SN-01, SN-02')).rejects.toThrow(
        /No match found for the following serial numbers: SN-02/
      );
    });

    it('auto-allocates available stock across sales order lines', async () => {
      vi.mocked(prisma.salesorder.findUnique).mockResolvedValue({ id: 1, status: SOStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.salesorderlineitem.findMany).mockResolvedValue([
        {
          id: 10,
          orderId: 1,
          partId: 5,
          quantity: 5,
          salesorderallocation_lines: [],
          part: { id: 5, virtual: false },
        },
      ] as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        {
          id: 201,
          partId: 5,
          quantity: 3,
          creationDate: new Date('2026-01-01'),
          status: StockStatus.OK,
          belongsToId: null,
          customerId: null,
          consumedById: null,
          isBuilding: false,
        },
        {
          id: 202,
          partId: 5,
          quantity: 4,
          creationDate: new Date('2026-01-02'),
          status: StockStatus.OK,
          belongsToId: null,
          customerId: null,
          consumedById: null,
          isBuilding: false,
        },
      ] as any);
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);

      const res = await autoAllocateSalesOrder(1, { stock_sort_by: 'updated', interchangeable: true });
      expect(res.complete).toBe(true);
      expect(prisma.salesorderallocation.create).toHaveBeenCalledTimes(2);
      expect(prisma.salesorderallocation.create).toHaveBeenNthCalledWith(1, {
        data: { lineId: 10, itemId: 201, quantity: 3, shipmentId: null },
      });
      expect(prisma.salesorderallocation.create).toHaveBeenNthCalledWith(2, {
        data: { lineId: 10, itemId: 202, quantity: 2, shipmentId: null },
      });
    });
  });

  // ─── 3. Return Order Operations ─────────────────────────────────────────────

  describe('Return Order Operations', () => {
    it('places Return Order on hold', async () => {
      vi.mocked(prisma.returnorder.findUnique).mockResolvedValue({ id: 1, status: ROStatus.PENDING } as any);
      const res = await holdReturnOrder(1);
      expect(res.success).toBe(true);
      expect(prisma.returnorder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: ROStatus.ON_HOLD },
      });
    });

    it('rejects hold on complete Return Order', async () => {
      vi.mocked(prisma.returnorder.findUnique).mockResolvedValue({ id: 1, status: ROStatus.COMPLETE } as any);
      await expect(holdReturnOrder(1)).rejects.toThrow(/Return Order cannot be placed on hold/);
    });

    it('receives Return Order items with stock location update and tracking', async () => {
      vi.mocked(prisma.returnorder.findUnique).mockResolvedValue({ id: 1, status: ROStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 20, name: 'Quarantine Bay' } as any);
      vi.mocked(prisma.returnorderlineitem.findUnique).mockResolvedValue({
        id: 10,
        orderId: 1,
        quantity: 1,
        receivedDate: null,
        item: { id: 100, quantity: 1, serial: 'SN-RMA-1', customerId: 99, status: StockStatus.OK },
      } as any);

      const res = await receiveReturnOrderItems(1, [{ item: 10 }], 20, 'Received RMA');
      expect(res.success).toBe(true);

      // Stock item updated to Quarantine & location
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: {
          locationId: 20,
          status: StockStatus.QUARANTINED,
          customerId: null,
          salesOrderId: null,
        },
      });

      // Tracking log created
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 100,
          trackingType: StockHistoryCode.RETURNED_AGAINST_RETURN_ORDER,
          notes: 'Received RMA',
          deltas: expect.objectContaining({
            status: 75,
            returnorder: 1,
            location: 20,
            quantity: 1,
            customer: 99,
          }),
        }),
      });

      // Line marked received
      expect(prisma.returnorderlineitem.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { receivedDate: expect.any(Date) },
      });
    });

    it('splits untracked stock item when returned quantity is partial', async () => {
      vi.mocked(prisma.returnorder.findUnique).mockResolvedValue({ id: 1, status: ROStatus.IN_PROGRESS } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 20 } as any);
      vi.mocked(prisma.returnorderlineitem.findUnique).mockResolvedValue({
        id: 10,
        orderId: 1,
        quantity: 4,
        receivedDate: null,
        item: { id: 100, quantity: 10, serial: null, customerId: 99, status: StockStatus.OK, partId: 5 },
      } as any);
      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 101 } as any);

      const res = await receiveReturnOrderItems(1, [{ item: 10 }], 20);
      expect(res.success).toBe(true);

      // Creates split stock item with quantity 4
      expect(prisma.stockitem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quantity: 4,
          locationId: 20,
          status: StockStatus.QUARANTINED,
          parentId: 100,
          customerId: null,
        }),
      });

      // Decrements parent quantity by 4
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { quantity: { decrement: 4 } },
      });

      // Points line item to new split stock item
      expect(prisma.returnorderlineitem.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { itemId: 101 },
      });
    });
  });

  // ─── 4. Transfer Order Operations ───────────────────────────────────────────

  describe('Transfer Order Operations', () => {
    it('issues a pending Transfer Order', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({ id: 1, status: TOStatus.PENDING } as any);
      const res = await issueTransferOrder(1);
      expect(res.success).toBe(true);
      expect(prisma.transferorder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: TOStatus.ISSUED, issueDate: expect.any(Date) },
      });
    });

    it('cancels an open Transfer Order and removes allocations atomically', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({ id: 1, status: TOStatus.ISSUED } as any);
      const res = await cancelTransferOrder(1);
      expect(res.success).toBe(true);
      expect(prisma.transferorderallocation.deleteMany).toHaveBeenCalledWith({
        where: { line: { orderId: 1 } },
      });
      expect(prisma.transferorder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: TOStatus.CANCELLED },
      });
    });

    it('allocates stock to a Transfer Order line item', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({ id: 1, status: TOStatus.ISSUED } as any);
      vi.mocked(prisma.transferorderlineitem.findUnique).mockResolvedValue({
        id: 10,
        orderId: 1,
        partId: 8,
        part: { id: 8 },
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 100,
        partId: 8,
        quantity: 10,
        status: StockStatus.OK,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        isBuilding: false,
      } as any);
      vi.mocked(prisma.salesorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.builditem.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);
      vi.mocked(prisma.transferorderallocation.aggregate).mockResolvedValue({ _sum: { quantity: 0 } } as any);

      const res = await allocateTransferOrderStock(1, [{ line_item: 10, stock_item: 100, quantity: 5 }]);
      expect(res.success).toBe(true);
      expect(prisma.transferorderallocation.create).toHaveBeenCalledWith({
        data: { lineId: 10, itemId: 100, quantity: 5 },
      });
    });

    it('completes Transfer Order with full stock move', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({
        id: 1,
        status: TOStatus.ISSUED,
        destinationId: 50,
        consume: false,
        transferorderlineitem_orders: [
          {
            id: 10,
            quantity: 5,
            transferred: 0,
            transferorderallocation_lines: [{ id: 1, itemId: 100, quantity: 5 }],
          },
        ],
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 100, quantity: 5, status: StockStatus.OK } as any);

      const res = await completeTransferOrder(1);
      expect(res.success).toBe(true);

      // Stock moved to destination 50
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { locationId: 50 },
      });

      // Tracking log recorded
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 100,
          trackingType: StockHistoryCode.STOCK_MOVE,
          deltas: expect.objectContaining({ location: 50, transferorder: 1, quantity: 5 }),
        }),
      });

      // Order completed
      expect(prisma.transferorder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ status: TOStatus.COMPLETE }),
      });
    });

    it('completes Transfer Order with consume=true (stock deduction & remove tracking)', async () => {
      vi.mocked(prisma.transferorder.findUnique).mockResolvedValue({
        id: 1,
        status: TOStatus.ISSUED,
        destinationId: null,
        consume: true,
        transferorderlineitem_orders: [
          {
            id: 10,
            quantity: 3,
            transferred: 0,
            transferorderallocation_lines: [{ id: 1, itemId: 100, quantity: 3 }],
          },
        ],
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 100,
        quantity: 10,
        deleteOnDeplete: false,
      } as any);

      const res = await completeTransferOrder(1);
      expect(res.success).toBe(true);

      // Stock quantity reduced to 7
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { quantity: 7 },
      });

      // Tracking logged as STOCK_REMOVE
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 100,
          trackingType: StockHistoryCode.STOCK_REMOVE,
          deltas: expect.objectContaining({ transferorder: 1, removed: 3, quantity: 7 }),
        }),
      });
    });
  });

  // ─── 5. Purchase Order Operations ───────────────────────────────────────────

  describe('receivePurchaseOrderItems', () => {
    it('should throw if PO is not PLACED', async () => {
      vi.mocked(prisma.purchaseorder.findUnique).mockResolvedValue({ status: POStatus.PENDING } as any);
      await expect(receivePurchaseOrderItems(1, [])).rejects.toThrow('Order must be in PLACED status to receive items');
    });

    it('should process items successfully', async () => {
      vi.mocked(prisma.purchaseorder.findUnique).mockResolvedValue({ id: 1, status: POStatus.PLACED, reference: 'PO-001' } as any);
      vi.mocked(prisma.purchaseorderlineitem.findUnique).mockResolvedValue({ id: 10, partId: 5, destinationId: 2 } as any);
      vi.mocked(prisma.purchaseorderlineitem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 100 } as any);
      vi.mocked(prisma.stockitem.findFirst).mockResolvedValue(null);

      const items = [{ line_item: 10, quantity: 5, status: '10' }];
      const res = await receivePurchaseOrderItems(1, items, undefined, 99);

      expect(res.length).toBe(1);
      expect(prisma.stockitem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ partId: 5, quantity: 5, purchaseOrderId: 1, locationId: 2 }),
      });
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ itemId: 100, trackingType: 1, userId: 99 }),
      });
      expect(prisma.purchaseorderlineitem.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { received: { increment: 5 } },
      });
    });
  });
});
