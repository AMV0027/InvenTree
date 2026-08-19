import { vi } from 'vitest';

export interface MockStore {
  user: any[];
  group: any[];
  part: any[];
  partcategory: any[];
  bomitem: any[];
  bomitemsubstitute: any[];
  stockitem: any[];
  stocklocation: any[];
  stocklocationtype: any[];
  stockitemtracking: any[];
  stockitemtestresult: any[];
  parttesttemplate: any[];
  build: any[];
  buildline: any[];
  builditem: any[];
  salesorder: any[];
  salesorderlineitem: any[];
  salesorderallocation: any[];
  salesordershipment: any[];
  returnorder: any[];
  returnorderlineitem: any[];
  transferorder: any[];
  transferorderlineitem: any[];
  transferorderallocation: any[];
  purchaseorder: any[];
  purchaseorderlineitem: any[];
  company: any[];
}

export function createDecimal(val: number | string | null | undefined) {
  const num = val === null || val === undefined ? 0 : Number(val);
  return {
    toNumber: () => num,
    toString: () => String(num),
    valueOf: () => num,
    toJSON: () => num,
    equals: (other: any) => num === (typeof other === 'object' && other?.toNumber ? other.toNumber() : Number(other)),
  };
}

export function wrapDecimals(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const wrapped = { ...item };
  const decimalFields = [
    'quantity',
    'consumed',
    'shipped',
    'received',
    'transferred',
    'salePrice',
    'purchasePrice',
    'baseCost',
    'minimumStock',
    'maximumStock',
    'setupQuantity',
    'attrition',
    'discount',
    'totalPrice',
  ];
  for (const field of decimalFields) {
    if (field in wrapped && wrapped[field] !== null && wrapped[field] !== undefined) {
      if (typeof wrapped[field] === 'number' || typeof wrapped[field] === 'string') {
        wrapped[field] = createDecimal(wrapped[field]);
      }
    }
  }
  return wrapped;
}

export function unwrapDecimals(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const unwrapped: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'toNumber' in v) {
      unwrapped[k] = (v as any).toNumber();
    } else if (v && typeof v === 'object' && ('increment' in v || 'decrement' in v)) {
      unwrapped[k] = v; // handled in update
    } else {
      unwrapped[k] = v;
    }
  }
  return unwrapped;
}

function matchFilter(record: any, where: any): boolean {
  if (!where || Object.keys(where).length === 0) return true;
  for (const [key, filter] of Object.entries(where)) {
    if (key === 'AND' && Array.isArray(filter)) {
      if (!filter.every((subWhere) => matchFilter(record, subWhere))) return false;
      continue;
    }
    if (key === 'OR' && Array.isArray(filter)) {
      if (!filter.some((subWhere) => matchFilter(record, subWhere))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchFilter(record, filter)) return false;
      continue;
    }

    const val = record[key];
    if (filter === null || filter === undefined) {
      if (val !== null && val !== undefined) return false;
      continue;
    }
    if (typeof filter === 'object' && !('toNumber' in filter)) {
      if ('equals' in filter && val !== filter.equals) return false;
      if ('not' in filter && val === filter.not) return false;
      if ('in' in filter && Array.isArray(filter.in) && !filter.in.includes(val)) return false;
      if ('notIn' in filter && Array.isArray(filter.notIn) && filter.notIn.includes(val)) return false;
      if ('gt' in filter) {
        const numVal = val && val.toNumber ? val.toNumber() : Number(val);
        if (numVal <= Number(filter.gt)) return false;
      }
      if ('gte' in filter) {
        const numVal = val && val.toNumber ? val.toNumber() : Number(val);
        if (numVal < Number(filter.gte)) return false;
      }
      if ('lt' in filter) {
        const numVal = val && val.toNumber ? val.toNumber() : Number(val);
        if (numVal >= Number(filter.lt)) return false;
      }
      if ('lte' in filter) {
        const numVal = val && val.toNumber ? val.toNumber() : Number(val);
        if (numVal > Number(filter.lte)) return false;
      }
      continue;
    }

    const recVal = val && typeof val === 'object' && 'toNumber' in val ? val.toNumber() : val;
    const filVal = filter && typeof filter === 'object' && 'toNumber' in filter ? filter.toNumber() : filter;
    if (recVal !== filVal) return false;
  }
  return true;
}

