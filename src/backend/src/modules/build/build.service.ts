import { prisma } from '../../utils/db.js';

export class BuildError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'BuildError';
  }
}

export const BuildStatus = {
  PENDING: '10',
  PRODUCTION: '20',
  ON_HOLD: '25',
  CANCELLED: '30',
  COMPLETE: '40',
} as const;

export const StockStatus = {
  OK: '10',
  ATTENTION: '50',
  DAMAGED: '55',
  DESTROYED: '60',
  REJECTED: '65',
  LOST: '70',
  QUARANTINED: '75',
  RETURNED: '85',
} as const;

export const StockHistoryCode = {
  CREATED: 1,
  EDITED: 5,
  ASSIGNED_SERIAL: 6,
  STOCK_COUNT: 10,
  STOCK_ADD: 11,
  STOCK_REMOVE: 12,
  STOCK_SERIALIZED: 13,
  RETURNED_TO_STOCK: 15,
  STOCK_MOVE: 20,
  STOCK_UPDATE: 25,
  INSTALLED_INTO_ASSEMBLY: 30,
  REMOVED_FROM_ASSEMBLY: 31,
  INSTALLED_CHILD_ITEM: 35,
  REMOVED_CHILD_ITEM: 36,
  SPLIT_FROM_PARENT: 40,
  SPLIT_CHILD_ITEM: 42,
  MERGED_STOCK_ITEMS: 45,
  DISASSEMBLED: 46,
  CREATED_FROM_DISASSEMBLY: 47,
  CONVERTED_TO_VARIANT: 48,
  BUILD_OUTPUT_CREATED: 50,
  BUILD_OUTPUT_COMPLETED: 55,
  BUILD_OUTPUT_REJECTED: 56,
  BUILD_CONSUMED: 57,
  SHIPPED_AGAINST_SALES_ORDER: 60,
  RECEIVED_AGAINST_PURCHASE_ORDER: 70,
  RETURNED_AGAINST_RETURN_ORDER: 80,
} as const;

function toNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toNumber === 'function') return val.toNumber();
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function validateBuildOrder(data: { partId: number }) {
  const part = await prisma.part.findUnique({ where: { id: data.partId } });
  if (!part) throw new Error('Part not found');

  if (!part.active) {
    throw new Error('Build order cannot be created for an inactive part');
  }

  // Check if it's an assembly
  if (!part.assembly) {
    throw new Error('Build order can only be created for an assembly part');
  }

  // BOM validation
  const bomCount = await prisma.bomitem.count({ where: { partId: data.partId } });
  if (bomCount === 0) {
    throw new Error('Assembly BOM has not been validated or has no items');
  }
}

export async function validateBuildItemAllocation(buildId: number, stockItemId: number, quantity: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new Error('Build not found');

  const stockItem = await prisma.stockitem.findUnique({ where: { id: stockItemId } });
  if (!stockItem) throw new Error('Stock item not found');

  // Allocation quantity cannot exceed available quantity
  const available = toNumber(stockItem.quantity);
  if (quantity > available) {
    throw new Error('Allocation quantity cannot exceed available stock item quantity');
  }

  // StockItem.part must be in the BOM of the Part object referenced by Build
  const bomItem = await prisma.bomitem.findFirst({
    where: {
      partId: build.partId,
      subPartId: stockItem.partId
    }
  });

  if (!bomItem) {
    throw new Error('Allocated stock item part is not in the BOM for this build order');
  }
}

async function upsertBuildItemAllocation(buildLineId: number, stockItemId: number, quantity: number, installIntoId: number | null) {
  const existing = await prisma.builditem.findFirst({
    where: {
      buildLineId,
      stockItemId,
      installIntoId: installIntoId ?? null
    }
  });

  if (existing) {
    return prisma.builditem.update({
      where: { id: existing.id },
      data: { quantity: toNumber(existing.quantity) + quantity }
    });
  } else {
    return prisma.builditem.create({
      data: {
        buildLineId,
        stockItemId,
        quantity,
        installIntoId: installIntoId ?? null
      }
    });
  }
}

// ─── 1. Scrap Outputs ────────────────────────────────────────────────────────
export interface ScrapOutputsData {
  outputs: Array<{
    output?: number;
    stock_item?: number;
    id?: number;
    quantity?: number;
    location?: number | null;
    notes?: string;
  }> | number[];
  location?: number | null;
  discard_allocations?: boolean;
  notes?: string;
}

