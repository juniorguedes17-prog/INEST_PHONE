import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type StatusTone = 'blue' | 'green' | 'amber' | 'red' | 'gray';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

const tones: Record<StatusTone, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  gray: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function StatusBadge({ className, tone = 'blue', children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-black',
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
