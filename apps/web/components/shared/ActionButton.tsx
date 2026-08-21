import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type ActionButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost' | 'danger';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  icon?: ReactNode;
}

const variants: Record<ActionButtonVariant, string> = {
  primary:
    'border-transparent bg-gradient-to-r from-inest-blue to-[#6b69ec] text-white shadow-soft hover:-translate-y-px hover:brightness-[0.97] hover:shadow-[0_16px_32px_rgba(95,124,255,0.28)]',
  secondary:
    'border-inest-line bg-inest-surface text-inest-text shadow-[0_4px_12px_rgba(16,24,40,0.035)] hover:-translate-y-px hover:bg-inest-soft hover:shadow-[0_8px_18px_rgba(16,24,40,0.07)]',
  success:
    'border-transparent bg-inest-green text-white shadow-[0_12px_28px_rgba(14,163,113,0.18)] hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(14,163,113,0.24)]',
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
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all focus:outline-none focus:ring-4 focus:ring-inest-blue/15 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
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
