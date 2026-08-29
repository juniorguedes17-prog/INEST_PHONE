import {
  canonicalColorAliases,
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
} from '../../price-radar/utils/canonical-product-identity';
import type {
  ProductFormPayload,
  ProductItem,
  ProductReferences,
  ProfitRegistrationModelPayload,
  ProfitRegistrationProductPayload,
} from '../../products/types/products';
import type { BrazilRadarQuotePricing } from '../types/pricing';

export const emptyProductFilters = {
  search: '',
  categoryId: '',
  modelId: '',
  status: '',
  productType: '',
  colorId: '',
  storageId: '',
};

type ProfitRegistrationResolution =
  | { action: 'update'; productId: string; payload: ProductFormPayload }
  | { action: 'create'; payload: ProductFormPayload }
  | {
      action: 'create-model-and-product';
      payload: ProfitRegistrationProductPayload;
      model: ProfitRegistrationModelPayload;
    }
  | { action: 'incomplete'; message: string };

const catalogProductTypes = new Set([
  'IPHONE_SEALED',
  'IPHONE_USED',
  'APPLE_CPO',
  'MACBOOK',
  'IPAD',
  'APPLE_WATCH',
  'AIRPODS',
  'ACCESSORY',
]);

type CatalogProductTypeResolution = {
  category: ProductReferences['categories'][number];
  model: ProductReferences['models'][number];
  productType: string;
};

export function resolveProfitRegistration({
  item,
  netProfit,
  products,
  references,
  catalogProduct,
}: {
  item: BrazilRadarQuotePricing;
  netProfit: string;
  products: ProductItem[];
  references: ProductReferences;
  catalogProduct?: ProductItem | null;
}): ProfitRegistrationResolution {
  if (catalogProduct) {
    return {
      action: 'update',
      productId: catalogProduct.id,
      payload: toExistingProductPayload(catalogProduct, netProfit),
    };
  }

  const source = toCanonicalSource(item);
  const identity = normalizeCanonicalProductIdentity(source);
  const matchingProduct = products.find((product) =>
    matchesCatalogProduct(product, item, identity),
  );

  if (matchingProduct) {
    return {
      action: 'update',
      productId: matchingProduct.id,
      payload: toExistingProductPayload(matchingProduct, netProfit),
    };
  }

  if (!identity.canonicalModelMatched || !identity.canonicalModelKey) {
    return {
      action: 'incomplete',
      message:
        'Nao foi possivel identificar com seguranca o modelo necessario para cadastrar o Lucro Liquido.',
    };
  }

  const canonicalModelCandidates = references.models.filter(
    (candidate) =>
      candidate.name &&
      normalizeCanonicalProductIdentity({
        productName: candidate.name,
        category: identity.canonicalCategory,
      }).canonicalModelKey === identity.canonicalModelKey,
  );

  const catalogType = resolveCatalogProductType(canonicalModelCandidates, references);
  if (!catalogType) {
    return {
      action: 'incomplete',
      message:
        'O modelo canonico nao possui uma categoria comercial compativel com tipo de produto valido.',
    };
  }

  const { category, model, productType } = catalogType;

  const storageId = findStorageId(references, identity.canonicalStorage);
  const colorId = findColorId(references, identity.canonicalColor, item.product.color);
  const productPayload = {
    categoryId: category.id,
    colorId,
    storageId,
    productType,
    status: 'ACTIVE',
    productDescription: item.profit.productDescription.trim() || item.product.name.trim(),
    profitCondition: item.product.condition,
    netProfit,
  };

  return {
    action: 'create',
    payload: { ...productPayload, modelId: model.id },
  };
}

function resolveCatalogProductType(
  canonicalModelCandidates: ProductReferences['models'],
  references: ProductReferences,
): CatalogProductTypeResolution | null {
  const matches = canonicalModelCandidates.flatMap((model) => {
    const productType = model.productType;
    if (!model.id || !model.categoryId || !isCatalogProductType(productType)) return [];

    return references.categories
      .filter(
        (category) =>
          category.id === model.categoryId &&
          category.type === model.productType &&
          isCatalogProductType(category.type),
      )
      .map((category) => ({ category, model, productType }));
  });

  return matches.length === 1 ? (matches[0] ?? null) : null;
}

function isCatalogProductType(value: string | undefined): value is string {
  return value !== undefined && catalogProductTypes.has(value);
}

function toExistingProductPayload(product: ProductItem, netProfit: string): ProductFormPayload {
  return {
    categoryId: product.categoryId,
    modelId: product.modelId,
    colorId: product.colorId ?? undefined,
    storageId: product.storageId ?? undefined,
    productType: product.productType,
    status: product.status,
    qualityGrade: product.qualityGrade ?? undefined,
    criticalNotes: product.criticalNotes ?? undefined,
    productDescription: product.productDescription?.trim() ?? '',
    profitCondition: product.profitCondition ?? 'NOVO',
    netProfit,
  };
}

function toCanonicalSource(item: BrazilRadarQuotePricing) {
  return {
    productDescription: item.profit.productDescription,
    productName: item.product.name,
    category: item.product.category,
    model: item.product.model,
    color: item.product.color,
    capacity: item.product.capacity,
    quality: item.product.condition,
  };
}

function matchesCatalogProduct(
  product: ProductItem,
  item: BrazilRadarQuotePricing,
  sourceIdentity: ReturnType<typeof normalizeCanonicalProductIdentity>,
) {
  if (product.active === false || product.profitCondition !== item.product.condition) return false;

  const productIdentity = normalizeCanonicalProductIdentity({
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName,
    quality: product.profitCondition,
    productType: product.productType,
  });
  if (
    !productIdentity.canonicalModelMatched ||
    productIdentity.canonicalModelKey !== sourceIdentity.canonicalModelKey
  ) {
    return false;
  }

  return (
    !sourceIdentity.canonicalStorage ||
    productIdentity.canonicalStorage === sourceIdentity.canonicalStorage
  );
}

function findStorageId(references: ProductReferences, storage: string | null) {
  if (!storage) return undefined;
  return references.storages.find(
    (candidate) =>
      normalizeCanonicalText(candidate.displayName) === normalizeCanonicalText(storage),
  )?.id;
}

function findColorId(references: ProductReferences, color: string | null, rawColor: string) {
  const canonicalColor = canonicalColorAliases.find((candidate) => candidate.value === color);
  const expected = canonicalColor?.label ?? rawColor;
  if (!expected) return undefined;
  return references.colors.find(
    (candidate) => normalizeCanonicalText(candidate.name) === normalizeCanonicalText(expected),
  )?.id;
}
