import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  GenericStatus,
  PrismaClient,
  ProductCondition,
  ProductStatus,
  ProductType,
} from '@prisma/client';

type ProfitSeedProduct = {
  produto_id: number;
  condicao_produto: keyof typeof ProductCondition;
  produto_descricao: string;
  lucro_liquido: number;
};

const profitProducts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'prisma/data/profit-products.json'), 'utf8'),
) as ProfitSeedProduct[];

const categoryDefinitions = [
  ['iPhone Lacrado', 'iphone-lacrado', ProductType.IPHONE_SEALED],
  ['iPhone Seminovo', 'iphone-seminovo', ProductType.IPHONE_USED],
  ['Apple Certified Pre-Owned', 'apple-certified-pre-owned', ProductType.APPLE_CPO],
  ['MacBook', 'macbook', ProductType.MACBOOK],
  ['iPad', 'ipad', ProductType.IPAD],
  ['Apple Watch', 'apple-watch', ProductType.APPLE_WATCH],
  ['AirPods', 'airpods', ProductType.AIRPODS],
  ['Acessorios', 'acessorios', ProductType.ACCESSORY],
] as const;

export async function seedProfitProducts(prisma: PrismaClient) {
  validateProfitSeed(profitProducts);
  await ensureCategories(prisma);

  for (const record of profitProducts) {
    const condition = ProductCondition[record.condicao_produto];
    const productType = getProductType(record.produto_descricao, condition);
    const category = await prisma.productCategory.findUniqueOrThrow({
      where: { slug: getCategorySlug(productType, condition) },
    });
    const model = await resolveModel(
      prisma,
      category.id,
      productType,
      condition,
      record.produto_descricao,
    );
    const storage = await resolveStorage(prisma, record.produto_descricao);

    await prisma.product.upsert({
      where: { profitProductId: record.produto_id },
      update: {
        categoryId: category.id,
        modelId: model.id,
        storageId: storage?.id ?? null,
        colorId: null,
        productType,
        status: ProductStatus.ACTIVE,
        productDescription: record.produto_descricao,
        normalizedDescription: normalizeProfitDescription(record.produto_descricao),
        profitCondition: condition,
        netProfit: record.lucro_liquido,
        active: true,
        deletedAt: null,
      },
      create: {
        categoryId: category.id,
        modelId: model.id,
        storageId: storage?.id ?? null,
        productType,
        status: ProductStatus.ACTIVE,
        profitProductId: record.produto_id,
        productDescription: record.produto_descricao,
        normalizedDescription: normalizeProfitDescription(record.produto_descricao),
        profitCondition: condition,
        netProfit: record.lucro_liquido,
        active: true,
      },
    });
  }
}

async function ensureCategories(prisma: PrismaClient) {
  for (const [name, slug, type] of categoryDefinitions) {
    const existingCategory = await prisma.productCategory.findUnique({ where: { slug } });
    if (!existingCategory) {
      await prisma.productCategory.create({
        data: { name, slug, type, status: GenericStatus.ACTIVE },
      });
    }
  }
}

async function resolveModel(
  prisma: PrismaClient,
  categoryId: string,
  productType: ProductType,
  condition: ProductCondition,
  description: string,
) {
  const baseName = getBaseModelName(description, productType);
  const normalizedName =
    productType === ProductType.IPHONE_USED || productType === ProductType.APPLE_CPO
      ? `${condition.toLowerCase()}-${slugify(baseName)}`
      : slugify(baseName);

  const existingModel = await prisma.productModel.findUnique({ where: { normalizedName } });
  if (existingModel) return existingModel;

  return prisma.productModel.create({
    data: { categoryId, name: baseName, normalizedName, productType },
  });
}

async function resolveStorage(prisma: PrismaClient, description: string) {
  const match = [...description.matchAll(/(\d+)\s*\/?\s*(GB|TB)\b/gi)].at(-1);
  if (!match) return null;

  const value = match[1]!;
  const unit = match[2]!.toUpperCase();
  const displayName = `${value} ${unit}`;

  const existingStorage = await prisma.productStorage.findUnique({
    where: { value_unit: { value, unit } },
  });
  if (existingStorage) return existingStorage;

  return prisma.productStorage.create({ data: { value, unit, displayName } });
}

export function getProductType(description: string, condition: ProductCondition): ProductType {
  if (condition === ProductCondition.SEMINOVO) return ProductType.IPHONE_USED;

  const normalized = normalizeProfitDescription(description);
  if (condition === ProductCondition.CPO && normalized.startsWith('iphone')) {
    return ProductType.APPLE_CPO;
  }
  if (normalized.startsWith('iphone')) return ProductType.IPHONE_SEALED;
  if (normalized.includes('macbook') || normalized.includes('mac mini')) return ProductType.MACBOOK;
  if (normalized.startsWith('ipad')) return ProductType.IPAD;
  if (normalized.includes('apple watch')) return ProductType.APPLE_WATCH;
  if (normalized.includes('airpods')) return ProductType.AIRPODS;
  return ProductType.ACCESSORY;
}

