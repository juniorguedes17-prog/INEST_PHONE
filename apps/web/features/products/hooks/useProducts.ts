'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createProfitRegistration,
  createProduct,
  deleteProduct,
  getProductReferences,
  listProducts,
  setProductActive,
  updateProduct,
} from '../services/products-service';
import {
  ProductFilters,
  ProductFormPayload,
  ProductItem,
  ProductReferences,
  ProductSaveRequest,
  ProfitRegistrationPayload,
} from '../types/products';
import { getCanonicalModelKey } from '@/features/price-radar/utils/brazil-radar-facets';

const initialFilters: ProductFilters = {
  search: '',
  categoryId: '',
  modelId: '',
  status: '',
  productType: '',
  colorId: '',
  storageId: '',
};

export function useProducts() {
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [references, setReferences] = useState<ProductReferences>({
    categories: [],
    models: [],
    colors: [],
    storages: [],
  });
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextReferences] = await Promise.all([
        listProducts({ ...filters, modelId: '' }),
        getProductReferences(),
      ]);
      setAllProducts(nextProducts);
      setReferences(nextReferences);
    } catch (productError) {
      setError(
        productError instanceof Error
          ? productError.message
          : 'Nao foi possivel carregar produtos.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredModels = useMemo(
    () =>
      filters.categoryId
        ? references.models.filter((model) => model.categoryId === filters.categoryId)
        : references.models,
    [filters.categoryId, references.models],
  );

  const products = useMemo(
    () =>
      filters.modelId
        ? allProducts.filter(
            (product) => getCanonicalModelKey(toFacetSource(product)) === filters.modelId,
          )
        : allProducts,
    [allProducts, filters.modelId],
  );

  async function save(request: ProductSaveRequest) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await persistProduct(request);
      setSuccess(
        request.modelMode === 'existing' && request.id
          ? 'Produto atualizado com sucesso.'
          : 'Produto cadastrado com sucesso.',
      );
      await load();
      return true;
    } catch (productError) {
      setError(
        productError instanceof Error ? productError.message : 'Nao foi possivel salvar produto.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteProduct(id);
      setSuccess('Produto removido com exclusao logica.');
      await load();
    } catch (productError) {
      setError(
        productError instanceof Error ? productError.message : 'Nao foi possivel remover produto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function setActive(id: string, active: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setProductActive(id, active);
      setSuccess(active ? 'Produto ativado com sucesso.' : 'Produto desativado com sucesso.');
      await load();
    } catch (productError) {
      setError(
        productError instanceof Error
          ? productError.message
          : 'Nao foi possivel atualizar o produto.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    products,
    allProducts,
    references,
    filters,
    setFilters,
    filteredModels,
    loading,
    saving,
    error,
    success,
    save,
    remove,
    setActive,
  };
}

interface ProductPersistence {
  createProduct: typeof createProduct;
  createProfitRegistration: typeof createProfitRegistration;
  updateProduct: typeof updateProduct;
}

const productPersistence: ProductPersistence = {
  createProduct,
  createProfitRegistration,
  updateProduct,
};

export async function persistProduct(
  request: ProductSaveRequest,
  persistence: ProductPersistence = productPersistence,
) {
  if (request.modelMode === 'existing' && request.id) {
    return persistence.updateProduct(request.id, request.payload);
  }
  if (request.modelMode === 'existing') {
    return persistence.createProduct(request.payload);
  }

  return persistence.createProfitRegistration(
    buildNewModelProfitRegistrationPayload(request.payload, request.modelName),
  );
}

export function buildNewModelProfitRegistrationPayload(
  payload: ProductFormPayload,
  modelName: string,
): ProfitRegistrationPayload {
  return {
    product: {
      categoryId: payload.categoryId,
      colorId: payload.colorId,
      storageId: payload.storageId,
      productType: payload.productType,
      isAppleOriginal: payload.isAppleOriginal,
      status: payload.status,
      qualityGrade: payload.qualityGrade,
      criticalNotes: payload.criticalNotes,
      productDescription: payload.productDescription,
      profitCondition: payload.profitCondition,
      netProfit: payload.netProfit,
    },
    model: {
      name: modelName.trim(),
      productType: payload.productType,
    },
  };
}

function toFacetSource(product: ProductItem) {
  return {
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName,
    quality: product.qualityGrade,
    productType: product.productType,
    notes: product.criticalNotes,
  };
}
