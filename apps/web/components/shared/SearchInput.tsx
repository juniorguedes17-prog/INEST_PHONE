import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        'flex h-11 items-center gap-2.5 rounded-xl border border-inest-line/90 bg-inest-surface px-3.5 text-inest-muted shadow-[0_4px_12px_rgba(16,24,40,0.025)] transition-all hover:border-inest-blue/45 focus-within:border-inest-blue focus-within:ring-4 focus-within:ring-inest-blue/10',
        className,
      )}
    >
      <span aria-hidden="true" className="text-[10px] font-bold text-inest-blue">
        Q
      </span>
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-sm text-inest-text outline-none placeholder:text-inest-muted"
        {...props}
      />
    </label>
  );
}
