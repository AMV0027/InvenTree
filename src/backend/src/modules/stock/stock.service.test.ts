import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateStockItem,
  handleStockItemUpdate,
  increment,
  extractSerialNumbers,
  findConflictingSerialNumbers,
  getLatestSerialNumber,
  getConversionOptions,
  checkIfPartInBom,
  mergeStockItems,
  returnStockItems,
  convertStockItem,
  installStockItem,
  uninstallStockItem,
  serializeStockItem,
  StockHistoryCode,
  StockStatus,
  TrackingType,
} from './stock.service.js';
import { prisma } from '../../utils/db.js';

vi.mock('../../utils/db.js', () => ({
  prisma: {
    stockitem: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    stocklocation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    stockitemtracking: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    stockitemtestresult: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    part: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    bomitem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    bomitemsubstitute: {
      findFirst: vi.fn(),
    },
    builditem: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    salesorderallocation: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    transferorderallocation: {
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe('Stock Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Existing validation & tracking tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('validateStockItem', () => {
    it('should throw if quantity > 1 and serial is provided', async () => {
      vi.mocked(prisma.stockitem.findFirst).mockResolvedValue(null);
      await expect(validateStockItem({ partId: 1, quantity: 2, serial: 'SN-123' })).rejects.toThrow(
        'Quantity must be 1 for serialized stock items'
      );
    });

    it('should throw if duplicate serial exists', async () => {
      vi.mocked(prisma.stockitem.findFirst).mockResolvedValue({ id: 10 } as any);
      await expect(validateStockItem({ partId: 1, quantity: 1, serial: 'SN-123' })).rejects.toThrow(
        'Serial number SN-123 already exists for this part'
      );
    });

    it('should pass if serial is unique and quantity is 1', async () => {
      vi.mocked(prisma.stockitem.findFirst).mockResolvedValue(null);
      await expect(validateStockItem({ partId: 1, quantity: 1, serial: 'SN-123' })).resolves.not.toThrow();
    });

    it('should pass if serial is not provided', async () => {
      await expect(validateStockItem({ partId: 1, quantity: 10 })).resolves.not.toThrow();
    });
  });

  describe('handleStockItemUpdate', () => {
    it('should generate tracking entry on status change', async () => {
      const oldItem = { id: 1, status: '10', quantity: 10, locationId: 5 };
      const newData = { status: '20' };

      await handleStockItemUpdate(1, newData, oldItem, 99);

      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 1,
          trackingType: TrackingType.EDITED,
          deltas: { status: '20', old_status: '10' },
          userId: 99,
        }),
      });
    });

    it('should generate tracking entry on quantity and location change', async () => {
      const oldItem = { id: 1, status: '10', quantity: 10, locationId: 5 };
      const newData = { quantity: 15, locationId: 6 };

      await handleStockItemUpdate(1, newData, oldItem);

      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 1,
          trackingType: TrackingType.MOVED,
          deltas: { quantity: 15, old_quantity: 10, location: 6, old_location: 5 },
          userId: undefined,
        }),
      });
    });

    it('should not generate tracking if nothing changed', async () => {
      const oldItem = { id: 1, status: '10', quantity: 10, locationId: 5 };
      const newData = { status: '10', quantity: 10, locationId: 5 };

      await handleStockItemUpdate(1, newData, oldItem);

      expect(prisma.stockitemtracking.create).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Helper Functions: increment & extractSerialNumbers
  // ───────────────────────────────────────────────────────────────────────────
  describe('increment and extractSerialNumbers', () => {
    it('increment should handle numeric and alphanumeric strings with padding', () => {
      expect(increment(null)).toBe('1');
      expect(increment('')).toBe('1');
      expect(increment('1')).toBe('2');
      expect(increment('001')).toBe('002');
      expect(increment('SN-099')).toBe('SN-100');
      expect(increment('ABC')).toBe('ABC');
    });

    it('extractSerialNumbers should parse simple comma/space separated serials', () => {
      const res = extractSerialNumbers('SN-01, SN-02, SN-03', 3);
      expect(res).toEqual(['SN-01', 'SN-02', 'SN-03']);
    });

    it('extractSerialNumbers should parse hyphen ranges', () => {
      const res = extractSerialNumbers('1-5', 5);
      expect(res).toEqual(['1', '2', '3', '4', '5']);
    });

    it('extractSerialNumbers should parse plus syntax', () => {
      const res = extractSerialNumbers('SN-100+3', 3);
      expect(res).toEqual(['SN-100', 'SN-101', 'SN-102']);
    });

    it('extractSerialNumbers should parse tilde ~ syntax with startingValue', () => {
      const res = extractSerialNumbers('~, ~', 2, '50');
      expect(res).toEqual(['51', '52']);
    });

    it('extractSerialNumbers should reject duplicate serials in input', () => {
      expect(() => extractSerialNumbers('1, 1', 2)).toThrow(/Duplicate serial/);
    });

    it('extractSerialNumbers should reject when quantity exceeds 1000', () => {
      expect(() => extractSerialNumbers('1-1005', 1005)).toThrow(/more than 1000 items/);
    });

    it('extractSerialNumbers should reject when count does not match quantity', () => {
      expect(() => extractSerialNumbers('1-3', 5)).toThrow(/Quantity does not match/);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Stock Merge (/api/stock/merge)
  // ───────────────────────────────────────────────────────────────────────────
  describe('mergeStockItems', () => {
    const mockLocation = { id: 5, structural: false };
    const baseItem = {
      id: 101,
      partId: 1,
      supplierPartId: null,
      status: StockStatus.OK,
      quantity: 10,
      purchasePrice: 5.0,
      salesOrderId: null,
      belongsToId: null,
      customerId: null,
      isBuilding: false,
      serial: null,
      parentId: null,
    };
    const secondItem = {
      id: 102,
      partId: 1,
      supplierPartId: null,
      status: StockStatus.OK,
      quantity: 20,
      purchasePrice: 10.0,
      salesOrderId: null,
      belongsToId: null,
      customerId: null,
      isBuilding: false,
      serial: null,
      parentId: null,
    };

    it('should reject if fewer than 2 items provided', async () => {
      await expect(mergeStockItems({ items: [{ pk: 101 }], location: 5 })).rejects.toThrow(
        'At least two stock items must be provided'
      );
    });

    it('should reject duplicate stock items in request', async () => {
      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 101 }], location: 5 })
      ).rejects.toThrow('Duplicate stock items');
    });

    it('should reject if location is structural', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5, structural: true } as any);
      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 102 }], location: 5 })
      ).rejects.toThrow('Structural locations cannot be assigned stock items');
    });

    it('should reject if any item is serialized', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { ...baseItem, serial: 'SN-001' } as any,
        secondItem as any,
      ]);
      vi.mocked(prisma.stockitem.count).mockResolvedValue(0);

      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 102 }], location: 5 })
      ).rejects.toThrow('Serialized stock cannot be merged');
    });

    it('should reject if any item is assigned to a sales order', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        baseItem as any,
        { ...secondItem, salesOrderId: 44 } as any,
      ]);
      vi.mocked(prisma.stockitem.count).mockResolvedValue(0);

      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 102 }], location: 5 })
      ).rejects.toThrow('Stock item has been assigned to a sales order');
    });

    it('should reject if items refer to different parts', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        baseItem as any,
        { ...secondItem, partId: 2 } as any,
      ]);
      vi.mocked(prisma.stockitem.count).mockResolvedValue(0);

      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 102 }], location: 5 })
      ).rejects.toThrow('Stock items must refer to the same part');
    });

    it('should reject if status differs and allow_mismatched_status is false', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        baseItem as any,
        { ...secondItem, status: StockStatus.ATTENTION } as any,
      ]);
      vi.mocked(prisma.stockitem.count).mockResolvedValue(0);

      await expect(
        mergeStockItems({ items: [{ pk: 101 }, { pk: 102 }], location: 5 })
      ).rejects.toThrow('Stock status codes must match');
    });

    it('should merge successfully, compute weighted price, re-parent allocations, delete secondary items, and log tracking', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { ...baseItem, parentId: 102 } as any,
        secondItem as any,
      ]);
      vi.mocked(prisma.stockitem.count).mockResolvedValue(0);

      const result = await mergeStockItems({
        items: [{ pk: 101 }, { pk: 102 }],
        location: 5,
        notes: 'Consolidation merge',
        userId: 42,
      });

      expect(result).toEqual({ success: true });

      // Weighted price: (10*5 + 20*10) / (10 + 20) = (50 + 200)/30 = 250/30 = 8.333...
      const expectedWeightedPrice = 250 / 30;

      expect(prisma.builditem.updateMany).toHaveBeenCalledWith({
        where: { stockItemId: 102 },
        data: { stockItemId: 101 },
      });
      expect(prisma.salesorderallocation.updateMany).toHaveBeenCalledWith({
        where: { itemId: 102 },
        data: { itemId: 101 },
      });
      expect(prisma.transferorderallocation.updateMany).toHaveBeenCalledWith({
        where: { itemId: 102 },
        data: { itemId: 101 },
      });
      expect(prisma.stockitem.delete).toHaveBeenCalledWith({ where: { id: 102 } });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: {
          quantity: 30,
          locationId: 5,
          purchasePrice: expectedWeightedPrice,
          parentId: null,
        },
      });
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 101,
          trackingType: StockHistoryCode.MERGED_STOCK_ITEMS,
          notes: 'Consolidation merge',
          deltas: { quantity: 30, added: 20 },
          userId: 42,
        }),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Stock Return (/api/stock/return)
  // ───────────────────────────────────────────────────────────────────────────
  describe('returnStockItems', () => {
    const mockLocation = { id: 3, structural: false };
    const stockItem = {
      id: 201,
      partId: 1,
      quantity: 50,
      status: StockStatus.OK,
      serial: null,
      customerId: 12,
      consumedById: 8,
      belongsToId: 99,
      salesOrderId: 5,
      parentId: null,
    };

    it('should reject if items list is empty', async () => {
      await expect(returnStockItems({ items: [], location: 3 })).rejects.toThrow(
        'Items list cannot be empty'
      );
    });

    it('should reject if location is structural', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 3, structural: true } as any);
      await expect(returnStockItems({ items: [{ pk: 201 }], location: 3 })).rejects.toThrow(
        'Structural locations cannot be assigned stock items'
      );
    });

    it('should reject if returned quantity is negative or exceeds available stock', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(stockItem as any);

      await expect(
        returnStockItems({ items: [{ pk: 201, quantity: -5 }], location: 3 })
      ).rejects.toThrow('Quantity must be greater than zero');

      await expect(
        returnStockItems({ items: [{ pk: 201, quantity: 100 }], location: 3 })
      ).rejects.toThrow('Quantity exceeds available stock');
    });

    it('should return full stock item, clear unstocked flags, and log tracking 15', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(stockItem as any);

      const res = await returnStockItems({
        items: [{ pk: 201 }],
        location: 3,
        notes: 'Returned from customer',
        userId: 7,
      });

      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: {
          consumedById: null,
          customerId: null,
          belongsToId: null,
          salesOrderId: null,
          locationId: 3,
          status: undefined,
        },
      });
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 201,
          trackingType: StockHistoryCode.RETURNED_TO_STOCK,
          notes: 'Returned from customer',
          deltas: {
            quantity: 50,
            location: 3,
            customer: 12,
            build_order: 8,
          },
          userId: 7,
        }),
      });
    });

    it('should handle partial return split', async () => {
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(stockItem as any);
      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 202, quantity: 10, status: '10' } as any);

      await returnStockItems({
        items: [{ pk: 201, quantity: 10 }],
        location: 3,
      });

      // Original item decremented by 10 to 40
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { quantity: 40 },
      });

      // Split item created with 10
      expect(prisma.stockitem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partId: 1,
          locationId: 3,
          quantity: 10,
          parentId: 201,
        }),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Stock Convert (/api/stock/:pk/convert)
  // ───────────────────────────────────────────────────────────────────────────
  describe('convertStockItem', () => {
    const currentPart = { id: 10, name: 'Widget Alpha', variantOfId: 5, active: true, virtual: false };
    const targetPart = { id: 11, name: 'Widget Beta', variantOfId: 5, active: true, virtual: false };
    const stockItem = {
      id: 301,
      partId: 10,
      part: currentPart,
      supplierPartId: null,
    };

    it('should reject if stock item is not found', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(null);
      await expect(convertStockItem(301, 11)).rejects.toThrow('Stock item not found');
    });

    it('should reject if stock item has assigned SupplierPart', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ ...stockItem, supplierPartId: 99 } as any);
      vi.mocked(prisma.part.findUnique).mockResolvedValue(targetPart as any);

      await expect(convertStockItem(301, 11)).rejects.toThrow(
        'Cannot convert stock item with assigned SupplierPart'
      );
    });

    it('should reject if target part is not in valid conversion options', async () => {
      const unrelatedPart = { id: 999, name: 'Unrelated Part', variantOfId: null, active: true, virtual: false };
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(stockItem as any);
      vi.mocked(prisma.part.findUnique)
        .mockResolvedValueOnce(unrelatedPart as any) // targetPart
        .mockResolvedValueOnce(currentPart as any) // sourcePart in getConversionOptions
        .mockResolvedValueOnce({ id: 5, active: true, virtual: false } as any); // parent part
      vi.mocked(prisma.part.findMany).mockResolvedValue([]); // no descendants or siblings

      await expect(convertStockItem(301, 999)).rejects.toThrow(
        'Selected part is not a valid option for conversion'
      );
    });

    it('should convert successfully when target part is a valid sibling variant', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(stockItem as any);
      vi.mocked(prisma.part.findUnique)
        .mockResolvedValueOnce(targetPart as any) // targetPart
        .mockResolvedValueOnce(currentPart as any) // sourcePart
        .mockResolvedValueOnce({ id: 5, name: 'Widget Base', active: true, virtual: false } as any); // parent part
      vi.mocked(prisma.part.findMany)
        .mockResolvedValueOnce([]) // descendants of currentPart
        .mockResolvedValueOnce([targetPart as any]); // siblings

      const res = await convertStockItem(301, 11, 42);

      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { partId: 11 },
      });
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 301,
          trackingType: StockHistoryCode.CONVERTED_TO_VARIANT,
          notes: 'Converted to part: Widget Beta',
          deltas: { part: 11 },
          userId: 42,
        }),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Stock Install (/api/stock/:pk/install)
  // ───────────────────────────────────────────────────────────────────────────
  describe('installStockItem', () => {
    const assemblyItem = {
      id: 401,
      partId: 100,
      part: { id: 100, assembly: true },
      quantity: 1,
    };
    const childItem = {
      id: 402,
      partId: 200,
      part: { id: 200, assembly: false },
      quantity: 5,
      serial: null,
      belongsToId: null,
      customerId: null,
      consumedById: null,
      salesOrderId: null,
      isBuilding: false,
    };

    it('should reject if assembly part is not an assembly', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        ...assemblyItem,
        part: { id: 100, assembly: false },
      } as any);

      await expect(
        installStockItem({ assemblyId: 401, stockItemId: 402, quantity: 1 })
      ).rejects.toThrow('Item is not an assembly');
    });

    it('should reject if child item is unavailable', async () => {
      vi.mocked(prisma.stockitem.findUnique)
        .mockResolvedValueOnce(assemblyItem as any)
        .mockResolvedValueOnce({ ...childItem, customerId: 50 } as any);

      await expect(
        installStockItem({ assemblyId: 401, stockItemId: 402, quantity: 1 })
      ).rejects.toThrow('Stock item is unavailable');
    });

    it('should reject if child part is not in BOM of assembly part', async () => {
      vi.mocked(prisma.stockitem.findUnique)
        .mockResolvedValueOnce(assemblyItem as any)
        .mockResolvedValueOnce(childItem as any);
      vi.mocked(prisma.bomitem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.bomitemsubstitute.findFirst).mockResolvedValue(null);

      await expect(
        installStockItem({ assemblyId: 401, stockItemId: 402, quantity: 1 })
      ).rejects.toThrow('Selected part is not in the Bill of Materials');
    });

    it('should install successfully, set belongsToId, clear location, and log tracking 30 & 35', async () => {
      vi.mocked(prisma.stockitem.findUnique)
        .mockResolvedValueOnce(assemblyItem as any)
        .mockResolvedValueOnce({ ...childItem, quantity: 1 } as any);
      vi.mocked(prisma.bomitem.findFirst).mockResolvedValue({ id: 1 } as any);

      const res = await installStockItem({
        assemblyId: 401,
        stockItemId: 402,
        quantity: 1,
        note: 'Installed into chassis',
        userId: 15,
      });

      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 402 },
        data: { belongsToId: 401, locationId: null },
      });
      // Child tracking: 30 INSTALLED_INTO_ASSEMBLY
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 402,
          trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
          notes: 'Installed into chassis',
          deltas: { stockitem: 401, quantity: 1 },
          userId: 15,
        }),
      });
      // Assembly tracking: 35 INSTALLED_CHILD_ITEM
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 401,
          trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
          notes: 'Installed into chassis',
          deltas: { stockitem: 402, quantity: 1 },
          userId: 15,
        }),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Stock Uninstall (/api/stock/:pk/uninstall)
  // ───────────────────────────────────────────────────────────────────────────
  describe('uninstallStockItem', () => {
    const mockLocation = { id: 8, structural: false };
    const installedItem = {
      id: 501,
      belongsToId: 900,
      quantity: 1,
    };

    it('should reject if item is not currently installed', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 501,
        belongsToId: null,
      } as any);

      await expect(uninstallStockItem({ stockItemId: 501, location: 8 })).rejects.toThrow(
        'Stock item is not currently installed'
      );
    });

    it('should reject if destination location is structural', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(installedItem as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 8, structural: true } as any);

      await expect(uninstallStockItem({ stockItemId: 501, location: 8 })).rejects.toThrow(
        'Cannot assign stock to structural location'
      );
    });

    it('should uninstall successfully, clear belongsToId, assign location, and log tracking 36 & 31', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(installedItem as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);

      const res = await uninstallStockItem({
        stockItemId: 501,
        location: 8,
        note: 'Removed for repair',
        userId: 20,
      });

      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 501 },
        data: {
          belongsToId: null,
          consumedById: null,
          locationId: 8,
        },
      });
      // Assembly tracking: 36 REMOVED_CHILD_ITEM
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 900,
          trackingType: StockHistoryCode.REMOVED_CHILD_ITEM,
          notes: 'Removed for repair',
          deltas: { stockitem: 501, quantity: 1 },
          userId: 20,
        }),
      });
      // Uninstalled item tracking: 31 REMOVED_FROM_ASSEMBLY
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 501,
          trackingType: StockHistoryCode.REMOVED_FROM_ASSEMBLY,
          notes: 'Removed for repair',
          deltas: { stockitem: 900, quantity: 1 },
          userId: 20,
        }),
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Stock Serialize (/api/stock/:pk/serialize)
  // ───────────────────────────────────────────────────────────────────────────
  describe('serializeStockItem', () => {
    const mockLocation = { id: 4, structural: false };
    const bulkItem = {
      id: 601,
      partId: 50,
      part: { id: 50, trackable: true },
      quantity: 3,
      serial: null,
      batch: 'BATCH-2026',
      purchasePrice: 15.0,
      status: StockStatus.OK,
      deleteOnDeplete: false,
    };

    it('should reject if part is not trackable', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        ...bulkItem,
        part: { id: 50, trackable: false },
      } as any);

      await expect(
        serializeStockItem({
          stockItemId: 601,
          quantity: 2,
          serial_numbers: '1, 2',
          destination: 4,
        })
      ).rejects.toThrow('Serial numbers cannot be assigned to this part');
    });

    it('should reject if item is already serialized', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        ...bulkItem,
        serial: 'SN-001',
      } as any);

      await expect(
        serializeStockItem({
          stockItemId: 601,
          quantity: 1,
          serial_numbers: 'SN-002',
          destination: 4,
        })
      ).rejects.toThrow('Stock item is already serialized');
    });

    it('should reject if quantity exceeds available stock', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(bulkItem as any);

      await expect(
        serializeStockItem({
          stockItemId: 601,
          quantity: 10,
          serial_numbers: '1-10',
          destination: 4,
        })
      ).rejects.toThrow(/Quantity must not exceed available stock quantity/);
    });

    it('should reject if serial numbers conflict with existing serials in DB', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(bulkItem as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany)
        .mockResolvedValueOnce([]) // getLatestSerialNumber
        .mockResolvedValueOnce([{ serial: '101' }] as any); // findConflictingSerialNumbers

      await expect(
        serializeStockItem({
          stockItemId: 601,
          quantity: 2,
          serial_numbers: '101, 102',
          destination: 4,
        })
      ).rejects.toThrow('Serial numbers already exist: 101');
    });

    it('should serialize successfully, copy test results, create N items, and log tracking 40, 6, 13', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(bulkItem as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany)
        .mockResolvedValueOnce([]) // getLatestSerialNumber
        .mockResolvedValueOnce([]); // findConflictingSerialNumbers
      vi.mocked(prisma.stockitemtestresult.findMany).mockResolvedValue([
        {
          id: 1,
          result: true,
          value: 'PASS',
          templateId: 10,
          userId: 1,
          testStation: 'Station 1',
        } as any,
      ]);

      vi.mocked(prisma.stockitem.create)
        .mockResolvedValueOnce({ id: 701, serial: 'SN-01', quantity: 1 } as any)
        .mockResolvedValueOnce({ id: 702, serial: 'SN-02', quantity: 1 } as any);

      const items = await serializeStockItem({
        stockItemId: 601,
        quantity: 2,
        serial_numbers: 'SN-01, SN-02',
        destination: 4,
        notes: 'Batch serialization',
        userId: 33,
      });

      expect(items.length).toBe(2);
      expect(prisma.stockitem.create).toHaveBeenCalledTimes(2);
      // Verify test results copied
      expect(prisma.stockitemtestresult.create).toHaveBeenCalledTimes(2);

      // Verify tracking 40 SPLIT_FROM_PARENT and 6 ASSIGNED_SERIAL
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 701,
          trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
          deltas: { quantity: 1, location: 4 },
          userId: 33,
        }),
      });
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 701,
          trackingType: StockHistoryCode.ASSIGNED_SERIAL,
          deltas: { serial: 'SN-01' },
          userId: 33,
        }),
      });

      // Verify parent tracking 13 STOCK_SERIALIZED
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 601,
          trackingType: StockHistoryCode.STOCK_SERIALIZED,
          deltas: { quantity: 1, removed: 2 },
          userId: 33,
        }),
      });

      // Verify remaining quantity updated
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 601 },
        data: { quantity: 1 },
      });
    });

    it('should delete source item when depleted if deleteOnDeplete is true', async () => {
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        ...bulkItem,
        quantity: 2,
        deleteOnDeplete: true,
      } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(mockLocation as any);
      vi.mocked(prisma.stockitem.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.stockitemtestresult.findMany).mockResolvedValue([]);
      vi.mocked(prisma.stockitem.create)
        .mockResolvedValueOnce({ id: 801, serial: 'SN-1' } as any)
        .mockResolvedValueOnce({ id: 802, serial: 'SN-2' } as any);

      await serializeStockItem({
        stockItemId: 601,
        quantity: 2,
        serial_numbers: 'SN-1, SN-2',
        destination: 4,
      });

      expect(prisma.stockitem.delete).toHaveBeenCalledWith({ where: { id: 601 } });
    });
  });
});
