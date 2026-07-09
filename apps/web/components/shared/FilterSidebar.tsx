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
        'h-full min-h-0 overflow-y-auto rounded-2xl border border-inest-line bg-white p-6 shadow-panel scrollbar-stable',
        className,
      )}
      aria-label={title}
    >
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-wide text-inest-blue">{eyebrow}</p>
        <h2 className="mt-1 font-display text-2xl font-black text-inest-text">{title}</h2>
      </div>
      <div className="grid gap-5">{children}</div>
    </aside>
  );
}

export function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  return (
    <details className="group border-t border-inest-line pt-5" open={defaultOpen}>
      <summary className="cursor-pointer list-none text-lg font-black text-inest-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inest-blue">
        <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="mt-4 grid gap-3">{children}</div>
    </details>
  );
}
