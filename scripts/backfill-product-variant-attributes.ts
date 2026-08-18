import { PrismaClient, ProductStatus } from '@prisma/client';
import { backfillVariantAttributes } from '../apps/api/src/modules/products/variant-attributes-backfill';

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');

async function main() {
  const products = await prisma.product.findMany({
    where: { active: true, status: ProductStatus.ACTIVE, deletedAt: null },
    select: {
      id: true,
      productDescription: true,
      productType: true,
      profitCondition: true,
      variantAttributes: true,
      category: { select: { name: true } },
      model: { select: { name: true } },
      color: { select: { name: true } },
      storage: { select: { displayName: true, value: true } },
    },
  });
  const result = await backfillVariantAttributes(
    products.map((product) => ({
      id: product.id,
      productDescription: product.productDescription,
      category: product.category.name,
      model: product.model.name,
      color: product.color?.name,
      capacity: product.storage?.displayName ?? product.storage?.value,
      quality: product.profitCondition,
      productType: product.productType,
      variantAttributes: product.variantAttributes,
    })),
    {
      updateVariantAttributes: async (id, variantAttributes) => {
        await prisma.product.update({ where: { id }, data: { variantAttributes } });
      },
    },
    dryRun,
  );

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', ...result }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha no backfill de variantAttributes.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
