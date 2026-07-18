'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { generateOfferDraft, listPricing, recalculatePricing } from '../services/pricing-service';
import {
  OfferDraft,
  PricingFilters,
  PricingItem,
  TemporaryImportPricing,
  TEMPORARY_IMPORT_PRICING_STORAGE_KEY,
  TEMPORARY_OFFER_DRAFT_STORAGE_KEY,
} from '../types/pricing';

const initialFilters: PricingFilters = {
  search: '',
  category: '',
  model: '',
  color: '',
  capacity: '',
  productType: '',
  status: '',
  minPrice: '',
  maxPrice: '',
  sort: 'lowest_price',
};

export function usePricing() {
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [filters, setFilters] = useState<PricingFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [temporaryImportPricing, setTemporaryImportPricing] =
    useState<TemporaryImportPricing | null>(null);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TEMPORARY_IMPORT_PRICING_STORAGE_KEY);
    if (!stored) return;

    window.sessionStorage.removeItem(TEMPORARY_IMPORT_PRICING_STORAGE_KEY);
    try {
      setTemporaryImportPricing(JSON.parse(stored) as TemporaryImportPricing);
      setSuccess('Precificacao temporaria do Radar Paraguai carregada.');
    } catch {
      setError('Nao foi possivel carregar a precificacao temporaria do Radar Paraguai.');
    }
  }, [pathname]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPricing(filters));
    } catch (pricingError) {
      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Nao foi possivel carregar a precificacao.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recalculate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      setItems(await recalculatePricing(filters));
      setSuccess('Precos recalculados dinamicamente.');
    } catch (pricingError) {
      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Nao foi possivel recalcular os precos.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateOffer(productId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const draft = await generateOfferDraft(productId);
      sendOfferDraft({ ...draft, source: 'pricing' });
    } catch (pricingError) {
      setError(
        pricingError instanceof Error ? pricingError.message : 'Nao foi possivel gerar a oferta.',
      );
    } finally {
      setSaving(false);
    }
  }

  function generateTemporaryOffer() {
    if (!temporaryImportPricing) return;
    const isIphone = /iphone/i.test(temporaryImportPricing.product.name);
    const productType = isIphone
      ? temporaryImportPricing.profit.condition === 'NOVO'
        ? 'IPHONE_SEALED'
        : 'IPHONE_USED'
      : 'ACCESSORY';

    sendOfferDraft({ ...temporaryImportPricing.offerDraft, productType, source: 'temporary-import' });
  }

  function sendOfferDraft(draft: OfferDraft) {
    window.sessionStorage.setItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    router.push(draft.route);
  }

  return {
    items,
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    temporaryImportPricing,
    recalculate,
    generateOffer,
    generateTemporaryOffer,
  };
}
