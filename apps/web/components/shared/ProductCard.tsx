import { ReactNode } from 'react';
import { ActionButton } from './ActionButton';
import { InfoTag } from './InfoTag';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/utils/cn';

interface ProductCardAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'ghost' | 'danger';
  onClick?: () => void;
}

interface ProductCardProps {
  image?: ReactNode;
  title: string;
  status?: string;
  tags?: string[];
  meta?: string;
  supplier?: {
    name?: string;
    location?: string;
    delivery?: string;
  };
  price: string;
  priceLabel?: string;
  actions?: ProductCardAction[];
  className?: string;
}

export function ProductCard({
  image,
  title,
  status,
  tags = [],
  meta,
  supplier,
  price,
  priceLabel,
  actions = [],
  className,
}: ProductCardProps) {
  return (
    <article
      className={cn(
        'grid w-full max-w-full grid-cols-1 gap-5 rounded-2xl border border-inest-line bg-white p-5 shadow-panel lg:grid-cols-[120px_minmax(0,1fr)_240px_240px]',
        className,
      )}
    >
      <div className="grid h-[120px] w-[120px] place-items-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 shadow-inner">
        {image ?? <span className="text-4xl font-black text-white drop-shadow">▯</span>}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="line-clamp-2 font-display text-xl font-black text-inest-text">{title}</h3>
          {status ? <StatusBadge>{status}</StatusBadge> : null}
        </div>
        {tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <InfoTag key={tag}>{tag}</InfoTag>
            ))}
          </div>
        ) : null}
        {meta ? <p className="mt-4 max-w-2xl text-sm leading-6 text-inest-muted">{meta}</p> : null}
      </div>

      <div className="min-w-0 rounded-2xl bg-inest-soft p-4 lg:bg-transparent lg:p-0">
        <p className="text-sm font-bold text-inest-muted">Fornecedor</p>
        <strong className="mt-1 block text-lg font-black text-inest-text">
          {supplier?.name ?? 'Nao informado'}
        </strong>
        {supplier?.location ? (
          <p className="mt-2 text-sm text-inest-muted">{supplier.location}</p>
        ) : null}
        {supplier?.delivery ? <InfoTag className="mt-3">{supplier.delivery}</InfoTag> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-3 lg:items-end">
        {priceLabel ? (
          <span className="text-sm font-bold text-inest-muted">{priceLabel}</span>
        ) : null}
        <strong className="font-display text-4xl font-black text-inest-text">{price}</strong>
        <div className="flex w-full flex-col gap-3 lg:w-auto">
          {actions.map((action) => (
            <ActionButton
              key={action.label}
              variant={action.variant ?? 'secondary'}
              className="w-full lg:w-44"
              onClick={action.onClick}
            >
              {action.label}
            </ActionButton>
          ))}
        </div>
      </div>
    </article>
  );
}