export function createMockPrismaStore(): { store: MockStore; prismaMock: any; resetDb: () => void } {
  let idCounters: Record<string, number> = {};

  const store: MockStore = {
    user: [],
    group: [],
    part: [],
    partcategory: [],
    bomitem: [],
    bomitemsubstitute: [],
    stockitem: [],
    stocklocation: [],
    stocklocationtype: [],
    stockitemtracking: [],
    stockitemtestresult: [],
    parttesttemplate: [],
    build: [],
    buildline: [],
    builditem: [],
    salesorder: [],
    salesorderlineitem: [],
    salesorderallocation: [],
    salesordershipment: [],
    returnorder: [],
    returnorderlineitem: [],
    transferorder: [],
    transferorderlineitem: [],
    transferorderallocation: [],
    purchaseorder: [],
    purchaseorderlineitem: [],
    company: [],
  };

  function nextId(table: string): number {
    idCounters[table] = (idCounters[table] || 0) + 1;
    return idCounters[table];
  }

  function resetDb() {
    for (const key of Object.keys(store)) {
      (store as any)[key] = [];
    }
    idCounters = {};
  }

  function createModelMock(table: keyof MockStore) {
    return {
      findUnique: vi.fn(async (args: { where: any; include?: any }) => {
        const item = store[table].find((r) => matchFilter(r, args.where));
        return item ? wrapDecimals(item) : null;
      }),
      findFirst: vi.fn(async (args?: { where?: any; include?: any; orderBy?: any }) => {
        const item = store[table].find((r) => matchFilter(r, args?.where || {}));
        return item ? wrapDecimals(item) : null;
      }),
      findMany: vi.fn(async (args?: { where?: any; include?: any; orderBy?: any; take?: number; skip?: number }) => {
        let items = store[table].filter((r) => matchFilter(r, args?.where || {}));
        if (args?.skip) {
          items = items.slice(args.skip);
        }
        if (args?.take) {
          items = items.slice(0, args.take);
        }
        return items.map(wrapDecimals);
      }),
      create: vi.fn(async (args: { data: any; include?: any }) => {
        const unwrapped = unwrapDecimals(args.data);
        const id = unwrapped.id || nextId(table);
        const record = { ...unwrapped, id };
        store[table].push(record);
        return wrapDecimals(record);
      }),
      createMany: vi.fn(async (args: { data: any[] }) => {
        const records = args.data.map((d) => {
          const unwrapped = unwrapDecimals(d);
          const id = unwrapped.id || nextId(table);
          const record = { ...unwrapped, id };
          store[table].push(record);
          return record;
        });
        return { count: records.length };
      }),
      update: vi.fn(async (args: { where: any; data: any; include?: any }) => {
        const idx = store[table].findIndex((r) => matchFilter(r, args.where));
        if (idx === -1) throw new Error(`Record to update not found in ${table}`);
        const current = store[table][idx];
        const updateData: any = {};
        for (const [key, val] of Object.entries(args.data)) {
          if (val && typeof val === 'object' && 'increment' in val) {
            const curVal = current[key] && typeof current[key] === 'object' && 'toNumber' in current[key]
              ? current[key].toNumber()
              : Number(current[key] || 0);
            updateData[key] = curVal + Number((val as any).increment);
          } else if (val && typeof val === 'object' && 'decrement' in val) {
            const curVal = current[key] && typeof current[key] === 'object' && 'toNumber' in current[key]
              ? current[key].toNumber()
              : Number(current[key] || 0);
            updateData[key] = curVal - Number((val as any).decrement);
          } else if (val && typeof val === 'object' && 'toNumber' in val) {
            updateData[key] = (val as any).toNumber();
          } else {
            updateData[key] = val;
          }
        }
        const updated = { ...current, ...updateData };
        store[table][idx] = updated;
        return wrapDecimals(updated);
      }),
      updateMany: vi.fn(async (args: { where: any; data: any }) => {
        let count = 0;
        store[table].forEach((item, idx) => {
          if (matchFilter(item, args.where)) {
            store[table][idx] = { ...item, ...unwrapDecimals(args.data) };
            count++;
          }
        });
        return { count };
      }),
      delete: vi.fn(async (args: { where: any }) => {
        const idx = store[table].findIndex((r) => matchFilter(r, args.where));
        if (idx === -1) throw new Error(`Record to delete not found in ${table}`);
        const [deleted] = store[table].splice(idx, 1);
        return wrapDecimals(deleted);
      }),
      deleteMany: vi.fn(async (args?: { where?: any }) => {
        const initialLen = store[table].length;
        if (!args || !args.where) {
          store[table] = [];
          return { count: initialLen };
        }
        store[table] = store[table].filter((r) => !matchFilter(r, args.where));
        return { count: initialLen - store[table].length };
      }),
      count: vi.fn(async (args?: { where?: any }) => {
        if (!args || !args.where) return store[table].length;
        return store[table].filter((r) => matchFilter(r, args.where)).length;
      }),
    };
  }

  const prismaMock: any = {
    user: createModelMock('user'),
    group: createModelMock('group'),
    part: createModelMock('part'),
    partcategory: createModelMock('partcategory'),
    bomitem: createModelMock('bomitem'),
    bomitemsubstitute: createModelMock('bomitemsubstitute'),
    stockitem: createModelMock('stockitem'),
    stocklocation: createModelMock('stocklocation'),
    stocklocationtype: createModelMock('stocklocationtype'),
    stockitemtracking: createModelMock('stockitemtracking'),
    stockitemtestresult: createModelMock('stockitemtestresult'),
    parttesttemplate: createModelMock('parttesttemplate'),
    build: createModelMock('build'),
    buildline: createModelMock('buildline'),
    builditem: createModelMock('builditem'),
    salesorder: createModelMock('salesorder'),
    salesorderlineitem: createModelMock('salesorderlineitem'),
    salesorderallocation: createModelMock('salesorderallocation'),
    salesordershipment: createModelMock('salesordershipment'),
    returnorder: createModelMock('returnorder'),
    returnorderlineitem: createModelMock('returnorderlineitem'),
    transferorder: createModelMock('transferorder'),
    transferorderlineitem: createModelMock('transferorderlineitem'),
    transferorderallocation: createModelMock('transferorderallocation'),
    purchaseorder: createModelMock('purchaseorder'),
    purchaseorderlineitem: createModelMock('purchaseorderlineitem'),
    company: createModelMock('company'),
    $transaction: vi.fn(async (input: any) => {
      if (typeof input === 'function') {
        return input(prismaMock);
      }
      if (Array.isArray(input)) {
        return Promise.all(input);
      }
      return input;
    }),
  };

  return { store, prismaMock, resetDb };
}
