import { Hono } from 'hono';
import { prisma } from '../utils/db.js';

export const companyRouter = new Hono();

// ==================== COMPANY ====================
// Sub-endpoints before wildcards
companyRouter.get('/api/company/part', async (c) => {
  try {
    const parts = await prisma.supplierpart.findMany({ include: { supplier: true, part: true } });
    return c.json({ count: parts.length, results: parts });
  } catch { return c.json({ count: 0, results: [] }); }
});
companyRouter.post('/api/company/part', async (c) => c.json({}, 201));
companyRouter.get('/api/company/part/manufacturer', async (c) => {
  try {
    const parts = await prisma.manufacturerpart.findMany({ include: { manufacturer: true, part: true } });
    return c.json({ count: parts.length, results: parts });
  } catch { return c.json({ count: 0, results: [] }); }
});
companyRouter.get('/api/company/price-break', (c) => c.json({ count: 0, results: [] }));
companyRouter.get('/api/company/contact', async (c) => {
  try {
    const contacts = await prisma.contact.findMany({ include: { company: true } });
    return c.json({ count: contacts.length, results: contacts });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.post('/api/company/contact', async (c) => {
  try {
    const body = await c.req.json();
    const { name, phone, email, role, companyId } = body;
    if (!name || !companyId) return c.json({ error: 'Name and companyId are required' }, 400);
    const contact = await prisma.contact.create({ data: { name, phone, email, role, companyId: parseInt(companyId, 10) } });
    return c.json(contact, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.get('/api/company/contact/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) return c.json({ error: 'Not found' }, 404);
    return c.json(contact);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.delete('/api/company/contact/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.contact.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.get('/api/company/address', async (c) => {
  try {
    const addresses = await prisma.address.findMany({ include: { company: true } });
    return c.json({ count: addresses.length, results: addresses });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.post('/api/company/address', async (c) => {
  try {
    const body = await c.req.json();
    const { title, primary, line1, line2, postalCode, postalCity, province, country, companyId } = body;
    if (!title || !companyId) return c.json({ error: 'Title and companyId are required' }, 400);
    const address = await prisma.address.create({
      data: { title, primary: primary !== undefined ? primary : false, line1, line2, postalCode, postalCity, province, country, companyId: parseInt(companyId, 10) }
    });
    return c.json(address, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.get('/api/company/address/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address) return c.json({ error: 'Not found' }, 404);
    return c.json(address);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
companyRouter.delete('/api/company/address/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.address.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.get('/api/company', async (c) => {
  try {
    const companies = await prisma.company.findMany();
    return c.json({ count: companies.length, results: companies });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.post('/api/company', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, website, phone, email, contact, link, active, isCustomer, isSupplier, isManufacturer, currency, taxId } = body;
    if (!name) return c.json({ error: 'Name is required' }, 400);
    const company = await prisma.company.create({
      data: { name, description, website, phone, email, contact, link, active: active !== undefined ? active : true, isCustomer: isCustomer !== undefined ? isCustomer : false, isSupplier: isSupplier !== undefined ? isSupplier : true, isManufacturer: isManufacturer !== undefined ? isManufacturer : false, currency: currency || 'USD', taxId }
    });
    return c.json(company, 201);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.get('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return c.json({ error: 'Not found' }, 404);
    return c.json(company);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.put('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const { name, description, website, phone, email, contact, link, active, isCustomer, isSupplier, isManufacturer, currency, taxId } = body;
    const updated = await prisma.company.update({ where: { id }, data: { name, description, website, phone, email, contact, link, active, isCustomer, isSupplier, isManufacturer, currency, taxId } });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.patch('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    const body = await c.req.json();
    const updated = await prisma.company.update({ where: { id }, data: body });
    return c.json(updated);
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});

companyRouter.delete('/api/company/:pk', async (c) => {
  const id = parseInt(c.req.param('pk'), 10);
  try {
    await prisma.company.delete({ where: { id } });
    return c.json({ success: true });
  } catch (err: any) { return c.json({ error: err.message }, 500); }
});
