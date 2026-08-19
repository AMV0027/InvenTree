import { MockStore } from './mockDb.js';

export class FixtureFactory {
  constructor(private store: MockStore) {}

  seedLocation(data: Partial<any> = {}) {
    const id = this.store.stocklocation.length + 1;
    const location = {
      id,
      structural: false,
      external: false,
      customIcon: null,
      locationTypeId: null,
      ...data,
    };
    this.store.stocklocation.push(location);
    return location;
  }

  seedLocationType(data: Partial<any> = {}) {
    const id = this.store.stocklocationtype.length + 1;
    const locType = {
      id,
      name: `Location Type ${id}`,
      description: 'Storage area',
      icon: 'box',
      ...data,
    };
    this.store.stocklocationtype.push(locType);
    return locType;
  }

  seedPartCategory(data: Partial<any> = {}) {
    const id = this.store.partcategory.length + 1;
    const category = {
      id,
      structural: false,
      defaultKeywords: '',
      icon: 'folder',
      defaultLocationId: null,
      ...data,
    };
    this.store.partcategory.push(category);
    return category;
  }

  seedPart(data: Partial<any> = {}) {
    const id = this.store.part.length + 1;
    const part = {
      id,
      name: `Part-${id}`,
      isTemplate: false,
      description: 'Test Part',
      keywords: '',
      ipn: `IPN-${id}`,
      revision: 'A',
      link: null,
      defaultExpiry: 0,
      minimumStock: 0,
      maximumStock: 1000,
      units: 'pcs',
      assembly: false,
      component: true,
      trackable: false,
      testable: false,
      purchaseable: true,
      salable: true,
      active: true,
      locked: false,
      virtual: false,
      consumable: false,
      bomValidated: true,
      bomChecksum: null,
      bomCheckedDate: new Date(),
      creationDate: new Date(),
      baseCost: 10.0,
      multiple: 1,
      variantOfId: null,
      categoryId: null,
      revisionOfId: null,
      defaultLocationId: null,
      ...data,
    };
    this.store.part.push(part);
    return part;
  }

  seedBomItem(data: Partial<any> = {}) {
    const id = this.store.bomitem.length + 1;
    const bomItem = {
      id,
      rawAmount: '1',
      quantity: 1,
      optional: false,
      consumable: false,
      setupQuantity: 0,
      attrition: 0,
      roundingMultiple: null,
      pieceCount: 1,
      reference: `BOM-REF-${id}`,
      note: '',
      checksum: null,
      validated: true,
      inherited: false,
      allowVariants: false,
      partId: 1,
      subPartId: 2,
      ...data,
    };
    this.store.bomitem.push(bomItem);
    return bomItem;
  }

  seedStockItem(data: Partial<any> = {}) {
    const id = this.store.stockitem.length + 1;
    const stockItem = {
      id,
      packaging: null,
      serial: null,
      serialInt: 0,
      link: null,
      batch: 'BATCH-001',
      quantity: 10,
      isBuilding: false,
      expiryDate: null,
      stocktakeDate: null,
      creationDate: new Date(),
      deleteOnDeplete: false,
      status: '10', // 10 = OK
      purchasePrice: 15.5,
      owner: null,
      parentId: null,
      partId: 1,
      supplierPartId: null,
      locationId: 1,
      belongsToId: null,
      customerId: null,
      buildId: null,
      consumedById: null,
      purchaseOrderId: null,
      salesOrderId: null,
      stocktakeUserId: null,
      ...data,
    };
    this.store.stockitem.push(stockItem);
    return stockItem;
  }

  seedBuildOrder(data: Partial<any> = {}) {
    const id = this.store.build.length + 1;
    const build = {
      id,
      reference: `BO-${id.toString().padStart(4, '0')}`,
      title: `Build Order ${id}`,
      external: false,
      quantity: 5,
      completed: 0,
      status: '10', // 10 = PENDING, 20 = PRODUCTION
      batch: `BATCH-${id}`,
      creationDate: new Date(),
      startDate: null,
      targetDate: null,
      completionDate: null,
      link: null,
      priority: 0,
      parentId: null,
      partId: 1,
      salesOrderId: null,
      takeFromId: null,
      destinationId: null,
      completedById: null,
      issuedById: null,
      responsibleId: null,
      projectCodeId: null,
      ...data,
    };
    this.store.build.push(build);
    return build;
  }

  seedBuildLine(data: Partial<any> = {}) {
    const id = this.store.buildline.length + 1;
    const line = {
      id,
      quantity: 5,
      consumed: 0,
      buildId: 1,
      bomItemId: 1,
      ...data,
    };
    this.store.buildline.push(line);
    return line;
  }

