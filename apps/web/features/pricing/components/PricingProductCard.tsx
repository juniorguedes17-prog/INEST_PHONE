import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { getProductCardPresentation } from '@/utils/product-card-presentation';
import { PricingItem } from '../types/pricing';

interface PricingProductCardProps {
  item: PricingItem;
  generating: boolean;
  selected: boolean;
  onSelect: (productId: string, selected: boolean) => void;
  onGenerateOffer: (productId: string) => void;
}

export const PricingProductCard = memo(function PricingProductCard({
  item,
  generating,
  selected,
  onSelect,
  onGenerateOffer,
}: PricingProductCardProps) {
  const presentation = getProductCardPresentation({
    canonicalDescription: item.profitProductDescription,
    rawDescription: item.productName,
    condition: item.profitCondition,
    capacity: item.capacity,
    color: item.color,
  });

  return (
    <article className="grid w-full gap-5 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] transition-all hover:-translate-y-px hover:border-inest-blue/25 hover:shadow-card focus-within:ring-4 focus-within:ring-inest-blue/10 md:grid-cols-[28px_minmax(220px,1fr)_170px_150px_170px] md:items-center">
      <label
        className="flex h-8 w-8 items-center justify-center"
        aria-label={`Selecionar ${presentation.title}`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-inest-blue"
          checked={selected}
          disabled={generating || !item.googleSheetsReady}
          onChange={(event) => onSelect(item.productId, event.target.checked)}
        />
      </label>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {presentation.title}
          </h3>
          <StatusBadge tone={item.status === 'ACTIVE' ? 'green' : 'gray'}>
            {translateStatus(item.status)}
          </StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <InfoTag key={tag}>{tag}</InfoTag>
          ))}
        </div>
        {item.calculationError ? (
          <p className="mt-2 text-xs font-bold text-red-700" role="alert">
            {item.calculationError}
          </p>
        ) : null}
        <p className="mt-1.5 truncate text-xs text-inest-muted">
          Atualizado {formatDateTime(item.lastUpdatedAt)}
        </p>
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Fornecedor
        </p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">
          {item.supplier.name}
        </strong>
        {item.supplier.source ? (
          <p className="mt-1 truncate text-xs text-inest-muted">{item.supplier.source}</p>
        ) : null}
        {item.deliveryTime ? <InfoTag className="mt-2">{item.deliveryTime}</InfoTag> : null}
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 md:text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Custo
        </p>
        <strong className="mt-0.5 block text-sm text-inest-text">
          {formatCurrency(item.costProduct)}
        </strong>
        <p className="mt-2 text-[10px] font-black uppercase text-inest-muted">Lucro</p>
        <strong className="mt-0.5 block text-sm text-inest-green">
          {formatCurrency(item.desiredNetProfit)}
        </strong>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1 border-t border-inest-line/70 pt-4 md:items-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Preço de venda
        </span>
        <strong className="font-display text-[28px] font-bold leading-none text-inest-text">
          {formatCurrency(item.salePrice)}
        </strong>
        <span className="text-xs font-bold text-inest-muted">
          Margem {formatPercent(item.margin)}
        </span>
        <ActionButton
          variant="success"
          className="mt-1 h-9 px-3 text-xs"
          disabled={generating || !item.googleSheetsReady}
          onClick={() => onGenerateOffer(item.productId)}
        >
          {generating
            ? 'Preparando...'
            : item.googleSheetsReady
              ? 'Gerar Oferta'
              : 'Calculo bloqueado'}
        </ActionButton>
      </div>
    </article>
  );
});

function translateStatus(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Ativo',
    APPROVED: 'Aprovado',
    PENDING_REVIEW: 'Pendente',
  };
  return map[status] ?? status;
}

function formatCurrency(value: number | null) {
  if (value === null) return '--';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return '--';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
