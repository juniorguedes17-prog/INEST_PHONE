# Apple originality backfill

Standalone operation for the 131 IDs approved in P1.1. The literal manifest in
`prisma/data/apple-originality.manifest.ts` is the only classification authority.
This script is not imported by the API or the general seed.

## Future execution

1. Apply the existing `202609040001_product_apple_originality` migration through
   the approved deployment process first. This script never runs migrations.
2. Set `DATABASE_URL` securely for the explicitly approved database. The script
   does not load an environment file or select an environment automatically.
3. From the repository root, run `pnpm exec tsx scripts/backfill-apple-originality.ts`.
   This is a dry-run. Missing IDs, duplicates, false or invalid states block it
   with exit code 1. Review the preflight JSON and the database target.
4. Only after approval, run the same command with `--apply`. It revalidates inside
   a serializable transaction, changes only approved null values to true, then
   verifies 131 true values before commit. Errors roll back the transaction.
5. Repeat the dry-run: expect `alreadyTrue=131`, `null=0`, `conflictingFalse=0`,
   `missing=0`, `duplicates=0`, `outsideManifestAffected=0`. A repeated apply must
   report `updated=0`. Enable any future pricing engine only in its own release.

The preflight reports expected/found/null/alreadyTrue/conflictingFalse/missing/
duplicates/outsideManifestAffected and the affected IDs. Before writing,
outsideManifestAffected is zero because this execution has made no writes.
The apply postflight compares every outside Product's ID, profitProductId,
classification and updatedAt against the transaction's initial snapshot.
It also verifies already-true Products keep their timestamps. The update predicate
contains both approved profitProductIds and the concrete pending Product IDs,
plus `isAppleOriginal IS NULL`. No financial fields are written. Only Products
changed from null to true receive Prisma's normal updatedAt update.

The final `complete` report is emitted after commit. Keep that report as evidence:
a later dry-run cannot reconstruct a prior outside-Product snapshot. Serialization
conflicts fail without automatic retry; review and repeat the dry-run explicitly.
Do not rewrite false classifications or create missing Products to force a pass.

## Offline verification

`pnpm exec tsx --test prisma/apple-originality-backfill.spec.ts`

Tests use an in-memory transactional store and never connect to a database.
No production execution is part of preparing this backfill.
