import {
  APPLE_ORIGINAL_PROFIT_PRODUCT_IDS,
  EXPECTED_APPLE_ORIGINALITY_COUNT,
} from './data/apple-originality.manifest';

const selection = {
  id: true,
  profitProductId: true,
  isAppleOriginal: true,
  updatedAt: true,
} as const;

export interface OriginalityProduct {
  id: string;
  profitProductId: number | null;
  isAppleOriginal: boolean | null;
  updatedAt: Date;
}

export interface OriginalityStore {
  product: {
    findMany(args: { select: typeof selection }): Promise<OriginalityProduct[]>;
    updateMany(args: {
      where: {
        id: { in: string[] };
        profitProductId: { in: number[] };
        isAppleOriginal: null;
      };
      data: { isAppleOriginal: true };
    }): Promise<{ count: number }>;
  };
}

export interface OriginalityDatabase {
  $transaction<T>(
    action: (transaction: OriginalityStore) => Promise<T>,
    options: { isolationLevel: 'Serializable' },
  ): Promise<T>;
}

export interface OriginalityReport {
  expected: number;
  manifestCount: number;
  found: number;
  null: number;
  alreadyTrue: number;
  conflictingFalse: number;
  missing: number;
  duplicates: number;
  outsideManifestAffected: number;
  conflictingIds: number[];
  missingIds: number[];
  duplicateIds: number[];
  invalidIds: number[];
  invalidStateIds: string[];
}

export class OriginalityBackfillBlocked extends Error {
  constructor(
    public readonly reason: string,
    public readonly report: OriginalityReport,
  ) {
    super(reason);
  }
}

export function inspectOriginality(
  products: readonly OriginalityProduct[],
  manifest: readonly number[] = APPLE_ORIGINAL_PROFIT_PRODUCT_IDS,
): OriginalityReport {
  const ids = new Set(manifest);
  const duplicateIds = new Set(manifest.filter((id, index) => manifest.indexOf(id) !== index));
  const rows = products.filter(
    (product) => product.profitProductId !== null && ids.has(product.profitProductId),
  );
  const counts = new Map<number, number>();
  for (const row of rows) {
    const id = row.profitProductId!;
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (counts.get(id)! > 1) duplicateIds.add(id);
  }
  const missingIds = [...ids].filter((id) => !counts.has(id));
  const conflictingIds = rows
    .filter((row) => row.isAppleOriginal === false)
    .map((row) => row.profitProductId!);
  return {
    expected: EXPECTED_APPLE_ORIGINALITY_COUNT,
    manifestCount: manifest.length,
    found: rows.length,
    null: rows.filter((row) => row.isAppleOriginal === null).length,
    alreadyTrue: rows.filter((row) => row.isAppleOriginal === true).length,
    conflictingFalse: conflictingIds.length,
    missing: missingIds.length,
    duplicates: duplicateIds.size,
    outsideManifestAffected: 0,
    conflictingIds,
    missingIds,
    duplicateIds: [...duplicateIds],
    invalidIds: [...ids].filter((id) => !Number.isSafeInteger(id) || id <= 0),
    invalidStateIds: rows
      .filter((row) => ![true, false, null].includes(row.isAppleOriginal))
      .map((row) => row.id),
  };
}

function assertSafe(report: OriginalityReport) {
  if (
    report.manifestCount !== report.expected ||
    report.found !== report.expected ||
    report.conflictingFalse ||
    report.missing ||
    report.duplicates ||
    report.invalidIds.length ||
    report.invalidStateIds.length ||
    report.outsideManifestAffected
  ) {
    throw new OriginalityBackfillBlocked('preflight_failed', report);
  }
}

function sameObservation(left: OriginalityProduct, right: OriginalityProduct | undefined) {
  return (
    right !== undefined &&
    left.profitProductId === right.profitProductId &&
    left.isAppleOriginal === right.isAppleOriginal &&
    left.updatedAt.getTime() === right.updatedAt.getTime()
  );
}

export async function backfillAppleOriginality(
  database: OriginalityDatabase,
  options: { apply?: boolean; onPreflight?: (report: OriginalityReport) => void } = {},
) {
  // Validate, compare-and-set and verify in one snapshot. Any failure rolls back all writes.
  return database.$transaction(
    async (transaction) => {
      const before = await transaction.product.findMany({ select: selection });
      const preflight = inspectOriginality(before);
      options.onPreflight?.(preflight);
      assertSafe(preflight);
      if (!options.apply)
        return { mode: 'dry-run' as const, updated: 0, preflight, postflight: null };

      const approved = new Set(APPLE_ORIGINAL_PROFIT_PRODUCT_IDS);
      const pending = before.filter(
        (row) =>
          row.profitProductId !== null &&
          approved.has(row.profitProductId) &&
          row.isAppleOriginal === null,
      );
      const updated =
        pending.length === 0
          ? 0
          : (
              await transaction.product.updateMany({
                where: {
                  id: { in: pending.map((row) => row.id) },
                  profitProductId: { in: [...APPLE_ORIGINAL_PROFIT_PRODUCT_IDS] },
                  isAppleOriginal: null,
                },
                data: { isAppleOriginal: true },
              })
            ).count;
      if (updated !== pending.length)
        throw new OriginalityBackfillBlocked('write_count_mismatch', preflight);

      const after = await transaction.product.findMany({ select: selection });
      const afterById = new Map(after.map((row) => [row.id, row]));
      const beforeById = new Map(before.map((row) => [row.id, row]));
      const outside = (row: OriginalityProduct) =>
        row.profitProductId === null || !approved.has(row.profitProductId);
      const postflight = inspectOriginality(after);
      postflight.outsideManifestAffected =
        before.filter((row) => outside(row) && !sameObservation(row, afterById.get(row.id)))
          .length + after.filter((row) => outside(row) && !beforeById.has(row.id)).length;
      assertSafe(postflight);
      const unchangedTrue = before.filter((row) => !outside(row) && row.isAppleOriginal === true);
      if (
        postflight.null !== 0 ||
        postflight.alreadyTrue !== preflight.expected ||
        before
          .filter((row) => !outside(row))
          .some((row) => afterById.get(row.id)?.profitProductId !== row.profitProductId) ||
        unchangedTrue.some((row) => !sameObservation(row, afterById.get(row.id)))
      )
        throw new OriginalityBackfillBlocked('postflight_failed', postflight);
      return { mode: 'apply' as const, updated, preflight, postflight };
    },
    { isolationLevel: 'Serializable' },
  );
}
