'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createProduct,
  deleteProduct,
  getProductReferences,
  listProducts,
  updateProduct,
} from '../services/products-service';
import {
  ProductFilters,
  ProductFormPayload,
  ProductItem,
  ProductReferences,
} from '../types/products';

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
  const [products, setProducts] = useState<ProductItem[]>([]);
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
        listProducts(filters),
        getProductReferences(),
      ]);
      setProducts(nextProducts);
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

  async function save(payload: ProductFormPayload, id?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (id) {
        await updateProduct(id, payload);
        setSuccess('Produto atualizado com sucesso.');
      } else {
        await createProduct(payload);
        setSuccess('Produto cadastrado com sucesso.');
      }
      await load();
    } catch (productError) {
      setError(
        productError instanceof Error ? productError.message : 'Nao foi possivel salvar produto.',
      );
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

  return {
    products,
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
  };
}
