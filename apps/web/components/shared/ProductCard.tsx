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
        'grid w-full max-w-full grid-cols-1 gap-3 rounded-xl border border-inest-line bg-white p-3 shadow-card md:grid-cols-[76px_minmax(0,1fr)] md:items-center xl:grid-cols-[76px_minmax(240px,1fr)_190px_220px]',
        className,
      )}
    >
      <div className="grid h-[76px] w-[76px] place-items-center overflow-hidden rounded-lg bg-slate-100 shadow-inner">
        {image ?? <span className="text-2xl font-black text-slate-400">P</span>}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 text-card-title">{title}</h3>
          {status ? <StatusBadge>{status}</StatusBadge> : null}
        </div>
        {tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <InfoTag key={tag}>{tag}</InfoTag>
            ))}
          </div>
        ) : null}
        {meta ? <p className="mt-2 line-clamp-1 max-w-2xl text-xs text-inest-muted">{meta}</p> : null}
      </div>

      <div className="min-w-0 rounded-lg bg-inest-soft p-3 xl:bg-transparent xl:p-0">
        <p className="text-xs font-bold uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm font-black text-inest-text">
          {supplier?.name ?? 'Nao informado'}
        </strong>
        {supplier?.location ? (
          <p className="mt-1 truncate text-xs text-inest-muted">{supplier.location}</p>
        ) : null}
        {supplier?.delivery ? <InfoTag className="mt-2">{supplier.delivery}</InfoTag> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1.5 xl:items-end">
        {priceLabel ? (
          <span className="text-sm font-bold text-inest-muted">{priceLabel}</span>
        ) : null}
        <strong className="break-words font-display text-2xl font-black text-inest-text">{price}</strong>
        <div className="flex w-full flex-wrap gap-1.5 xl:w-auto xl:justify-end">
          {actions.map((action) => (
            <ActionButton
              key={action.label}
              variant={action.variant ?? 'secondary'}
              className="h-9 flex-1 px-3 text-xs xl:flex-none"
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
