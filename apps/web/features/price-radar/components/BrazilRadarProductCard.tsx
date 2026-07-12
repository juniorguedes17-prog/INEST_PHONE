import { memo } from 'react';
import { ActionButton, InfoTag, StatusBadge } from '@/components/shared';
import { PriceQuoteItem } from '../types/price-radar';

export interface BrazilRadarProduct {
  id: string;
  name: string;
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
}

export const BrazilRadarProductCard = memo(function BrazilRadarProductCard({
  product,
  selected,
  onSelect,
  onView,
  onSupplier,
}: BrazilRadarProductCardProps) {
  return (
    <article
      className={`relative grid min-w-0 gap-3 rounded-xl border bg-white p-3 shadow-card transition-colors focus-within:ring-2 focus-within:ring-inest-blue/30 sm:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[28px_72px_minmax(220px,1fr)_160px_190px] lg:items-center ${
        selected ? 'border-inest-blue bg-blue-50/30' : 'border-inest-line hover:border-slate-300'
      }`}
    >
      <label className="absolute grid min-h-11 min-w-11 place-items-center sm:static" title="Selecionar produto">
        <span className="sr-only">Selecionar {product.name}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(product.id, event.target.checked)}
          className="h-5 w-5 rounded border-inest-line accent-inest-blue"
        />
      </label>

      <div className="ml-10 grid h-16 w-16 place-items-center rounded-lg bg-inest-soft font-display text-lg font-black text-inest-blue sm:ml-0">
        {product.category.slice(0, 2).toUpperCase() || 'IN'}
      </div>

      <div className="min-w-0 sm:col-span-1 lg:col-span-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black text-inest-text">{product.name}</h3>
          <StatusBadge tone="green">Brasil</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[product.model, product.color, product.capacity].filter(Boolean).map((tag) => (
            <InfoTag key={tag}>{tag}</InfoTag>
          ))}
        </div>
      </div>

      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedores</p>
        <strong className="mt-1 block text-lg text-inest-text">{product.supplierCount}</strong>
        <span className="text-xs text-inest-muted">com cotacao valida</span>
      </div>

      <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:text-right">
        <span className="text-[10px] font-black uppercase text-inest-muted">Menor custo encontrado</span>
        <strong className="mt-1 block font-display text-2xl font-black text-inest-text">
          {formatCurrency(product.lowestCost)}
        </strong>
        <span className="text-xs text-inest-muted">Atualizado {formatDateTime(product.updatedAt)}</span>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:flex lg:justify-end">
          <ActionButton variant="secondary" className="min-h-11 px-3" onClick={() => onView(product.referenceQuote)}>
            Visualizar
          </ActionButton>
          <ActionButton variant="success" className="min-h-11 px-3" onClick={() => onSupplier(product.referenceQuote)}>
            Fornecedor
          </ActionButton>
          <ActionButton className="col-span-2 min-h-11 px-3 lg:col-auto" disabled title="Integracao com Precificacao preparada">
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
