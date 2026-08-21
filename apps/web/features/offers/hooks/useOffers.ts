'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  deleteOffer,
  duplicateOffer,
  getOffersWorkSnapshot,
  listOfferProducts,
  listOffers,
  listTemplates,
  registerOfferCopy,
  shareOffer,
} from '../services/offers-service';
import { CommercialTemplate, OfferItem } from '../types/offers';
import { OfferDraft, PricingItem } from '@/features/pricing/types/pricing';
import {
  PreparedTemporaryOffer,
  TemporaryOfferItem,
  prepareConsolidatedTemporaryOffers,
  prepareTemporaryOffer,
} from '../utils/temporary-offer-consolidation';

export function useOffers() {
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [templates, setTemplates] = useState<CommercialTemplate[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [currentOffer, setCurrentOffer] = useState<OfferItem | TemporaryOfferItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [temporaryOfferDrafts, setTemporaryOfferDrafts] = useState<OfferDraft[]>([]);
  const [consolidatedTemporaryOffers, setConsolidatedTemporaryOffers] = useState<
    TemporaryOfferItem[]
  >([]);
  const [temporaryOfferFailedCount, setTemporaryOfferFailedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextTemplates, nextOffers, workSnapshot] = await Promise.all([
        listOfferProducts(),
        listTemplates(),
        listOffers(),
        getOffersWorkSnapshot(),
      ]);
      setPricingItems(nextProducts);
      setTemplates(nextTemplates);
      setOffers(nextOffers);
      setTemporaryOfferDrafts(workSnapshot?.drafts ?? []);
      setTemporaryOfferFailedCount(workSnapshot?.failedCount ?? 0);
    } catch (offersError) {
      setError(
        offersError instanceof Error
          ? offersError.message
          : 'Não foi possível carregar o Gerador de Ofertas.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!temporaryOfferDrafts.length || !templates.length) return;

    const preparedOffers: PreparedTemporaryOffer[] = [];
    for (const draft of temporaryOfferDrafts) {
      const preparedOffer = prepareTemporaryOffer(draft, templates);
      if (!preparedOffer) {
        setError('Oferta preparada sem identificador de origem.');
        return;
      }
      preparedOffers.push(preparedOffer);
    }

    const firstOffer = preparedOffers[0];
    if (!firstOffer) return;
    const consolidatedOffers = prepareConsolidatedTemporaryOffers(preparedOffers);
    const firstConsolidatedOffer = consolidatedOffers[0];
    if (!firstConsolidatedOffer) return;
    setConsolidatedTemporaryOffers(consolidatedOffers);
    setCurrentOffer(firstConsolidatedOffer);
    setSuccess(
      temporaryOfferFailedCount
        ? `${preparedOffers.length} ofertas preparadas. ${temporaryOfferFailedCount} item(ns) não puderam ser processados.`
        : preparedOffers.length === 1
          ? 'Oferta preparada com o template comercial padrao.'
          : `${preparedOffers.length} ofertas preparadas com o template comercial padrao.`,
    );
  }, [templates, temporaryOfferDrafts, temporaryOfferFailedCount]);

  async function copy(offer: OfferItem | TemporaryOfferItem) {
    await navigator.clipboard.writeText(offer.message);
    if (offer.productId && !('sourceDrafts' in offer)) {
      await registerOfferCopy(offer.id);
    }
    setSuccess('Texto copiado.');
  }

  async function share(offer: OfferItem | TemporaryOfferItem) {
    if (!offer.productId || 'sourceDrafts' in offer) {
      window.open(`https://wa.me/?text=${encodeURIComponent(offer.message)}`, '_blank');
      return;
    }
    const result = await shareOffer(offer.id);
    window.open(result.whatsappUrl, '_blank');
  }

  async function duplicate(id: string) {
    setSaving(true);
    try {
      const offer = await duplicateOffer(id);
      setCurrentOffer(offer);
      setSuccess('Oferta duplicada.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    try {
      await deleteOffer(id);
      setSuccess('Oferta cancelada com exclusao logica.');
      await load();
    } finally {
      setSaving(false);
    }
  }

  return {
    pricingItems,
    templates,
    offers,
    currentOffer,
    consolidatedTemporaryOffers,
    loading,
    saving,
    error,
    success,
    setCurrentOffer,
    copy,
    share,
    duplicate,
    remove,
  };
}
