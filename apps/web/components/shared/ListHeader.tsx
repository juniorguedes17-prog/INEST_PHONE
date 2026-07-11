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
        'rounded-xl border border-inest-line bg-white px-4 py-3 shadow-card',
        sticky && 'sticky top-0 z-10',
      )}
    >
      <div className="flex min-h-12 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-black uppercase tracking-wide text-inest-blue">{eyebrow}</p>
          ) : null}
          <h2 className="mt-0.5 text-card-title">{title}</h2>
          {description ? <p className="mt-1 text-sm text-inest-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
