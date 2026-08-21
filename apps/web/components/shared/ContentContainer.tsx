import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function ContentContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1720px] px-4 sm:px-7 lg:px-10', className)}
      {...props}
    />
  );
}