export async function scrapBuildOutputs(buildId: number, data: ScrapOutputsData, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.COMPLETE || build.status === BuildStatus.CANCELLED || build.status === '30' || build.status === '40') {
    throw new BuildError('Cannot scrap outputs for a completed or cancelled build', 400);
  }

  if (!data.outputs || !Array.isArray(data.outputs) || data.outputs.length === 0) {
    throw new BuildError('A list of build outputs must be provided', 400);
  }

  if (data.location) {
    const loc = await prisma.stocklocation.findUnique({ where: { id: data.location } });
    if (!loc) {
      throw new BuildError('Invalid location', 400);
    }
  }

  // Pre-validate all outputs
  for (const rawItem of data.outputs) {
    const outputId = typeof rawItem === 'number' ? rawItem : (rawItem.output ?? rawItem.stock_item ?? rawItem.id);
    if (!outputId) throw new BuildError('Output ID must be specified', 400);

    const stockItem = await prisma.stockitem.findUnique({ where: { id: outputId } });
    if (!stockItem) throw new BuildError('Stock item does not exist', 400);
    if (stockItem.buildId !== build.id) throw new BuildError('Build output does not match the parent build', 400);
    if (stockItem.partId !== build.partId) throw new BuildError('Output part does not match BuildOrder part', 400);
    if (!stockItem.isBuilding) throw new BuildError('This build output has already been completed', 400);

    const stockQty = toNumber(stockItem.quantity);
    const scrapQty = (typeof rawItem === 'object' && rawItem.quantity !== undefined) ? Number(rawItem.quantity) : stockQty;
    if (isNaN(scrapQty) || scrapQty <= 0) throw new BuildError('Quantity must be greater than zero', 400);
    if (scrapQty > stockQty) throw new BuildError('Quantity cannot be greater than the output quantity', 400);

    const targetLocId = (typeof rawItem === 'object' && rawItem.location) ? rawItem.location : data.location;
    if (targetLocId) {
      const loc = await prisma.stocklocation.findUnique({ where: { id: targetLocId } });
      if (!loc) throw new BuildError('Invalid location', 400);
    }
  }

  const discardAllocations = data.discard_allocations === true;

  for (const rawItem of data.outputs) {
    const outputId = typeof rawItem === 'number' ? rawItem : (rawItem.output ?? rawItem.stock_item ?? rawItem.id)!;
    const itemObj = typeof rawItem === 'object' ? rawItem : { output: outputId };

    const stockItem = (await prisma.stockitem.findUnique({ where: { id: outputId } }))!;
    const stockQty = toNumber(stockItem.quantity);
    const scrapQty = itemObj.quantity !== undefined ? Number(itemObj.quantity) : stockQty;
    const finalLocation = itemObj.location ?? data.location ?? stockItem.locationId ?? build.destinationId ?? null;
    const finalNotes = (typeof itemObj.notes === 'string' && itemObj.notes.trim().length > 0)
      ? itemObj.notes.trim()
      : ((typeof data.notes === 'string' && data.notes.trim().length > 0) ? data.notes.trim() : 'Scrapped build output');

    let scrappedItemId = stockItem.id;

    if (scrapQty < stockQty) {
      // Partial scrap: reduce original and create rejected child
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: { quantity: stockQty - scrapQty }
      });

      const child = await prisma.stockitem.create({
        data: {
          partId: stockItem.partId,
          quantity: scrapQty,
          batch: stockItem.batch,
          locationId: finalLocation,
          status: StockStatus.REJECTED,
          isBuilding: false,
          parentId: stockItem.id,
          buildId: build.id,
          deleteOnDeplete: stockItem.deleteOnDeplete,
          serialInt: 0,
          creationDate: new Date(),
        }
      });
      scrappedItemId = child.id;

      await prisma.stockitemtracking.create({
        data: {
          itemId: child.id,
          partId: child.partId,
          trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
          notes: finalNotes,
          deltas: { quantity: scrapQty, parent: stockItem.id },
          date: new Date(),
          userId
        }
      });

      await prisma.stockitemtracking.create({
        data: {
          itemId: stockItem.id,
          partId: stockItem.partId,
          trackingType: StockHistoryCode.SPLIT_CHILD_ITEM,
          notes: finalNotes,
          deltas: { quantity: scrapQty, child: child.id },
          date: new Date(),
          userId
        }
      });
    } else {
      // Full scrap
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: {
          isBuilding: false,
          status: StockStatus.REJECTED,
          locationId: finalLocation
        }
      });
      scrappedItemId = stockItem.id;
    }

    // Handle allocations targeting this output
    const attachedBuildItems = await prisma.builditem.findMany({
      where: { installIntoId: stockItem.id },
      include: { stockItem: true }
    });

    if (!discardAllocations) {
      for (const bi of attachedBuildItems) {
        const allocQty = toNumber(bi.quantity);
        const compStock = bi.stockItem;
        if (compStock) {
          const compQty = toNumber(compStock.quantity);
          if (allocQty < compQty) {
            await prisma.stockitem.update({
              where: { id: compStock.id },
              data: { quantity: compQty - allocQty }
            });
            const compChild = await prisma.stockitem.create({
              data: {
                partId: compStock.partId,
                quantity: allocQty,
                batch: compStock.batch,
                serial: null,
                serialInt: 0,
                locationId: null,
                status: compStock.status,
                isBuilding: false,
                parentId: compStock.id,
                buildId: compStock.buildId,
                consumedById: build.id,
                belongsToId: scrappedItemId,
                deleteOnDeplete: compStock.deleteOnDeplete,
                creationDate: new Date()
              }
            });

            await prisma.stockitemtracking.create({
              data: {
                itemId: compChild.id,
                partId: compChild.partId,
                trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
                notes: finalNotes,
                deltas: { quantity: allocQty, parent: compStock.id },
                date: new Date(),
                userId
              }
            });

            await prisma.stockitemtracking.create({
              data: {
                itemId: compStock.id,
                partId: compStock.partId,
                trackingType: StockHistoryCode.SPLIT_CHILD_ITEM,
                notes: finalNotes,
                deltas: { quantity: allocQty, child: compChild.id },
                date: new Date(),
                userId
              }
            });

            await prisma.stockitemtracking.create({
              data: {
                itemId: compChild.id,
                partId: compChild.partId,
                trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
                notes: finalNotes,
                deltas: { belongs_to: scrappedItemId },
                date: new Date(),
                userId
              }
            });

            await prisma.stockitemtracking.create({
              data: {
                itemId: scrappedItemId,
                partId: build.partId,
                trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
                notes: finalNotes,
                deltas: { child: compChild.id },
                date: new Date(),
                userId
              }
            });
          } else {
            if (compStock.deleteOnDeplete) {
              await prisma.stockitem.delete({ where: { id: compStock.id } });
            } else {
              await prisma.stockitem.update({
                where: { id: compStock.id },
                data: {
                  quantity: 0,
                  locationId: null,
                  consumedById: build.id,
                  belongsToId: scrappedItemId
                }
              });
            }

            await prisma.stockitemtracking.create({
              data: {
                itemId: compStock.id,
                partId: compStock.partId,
                trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
                notes: finalNotes,
                deltas: { belongs_to: scrappedItemId },
                date: new Date(),
                userId
              }
            });

            await prisma.stockitemtracking.create({
              data: {
                itemId: scrappedItemId,
                partId: build.partId,
                trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
                notes: finalNotes,
                deltas: { child: compStock.id },
                date: new Date(),
                userId
              }
            });
          }
        }

        if (bi.buildLineId) {
          await prisma.buildline.update({
            where: { id: bi.buildLineId },
            data: { consumed: { increment: allocQty } }
          });
        }
      }
    }

    await prisma.builditem.deleteMany({
      where: { installIntoId: stockItem.id }
    });

    await prisma.stockitemtracking.create({
      data: {
        itemId: scrappedItemId,
        partId: build.partId,
        trackingType: StockHistoryCode.BUILD_OUTPUT_REJECTED,
        notes: finalNotes,
        deltas: {
          quantity: scrapQty,
          location: finalLocation,
          status: StockStatus.REJECTED,
          buildorder: build.id
        },
        date: new Date(),
        userId
      }
    });
  }

  return { success: true };
}

