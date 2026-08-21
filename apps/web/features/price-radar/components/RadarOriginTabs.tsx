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
      className="grid grid-cols-3 gap-1 rounded-2xl border border-inest-line/70 bg-inest-surface p-1.5 shadow-[0_14px_34px_rgba(16,24,40,0.055)]"
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
            'flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-1',
            value === origin.value
              ? 'bg-gradient-to-r from-inest-blue to-[#6b69ec] text-white shadow-soft'
              : 'text-inest-muted hover:bg-inest-soft hover:text-inest-text',
          )}
        >
          <span className="grid h-6 w-5 shrink-0 place-items-center text-[10px] font-bold">
            {origin.shortLabel}
          </span>
          <span className="truncate">{origin.label}</span>
        </button>
      ))}
    </nav>
  );
}
