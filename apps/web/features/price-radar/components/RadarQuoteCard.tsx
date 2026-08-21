import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { getProductCardPresentation } from '@/utils/product-card-presentation';
import { PriceQuoteItem } from '../types/price-radar';

interface RadarQuoteCardProps {
  quote: PriceQuoteItem;
  selected: boolean;
  favorite: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onView: (quote: PriceQuoteItem) => void;
  onPricing: () => void;
  onOffer: () => void;
  onFavorite: (id: string) => void;
  onCopy: (quote: PriceQuoteItem) => void;
  onSupplier: (quote: PriceQuoteItem) => void;
  onHide: (id: string) => void;
}

export const RadarQuoteCard = memo(function RadarQuoteCard({
  quote,
  selected,
  favorite,
  onSelect,
  onView,
  onPricing,
  onOffer,
  onFavorite,
  onCopy,
  onSupplier,
  onHide,
}: RadarQuoteCardProps) {
  const presentation = getProductCardPresentation({
    canonicalDescription: quote.productDescription,
    rawDescription: quote.productName,
    condition: quote.quality,
    capacity: quote.capacity,
    color: quote.color,
  });

  return (
    <article
      className={`grid w-full gap-5 rounded-2xl border bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] transition-all focus-within:ring-4 focus-within:ring-inest-blue/10 md:grid-cols-[28px_minmax(220px,1fr)_180px_170px] md:items-center ${
        selected
          ? 'border-inest-blue bg-blue-50/45 shadow-[0_16px_36px_rgba(95,124,255,0.12)]'
          : 'border-inest-line/70 hover:-translate-y-px hover:border-inest-blue/25 hover:shadow-card'
      }`}
    >
      <label className="grid h-8 w-8 place-items-center" title="Selecionar produto">
        <span className="sr-only">Selecionar {presentation.title}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(quote.id, event.target.checked)}
          className="h-4 w-4 rounded border-inest-line accent-inest-blue"
        />
      </label>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black text-inest-text">
            {presentation.title}
          </h3>
          <StatusBadge tone={quote.status === 'hidden' ? 'gray' : 'green'}>
            {quote.status === 'hidden' ? 'Ocultado' : 'Válido'}
          </StatusBadge>
          {favorite ? <StatusBadge tone="amber">Favorito</StatusBadge> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <InfoTag key={tag}>{tag}</InfoTag>
          ))}
        </div>
        {quote.inconsistencies.length ? (
          <p className="mt-1.5 text-xs font-bold text-amber-700">Pendente de revisão</p>
        ) : null}
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Fornecedor
        </p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">
          {quote.supplier.name}
        </strong>
        {quote.city || quote.supplier.source ? (
          <p className="mt-1 truncate text-xs text-inest-muted">
            {quote.city || quote.supplier.source}
          </p>
        ) : null}
        {quote.deliveryTime ? <InfoTag className="mt-2">{quote.deliveryTime}</InfoTag> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1 border-t border-inest-line/70 pt-4 md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Preço fornecedor
        </span>
        <strong className="font-display text-[28px] font-bold leading-none text-inest-text">
          {formatCurrency(quote.costProduct)}
        </strong>
        <span className="text-xs text-inest-muted">{formatDateTime(quote.updatedAt)}</span>
        <div className="mt-1.5 flex flex-wrap gap-1 md:justify-end">
          <QuickAction label="Ver" title="Visualizar cotação" onClick={() => onView(quote)} />
          <QuickAction label="Precificar" title="Abrir Precificação" onClick={onPricing} />
          <QuickAction label="Oferta" title="Adicionar a oferta" onClick={onOffer} />
          <QuickAction
            label={favorite ? 'Salvo' : 'Favoritar'}
            title="Favoritar produto"
            onClick={() => onFavorite(quote.id)}
          />
          <QuickAction label="Copiar" title="Copiar informacoes" onClick={() => onCopy(quote)} />
          <ActionButton
            variant="success"
            className="h-8 px-2.5 text-[11px]"
            onClick={() => onSupplier(quote)}
          >
            Fornecedor
          </ActionButton>
          <ActionButton
            variant="danger"
            className="h-8 px-2.5 text-[11px]"
            onClick={() => onHide(quote.id)}
          >
            Ocultar
          </ActionButton>
        </div>
      </div>
    </article>
  );
});

function QuickAction({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <ActionButton
      variant="secondary"
      className="h-8 px-2.5 text-[11px]"
      title={title}
      onClick={onClick}
    >
      {label}
    </ActionButton>
  );
}

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
