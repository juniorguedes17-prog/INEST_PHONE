'use client';

import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: 'left' | 'right';
  dark?: boolean;
}

export function Drawer({
  open,
  title,
  children,
  onClose,
  side = 'left',
  dark = false,
}: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <aside
        className={cn(
          'h-full w-[min(88vw,360px)] overflow-y-auto p-5 shadow-panel',
          side === 'left' ? 'mr-auto' : 'ml-auto',
          dark
            ? 'border-r border-white/10 bg-[var(--inest-sidebar)] text-white'
            : 'border-r border-inest-line bg-inest-surface text-inest-text',
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2
            className={cn(
              'font-display text-xl font-bold',
              dark ? 'text-white' : 'text-inest-text',
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={onClose}
            className={cn(
              'grid h-10 w-10 place-items-center rounded-xl transition-colors',
              dark
                ? 'border border-white/10 bg-white/[0.04] text-[var(--inest-sidebar-muted)] hover:bg-white/10 hover:text-white'
                : 'border border-inest-line text-inest-muted hover:bg-inest-soft hover:text-inest-text',
            )}
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
