import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
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
  const isRecent = Date.now() - new Date(quote.updatedAt).getTime() < 24 * 60 * 60 * 1000;

  return (
    <article
      className={`grid w-full gap-3 rounded-xl border bg-white p-3 shadow-card transition-colors focus-within:ring-2 focus-within:ring-inest-blue/30 md:grid-cols-[28px_64px_minmax(220px,1fr)_180px_170px] md:items-center ${
        selected
          ? 'border-inest-blue bg-blue-50/30'
          : 'border-inest-line hover:border-slate-300 hover:bg-slate-50/60'
      }`}
    >
      <label className="grid h-8 w-8 place-items-center" title="Selecionar produto">
        <span className="sr-only">Selecionar {quote.productName}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(quote.id, event.target.checked)}
          className="h-4 w-4 rounded border-inest-line accent-inest-blue"
        />
      </label>

      <div className="grid h-16 w-16 place-items-center rounded-lg bg-inest-soft font-display text-lg font-black text-inest-blue">
        {quote.category?.slice(0, 2).toUpperCase() || 'IN'}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-1 text-base font-black text-inest-text">{quote.productName}</h3>
          <StatusBadge tone={quote.status === 'hidden' ? 'gray' : 'green'}>
            {quote.status === 'hidden' ? 'Ocultado' : quote.quality || 'Valido'}
          </StatusBadge>
          {isRecent ? <StatusBadge tone="blue">Atualizado agora</StatusBadge> : null}
          {favorite ? <StatusBadge tone="amber">Favorito</StatusBadge> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[quote.category, quote.model, quote.color, quote.capacity, quote.productType]
            .filter(Boolean)
            .map((tag) => (
              <InfoTag key={tag}>{tag}</InfoTag>
            ))}
        </div>
        {quote.inconsistencies.length ? (
          <p className="mt-1.5 text-xs font-bold text-amber-700">Pendente de revisao</p>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">{quote.supplier.name}</strong>
        <p className="mt-1 truncate text-xs text-inest-muted">
          {quote.city || quote.supplier.source || 'Local nao informado'}
        </p>
        <InfoTag className="mt-2">{quote.deliveryTime || 'Prazo nao informado'}</InfoTag>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco fornecedor</span>
        <strong className="font-display text-2xl font-black text-inest-text">
          {formatCurrency(quote.costProduct)}
        </strong>
        <span className="text-xs text-inest-muted">{formatDateTime(quote.updatedAt)}</span>
        <div className="mt-1.5 flex flex-wrap gap-1 md:justify-end">
          <QuickAction label="Ver" title="Visualizar cotacao" onClick={() => onView(quote)} />
          <QuickAction label="Precificar" title="Abrir Precificacao" onClick={onPricing} />
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

function QuickAction({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
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
