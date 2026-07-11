import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-xl border border-inest-line bg-inest-surface p-5 shadow-card sm:p-6',
        className,
      )}
      {...props}
    />
  );
}