  seedBuildItem(data: Partial<any> = {}) {
    const id = this.store.builditem.length + 1;
    const item = {
      id,
      quantity: 1,
      buildLineId: 1,
      stockItemId: 1,
      installIntoId: null,
      ...data,
    };
    this.store.builditem.push(item);
    return item;
  }

  seedCompany(data: Partial<any> = {}) {
    const id = this.store.company.length + 1;
    const company = {
      id,
      name: `Company ${id}`,
      description: 'Test Company',
      website: 'https://example.com',
      isCustomer: true,
      isSupplier: false,
      isManufacturer: false,
      currency: 'USD',
      active: true,
      ...data,
    };
    this.store.company.push(company);
    return company;
  }

  seedSalesOrder(data: Partial<any> = {}) {
    const id = this.store.salesorder.length + 1;
    const so = {
      id,
      reference: `SO-${id.toString().padStart(4, '0')}`,
      status: '10', // 10 = PENDING, 20 = IN_PROGRESS
      customerReference: `CUST-REF-${id}`,
      shipmentDate: null,
      customerId: 1,
      shippedById: null,
      ...data,
    };
    this.store.salesorder.push(so);
    return so;
  }

  seedSalesOrderLineItem(data: Partial<any> = {}) {
    const id = this.store.salesorderlineitem.length + 1;
    const line = {
      id,
      salePrice: 25.0,
      shipped: 0,
      orderId: 1,
      partId: 1,
      ...data,
    };
    this.store.salesorderlineitem.push(line);
    return line;
  }

  seedSalesOrderAllocation(data: Partial<any> = {}) {
    const id = this.store.salesorderallocation.length + 1;
    const alloc = {
      id,
      quantity: 1,
      lineId: 1,
      shipmentId: null,
      itemId: 1,
      ...data,
    };
    this.store.salesorderallocation.push(alloc);
    return alloc;
  }

  seedSalesOrderShipment(data: Partial<any> = {}) {
    const id = this.store.salesordershipment.length + 1;
    const shipment = {
      id,
      shipmentDate: null,
      deliveryDate: null,
      reference: `SHIP-${id}`,
      trackingNumber: `TRACK-${id}`,
      invoiceNumber: `INV-${id}`,
      link: null,
      orderId: 1,
      shipmentAddressId: null,
      checkedById: null,
      ...data,
    };
    this.store.salesordershipment.push(shipment);
    return shipment;
  }

  seedReturnOrder(data: Partial<any> = {}) {
    const id = this.store.returnorder.length + 1;
    const ro = {
      id,
      reference: `RO-${id.toString().padStart(4, '0')}`,
      status: '10', // 10 = PENDING, 20 = IN_PROGRESS, 25 = ON_HOLD, 40 = COMPLETE, 50 = CANCELLED
      customerReference: `RMA-${id}`,
      completeDate: null,
      customerId: 1,
      ...data,
    };
    this.store.returnorder.push(ro);
    return ro;
  }

  seedReturnOrderLineItem(data: Partial<any> = {}) {
    const id = this.store.returnorderlineitem.length + 1;
    const line = {
      id,
      quantity: 1,
      receivedDate: null,
      outcome: 'PENDING',
      price: 0,
      orderId: 1,
      itemId: 1,
      ...data,
    };
    this.store.returnorderlineitem.push(line);
    return line;
  }

  seedTransferOrder(data: Partial<any> = {}) {
    const id = this.store.transferorder.length + 1;
    const to = {
      id,
      reference: `TO-${id.toString().padStart(4, '0')}`,
      status: '10', // 10 = PENDING, 20 = ISSUED, 30 = COMPLETE, 40 = CANCELLED
      consume: false,
      completeDate: null,
      takeFromId: 1,
      destinationId: 2,
      ...data,
    };
    this.store.transferorder.push(to);
    return to;
  }

  seedTransferOrderLineItem(data: Partial<any> = {}) {
    const id = this.store.transferorderlineitem.length + 1;
    const line = {
      id,
      transferred: 0,
      orderId: 1,
      partId: 1,
      ...data,
    };
    this.store.transferorderlineitem.push(line);
    return line;
  }

  seedTransferOrderAllocation(data: Partial<any> = {}) {
    const id = this.store.transferorderallocation.length + 1;
    const alloc = {
      id,
      quantity: 1,
      lineId: 1,
      itemId: 1,
      ...data,
    };
    this.store.transferorderallocation.push(alloc);
    return alloc;
  }

  seedUser(data: Partial<any> = {}) {
    const id = this.store.user.length + 1;
    const user = {
      id,
      username: `user_${id}`,
      password: 'hashed_password',
      email: `user_${id}@example.com`,
      isStaff: false,
      isSuperuser: false,
      ...data,
    };
    this.store.user.push(user);
    return user;
  }
}
