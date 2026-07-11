import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type KpiTone = 'blue' | 'green' | 'purple' | 'amber';

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: KpiTone;
  icon?: ReactNode;
}

const accents: Record<KpiTone, string> = {
  blue: 'before:bg-inest-blue',
  green: 'before:bg-inest-green',
  purple: 'before:bg-inest-purple',
  amber: 'before:bg-amber-500',
};

export function KpiCard({ label, value, detail, tone = 'blue', icon }: KpiCardProps) {
  return (
    <article
      className={cn(
        'relative min-h-[116px] overflow-hidden rounded-xl border border-inest-line bg-white p-4 shadow-card before:absolute before:inset-y-0 before:left-0 before:w-1',
        accents[tone],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-bold text-inest-muted">{label}</span>
        {icon ? <span className="text-inest-muted">{icon}</span> : null}
      </div>
      <strong className="mt-2 block font-display text-2xl font-black text-inest-text">
        {value}
      </strong>
      {detail ? <small className="mt-1.5 block text-xs text-inest-muted">{detail}</small> : null}
    </article>
  );
}
