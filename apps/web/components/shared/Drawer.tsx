'use client';

import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface DrawerProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  side?: 'left' | 'right';
}

export function Drawer({ open, title, children, onClose, side = 'left' }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" role="dialog" aria-modal="true">
      <aside
        className={cn(
          'h-full w-[min(88vw,360px)] overflow-y-auto bg-white p-5 shadow-panel',
          side === 'left' ? 'mr-auto' : 'ml-auto',
        )}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-black text-inest-text">{title}</h2>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-inest-line text-inest-muted hover:bg-inest-soft"
          >
            ×
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
