'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteOffer,
  duplicateOffer,
  generateOffer,
  listOfferProducts,
  listOffers,
  listTemplates,
  registerOfferCopy,
  shareOffer,
} from '../services/offers-service';
import { CommercialTemplate, OfferItem } from '../types/offers';
import { PricingItem } from '@/features/pricing/types/pricing';

export function useOffers(initialProductId?: string | null) {
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [templates, setTemplates] = useState<CommercialTemplate[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(initialProductId ?? '');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [currentOffer, setCurrentOffer] = useState<OfferItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextTemplates, nextOffers] = await Promise.all([
        listOfferProducts(),
        listTemplates(),
        listOffers(),
      ]);
      setPricingItems(nextProducts);
      setTemplates(nextTemplates);
      setOffers(nextOffers);
      if (!selectedProductId && nextProducts[0]) {
        setSelectedProductId(nextProducts[0].productId);
      }
    } catch (offersError) {
      setError(
        offersError instanceof Error
          ? offersError.message
          : 'Nao foi possivel carregar o Gerador de Ofertas.',
      );
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProduct = useMemo(
    () => pricingItems.find((item) => item.productId === selectedProductId) ?? null,
    [pricingItems, selectedProductId],
  );

  async function generate() {
    if (!selectedProductId) {
      setError('Selecione um produto precificado.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const offer = await generateOffer({
        productId: selectedProductId,
        templateId: selectedTemplateId || undefined,
      });
      setCurrentOffer(offer);
      setSuccess('Oferta gerada com sucesso.');
      await load();
    } catch (offersError) {
      setError(
        offersError instanceof Error ? offersError.message : 'Nao foi possivel gerar a oferta.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function copy(offer: OfferItem) {
    await navigator.clipboard.writeText(offer.message);
    await registerOfferCopy(offer.id);
    setSuccess('Texto copiado.');
  }

  async function share(offer: OfferItem) {
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
    selectedProduct,
    selectedProductId,
    selectedTemplateId,
    currentOffer,
    loading,
    saving,
    error,
    success,
    setSelectedProductId,
    setSelectedTemplateId,
    setCurrentOffer,
    generate,
    copy,
    share,
    duplicate,
    remove,
  };
}
