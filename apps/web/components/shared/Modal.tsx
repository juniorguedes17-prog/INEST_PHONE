'use client';

import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  dialogClassName?: string;
  contentClassName?: string;
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  dialogClassName,
  contentClassName,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={cn('w-full max-w-xl rounded-2xl border border-inest-line bg-white p-6 shadow-panel', dialogClassName)}>
        <div className="flex items-center justify-between gap-4">
          <h2 id="modal-title" className="font-display text-2xl font-black text-inest-text">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar modal"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-inest-line text-inest-muted hover:bg-inest-soft"
          >
            ×
          </button>
        </div>
        <div className={cn('mt-5', contentClassName)}>{children}</div>
        {footer ? <div className={cn('mt-6 flex justify-end gap-3')}>{footer}</div> : null}
      </div>
    </div>
  );
}
