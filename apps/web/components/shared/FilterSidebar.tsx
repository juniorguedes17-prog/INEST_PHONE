import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface FilterSidebarProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}

interface FilterSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function FilterSidebar({
  eyebrow = 'Filtros',
  title,
  children,
  className,
}: FilterSidebarProps) {
  return (
    <aside
      className={cn(
        'h-full min-h-0 overflow-y-auto rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] scrollbar-stable',
        className,
      )}
      aria-label={title}
    >
      <div className="mb-3 border-b border-inest-line pb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-inest-blue">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-card-title">{title}</h2>
      </div>
      <div className="grid">{children}</div>
    </aside>
  );
}

export function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  return (
    <details className="group border-b border-inest-line py-3 last:border-b-0" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-sm font-black text-inest-text outline-none focus-visible:ring-2 focus-visible:ring-inest-blue [&::-webkit-details-marker]:hidden">
        {title}
        <span className="ml-3 inline-block text-inest-muted transition group-open:rotate-90">
          &gt;
        </span>
      </summary>
      <div className="mt-3 grid gap-3 pb-1">{children}</div>
    </details>
  );
}
