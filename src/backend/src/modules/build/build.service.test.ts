import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateBuildOrder,
  validateBuildItemAllocation,
  scrapBuildOutputs,
  autoAllocateBuild,
  allocateStockToBuild,
  unallocateBuildStock,
  consumeBuildStock,
  BuildStatus,
  StockStatus,
  StockHistoryCode,
  BuildError
} from './build.service.js';
import { buildRouter } from './build.routes.js';
import { prisma } from '../../utils/db.js';

vi.mock('../../utils/db.js', () => ({
  prisma: {
    part: { findUnique: vi.fn(), findMany: vi.fn() },
    build: { findUnique: vi.fn(), update: vi.fn() },
    buildline: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    builditem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn()
    },
    stockitem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn()
    },
    stockitemtracking: { create: vi.fn() },
    stocklocation: { findUnique: vi.fn() },
    bomitem: { count: vi.fn(), findFirst: vi.fn() }
  }
}));

describe('Build Service - Complete Business Logic Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Basic Validations ──────────────────────────────────────────────────
  describe('validateBuildOrder', () => {
    it('should throw if part does not exist', async () => {
      vi.mocked(prisma.part.findUnique).mockResolvedValue(null);
      await expect(validateBuildOrder({ partId: 1 })).rejects.toThrow('Part not found');
    });

    it('should throw if part is inactive', async () => {
      vi.mocked(prisma.part.findUnique).mockResolvedValue({ id: 1, active: false } as any);
      await expect(validateBuildOrder({ partId: 1 })).rejects.toThrow('Build order cannot be created for an inactive part');
    });

    it('should throw if part is not an assembly', async () => {
      vi.mocked(prisma.part.findUnique).mockResolvedValue({ id: 1, active: true, assembly: false } as any);
      await expect(validateBuildOrder({ partId: 1 })).rejects.toThrow('Build order can only be created for an assembly part');
    });

    it('should throw if assembly has no BOM items', async () => {
      vi.mocked(prisma.part.findUnique).mockResolvedValue({ id: 1, active: true, assembly: true } as any);
      vi.mocked(prisma.bomitem.count).mockResolvedValue(0);
      await expect(validateBuildOrder({ partId: 1 })).rejects.toThrow('Assembly BOM has not been validated or has no items');
    });

    it('should pass if part is active, assembly, and has BOM', async () => {
      vi.mocked(prisma.part.findUnique).mockResolvedValue({ id: 1, active: true, assembly: true } as any);
      vi.mocked(prisma.bomitem.count).mockResolvedValue(5);
      await expect(validateBuildOrder({ partId: 1 })).resolves.not.toThrow();
    });
  });

  describe('validateBuildItemAllocation', () => {
    it('should throw if allocation quantity > available stock', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 10 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 2, quantity: 5, partId: 20 } as any);
      
      await expect(validateBuildItemAllocation(1, 2, 10)).rejects.toThrow('Allocation quantity cannot exceed available stock item quantity');
    });

    it('should throw if allocated part is not in BOM', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 10 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 2, quantity: 50, partId: 20 } as any);
      vi.mocked(prisma.bomitem.findFirst).mockResolvedValue(null);
      
      await expect(validateBuildItemAllocation(1, 2, 10)).rejects.toThrow('Allocated stock item part is not in the BOM for this build order');
    });

    it('should pass if valid', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 10 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 2, quantity: 50, partId: 20 } as any);
      vi.mocked(prisma.bomitem.findFirst).mockResolvedValue({ id: 100 } as any);
      
      await expect(validateBuildItemAllocation(1, 2, 10)).resolves.not.toThrow();
    });
  });

  // ─── 2. Scrap Outputs ──────────────────────────────────────────────────────
  describe('scrapBuildOutputs', () => {
    it('should throw 404 if build not found', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue(null);
      await expect(scrapBuildOutputs(999, { outputs: [{ output: 1 }], location: 2, notes: 'Scrap' }))
        .rejects.toMatchObject({ statusCode: 404, message: 'Build not found' });
    });

    it('should throw 400 if build is completed or cancelled', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.COMPLETE } as any);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Cannot scrap outputs for a completed or cancelled build' });

      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: '30' } as any);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Cannot scrap outputs for a completed or cancelled build' });
    });

    it('should throw 400 if outputs list is empty', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      await expect(scrapBuildOutputs(1, { outputs: [], location: 2, notes: 'Scrap' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'A list of build outputs must be provided' });
    });

    it('should throw 400 if location is specified but invalid', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue(null);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10 }], location: 99, notes: 'Scrap' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Invalid location' });
    });

    it('should throw 400 if stock item output does not exist or mismatch build/part', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 2 } as any);

      vi.mocked(prisma.stockitem.findUnique).mockResolvedValueOnce(null);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10 }], location: 2, notes: 'Test' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Stock item does not exist' });

      vi.mocked(prisma.stockitem.findUnique).mockResolvedValueOnce({ id: 10, buildId: 2, partId: 100, isBuilding: true, quantity: 1 } as any);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10 }], location: 2, notes: 'Test' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Build output does not match the parent build' });

      vi.mocked(prisma.stockitem.findUnique).mockResolvedValueOnce({ id: 10, buildId: 1, partId: 999, isBuilding: true, quantity: 1 } as any);
      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10 }], location: 2, notes: 'Test' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Output part does not match BuildOrder part' });
    });

    it('should throw 400 if build output is already completed', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 2 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 10, buildId: 1, partId: 100, isBuilding: false, quantity: 1 } as any);

      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10 }], location: 2, notes: 'Test' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'This build output has already been completed' });
    });

    it('should throw 400 if scrap quantity exceeds output quantity', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 2 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 5 } as any);

      await expect(scrapBuildOutputs(1, { outputs: [{ output: 10, quantity: 10 }], location: 2, notes: 'Test' }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Quantity cannot be greater than the output quantity' });
    });

    it('should successfully scrap full output with item-level options and record rejection tracking', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 1, deleteOnDeplete: false
      } as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await scrapBuildOutputs(1, { outputs: [{ output: 10, location: 5, notes: 'Defective frame' }] });
      expect(res).toEqual({ success: true });

      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { isBuilding: false, status: StockStatus.REJECTED, locationId: 5 }
      });

      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          itemId: 10,
          trackingType: StockHistoryCode.BUILD_OUTPUT_REJECTED,
          notes: 'Defective frame',
          deltas: expect.objectContaining({ quantity: 1, location: 5, status: '65', buildorder: 1 })
        })
      }));
    });

    it('should partially scrap output by splitting stock item and logging split tracking', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 10, batch: 'B1', deleteOnDeplete: false
      } as any);
      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 99, partId: 100 } as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await scrapBuildOutputs(1, { outputs: [{ output: 10, quantity: 3 }], location: 5, notes: 'Partial defect' });
      expect(res).toEqual({ success: true });

      // Parent decremented
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { quantity: 7 }
      });

      // Child created
      expect(prisma.stockitem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partId: 100,
          quantity: 3,
          locationId: 5,
          status: StockStatus.REJECTED,
          isBuilding: false,
          parentId: 10,
          buildId: 1
        })
      });

      // Split tracking created
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ trackingType: StockHistoryCode.SPLIT_FROM_PARENT, itemId: 99 })
      }));
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ trackingType: StockHistoryCode.SPLIT_CHILD_ITEM, itemId: 10 })
      }));
    });

    it('should complete attached allocations when discard_allocations = false', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 1
      } as any);

      vi.mocked(prisma.builditem.findMany).mockResolvedValue([
        {
          id: 501,
          quantity: 2,
          buildLineId: 201,
          stockItem: { id: 301, partId: 200, quantity: 10, deleteOnDeplete: false, status: '10' }
        } as any
      ]);
      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 801, partId: 200 } as any);

      const res = await scrapBuildOutputs(1, {
        outputs: [{ output: 10 }],
        location: 5,
        notes: 'Scrap with allocations completed',
        discard_allocations: false
      });

      expect(res).toEqual({ success: true });
      // Component stock split and consumed
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 301 },
        data: { quantity: 8 }
      });
      expect(prisma.buildline.update).toHaveBeenCalledWith({
        where: { id: 201 },
        data: { consumed: { increment: 2 } }
      });
      expect(prisma.builditem.deleteMany).toHaveBeenCalledWith({
        where: { installIntoId: 10 }
      });
    });

    it('should directly delete allocations without consumption when discard_allocations = true', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 1
      } as any);

      vi.mocked(prisma.builditem.findMany).mockResolvedValue([
        { id: 501, quantity: 2, buildLineId: 201, stockItem: { id: 301, quantity: 10 } } as any
      ]);

      const res = await scrapBuildOutputs(1, {
        outputs: [{ output: 10 }],
        location: 5,
        notes: 'Discarding allocations',
        discard_allocations: true
      });

      expect(res).toEqual({ success: true });
      expect(prisma.buildline.update).not.toHaveBeenCalled();
      expect(prisma.builditem.deleteMany).toHaveBeenCalledWith({
        where: { installIntoId: 10 }
      });
    });
  });

  // ─── 3. Auto-Allocate ──────────────────────────────────────────────────────
  describe('autoAllocateBuild', () => {
    it('should throw 404 if build not found', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue(null);
      await expect(autoAllocateBuild(999)).rejects.toMatchObject({ statusCode: 404, message: 'Build not found' });
    });

    it('should throw 400 if build is cancelled or complete', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.CANCELLED } as any);
      await expect(autoAllocateBuild(1)).rejects.toMatchObject({ statusCode: 400, message: 'Cannot auto-allocate for a cancelled or completed build' });
    });

    it('should auto-allocate untracked stock items up to needed line quantity', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 101,
          quantity: 10,
          bomItem: {
            subPartId: 50,
            allowVariants: false,
            optional: false,
            consumable: false,
            subPart: { id: 50, trackable: false, consumable: false },
            bomitemsubstitute_bomItems: []
          },
          builditem_buildLines: [{ quantity: 2 }]
        } as any
      ]);

      // Candidate stock items (needed: 8)
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { id: 1001, partId: 50, quantity: 20, isBuilding: false, locationId: 1 } as any
      ]);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);

      const res = await autoAllocateBuild(1, { item_type: 'untracked' });
      expect(res).toEqual({ success: true });

      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: {
          buildLineId: 101,
          stockItemId: 1001,
          quantity: 8,
          installIntoId: null
        }
      });
    });

    it('should skip line if already fully allocated', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 101,
          quantity: 10,
          bomItem: {
            subPartId: 50,
            allowVariants: false,
            subPart: { id: 50, trackable: false },
            bomitemsubstitute_bomItems: []
          },
          builditem_buildLines: [{ quantity: 10 }]
        } as any
      ]);

      const res = await autoAllocateBuild(1);
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.create).not.toHaveBeenCalled();
    });

    it('should skip consumable BOM items', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 101,
          quantity: 10,
          bomItem: {
            subPartId: 50,
            consumable: true,
            subPart: { id: 50, trackable: false, consumable: false }
          },
          builditem_buildLines: []
        } as any
      ]);

      const res = await autoAllocateBuild(1);
      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.findMany).not.toHaveBeenCalled();
    });

    it('should skip multiple candidate items when interchangeable is false', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 101,
          quantity: 10,
          bomItem: {
            subPartId: 50,
            allowVariants: false,
            subPart: { id: 50, trackable: false },
            bomitemsubstitute_bomItems: []
          },
          builditem_buildLines: []
        } as any
      ]);

      // 2 candidate items
      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { id: 1001, partId: 50, quantity: 5, locationId: 1 } as any,
        { id: 1002, partId: 50, quantity: 5, locationId: 2 } as any
      ]);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await autoAllocateBuild(1, { interchangeable: false });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.create).not.toHaveBeenCalled();
    });

    it('should allocate across multiple items by default (interchangeable defaults to true)', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 101,
          quantity: 10,
          bomItem: {
            subPartId: 50,
            allowVariants: false,
            subPart: { id: 50, trackable: false },
            bomitemsubstitute_bomItems: []
          },
          builditem_buildLines: []
        } as any
      ]);

      vi.mocked(prisma.stockitem.findMany).mockResolvedValue([
        { id: 1001, partId: 50, quantity: 6, locationId: 1 } as any,
        { id: 1002, partId: 50, quantity: 8, locationId: 2 } as any
      ]);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);

      const res = await autoAllocateBuild(1, {});
      expect(res).toEqual({ success: true });

      // First item takes 6, second item takes 4
      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: { buildLineId: 101, stockItemId: 1001, quantity: 6, installIntoId: null }
      });
      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: { buildLineId: 101, stockItemId: 1002, quantity: 4, installIntoId: null }
      });
    });

    it('should auto-allocate tracked parts with matching serials to build outputs', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([
        {
          id: 102,
          quantity: 1,
          bomItem: {
            subPartId: 60,
            subPart: { id: 60, trackable: true }
          },
          builditem_buildLines: []
        } as any
      ]);

      // Serialized build output
      vi.mocked(prisma.stockitem.findMany)
        .mockResolvedValueOnce([{ id: 500, buildId: 1, isBuilding: true, serial: 'SN-001' }] as any) // outputs
        .mockResolvedValueOnce([{ id: 2001, partId: 60, serial: 'SN-001', quantity: 1 }] as any); // candidate stock

      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.count).mockResolvedValue(0);

      const res = await autoAllocateBuild(1, { item_type: 'tracked' });
      expect(res).toEqual({ success: true });

      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: {
          buildLineId: 102,
          stockItemId: 2001,
          quantity: 1,
          installIntoId: 500
        }
      });
    });
  });

  // ─── 4. Allocate ───────────────────────────────────────────────────────────
  describe('allocateStockToBuild', () => {
    it('should throw 404 if build not found', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue(null);
      await expect(allocateStockToBuild(999, { items: [{ build_line: 1, stock_item: 1, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 404, message: 'Build not found' });
    });

    it('should throw 400 if build is cancelled or completed', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.COMPLETE } as any);
      await expect(allocateStockToBuild(1, { items: [{ build_line: 1, stock_item: 1, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Cannot allocate stock to a cancelled or completed build' });
    });

    it('should throw 400 if items list empty or fields missing', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      await expect(allocateStockToBuild(1, { items: [] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Allocation items must be provided' });

      await expect(allocateStockToBuild(1, { items: [{ build_line: 0, stock_item: 1, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'build_line, stock_item, and quantity are required' });

      await expect(allocateStockToBuild(1, { items: [{ build_line: 1, stock_item: 1, quantity: -5 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Quantity must be greater than zero' });
    });

    it('should throw 400 if line does not match build or stock item not in stock', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValueOnce(null);
      await expect(allocateStockToBuild(1, { items: [{ build_line: 99, stock_item: 1, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Build line not found' });

      vi.mocked(prisma.buildline.findUnique).mockResolvedValueOnce({ id: 10, buildId: 2 } as any);
      await expect(allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 1, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'bom_item.part must point to the same part as the build order' });

      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({ id: 10, buildId: 1, bomItem: { subPart: {} } } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValueOnce(null);
      await expect(allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 999, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Stock item not found' });
    });

    it('should throw 400 if stock item is quarantined or rejected', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({ id: 10, buildId: 1, bomItem: { subPart: {} } } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 20, status: StockStatus.REJECTED, quantity: 10 } as any);

      await expect(allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 1 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Item is not available for allocation' });
    });

    it('should throw 400 if part does not match BOM line', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, allowVariants: false, subPart: { trackable: false }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 20,
        partId: 999,
        quantity: 50,
        isBuilding: false,
        status: StockStatus.OK
      } as any);

      await expect(allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 5 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Selected stock item does not match BOM line' });
    });

    it('should allow general allocation of trackable component without specifying output', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, subPart: { trackable: true }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 20,
        partId: 100,
        quantity: 1,
        isBuilding: false,
        status: StockStatus.OK
      } as any);
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 1 }] });
      expect(res).toEqual({ success: true });
    });

    it('should throw 400 if allocation quantity exceeds available stock', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, subPart: { trackable: false }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 20,
        partId: 100,
        quantity: 10,
        isBuilding: false,
        status: StockStatus.OK
      } as any);

      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([
        { id: 1, quantity: 8 } as any
      ]);

      await expect(allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 5 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Available quantity (2) exceeded' });
    });

    it('should create new allocation or merge into existing allocation', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, subPart: { trackable: false }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 20,
        partId: 100,
        quantity: 100,
        isBuilding: false,
        status: StockStatus.OK
      } as any);

      // 1. Create new
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      let res = await allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 15 }] });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: { buildLineId: 10, stockItemId: 20, quantity: 15, installIntoId: null }
      });

      // 2. Merge into existing
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue({ id: 50, quantity: 15 } as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([{ id: 50, quantity: 15 } as any]);

      res = await allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 20, quantity: 10 }] });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { quantity: 25 }
      });
    });

    it('should support allocating variant parts when allowVariants is true', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, allowVariants: true, subPart: { trackable: false }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.part.findMany).mockResolvedValue([{ id: 101, variantOfId: 100 }] as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 25,
        partId: 101, // Variant part
        quantity: 50,
        isBuilding: false,
        status: StockStatus.OK
      } as any);
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await allocateStockToBuild(1, { items: [{ build_line: 10, stock_item: 25, quantity: 5 }] });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.create).toHaveBeenCalledWith({
        data: { buildLineId: 10, stockItemId: 25, quantity: 5, installIntoId: null }
      });
    });
  });

  // ─── 5. Unallocate ─────────────────────────────────────────────────────────
  describe('unallocateBuildStock', () => {
    it('should throw 404 if build not found', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue(null);
      await expect(unallocateBuildStock(999)).rejects.toMatchObject({ statusCode: 404, message: 'Build not found' });
    });

    it('should throw 400 if build is completed or cancelled', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.COMPLETE } as any);
      await expect(unallocateBuildStock(1)).rejects.toMatchObject({ statusCode: 400, message: 'Cannot unallocate stock from a completed or cancelled build' });
    });

    it('should throw 400 if output or line does not belong to build', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 10, buildId: 2 } as any);
      await expect(unallocateBuildStock(1, { output: 10 }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Build output does not match the parent build' });

      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({ id: 20, buildId: 2 } as any);
      await expect(unallocateBuildStock(1, { build_line: 20 }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Build line does not match parent build' });
    });

    it('should unallocate all allocations for entire build when no filters given', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([{ id: 101 }, { id: 102 }] as any);

      const res = await unallocateBuildStock(1, {});
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.deleteMany).toHaveBeenCalledWith({
        where: { buildLineId: { in: [101, 102] } }
      });
    });

    it('should unallocate by items array (IDs or partial quantity objects)', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.builditem.findUnique).mockResolvedValue({
        id: 501,
        quantity: 10,
        buildLine: { buildId: 1 }
      } as any);

      const res = await unallocateBuildStock(1, {
        items: [{ build_item: 501, quantity: 4 }]
      });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.update).toHaveBeenCalledWith({
        where: { id: 501 },
        data: { quantity: 6 }
      });
    });

    it('should unallocate with specific line and output filters', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({ id: 50, buildId: 1 } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({ id: 101, buildId: 1 } as any);

      const res = await unallocateBuildStock(1, { build_line: 101, output: 50 });
      expect(res).toEqual({ success: true });
      expect(prisma.builditem.deleteMany).toHaveBeenCalledWith({
        where: { buildLineId: 101, installIntoId: 50 }
      });
    });
  });

  // ─── 6. Consume ────────────────────────────────────────────────────────────
  describe('consumeBuildStock', () => {
    it('should throw 404 if build not found', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue(null);
      await expect(consumeBuildStock(999, { lines: [{ build_line: 1 }] }))
        .rejects.toMatchObject({ statusCode: 404, message: 'Build not found' });
    });

    it('should throw 400 if build is PENDING or CANCELLED or COMPLETE', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PENDING } as any);
      await expect(consumeBuildStock(1, {})).rejects.toMatchObject({ statusCode: 400, message: 'Build order is not in production' });

      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.CANCELLED } as any);
      await expect(consumeBuildStock(1, {})).rejects.toMatchObject({ statusCode: 400, message: 'Build order is cancelled' });
    });

    it('should consume ALL allocations for the build order when payload is empty', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([{ id: 100 }] as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([{ id: 50, quantity: 5 }] as any);
      vi.mocked(prisma.builditem.findUnique).mockResolvedValue({
        id: 50,
        quantity: 5,
        buildLineId: 100,
        stockItem: { id: 200, partId: 30, quantity: 5, deleteOnDeplete: false }
      } as any);

      const res = await consumeBuildStock(1, {});
      expect(res).toEqual({ success: true });
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 200 },
        data: { quantity: 0, locationId: null, consumedById: 1, belongsToId: null }
      });
    });

    it('should gracefully return success when empty payload and 0 allocations exist', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([{ id: 100 }] as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await consumeBuildStock(1, {});
      expect(res).toEqual({ success: true });
    });

    it('should throw 400 on duplicate items or duplicate lines', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      await expect(consumeBuildStock(1, { items: [{ build_item: 1, quantity: 1 }, { build_item: 1, quantity: 2 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Duplicate build item in request' });

      await expect(consumeBuildStock(1, { lines: [{ build_line: 5 }, { build_line: 5 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Duplicate build line in request' });
    });

    it('should throw 400 if consume quantity exceeds allocated quantity', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.builditem.findUnique).mockResolvedValue({
        id: 10,
        quantity: 5,
        buildLine: { buildId: 1 }
      } as any);

      await expect(consumeBuildStock(1, { items: [{ build_item: 10, quantity: 10 }] }))
        .rejects.toMatchObject({ statusCode: 400, message: 'Quantity cannot be greater than the allocated quantity' });
    });

    it('should consume by lines: consuming full allocations, updating stock and logging tracking', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({ id: 100, buildId: 1 } as any);

      vi.mocked(prisma.builditem.findMany).mockResolvedValue([
        { id: 50, quantity: 5, buildLineId: 100 } as any
      ]);

      vi.mocked(prisma.builditem.findUnique).mockResolvedValue({
        id: 50,
        quantity: 5,
        buildLineId: 100,
        stockItem: {
          id: 200,
          partId: 30,
          quantity: 5,
          deleteOnDeplete: false
        }
      } as any);

      const res = await consumeBuildStock(1, { lines: [{ build_line: 100 }], notes: 'Batch consume' });
      expect(res).toEqual({ success: true });

      // Stock updated to 0
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 200 },
        data: { quantity: 0, locationId: null, consumedById: 1, belongsToId: null }
      });

      // BuildLine incremented
      expect(prisma.buildline.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: { consumed: { increment: 5 } }
      });

      // Builditem deleted
      expect(prisma.builditem.delete).toHaveBeenCalledWith({ where: { id: 50 } });

      // Tracking logged (BUILD_CONSUMED: 57)
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          itemId: 200,
          trackingType: StockHistoryCode.BUILD_CONSUMED,
          deltas: { quantity: 5, buildorder: 1 }
        })
      }));
    });

    it('should partially consume allocation by splitting stock item', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.builditem.findUnique)
        .mockResolvedValueOnce({ id: 50, quantity: 10, buildLine: { buildId: 1 } } as any) // validation
        .mockResolvedValueOnce({
          id: 50,
          quantity: 10,
          buildLineId: 100,
          stockItem: {
            id: 200,
            partId: 30,
            quantity: 50, // More stock available
            deleteOnDeplete: false,
            status: '10'
          }
        } as any); // execution

      vi.mocked(prisma.stockitem.create).mockResolvedValue({ id: 999, partId: 30 } as any);

      const res = await consumeBuildStock(1, { items: [{ build_item: 50, quantity: 4 }], notes: 'Partial consume' });
      expect(res).toEqual({ success: true });

      // Parent stock decremented
      expect(prisma.stockitem.update).toHaveBeenCalledWith({
        where: { id: 200 },
        data: { quantity: 46 }
      });

      // Child created
      expect(prisma.stockitem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          partId: 30,
          quantity: 4,
          consumedById: 1
        })
      });

      // Split tracking and build consumed tracking
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ trackingType: StockHistoryCode.SPLIT_FROM_PARENT, itemId: 999 })
      }));
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ trackingType: StockHistoryCode.BUILD_CONSUMED, itemId: 999 })
      }));

      // Builditem decremented from 10 to 6
      expect(prisma.builditem.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { quantity: 6 }
      });
    });

    it('should handle tracked component consumption into assembly output', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 999, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.builditem.findUnique)
        .mockResolvedValueOnce({ id: 50, quantity: 1, buildLine: { buildId: 1 } } as any)
        .mockResolvedValueOnce({
          id: 50,
          quantity: 1,
          installIntoId: 777, // Assembly output
          buildLineId: 100,
          stockItem: {
            id: 200,
            partId: 30,
            quantity: 1,
            deleteOnDeplete: false
          }
        } as any);

      const res = await consumeBuildStock(1, { items: [{ build_item: 50, quantity: 1 }] });
      expect(res).toEqual({ success: true });

      // Installed into assembly tracking (30 and 35)
      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          itemId: 200,
          trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
          deltas: { belongs_to: 777 }
        })
      }));

      expect(prisma.stockitemtracking.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          itemId: 777,
          trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
          deltas: { child: 200 }
        })
      }));
    });

    it('should delete stock item on depletion when deleteOnDeplete is true and not installed', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.builditem.findUnique)
        .mockResolvedValueOnce({ id: 50, quantity: 5, buildLine: { buildId: 1 } } as any)
        .mockResolvedValueOnce({
          id: 50,
          quantity: 5,
          installIntoId: null,
          buildLineId: 100,
          stockItem: {
            id: 200,
            partId: 30,
            quantity: 5,
            deleteOnDeplete: true
          }
        } as any);

      const res = await consumeBuildStock(1, { items: [{ build_item: 50, quantity: 5 }] });
      expect(res).toEqual({ success: true });

      expect(prisma.stockitem.delete).toHaveBeenCalledWith({ where: { id: 200 } });
    });
  });

  // ─── 7. HTTP Route Endpoints ───────────────────────────────────────────────
  describe('Build Routes HTTP Endpoints', () => {
    it('POST /api/build/:pk/scrap-outputs returns 200 on success', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, partId: 100, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.stocklocation.findUnique).mockResolvedValue({ id: 5 } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 10, buildId: 1, partId: 100, isBuilding: true, quantity: 1
      } as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await buildRouter.request('/api/build/1/scrap-outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputs: [{ output: 10 }], location: 5, notes: 'Scrapped via API' })
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });

    it('POST /api/build/:pk/scrap-outputs returns 400 on error', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);

      const res = await buildRouter.request('/api/build/1/scrap-outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outputs: [], location: 5, notes: '' })
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toHaveProperty('detail');
    });

    it('POST /api/build/:pk/auto-allocate returns 200 on success', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([]);

      const res = await buildRouter.request('/api/build/1/auto-allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_type: 'untracked' })
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });

    it('POST /api/build/:pk/allocate returns 200 on success and 400 on validation error', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findUnique).mockResolvedValue({
        id: 10,
        buildId: 1,
        bomItem: { subPartId: 100, subPart: { trackable: false }, bomitemsubstitute_bomItems: [] }
      } as any);
      vi.mocked(prisma.stockitem.findUnique).mockResolvedValue({
        id: 20,
        partId: 100,
        quantity: 50,
        isBuilding: false,
        status: StockStatus.OK
      } as any);
      vi.mocked(prisma.builditem.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await buildRouter.request('/api/build/1/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ build_line: 10, stock_item: 20, quantity: 5 }] })
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });

      // Error case
      const errRes = await buildRouter.request('/api/build/1/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] })
      });
      expect(errRes.status).toBe(400);
    });

    it('POST /api/build/:pk/unallocate returns 200 on success', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([{ id: 10 }] as any);

      const res = await buildRouter.request('/api/build/1/unallocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });

    it('POST /api/build/:pk/consume returns 200 on success for empty payload', async () => {
      vi.mocked(prisma.build.findUnique).mockResolvedValue({ id: 1, status: BuildStatus.PRODUCTION } as any);
      vi.mocked(prisma.buildline.findMany).mockResolvedValue([{ id: 10 }] as any);
      vi.mocked(prisma.builditem.findMany).mockResolvedValue([]);

      const res = await buildRouter.request('/api/build/1/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
    });
  });
});
