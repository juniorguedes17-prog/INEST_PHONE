import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        'flex h-11 items-center gap-2 rounded-lg border border-inest-line/90 bg-inest-surface px-3.5 text-inest-muted transition-all focus-within:border-inest-blue focus-within:ring-4 focus-within:ring-inest-blue/10',
        className,
      )}
    >
      <span aria-hidden="true" className="text-xs font-black">
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
