import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        'flex h-12 items-center gap-3 rounded-xl border border-inest-line bg-white px-4 text-inest-muted shadow-[0_8px_24px_rgba(25,33,52,0.04)] focus-within:border-inest-blue',
        className,
      )}
    >
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        className="min-w-0 flex-1 bg-transparent text-base text-inest-text outline-none placeholder:text-inest-muted"
        {...props}
      />
    </label>
  );
}