export function getCategorySlug(productType: ProductType, condition: ProductCondition) {
  if (condition === ProductCondition.SEMINOVO) return 'iphone-seminovo';
  if (productType === ProductType.APPLE_CPO) return 'apple-certified-pre-owned';

  const byType: Record<ProductType, string> = {
    [ProductType.IPHONE_SEALED]: 'iphone-lacrado',
    [ProductType.IPHONE_USED]: 'iphone-seminovo',
    [ProductType.APPLE_CPO]: 'apple-certified-pre-owned',
    [ProductType.MACBOOK]: 'macbook',
    [ProductType.IPAD]: 'ipad',
    [ProductType.APPLE_WATCH]: 'apple-watch',
    [ProductType.AIRPODS]: 'airpods',
    [ProductType.ACCESSORY]: 'acessorios',
  };
  return byType[productType];
}

export function getBaseModelName(description: string, productType: ProductType) {
  const normalized = normalizeProfitDescription(description);
  const iphone = normalized.match(/^iphone\s+(?:\d+\s+pro\s+max|\d+\s+pro|\d+e?|air)/i);
  if (iphone) return toTitleCase(iphone[0]);
  if (normalized.includes('macbook air')) return 'MacBook Air';
  if (normalized.includes('macbook pro')) return 'MacBook Pro';
  if (normalized.includes('mac mini')) return 'Mac Mini';
  if (normalized.includes('ipad air')) return 'iPad Air';
  if (normalized.includes('ipad pro')) return 'iPad Pro';
  if (normalized.startsWith('ipad 9')) return 'iPad 9';
  if (normalized.startsWith('ipad')) return 'iPad';
  if (normalized.includes('watch ultra')) return 'Apple Watch Ultra';
  if (normalized.includes('watch se')) return 'Apple Watch SE';
  if (normalized.includes('watch')) return 'Apple Watch Series';
  if (normalized.includes('airpods max 2')) return 'AirPods Max 2';
  if (normalized.includes('airpods max')) return 'AirPods Max';
  if (normalized.includes('airpods pro')) return 'AirPods Pro';
  if (normalized.includes('airpods')) return 'AirPods';
  if (normalized.includes('apple pencil')) return 'Apple Pencil';
  if (normalized.includes('airtag')) return 'AirTag';
  if (normalized.includes('magic keyboard')) return 'Magic Keyboard';
  if (normalized.includes('magic mouse')) return 'Magic Mouse';
  if (normalized.includes('carregador')) return 'Carregador Apple';
  if (normalized.includes('cabo')) return 'Cabo Apple';
  return productType === ProductType.ACCESSORY ? description : toTitleCase(description);
}

function validateProfitSeed(records: ProfitSeedProduct[]) {
  if (records.length !== 131) {
    throw new Error(
      `Carga de lucro invalida: esperados 131 registros, recebidos ${records.length}.`,
    );
  }

  const ids = new Set<number>();
  const combinations = new Set<string>();
  for (const record of records) {
    if (
      !record.produto_id ||
      !record.condicao_produto ||
      !record.produto_descricao ||
      record.lucro_liquido === null
    ) {
      throw new Error('Carga de lucro invalida: campo obrigatorio ausente.');
    }
    if (ids.has(record.produto_id))
      throw new Error(`Carga de lucro invalida: produto_id duplicado ${record.produto_id}.`);
    ids.add(record.produto_id);
    const combination = `${record.condicao_produto}:${normalizeProfitDescription(record.produto_descricao)}`;
    if (combinations.has(combination))
      throw new Error(`Carga de lucro invalida: produto duplicado ${combination}.`);
    combinations.add(combination);
  }
}

function normalizeProfitDescription(value: string) {
  return value
    .replace(/&(quot|#34|#x22);/gi, '"')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)\s*["\u201c\u201d\u2033]/g, '$1 pol ')
    .replace(/\b(polegadas?|inches?|inch)\b/g, 'pol')
    .replace(/(\d+)\s*(gb|tb)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(value: string) {
  return normalizeProfitDescription(value).replace(/\s+/g, '-');
}

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

async function runStandaloneSeed() {
  const prisma = new PrismaClient();
  try {
    await seedProfitProducts(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/prisma/profit-products.seed.ts')) {
  void runStandaloneSeed().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
