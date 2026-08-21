'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  hidePriceQuote,
  importPriceRadarCsv,
  updatePriceQuote,
} from '../services/price-radar-service';
import { CsvImportResult, PriceQuoteFormPayload } from '../types/price-radar';
import {
  BRAZIL_RADAR_REVALIDATE_INTERVAL_MS,
  getBrazilRadarSnapshotCache,
  hasBrazilRadarSnapshot,
  initialPriceRadarKpis,
  isBrazilRadarSnapshotStale,
  revalidateBrazilRadarSnapshot,
  setBrazilRadarFilters,
  subscribeToBrazilRadarSnapshotCache,
} from '../state/brazil-radar-snapshot-cache';

export function usePriceRadar() {
  const snapshot = useSyncExternalStore(
    subscribeToBrazilRadarSnapshotCache,
    getBrazilRadarSnapshotCache,
    getBrazilRadarSnapshotCache,
  );
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<CsvImportResult | null>(null);
  const hasSnapshot = hasBrazilRadarSnapshot(snapshot.filters);

  const load = useCallback(async () => {
    try {
      await revalidateBrazilRadarSnapshot(snapshot.filters);
    } catch {
      // The cache retains a previous snapshot and exposes the error to the page.
    }
  }, [snapshot.filters]);

  useEffect(() => {
    if (!hasSnapshot || isBrazilRadarSnapshotStale(snapshot.filters)) {
      void load();
    }

    const revalidateIfStale = () => {
      if (isBrazilRadarSnapshotStale(snapshot.filters)) {
        void load();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateIfStale();
      }
    };

    window.addEventListener('focus', revalidateIfStale);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const timer = window.setInterval(revalidateIfStale, BRAZIL_RADAR_REVALIDATE_INTERVAL_MS);

    return () => {
      window.removeEventListener('focus', revalidateIfStale);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [hasSnapshot, load, snapshot.filters]);

  async function save(payload: PriceQuoteFormPayload, id: string) {
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await updatePriceQuote(id, payload);
      setSuccess('Cotação atualizada com sucesso.');
      await load();
    } catch (priceRadarError) {
      setActionError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Não foi possível salvar a cotação.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function hide(id: string) {
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    try {
      await hidePriceQuote(id);
      setSuccess('Cotação ocultada logicamente.');
      await load();
    } catch (priceRadarError) {
      setActionError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Não foi possível ocultar a cotação.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(csvContent: string) {
    setSaving(true);
    setActionError(null);
    setSuccess(null);
    setLastImport(null);
    try {
      const result = await importPriceRadarCsv(csvContent);
      setLastImport(result);
      setSuccess(
        `Importação concluída: ${result.validRecords} válidos, ${result.invalidRecords} inconsistências.`,
      );
      await load();
    } catch (priceRadarError) {
      setActionError(
        priceRadarError instanceof Error
          ? priceRadarError.message
          : 'Não foi possível importar o CSV.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    quotes: hasSnapshot ? snapshot.items : [],
    visibleQuotes: hasSnapshot ? snapshot.visibleItems : [],
    facetIndex: snapshot.facetIndex,
    kpis: hasSnapshot ? snapshot.kpis : initialPriceRadarKpis,
    filters: snapshot.filters,
    setFilters: setBrazilRadarFilters,
    loading: !hasSnapshot && snapshot.isRevalidating,
    isRevalidating: snapshot.isRevalidating,
    saving,
    error: actionError ?? (hasSnapshot ? null : snapshot.error),
    revalidationError: hasSnapshot ? snapshot.error : null,
    success,
    lastImport,
    reload: load,
    save,
    hide,
    importCsv,
  };
}
