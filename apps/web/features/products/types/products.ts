export interface ProductReference {
  id: string;
  name?: string;
  slug?: string;
  type?: string;
  categoryId?: string;
  productType?: string;
  displayName?: string;
}

export interface ProductItem {
  id: string;
  profitProductId?: number | null;
  productDescription?: string | null;
  profitCondition?: 'NOVO' | 'SEMINOVO' | 'CPO' | null;
  netProfit?: number | string | null;
  active?: boolean;
  categoryId: string;
  modelId: string;
  colorId?: string | null;
  storageId?: string | null;
  productType: string;
  isAppleOriginal?: boolean | null;
  status: string;
  qualityGrade?: string | null;
  criticalNotes?: string | null;
  category?: { id: string; name: string; type: string };
  model?: { id: string; name: string };
  color?: { id: string; name: string } | null;
  storage?: { id: string; displayName: string } | null;
}

export interface ProductReferences {
  categories: ProductReference[];
  models: ProductReference[];
  colors: ProductReference[];
  storages: ProductReference[];
}

export interface ProductFormPayload {
  categoryId: string;
  modelId: string;
  colorId?: string;
  storageId?: string;
  productType: string;
  isAppleOriginal?: boolean | null;
  status: string;
  qualityGrade?: string;
  criticalNotes?: string;
  productDescription: string;
  profitCondition: 'NOVO' | 'SEMINOVO' | 'CPO';
  netProfit: string;
}

export type ProfitRegistrationProductPayload = Omit<ProductFormPayload, 'modelId'>;

export interface ProfitRegistrationModelPayload {
  name: string;
  canonicalModelKey: string;
  productType: string;
}

export interface ProfitRegistrationPayload {
  product: ProfitRegistrationProductPayload;
  model: ProfitRegistrationModelPayload;
}

export interface ProductFilters {
  search: string;
  categoryId: string;
  modelId: string;
  status: string;
  productType: string;
  colorId: string;
  storageId: string;
}
