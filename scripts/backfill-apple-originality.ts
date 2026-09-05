import { PrismaClient } from '@prisma/client';
import {
  backfillAppleOriginality,
  OriginalityBackfillBlocked,
} from '../prisma/apple-originality-backfill';

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !['--apply', '--dry-run'].includes(args[0]!))) {
    throw new Error('Usage: tsx scripts/backfill-apple-originality.ts [--dry-run | --apply]');
  }
  const prisma = new PrismaClient();
  try {
    const result = await backfillAppleOriginality(prisma, {
      apply: args[0] === '--apply',
      onPreflight: (report) => console.log(JSON.stringify({ phase: 'preflight', ...report })),
    });
    // Emitted only after transaction commit, never for an uncommitted write.
    console.log(JSON.stringify({ phase: 'complete', ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof OriginalityBackfillBlocked) {
    console.error(JSON.stringify({ phase: 'blocked', reason: error.reason, report: error.report }));
  } else {
    // Do not expose connection strings from driver errors.
    console.error(
      JSON.stringify({
        phase: 'blocked',
        reason: 'execution_failed',
        errorType: error instanceof Error ? error.name : 'unknown',
      }),
    );
  }
  process.exitCode = 1;
});
