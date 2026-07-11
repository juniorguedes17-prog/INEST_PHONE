import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  return (
    <label className="block" htmlFor={id}>
      {label ? <span className="field-label">{label}</span> : null}
      <input
        ref={ref}
        id={id}
        className={cn('field-control', error && 'border-red-400', className)}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error || hint ? (
        <span className={cn('mt-1.5 block text-xs', error ? 'text-red-600' : 'text-inest-muted')}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});
