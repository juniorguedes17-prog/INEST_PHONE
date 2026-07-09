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
  categoryId: string;
  modelId: string;
  colorId?: string | null;
  storageId?: string | null;
  productType: string;
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
  status: string;
  qualityGrade?: string;
  criticalNotes?: string;
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
