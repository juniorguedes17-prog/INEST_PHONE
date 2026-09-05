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
  | { action: 'incomplete'; reason: ProfitRegistrationIncompleteReason; message: string };

type ProfitRegistrationIncompleteReason =
  'NO_CANONICAL_MODEL' | 'MULTIPLE_CANONICAL_MODELS' | 'INCOMPATIBLE_PRODUCT_TYPE';

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

type CatalogProductTypeResolution =
  | {
      action: 'existing-model';
      category: ProductReferences['categories'][number];
      model: ProductReferences['models'][number];
      productType: string;
    }
  | {
      action: 'create-canonical-model';
      category: ProductReferences['categories'][number];
      productType: string;
    }
  | { action: 'incomplete'; reason: ProfitRegistrationIncompleteReason };

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
      reason: 'NO_CANONICAL_MODEL',
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

  const catalogType = resolveCatalogProductType(
    canonicalModelCandidates,
    references,
    identity.canonicalModelKey,
  );
  if (catalogType.action === 'incomplete') {
    return {
      action: 'incomplete',
      reason: catalogType.reason,
      message: incompleteRegistrationMessage(catalogType.reason),
    };
  }

  const { category, productType } = catalogType;

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

  if (catalogType.action === 'create-canonical-model') {
    return {
      action: 'create-model-and-product',
      payload: productPayload,
      model: {
        name: identity.canonicalModelLabel,
        canonicalModelKey: identity.canonicalModelKey,
        productType,
      },
    };
  }

  return {
    action: 'create',
    payload: { ...productPayload, modelId: catalogType.model.id },
  };
}

function resolveCatalogProductType(
  canonicalModelCandidates: ProductReferences['models'],
  references: ProductReferences,
  canonicalModelKey: string,
): CatalogProductTypeResolution {
  if (canonicalModelCandidates.length === 0) {
    return { action: 'incomplete', reason: 'NO_CANONICAL_MODEL' };
  }

  const matches = canonicalModelCandidates.map((model) => {
    const productType = model.productType;
    if (!model.id || !model.categoryId || !isCatalogProductType(productType)) return null;

    const category = references.categories.find(
      (candidate) =>
        candidate.id === model.categoryId &&
        candidate.type === productType &&
        isCatalogProductType(candidate.type),
    );
    return category ? { category, model, productType } : null;
  });

  if (matches.some((match) => match === null)) {
    return { action: 'incomplete', reason: 'INCOMPATIBLE_PRODUCT_TYPE' };
  }

  const compatibleMatches = matches.filter(
    (match): match is NonNullable<typeof match> => match !== null,
  );
  const productTypes = new Set(compatibleMatches.map((match) => match.productType));
  if (productTypes.size !== 1) {
    return { action: 'incomplete', reason: 'INCOMPATIBLE_PRODUCT_TYPE' };
  }

  const categories = new Map(compatibleMatches.map((match) => [match.category.id, match.category]));
  if (categories.size !== 1) {
    return { action: 'incomplete', reason: 'MULTIPLE_CANONICAL_MODELS' };
  }

  const [match] = compatibleMatches;
  if (!match) {
    return { action: 'incomplete', reason: 'NO_CANONICAL_MODEL' };
  }

  const models = new Map(
    compatibleMatches.map((candidate) => [candidate.model.id, candidate.model]),
  );
  if (models.size === 1) {
    return {
      action: 'existing-model',
      category: match.category,
      model: match.model,
      productType: match.productType,
    };
  }

  const canonicalModels = compatibleMatches.filter(
    (candidate) => candidate.model.normalizedName === canonicalModelKey,
  );
  if (canonicalModels.length === 1) {
    const [canonicalModel] = canonicalModels;
    if (!canonicalModel) {
      return { action: 'incomplete', reason: 'MULTIPLE_CANONICAL_MODELS' };
    }
    return {
      action: 'existing-model',
      category: canonicalModel.category,
      model: canonicalModel.model,
      productType: canonicalModel.productType,
    };
  }

  if (canonicalModels.length > 1) {
    return { action: 'incomplete', reason: 'MULTIPLE_CANONICAL_MODELS' };
  }

  return {
    action: 'create-canonical-model',
    category: match.category,
    productType: match.productType,
  };
}

function incompleteRegistrationMessage(reason: ProfitRegistrationIncompleteReason) {
  switch (reason) {
    case 'NO_CANONICAL_MODEL':
      return 'Nao foi encontrado um Model canonico compativel para cadastrar o Lucro Liquido.';
    case 'MULTIPLE_CANONICAL_MODELS':
      return 'Mais de um Model canonico compativel foi encontrado para cadastrar o Lucro Liquido.';
    case 'INCOMPATIBLE_PRODUCT_TYPE':
      return 'O Model canonico possui categoria comercial ou tipo de produto incompativel.';
  }
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
