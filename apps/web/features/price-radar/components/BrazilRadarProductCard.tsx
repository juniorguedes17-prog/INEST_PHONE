import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { getProductCardPresentation } from '@/utils/product-card-presentation';
import { PriceQuoteItem } from '../types/price-radar';

export interface BrazilRadarProduct {
  id: string;
  name: string;
  productDescription?: string | null;
  category: string;
  model: string;
  color: string;
  capacity: string;
  lowestCost: number;
  supplierCount: number;
  updatedAt: string;
  referenceQuote: PriceQuoteItem;
}

interface BrazilRadarProductCardProps {
  product: BrazilRadarProduct;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onView: (quote: PriceQuoteItem) => void;
  onSupplier: (quote: PriceQuoteItem) => void;
  onSendToPricing: (quote: PriceQuoteItem) => void;
}

export const BrazilRadarProductCard = memo(function BrazilRadarProductCard({
  product,
  selected,
  onSelect,
  onView,
  onSupplier,
  onSendToPricing,
}: BrazilRadarProductCardProps) {
  const presentation = getProductCardPresentation({
    canonicalDescription: product.productDescription,
    rawDescription: product.name,
    condition: product.referenceQuote.quality,
    capacity: product.capacity,
    color: product.color,
  });

  return (
    <article
      className={`radar-product-card relative grid min-w-0 gap-5 rounded-2xl border bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] transition-all focus-within:ring-4 focus-within:ring-inest-blue/10 lg:grid-cols-[28px_minmax(220px,1fr)_minmax(150px,0.65fr)_220px] lg:items-center ${
        selected
          ? 'border-inest-blue bg-blue-50/45 shadow-[0_16px_36px_rgba(95,124,255,0.12)]'
          : 'border-inest-line/70 hover:-translate-y-px hover:border-inest-blue/25 hover:shadow-card'
      }`}
    >
      <label
        className="absolute grid min-h-11 min-w-11 place-items-center sm:static"
        title="Selecionar produto"
      >
        <span className="sr-only">Selecionar {presentation.title}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(product.id, event.target.checked)}
          className="h-5 w-5 rounded border-inest-line accent-inest-blue"
        />
      </label>

      <div className="min-w-0 pl-10 lg:pl-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black text-inest-text">
            {presentation.title}
          </h3>
          <StatusBadge tone="green">Brasil</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <InfoTag key={tag}>{tag}</InfoTag>
          ))}
        </div>
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Fornecedor
        </p>
        <strong
          className="mt-1 block truncate text-sm text-inest-text"
          title={product.referenceQuote.supplier.name}
        >
          {product.referenceQuote.supplier.name}
        </strong>
        {product.referenceQuote.city ? (
          <p className="mt-1 truncate text-xs text-inest-muted">{product.referenceQuote.city}</p>
        ) : null}
        {product.supplierCount > 1 ? (
          <span className="mt-1 block text-xs text-inest-muted">
            {product.supplierCount} fornecedores na comparacao
          </span>
        ) : null}
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Custo informado
        </span>
        <strong className="mt-1.5 block font-display text-[28px] font-bold leading-none text-inest-text">
          {formatCurrency(product.lowestCost)}
        </strong>
        <span className="text-xs text-inest-muted">
          Atualizado {formatDateTime(product.updatedAt)}
        </span>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:flex lg:justify-end">
          <ActionButton
            variant="secondary"
            className="min-h-11 px-3"
            onClick={() => onView(product.referenceQuote)}
          >
            Visualizar
          </ActionButton>
          <ActionButton
            variant="success"
            className="min-h-11 px-3"
            onClick={() => onSupplier(product.referenceQuote)}
          >
            Fornecedor
          </ActionButton>
          <ActionButton
            className="col-span-2 min-h-11 px-3 lg:col-auto"
            onClick={() => onSendToPricing(product.referenceQuote)}
          >
            Enviar para Precificacao
          </ActionButton>
        </div>
      </div>
    </article>
  );
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
