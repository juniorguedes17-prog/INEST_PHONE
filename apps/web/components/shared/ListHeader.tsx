import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ListHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  sticky?: boolean;
}

export function ListHeader({
  eyebrow,
  title,
  description,
  actions,
  sticky = false,
}: ListHeaderProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-inest-line/70 bg-inest-surface px-5 py-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]',
        sticky && 'sticky top-0 z-10',
      )}
    >
      <div className="flex min-h-12 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-inest-blue">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-0.5 text-card-title">{title}</h2>
          {description ? <p className="mt-1 text-sm text-inest-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
