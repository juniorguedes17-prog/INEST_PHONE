import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type KpiTone = 'blue' | 'green' | 'purple' | 'amber';

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: KpiTone;
  icon?: ReactNode;
  className?: string;
}

const accents: Record<KpiTone, string> = {
  blue: 'before:bg-inest-blue',
  green: 'before:bg-inest-green',
  purple: 'before:bg-inest-purple',
  amber: 'before:bg-amber-500',
};

export function KpiCard({ label, value, detail, tone = 'blue', icon, className }: KpiCardProps) {
  return (
    <article
      className={cn(
        'relative min-h-[116px] overflow-hidden rounded-2xl border border-inest-line/60 bg-inest-surface px-5 py-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)] before:absolute before:inset-x-0 before:top-0 before:h-1',
        accents[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-inest-muted">
          {label}
        </span>
        {icon ? <span className="text-inest-muted">{icon}</span> : null}
      </div>
      <strong className="mt-2 block break-words font-display text-2xl font-bold leading-tight text-inest-text sm:text-[28px] sm:leading-none">
        {value}
      </strong>
      {detail ? (
        <small className="mt-1 block truncate text-xs text-inest-muted">{detail}</small>
      ) : null}
    </article>
  );
}
