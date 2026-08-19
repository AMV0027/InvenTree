import { prisma } from '../../utils/db.js';

export async function validateSupplierPart(data: { partId?: number; supplierId?: number; manufacturerPartId?: number | null; packQuantity?: string | null }) {
  if (data.supplierId) {
    const company = await prisma.company.findUnique({ where: { id: data.supplierId } });
    if (!company) throw new Error('Supplier not found');
    if (!company.isSupplier) throw new Error('Company is not a supplier');
  }

  if (data.manufacturerPartId) {
    const mfPart = await prisma.manufacturerpart.findUnique({ where: { id: data.manufacturerPartId } });
    if (!mfPart) throw new Error('Manufacturer part not found');
    if (data.partId && mfPart.partId !== data.partId) {
      throw new Error('Manufacturer part must belong to the same base part');
    }
  }

  let pq = data.packQuantity?.trim() || '1';
  // Additional validation for packQuantity could go here (e.g. numeric check if needed)
  return pq;
}

export async function validateCompanyDelete(companyId: number) {
  // Check if company has active purchase orders
  const poCount = await prisma.purchaseorder.count({ where: { supplierId: companyId } });
  if (poCount > 0) throw new Error('Cannot delete company with active purchase orders');

  // Check if company has active sales orders
  const soCount = await prisma.salesorder.count({ where: { customerId: companyId } });
  if (soCount > 0) throw new Error('Cannot delete company with active sales orders');

  // Check if company has active return orders
  const roCount = await prisma.returnorder.count({ where: { customerId: companyId } });
  if (roCount > 0) throw new Error('Cannot delete company with active return orders');
}