// ─── 2. Auto-Allocate ────────────────────────────────────────────────────────
export interface AutoAllocateData {
  location?: number | null;
  exclude_location?: number | null;
  interchangeable?: boolean;
  substitutes?: boolean;
  allow_substitutes?: boolean;
  optional_items?: boolean;
  allow_optional?: boolean;
  item_type?: 'untracked' | 'tracked' | 'all';
  stock_sort_by?: string;
  build_lines?: number[];
}

export async function autoAllocateBuild(buildId: number, data: AutoAllocateData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.CANCELLED || build.status === BuildStatus.COMPLETE || build.status === '30' || build.status === '40') {
    throw new BuildError('Cannot auto-allocate for a cancelled or completed build', 400);
  }

  const lineFilter: any = { buildId: build.id };
  if (data.build_lines && Array.isArray(data.build_lines) && data.build_lines.length > 0) {
    lineFilter.id = { in: data.build_lines };
  }

  const lines = await prisma.buildline.findMany({
    where: lineFilter,
    include: {
      bomItem: {
        include: {
          subPart: true,
          bomitemsubstitute_bomItems: {
            include: { part: true }
          }
        }
      },
      builditem_buildLines: true
    }
  });

  const itemType = data.item_type ?? 'untracked';
  const allowInterchangeable = data.interchangeable !== undefined ? Boolean(data.interchangeable) : true;
  const allowSubstitutes = (data.allow_substitutes !== undefined ? Boolean(data.allow_substitutes) : data.substitutes) !== false;
  const allowOptional = data.optional_items === true || data.allow_optional === true;

  // Process untracked lines
  if (itemType === 'untracked' || itemType === 'all') {
    for (const line of lines) {
      if (!line.bomItem || !line.bomItem.subPart) continue;
      if (line.bomItem.subPart.trackable) continue;
      if (line.bomItem.consumable || line.bomItem.subPart.consumable) continue;
      if (line.bomItem.optional && !allowOptional) continue;

      const currentAllocated = line.builditem_buildLines.reduce((acc, bi) => acc + toNumber(bi.quantity), 0);
      const neededQty = toNumber(line.quantity) - currentAllocated;
      if (neededQty <= 0) continue;

      const directPartId = line.bomItem.subPartId;
      let variantPartIds: number[] = [];
      if (line.bomItem.allowVariants) {
        const variants = await prisma.part.findMany({
          where: { variantOfId: directPartId, active: true, virtual: false }
        });
        variantPartIds = variants.map(p => p.id);
      }
      let substitutePartIds: number[] = [];
      if (allowSubstitutes && line.bomItem.bomitemsubstitute_bomItems) {
        substitutePartIds = line.bomItem.bomitemsubstitute_bomItems
          .filter(s => s.part?.active && !s.part?.virtual)
          .map(s => s.partId);
      }

      const allCandidateIds = Array.from(new Set([directPartId, ...variantPartIds, ...substitutePartIds]));
      if (allCandidateIds.length === 0) continue;

      const stockWhere: any = {
        partId: { in: allCandidateIds },
        isBuilding: false,
        belongsToId: null,
        customerId: null,
        consumedById: null,
        serial: null,
        quantity: { gt: 0 },
        status: { notIn: [StockStatus.REJECTED, StockStatus.QUARANTINED, StockStatus.DAMAGED, StockStatus.DESTROYED] }
      };

      if (data.location) {
        stockWhere.locationId = data.location;
      }
      if (data.exclude_location) {
        stockWhere.locationId = { not: data.exclude_location };
      }

      const candidateStocks = await prisma.stockitem.findMany({
        where: stockWhere,
        orderBy: data.stock_sort_by === 'expiry_date' ? [{ expiryDate: 'asc' }, { id: 'asc' }] : [{ locationId: 'asc' }, { id: 'asc' }]
      });

      const availableCandidates: Array<{ stock: typeof candidateStocks[0]; availableQty: number; priority: number }> = [];

      for (const stock of candidateStocks) {
        const allAllocs = await prisma.builditem.findMany({ where: { stockItemId: stock.id } });
        const allocated = allAllocs.reduce((sum, bi) => sum + toNumber(bi.quantity), 0);
        const avail = toNumber(stock.quantity) - allocated;
        if (avail > 0) {
          let priority = 1;
          if (stock.partId === directPartId) priority = 1;
          else if (variantPartIds.includes(stock.partId)) priority = 2;
          else if (substitutePartIds.includes(stock.partId)) priority = 3;

          availableCandidates.push({ stock, availableQty: avail, priority });
        }
      }

      availableCandidates.sort((a, b) => a.priority - b.priority);

      if (availableCandidates.length === 0) continue;

      if (!allowInterchangeable) {
        if (availableCandidates.length > 1) {
          // Multiple candidate stock items without interchangeable flag -> skip line
          continue;
        }
        const item = availableCandidates[0];
        const toAlloc = Math.min(neededQty, item.availableQty);
        if (toAlloc > 0) {
          await upsertBuildItemAllocation(line.id, item.stock.id, toAlloc, null);
        }
      } else {
        let remaining = neededQty;
        for (const item of availableCandidates) {
          if (remaining <= 0) break;
          const toAlloc = Math.min(remaining, item.availableQty);
          if (toAlloc > 0) {
            await upsertBuildItemAllocation(line.id, item.stock.id, toAlloc, null);
            remaining -= toAlloc;
          }
        }
      }
    }
  }

  // Process tracked lines
  if (itemType === 'tracked' || itemType === 'all') {
    for (const line of lines) {
      if (!line.bomItem || !line.bomItem.subPart) continue;
      if (!line.bomItem.subPart.trackable) continue;
      if (line.bomItem.consumable || line.bomItem.subPart.consumable) continue;
      if (line.bomItem.optional && !allowOptional) continue;

      const outputs = await prisma.stockitem.findMany({
        where: {
          buildId: build.id,
          isBuilding: true,
          serial: { not: null }
        }
      });

      for (const output of outputs) {
        if (!output.serial) continue;
        const existingAlloc = await prisma.builditem.findFirst({
          where: { buildLineId: line.id, installIntoId: output.id }
        });
        if (existingAlloc) continue;

        const candidateStocks = await prisma.stockitem.findMany({
          where: {
            partId: line.bomItem.subPartId,
            serial: output.serial,
            quantity: 1,
            isBuilding: false,
            belongsToId: null,
            customerId: null,
            consumedById: null,
            status: { notIn: [StockStatus.REJECTED, StockStatus.QUARANTINED, StockStatus.DAMAGED, StockStatus.DESTROYED] }
          }
        });

        const freeCandidates: typeof candidateStocks = [];
        for (const cs of candidateStocks) {
          const allocCount = await prisma.builditem.count({ where: { stockItemId: cs.id } });
          if (allocCount === 0) {
            freeCandidates.push(cs);
          }
        }

        if (freeCandidates.length === 1) {
          await prisma.builditem.create({
            data: {
              buildLineId: line.id,
              stockItemId: freeCandidates[0].id,
              quantity: 1,
              installIntoId: output.id
            }
          });
        }
      }
    }
  }

  return { success: true };
}

