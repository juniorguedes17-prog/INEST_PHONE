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
      className="inline-flex h-10 items-center rounded-lg border border-inest-line bg-inest-soft p-1"
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
            'h-8 rounded-md px-3 text-sm font-bold text-inest-muted transition-colors',
            item.value === value && 'bg-white text-inest-text shadow-sm',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
