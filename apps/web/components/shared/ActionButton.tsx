import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type ActionButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost' | 'danger';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  icon?: ReactNode;
}

const variants: Record<ActionButtonVariant, string> = {
  primary:
    'border-transparent bg-gradient-to-br from-inest-blue to-inest-purple text-white shadow-soft',
  secondary: 'border-inest-line bg-white text-inest-text hover:bg-inest-soft',
  success:
    'border-transparent bg-inest-green text-white shadow-[0_12px_28px_rgba(14,163,113,0.18)]',
  ghost:
    'border-transparent bg-transparent text-inest-muted hover:bg-inest-soft hover:text-inest-text',
  danger: 'border-transparent bg-red-600 text-white shadow-[0_12px_28px_rgba(220,38,38,0.18)]',
};

export function ActionButton({
  children,
  className,
  variant = 'primary',
  icon,
  type = 'button',
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-inest-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
