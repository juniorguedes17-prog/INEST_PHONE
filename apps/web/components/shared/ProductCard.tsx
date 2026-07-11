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
        'grid w-full max-w-full grid-cols-1 gap-4 rounded-xl border border-inest-line bg-white p-4 shadow-card md:grid-cols-[96px_minmax(0,1fr)] xl:grid-cols-[96px_minmax(220px,1fr)_210px_220px]',
        className,
      )}
    >
      <div className="grid h-24 w-24 place-items-center rounded-xl bg-slate-100 shadow-inner">
        {image ?? <span className="text-3xl font-black text-slate-400">P</span>}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="line-clamp-2 text-card-title">{title}</h3>
          {status ? <StatusBadge>{status}</StatusBadge> : null}
        </div>
        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <InfoTag key={tag}>{tag}</InfoTag>
            ))}
          </div>
        ) : null}
        {meta ? <p className="mt-3 max-w-2xl text-xs leading-5 text-inest-muted">{meta}</p> : null}
      </div>

      <div className="min-w-0 rounded-lg bg-inest-soft p-3 xl:bg-transparent xl:p-0">
        <p className="text-sm font-bold text-inest-muted">Fornecedor</p>
        <strong className="mt-1 block text-base font-black text-inest-text">
          {supplier?.name ?? 'Nao informado'}
        </strong>
        {supplier?.location ? (
          <p className="mt-2 text-sm text-inest-muted">{supplier.location}</p>
        ) : null}
        {supplier?.delivery ? <InfoTag className="mt-3">{supplier.delivery}</InfoTag> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-2 xl:items-end">
        {priceLabel ? (
          <span className="text-sm font-bold text-inest-muted">{priceLabel}</span>
        ) : null}
        <strong className="break-words font-display text-3xl font-black text-inest-text">{price}</strong>
        <div className="flex w-full flex-col gap-2 xl:w-auto">
          {actions.map((action) => (
            <ActionButton
              key={action.label}
              variant={action.variant ?? 'secondary'}
              className="w-full xl:w-40"
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
