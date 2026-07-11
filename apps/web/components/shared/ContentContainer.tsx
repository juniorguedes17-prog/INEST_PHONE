import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export function ContentContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8', className)}
      {...props}
    />
  );
}
