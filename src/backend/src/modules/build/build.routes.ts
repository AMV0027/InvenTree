import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate, toInt, toFloat } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';
import {
  BuildError,
  scrapBuildOutputs,
  autoAllocateBuild,
  allocateStockToBuild,
  unallocateBuildStock,
  consumeBuildStock
} from './build.service.js';

export const buildRouter = new Hono();

const BuildStatus = { PENDING: '10', PRODUCTION: '20', ON_HOLD: '25', CANCELLED: '30', COMPLETE: '40' } as const;

// ─── Build sub-collections (before /:pk wildcard) ────────────────────────────
buildRouter.get('/api/build/line', async (c) => {
  try {
    const lines = await prisma.buildline.findMany({ include: { build: { select: { id: true, reference: true } }, bomItem: { include: { subPart: { select: { id: true, name: true } } } } } });
    return c.json(paginate(lines));
  } catch { return c.json(paginate([])); }
});

buildRouter.post('/api/build/line', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.build || !body.bom_item) return sendError(c, 400, 'build and bom_item required');
    const line = await prisma.buildline.create({ data: { buildId: toInt(body.build)!, bomItemId: toInt(body.bom_item)!, quantity: toFloat(body.quantity) ?? 1, consumed: 0 } });
    return c.json(line, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.get('/api/build/line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const line = await prisma.buildline.findUnique({ where: { id }, include: { build: true, bomItem: { include: { subPart: true } } } });
    if (!line) return sendError(c, 404, 'Not found');
    return c.json(line);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.delete('/api/build/line/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.buildline.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.get('/api/build/item', async (c) => {
  try {
    const items = await prisma.builditem.findMany({ include: { buildLine: { include: { build: { select: { id: true, reference: true } } } }, stockItem: { select: { id: true, quantity: true } } } });
    return c.json(paginate(items));
  } catch { return c.json(paginate([])); }
});

buildRouter.post('/api/build/item', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.stock_item || !body.quantity) return sendError(c, 400, 'stock_item and quantity required');
    const item = await prisma.builditem.create({ data: { buildLineId: toInt(body.build_line), stockItemId: toInt(body.stock_item)!, quantity: toFloat(body.quantity) ?? 1 } });
    return c.json(item, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.delete('/api/build/item/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.builditem.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

// ─── Build Order Actions (before /:pk wildcard) ───────────────────────────────
buildRouter.post('/api/build/:pk/issue', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const b = await prisma.build.findUnique({ where: { id } });
    if (b?.status !== BuildStatus.PENDING) return sendError(c, 400, 'Build must be Pending to issue');
    await prisma.build.update({ where: { id }, data: { status: BuildStatus.PRODUCTION } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/hold', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.build.update({ where: { id }, data: { status: BuildStatus.ON_HOLD } }); return c.json({ success: true }); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/cancel', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.build.update({ where: { id }, data: { status: BuildStatus.CANCELLED } }); return c.json({ success: true }); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/finish', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.build.update({ where: { id }, data: { status: BuildStatus.COMPLETE, completionDate: new Date() } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/complete', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.build.update({ where: { id }, data: { status: BuildStatus.COMPLETE, completionDate: new Date() } }); return c.json({ success: true }); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/create-output', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const build = await prisma.build.findUnique({ where: { id }, include: { part: true } });
    if (!build) return sendError(c, 404, 'Build not found');
    const output = await prisma.stockitem.create({
      data: { partId: build.partId, quantity: toFloat(body.quantity) ?? 1, batch: body.batch, isBuilding: true, status: '10', deleteOnDeplete: false, serialInt: 0, buildId: id, creationDate: new Date() },
    });
    return c.json(output, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/delete-outputs', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.stockitem.deleteMany({ where: { buildId: id, isBuilding: true } });
    return c.json({ success: true });
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build/:pk/scrap-outputs', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await scrapBuildOutputs(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/auto-allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoAllocateBuild(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/allocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await allocateStockToBuild(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/unallocate', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await unallocateBuildStock(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

buildRouter.post('/api/build/:pk/consume', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json().catch(() => ({}));
    const result = await consumeBuildStock(id, body);
    return c.json(result, 200);
  } catch (err: any) {
    if (err instanceof BuildError) {
      return sendError(c, err.statusCode, err.message);
    }
    return sendError(c, 500, err?.message ?? 'Internal server error');
  }
});

// ─── Build Order CRUD ─────────────────────────────────────────────────────────
buildRouter.get('/api/build', async (c) => {
  try {
    const builds = await prisma.build.findMany({
      include: { part: { select: { id: true, name: true } } },
      orderBy: { id: 'desc' },
    });
    return c.json(paginate(builds));
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.post('/api/build', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.reference || !body.part || !body.quantity) return sendError(c, 400, 'reference, part, and quantity required');
    const build = await prisma.build.create({
      data: {
        reference: body.reference, title: body.title, quantity: toInt(body.quantity) ?? 1,
        partId: toInt(body.part)!, status: BuildStatus.PENDING,
        external: body.external ?? false, priority: toInt(body.priority) ?? 0,
        batch: body.batch, link: body.link,
        startDate: body.start_date ? new Date(body.start_date) : null,
        targetDate: body.target_date ? new Date(body.target_date) : null,
        creationDate: new Date(), completed: 0,
        takeFromId: toInt(body.take_from),
        destinationId: toInt(body.destination),
        salesOrderId: toInt(body.sales_order),
      },
    });
    return c.json(build, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.get('/api/build/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const build = await prisma.build.findUnique({
      where: { id },
      include: { part: { select: { id: true, name: true } }, parent: { select: { id: true, reference: true } } },
    });
    if (!build) return sendError(c, 404, 'Build not found');
    return c.json(build);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.patch('/api/build/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.build.update({ where: { id }, data: { title: body.title, batch: body.batch, priority: toInt(body.priority), link: body.link, targetDate: body.target_date ? new Date(body.target_date) : undefined } });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

buildRouter.delete('/api/build/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const b = await prisma.build.findUnique({ where: { id } });
    if (b?.status === BuildStatus.COMPLETE) return sendError(c, 400, 'Cannot delete a completed build');
    await prisma.build.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) { return sendError(c, 500, err.message); }
});
