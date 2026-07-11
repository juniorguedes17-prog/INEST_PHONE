import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function InfoTag({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-full border border-inest-line bg-white px-2.5 text-xs font-bold text-inest-text',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
