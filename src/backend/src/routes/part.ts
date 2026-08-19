import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const partRouter = new Hono();

// ==================== PART CATEGORIES ====================
// List part categories - paginated format expected by frontend
partRouter.get('/api/part/category', async (c) => {
  try {
    const categories = await prisma.partcategory.findMany({
      include: { defaultLocation: true }
    });
    return c.json({ count: categories.length, results: categories });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Part category tree
partRouter.get('/api/part/category/tree', (c) => c.json([]));

// Part category parameters
partRouter.get('/api/part/category/parameters', (c) => c.json({ count: 0, results: [] }));

// Create part category
partRouter.post('/api/part/category', async (c) => {
  try {
    const body = await c.req.json();
    const { name, structural, defaultKeywords, icon, defaultLocationId } = body;
    
    const category = await prisma.partcategory.create({
      data: {
        structural: structural !== undefined ? structural : false,
        defaultKeywords,
        icon,
        defaultLocationId: defaultLocationId ? parseInt(defaultLocationId, 10) : null
      }
    });
    return c.json(category, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve part category
partRouter.get('/api/part/category/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const category = await prisma.partcategory.findUnique({
      where: { id },
      include: { defaultLocation: true }
    });
    if (!category) return c.json({ error: 'Category not found' }, 404);
    return c.json(category);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update part category
partRouter.put('/api/part/category/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const { structural, defaultKeywords, icon, defaultLocationId } = body;
    
    const updated = await prisma.partcategory.update({
      where: { id },
      data: {
        structural,
        defaultKeywords,
        icon,
        defaultLocationId: defaultLocationId ? parseInt(defaultLocationId, 10) : null
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete part category
partRouter.delete('/api/part/category/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.partcategory.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});


// ==================== PARTS ====================
// Part sub-endpoints (must be before /:pk wildcard)
partRouter.get('/api/part/thumbs', (c) => c.json({ count: 0, results: [] }));
partRouter.get('/api/part/related', (c) => c.json({ count: 0, results: [] }));
partRouter.get('/api/part/test-template', (c) => c.json({ count: 0, results: [] }));
partRouter.get('/api/part/internal-price', (c) => c.json({ count: 0, results: [] }));
partRouter.get('/api/part/sale-price', (c) => c.json({ count: 0, results: [] }));
partRouter.get('/api/part/stocktake', (c) => c.json({ count: 0, results: [] }));

// List Parts - paginated format expected by frontend
partRouter.get('/api/part', async (c) => {
  try {
    const parts = await prisma.part.findMany({
      include: { category: true, defaultLocation: true }
    });
    return c.json({ count: parts.length, results: parts });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create Part
partRouter.post('/api/part', async (c) => {
  try {
    const body = await c.req.json();
    const {
      name, description, isTemplate, keywords, ipn, revision, link,
      defaultExpiry, minimumStock, maximumStock, units, assembly,
      component, trackable, testable, purchaseable, salable, active,
      locked, virtual, consumable, baseCost, multiple, categoryId,
      defaultLocationId
    } = body;
    
    if (!name) {
      return c.json({ error: 'Name is required' }, 400);
    }
    
    const part = await prisma.part.create({
      data: {
        name,
        description,
        isTemplate: isTemplate !== undefined ? isTemplate : false,
        keywords,
        ipn,
        revision,
        link,
        defaultExpiry: defaultExpiry ? parseInt(defaultExpiry, 10) : 0,
        minimumStock: minimumStock ? parseFloat(minimumStock) : 0.0,
        maximumStock: maximumStock ? parseFloat(maximumStock) : 0.0,
        units,
        assembly: assembly !== undefined ? assembly : false,
        component: component !== undefined ? component : true,
        trackable: trackable !== undefined ? trackable : false,
        testable: testable !== undefined ? testable : false,
        purchaseable: purchaseable !== undefined ? purchaseable : true,
        salable: salable !== undefined ? salable : false,
        active: active !== undefined ? active : true,
        locked: locked !== undefined ? locked : false,
        virtual: virtual !== undefined ? virtual : false,
        consumable: consumable !== undefined ? consumable : true,
        bomValidated: false,
        baseCost: baseCost ? parseFloat(baseCost) : 0.0,
        multiple: multiple ? parseInt(multiple, 10) : 1,
        categoryId: categoryId ? parseInt(categoryId, 10) : null,
        defaultLocationId: defaultLocationId ? parseInt(defaultLocationId, 10) : null
      }
    });
    return c.json(part, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve Part Detail
partRouter.get('/api/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const part = await prisma.part.findUnique({
      where: { id },
      include: { category: true, defaultLocation: true }
    });
    if (!part) return c.json({ error: 'Part not found' }, 404);
    return c.json(part);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update Part
partRouter.put('/api/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const {
      name, description, isTemplate, keywords, ipn, revision, link,
      defaultExpiry, minimumStock, maximumStock, units, assembly,
      component, trackable, testable, purchaseable, salable, active,
      locked, virtual, consumable, baseCost, multiple, categoryId,
      defaultLocationId
    } = body;
    
    const updated = await prisma.part.update({
      where: { id },
      data: {
        name,
        description,
        isTemplate,
        keywords,
        ipn,
        revision,
        link,
        defaultExpiry: defaultExpiry ? parseInt(defaultExpiry, 10) : undefined,
        minimumStock: minimumStock ? parseFloat(minimumStock) : undefined,
        maximumStock: maximumStock ? parseFloat(maximumStock) : undefined,
        units,
        assembly,
        component,
        trackable,
        testable,
        purchaseable,
        salable,
        active,
        locked,
        virtual,
        consumable,
        baseCost: baseCost ? parseFloat(baseCost) : undefined,
        multiple: multiple ? parseInt(multiple, 10) : undefined,
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        defaultLocationId: defaultLocationId ? parseInt(defaultLocationId, 10) : undefined
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete Part
partRouter.delete('/api/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.part.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});


// ==================== BOM ITEMS ====================
// List BOM Items
partRouter.get('/api/bom', async (c) => {
  try {
    const bomItems = await prisma.bomitem.findMany({
      include: { part: true, subPart: true }
    });
    return c.json({ count: bomItems.length, results: bomItems });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Create BOM Item
partRouter.post('/api/bom', async (c) => {
  try {
    const body = await c.req.json();
    const {
      partId, subPartId, quantity, optional, consumable,
      rawAmount, setupQuantity, attrition, roundingMultiple,
      pieceCount, reference, note, allowVariants
    } = body;
    
    if (!partId || !subPartId || !quantity) {
      return c.json({ error: 'partId, subPartId, and quantity are required' }, 400);
    }
    
    const bomItem = await prisma.bomitem.create({
      data: {
        partId: parseInt(partId, 10),
        subPartId: parseInt(subPartId, 10),
        quantity: parseFloat(quantity),
        optional: optional !== undefined ? optional : false,
        consumable: consumable !== undefined ? consumable : true,
        rawAmount: rawAmount || "",
        setupQuantity: setupQuantity ? parseFloat(setupQuantity) : 0.0,
        attrition: attrition ? parseFloat(attrition) : 0.0,
        roundingMultiple: roundingMultiple ? parseFloat(roundingMultiple) : null,
        pieceCount: pieceCount ? parseInt(pieceCount, 10) : 0,
        reference,
        note,
        validated: false,
        inherited: false,
        allowVariants: allowVariants !== undefined ? allowVariants : false
      }
    });
    return c.json(bomItem, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve BOM Item
partRouter.get('/api/bom/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const bomItem = await prisma.bomitem.findUnique({
      where: { id },
      include: { part: true, subPart: true }
    });
    if (!bomItem) return c.json({ error: 'BOM Item not found' }, 404);
    return c.json(bomItem);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update BOM Item
partRouter.put('/api/bom/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const {
      quantity, optional, consumable, rawAmount, setupQuantity,
      attrition, roundingMultiple, pieceCount, reference, note,
      allowVariants
    } = body;
    
    const updated = await prisma.bomitem.update({
      where: { id },
      data: {
        quantity: quantity ? parseFloat(quantity) : undefined,
        optional,
        consumable,
        rawAmount,
        setupQuantity: setupQuantity ? parseFloat(setupQuantity) : undefined,
        attrition: attrition ? parseFloat(attrition) : undefined,
        roundingMultiple: roundingMultiple ? parseFloat(roundingMultiple) : undefined,
        pieceCount: pieceCount ? parseInt(pieceCount, 10) : undefined,
        reference,
        note,
        allowVariants
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Validate BOM Item
partRouter.post('/api/bom/:pk/validate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const bomItem = await prisma.bomitem.update({
      where: { id },
      data: { validated: true }
    });
    
    // Also mark parent Part's BOM as validated
    await prisma.part.update({
      where: { id: bomItem.partId },
      data: { bomValidated: true, bomCheckedDate: new Date() }
    });
    
    return c.json({ success: true, message: 'BOM Item validated successfully' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete BOM Item
partRouter.delete('/api/bom/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.bomitem.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});


// ==================== BOM SUBSTITUTES ====================
// List substitutes
partRouter.get('/api/bom/substitute', async (c) => {
  try {
    const substitutes = await prisma.bomitemsubstitute.findMany({ include: { bomItem: true, part: true } });
    return c.json({ count: substitutes.length, results: substitutes });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Create substitute
partRouter.post('/api/bom/substitute', async (c) => {
  try {
    const body = await c.req.json();
    const { bomItemId, partId } = body;
    
    if (!bomItemId || !partId) {
      return c.json({ error: 'bomItemId and partId are required' }, 400);
    }
    
    const substitute = await prisma.bomitemsubstitute.create({
      data: {
        bomItemId: parseInt(bomItemId, 10),
        partId: parseInt(partId, 10)
      }
    });
    return c.json(substitute, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete substitute
partRouter.delete('/api/bom/substitute/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.bomitemsubstitute.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
