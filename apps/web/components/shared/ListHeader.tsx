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
        'rounded-2xl border border-inest-line bg-white p-6 shadow-panel',
        sticky && 'sticky top-0 z-10',
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-black uppercase tracking-wide text-inest-blue">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 font-display text-2xl font-black text-inest-text">{title}</h2>
          {description ? <p className="mt-2 text-base text-inest-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}
