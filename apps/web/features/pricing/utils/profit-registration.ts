import {
  canonicalColorAliases,
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
} from '../../price-radar/utils/canonical-product-identity';
import type { ProductFormPayload, ProductItem, ProductReferences } from '../../products/types/products';
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
  | { action: 'incomplete'; message: string };

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
  const matchingProduct = products.find((product) => matchesCatalogProduct(product, item, identity));

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

  const category = references.categories.find(
    (candidate) =>
      normalizeCanonicalText(candidate.name) === normalizeCanonicalText(identity.canonicalCategory),
  );
  if (!category?.id) {
    return {
      action: 'incomplete',
      message: 'A categoria identificada ainda nao esta disponivel no catalogo para este cadastro.',
    };
  }

  const model = references.models.find((candidate) => {
    if (candidate.categoryId !== category.id || !candidate.name) return false;
    return (
      normalizeCanonicalProductIdentity({
        productName: candidate.name,
        category: identity.canonicalCategory,
      }).canonicalModelKey === identity.canonicalModelKey
    );
  });
  if (!model?.id) {
    return {
      action: 'incomplete',
      message: 'O modelo identificado ainda nao esta disponivel no catalogo para este cadastro.',
    };
  }

  const storageId = findStorageId(references, identity.canonicalStorage);
  const colorId = findColorId(references, identity.canonicalColor, item.product.color);

  return {
    action: 'create',
    payload: {
      categoryId: category.id,
      modelId: model.id,
      colorId,
      storageId,
      productType: productTypeForCategory(identity.canonicalCategory, item.product.condition),
      status: 'ACTIVE',
      productDescription: item.profit.productDescription.trim() || item.product.name.trim(),
      profitCondition: item.product.condition,
      netProfit,
    },
  };
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
    (candidate) => normalizeCanonicalText(candidate.displayName) === normalizeCanonicalText(storage),
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

function productTypeForCategory(category: string, condition: BrazilRadarQuotePricing['product']['condition']) {
  if (category === 'iPhone') {
    if (condition === 'CPO') return 'APPLE_CPO';
    return condition === 'SEMINOVO' ? 'IPHONE_USED' : 'IPHONE_SEALED';
  }
  if (category === 'MacBook') return 'MACBOOK';
  if (category === 'iPad') return 'IPAD';
  if (category === 'Apple Watch') return 'APPLE_WATCH';
  return 'ACCESSORY';
}
