import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function InfoTag({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6 items-center rounded-lg border border-inest-line/80 bg-inest-soft/75 px-2.5 text-[11px] font-medium text-inest-text',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
