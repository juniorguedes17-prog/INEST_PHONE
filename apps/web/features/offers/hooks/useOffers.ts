'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  OfferDraft,
  OfferDraftBatchStorage,
  PricingItem,
  TEMPORARY_OFFER_DRAFT_STORAGE_KEY,
} from '@/features/pricing/types/pricing';
import {
  findTemplateForProductType,
  PreparedTemporaryOffer,
  prepareConsolidatedTemporaryOffers,
  prepareTemporaryOffer,
} from '../utils/temporary-offer-consolidation';

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
  const [temporaryOfferDrafts, setTemporaryOfferDrafts] = useState<OfferDraft[]>([]);
  const [temporaryOffer, setTemporaryOffer] = useState<OfferItem | null>(null);
  const [consolidatedTemporaryOffers, setConsolidatedTemporaryOffers] = useState<OfferItem[]>([]);
  const [temporaryOfferFailedCount, setTemporaryOfferFailedCount] = useState(0);
  const hasIncomingDraft = useRef(false);

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY);
    if (!storedDraft) return;

    window.sessionStorage.removeItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY);
    try {
      hasIncomingDraft.current = true;
      const prepared = JSON.parse(storedDraft) as OfferDraft | OfferDraftBatchStorage;
      const batch = toOfferDraftBatch(prepared);
      setTemporaryOfferDrafts(batch.drafts);
      setTemporaryOfferFailedCount(batch.failedCount);
    } catch {
      setError('Nao foi possivel carregar a oferta preparada pela Precificacao.');
    }
  }, []);

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
      const nextProductId =
        selectedProductId || (!hasIncomingDraft.current ? nextProducts[0]?.productId : undefined);
      if (nextProductId && !hasIncomingDraft.current) {
        const product = nextProducts.find((item) => item.productId === nextProductId);
        const template = findTemplateForProductType(nextTemplates, product?.productType);
        setSelectedProductId(nextProductId);
        if (template) {
          setSelectedTemplateId(template.id);
        }
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
    console.debug('[offers.consolidation.runtime]', {
      beforeCount: preparedOffers.length,
      items: preparedOffers.map((offer) => ({
        productName: offer.sourceDraft.payload.productName,
        templateId: offer.template.id,
        templateName: offer.template.name,
        productType: offer.sourceDraft.productType,
        sourceQuoteId: offer.sourceDraft.payload.sourceQuoteId,
      })),
    });
    const consolidatedOffers = prepareConsolidatedTemporaryOffers(preparedOffers);
    console.debug('[offers.consolidation.runtime]', {
      beforeCount: preparedOffers.length,
      items: preparedOffers.map((offer) => ({
        productName: offer.sourceDraft.payload.productName,
        templateId: offer.template.id,
        templateName: offer.template.name,
        productType: offer.sourceDraft.productType,
        sourceQuoteId: offer.sourceDraft.payload.sourceQuoteId,
      })),
      afterCount: consolidatedOffers.length,
    });
    const firstConsolidatedOffer = consolidatedOffers[0];
    if (!firstConsolidatedOffer) return;
    setSelectedProductId(firstOffer.productId ?? '');
    setSelectedTemplateId(firstOffer.template?.id ?? '');
    setTemporaryOffer(firstConsolidatedOffer);
    setConsolidatedTemporaryOffers(consolidatedOffers);
    setCurrentOffer(firstConsolidatedOffer);
    setSuccess(
      temporaryOfferFailedCount
        ? `${preparedOffers.length} ofertas preparadas. ${temporaryOfferFailedCount} item(ns) nao puderam ser processados.`
        : preparedOffers.length === 1
          ? 'Oferta preparada com o template comercial padrao.'
          : `${preparedOffers.length} ofertas preparadas com o template comercial padrao.`,
    );
  }, [templates, temporaryOfferDrafts, temporaryOfferFailedCount]);

  const selectedProduct = useMemo(
    () => pricingItems.find((item) => item.productId === selectedProductId) ?? null,
    [pricingItems, selectedProductId],
  );

  const selectProduct = useCallback(
    (productId: string) => {
      setSelectedProductId(productId);
      const product = pricingItems.find((item) => item.productId === productId);
      const template = findTemplateForProductType(templates, product?.productType);
      if (template) {
        setSelectedTemplateId(template.id);
      }
    },
    [pricingItems, templates],
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
    if (offer.productId) {
      await registerOfferCopy(offer.id);
    }
    setSuccess('Texto copiado.');
  }

  async function share(offer: OfferItem) {
    if (!offer.productId) {
      window.open(offer.whatsappUrl, '_blank');
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
    selectedProduct,
    selectedProductId,
    selectedTemplateId,
    currentOffer,
    temporaryOffer,
    consolidatedTemporaryOffers,
    loading,
    saving,
    error,
    success,
    setSelectedProductId: selectProduct,
    setSelectedTemplateId,
    setCurrentOffer,
    generate,
    copy,
    share,
    duplicate,
    remove,
  };
}

function toOfferDraftBatch(prepared: OfferDraft | OfferDraftBatchStorage): OfferDraftBatchStorage {
  if ('drafts' in prepared && Array.isArray(prepared.drafts)) {
    return prepared;
  }

  return { drafts: [prepared as OfferDraft], failedCount: 0 };
}
