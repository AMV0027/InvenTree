import { Decimal } from '@prisma/client/runtime/library';

/** Standard paginated list response shape matching InvenTree frontend expectations */
export function paginate<T>(items: T[]): { count: number; results: T[] } {
  return { count: items.length, results: items };
}

/** Apply limit/offset from query params for in-memory slicing (use DB-level for production) */
export function sliceQuery(items: any[], query: Record<string, string>) {
  const limit = parseInt(query.limit ?? '100', 10);
  const offset = parseInt(query.offset ?? '0', 10);
  return items.slice(offset, offset + limit);
}

/** Safe integer parser */
export function toInt(val: string | undefined): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

/** Safe float parser */
export function toFloat(val: string | undefined): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

/** Convert Decimal/BigInt for JSON serialization */
export function toJSON(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint'
        ? value.toString()
        : value instanceof Decimal
        ? value.toNumber()
        : value
    )
  );
}
