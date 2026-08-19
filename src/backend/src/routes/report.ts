import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const reportRouter = new Hono();

// ==================== LABEL TEMPLATES ====================
// List label templates
reportRouter.get('/api/label/template', async (c) => {
  try {
    const templates = await prisma.labeltemplate.findMany();
    return c.json({ count: templates.length, results: templates });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Create label template
reportRouter.post('/api/report/label', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, template, width, height } = body;
    
    if (!name || !template) {
      return c.json({ error: 'name and template are required' }, 400);
    }
    
    const item = await prisma.labeltemplate.create({
      data: {
        template,
        width: width ? parseFloat(width) : 50.0,
        height: height ? parseFloat(height) : 30.0,
        // Since base class contains name/description, we map default stub values
        // or check database level
      }
    });
    return c.json(item, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve label template
reportRouter.get('/api/report/label/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const template = await prisma.labeltemplate.findUnique({ where: { id } });
    if (!template) return c.json({ error: 'Label template not found' }, 404);
    return c.json(template);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Update label template
reportRouter.put('/api/report/label/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const body = await c.req.json();
    const { template, width, height } = body;
    
    const updated = await prisma.labeltemplate.update({
      where: { id },
      data: {
        template,
        width: width ? parseFloat(width) : undefined,
        height: height ? parseFloat(height) : undefined
      }
    });
    return c.json(updated);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Delete label template
reportRouter.delete('/api/report/label/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    await prisma.labeltemplate.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Print label simulation
reportRouter.post('/api/report/label/:pk/print', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const template = await prisma.labeltemplate.findUnique({ where: { id } });
    if (!template) return c.json({ error: 'Label template not found' }, 404);
    
    // Simulate label rendering
    return c.json({
      success: true,
      message: 'Label printed successfully',
      printer: 'Virtual-PDF-Printer',
      label: {
        id,
        size: `${template.width}mm x ${template.height}mm`,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});


// ==================== REPORT TEMPLATES ====================
reportRouter.get('/api/report/template', async (c) => {
  try {
    const templates = await prisma.reporttemplate.findMany();
    return c.json({ count: templates.length, results: templates });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

// Create report template
reportRouter.post('/api/report/report', async (c) => {
  try {
    const body = await c.req.json();
    const { template, pageSize, landscape, merge } = body;
    
    if (!template) {
      return c.json({ error: 'template is required' }, 400);
    }
    
    const report = await prisma.reporttemplate.create({
      data: {
        template,
        pageSize: pageSize || 'A4',
        landscape: landscape !== undefined ? landscape : false,
        merge: merge !== undefined ? merge : false
      }
    });
    return c.json(report, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Retrieve report template
reportRouter.get('/api/report/report/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const template = await prisma.reporttemplate.findUnique({ where: { id } });
    if (!template) return c.json({ error: 'Report template not found' }, 404);
    return c.json(template);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Print report simulation
reportRouter.post('/api/report/report/:pk/print', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);
  
  try {
    const template = await prisma.reporttemplate.findUnique({ where: { id } });
    if (!template) return c.json({ error: 'Report template not found' }, 404);
    
    return c.json({
      success: true,
      message: 'PDF Report compiled and generated successfully',
      fileUrl: `http://127.0.0.1:9000/stock-inventory/generated/report-${id}-${Date.now()}.pdf`,
      details: {
        pageSize: template.pageSize,
        landscape: template.landscape
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
