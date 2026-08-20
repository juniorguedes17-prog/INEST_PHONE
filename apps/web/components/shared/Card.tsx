import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'rounded-xl border border-inest-line/80 bg-inest-surface p-5 shadow-[0_10px_30px_rgba(16,24,40,0.045)] sm:p-6',
        className,
      )}
      {...props}
    />
  );
}
