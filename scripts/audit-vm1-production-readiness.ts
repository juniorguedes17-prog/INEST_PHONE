import { PrismaClient, ProductStatus } from '@prisma/client';
import { deriveCanonicalVariantIdentity } from '@inest/product-identity';

const prisma = new PrismaClient();

const activeWhere = {
  active: true,
  status: ProductStatus.ACTIVE,
  deletedAt: null,
} as const;

const productSelect = {
  id: true,
  profitProductId: true,
  productDescription: true,
  active: true,
  status: true,
  deletedAt: true,
  productType: true,
  profitCondition: true,
  category: { select: { name: true } },
  model: { select: { name: true } },
  color: { select: { name: true } },
  storage: { select: { value: true, displayName: true, unit: true } },
} as const;

type AuditedProduct = Awaited<ReturnType<typeof loadProducts>>[number];

async function loadProducts() {
  return prisma.product.findMany({ where: activeWhere, select: productSelect });
}

function identityInput(product: AuditedProduct) {
  return {
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName ?? product.storage?.value,
    quality: product.profitCondition,
    productType: product.productType,
  };
}

function auditProduct(product: AuditedProduct) {
  const identity = deriveCanonicalVariantIdentity(identityInput(product));
  return { product, identity };
}

function classification(status: string, canonicalModelKey: string | null) {
  if (status === 'valid') return 'VALID';
  if (status === 'ambiguous_identity') return 'AMBIGUOUS';
  if (canonicalModelKey) return 'INSUFFICIENT';
  return 'UNRESOLVED';
}

function value(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? 'null';
}

function printProduct(label: string, audited: ReturnType<typeof auditProduct> | null) {
  console.log(`${label}:`);
  if (!audited) {
    console.log('NOT_FOUND');
    return;
  }

  const { product, identity } = audited;
  console.log(`productId=${product.id}`);
  console.log(`profitProductId=${value(product.profitProductId)}`);
  console.log(`productDescription=${value(product.productDescription)}`);
  console.log(`active=${product.active}`);
  console.log(`status=${product.status}`);
  console.log(`deletedAt=${value(product.deletedAt)}`);
  console.log(`canonicalModelKey=${value(identity.canonicalModelKey)}`);
  console.log(`screen=${value(identity.canonicalScreen)}`);
  console.log(`connectivity=${value(identity.canonicalConnectivity)}`);
  console.log(`identityStatus=${classification(identity.status, identity.canonicalModelKey)}`);
}

function findByDescription(products: AuditedProduct[], terms: string[]) {
  return products.find((product) => {
    const text = [product.productDescription, product.model?.name].filter(Boolean).join(' ').toLowerCase();
    return terms.every((term) => text.includes(term.toLowerCase()));
  });
}

function expectedMacBook(audited: ReturnType<typeof auditProduct> | null, storage: string) {
  if (!audited) return false;
  const { product, identity } = audited;
  return (
    classification(identity.status, identity.canonicalModelKey) === 'VALID' &&
    identity.canonicalModelKey === 'macbook-neo-13' &&
    identity.canonicalChip === 'A18' &&
    identity.attributes.chipVariant === 'pro' &&
    identity.canonicalScreen === '13"' &&
    identity.canonicalRam === '8GB' &&
    identity.canonicalStorage === storage &&
    product.profitCondition === 'NOVO'
  );
}

function expectedIdentity(audited: ReturnType<typeof auditProduct> | null, model: string, screen: string) {
  return Boolean(
    audited &&
      classification(audited.identity.status, audited.identity.canonicalModelKey) === 'VALID' &&
      audited.identity.canonicalModelKey === model &&
      audited.identity.canonicalScreen === screen,
  );
}

