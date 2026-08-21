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
        'grid w-full max-w-full grid-cols-1 gap-5 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] transition-all hover:-translate-y-px hover:border-inest-blue/25 hover:shadow-card md:grid-cols-1 md:items-center xl:grid-cols-[minmax(240px,1fr)_190px_220px]',
        className,
      )}
    >
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
        {meta ? (
          <p className="mt-2 line-clamp-1 max-w-2xl text-xs text-inest-muted">{meta}</p>
        ) : null}
      </div>

      <div className="min-w-0 border-t border-inest-line/70 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
          Fornecedor
        </p>
        <strong className="mt-1 block truncate text-sm font-semibold text-inest-text">
          {supplier?.name ?? 'Nao informado'}
        </strong>
        {supplier?.location ? (
          <p className="mt-1 truncate text-xs text-inest-muted">{supplier.location}</p>
        ) : null}
        {supplier?.delivery ? <InfoTag className="mt-2">{supplier.delivery}</InfoTag> : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1.5 border-t border-inest-line/70 pt-4 xl:items-end xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        {priceLabel ? (
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-inest-muted">
            {priceLabel}
          </span>
        ) : null}
        <strong className="break-words font-display text-[28px] font-bold leading-none text-inest-text">
          {price}
        </strong>
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
