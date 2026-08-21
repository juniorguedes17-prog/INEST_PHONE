'use client';

import { cn } from '@/utils/cn';

interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function Tabs({ items, value, onChange, label = 'Visualizacao' }: TabsProps) {
  return (
    <div
      className="grid w-full grid-cols-3 gap-1 rounded-2xl border border-inest-line/70 bg-inest-surface p-1.5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] sm:inline-grid sm:w-auto"
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={cn(
            'min-h-11 min-w-0 rounded-xl px-3 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-1',
            item.value === value
              ? 'bg-gradient-to-r from-inest-blue to-inest-purple text-white shadow-soft'
              : 'text-inest-muted hover:bg-inest-soft hover:text-inest-text',
          )}
        >
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
