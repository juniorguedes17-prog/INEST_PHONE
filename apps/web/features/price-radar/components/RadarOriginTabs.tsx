'use client';

import { cn } from '@/utils/cn';

export type RadarOrigin = 'brasil' | 'paraguai' | 'eua';

const origins: Array<{ value: RadarOrigin; label: string; shortLabel: string }> = [
  { value: 'brasil', label: 'Brasil', shortLabel: 'BR' },
  { value: 'paraguai', label: 'Paraguai', shortLabel: 'PY' },
  { value: 'eua', label: 'EUA', shortLabel: 'US' },
];

interface RadarOriginTabsProps {
  value: RadarOrigin;
  onChange: (value: RadarOrigin) => void;
}

export function RadarOriginTabs({ value, onChange }: RadarOriginTabsProps) {
  return (
    <nav
      className="grid grid-cols-3 gap-1 rounded-xl border border-inest-line bg-white p-1 shadow-card"
      aria-label="Origem do Radar de Precos"
    >
      {origins.map((origin) => (
        <button
          key={origin.value}
          type="button"
          role="tab"
          aria-selected={value === origin.value}
          onClick={() => onChange(origin.value)}
          className={cn(
            'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-black transition-colors focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-1',
            value === origin.value
              ? 'bg-inest-blue text-white shadow-soft'
              : 'text-inest-muted hover:bg-inest-soft hover:text-inest-text',
          )}
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-current/20 text-[10px]">
            {origin.shortLabel}
          </span>
          <span className="truncate">{origin.label}</span>
        </button>
      ))}
    </nav>
  );
}
