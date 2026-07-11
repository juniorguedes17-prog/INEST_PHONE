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
        'h-full min-h-0 overflow-y-auto rounded-xl border border-inest-line bg-white p-5 shadow-card scrollbar-stable',
        className,
      )}
      aria-label={title}
    >
      <div className="mb-4">
        <p className="text-xs font-black uppercase text-inest-blue">{eyebrow}</p>
        <h2 className="mt-1 text-card-title">{title}</h2>
      </div>
      <div className="grid gap-4">{children}</div>
    </aside>
  );
}

export function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  return (
    <details className="group border-t border-inest-line pt-4" open={defaultOpen}>
      <summary className="cursor-pointer list-none text-sm font-black text-inest-text focus:outline-none focus-visible:ring-2 focus-visible:ring-inest-blue">
        <span className="mr-2 inline-block transition group-open:rotate-90">&gt;</span>
        {title}
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}
