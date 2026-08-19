import { Hono } from 'hono';
import { prisma } from '../../utils/db.js';
import { paginate, toInt } from '../../lib/paginate.js';
import { sendError } from '../../lib/errors.js';
import { validateSupplierPart, validateCompanyDelete } from './company.service.js';

export const companyRouter = new Hono();

// ─── Supplier Parts & Contacts (sub-routes BEFORE /:pk) ──────────────────────
companyRouter.get('/api/company/part', async (c) => {
  try {
    const parts = await prisma.supplierpart.findMany({ include: { supplier: { select: { id: true, name: true } }, part: { select: { id: true, name: true } }, manufacturerPart: { select: { id: true, mpn: true } } } });
    return c.json(paginate(parts));
  } catch { return c.json(paginate([])); }
});

companyRouter.post('/api/company/part', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.part || !body.supplier) return sendError(c, 400, 'part and supplier required');
    
    const packQuantity = await validateSupplierPart({
      partId: toInt(body.part),
      supplierId: toInt(body.supplier),
      manufacturerPartId: toInt(body.manufacturer_part),
      packQuantity: body.packaging_quantity ? String(body.packaging_quantity) : null
    });

    const sp = await prisma.supplierpart.create({
      data: {
        partId: toInt(body.part)!, supplierId: toInt(body.supplier)!,
        sku: body.SKU ?? body.sku ?? '', link: body.link,
        packQuantity,
        manufacturerPartId: toInt(body.manufacturer_part), note: body.note,

        active: body.active ?? true, primary: body.primary ?? false,
        baseCost: 0, multiple: 1, available: 0,
      },
    });
    return c.json(sp, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const sp = await prisma.supplierpart.findUnique({ where: { id }, include: { supplier: true, part: true, manufacturerPart: true } });
    if (!sp) return sendError(c, 404, 'Not found');
    return c.json(sp);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.patch('/api/company/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.supplierpart.update({ where: { id }, data: { sku: body.SKU ?? body.sku, link: body.link, note: body.note } });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.delete('/api/company/part/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.supplierpart.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/part/manufacturer', async (c) => {
  try {
    const parts = await prisma.manufacturerpart.findMany({ include: { manufacturer: { select: { id: true, name: true } }, part: { select: { id: true, name: true } } } });
    return c.json(paginate(parts));
  } catch { return c.json(paginate([])); }
});

companyRouter.get('/api/company/price-break', async (c) => {
  try {
    const prices = await prisma.supplierpricebreak.findMany();
    return c.json(paginate(prices));
  } catch { return c.json(paginate([])); }
});

companyRouter.get('/api/company/contact', async (c) => {
  try {
    const contacts = await prisma.contact.findMany({ include: { company: { select: { id: true, name: true } } } });
    return c.json(paginate(contacts));
  } catch { return c.json(paginate([])); }
});

companyRouter.post('/api/company/contact', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.company) return sendError(c, 400, 'name and company required');
    const c2 = await prisma.contact.create({ data: { name: body.name, phone: body.phone, email: body.email, role: body.role, companyId: toInt(body.company)! } });
    return c.json(c2, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/contact/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const contact = await prisma.contact.findUnique({ where: { id }, include: { company: { select: { id: true, name: true } } } });
    if (!contact) return sendError(c, 404, 'Not found');
    return c.json(contact);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.patch('/api/company/contact/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.contact.update({ where: { id }, data: { name: body.name, phone: body.phone, email: body.email, role: body.role } });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.delete('/api/company/contact/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.contact.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/address', async (c) => {
  try {
    const addresses = await prisma.address.findMany({ include: { company: { select: { id: true, name: true } } } });
    return c.json(paginate(addresses));
  } catch { return c.json(paginate([])); }
});

companyRouter.post('/api/company/address', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.company) return sendError(c, 400, 'company required');
    const address = await prisma.address.create({ data: { title: body.title ?? 'Address', primary: body.primary ?? false, line1: body.line1, line2: body.line2, postalCode: body.postal_code, postalCity: body.postal_city, province: body.province, country: body.country, companyId: toInt(body.company)! } });
    return c.json(address, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/address/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const address = await prisma.address.findUnique({ where: { id }, include: { company: { select: { id: true, name: true } } } });
    if (!address) return sendError(c, 404, 'Not found');
    return c.json(address);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.delete('/api/company/address/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try { await prisma.address.delete({ where: { id } }); return c.body(null, 204); }
  catch (err: any) { return sendError(c, 500, err.message); }
});

// ─── Company CRUD ─────────────────────────────────────────────────────────────
companyRouter.get('/api/company', async (c) => {
  try {
    const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    return c.json(paginate(companies));
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.post('/api/company', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name) return sendError(c, 400, 'name required');
    const company = await prisma.company.create({ data: { name: body.name, description: body.description, website: body.website, phone: body.phone, email: body.email, contact: body.contact, link: body.link, active: body.active ?? true, isCustomer: body.is_customer ?? false, isSupplier: body.is_supplier ?? true, isManufacturer: body.is_manufacturer ?? false, currency: body.currency ?? 'USD', taxId: body.tax_id } });
    return c.json(company, 201);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.get('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const company = await prisma.company.findUnique({ where: { id }, include: { contact_companys: true, address_companys: true } });
    if (!company) return sendError(c, 404, 'Company not found');
    return c.json(company);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.patch('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.company.update({ where: { id }, data: { name: body.name, description: body.description, website: body.website, phone: body.phone, email: body.email, active: body.active, isCustomer: body.is_customer, isSupplier: body.is_supplier, isManufacturer: body.is_manufacturer, currency: body.currency } });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.put('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.company.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return sendError(c, 500, err.message); }
});

companyRouter.delete('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await validateCompanyDelete(id);
    await prisma.company.delete({ where: { id } });
    return c.body(null, 204);
  } catch (err: any) { return sendError(c, 400, err.message); }
});
