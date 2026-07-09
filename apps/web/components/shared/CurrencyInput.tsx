import { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface CurrencyInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function CurrencyInput({ className, label = 'Valor', ...props }: CurrencyInputProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <div
        className={cn(
          'flex h-12 items-center rounded-xl border border-inest-line bg-white px-4 focus-within:border-inest-blue',
          className,
        )}
      >
        <span className="mr-2 font-bold text-inest-muted">R$</span>
        <input
          inputMode="decimal"
          className="min-w-0 flex-1 bg-transparent outline-none"
          {...props}
        />
      </div>
    </label>
  );
}