// ─── 3. Allocate ─────────────────────────────────────────────────────────────
export interface AllocateData {
  items?: Array<{
    build_line?: number;
    buildLineId?: number;
    line?: number;
    stock_item?: number;
    stockItemId?: number;
    item?: number;
    quantity?: number;
    output?: number | null;
    install_into?: number | null;
    installIntoId?: number | null;
  }>;
  build_line?: number;
  buildLineId?: number;
  line?: number;
  stock_item?: number;
  stockItemId?: number;
  item?: number;
  quantity?: number;
  output?: number | null;
  install_into?: number | null;
  installIntoId?: number | null;
}

export async function allocateStockToBuild(buildId: number, data: AllocateData, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.CANCELLED || build.status === BuildStatus.COMPLETE || build.status === '30' || build.status === '40') {
    throw new BuildError('Cannot allocate stock to a cancelled or completed build', 400);
  }

  const rawItems = Array.isArray(data.items)
    ? data.items
    : (data.stock_item !== undefined || (data as any).stockItemId !== undefined || data.build_line !== undefined || (data as any).line !== undefined ? [data as any] : []);

  if (rawItems.length === 0) {
    throw new BuildError('Allocation items must be provided', 400);
  }

  const normalizedItems = rawItems.map(item => ({
    buildLineId: item.build_line ?? item.buildLineId ?? item.line,
    stockItemId: item.stock_item ?? item.stockItemId ?? item.item,
    quantity: item.quantity,
    outputId: item.output ?? item.install_into ?? item.installIntoId ?? null,
  }));

  for (const item of normalizedItems) {
    if (!item.buildLineId || !item.stockItemId || item.quantity === undefined || item.quantity === null) {
      throw new BuildError('build_line, stock_item, and quantity are required', 400);
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new BuildError('Quantity must be greater than zero', 400);
    }

    const buildLine = await prisma.buildline.findUnique({
      where: { id: item.buildLineId },
      include: {
        bomItem: {
          include: {
            subPart: true,
            bomitemsubstitute_bomItems: true
          }
        }
      }
    });
    if (!buildLine) throw new BuildError('Build line not found', 400);
    if (buildLine.buildId !== build.id) throw new BuildError('bom_item.part must point to the same part as the build order', 400);

    const stockItem = await prisma.stockitem.findUnique({
      where: { id: item.stockItemId },
      include: { part: true }
    });
    if (!stockItem) throw new BuildError('Stock item not found', 400);
    if (stockItem.isBuilding || stockItem.consumedById || stockItem.belongsToId || stockItem.customerId || toNumber(stockItem.quantity) <= 0) {
      throw new BuildError('Item must be in stock', 400);
    }
    if (stockItem.status === StockStatus.REJECTED || stockItem.status === StockStatus.QUARANTINED || stockItem.status === StockStatus.DAMAGED || stockItem.status === StockStatus.DESTROYED) {
      throw new BuildError('Item is not available for allocation', 400);
    }

    const validPartIds = [buildLine.bomItem.subPartId];
    if (buildLine.bomItem.allowVariants) {
      const variants = await prisma.part.findMany({ where: { variantOfId: buildLine.bomItem.subPartId } });
      validPartIds.push(...variants.map(v => v.id));
    }
    if (buildLine.bomItem.bomitemsubstitute_bomItems) {
      validPartIds.push(...buildLine.bomItem.bomitemsubstitute_bomItems.map(s => s.partId));
    }

    if (!validPartIds.includes(stockItem.partId)) {
      throw new BuildError('Selected stock item does not match BOM line', 400);
    }

    if (item.outputId) {
      const outputItem = await prisma.stockitem.findUnique({ where: { id: item.outputId } });
      if (!outputItem || outputItem.buildId !== build.id || !outputItem.isBuilding) {
        throw new BuildError('Invalid build output', 400);
      }
    }

    const existingBi = await prisma.builditem.findFirst({
      where: {
        buildLineId: item.buildLineId,
        stockItemId: item.stockItemId,
        installIntoId: item.outputId ?? null
      }
    });

    const allAllocs = await prisma.builditem.findMany({
      where: { stockItemId: item.stockItemId }
    });

    const otherAllocated = allAllocs
      .filter(bi => bi.id !== existingBi?.id)
      .reduce((sum, bi) => sum + toNumber(bi.quantity), 0);

    const available = toNumber(stockItem.quantity) - otherAllocated;
    const targetTotal = (existingBi ? toNumber(existingBi.quantity) : 0) + qty;

    if (targetTotal > available) {
      const unallocatedLeft = Math.max(0, available - (existingBi ? toNumber(existingBi.quantity) : 0));
      throw new BuildError(`Available quantity (${unallocatedLeft}) exceeded`, 400);
    }
  }

  for (const item of normalizedItems) {
    const buildLine = (await prisma.buildline.findUnique({
      where: { id: item.buildLineId },
      include: { bomItem: { include: { subPart: true } } }
    }))!;

    if (buildLine.bomItem.consumable || buildLine.bomItem.subPart.consumable) {
      continue;
    }

    await upsertBuildItemAllocation(item.buildLineId, item.stockItemId, Number(item.quantity), item.outputId ?? null);
  }

  return { success: true };
}

