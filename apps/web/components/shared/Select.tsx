import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className, id, children, ...props },
  ref,
) {
  return (
    <label className="block" htmlFor={id}>
      {label ? <span className="field-label">{label}</span> : null}
      <select ref={ref} id={id} className={cn('field-control', className)} {...props}>
        {children}
      </select>
    </label>
  );
});
