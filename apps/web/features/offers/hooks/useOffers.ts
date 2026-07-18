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
  PricingItem,
  TEMPORARY_OFFER_DRAFT_STORAGE_KEY,
} from '@/features/pricing/types/pricing';

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
  const [temporaryOfferDraft, setTemporaryOfferDraft] = useState<OfferDraft | null>(null);
  const [temporaryOffer, setTemporaryOffer] = useState<OfferItem | null>(null);
  const hasIncomingDraft = useRef(false);

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY);
    if (!storedDraft) return;

    window.sessionStorage.removeItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY);
    try {
      hasIncomingDraft.current = true;
      setTemporaryOfferDraft(JSON.parse(storedDraft) as OfferDraft);
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
    if (!temporaryOfferDraft || !templates.length) return;

    const template = findTemplateForProductType(
      templates,
      temporaryOfferDraft.productType,
    );
    if (!template) return;

    const payload = temporaryOfferDraft.payload;
    const offerPrice = formatCurrency(payload.offerPrice);
    const message = renderOfferMessage(template.content, {
      produto: payload.productName,
      modelo: payload.productName,
      cor: payload.color,
      capacidade: payload.capacity,
      preco: formatCurrency(payload.salePrice),
      preco_oferta: offerPrice,
      prazo: payload.deliveryTime || 'Prazo conforme oferta',
      garantia: payload.warranty,
    });

    const preparedOffer: OfferItem = {
      id: payload.productId,
      template,
      message,
      status: 'DRAFT',
      salePrice: payload.salePrice,
      offerPrice: payload.offerPrice,
      whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
      productId: null,
      createdAt: new Date().toISOString(),
    };

    setSelectedProductId(payload.productId);
    setSelectedTemplateId(template.id);
    setTemporaryOffer(preparedOffer);
    setCurrentOffer(preparedOffer);
    setSuccess('Oferta preparada com o template comercial padrao.');
  }, [templates, temporaryOfferDraft]);

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

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function renderOfferMessage(template: string, variables: Record<string, string>) {
  const offerPrice = variables.preco_oferta ?? '';
  const productName = variables.produto ?? variables.modelo ?? '';
  const renderedMessage = removeLegacyOfferPrice(renderTemplate(template, variables));

  if (hasOfferPriceByVariation(renderedMessage, offerPrice)) {
    return normalizeMessageSpacing(renderedMessage);
  }

  const messageWithoutStandalonePrice = removeStandaloneOfferPrice(
    renderedMessage,
    offerPrice,
  );

  return insertOfferPriceBelowProduct(
    messageWithoutStandalonePrice,
    productName,
    offerPrice,
  );
}

function removeLegacyOfferPrice(message: string) {
  return message
    .split('\n')
    .filter((line) => !/^\s*pre[cç]o\s+de\s+oferta\s*:/i.test(line))
    .join('\n');
}

function hasOfferPriceByVariation(message: string, offerPrice: string) {
  return message
    .split('\n')
    .some((line) => line.includes(offerPrice) && !isStandaloneOfferPrice(line, offerPrice));
}

function removeStandaloneOfferPrice(message: string, offerPrice: string) {
  return message
    .split('\n')
    .filter((line) => !isStandaloneOfferPrice(line, offerPrice))
    .join('\n');
}

function isStandaloneOfferPrice(line: string, offerPrice: string) {
  return line.trim() === `💰 ${offerPrice}`;
}

function insertOfferPriceBelowProduct(message: string, productName: string, offerPrice: string) {
  const lines = message.split('\n');
  const normalizedProductName = normalizeForMatch(productName);
  const productLineIndex = lines.findIndex((line) =>
    normalizeForMatch(line).includes(normalizedProductName),
  );

  if (productLineIndex === -1) {
    return normalizeMessageSpacing(message);
  }

  lines.splice(productLineIndex + 1, 0, '', `💰 ${offerPrice}`);
  return normalizeMessageSpacing(lines.join('\n'));
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMessageSpacing(message: string) {
  return message.replace(/\n{3,}/g, '\n\n').trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function findTemplateForProductType(templates: CommercialTemplate[], productType?: string) {
  const usedProduct = productType === 'IPHONE_USED' || productType === 'APPLE_CPO';
  return (
    templates.find((template) => template.productType === (usedProduct ? 'IPHONE_USED' : 'IPHONE_SEALED')) ??
    templates[0]
  );
}
