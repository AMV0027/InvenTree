import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

// Modules
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { categoriesRouter } from './modules/parts/categories.routes.js';
import { partsRouter } from './modules/parts/parts.routes.js';
import { bomRouter } from './modules/parts/bom.routes.js';
import { stockRouter } from './modules/stock/stock.routes.js';
import { purchaseRouter } from './modules/orders/purchase.routes.js';
import { salesRouter, returnRouter, transferRouter } from './modules/orders/sales.routes.js';
import { buildRouter } from './modules/build/build.routes.js';
import { companyRouter } from './modules/company/company.routes.js';
import { commonRouter } from './modules/common/common.routes.js';

// Legacy routers (still used for report, machine, plugin, importer)
import { reportRouter } from './routes/report.js';
import { machineRouter } from './routes/machine.js';
import { pluginRouter } from './routes/plugin.js';
import { importerRouter } from './routes/importer.js';
import { inventreeRouter } from './routes/inventree.js';

const app = new Hono({ strict: false });

// ─── Middleware ───────────────────────────────────────────────────────────────

// Custom CORS & DRF OPTIONS Middleware
app.use('*', async (c, next) => {
  // 1. Set CORS headers
  const origin = c.req.header('origin');
  if (origin && origin.startsWith('http://localhost:')) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set('Vary', 'Origin');
  }

  // 2. Handle OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    const reqHeaders = c.req.header('Access-Control-Request-Headers');
    if (reqHeaders) c.res.headers.set('Access-Control-Allow-Headers', reqHeaders);
    
    // Always return 200 OK with DRF metadata.
    // Browser preflight will read headers; axios will read the body.
    return c.json({
      actions: {
        GET: {},
        POST: {},
        PUT: {},
        PATCH: {},
        DELETE: {},
        OPTIONS: {}
      }
    }, 200);
  }


  // 3. Continue for other methods
  await next();
});

// Serve static assets
app.use('/static/*', serveStatic({ root: './public' }));

// ─── Routes — MODULE ORDER MATTERS (specific before general) ──────────────────

app.get('/', (c) => c.text('InvenTree Node.js API (Hono) — Running'));

// Auth & Users
app.route('/', authRouter);
app.route('/', usersRouter);

// Parts (categories before parts, BOM separate)
app.route('/', categoriesRouter);
app.route('/', bomRouter);
app.route('/', partsRouter);

// Stock
app.route('/', stockRouter);

// Orders
app.route('/', purchaseRouter);
app.route('/', salesRouter);
app.route('/', returnRouter);
app.route('/', transferRouter);

// Build
app.route('/', buildRouter);

// Company / Supplier
app.route('/', companyRouter);

// Common (settings, notifications, search, stubs)
app.route('/', commonRouter);

// Legacy routers (report, machine, plugin, importer)
app.route('/', reportRouter);
app.route('/', machineRouter);
app.route('/', pluginRouter);
app.route('/', importerRouter);
app.route('/', inventreeRouter);

// ─── Start Server ─────────────────────────────────────────────────────────────
const port = 8000;
console.log(`\n🚀 InvenTree API running on http://localhost:${port}\n`);

serve({ fetch: app.fetch, port });