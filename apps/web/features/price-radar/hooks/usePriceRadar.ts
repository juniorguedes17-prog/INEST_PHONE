'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createPriceQuote,
  getPriceRadarKpis,
  hidePriceQuote,
  importPriceRadarCsv,
  listPriceQuotes,
  updatePriceQuote,
} from '../services/price-radar-service';
import {
  CsvImportResult,
  PriceQuoteFormPayload,
  PriceQuoteItem,
  PriceRadarFilters,
  PriceRadarKpis,
} from '../types/price-radar';

const initialFilters: PriceRadarFilters = {
  search: '',
  productId: '',
  supplierId: '',
  city: '',
  quality: '',
  deliveryTime: '',
  status: '',
  sort: 'lowest_price',
};

const initialKpis: PriceRadarKpis = {
  lowestValidPrice: 0,
  averagePrice: 0,
  highestPrice: 0,
  hiddenCount: 0,
};

export function usePriceRadar() {
  const [quotes, setQuotes] = useState<PriceQuoteItem[]>([]);
  const [kpis, setKpis] = useState<PriceRadarKpis>(initialKpis);
  const [filters, setFilters] = useState<PriceRadarFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<CsvImportResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextQuotes, nextKpis] = await Promise.all([
        listPriceQuotes(filters),
        getPriceRadarKpis(filters),
      ]);
      setQuotes(nextQuotes);
      setKpis(nextKpis);
    } catch (priceRadarError) {
      setError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Nao foi possivel carregar o Radar de Precos.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: PriceQuoteFormPayload, id?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (id) {
        await updatePriceQuote(id, payload);
        setSuccess('Cotacao atualizada com sucesso.');
      } else {
        await createPriceQuote(payload);
        setSuccess('Cotacao cadastrada com sucesso.');
      }
      await load();
    } catch (priceRadarError) {
      setError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Nao foi possivel salvar a cotacao.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function hide(id: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await hidePriceQuote(id);
      setSuccess('Cotacao ocultada logicamente.');
      await load();
    } catch (priceRadarError) {
      setError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Nao foi possivel ocultar a cotacao.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(csvContent: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    setLastImport(null);
    try {
      const result = await importPriceRadarCsv(csvContent);
      setLastImport(result);
      setSuccess(
        `Importacao concluida: ${result.validRecords} validos, ${result.invalidRecords} inconsistencias.`,
      );
      await load();
    } catch (priceRadarError) {
      setError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Nao foi possivel importar o CSV.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    quotes,
    kpis,
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    lastImport,
    save,
    hide,
    importCsv,
  };
}
