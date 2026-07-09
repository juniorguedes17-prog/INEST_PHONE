'use client';

import { useCallback, useEffect, useState } from 'react';
import { generateOfferDraft, listPricing, recalculatePricing } from '../services/pricing-service';
import { OfferDraft, PricingFilters, PricingItem } from '../types/pricing';

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
  const [items, setItems] = useState<PricingItem[]>([]);
  const [filters, setFilters] = useState<PricingFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [offerDraft, setOfferDraft] = useState<OfferDraft | null>(null);

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
      setOfferDraft(draft);
      setSuccess('Oferta preparada com os dados da precificacao.');
    } catch (pricingError) {
      setError(
        pricingError instanceof Error ? pricingError.message : 'Nao foi possivel gerar a oferta.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    offerDraft,
    setOfferDraft,
    recalculate,
    generateOffer,
  };
}
