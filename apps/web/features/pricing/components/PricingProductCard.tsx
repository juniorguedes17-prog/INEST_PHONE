import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { PricingItem } from '../types/pricing';

interface PricingProductCardProps {
  item: PricingItem;
  generating: boolean;
  onGenerateOffer: (productId: string) => void;
}

export const PricingProductCard = memo(function PricingProductCard({
  item,
  generating,
  onGenerateOffer,
}: PricingProductCardProps) {
  return (
    <article className="grid w-full gap-3 rounded-xl border border-inest-line bg-white p-3 shadow-card transition-colors hover:border-slate-300 hover:bg-slate-50/60 focus-within:ring-2 focus-within:ring-inest-blue/30 md:grid-cols-[64px_minmax(220px,1fr)_170px_150px_170px] md:items-center">
      <div className="grid h-16 w-16 place-items-center rounded-lg bg-inest-soft font-display text-lg font-black text-inest-blue">
        {item.category?.slice(0, 2).toUpperCase() || 'IN'}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {item.productName}
          </h3>
          <StatusBadge tone={item.status === 'ACTIVE' ? 'green' : 'gray'}>
            {translateStatus(item.status)}
          </StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            item.category,
            item.model,
            item.color,
            item.capacity,
            item.productType,
            item.profitCondition,
          ]
            .filter(Boolean)
            .map((tag) => (
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

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">
          {item.supplier.name}
        </strong>
        <p className="mt-1 truncate text-xs text-inest-muted">
          {item.supplier.source || 'Menor preco valido'}
        </p>
        <InfoTag className="mt-2">{item.deliveryTime || 'Prazo nao informado'}</InfoTag>
      </div>

      <div className="min-w-0 md:text-right">
        <p className="text-[10px] font-black uppercase text-inest-muted">Custo</p>
        <strong className="mt-0.5 block text-sm text-inest-text">
          {formatCurrency(item.costProduct)}
        </strong>
        <p className="mt-2 text-[10px] font-black uppercase text-inest-muted">Lucro</p>
        <strong className="mt-0.5 block text-sm text-inest-green">
          {formatCurrency(item.desiredNetProfit)}
        </strong>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco de venda</span>
        <strong className="font-display text-2xl font-black text-inest-text">
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
