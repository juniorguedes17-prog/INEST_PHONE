'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calculateImportCost,
  listImportHistory,
  searchImportProducts,
} from '../services/import-radar-service';
import { ImportCalculation, ImportProduct, ImportRadarFilters } from '../types/import-radar';

const initialFilters: ImportRadarFilters = {
  search: '',
  category: '',
  provider: 'mock',
};

export function useImportRadar() {
  const [filters, setFilters] = useState<ImportRadarFilters>(initialFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<ImportRadarFilters>(initialFilters);
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ImportProduct | null>(null);
  const [calculation, setCalculation] = useState<ImportCalculation | null>(null);
  const [dollarQuote, setDollarQuote] = useState(0);
  const [history, setHistory] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFilters(filters), 350);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, nextHistory] = await Promise.all([
        searchImportProducts(debouncedFilters),
        listImportHistory(),
      ]);
      setProducts(response.results);
      setDollarQuote(response.dollarQuote);
      setHistory(nextHistory);
    } catch (importRadarError) {
      setError(
        importRadarError instanceof Error
          ? importRadarError.message
          : 'Nao foi possivel carregar o Radar de Importacao.',
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters]);

  useEffect(() => {
    void search();
  }, [search]);

  async function selectProduct(product: ImportProduct) {
    setSaving(true);
    setError(null);
    setSelectedProduct(product);
    try {
      setCalculation(await calculateImportCost(product));
    } catch (importRadarError) {
      setError(
        importRadarError instanceof Error
          ? importRadarError.message
          : 'Nao foi possivel calcular o custo de importacao.',
      );
    } finally {
      setSaving(false);
    }
  }

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );

  return {
    filters,
    setFilters,
    products,
    selectedProduct,
    calculation,
    dollarQuote,
    history,
    categories,
    loading,
    saving,
    error,
    selectProduct,
  };
}
