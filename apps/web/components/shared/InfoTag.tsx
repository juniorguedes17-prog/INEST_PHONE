import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function InfoTag({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-8 items-center rounded-full border border-inest-line bg-white px-3 text-sm font-extrabold text-inest-text',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