async function main() {
  await prisma.$queryRaw`SELECT 1`;

  const [productsTotal, productsActive, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: activeWhere }),
    loadProducts(),
  ]);

  const audited = products.map(auditProduct);
  const counts = { VALID: 0, INSUFFICIENT: 0, UNRESOLVED: 0, AMBIGUOUS: 0 };
  const byKey = new Map<string, AuditedProduct[]>();

  for (const item of audited) {
    const status = classification(item.identity.status, item.identity.canonicalModelKey) as keyof typeof counts;
    counts[status] += 1;
    if (item.identity.key) {
      byKey.set(item.identity.key, [...(byKey.get(item.identity.key) ?? []), item.product]);
    }
  }

  const collisions = [...byKey.values()].filter((group) => new Set(group.map((product) => product.id)).size > 1);
  const id61 = products.find((product) => product.profitProductId === 61);
  const id62 = products.find((product) => product.profitProductId === 62);
  const id67 = await prisma.product.findUnique({ where: { profitProductId: 67 }, select: productSelect });
  const neo256 = products
    .map(auditProduct)
    .find(({ product }) => {
      const text = [product.productDescription, product.model?.name, product.storage?.displayName].filter(Boolean).join(' ').toLowerCase();
      return text.includes('macbook neo') && text.includes('256');
    }) ?? null;
  const neo512 = products
    .map(auditProduct)
    .find(({ product }) => {
      const text = [product.productDescription, product.model?.name, product.storage?.displayName].filter(Boolean).join(' ').toLowerCase();
      return text.includes('macbook neo') && text.includes('512');
    }) ?? null;
  const air256 = findByDescription(products, ['iphone', 'air', '256']);
  const air512 = findByDescription(products, ['iphone', 'air', '512']);
  const charger = findByDescription(products, ['carregador', '20w', 'usb-c']);
  const cable = findByDescription(products, ['cabo', 'usb-c']);

  const blockers: string[] = [];
  if (counts.INSUFFICIENT || counts.UNRESOLVED || counts.AMBIGUOUS) {
    blockers.push(`active identity counts are VALID=${counts.VALID}, INSUFFICIENT=${counts.INSUFFICIENT}, UNRESOLVED=${counts.UNRESOLVED}, AMBIGUOUS=${counts.AMBIGUOUS}`);
  }
  if (collisions.length) blockers.push(`${collisions.length} canonical collision(s) among active Products`);
  if (!expectedIdentity(id61 ? auditProduct(id61) : null, 'apple-watch-series-11-42', '42mm')) blockers.push('profitProductId 61 does not match the expected identity');
  if (!expectedIdentity(id62 ? auditProduct(id62) : null, 'apple-watch-series-11-46', '46mm')) blockers.push('profitProductId 62 does not match the expected identity');
  if (id67 && activeWhere.active === id67.active && id67.status === ProductStatus.ACTIVE && id67.deletedAt === null) blockers.push('profitProductId 67 is active');
  if (!expectedMacBook(neo256, '256GB')) blockers.push('MacBook Neo 256GB does not match the expected identity');
  if (!expectedMacBook(neo512, '512GB')) blockers.push('MacBook Neo 512GB does not match the expected identity');
  if (!air256 || !air512) blockers.push('iPhone 17 Air 256GB/512GB was not found among active Products');
  if (!charger) blockers.push('Carregador Apple 20W USB-C was not found among active Products');
  if (!cable) blockers.push('Cabo Apple USB-C was not found among active Products');

  console.log('=== VM1 PRODUCTION READINESS AUDIT ===');
  console.log('databaseConnection:');
  console.log('CONNECTED');
  console.log(`productsTotal: ${productsTotal}`);
  console.log(`productsActive: ${productsActive}`);
  console.log(`productsInactive: ${productsTotal - productsActive}`);
  console.log('activeIdentity:');
  console.log(`VALID=${counts.VALID}`);
  console.log(`INSUFFICIENT=${counts.INSUFFICIENT}`);
  console.log(`UNRESOLVED=${counts.UNRESOLVED}`);
  console.log(`AMBIGUOUS=${counts.AMBIGUOUS}`);
  console.log(`canonicalCollisions: ${collisions.length}`);
  printProduct('ID61', id61 ? auditProduct(id61) : null);
  printProduct('ID62', id62 ? auditProduct(id62) : null);
  console.log('ID67:');
  if (id67) {
    console.log(`productId=${id67.id}`);
    console.log(`profitProductId=${value(id67.profitProductId)}`);
    console.log(`productDescription=${value(id67.productDescription)}`);
    console.log(`active=${id67.active}`);
    console.log(`status=${id67.status}`);
    console.log(`deletedAt=${value(id67.deletedAt)}`);
    console.log(`participaDosAtivos=${id67.active === true && id67.status === ProductStatus.ACTIVE && id67.deletedAt === null}`);
  } else {
    console.log('NOT_FOUND');
  }
  console.log('MacBookNeo256:');
  console.log(`status=${neo256 ? classification(neo256.identity.status, neo256.identity.canonicalModelKey) : 'FAIL'}`);
  console.log(`chip=${value(neo256?.identity.canonicalChip)}`);
  console.log(`chipVariant=${value(neo256?.identity.attributes.chipVariant)}`);
  console.log(`screen=${value(neo256?.identity.canonicalScreen)}`);
  console.log(`ram=${value(neo256?.identity.canonicalRam)}`);
  console.log(`storage=${value(neo256?.identity.canonicalStorage)}`);
  console.log('MacBookNeo512:');
  console.log(`status=${neo512 ? classification(neo512.identity.status, neo512.identity.canonicalModelKey) : 'FAIL'}`);
  console.log(`chip=${value(neo512?.identity.canonicalChip)}`);
  console.log(`chipVariant=${value(neo512?.identity.attributes.chipVariant)}`);
  console.log(`screen=${value(neo512?.identity.canonicalScreen)}`);
  console.log(`ram=${value(neo512?.identity.canonicalRam)}`);
  console.log(`storage=${value(neo512?.identity.canonicalStorage)}`);
  console.log(`iPhone17Air: ${air256 && air512 ? 'PASS' : 'FAIL'}`);
  console.log(`Charger20W: ${charger ? 'PASS' : 'FAIL'}`);
  console.log(`CableUSBC: ${cable ? 'PASS' : 'FAIL'}`);
  console.log(`VM1: ${blockers.length ? 'BLOCKED' : 'RELEASED'}`);
  if (blockers.length) {
    console.log('BLOCKERS:');
    blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
}

main()
  .catch(() => {
    console.error('databaseConnection: ERROR');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
