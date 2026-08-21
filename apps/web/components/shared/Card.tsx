import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] sm:p-6',
        className,
      )}
      {...props}
    />
  );
}