// ─── 4. Unallocate ───────────────────────────────────────────────────────────
export interface UnallocateData {
  build_line?: number;
  output?: number;
  install_into?: number;
  items?: Array<number | { build_item?: number; id?: number; quantity?: number }>;
}

export async function unallocateBuildStock(buildId: number, data: UnallocateData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.COMPLETE || build.status === BuildStatus.CANCELLED || build.status === '30' || build.status === '40') {
    throw new BuildError('Cannot unallocate stock from a completed or cancelled build', 400);
  }

  if (data.items && Array.isArray(data.items) && data.items.length > 0) {
    for (const entry of data.items) {
      const itemId = typeof entry === 'number' ? entry : (entry.build_item ?? entry.id);
      if (!itemId) throw new BuildError('Build item ID required', 400);

      const bi = await prisma.builditem.findUnique({
        where: { id: itemId },
        include: { buildLine: true }
      });
      if (!bi) throw new BuildError('Build item not found', 400);
      if (bi.buildLine && bi.buildLine.buildId !== build.id) {
        throw new BuildError('Build item does not match parent build', 400);
      }

      if (typeof entry === 'object' && entry.quantity !== undefined) {
        const qty = Number(entry.quantity);
        if (isNaN(qty) || qty <= 0) throw new BuildError('Quantity must be greater than zero', 400);
        const allocQty = toNumber(bi.quantity);
        if (qty > allocQty) throw new BuildError('Quantity cannot be greater than the allocated quantity', 400);

        if (qty < allocQty) {
          await prisma.builditem.update({
            where: { id: bi.id },
            data: { quantity: allocQty - qty }
          });
        } else {
          await prisma.builditem.delete({ where: { id: bi.id } });
        }
      } else {
        await prisma.builditem.delete({ where: { id: bi.id } });
      }
    }
    return { success: true };
  }

  const targetOutput = data.output ?? data.install_into;
  if (targetOutput) {
    const outputItem = await prisma.stockitem.findUnique({ where: { id: targetOutput } });
    if (!outputItem || outputItem.buildId !== build.id) {
      throw new BuildError('Build output does not match the parent build', 400);
    }
  }

  if (data.build_line) {
    const buildLine = await prisma.buildline.findUnique({ where: { id: data.build_line } });
    if (!buildLine || buildLine.buildId !== build.id) {
      throw new BuildError('Build line does not match parent build', 400);
    }
  }

  const lines = await prisma.buildline.findMany({ where: { buildId: build.id }, select: { id: true } });
  const lineIds = lines.map(l => l.id);

  const filter: any = {};
  if (data.build_line) {
    filter.buildLineId = data.build_line;
  } else {
    filter.buildLineId = { in: lineIds };
  }

  if (targetOutput) {
    filter.installIntoId = targetOutput;
  }

  await prisma.builditem.deleteMany({ where: filter });

  return { success: true };
}

// ─── 5. Consume ──────────────────────────────────────────────────────────────
export interface ConsumeData {
  items?: Array<{
    build_item?: number;
    id?: number;
    quantity?: number;
  }>;
  lines?: Array<{
    build_line?: number;
    id?: number;
  }>;
  notes?: string;
}

export async function consumeBuildStock(buildId: number, data: ConsumeData = {}, userId?: number) {
  const build = await prisma.build.findUnique({ where: { id: buildId } });
  if (!build) throw new BuildError('Build not found', 404);

  if (build.status === BuildStatus.PENDING || build.status === '10') {
    throw new BuildError('Build order is not in production', 400);
  }
  if (build.status === BuildStatus.CANCELLED || build.status === '40') {
    throw new BuildError('Build order is cancelled', 400);
  }
  if (build.status === BuildStatus.COMPLETE || build.status === '30') {
    throw new BuildError('Build order is already completed', 400);
  }

  const hasItems = data.items && Array.isArray(data.items) && data.items.length > 0;
  const hasLines = data.lines && Array.isArray(data.lines) && data.lines.length > 0;

  const toConsume: Array<{ buildItemId: number; quantity: number }> = [];

  if (!hasItems && !hasLines) {
    // Consume ALL allocations for this build order
    const buildLines = await prisma.buildline.findMany({
      where: { buildId: build.id },
      select: { id: true }
    });
    const lineIds = buildLines.map(l => l.id);
    const allocations = await prisma.builditem.findMany({
      where: { buildLineId: { in: lineIds } }
    });

    if (allocations.length === 0) {
      return { success: true };
    }

    for (const alloc of allocations) {
      toConsume.push({ buildItemId: alloc.id, quantity: toNumber(alloc.quantity) });
    }
  } else {
    if (hasItems) {
      const seenItems = new Set<number>();
      for (const item of data.items!) {
        const itemId = item.build_item ?? item.id;
        if (!itemId) throw new BuildError('build_item is required', 400);
        if (seenItems.has(itemId)) {
          throw new BuildError('Duplicate build item in request', 400);
        }
        seenItems.add(itemId);

        const bi = await prisma.builditem.findUnique({
          where: { id: itemId },
          include: { buildLine: true }
        });
        if (!bi) throw new BuildError('Build item does not exist', 400);
        if (bi.buildLine && bi.buildLine.buildId !== build.id) {
          throw new BuildError('Build item does not match parent build', 400);
        }

        const qty = item.quantity !== undefined ? Number(item.quantity) : toNumber(bi.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new BuildError('Quantity must be greater than zero', 400);
        }
        if (qty > toNumber(bi.quantity)) {
          throw new BuildError('Quantity cannot be greater than the allocated quantity', 400);
        }
      }
    }

    if (hasLines) {
      const seenLines = new Set<number>();
      for (const line of data.lines!) {
        const lineId = line.build_line ?? line.id;
        if (!lineId) throw new BuildError('build_line is required', 400);
        if (seenLines.has(lineId)) {
          throw new BuildError('Duplicate build line in request', 400);
        }
        seenLines.add(lineId);

        const bl = await prisma.buildline.findUnique({ where: { id: lineId } });
        if (!bl) throw new BuildError('Build line does not exist', 400);
        if (bl.buildId !== build.id) {
          throw new BuildError('Build line does not match parent build', 400);
        }
      }
    }

    if (hasLines) {
      for (const line of data.lines!) {
        const lineId = (line.build_line ?? line.id)!;
        const allocs = await prisma.builditem.findMany({ where: { buildLineId: lineId } });
        for (const alloc of allocs) {
          toConsume.push({ buildItemId: alloc.id, quantity: toNumber(alloc.quantity) });
        }
      }
    }

    if (hasItems) {
      for (const item of data.items!) {
        const itemId = (item.build_item ?? item.id)!;
        const bi = (await prisma.builditem.findUnique({ where: { id: itemId } }))!;
        const qty = item.quantity !== undefined ? Number(item.quantity) : toNumber(bi.quantity);
        const existingIdx = toConsume.findIndex(c => c.buildItemId === itemId);
        if (existingIdx >= 0) {
          toConsume[existingIdx].quantity = qty;
        } else {
          toConsume.push({ buildItemId: itemId, quantity: qty });
        }
      }
    }
  }

  const notes = (typeof data.notes === 'string' && data.notes.trim().length > 0) ? data.notes.trim() : 'Consumed for build order';

  for (const entry of toConsume) {
    const buildItem = await prisma.builditem.findUnique({
      where: { id: entry.buildItemId },
      include: { stockItem: true, buildLine: true }
    });
    if (!buildItem || !buildItem.stockItem) continue;

    const stockItem = buildItem.stockItem;
    const reqQty = entry.quantity;
    const stockQty = toNumber(stockItem.quantity);
    const allocQty = toNumber(buildItem.quantity);
    const actualConsume = Math.min(reqQty, allocQty, stockQty);
    if (actualConsume <= 0) continue;

    let consumedItemId = stockItem.id;

    if (actualConsume < stockQty) {
      // Partial consumption: split child
      await prisma.stockitem.update({
        where: { id: stockItem.id },
        data: { quantity: stockQty - actualConsume }
      });

      const child = await prisma.stockitem.create({
        data: {
          partId: stockItem.partId,
          quantity: actualConsume,
          batch: stockItem.batch,
          serial: null,
          serialInt: 0,
          locationId: null,
          status: stockItem.status,
          isBuilding: false,
          parentId: stockItem.id,
          buildId: stockItem.buildId,
          consumedById: build.id,
          belongsToId: buildItem.installIntoId ?? null,
          deleteOnDeplete: stockItem.deleteOnDeplete,
          creationDate: new Date()
        }
      });
      consumedItemId = child.id;

      await prisma.stockitemtracking.create({
        data: {
          itemId: child.id,
          partId: child.partId,
          trackingType: StockHistoryCode.SPLIT_FROM_PARENT,
          notes,
          deltas: { quantity: actualConsume, parent: stockItem.id },
          date: new Date(),
          userId
        }
      });

      await prisma.stockitemtracking.create({
        data: {
          itemId: stockItem.id,
          partId: stockItem.partId,
          trackingType: StockHistoryCode.SPLIT_CHILD_ITEM,
          notes,
          deltas: { quantity: actualConsume, child: child.id },
          date: new Date(),
          userId
        }
      });

      if (buildItem.installIntoId) {
        await prisma.stockitemtracking.create({
          data: {
            itemId: child.id,
            partId: child.partId,
            trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
            notes,
            deltas: { belongs_to: buildItem.installIntoId },
            date: new Date(),
            userId
          }
        });

        await prisma.stockitemtracking.create({
          data: {
            itemId: buildItem.installIntoId,
            partId: build.partId,
            trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
            notes,
            deltas: { child: child.id },
            date: new Date(),
            userId
          }
        });
      } else {
        await prisma.stockitemtracking.create({
          data: {
            itemId: child.id,
            partId: child.partId,
            trackingType: StockHistoryCode.BUILD_CONSUMED,
            notes,
            deltas: { quantity: actualConsume, buildorder: build.id },
            date: new Date(),
            userId
          }
        });
      }
    } else {
      // Full consumption of stock item
      if (stockItem.deleteOnDeplete && !buildItem.installIntoId) {
        await prisma.stockitem.delete({ where: { id: stockItem.id } });
      } else {
        await prisma.stockitem.update({
          where: { id: stockItem.id },
          data: {
            quantity: 0,
            locationId: null,
            consumedById: build.id,
            belongsToId: buildItem.installIntoId ?? null
          }
        });
      }

      if (buildItem.installIntoId) {
        await prisma.stockitemtracking.create({
          data: {
            itemId: stockItem.id,
            partId: stockItem.partId,
            trackingType: StockHistoryCode.INSTALLED_INTO_ASSEMBLY,
            notes,
            deltas: { belongs_to: buildItem.installIntoId },
            date: new Date(),
            userId
          }
        });

        await prisma.stockitemtracking.create({
          data: {
            itemId: buildItem.installIntoId,
            partId: build.partId,
            trackingType: StockHistoryCode.INSTALLED_CHILD_ITEM,
            notes,
            deltas: { child: stockItem.id },
            date: new Date(),
            userId
          }
        });
      } else {
        await prisma.stockitemtracking.create({
          data: {
            itemId: stockItem.id,
            partId: stockItem.partId,
            trackingType: StockHistoryCode.BUILD_CONSUMED,
            notes,
            deltas: { quantity: actualConsume, buildorder: build.id },
            date: new Date(),
            userId
          }
        });
      }
    }

    if (buildItem.buildLineId) {
      await prisma.buildline.update({
        where: { id: buildItem.buildLineId },
        data: { consumed: { increment: actualConsume } }
      });
    }

    if (actualConsume >= allocQty) {
      await prisma.builditem.delete({ where: { id: buildItem.id } });
    } else {
      await prisma.builditem.update({
        where: { id: buildItem.id },
        data: { quantity: allocQty - actualConsume }
      });
    }
  }

  return { success: true };
}
